// ── Web Audio Sound Effects Synthesizer & Audio Manager ───────────────────────
// Zero-latency procedural sound effects for AAA game feel (zero external files required).
// Fully royalty-free, browser-native Web Audio API synthesis.

let audioCtx = null;
let masterNode = null;
let categoryNodes = null;
let muted = false;

// Volume levels by category (sensible starting balance)
const volumeLevels = {
  MASTER: 0.85,
  AMBIENCE: 0.025, // extremely quiet, never competes with speech or cues
  UI: 0.14,        // soft, non-intrusive clicks
  SFX: 0.35,       // clear, physically grounded hazard & collision cues
  DIALOGUE: 0.85   // high priority
};

// Active continuous sound handles for loop management & clean reset
let activeForkliftTimer = null;
let activeAmbienceNodes = null;
let isDucked = false;

// ── Gain Staging & Context Setup ──────────────────────────────────────────────

export function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  return audioCtx;
}

function initCategoryNodes(ctx) {
  if (!masterNode || masterNode.context !== ctx) {
    masterNode = ctx.createGain();
    masterNode.gain.value = muted ? 0 : volumeLevels.MASTER;
    masterNode.connect(ctx.destination);
  }

  if (!categoryNodes || categoryNodes.MASTER !== masterNode) {
    categoryNodes = {
      MASTER: masterNode,
      AMBIENCE: ctx.createGain(),
      UI: ctx.createGain(),
      SFX: ctx.createGain(),
      DIALOGUE: ctx.createGain()
    };

    categoryNodes.AMBIENCE.gain.value = volumeLevels.AMBIENCE;
    categoryNodes.UI.gain.value = volumeLevels.UI;
    categoryNodes.SFX.gain.value = volumeLevels.SFX;
    categoryNodes.DIALOGUE.gain.value = volumeLevels.DIALOGUE;

    categoryNodes.AMBIENCE.connect(masterNode);
    categoryNodes.UI.connect(masterNode);
    categoryNodes.SFX.connect(masterNode);
    categoryNodes.DIALOGUE.connect(masterNode);
  }

  return categoryNodes;
}

function getCategoryGain(ctx, category = 'SFX') {
  const nodes = initCategoryNodes(ctx);
  return nodes[category] || nodes.SFX;
}

function masterGain(ctx) {
  return getCategoryGain(ctx, 'SFX');
}

/**
 * Call on any valid user gesture (e.g. click "START SAFETY PATROL" or login)
 * to unlock audio without browser autoplay policy warnings.
 */
export function initAudioOnUserGesture() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

// ── Master Mute & Volume Controls ─────────────────────────────────────────────

export function setSfxMuted(value) {
  muted = Boolean(value);
  if (masterNode) {
    masterNode.gain.value = muted ? 0 : volumeLevels.MASTER;
  }
  if (muted) {
    stopSfx('forklift-warning');
  }
}

export function isSfxMuted() {
  return muted;
}

export function toggleMute() {
  const next = !isSfxMuted();
  setSfxMuted(next);
  return next;
}

export function setSfxVolume(value) {
  setCategoryVolume('MASTER', value);
}

export function getSfxVolume() {
  return volumeLevels.MASTER;
}

export function setCategoryVolume(category, value) {
  const cat = String(category).toUpperCase();
  if (!(cat in volumeLevels)) return;
  const clamped = Math.min(1, Math.max(0, Number(value) || 0));
  volumeLevels[cat] = clamped;
  if (categoryNodes && categoryNodes[cat] && !muted) {
    categoryNodes[cat].gain.value = clamped;
  }
}

export function getCategoryVolume(category) {
  const cat = String(category).toUpperCase();
  return volumeLevels[cat] ?? 0;
}

// ── Ambience Ducking for Dave Dialogue ─────────────────────────────────────────

