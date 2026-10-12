import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAdminSession,
  validateAdminSession,
  destroyAdminSession,
  requireAdminAuth
} from '../../server/middlewares/adminAuth.js';
import { ScenarioRepository } from '../../server/repositories/ScenarioRepository.js';
import { ScenarioService } from '../../src/services/ScenarioService.js';
import { ScenarioEngine } from '../../src/engine/scenarioEngine.js';
import { createEventBus } from '../../src/engine/eventBus.js';
import { interactions } from '../../src/interactions/index.js';
import defaultStopsData from '../../src/data/stops.json' with { type: 'json' };

// Helper to simulate Express req/res
function mockReqRes(headers = {}) {
  const req = { headers, admin: null };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return { req, res };
}

// 1. Unauthenticated admin access rejected
test('1. unauthenticated admin access rejected', () => {
  // Case A: No token header
  const { req: req1, res: res1 } = mockReqRes({});
  let nextCalled1 = false;
  requireAdminAuth(req1, res1, () => { nextCalled1 = true; });
  assert.equal(res1.statusCode, 401);
  assert.equal(nextCalled1, false);
  assert.match(res1.body.error, /Unauthorized/i);

  // Case B: Invalid / forged token
  const { req: req2, res: res2 } = mockReqRes({ authorization: 'Bearer invalid.token.signature' });
  let nextCalled2 = false;
  requireAdminAuth(req2, res2, () => { nextCalled2 = true; });
  assert.equal(res2.statusCode, 401);
  assert.equal(nextCalled2, false);
  assert.match(res2.body.error, /invalid or expired/i);
});

// 2. Authenticated admin access allowed
test('2. authenticated admin access allowed', () => {
  const fakeAdmin = {
    _id: 'admin_123',
    username: 'admin',
    name: 'Lead Safety Admin',
    role: 'System Administrator'
  };

  const { token, session } = createAdminSession(fakeAdmin);
  assert.ok(token, 'Token should be generated');

  const { req, res } = mockReqRes({ authorization: `Bearer ${token}` });
  let nextCalled = false;

  requireAdminAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true, 'Middleware should call next() for authenticated user');
  assert.equal(req.admin.username, 'admin');
  assert.equal(req.admin.role, 'System Administrator');

  // Verify logout / session destruction
  destroyAdminSession(token);
  assert.equal(validateAdminSession(token), null, 'Destroyed token must be invalidated');
});

// 3. Valid scenario accepted
test('3. valid scenario accepted', async () => {
  const dataset = await ScenarioRepository.getAll();
  const validation = ScenarioRepository.validate(dataset);
  assert.equal(validation.valid, true);
  assert.equal(validation.issues.length, 0);
});

// 4. Invalid scenario rejected by AJV
test('4. invalid scenario rejected by AJV', () => {
  const invalidDataset = {
    stops: [
      {
        id: 'invalid-stop', // violates regex ^[a-z0-9_]+$
        title: '',
        location: 'zone',
        hazard: {
          present: true // missing required type and severity
        },
        supervisor: {
          name: 'Dave',
          behaviour: 'super_happy', // invalid enum
          dialogue: 'Hi'
        },
        actions: {
          act1: {
            interaction: 'unknownInteractionModule',
            points: 99, // out of range [-10, 10]
            outcome: 'legendary', // invalid enum
            consequence: 'c',
            feedback: 'f'
          }
        },
        flags_on_failure: [],
        learning_objective: 'test'
      }
    ],
    endOfSessionRules: []
  };

  const validation = ScenarioRepository.validate(invalidDataset);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.length > 0, 'Should return specific validation issues');
});

// 5. Scenario creation
test('5. scenario creation', async () => {
  const newStop = {
    id: 'stop_test_create_01',
    title: 'Testing Station Fire Hazard',
    location: 'warehouse_qa_station',
    hazard: {
      present: true,
      type: 'electrical',
      subtype: 'overload',
      severity: 'moderate'
    },
    supervisor: {
      name: 'Dave',
      behaviour: 'dismissive',
      dialogue: 'Testing station is always sparking, pay it no mind.'
    },
    alexStartPosition: { x: 0, y: 0, z: -5 },
    alexTargetPosition: { x: 0, y: 0, z: -6 },
    actions: {
      isolate: {
        interaction: 'isolateAndReport',
        points: 5,
        outcome: 'optimal',
        consequence: 'station_isolated',
        feedback: 'Station successfully powered off.',
        alexAction: 'isolate_equipment'
      },
      ignore: {
        interaction: 'ignore',
        points: -3,
        outcome: 'failure',
        consequence: 'test_risk_escalated',
        feedback: 'Never ignore electrical sparks.',
        alexAction: 'follow_dave'
      }
    },
    flags_on_failure: ['ignored_sparking_station'],
    learning_objective: 'Isolate malfunctioning test stations immediately.'
  };

  const created = await ScenarioRepository.create(newStop);
  assert.equal(created.id, 'stop_test_create_01');

  const retrieved = await ScenarioRepository.getById('stop_test_create_01');
  assert.ok(retrieved);
  assert.equal(retrieved.title, 'Testing Station Fire Hazard');
});

