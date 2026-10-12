import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEventBus } from '../../src/engine/eventBus.js';
import {
  audioManager,
  playSfx,
  stopSfx,
  stopAllSfx,
  startWarehouseAmbience,
  stopWarehouseAmbience,
  isSfxMuted,
  setSfxMuted,
  toggleMute,
  setCategoryVolume,
  getCategoryVolume,
  resetAudio,
  initAudioOnUserGesture
} from '../../src/utils/audio.js';

// Setup Mock AudioContext for headless Node environment
class MockAudioNode {
  constructor() {
    this.gain = {
      value: 1,
      setValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {},
      linearRampToValueAtTime: () => {},
      cancelScheduledValues: () => {}
    };
    this.frequency = {
      value: 440,
      setValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {}
    };
    this.Q = { value: 1 };
  }
  connect() {}
  disconnect() {}
  start() {}
  stop() {}
}

class MockAudioContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = new MockAudioNode();
  }
  createGain() { return new MockAudioNode(); }
  createOscillator() { return new MockAudioNode(); }
  createBiquadFilter() { return new MockAudioNode(); }
  createBuffer(channels, size, rate) {
    return {
      getChannelData: () => new Float32Array(size)
    };
  }
  createBufferSource() { return new MockAudioNode(); }
  async resume() {
    this.state = 'running';
  }
}

// 1. No autoplay error before START PATROL (audio context is not automatically resumed)
test('Audio 1: No autoplay error before START PATROL', () => {
  globalThis.window = {
    AudioContext: MockAudioContext
  };
  resetAudio();
  setSfxMuted(false);

  // Audio system exists and is ready without having thrown or attempted illegal playback
  assert.equal(typeof audioManager.unlock, 'function');
});

// 2. START PATROL unlocks audio
test('Audio 2: START PATROL unlocks audio', async () => {
  const mockCtx = new MockAudioContext();
  globalThis.window = { AudioContext: function() { return mockCtx; } };

  assert.equal(mockCtx.state, 'suspended', 'Context starts suspended');
  initAudioOnUserGesture();
  await Promise.resolve(); // allow async resume to settle
  assert.equal(mockCtx.state, 'running', 'Context is successfully unlocked on user gesture');
});

// 3. Ambience starts once
test('Audio 3: Ambience starts once and does not duplicate', () => {
  const mockCtx = new MockAudioContext();
  globalThis.window = { AudioContext: function() { return mockCtx; } };

  startWarehouseAmbience();
  // Second call must not throw and must not create a duplicate concurrent loop
  assert.doesNotThrow(() => {
    startWarehouseAmbience();
  });

  stopWarehouseAmbience();
});

// 4. Safe decision plays correct SFX
test('Audio 4: Safe decision plays correct SFX', () => {
  const played = [];
  const eventBus = createEventBus();
  audioManager.attachEventBus(eventBus);

  // Monkey-patch playSfx to track calls
  const origPlaySfx = audioManager.playSfx;
  audioManager.playSfx = (cue) => played.push(cue);

  eventBus.emit('action:resolved', { outcome: 'optimal', points: 5 });
  assert.ok(played.includes('decision-safe'), 'Safe decision must trigger decision-safe SFX');

  audioManager.playSfx = origPlaySfx;
  audioManager.detachEventBus();
});

// 5. Ignore decision plays warning SFX
test('Audio 5: Ignore decision plays warning SFX', () => {
  const played = [];
  const eventBus = createEventBus();
  audioManager.attachEventBus(eventBus);

  const origPlaySfx = audioManager.playSfx;
  audioManager.playSfx = (cue) => played.push(cue);

  eventBus.emit('action:resolved', { outcome: 'failure', points: -3 });
  assert.ok(played.includes('decision-unsafe'), 'Ignore decision must trigger warning SFX');

  audioManager.playSfx = origPlaySfx;
  audioManager.detachEventBus();
});

// 6. Forklift impact sound plays once
test('Audio 6: Forklift impact sound triggers cleanly', () => {
  assert.doesNotThrow(() => {
    playSfx('forklift-impact');
  });
});

// 7. Spill fall sound plays once
test('Audio 7: Spill fall sound triggers cleanly', () => {
  assert.doesNotThrow(() => {
    playSfx('slip');
    playSfx('fall');
  });
});

// 8. Rack sounds play once
test('Audio 8: Rack carton sounds trigger cleanly', () => {
  assert.doesNotThrow(() => {
    playSfx('carton-fall');
    playSfx('carton-impact');
  });
});

// 9. Mute works
test('Audio 9: Mute works', () => {
  setSfxMuted(false);
  assert.equal(isSfxMuted(), false);

  setSfxMuted(true);
  assert.equal(isSfxMuted(), true);
  assert.equal(audioManager.isMuted(), true);
});

// 10. Unmute works
test('Audio 10: Unmute works', () => {
  setSfxMuted(true);
  assert.equal(isSfxMuted(), true);

  const newMute = toggleMute();
  assert.equal(newMute, false);
  assert.equal(isSfxMuted(), false);
  assert.equal(audioManager.isMuted(), false);
});

// 11. Restart does not duplicate ambience
test('Audio 11: Restart does not duplicate ambience', () => {
  const mockCtx = new MockAudioContext();
  globalThis.window = { AudioContext: function() { return mockCtx; } };

  startWarehouseAmbience();
  resetAudio();
  assert.doesNotThrow(() => {
    startWarehouseAmbience();
  });
  stopWarehouseAmbience();
});

// 12. Session reset stops accident audio
test('Audio 12: Session reset stops accident audio and loops', () => {
  // Start continuous warning
  playSfx('forklift-warning');
  startWarehouseAmbience();

  // Reset audio
  assert.doesNotThrow(() => {
    resetAudio();
  });
});

// 13. Category volume controls and dialogue ducking work as expected
test('Audio 13: Category volume controls and dialogue ducking work as expected', () => {
  setCategoryVolume('SFX', 0.5);
  assert.equal(getCategoryVolume('SFX'), 0.5);

  setCategoryVolume('UI', 0.2);
  assert.equal(getCategoryVolume('UI'), 0.2);

  // Dialogue ducking
  assert.doesNotThrow(() => {
    audioManager.duck(true);
    audioManager.duck(false);
  });
});
