import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConsequenceState, applyFlags, evaluateEndOfSession } from '../../src/engine/consequences.js';

test('a rule only triggers once every required flag is present', () => {
  let state = createConsequenceState();
  const rules = [{ id: 'escalated', requiresFlags: ['flag_a', 'flag_b'], consequence: 'cutscene' }];

  assert.deepEqual(evaluateEndOfSession(state, rules), []);

  state = applyFlags(state, ['flag_a']);
  assert.deepEqual(evaluateEndOfSession(state, rules), []);

  state = applyFlags(state, ['flag_b']);
  assert.deepEqual(evaluateEndOfSession(state, rules).map((r) => r.id), ['escalated']);
});

test('flags accumulate without duplication', () => {
  let state = createConsequenceState();
  state = applyFlags(state, ['flag_a']);
  state = applyFlags(state, ['flag_a', 'flag_b']);
  assert.deepEqual([...state.flags].sort(), ['flag_a', 'flag_b']);
});