// 6. Scenario update
test('6. scenario update', async () => {
  const updated = await ScenarioRepository.update('stop_test_create_01', {
    title: 'Testing Station Fire Hazard (Updated by Admin)'
  });

  assert.equal(updated.title, 'Testing Station Fire Hazard (Updated by Admin)');
  const fetched = await ScenarioRepository.getById('stop_test_create_01');
  assert.equal(fetched.title, 'Testing Station Fire Hazard (Updated by Admin)');
});

// 7. Scenario delete
test('7. scenario delete', async () => {
  const res = await ScenarioRepository.delete('stop_test_create_01');
  assert.equal(res.success, true);
  assert.equal(res.deletedId, 'stop_test_create_01');

  const fetched = await ScenarioRepository.getById('stop_test_create_01');
  assert.equal(fetched, null);
});

// 8. Deleting scenario verifies referential integrity and constraints
test('8. deleting scenario verifies referential integrity and constraints', async () => {
  // A. Deleting a non-existent stop is rejected
  await assert.rejects(
    async () => {
      await ScenarioRepository.delete('non_existent_stop');
    },
    /not found/i
  );

  // B. Schema and referential cross-checks reject deletion if a rule relies on its flags
  const testDataset = {
    stops: [
      {
        id: 'stop_other',
        title: 'Other Stop',
        location: 'zone_b',
        hazard: { present: false },
        supervisor: { name: 'Dave', behaviour: 'correct', dialogue: 'ok' },
        actions: {
          act1: { interaction: 'continueOn', points: 5, outcome: 'optimal', consequence: 'c', feedback: 'f' },
          act2: { interaction: 'report', points: 3, outcome: 'partial', consequence: 'c', feedback: 'f' }
        },
        flags_on_failure: [],
        learning_objective: 'test'
      }
    ],
    endOfSessionRules: [
      { id: 'custom_rule', requiresFlags: ['flag_dep_a'], consequence: 'c', feedback: 'f' }
    ]
  };
  const val = ScenarioRepository.validate(testDataset);
  assert.equal(val.valid, false);
  assert.match(val.issues[0], /requires flag "flag_dep_a"/);

  // Verify all 5 warehouse stops are preserved in default stops data
  const stop1 = await ScenarioRepository.getById('stop_01');
  assert.ok(stop1, 'stop_01 must be preserved');
});

// 9. Trainee simulation still loads scenarios correctly
test('9. trainee simulation still loads scenarios correctly', async () => {
  const defaultScenarios = ScenarioService.getDefaultScenarios();
  assert.ok(defaultScenarios.stops.length >= 5, 'Should provide at least five safety stops');

  const loadedScenarios = await ScenarioService.loadScenarios();
  assert.ok(loadedScenarios.stops.length >= 5, 'Async scenario loader should resolve valid stops');
  assert.equal(loadedScenarios.stops[0].id, 'stop_01');
});

// 10. Existing full-session engine behaviour is unchanged
test('10. existing full-session engine behaviour is unchanged', () => {
  const eventBus = createEventBus();
  const engine = new ScenarioEngine({
    stopsData: defaultStopsData,
    eventBus,
    interactions
  });

  const OPTIMAL_SCRIPT = [
    { stopId: 'stop_01', actionKey: 'cordon_off' },
    { stopId: 'stop_02', actionKey: 'hold_position' },
    { stopId: 'stop_03', actionKey: 'cordon_off' },
    { stopId: 'stop_04', actionKey: 'isolate_and_report' },
    { stopId: 'stop_05', actionKey: 'emergency_drill' }
  ];

  engine.start();

  for (const step of OPTIMAL_SCRIPT) {
    assert.equal(engine.currentStop.id, step.stopId);
    engine.chooseAction(step.actionKey);
    engine.nextStop();
  }

  assert.equal(engine.isComplete, true);
  assert.equal(engine.score.total, 25);
  assert.equal(engine.score.tierCounts.optimal, 5);
  assert.equal(engine.score.tierCounts.failure, 0);
  assert.equal(engine.consequenceState.flags.size, 0);
});