export function duckAmbience(ducked = true) {
  isDucked = Boolean(ducked);
  if (!categoryNodes?.AMBIENCE || typeof window === 'undefined') return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const targetGain = isDucked ? volumeLevels.AMBIENCE * 0.35 : volumeLevels.AMBIENCE;
  try {
    categoryNodes.AMBIENCE.gain.cancelScheduledValues(ctx.currentTime);
    categoryNodes.AMBIENCE.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.15);
  } catch (_) {
    categoryNodes.AMBIENCE.gain.value = targetGain;
  }
}

// ── Centralized Playback Dispatcher ───────────────────────────────────────────

/**
 * Plays a registered procedural sound effect.
 * @param {string} name
 */
export function playSfx(name) {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  switch (name) {
    case 'start-patrol':
      playStartPatrolCue();
      break;
    case 'ui-click':
    case 'continue':
      playUiClick();
      break;
    case 'action-select':
      playActionSelect();
      break;
    case 'decision-safe':
    case 'success':
      playSuccessChime();
      break;
    case 'hazard-report':
      playHazardReportedChime();
      break;
    case 'decision-unsafe':
    case 'warning':
      playWarningBuzzer();
      break;
    case 'flag-alert':
      playFlagAlert();
      break;
    case 'session-complete':
      playSessionCompleteCue();
      break;
    case 'forklift-warning':
      startForkliftWarning();
      break;
    case 'forklift-impact':
      playForkliftImpact();
      break;
    case 'slip':
      playSlipSkid();
      break;
    case 'fall':
      playBodyFall();
      break;
    case 'carton-fall':
      playCartonRumble();
      break;
    case 'carton-impact':
      playCartonImpact();
      break;
    case 'electric-arc':
      playElectricArc();
      break;
    case 'trip':
      playTripSound();
      break;
    case 'accident-alert':
      playAccidentAlarm();
      break;
    case 'radio-beep':
      playRadioBeep();
      break;
    default:
      playUiClick();
      break;
  }
}

/**
 * Stops an active continuous sound cue.
 * @param {'forklift-warning'|'ambience'|string} name
 */
export function stopSfx(name) {
  if (name === 'forklift-warning') {
    stopForkliftWarning();
  } else if (name === 'ambience') {
    stopWarehouseAmbience();
  }
}

/**
 * Stops all temporary and looping sounds cleanly.
 */
export function stopAllSfx() {
  stopForkliftWarning();
}

/**
 * Full audio reset on session restart.
 */
export function resetAudio() {
  stopForkliftWarning();
  stopWarehouseAmbience();
  isDucked = false;
  if (categoryNodes?.AMBIENCE) {
    categoryNodes.AMBIENCE.gain.value = volumeLevels.AMBIENCE;
  }
}

// ── UI Sound Effects ─────────────────────────────────────────────────────────

export function playStartPatrolCue() {
  const ctx = getAudioContext();
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const out = getCategoryGain(ctx, 'UI');

  // Subtle dual harmonic tone
  [440, 659.25].forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.05);
    gain.gain.setValueAtTime(0.001, now + idx * 0.05);
    gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.05 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.22);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now + idx * 0.05);
    osc.stop(now + idx * 0.05 + 0.22);
  });
}

export function playUiClick() {
  const ctx = getAudioContext();
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const out = getCategoryGain(ctx, 'UI');

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(380, now + 0.045);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
  osc.connect(gain);
  gain.connect(out);
  osc.start(now);
  osc.stop(now + 0.045);
}

export function playActionSelect() {
  const ctx = getAudioContext();
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const out = getCategoryGain(ctx, 'UI');

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(260, now + 0.06);
  gain.gain.setValueAtTime(0.10, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc.connect(gain);
  gain.connect(out);
  osc.start(now);
  osc.stop(now + 0.06);
}

export function playRadioBeep() {
  const ctx = getAudioContext();
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const out = getCategoryGain(ctx, 'DIALOGUE');

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.setValueAtTime(900, now + 0.04);
  gain.gain.setValueAtTime(0.10, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
  osc.connect(gain);
  gain.connect(out);
  osc.start(now);
  osc.stop(now + 0.08);
}

export function playSuccessChime() {
  const ctx = getAudioContext();
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const out = getCategoryGain(ctx, 'SFX');

  [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + i * 0.07);
    gain.gain.setValueAtTime(0.12, now + i * 0.07);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.28);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now + i * 0.07);
    osc.stop(now + i * 0.07 + 0.28);
  });
}

