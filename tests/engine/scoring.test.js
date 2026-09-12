import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScore, applyOutcome } from '../../src/engine/scoring.js';

test('accumulates points and tier counts across outcomes', () => {
  let score = createScore();
  score = applyOutcome(score, { stopId: 'a', actionKey: 'x', points: 5, outcome: 'optimal' });
  score = applyOutcome(score, { stopId: 'b', actionKey: 'y', points: 3, outcome: 'partial' });
  score = applyOutcome(score, { stopId: 'c', actionKey: 'z', points: 0, outcome: 'failure' });

  assert.equal(score.total, 8);
  assert.deepEqual(score.tierCounts, { optimal: 1, partial: 1, neutral: 0, failure: 1 });
  assert.equal(score.log.length, 3);
});

test('does not mutate the previous score object', () => {
  const before = createScore();
  const after = applyOutcome(before, { stopId: 'a', actionKey: 'x', points: 5, outcome: 'optimal' });
  assert.equal(before.total, 0);
  assert.equal(after.total, 5);
});

test('rejects an unknown outcome tier', () => {
  const score = createScore();
  assert.throws(
    () => applyOutcome(score, { stopId: 'a', actionKey: 'x', points: 5, outcome: 'amazing' }),
    /Unknown outcome tier/
  );
});

test('allows score to be negative when points are negative', () => {
  let score = createScore();
  score = applyOutcome(score, { stopId: 'stop_01', actionKey: 'ignore', points: -3, outcome: 'failure' });
  assert.equal(score.total, -3);
});
