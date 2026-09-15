// ── Web Audio Sound Effects Synthesizer ──────────────────────────────────────
// Zero-latency procedural sound effects for AAA game feel (zero external files required).

let audioCtx = null;
let masterNode = null;
let muted = false;
let volume = 1;

/** Silence every effect in this module. For a global sound setting to call. */
export function setSfxMuted(value) {
  muted = Boolean(value);
}

export function isSfxMuted() {
  return muted;
}

/** Global effect volume, 0..1. Applied to every cue routed through master. */
export function setSfxVolume(value) {
  volume = Math.min(1, Math.max(0, Number(value) || 0));
  if (masterNode) masterNode.gain.value = volume;
}

export function getSfxVolume() {
  return volume;
}

// One shared output stage, so mute and volume apply in a single place rather
// than being re-implemented per cue.
function masterGain(ctx) {
  if (!masterNode || masterNode.context !== ctx) {
    masterNode = ctx.createGain();
    masterNode.connect(ctx.destination);
  }
  masterNode.gain.value = volume;
  return masterNode;
}

function getAudioContext() {
  if (muted) return null;
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    // Autoplay policy: until the page has had a gesture this rejects. That is
    // expected, not an error — swallow it so it never reaches the console.
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playUiClick() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}

export function playRadioBeep() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.setValueAtTime(900, ctx.currentTime + 0.04);
  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.08);
}

export function playSuccessChime() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  
  [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + i * 0.08);
    gain.gain.setValueAtTime(0.15, now + i * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + 0.3);
  });
}

export function playWarningBuzzer() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, ctx.currentTime);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
}

// Hazard-ignored cue: a sub impact timed to the flag's first gust, two klaxon
// beeps over it, and a filtered downward sweep tailing out at ~1.1s. Deep and
// industrial rather than shrill, and it never loops — one shot per popup.
export function playFlagAlert() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const out = masterGain(ctx);

  // Layer 1 — sub impact, synchronised with the flag's first gust. Gives the
  // popup its weight without a screen shake.
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(165, now);
  sub.frequency.exponentialRampToValueAtTime(38, now + 0.55);
  subGain.gain.setValueAtTime(0.30, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
  sub.connect(subGain);
  subGain.connect(out);
  sub.start(now);
  sub.stop(now + 0.62);

  // Layer 2 — two industrial alarm beeps, a minor third apart. Serious rather
  // than shrill: a square through a lowpass reads as a plant klaxon, not a game
  // over jingle.
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
    gain.gain.exponentialRampToValueAtTime(0.085, now + at + 0.02);
    gain.gain.setValueAtTime(0.085, now + at + dur * 0.55);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
    osc.connect(gain);
    gain.connect(beepFilter);
    osc.start(now + at);
    osc.stop(now + at + dur);
  });

  // Layer 3 — a downward filtered sweep under the beeps for the futuristic
  // edge, tailing out at ~1.1s so the whole cue stays inside its budget.
  const sweep = ctx.createOscillator();
  const sweepFilter = ctx.createBiquadFilter();
  const sweepGain = ctx.createGain();
  sweep.type = 'sawtooth';
  sweep.frequency.setValueAtTime(320, now + 0.3);
  sweep.frequency.exponentialRampToValueAtTime(90, now + 1.05);
  sweepFilter.type = 'lowpass';
  sweepFilter.frequency.setValueAtTime(1400, now + 0.3);
  sweepFilter.frequency.exponentialRampToValueAtTime(240, now + 1.05);
  sweepGain.gain.setValueAtTime(0.0001, now + 0.3);
  sweepGain.gain.exponentialRampToValueAtTime(0.05, now + 0.4);
  sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
  sweep.connect(sweepFilter);
  sweepFilter.connect(sweepGain);
  sweepGain.connect(out);
  sweep.start(now + 0.3);
  sweep.stop(now + 1.1);
}