export function playHazardReportedChime() {
  const ctx = getAudioContext();
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const out = getCategoryGain(ctx, 'SFX');

  [587.33, 880.0].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + i * 0.09);
    gain.gain.setValueAtTime(0.10, now + i * 0.09);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.24);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now + i * 0.09);
    osc.stop(now + i * 0.09 + 0.24);
  });
}

export function playWarningBuzzer() {
  const ctx = getAudioContext();
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const out = getCategoryGain(ctx, 'SFX');

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  osc.connect(gain);
  gain.connect(out);
  osc.start(now);
  osc.stop(now + 0.22);
}

export function playSessionCompleteCue() {
  const ctx = getAudioContext();
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const out = getCategoryGain(ctx, 'SFX');

  // Restrained professional fanfare (C maj triad -> resolved C5)
  const notes = [
    { freq: 261.63, delay: 0.00, dur: 0.35 },
    { freq: 329.63, delay: 0.12, dur: 0.35 },
    { freq: 392.00, delay: 0.24, dur: 0.40 },
    { freq: 523.25, delay: 0.38, dur: 0.65 }
  ];

  notes.forEach(({ freq, delay, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);
    gain.gain.setValueAtTime(0.001, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.14, now + delay + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now + delay);
    osc.stop(now + delay + dur);
  });
}

// ── Flag Alert Cue ───────────────────────────────────────────────────────────

export function playFlagAlert() {
  const ctx = getAudioContext();
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const out = getCategoryGain(ctx, 'SFX');

  // Sub impact
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(165, now);
  sub.frequency.exponentialRampToValueAtTime(38, now + 0.55);
  subGain.gain.setValueAtTime(0.28, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
  sub.connect(subGain);
  subGain.connect(out);
  sub.start(now);
  sub.stop(now + 0.62);

  // 2 klaxon beeps
  const beepFilter = ctx.createBiquadFilter();
  beepFilter.type = 'lowpass';
  beepFilter.frequency.setValueAtTime(2200, now);
  beepFilter.Q.value = 0.7;
  beepFilter.connect(out);

  [
    { freq: 466.16, at: 0.02, dur: 0.26 },
    { freq: 392.0, at: 0.34, dur: 0.42 },
  ].forEach(({ freq, at, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now + at);
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(0.075, now + at + 0.02);
    gain.gain.setValueAtTime(0.075, now + at + dur * 0.55);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
    osc.connect(gain);
    gain.connect(beepFilter);
    osc.start(now + at);
    osc.stop(now + at + dur);
  });
}

// ── Accident Sound Effects ───────────────────────────────────────────────────

/**
 * Forklift pulsing industrial backup/motion warning tone.
 * Subtle, low volume, stops when collision occurs.
 */
export function startForkliftWarning() {
  stopForkliftWarning();
  if (muted) return;

  const pulse = () => {
    const ctx = getAudioContext();
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const out = getCategoryGain(ctx, 'SFX');

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(740, now);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(740, now);
    filter.Q.value = 3.0;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.065, now + 0.02);
    gain.gain.setValueAtTime(0.065, now + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.20);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);

    osc.start(now);
    osc.stop(now + 0.20);
  };

  pulse();
  activeForkliftTimer = setInterval(pulse, 420);
}

export function stopForkliftWarning() {
  if (activeForkliftTimer) {
    clearInterval(activeForkliftTimer);
    activeForkliftTimer = null;
  }
}

/**
 * Synchronized heavy impact sound when forklift contacts worker.
 */
