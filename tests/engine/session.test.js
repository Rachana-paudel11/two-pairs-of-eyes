import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEventBus } from '../../src/engine/eventBus.js';
import { ScenarioEngine } from '../../src/engine/scenarioEngine.js';
import { validateStopsData } from '../../src/engine/stopsValidator.js';
import { interactions, interactionNames } from '../../src/interactions/index.js';
import stopsData from '../../src/data/stops.json' with { type: 'json' };

const LIFECYCLE_EVENTS = [
  'stop:entered',
  'dialogue:line',
  'actions:available',
  'action:resolved',
  'consequence:play',
  'score:changed',
  'session:complete'
];

function runSession(data, script) {
  const events = [];
  const eventBus = createEventBus();
  for (const name of LIFECYCLE_EVENTS) {
    eventBus.on(name, (payload) => events.push({ event: name, payload }));
  }

  const validated = validateStopsData(data, { knownInteractionNames: interactionNames });
  const engine = new ScenarioEngine({ stopsData: validated, eventBus, interactions });
  engine.start();

  for (const stopActions of script) {
    for (const actionKey of stopActions) {
      engine.chooseAction(actionKey);
      if (engine.machine.state === 'FEEDBACK' || engine.machine.state === 'SCORE_UPDATE') {
        engine.nextStop();
      }
    }
  }

  return { engine, events };
}

// The optimal action at every stop, in the stop order:
// dismissive / uncertain / dismissive / correct / correct.
const OPTIMAL_SCRIPT = [
  ['cordon_off'], // stop_01
  ['hold_position'], // stop_02
  ['cordon_off'], // stop_03
  ['isolate_and_report'], // stop_04
  ['emergency_drill'] // stop_05
];

test('a full five-stop session runs headless, with no A-Frame or DOM present', () => {
  assert.equal(typeof window, 'undefined');
  assert.equal(typeof document, 'undefined');
  const { engine } = runSession(stopsData, OPTIMAL_SCRIPT);
  assert.equal(engine.isComplete, true);
});

test('the optimal path scores full marks and triggers no deferred incident', () => {
  const { engine, events } = runSession(stopsData, OPTIMAL_SCRIPT);

  assert.equal(engine.score.total, 25);
  assert.deepEqual(engine.score.tierCounts, { optimal: 5, partial: 0, neutral: 0, failure: 0 });

  const complete = events.find((e) => e.event === 'session:complete');
  assert.deepEqual(complete.payload.flags, []);
  assert.deepEqual(complete.payload.triggeredRules, []);
});

test('action:resolved provides alexTargetPosition and alexAction for character movement', () => {
  const { events } = runSession(stopsData, OPTIMAL_SCRIPT);

  const stop01Resolved = events.find((e) => e.event === 'action:resolved' && e.payload.stopId === 'stop_01');
  assert.ok(stop01Resolved, 'action:resolved event must be emitted');
  assert.equal(stop01Resolved.payload.actionKey, 'cordon_off');
  assert.deepEqual(stop01Resolved.payload.alexTargetPosition, { x: 0.15, y: 0, z: -5.4 });
  assert.equal(stop01Resolved.payload.alexAction, 'cordon_area');
  assert.ok(stop01Resolved.payload.feedback.includes('Alex moves to cordon off the spill area'));
});

test('all three supervisor behaviour modes are exercised across the authored stops', () => {
  const { events } = runSession(stopsData, OPTIMAL_SCRIPT);
  const behaviours = new Set(events.filter((e) => e.event === 'dialogue:line').map((e) => e.payload.behaviour));
  assert.deepEqual([...behaviours].sort(), ['correct', 'dismissive', 'uncertain']);
});

test('reporting on a genuinely clear stop resolves as partial, never failure', () => {
  const script = [['cordon_off'], ['hold_position'], ['cordon_off'], ['isolate_and_report'], ['report_only']];
  const { events } = runSession(stopsData, script);
  const resolved = events.find(
    (e) => e.event === 'action:resolved' && e.payload.stopId === 'stop_05' && e.payload.actionKey === 'report_only'
  );
  assert.equal(resolved.payload.outcome, 'partial');
});

test('ignoring both the ground hazard and the charging warning triggers the deferred escalated incident', () => {
  const script = [
    ['ignore'], // stop_01 -> ignored_ground_hazard
    ['hold_position'], // stop_02
    ['cordon_off'], // stop_03
    ['ignore'], // stop_04 -> ignored_charging_warning
    ['emergency_drill'] // stop_05
  ];
  const { events } = runSession(stopsData, script);

  const complete = events.find((e) => e.event === 'session:complete');
  assert.deepEqual(complete.payload.triggeredRules, ['escalated_incident']);
  assert.ok(complete.payload.flags.includes('ignored_ground_hazard'));
  assert.ok(complete.payload.flags.includes('ignored_charging_warning'));

  const deferred = events.find((e) => e.event === 'consequence:play' && e.payload.deferred === true);
  assert.equal(deferred.payload.consequence, 'escalated_incident_cutscene');
});

