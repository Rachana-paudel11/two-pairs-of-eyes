import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interactions, getInteraction, interactionNames } from '../../src/interactions/index.js';
import cordonOffResolve from '../../src/interactions/cordonOff.js';
import reportResolve from '../../src/interactions/report.js';
import holdPositionResolve from '../../src/interactions/holdPosition.js';
import ignoreResolve from '../../src/interactions/ignore.js';
import continueOnResolve from '../../src/interactions/continueOn.js';
import isolateAndReportResolve from '../../src/interactions/isolateAndReport.js';

test('interactions registry contains all core interactions', () => {
  const expected = ['cordonOff', 'report', 'holdPosition', 'ignore', 'continueOn', 'isolateAndReport'];
  assert.deepEqual([...interactionNames].sort(), [...expected].sort());
});

test('getInteraction retrieves correct module or throws on unknown', () => {
  assert.equal(getInteraction('cordonOff').terminal, true);
  assert.equal(getInteraction('isolateAndReport').terminal, true);
  assert.throws(() => getInteraction('invalid_interaction'), /Unknown interaction/);
});

test('terminal interactions resolve outcome, points, consequence, flags, and alexAction', () => {
  const sampleAction = {
    interaction: 'cordonOff',
    points: 5,
    outcome: 'optimal',
    consequence: 'area_secured',
    feedback: 'Protected area successfully.',
    alexAction: 'cordon_area'
  };

  const cordonRes = cordonOffResolve(sampleAction);
  assert.equal(cordonRes.outcome, 'optimal');
  assert.equal(cordonRes.points, 5);
  assert.equal(cordonRes.alexAction, 'cordon_area');

  const reportRes = reportResolve({ ...sampleAction, interaction: 'report', outcome: 'partial', alexAction: 'move_to_safety' });
  assert.equal(reportRes.outcome, 'partial');
  assert.equal(reportRes.alexAction, 'move_to_safety');

  const holdRes = holdPositionResolve({ ...sampleAction, interaction: 'holdPosition', alexAction: 'hold_position' });
  assert.equal(holdRes.outcome, 'optimal');
  assert.equal(holdRes.alexAction, 'hold_position');

  const ignoreRes = ignoreResolve({ ...sampleAction, interaction: 'ignore', outcome: 'failure', points: -3, alexAction: 'follow_dave' });
  assert.equal(ignoreRes.outcome, 'failure');
  assert.equal(ignoreRes.points, -3);
  assert.equal(ignoreRes.alexAction, 'follow_dave');

  const continueRes = continueOnResolve({ ...sampleAction, interaction: 'continueOn', alexAction: 'continue_walk' });
  assert.equal(continueRes.outcome, 'optimal');
  assert.equal(continueRes.alexAction, 'continue_walk');

  const isolateRes = isolateAndReportResolve({ ...sampleAction, interaction: 'isolateAndReport', alexAction: 'isolate_equipment' });
  assert.equal(isolateRes.outcome, 'optimal');
  assert.equal(isolateRes.alexAction, 'isolate_equipment');
});


