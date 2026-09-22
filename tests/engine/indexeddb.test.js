import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveInspectionReport, getInspectionStats, registerTrainee, loginTrainee } from '../../src/utils/api.js';

test('api exposes offline-first persistence functions', () => {
  assert.equal(typeof saveInspectionReport, 'function', 'saveInspectionReport should be exported');
  assert.equal(typeof getInspectionStats, 'function', 'getInspectionStats should be exported');
  assert.equal(typeof registerTrainee, 'function', 'registerTrainee should be exported');
  assert.equal(typeof loginTrainee, 'function', 'loginTrainee should be exported');
});

test('api handles offline environments gracefully without crashing', async () => {
  // In a headless Node environment without indexedDB or backend server running,
  // the functions should resolve gracefully with error/fallback objects rather than unhandled rejections
  const reportPayload = {
    traineeName: 'Alex',
    traineeId: 'TR-10001',
    totalScore: 23,
    maxScore: 25,
    passMark: 18,
    passed: true,
    rankTitle: 'Safety Champion'
  };

  const saveRes = await saveInspectionReport(reportPayload);
  assert.ok(typeof saveRes === 'object', 'saveInspectionReport should return a result object');

  const stats = await getInspectionStats();
  assert.ok(stats === null || typeof stats === 'object', 'getInspectionStats should return null or object');

  const loginRes = await loginTrainee({ traineeId: 'TR-10001', password: 'password123' });
  assert.ok(typeof loginRes === 'object', 'loginTrainee should return a result object');
});
