import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StateMachine, STATES } from '../../src/engine/stateMachine.js';

test('walks the full terminal-action lifecycle in order', () => {
  const machine = new StateMachine();
  const path = [
    STATES.OBSERVE,
    STATES.SUPERVISOR_DIALOGUE,
    STATES.ASSESS,
    STATES.ACTION_SELECTED,
    STATES.EVALUATE,
    STATES.CONSEQUENCE,
    STATES.FEEDBACK,
    STATES.SCORE_UPDATE,
    STATES.NEXT_STOP,
    STATES.SESSION_COMPLETE
  ];
  for (const next of path) {
    machine.transition(next);
  }
  assert.equal(machine.state, STATES.SESSION_COMPLETE);
});

test('EVALUATE can loop back to ASSESS for a non-terminal action (inspect)', () => {
  const machine = new StateMachine();
  machine.transition(STATES.OBSERVE);
  machine.transition(STATES.SUPERVISOR_DIALOGUE);
  machine.transition(STATES.ASSESS);
  machine.transition(STATES.ACTION_SELECTED);
  machine.transition(STATES.EVALUATE);
  machine.transition(STATES.ASSESS);
  assert.equal(machine.state, STATES.ASSESS);
});

test('NEXT_STOP can loop back to ENTER_AREA for the next stop', () => {
  const machine = new StateMachine(STATES.NEXT_STOP);
  machine.transition(STATES.ENTER_AREA);
  assert.equal(machine.state, STATES.ENTER_AREA);
});

test('rejects illegal transitions', () => {
  const machine = new StateMachine();
  assert.throws(() => machine.transition(STATES.CONSEQUENCE), /Illegal transition/);
});

test('SESSION_COMPLETE has no outgoing transitions', () => {
  const machine = new StateMachine(STATES.SESSION_COMPLETE);
  assert.equal(machine.canTransition(STATES.ENTER_AREA), false);
});
