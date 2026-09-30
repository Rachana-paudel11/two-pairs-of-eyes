import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateReportPayload } from '../../server/utils/validators.js';

test('result integrity: rejects negative scores', () => {
  const payload = {
    traineeId: 'TR-10001',
    totalScore: -5,
    maxScore: 25,
    passMark: 18
  };

  const result = validateReportPayload(payload);
  assert.equal(result.valid, false);
  assert.match(result.error, /cannot be negative/i);
});

test('result integrity: rejects score exceeding scenario maximum of 25', () => {
  const payload = {
    traineeId: 'TR-10001',
    totalScore: 999, // Falsified high score
    maxScore: 25,
    passMark: 18
  };

  const result = validateReportPayload(payload);
  assert.equal(result.valid, false);
  assert.match(result.error, /cannot exceed scenario maximum/i);
});

test('result integrity: rejects invalid maxScore or passMark tampering', () => {
  const payloadBadMax = {
    traineeId: 'TR-10001',
    totalScore: 20,
    maxScore: 50, // Tampered max score
    passMark: 18
  };
  const res1 = validateReportPayload(payloadBadMax);
  assert.equal(res1.valid, false);
  assert.match(res1.error, /maxScore must equal/i);

  const payloadBadPass = {
    traineeId: 'TR-10001',
    totalScore: 10,
    maxScore: 25,
    passMark: 5 // Tampered pass threshold
  };
  const res2 = validateReportPayload(payloadBadPass);
  assert.equal(res2.valid, false);
  assert.match(res2.error, /passMark must equal/i);
});

test('result integrity: rejects invalid stop IDs', () => {
  const payload = {
    traineeId: 'TR-10001',
    totalScore: 20,
    maxScore: 25,
    passMark: 18,
    zoneLogs: [{ stopId: 'stop_99_nonexistent', actionId: 'cordon_off', tier: 'optimal' }]
  };

  const result = validateReportPayload(payload);
  assert.equal(result.valid, false);
  assert.match(result.error, /invalid stopId/i);
});

test('result integrity: rejects invalid action IDs', () => {
  const payload = {
    traineeId: 'TR-10001',
    totalScore: 20,
    maxScore: 25,
    passMark: 18,
    zoneLogs: [{ stopId: 'stop_01', actionId: 'teleport_cheat_code', tier: 'optimal' }]
  };

  const result = validateReportPayload(payload);
  assert.equal(result.valid, false);
  assert.match(result.error, /invalid actionId/i);
});

test('result integrity: rejects unauthorized result submission for another trainee', () => {
  const authenticatedTrainee = {
    traineeId: 'TR-10001',
    role: 'TRAINEE'
  };

  const spoofedPayload = {
    traineeId: 'TR-88888', // Trying to submit for someone else
    totalScore: 25,
    maxScore: 25,
    passMark: 18
  };

  const result = validateReportPayload(spoofedPayload, authenticatedTrainee);
  assert.equal(result.valid, false);
  assert.match(result.error, /forbidden/i);
});

test('result integrity: server calculates pass status and rank title authoritatively', () => {
  // Case A: High score with 0 failures -> PASSES as Safety Champion
  const passingPayload = {
    traineeId: 'TR-10001',
    totalScore: 23,
    maxScore: 25,
    passMark: 18,
    passed: false, // Client claims false, but server calculates true
    tierCounts: { optimal: 4, partial: 1, failure: 0 }
  };

  const resA = validateReportPayload(passingPayload);
  assert.equal(resA.valid, true);
  assert.equal(resA.sanitizedData.passed, true);
  assert.equal(resA.sanitizedData.rankTitle, 'Safety Champion');

  // Case B: High score but has a failure outcome -> FAILS
  const failingPayload = {
    traineeId: 'TR-10001',
    totalScore: 19,
    maxScore: 25,
    passMark: 18,
    passed: true, // Client attempts to claim pass despite failure
    tierCounts: { optimal: 4, failure: 1 }
  };

  const resB = validateReportPayload(failingPayload);
  assert.equal(resB.valid, true);
  assert.equal(resB.sanitizedData.passed, false, 'Server must override client pass flag due to failure tier count');
  assert.equal(resB.sanitizedData.rankTitle, 'Hazards Overlooked');
});
