import { test } from 'node:test';
import assert from 'node:assert/strict';
import { securityHeaders } from '../../server/middlewares/securityHeaders.js';
import { createRateLimiter } from '../../server/middlewares/rateLimiter.js';
import { getAllReports } from '../../server/controllers/reportController.js';

test('security headers: applies essential hardening headers', () => {
  const req = {};
  const headers = {};
  const res = {
    setHeader(name, val) {
      headers[name.toLowerCase()] = val;
    },
    removeHeader() {}
  };

  let nextCalled = false;
  securityHeaders(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['x-frame-options'], 'SAMEORIGIN');
  assert.equal(headers['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.ok(headers['permissions-policy'].includes('camera=()'));
});

test('rate limiting: allows requests within limit and throttles excess requests with 429', () => {
  const limiter = createRateLimiter({
    windowMs: 5000,
    maxRequests: 3,
    message: 'Rate limit exceeded'
  });

  const req = { ip: '192.168.1.50', headers: {}, originalUrl: '/api/auth/login' };
  let statusSet = null;
  let responseData = null;
  let retryAfterHeader = null;

  const res = {
    setHeader(key, val) {
      if (key.toLowerCase() === 'retry-after') retryAfterHeader = val;
    },
    status(s) {
      statusSet = s;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };

  let allowedCount = 0;
  for (let i = 0; i < 3; i++) {
    limiter(req, res, () => {
      allowedCount++;
    });
  }
  assert.equal(allowedCount, 3, 'First 3 requests should be permitted');

  // 4th request must be throttled
  let blockedNextCalled = false;
  limiter(req, res, () => {
    blockedNextCalled = true;
  });

  assert.equal(blockedNextCalled, false, '4th request must not call next()');
  assert.equal(statusSet, 429, 'Expected HTTP 429 Too Many Requests');
  assert.match(responseData.error, /rate limit/i);
  assert.ok(retryAfterHeader > 0, 'Retry-After header should be set');
});

test('pagination: getAllReports caps limit to 100 items maximum', async () => {
  const req = {
    query: { limit: '5000', page: '1' } // Attacker attempts huge 5000-item query
  };

  let capturedLimit = null;
  let capturedSkip = null;
  let responsePayload = null;

  const res = {
    json(data) {
      responsePayload = data;
      return this;
    },
    status() {
      return this;
    }
  };

  const originalFind = (await import('../../server/models/InspectionReport.js')).InspectionReport.find;
  const originalCount = (await import('../../server/models/InspectionReport.js')).InspectionReport.countDocuments;

  (await import('../../server/models/InspectionReport.js')).InspectionReport.find = () => ({
    sort() {
      return this;
    },
    skip(s) {
      capturedSkip = s;
      return this;
    },
    limit(l) {
      capturedLimit = l;
      return Promise.resolve([]);
    }
  });

  (await import('../../server/models/InspectionReport.js')).InspectionReport.countDocuments = async () => 10;

  try {
    await getAllReports(req, res);
    assert.equal(capturedLimit, 100, 'Query limit must be capped at 100');
    assert.equal(capturedSkip, 0, 'Page 1 skip must be 0');
  } finally {
    (await import('../../server/models/InspectionReport.js')).InspectionReport.find = originalFind;
    (await import('../../server/models/InspectionReport.js')).InspectionReport.countDocuments = originalCount;
  }
});