test('ignoring only one of the two flags does not trigger the deferred incident', () => {
  const script = [
    ['ignore'], // stop_01 only
    ['hold_position'],
    ['cordon_off'],
    ['isolate_and_report'], // stop_04 handled correctly this time
    ['emergency_drill']
  ];
  const { events } = runSession(stopsData, script);
  const complete = events.find((e) => e.event === 'session:complete');
  assert.deepEqual(complete.payload.triggeredRules, []);
});

test('choosing an action outside of ASSESS is rejected', () => {
  const { engine } = runSession(stopsData, OPTIMAL_SCRIPT);
  assert.throws(() => engine.chooseAction('cordon_off'), /Cannot choose an action while in state SESSION_COMPLETE/);
});

test('an unknown action key is rejected', () => {
  const eventBus = createEventBus();
  const validated = validateStopsData(stopsData, { knownInteractionNames: interactionNames });
  const engine = new ScenarioEngine({ stopsData: validated, eventBus, interactions });
  engine.start();
  assert.throws(() => engine.chooseAction('bribe_the_auditor'), /has no action/);
});

// Proves acceptance criterion: retheming to a different workplace requires
// zero engine changes. Same ScenarioEngine, same interaction registry,
// entirely different vocabulary.
test('the same engine runs an unrelated hospital-themed dataset unmodified', () => {
  const hospitalData = {
    stops: [
      {
        id: 'stop_01',
        title: 'Unlabelled IV Bag',
        location: 'hospital_ward_b',
        hazard: { present: true, type: 'medication_error_risk', severity: 'severe' },
        supervisor: {
          name: 'Priya',
          behaviour: 'dismissive',
          dialogue: "It's probably saline, everyone's slammed today."
        },
        alexStartPosition: { x: 0, y: 0, z: 0 },
        alexTargetPosition: { x: 1, y: 0, z: 1 },
        actions: {
          flag_bag: {
            interaction: 'cordonOff',
            points: 5,
            outcome: 'optimal',
            consequence: 'bag_pulled',
            feedback: 'You pulled it before it reached a patient.',
            alexAction: 'cordon_area'
          },
          ignore: {
            interaction: 'ignore',
            points: 0,
            outcome: 'failure',
            consequence: 'near_miss_medication',
            feedback: 'An unlabelled bag was assumed safe because everyone was busy.',
            alexAction: 'follow_dave'
          }
        },
        flags_on_failure: ['ignored_unlabelled_bag'],
        learning_objective: "Don't normalize missing labels under time pressure."
      }
    ],
    endOfSessionRules: []
  };

  const { engine } = runSession(hospitalData, [['flag_bag']]);
  assert.equal(engine.isComplete, true);
  assert.equal(engine.score.total, 5);
});

test('pauses in SCORE_UPDATE state after action selection until nextStop is called', () => {
  const eventBus = createEventBus();
  const validated = validateStopsData(stopsData, { knownInteractionNames: interactionNames });
  const engine = new ScenarioEngine({ stopsData: validated, eventBus, interactions });
  engine.start();

  assert.equal(engine.stopIndex, 0);
  assert.equal(engine.machine.state, 'ASSESS');

  engine.chooseAction('cordon_off');

  // Should pause at SCORE_UPDATE state and stay at stopIndex 0
  assert.equal(engine.machine.state, 'SCORE_UPDATE');
  assert.equal(engine.stopIndex, 0);

  // Calling nextStop advances to the next stop
  engine.nextStop();
  assert.equal(engine.stopIndex, 1);
  assert.equal(engine.machine.state, 'ASSESS');
});

test('advances stop when eventBus emits stop:continue event', () => {
  const eventBus = createEventBus();
  const validated = validateStopsData(stopsData, { knownInteractionNames: interactionNames });
  const engine = new ScenarioEngine({ stopsData: validated, eventBus, interactions });
  engine.start();

  engine.chooseAction('cordon_off');
  assert.equal(engine.machine.state, 'SCORE_UPDATE');
  assert.equal(engine.stopIndex, 0);

  eventBus.emit('stop:continue');
  assert.equal(engine.stopIndex, 1);
  assert.equal(engine.machine.state, 'ASSESS');
});

test('rejects calling nextStop outside of FEEDBACK or SCORE_UPDATE state', () => {
  const eventBus = createEventBus();
  const validated = validateStopsData(stopsData, { knownInteractionNames: interactionNames });
  const engine = new ScenarioEngine({ stopsData: validated, eventBus, interactions });
  engine.start();

  assert.equal(engine.machine.state, 'ASSESS');
  assert.throws(() => engine.nextStop(), /Cannot transition to next stop while in state ASSESS/);
});

