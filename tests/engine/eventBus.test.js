import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEventBus } from '../../src/engine/eventBus.js';

test('eventBus emits payloads to registered listeners', () => {
  const bus = createEventBus();
  const received = [];

  bus.on('hazard:spotted', (data) => received.push(data));
  bus.emit('hazard:spotted', { id: 'spill_1', severity: 'moderate' });

  assert.equal(received.length, 1);
  assert.deepEqual(received[0], { id: 'spill_1', severity: 'moderate' });
});

test('eventBus unsubscribe removes listener via off() and return function', () => {
  const bus = createEventBus();
  let count = 0;
  const handler = () => { count++; };

  const unsub = bus.subscribe('score:update', handler);
  bus.emit('score:update', 5);
  assert.equal(count, 1);

  unsub();
  bus.emit('score:update', 10);
  assert.equal(count, 1);

  bus.on('score:update', handler);
  bus.emit('score:update', 15);
  assert.equal(count, 2);

  bus.unsubscribe('score:update', handler);
  bus.emit('score:update', 20);
  assert.equal(count, 2);
});

test('eventBus handles multiple listeners for the same event cleanly', () => {
  const bus = createEventBus();
  const calls = [];

  bus.on('alert', () => calls.push('first'));
  bus.on('alert', () => calls.push('second'));

  bus.emit('alert');
  assert.deepEqual(calls, ['first', 'second']);
});
