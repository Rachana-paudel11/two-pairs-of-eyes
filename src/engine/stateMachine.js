export const STATES = Object.freeze({
  ENTER_AREA: 'ENTER_AREA',
  OBSERVE: 'OBSERVE',
  SUPERVISOR_DIALOGUE: 'SUPERVISOR_DIALOGUE',
  ASSESS: 'ASSESS',
  ACTION_SELECTED: 'ACTION_SELECTED',
  EVALUATE: 'EVALUATE',
  CONSEQUENCE: 'CONSEQUENCE',
  FEEDBACK: 'FEEDBACK',
  SCORE_UPDATE: 'SCORE_UPDATE',
  NEXT_STOP: 'NEXT_STOP',
  SESSION_COMPLETE: 'SESSION_COMPLETE'
});

// Linear state machine for warehouse inspection lifecycle.
// EVALUATE proceeds to CONSEQUENCE. NEXT_STOP branches: back to ENTER_AREA
// for the next stop, or to SESSION_COMPLETE after the final stop.
const TRANSITIONS = Object.freeze({
  [STATES.ENTER_AREA]: [STATES.OBSERVE],
  [STATES.OBSERVE]: [STATES.SUPERVISOR_DIALOGUE],
  [STATES.SUPERVISOR_DIALOGUE]: [STATES.ASSESS],
  [STATES.ASSESS]: [STATES.ACTION_SELECTED],
  [STATES.ACTION_SELECTED]: [STATES.EVALUATE],
  [STATES.EVALUATE]: [STATES.CONSEQUENCE],
  [STATES.CONSEQUENCE]: [STATES.FEEDBACK],
  [STATES.FEEDBACK]: [STATES.SCORE_UPDATE],
  [STATES.SCORE_UPDATE]: [STATES.NEXT_STOP],
  [STATES.NEXT_STOP]: [STATES.ENTER_AREA, STATES.SESSION_COMPLETE],
  [STATES.SESSION_COMPLETE]: []
});

export class StateMachine {
  constructor(initial = STATES.ENTER_AREA) {
    this.state = initial;
    this._enterCallbacks = new Map();
    this._exitCallbacks = new Map();
  }

  canTransition(to) {
    return TRANSITIONS[this.state]?.includes(to) ?? false;
  }

  onEnter(state, callback) {
    if (!this._enterCallbacks.has(state)) {
      this._enterCallbacks.set(state, new Set());
    }
    this._enterCallbacks.get(state).add(callback);
    return () => this._enterCallbacks.get(state)?.delete(callback);
  }

  onExit(state, callback) {
    if (!this._exitCallbacks.has(state)) {
      this._exitCallbacks.set(state, new Set());
    }
    this._exitCallbacks.get(state).add(callback);
    return () => this._exitCallbacks.get(state)?.delete(callback);
  }

  transition(to, context = {}) {
    if (!this.canTransition(to)) {
      throw new Error(`Illegal transition: ${this.state} -> ${to}`);
    }

    const previousState = this.state;

    // Run onExit hooks for previous state
    for (const cb of this._exitCallbacks.get(previousState) ?? []) {
      cb({ from: previousState, to, context });
    }

    this.state = to;

    // Run onEnter hooks for new state
    for (const cb of this._enterCallbacks.get(to) ?? []) {
      cb({ from: previousState, to, context });
    }

    return this.state;
  }
}
