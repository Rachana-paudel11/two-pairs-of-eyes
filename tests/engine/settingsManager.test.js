import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { settingsManager, DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '../../src/systems/settings-manager.js';
import { createEventBus } from '../../src/engine/eventBus.js';

// Polyfill mock localStorage in Node.js test environment
const mockStorage = new Map();
globalThis.window = globalThis.window || {};
globalThis.window.localStorage = {
  getItem: (k) => (mockStorage.has(k) ? mockStorage.get(k) : null),
  setItem: (k, v) => mockStorage.set(k, String(v)),
  removeItem: (k) => mockStorage.delete(k),
  clear: () => mockStorage.clear()
};

test('Settings 01: Default settings match schema and expected values', () => {
  settingsManager.restoreDefaults();
  const s = settingsManager.getSettings();

  assert.equal(s.version, 1);
  assert.equal(s.audio.masterVolume, 85);
  assert.equal(s.audio.sfxVolume, 80);
  assert.equal(s.audio.dialogueVolume, 90);
  assert.equal(s.audio.ambienceVolume, 50);
  assert.equal(s.audio.muted, false);

  assert.equal(s.graphics.quality, 'medium');
  assert.equal(s.graphics.shadows, true);
  assert.equal(s.graphics.pixelRatioLimit, 1.0);

  assert.equal(s.controls.mouseSensitivity, 50);
  assert.equal(s.controls.invertY, false);

  assert.equal(s.accessibility.reducedMotion, false);
  assert.equal(s.accessibility.subtitles, true);
  assert.equal(s.accessibility.fontSize, 'normal');
});

test('Settings 02: Sanitizes invalid and out-of-bounds inputs', () => {
  settingsManager.update({
    audio: {
      masterVolume: 250, // Should clamp to 100
      sfxVolume: -50,    // Should clamp to 0
      dialogueVolume: 'invalid' // Fallback to default 90
    },
    graphics: {
      quality: 'ultra-extreme', // Should fallback to 'medium'
    },
    controls: {
      mouseSensitivity: 999
    },
    accessibility: {
      fontSize: 'gigantic'
    }
  });

  const s = settingsManager.getSettings();
  assert.equal(s.audio.masterVolume, 100);
  assert.equal(s.audio.sfxVolume, 0);
  assert.equal(s.audio.dialogueVolume, 90);
  assert.equal(s.graphics.quality, 'medium');
  assert.equal(s.controls.mouseSensitivity, 100);
  assert.equal(s.accessibility.fontSize, 'normal');
});

test('Settings 03: Gracefully handles corrupted JSON in localStorage', () => {
  mockStorage.set(SETTINGS_STORAGE_KEY, '{ invalid corrupted json :::');
  
  // Calling load() should not throw and must recover to default settings
  settingsManager.load();
  const s = settingsManager.getSettings();
  assert.equal(s.audio.masterVolume, DEFAULT_SETTINGS.audio.masterVolume);
  assert.equal(s.graphics.quality, DEFAULT_SETTINGS.graphics.quality);
});

test('Settings 04: Partial updates merge cleanly without dropping untouched fields', () => {
  settingsManager.restoreDefaults();
  settingsManager.update({
    audio: { sfxVolume: 42 }
  });

  const s = settingsManager.getSettings();
  assert.equal(s.audio.sfxVolume, 42);
  assert.equal(s.audio.masterVolume, 85); // Untouched
  assert.equal(s.graphics.quality, 'medium'); // Untouched
});

test('Settings 05: Restore Defaults resets all categories', () => {
  settingsManager.update({
    audio: { masterVolume: 10, muted: true },
    graphics: { quality: 'low' },
    controls: { mouseSensitivity: 20 },
    accessibility: { reducedMotion: true }
  });

  settingsManager.restoreDefaults();
  const s = settingsManager.getSettings();

  assert.equal(s.audio.masterVolume, 85);
  assert.equal(s.audio.muted, false);
  assert.equal(s.graphics.quality, 'medium');
  assert.equal(s.controls.mouseSensitivity, 50);
  assert.equal(s.accessibility.reducedMotion, false);
});

test('Settings 06: EventBus emits subsystem-specific events on update', () => {
  const bus = createEventBus();
  settingsManager.attachEventBus(bus);

  let audioPayload = null;
  let graphicsPayload = null;
  let controlsPayload = null;
  let a11yPayload = null;
  let changePayload = null;

  bus.on('settings:audio:applied', (p) => { audioPayload = p; });
  bus.on('settings:graphics:applied', (p) => { graphicsPayload = p; });
  bus.on('settings:controls:applied', (p) => { controlsPayload = p; });
  bus.on('settings:accessibility:applied', (p) => { a11yPayload = p; });
  bus.on('settings:changed', (p) => { changePayload = p; });

  settingsManager.update({
    audio: { masterVolume: 65, muted: true },
    graphics: { quality: 'high' },
    controls: { mouseSensitivity: 75 },
    accessibility: { subtitles: false }
  });

  assert.ok(audioPayload);
  assert.equal(audioPayload.masterVolume, 65);
  assert.equal(audioPayload.muted, true);

  assert.ok(graphicsPayload);
  assert.equal(graphicsPayload.quality, 'high');
  assert.equal(graphicsPayload.pixelRatioLimit, 1.5);

  assert.ok(controlsPayload);
  assert.equal(controlsPayload.mouseSensitivity, 75);

  assert.ok(a11yPayload);
  assert.equal(a11yPayload.subtitles, false);

  assert.ok(changePayload);
  assert.equal(changePayload.audio.masterVolume, 65);
});

test('Settings 07: Graphics quality presets map to appropriate shadows and resolution limits', () => {
  settingsManager.update({ graphics: { quality: 'low' } });
  let s = settingsManager.getSettings();
  assert.equal(s.graphics.quality, 'low');
  assert.equal(s.graphics.shadows, false);
  assert.equal(s.graphics.pixelRatioLimit, 0.75);

  settingsManager.update({ graphics: { quality: 'high' } });
  s = settingsManager.getSettings();
  assert.equal(s.graphics.quality, 'high');
  assert.equal(s.graphics.shadows, true);
  assert.equal(s.graphics.pixelRatioLimit, 1.5);
});

test('Settings 08: onChange listener triggers on updates and unsubscribes cleanly', () => {
  let callCount = 0;
  const unsub = settingsManager.onChange(() => {
    callCount++;
  });

  settingsManager.update({ audio: { masterVolume: 50 } });
  assert.equal(callCount, 1);

  unsub();
  settingsManager.update({ audio: { masterVolume: 60 } });
  assert.equal(callCount, 1); // Unsubscribed, count should remain 1
});
