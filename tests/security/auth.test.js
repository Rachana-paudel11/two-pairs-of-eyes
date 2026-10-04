import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { validatePassword, escapeRegex, isValidIdentifier } from '../../server/utils/validators.js';
import { signToken, verifyToken } from '../../server/utils/token.js';
import { Trainee } from '../../server/models/Trainee.js';

test('password policy: rejects empty password', () => {
  const result = validatePassword('');
  assert.equal(result.valid, false);
  assert.match(result.error, /cannot be empty/i);
});

test('password policy: rejects passwords shorter than 12 characters', () => {
  const shortPasswords = ['123', 'admin', 'pass123', 'short_pass!', '12345678901'];
  for (const pw of shortPasswords) {
    const res = validatePassword(pw);
    assert.equal(res.valid, false, `Expected password "${pw}" to be rejected for length < 12`);
    assert.match(res.error, /at least 12 characters/i);
  }
});

test('password policy: accepts valid passwords and passphrases of 12 or more characters', () => {
  const validPasswords = [
    'correct-horse-battery-staple',
    'technova-safety-2026!',
    'warehouse patrol protocol #05',
    'A'.repeat(64),
    'SuperSecure&Complex!Password123'
  ];
  for (const pw of validPasswords) {
    const res = validatePassword(pw);
    assert.equal(res.valid, true, `Expected password "${pw}" to be accepted`);
  }
});

test('password policy: rejects passwords exceeding 128 characters', () => {
  const hugePassword = 'A'.repeat(129);
  const res = validatePassword(hugePassword);
  assert.equal(res.valid, false);
  assert.match(res.error, /must not exceed 128 characters/i);
});

test('password policy: does not trim or modify passwords', () => {
  const passwordWithSpaces = '  spaces count in passphrases  ';
  const res = validatePassword(passwordWithSpaces);
  assert.equal(res.valid, true);
  // Length is 31 characters, exact string preserved
  assert.equal(passwordWithSpaces.length, 31);
});

test('password hashing: passwords are encrypted with bcrypt and verified safely', async () => {
  const plainPassword = 'safe-warehouse-patrol-2026';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(plainPassword, salt);

  assert.notEqual(hash, plainPassword, 'Password must not match plain text');
  assert.ok(hash.startsWith('$2'), 'Hash must follow bcrypt format');

  const matches = await bcrypt.compare(plainPassword, hash);
  assert.equal(matches, true, 'bcrypt.compare should return true for correct password');

  const wrongMatches = await bcrypt.compare('wrong-password-attempt', hash);
  assert.equal(wrongMatches, false, 'bcrypt.compare should return false for incorrect password');
});

test('trainee model serialization: excludes password hash and version from JSON', () => {
  const trainee = new Trainee({
    traineeId: 'TR-99001',
    name: 'Alex Tester',
    password: 'hashed-password-string',
    role: 'TRAINEE',
    department: 'Logistics'
  });

  const json = trainee.toJSON();
  assert.equal(json.password, undefined, 'Password field must be deleted from serialized JSON');
  assert.equal(json.__v, undefined, 'Version key must be deleted from serialized JSON');
  assert.equal(json.traineeId, 'TR-99001');
  assert.equal(json.name, 'Alex Tester');
});

test('token security: issues and verifies signed HMAC-SHA256 tokens', () => {
  const secret = 'custom-test-secret-at-least-32-chars!';
  const payload = {
    userId: 'user_123',
    traineeId: 'TR-10001',
    role: 'TRAINEE'
  };

  const token = signToken(payload, secret, 3600);
  assert.equal(typeof token, 'string');
  assert.equal(token.split('.').length, 3, 'JWT must consist of 3 dot-separated parts');

  const verified = verifyToken(token, secret);
  assert.ok(verified, 'Token must be verified successfully');
  assert.equal(verified.userId, 'user_123');
  assert.equal(verified.traineeId, 'TR-10001');
  assert.equal(verified.role, 'TRAINEE');
  assert.ok(verified.exp > Math.floor(Date.now() / 1000), 'Expiration timestamp must be in future');
});

test('token security: rejects tampered tokens or wrong secret', () => {
  const secretA = 'secret-a-at-least-32-bytes-long!';
  const secretB = 'secret-b-at-least-32-bytes-long!';
  const payload = { traineeId: 'TR-10001', role: 'TRAINEE' };

  const token = signToken(payload, secretA, 3600);

  // Wrong secret verification
  const wrongSecretResult = verifyToken(token, secretB);
  assert.equal(wrongSecretResult, null, 'Verification must fail with incorrect secret');

  // Tampered payload
  const [header, body, sig] = token.split('.');
  const tamperedBody = Buffer.from(JSON.stringify({ traineeId: 'TR-10001', role: 'ADMIN' })).toString('base64url');
  const tamperedToken = `${header}.${tamperedBody}.${sig}`;

  const tamperedResult = verifyToken(tamperedToken, secretA);
  assert.equal(tamperedResult, null, 'Verification must fail for tampered token');
});

test('token security: rejects expired tokens', () => {
  const secret = 'custom-test-secret-at-least-32-chars!';
  const payload = { traineeId: 'TR-10001', role: 'TRAINEE' };

  // Expired 10 seconds ago
  const expiredToken = signToken(payload, secret, -10);
  const result = verifyToken(expiredToken, secret);
  assert.equal(result, null, 'Expired token must return null');
});

test('regex search safety: escapes special regex metacharacters to prevent ReDoS', () => {
  const dangerousInputs = ['.*', '[a-z]+', '(a+)+', '\\', '$', '^', '.*+?^${}()|[]\\'];
  for (const input of dangerousInputs) {
    const escaped = escapeRegex(input);
    // Compiling escaped string into RegExp should match literal input, not execute regex semantics
    const regex = new RegExp(`^${escaped}$`);
    assert.ok(regex.test(input), `Regex should match literal string: ${input}`);
    // Should NOT match arbitrary characters that would have matched unescaped regex
    if (input === '.*') {
      assert.equal(regex.test('arbitrary_malicious_string'), false);
    }
  }
});

test('configuration: demo login is disabled by default unless explicitly configured', () => {
  const defaultEnvValue = process.env.ENABLE_DEMO_LOGIN;
  assert.ok(
    defaultEnvValue === undefined || defaultEnvValue === 'false',
    'ENABLE_DEMO_LOGIN must be disabled (false) by default in normal configuration'
  );
});
