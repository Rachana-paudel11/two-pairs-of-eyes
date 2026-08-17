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

// EVALUATE branches: back to ASSESS for a non-terminal action (inspect),
// on to CONSEQUENCE for a terminal one. NEXT_STOP branches: on to the next
// stop's ENTER_AREA, or to SESSION_COMPLETE once the last stop is done.
const TRANSITIONS = Object.freeze({
  [STATES.ENTER_AREA]: [STATES.OBSERVE],
  [STATES.OBSERVE]: [STATES.SUPERVISOR_DIALOGUE],
  [STATES.SUPERVISOR_DIALOGUE]: [STATES.ASSESS],
  [STATES.ASSESS]: [STATES.ACTION_SELECTED],
  [STATES.ACTION_SELECTED]: [STATES.EVALUATE],
  [STATES.EVALUATE]: [STATES.ASSESS, STATES.CONSEQUENCE],
  [STATES.CONSEQUENCE]: [STATES.FEEDBACK],
  [STATES.FEEDBACK]: [STATES.SCORE_UPDATE],
  [STATES.SCORE_UPDATE]: [STATES.NEXT_STOP],
  [STATES.NEXT_STOP]: [STATES.ENTER_AREA, STATES.SESSION_COMPLETE],
  [STATES.SESSION_COMPLETE]: []
});

export class StateMachine {
  constructor(initial = STATES.ENTER_AREA) {
    this.state = initial;
  }

  canTransition(to) {
    return TRANSITIONS[this.state]?.includes(to) ?? false;
  }

  transition(to) {
    if (!this.canTransition(to)) {
      throw new Error(`Illegal transition: ${this.state} -> ${to}`);
    }
    this.state = to;
    return this.state;
  }
}
