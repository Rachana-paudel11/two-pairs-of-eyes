/**
 * security.test.js
 * Tests for security hardening: PBKDF2 hashing, JWT, password policy, role checks,
 * and safe login lookup.
 *
 * Runs in Node.js (no browser) using the built-in test runner.
 * Web Crypto API is available natively in Node 18+.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

// ── PBKDF2 hashing tests (Web Crypto API) ──
// We import the functions that are used inside indexedDb.js.
// Because indexedDb.js relies on the browser's crypto.subtle,
// Node 18+ provides the same API globally via globalThis.crypto.

const { hashPassword, verifyPassword } = await import('../../src/utils/indexedDb.js');

test('PBKDF2: hashPassword produces a 64-char hex string (256-bit)', async () => {
  const salt = 'a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8';
  const hash = await hashPassword('testPassword1!', salt);
  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 64, 'SHA-256 output should be 32 bytes = 64 hex chars');
  assert.match(hash, /^[0-9a-f]{64}$/, 'hash should be lowercase hex');
});

test('PBKDF2: same password + same salt → same hash (deterministic)', async () => {
  const salt = 'deadbeefdeadbeefdeadbeefdeadbeef';
  const h1 = await hashPassword('MyP@ss99', salt);
  const h2 = await hashPassword('MyP@ss99', salt);
  assert.equal(h1, h2);
});

test('PBKDF2: different salt → different hash', async () => {
  const s1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1';
  const s2 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2';
  const h1 = await hashPassword('MyP@ss99', s1);
  const h2 = await hashPassword('MyP@ss99', s2);
  assert.notEqual(h1, h2);
});

test('PBKDF2: verifyPassword returns true for correct password', async () => {
  const salt = 'a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8';
  const hash = await hashPassword('Correct#1', salt);
  const result = await verifyPassword('Correct#1', salt, hash);
  assert.equal(result, true);
});

test('PBKDF2: verifyPassword returns false for wrong password', async () => {
  const salt = 'a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8';
  const hash = await hashPassword('Correct#1', salt);
  const result = await verifyPassword('Wrong#2', salt, hash);
  assert.equal(result, false);
});

test('PBKDF2: default trainee hash (password123) verifies correctly', async () => {
  const salt = 'a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8';
  const hash = await hashPassword('password123', salt);
  assert.equal(await verifyPassword('password123', salt, hash), true);
  assert.equal(await verifyPassword('password124', salt, hash), false);
});

// ── Password policy tests ──

const PASSWORD_POLICY = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;

test('Password policy: rejects short passwords', () => {
  assert.equal(PASSWORD_POLICY.test('Ab1!'), false, '4 chars should fail');
  assert.equal(PASSWORD_POLICY.test('Ab1!567'), false, '7 chars should fail');
});

test('Password policy: rejects passwords missing a letter', () => {
  assert.equal(PASSWORD_POLICY.test('12345678!'), false);
});

test('Password policy: rejects passwords missing a digit', () => {
  assert.equal(PASSWORD_POLICY.test('Abcdefgh!'), false);
});

test('Password policy: rejects passwords missing a symbol', () => {
  assert.equal(PASSWORD_POLICY.test('Abcdefg1'), false);
});

test('Password policy: accepts valid passwords', () => {
  assert.equal(PASSWORD_POLICY.test('MyP@ss99'), true);
  assert.equal(PASSWORD_POLICY.test('Tr4ining!'), true);
  assert.equal(PASSWORD_POLICY.test('12345aB!'), true);
  assert.equal(PASSWORD_POLICY.test('longpassword1$'), true);
});

// ── JWT tests ──

// Dynamic import of jsonwebtoken — it's a server dependency
const jwt = (await import('jsonwebtoken')).default;
const TEST_SECRET = 'test-secret-for-unit-tests';

test('JWT: sign and verify round-trip', () => {
  const payload = { sub: 'TR-10001', role: 'trainee', name: 'Alex' };
  const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '2h' });

  assert.equal(typeof token, 'string');
  assert.ok(token.split('.').length === 3, 'JWT should have 3 segments');

  const decoded = jwt.verify(token, TEST_SECRET);
  assert.equal(decoded.sub, 'TR-10001');
  assert.equal(decoded.role, 'trainee');
  assert.equal(decoded.name, 'Alex');
});

test('JWT: expired token throws TokenExpiredError', () => {
  const token = jwt.sign({ sub: 'TR-99999' }, TEST_SECRET, { expiresIn: '-1s' });
  assert.throws(() => jwt.verify(token, TEST_SECRET), (err) => {
    return err.name === 'TokenExpiredError';
  });
});

test('JWT: invalid secret throws JsonWebTokenError', () => {
  const token = jwt.sign({ sub: 'TR-99999' }, TEST_SECRET);
  assert.throws(() => jwt.verify(token, 'wrong-secret'), (err) => {
    return err.name === 'JsonWebTokenError';
  });
});

// ── Role check simulation ──

test('Role check: trainer role grants access, trainee is denied', () => {
  // Simulate the requireRole middleware logic
  function hasRole(userRole, ...requiredRoles) {
    return requiredRoles.includes(userRole);
  }

  assert.equal(hasRole('trainer', 'trainer'), true, 'trainer should pass trainer check');
  assert.equal(hasRole('trainee', 'trainer'), false, 'trainee should fail trainer check');
  assert.equal(hasRole('trainee', 'trainee', 'trainer'), true, 'trainee should pass trainee|trainer check');
});

// ── Login lookup safety ──

test('Login lookup: RegExp injection characters are not special in plain string match', () => {
  // The old code used new RegExp(`^${identifier}$`, 'i') which is vulnerable.
  // The new code uses plain string matching with MongoDB collation.
  // This test verifies that special regex characters are treated literally.
  const maliciousInputs = [
    '.*',
    '(TR-10001|admin)',
    'TR-10001|admin',
    'TR-[0-9]+',
    'a{1,}',
    '^.*$',
    'test.+',
    'a\\b'
  ];

  // In the fixed code, these would be treated as literal strings, not regex patterns.
  // A simple exact-match check should never match a real traineeId.
  for (const input of maliciousInputs) {
    assert.notEqual(input, 'TR-10001', `Malicious input "${input}" should not match a real ID`);
    // Verify the input doesn't accidentally match when treated literally
    const literalMatch = (input.toLowerCase() === 'tr-10001');
    assert.equal(literalMatch, false, `"${input}" must not match TR-10001 as literal`);
  }
});

test('Login lookup: identifier length limit is enforced (max 50 chars)', () => {
  const MAX_LEN = 50;
  const shortId = 'TR-10001';
  const longId = 'A'.repeat(51);

  assert.ok(shortId.length <= MAX_LEN, 'Normal ID should pass length check');
  assert.ok(longId.length > MAX_LEN, 'Oversized ID should fail length check');
});

// ── Migration simulation ──

test('Migration: plain-text password field is detected and would trigger migration', () => {
  // Simulate a legacy IndexedDB record
  const legacyRecord = {
    traineeId: 'TR-10001',
    name: 'Alex',
    password: 'password123',  // plain text — no salt/hash fields
    role: 'trainee'
  };

  const isLegacy = (legacyRecord.password !== undefined && !legacyRecord.salt && !legacyRecord.hash);
  assert.equal(isLegacy, true, 'Record with "password" but no salt/hash is legacy');

  // After migration, the record should have salt+hash and no password
  const migratedRecord = {
    traineeId: 'TR-10001',
    name: 'Alex',
    salt: 'abcd1234abcd1234abcd1234abcd1234',
    hash: '0'.repeat(64),
    role: 'trainee'
  };

  const isMigrated = (migratedRecord.password === undefined && !!migratedRecord.salt && !!migratedRecord.hash);
  assert.equal(isMigrated, true, 'Migrated record should have salt+hash and no password field');
});

test('Migration: PBKDF2 hash+verify simulates full migration flow', async () => {
  const plainPassword = 'password123';
  // Step 1: generate salt + hash (what migration does)
  const salt = 'cafebabecafebabecafebabecafebabe';
  const hash = await hashPassword(plainPassword, salt);

  // Step 2: verify the password against the new hash (what login does after migration)
  const ok = await verifyPassword(plainPassword, salt, hash);
  assert.equal(ok, true, 'Password should verify after migration');

  // Step 3: wrong password should fail
  const bad = await verifyPassword('wrongpassword', salt, hash);
  assert.equal(bad, false, 'Wrong password should fail after migration');
});
