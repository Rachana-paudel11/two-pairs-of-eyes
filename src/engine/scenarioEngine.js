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
  }

  get currentStop() {
    return this.stops[this.stopIndex] ?? null;
  }

  get isComplete() {
    return this.machine.state === STATES.SESSION_COMPLETE;
  }

  start() {
    if (this.stopIndex !== -1) {
      throw new Error('ScenarioEngine already started');
    }
    this.stopIndex = 0;
    this._enterCurrentStop();
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
    if (resolved.outcome === 'failure') {
      this.consequenceState = applyFlags(this.consequenceState, stop.flags_on_failure);
    }
    this.eventBus.emit('score:changed', {
      stopId: stop.id,
      total: this.score.total,
      tierCounts: this.score.tierCounts
    });

    this.machine.transition(STATES.NEXT_STOP);
    this._advance();
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
    const triggeredRules = evaluateEndOfSession(this.consequenceState, this.endOfSessionRules);
    for (const rule of triggeredRules) {
      this.eventBus.emit('consequence:play', {
        consequence: rule.consequence,
        deferred: true,
        feedback: rule.feedback
      });
    }
    this.eventBus.emit('session:complete', {
      total: this.score.total,
      tierCounts: this.score.tierCounts,
      log: this.score.log,
      flags: [...this.consequenceState.flags],
      triggeredRules: triggeredRules.map((rule) => rule.id)
    });
  }
}
