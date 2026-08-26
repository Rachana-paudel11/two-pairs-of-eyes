import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));

test('project exposes a local dev/start script for client demos', () => {
  assert.ok(pkg.scripts.dev, 'dev script missing');
  assert.ok(pkg.scripts.start, 'start script missing');
  assert.match(pkg.scripts.dev, /serve/i, 'dev script should serve the app locally');
  assert.match(pkg.scripts.start, /serve/i, 'start script should serve the app locally');
});
