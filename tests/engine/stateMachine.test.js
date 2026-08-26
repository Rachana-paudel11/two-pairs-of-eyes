import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StateMachine, STATES } from '../../src/engine/stateMachine.js';

test('walks the full linear action lifecycle in order', () => {
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

test('fires onEnter and onExit callbacks during state transitions', () => {
  const machine = new StateMachine();
  const events = [];

  const unsubEnter = machine.onEnter(STATES.OBSERVE, ({ from, to }) => {
    events.push(`enter:${to}:from:${from}`);
  });
  const unsubExit = machine.onExit(STATES.ENTER_AREA, ({ from, to }) => {
    events.push(`exit:${from}:to:${to}`);
  });

  machine.transition(STATES.OBSERVE);

  assert.deepEqual(events, [
    'exit:ENTER_AREA:to:OBSERVE',
    'enter:OBSERVE:from:ENTER_AREA'
  ]);

  unsubEnter();
  unsubExit();

  machine.transition(STATES.SUPERVISOR_DIALOGUE);
  assert.equal(events.length, 2);
});

test('EVALUATE must transition strictly to CONSEQUENCE', () => {
  const machine = new StateMachine();
  machine.transition(STATES.OBSERVE);
  machine.transition(STATES.SUPERVISOR_DIALOGUE);
  machine.transition(STATES.ASSESS);
  machine.transition(STATES.ACTION_SELECTED);
  machine.transition(STATES.EVALUATE);

  assert.equal(machine.canTransition(STATES.CONSEQUENCE), true);
  assert.equal(machine.canTransition(STATES.ASSESS), false);
  assert.throws(() => machine.transition(STATES.ASSESS), /Illegal transition/);
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
