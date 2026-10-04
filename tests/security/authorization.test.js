import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireAuth, requireRole } from '../../server/middlewares/auth.js';
import { signToken } from '../../server/utils/token.js';
import { getReportById } from '../../server/controllers/reportController.js';
import { Trainee } from '../../server/models/Trainee.js';

test('authorization: requireAuth rejects unauthenticated request with 401', () => {
  const req = { headers: {} };
  let statusSet = null;
  let responseData = null;

  const res = {
    status(s) {
      statusSet = s;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };

  let nextCalled = false;
  requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false, 'next() should not be called for unauthenticated request');
  assert.equal(statusSet, 401, 'Should respond with HTTP 401');
  assert.match(responseData.error, /unauthorized/i);
});

test('authorization: requireRole blocks TRAINEE from TRAINER routes with 403', () => {
  const traineeToken = signToken({
    traineeId: 'TR-10001',
    role: 'TRAINEE'
  });

  const req = {
    headers: { authorization: `Bearer ${traineeToken}` },
    originalUrl: '/api/reports'
  };

  let statusSet = null;
  let responseData = null;

  const res = {
    status(s) {
      statusSet = s;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };

  let nextCalled = false;
  const trainerOnlyMiddleware = requireRole('TRAINER', 'ADMIN');
  trainerOnlyMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false, 'TRAINEE should be blocked from trainer-only route');
  assert.equal(statusSet, 403, 'Should respond with HTTP 403 Forbidden');
  assert.match(responseData.error, /forbidden/i);
});

test('authorization: requireRole grants access to TRAINER on trainer routes', () => {
  const trainerToken = signToken({
    traineeId: 'SUP-DAVE-01',
    role: 'TRAINER'
  });

  const req = {
    headers: { authorization: `Bearer ${trainerToken}` },
    originalUrl: '/api/reports'
  };

  const res = {};
  let nextCalled = false;
  const trainerOnlyMiddleware = requireRole('TRAINER', 'ADMIN');
  trainerOnlyMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true, 'TRAINER should be allowed through to trainer route');
});

test('authorization: requireRole grants access to ADMIN on all routes', () => {
  const adminToken = signToken({
    traineeId: 'ADM-SYS-01',
    role: 'ADMIN'
  });

  const req = {
    headers: { authorization: `Bearer ${adminToken}` },
    originalUrl: '/api/reports'
  };

  const res = {};
  let nextCalled = false;
  const trainerOnlyMiddleware = requireRole('TRAINER', 'ADMIN');
  trainerOnlyMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true, 'ADMIN should be allowed through');
});

test('authorization: IDOR defense prevents trainee from viewing another trainee\'s report', async () => {
  const traineeUser = {
    traineeId: 'TR-10001',
    role: 'TRAINEE'
  };

  // Mock request where Alex (TR-10001) attempts to inspect report of Dave (TR-99999)
  const req = {
    params: { id: '507f1f77bcf86cd799439011' },
    user: traineeUser
  };

  let statusSet = null;
  let responseData = null;
  const res = {
    status(s) {
      statusSet = s;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };

  // Temporarily stub InspectionReport.findById
  const originalFindById = (await import('../../server/models/InspectionReport.js')).InspectionReport.findById;
  (await import('../../server/models/InspectionReport.js')).InspectionReport.findById = async () => ({
    _id: '507f1f77bcf86cd799439011',
    traineeId: 'TR-99999', // Belongs to a different trainee
    totalScore: 24,
    passed: true
  });

  try {
    await getReportById(req, res);
    assert.equal(statusSet, 403, 'Expected HTTP 403 Forbidden for cross-trainee report access');
    assert.match(responseData.error, /permission/i);
  } finally {
    (await import('../../server/models/InspectionReport.js')).InspectionReport.findById = originalFindById;
  }
});

test('authorization: trainee can view their own report', async () => {
  const traineeUser = {
    traineeId: 'TR-10001',
    role: 'TRAINEE'
  };

  const req = {
    params: { id: '507f1f77bcf86cd799439011' },
    user: traineeUser
  };

  let statusSet = null;
  let responseData = null;
  const res = {
    status(s) {
      statusSet = s;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };

  const originalFindById = (await import('../../server/models/InspectionReport.js')).InspectionReport.findById;
  (await import('../../server/models/InspectionReport.js')).InspectionReport.findById = async () => ({
    _id: '507f1f77bcf86cd799439011',
    traineeId: 'TR-10001', // Belongs to same trainee
    totalScore: 23,
    passed: true
  });

  try {
    await getReportById(req, res);
    assert.equal(responseData.success, true);
    assert.equal(responseData.data.traineeId, 'TR-10001');
  } finally {
    (await import('../../server/models/InspectionReport.js')).InspectionReport.findById = originalFindById;
  }
});