export function playForkliftImpact() {
  const ctx = getAudioContext();
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const out = getCategoryGain(ctx, 'SFX');

  stopForkliftWarning(); // Guarantee warning stops instantly on contact

  // Layer 1: Sub bass thud
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(140, now);
  sub.frequency.exponentialRampToValueAtTime(32, now + 0.40);
  subGain.gain.setValueAtTime(0.38, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  sub.connect(subGain);
  subGain.connect(out);
  sub.start(now);
  sub.stop(now + 0.45);

  // Layer 2: Metallic chassis / bumper strike
  const clatter = ctx.createOscillator();
  const clatterGain = ctx.createGain();
  clatter.type = 'triangle';
  clatter.frequency.setValueAtTime(280, now);
  clatter.frequency.exponentialRampToValueAtTime(90, now + 0.25);
  clatterGain.gain.setValueAtTime(0.22, now);
  clatterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
  clatter.connect(clatterGain);
  clatterGain.connect(out);
  clatter.start(now);
  clatter.stop(now + 0.28);

  // Layer 3: Noise transient for tyre skid / scrape
  try {
    const bufferSize = Math.floor(ctx.sampleRate * 0.25);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, now);
    filter.Q.value = 1.4;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.18, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    noiseSrc.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(out);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.25);
  } catch (_) {}
}

/**
 * Wet rubber skid / slip transient for fluid spill accident.
 */
export function playSlipSkid() {
  const ctx = getAudioContext();
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const out = getCategoryGain(ctx, 'SFX');

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(860, now + 0.08);
  osc.frequency.exponentialRampToValueAtTime(320, now + 0.18);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(620, now);
  filter.Q.value = 2.0;

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.15, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(out);

  osc.start(now);
  osc.stop(now + 0.20);
}

/**
 * Human body falling onto warehouse concrete floor.
 */
export function playBodyFall() {
  const ctx = getAudioContext();
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const out = getCategoryGain(ctx, 'SFX');

  const thud = ctx.createOscillator();
  const thudGain = ctx.createGain();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(110, now);
  thud.frequency.exponentialRampToValueAtTime(28, now + 0.35);
  thudGain.gain.setValueAtTime(0.28, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
  thud.connect(thudGain);
  thudGain.connect(out);
  thud.start(now);
  thud.stop(now + 0.38);
}

/**
 * Cardboard rack load shifting / creak.
 */
export function playCartonRumble() {
  const ctx = getAudioContext();
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const out = getCategoryGain(ctx, 'SFX');

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(95, now);
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.45);
  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
  osc.connect(gain);
  gain.connect(out);
  osc.start(now);
  osc.stop(now + 0.48);
}

/**
 * Cardboard boxes striking floor/worker.
 */
export function playCartonImpact() {
  const ctx = getAudioContext();
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const out = getCategoryGain(ctx, 'SFX');

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(42, now + 0.32);
  gain.gain.setValueAtTime(0.26, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc.connect(gain);
  gain.connect(out);
  osc.start(now);
  osc.stop(now + 0.35);
}

/**
 * Electrical arc flash snap & discharge for Stop 04.
 */
export function playElectricArc() {
  const ctx = getAudioContext();
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const out = getCategoryGain(ctx, 'SFX');

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(120, now + 0.16);
  gain.gain.setValueAtTime(0.24, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(gain);
  gain.connect(out);
  osc.start(now);
  osc.stop(now + 0.18);
}

/**
 * Foot trip stumble transient.
 */
export function playTripSound() {
  playSlipSkid();
}

/**
 * Heavy impact crash.
 */
export function playAccidentCrash() {
  playForkliftImpact();
}

/**
 * Emergency facility siren/alert.
 */
export function playAccidentAlarm() {
  const ctx = getAudioContext();
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const out = getCategoryGain(ctx, 'SFX');

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2600, now);
  filter.connect(out);

  const tones = [
    { freq: 680, at: 0.00, dur: 0.24 },
    { freq: 480, at: 0.28, dur: 0.24 },
    { freq: 680, at: 0.56, dur: 0.28 },
  ];

  tones.forEach(({ freq, at, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now + at);
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(0.10, now + at + 0.02);
    gain.gain.setValueAtTime(0.10, now + at + dur * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
    osc.connect(gain);
    gain.connect(filter);
    osc.start(now + at);
    osc.stop(now + at + dur);
  });
}

// ── Warehouse Ambience (Subtle Industrial Room Tone) ─────────────────────────

/**
 * Starts subtle, low-volume warehouse room tone (HVAC / distant facility drone).
 * Extremely quiet (~0.025 volume), never competes with dialogue or SFX.
 */
export function startWarehouseAmbience() {
  if (activeAmbienceNodes || typeof window === 'undefined') return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    // Pink noise generation
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2) * 0.12;
    }

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(110, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(muted ? 0 : 1.0, ctx.currentTime);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(getCategoryGain(ctx, 'AMBIENCE'));

    src.start();
    activeAmbienceNodes = { src, filter, gain };
  } catch (_) {}
}

