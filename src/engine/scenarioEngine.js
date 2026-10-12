import { StateMachine, STATES } from './stateMachine.js';
import { createScore, applyOutcome } from './scoring.js';
import { createConsequenceState, applyFlags, evaluateEndOfSession } from './consequences.js';
import { createNpc } from '../characters/npc.js';

// Environment-agnostic orchestrator: drives the stop lifecycle for a session
// of `stops`, emitting events for a renderer/UI to subscribe to. No import
// here (or anywhere below it) may reach into renderer/ or ui/.
export class ScenarioEngine {
  constructor({ stopsData, eventBus, interactions }) {
    this.stops = stopsData.stops;
    this.endOfSessionRules = stopsData.endOfSessionRules ?? [];
    this.eventBus = eventBus;
    this.interactions = interactions;
    this.stopIndex = -1;
    this.score = createScore();
    this.consequenceState = createConsequenceState();
    this.machine = new StateMachine();
    if (this.eventBus) {
      const handleContinue = () => {
        if (this.machine.state === STATES.FEEDBACK || this.machine.state === STATES.SCORE_UPDATE) {
          this.nextStop();
        }
      };
      this.eventBus.on('stop:continue', handleContinue);
      this.eventBus.on('ui:continue', handleContinue);
      this.eventBus.on('next:stop', handleContinue);
      this.eventBus.on('continue', handleContinue);
    }
  }

  get currentStop() {
    return this.stops[this.stopIndex] ?? null;
  }

  get isComplete() {
    return this.machine.state === STATES.SESSION_COMPLETE;
  }

  setScenarios(stopsData) {
    if (this.stopIndex !== -1) {
      throw new Error('Cannot change scenarios after session has started');
    }
    this.stops = stopsData.stops;
    this.endOfSessionRules = stopsData.endOfSessionRules ?? [];
  }

  start(startIndex = 0, initialScore = null, initialFlags = null) {
    if (this.stopIndex !== -1) {
      throw new Error('ScenarioEngine already started');
    }
    const safeIndex = Math.max(0, Math.min(this.stops.length - 1, Number(startIndex) || 0));
    this.stopIndex = safeIndex;

    if (initialScore) {
      this.score = {
        total: initialScore.total ?? 0,
        tierCounts: { ...(initialScore.tierCounts || { optimal: 0, partial: 0, failure: 0 }) }
      };
    }

    if (initialFlags && Array.isArray(initialFlags)) {
      this.consequenceState = { flags: new Set(initialFlags) };
    }

    this._enterCurrentStop();

    if (initialScore && initialScore.total !== undefined) {
      this.eventBus.emit('score:changed', {
        stopId: this.currentStop.id,
        total: this.score.total,
        tierCounts: this.score.tierCounts,
        flags: [...this.consequenceState.flags],
        points: 0
      });
    }
  }

  nextStop() {
    if (this.machine.state === STATES.FEEDBACK) {
      this.machine.transition(STATES.SCORE_UPDATE);
    }
    if (this.machine.state !== STATES.SCORE_UPDATE) {
      throw new Error(`Cannot transition to next stop while in state ${this.machine.state}`);
    }
    this.machine.transition(STATES.NEXT_STOP);
    this._advance();
  }

  continue() {
    return this.nextStop();
  }

  chooseAction(actionKey) {
    if (this.machine.state !== STATES.ASSESS) {
      throw new Error(`Cannot choose an action while in state ${this.machine.state}`);
    }
    const stop = this.currentStop;

    this.machine.transition(STATES.ACTION_SELECTED);
    this.machine.transition(STATES.EVALUATE);

    this._resolveAction(stop, actionKey);
  }

  _enterCurrentStop() {
    const stop = this.currentStop;

    this.eventBus.emit('stop:entered', {
      stop,
      alexStartPosition: stop.alexStartPosition,
      alexTargetPosition: stop.alexTargetPosition
    });
    this.machine.transition(STATES.OBSERVE);

    this.machine.transition(STATES.SUPERVISOR_DIALOGUE);
    const npc = createNpc(stop.supervisor);
    this.eventBus.emit('dialogue:line', {
      stopId: stop.id,
      name: npc.name,
      behaviour: npc.behaviour,
      line: npc.dialogue
    });

    this._enterAssess();
  }

  _enterAssess() {
    this.machine.transition(STATES.ASSESS);
    const stop = this.currentStop;
    this.eventBus.emit('actions:available', {
      stopId: stop.id,
      actions: Object.keys(stop.actions)
    });
  }

  _resolveAction(stop, actionKey) {
    const actionDef = stop.actions[actionKey];
    if (!actionDef) {
      throw new Error(`Stop "${stop.id}" has no action "${actionKey}"`);
    }
    const interaction = this.interactions[actionDef.interaction];
    if (!interaction) {
      throw new Error(`Unknown interaction "${actionDef.interaction}" for action "${actionKey}"`);
    }
    const resolved = interaction.resolve(actionDef);

    this.machine.transition(STATES.CONSEQUENCE);
    this.eventBus.emit('action:resolved', {
      stopId: stop.id,
      actionKey,
      alexAction: resolved.alexAction || actionDef.alexAction,
      alexTargetPosition: stop.alexTargetPosition,
      alexStartPosition: stop.alexStartPosition,
      ...resolved
    });
    this.eventBus.emit('consequence:play', {
      stopId: stop.id,
      consequence: resolved.consequence,
      deferred: false
    });

    // FEEDBACK is a real lifecycle state so a UI can pace itself before the
    // score updates; its text already travelled on action:resolved above.
    this.machine.transition(STATES.FEEDBACK);

    this.machine.transition(STATES.SCORE_UPDATE);
    this.score = applyOutcome(this.score, {
      stopId: stop.id,
      actionKey,
      points: resolved.points,
      outcome: resolved.outcome
    });
    if (resolved.outcome === 'failure' && Array.isArray(stop.flags_on_failure) && stop.flags_on_failure.length > 0) {
      this.consequenceState = applyFlags(this.consequenceState, stop.flags_on_failure);
      this.eventBus.emit('flags:updated', {
        stopId: stop.id,
        newFlags: stop.flags_on_failure,
        allFlags: [...this.consequenceState.flags]
      });
    }
    this.eventBus.emit('score:changed', {
      stopId: stop.id,
      total: this.score.total,
      tierCounts: this.score.tierCounts,
      flags: [...this.consequenceState.flags],
      outcome: resolved.outcome,
      points: resolved.points
    });
  }

  _advance() {
    if (this.stopIndex + 1 < this.stops.length) {
      this.stopIndex += 1;
      this.machine.transition(STATES.ENTER_AREA);
      this._enterCurrentStop();
    } else {
      this.machine.transition(STATES.SESSION_COMPLETE);
      this._completeSession();
    }
  }

  _completeSession() {
    this.eventBus.emit('session:complete', {
      total: this.score.total,
      tierCounts: this.score.tierCounts,
      log: this.score.log,
      flags: [...this.consequenceState.flags],
      triggeredRules: []
    });
  }
}
