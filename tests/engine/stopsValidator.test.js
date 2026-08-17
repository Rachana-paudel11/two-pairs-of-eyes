import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateStopsData, StopsValidationError } from '../../src/engine/stopsValidator.js';
import { interactionNames } from '../../src/interactions/index.js';
import stopsData from '../../src/data/stops.json' with { type: 'json' };

function minimalStop(overrides = {}) {
  return {
    id: 'stop_test',
    title: 'Test Stop',
    location: 'test_location',
    hazard: { present: false },
    supervisor: { name: 'Sam', behaviour: 'correct', dialogue: 'Looks fine.' },
    actions: {
      continue_on: {
        interaction: 'continueOn',
        points: 5,
        outcome: 'optimal',
        consequence: 'shift_continues',
        feedback: 'Good call.'
      },
      report_only: {
        interaction: 'report',
        points: 3,
        outcome: 'partial',
        consequence: 'unnecessary_report_filed',
        feedback: 'Not wrong, just unnecessary.'
      }
    },
    learning_objective: 'Testing is good.',
    ...overrides
  };
}

test('the real stops.json is valid, with interaction references checked', () => {
  const result = validateStopsData(stopsData, { knownInteractionNames: interactionNames });
  assert.equal(result, stopsData);
});

test('fails loudly with the offending stop id and field path on a schema violation', () => {
  const badStop = minimalStop();
  delete badStop.actions.continue_on.outcome;
  const data = { stops: [badStop] };

  assert.throws(
    () => validateStopsData(data),
    (error) => {
      assert.ok(error instanceof StopsValidationError);
      assert.match(error.message, /stop "stop_test"/);
      assert.match(error.message, /\/stops\/0\/actions\/continue_on/);
      return true;
    }
  );
});

test('rejects hazard.present: true without a type/severity', () => {
  const badStop = minimalStop({ hazard: { present: true } });
  const data = { stops: [badStop] };
  assert.throws(() => validateStopsData(data), StopsValidationError);
});

test('rejects an endOfSessionRules flag that no stop ever sets', () => {
  const data = {
    stops: [minimalStop()],
    endOfSessionRules: [
      { id: 'ghost_rule', requiresFlags: ['flag_never_set'], consequence: 'x', feedback: 'y' }
    ]
  };
  assert.throws(() => validateStopsData(data), /requires flag "flag_never_set"/);
});

test('rejects an action referencing an unknown interaction, when the registry is supplied', () => {
  const badStop = minimalStop();
  badStop.actions.continue_on.interaction = 'typoedName';
  const data = { stops: [badStop] };
  assert.throws(
    () => validateStopsData(data, { knownInteractionNames: interactionNames }),
    /references unknown interaction "typoedName"/
  );
});