export function stopWarehouseAmbience() {
  if (activeAmbienceNodes) {
    try {
      activeAmbienceNodes.src.stop();
      activeAmbienceNodes.src.disconnect();
    } catch (_) {}
    activeAmbienceNodes = null;
  }
}

// ── Central AudioManager Class & Event Integration ────────────────────────────

export class AudioManager {
  constructor() {
    this._eventBus = null;
    this._unsubscribers = [];
  }

  playSfx(name) {
    playSfx(name);
  }

  stopSfx(name) {
    stopSfx(name);
  }

  stopAll() {
    stopAllSfx();
  }

  startAmbience() {
    startWarehouseAmbience();
  }

  stopAmbience() {
    stopWarehouseAmbience();
  }

  duck(isSpeaking = true) {
    duckAmbience(isSpeaking);
  }

  setMuted(value) {
    setSfxMuted(value);
  }

  isMuted() {
    return isSfxMuted();
  }

  toggleMute() {
    return toggleMute();
  }

  setVolume(category, val) {
    setCategoryVolume(category, val);
  }

  getVolume(category) {
    return getCategoryVolume(category);
  }

  unlock() {
    initAudioOnUserGesture();
  }

  reset() {
    resetAudio();
  }

  /**
   * Connects AudioManager to listen to gameplay events without altering game state.
   * @param {import('../engine/eventBus.js').EventBus} eventBus
   */
  attachEventBus(eventBus) {
    this.detachEventBus();
    if (!eventBus || typeof eventBus.on !== 'function') return;
    this._eventBus = eventBus;

    const on = (evt, handler) => {
      const unsub = eventBus.on(evt, handler);
      if (typeof unsub === 'function') {
        this._unsubscribers.push(unsub);
      }
    };

    on('ui:start-patrol', () => {
      this.unlock();
      this.startAmbience();
      this.playSfx('start-patrol');
    });

    on('action:resolved', ({ outcome, points } = {}) => {
      if (outcome === 'optimal' || points > 0) {
        this.playSfx('decision-safe');
      } else if (outcome === 'failure') {
        this.playSfx('decision-unsafe');
      } else {
        this.playSfx('hazard-report');
      }
    });

    on('flags:updated', ({ newFlags } = {}) => {
      if (Array.isArray(newFlags) && newFlags.length > 0) {
        this.playSfx('flag-alert');
      }
    });

    on('dialogue:line', () => {
      this.duck(true);
    });

    on('action:outcome:displayed', () => {
      this.duck(false);
    });

    on('session:complete', () => {
      this.stopAmbience();
      this.stopAll();
      this.playSfx('session-complete');
    });
  }

  detachEventBus() {
    for (const unsub of this._unsubscribers) {
      try {
        if (typeof unsub === 'function') unsub();
      } catch (_) {}
    }
    this._unsubscribers = [];
    this._eventBus = null;
  }
}

export const audioManager = new AudioManager();
export default audioManager;
