// Composition root: the only module that knows about all three layers
// (engine, renderer, ui). Loads and validates stops.json, wires the engine
// to an event bus, and boots the A-Frame renderer against the scene shell
// already in index.html.
//
// UI construction (dialoguePanel/actionMenu/hud/debrief) is deliberately
// deferred here: this pass is scoped to the 3D A-Frame environment only, so
// for now every lifecycle event is just logged to the console for
// verification instead of being rendered as an overlay.
import stopsData from './data/stops.json' with { type: 'json' };
import { createEventBus } from './engine/eventBus.js';
import { ScenarioEngine } from './engine/scenarioEngine.js';
import { validateStopsData } from './engine/stopsValidator.js';
import { interactions, interactionNames } from './interactions/index.js';
import { createAframeRenderer } from './renderer/aframeRenderer.js';
import { createNpc } from './characters/npc.js';

// ΓöÇΓöÇ NPC data (Rachana's characters) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const daveData = createNpc({
  name: 'Dave',
  behaviour: 'dismissive',
  dialogue: "People have been walking around it all morning. Someone will clean it later."
});

const alexData = createNpc({
  name: 'Alex',
  behaviour: 'uncertain',
  dialogue: "Hey, are you sure we should walk past that hazard? Dave said it's fine, but looks risky to me..."
});

// ΓöÇΓöÇ DOM refs ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const daveEntity      = document.querySelector('#dave');
const alexEntity      = document.querySelector('#alex');
const dialogueBox     = document.querySelector('#dialogue');
const dialogueSpeaker = document.querySelector('#dialogue-speaker');
const dialogueText    = document.querySelector('#dialogue-text');

// ΓöÇΓöÇ Base scale (must match index.html) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const CHAR_SCALE       = '1 1 1';
const CHAR_SCALE_HOVER = '1.05 1.05 1.05';

// ΓöÇΓöÇ Mixamo clip names (verified via gltf.report) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// mixamo.com      = 0.033s T-pose only (single frame, not useful)
// mixamo.com.001  = 6s Standing Idle loop Γ£ô
// Walking         = Walking animation clip name when added
const DAVE_IDLE_CLIP = 'idle';
const ALEX_IDLE_CLIP = 'mixamo.com';
const WALK_CLIP = 'Walking';

// ΓöÇΓöÇ Helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
function showDialogue(speaker, text, showActions = false) {
  if (dialogueSpeaker) dialogueSpeaker.textContent = speaker.toUpperCase();
  if (dialogueText) dialogueText.textContent = text;
  if (dialogueBox) dialogueBox.style.display = 'block';
  
  const actionsEl = document.querySelector('.dialogue-actions');
  if (actionsEl) actionsEl.style.display = showActions ? 'flex' : 'none';
}

function hideDialogue() {
  if (dialogueBox) dialogueBox.style.display = 'none';
}

function playDaveAnimation(clip) {
  if (daveEntity) {
    daveEntity.setAttribute('animation-mixer', {
      clip,
      loop: 'repeat',
      crossFadeDuration: 0.4
    });
  }
}

function playAlexAnimation(clip) {
  if (alexEntity) {
    alexEntity.setAttribute('animation-mixer', {
      clip,
      loop: 'repeat',
      crossFadeDuration: 0.4
    });
  }
}

// ΓöÇΓöÇ Ensure Standing Idle plays on scene load ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
if (daveEntity) {
  daveEntity.addEventListener('model-loaded', () => {
    playDaveAnimation(DAVE_IDLE_CLIP);
  });
}

if (alexEntity) {
  alexEntity.addEventListener('model-loaded', () => {
    playAlexAnimation(ALEX_IDLE_CLIP);
  });
}

// ΓöÇΓöÇ Dave click ΓåÆ show dialogue ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
if (daveEntity) {
  const handleDaveClick = () => {
    const hasActions = currentStopActions && currentStopActions.length > 0;
    showDialogue('Dave', currentDaveDialogue, hasActions);
    playDaveAnimation(DAVE_IDLE_CLIP);
    if (!hasActions) {
      setTimeout(hideDialogue, 4000);
    }
  };
  
  daveEntity.addEventListener('click', handleDaveClick);
  const btnTalkDave = document.querySelector('#btn-talk-dave');
  if (btnTalkDave) btnTalkDave.addEventListener('click', handleDaveClick);

  daveEntity.addEventListener('mouseenter', () => {
    daveEntity.setAttribute('scale', CHAR_SCALE_HOVER);
  });
  daveEntity.addEventListener('mouseleave', () => {
    daveEntity.setAttribute('scale', CHAR_SCALE);
  });
}

// ΓöÇΓöÇ Alex click ΓåÆ show dialogue ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
if (alexEntity) {
  const handleAlexClick = () => {
    showDialogue(alexData.name, alexData.dialogue);
    playAlexAnimation(ALEX_IDLE_CLIP);
    setTimeout(hideDialogue, 4000);
  };

  alexEntity.addEventListener('click', handleAlexClick);
  const btnTalkAlex = document.querySelector('#btn-talk-alex');
  if (btnTalkAlex) btnTalkAlex.addEventListener('click', handleAlexClick);

  alexEntity.addEventListener('mouseenter', () => {
    alexEntity.setAttribute('scale', CHAR_SCALE_HOVER);
  });
  alexEntity.addEventListener('mouseleave', () => {
    alexEntity.setAttribute('scale', CHAR_SCALE);
  });
}

// ── Move Dave Waypoints ───────────────────────────────────────────────────────
const waypoints = [
  { position: '0 0 -3', rotation: '0 0 0' },
  { position: '3 0 -6', rotation: '0 -45 0' }
];
let currentWaypointIndex = 0;
let isMoving = false;
let currentEngine = null;
let currentDaveDialogue = daveData.dialogue;
let currentStopActions = [];

const btnAck = document.querySelector('#btn-dialogue-ack');
const btnChallenge = document.querySelector('#btn-dialogue-challenge');

if (btnAck) {
  btnAck.addEventListener('click', () => {
    if (currentEngine && currentStopActions.includes('ignore')) {
      currentEngine.chooseAction('ignore');
      hideDialogue();
      playUiClick();
    }
  });
}

if (btnChallenge) {
  btnChallenge.addEventListener('click', () => {
    if (currentEngine && currentStopActions.includes('cordon_off')) {
      currentEngine.chooseAction('cordon_off');
      hideDialogue();
      playSuccessChime();
    }
  });
}

const moveBtn = document.querySelector('#btn-move-dave');

if (moveBtn) {
  moveBtn.addEventListener('click', () => {
    if (isMoving) return;

    isMoving = true;
    currentWaypointIndex = (currentWaypointIndex + 1) % waypoints.length;
    const target = waypoints[currentWaypointIndex];

    showDialogue('Dave', `Moving to position ${target.position}...`);
    playDaveAnimation(WALK_CLIP);

    daveEntity.setAttribute('animation__move', {
      property: 'position',
      to: target.position,
      dur: 3000,
      easing: 'easeInOutQuad'
    });

    daveEntity.setAttribute('animation__rotate', {
      property: 'rotation',
      to: target.rotation,
      dur: 1000,
      easing: 'easeInOutQuad'
    });

    setTimeout(() => {
      isMoving = false;
      showDialogue(daveData.name, 'Arrived at location!');
      playDaveAnimation(DAVE_IDLE_CLIP);
      setTimeout(hideDialogue, 3000);
    }, 3000);
  });
}

// ΓöÇΓöÇ Scenario engine boot ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
function boot() {
  const validated = validateStopsData(stopsData, { knownInteractionNames: interactionNames });
  const eventBus = createEventBus();
  const engine = new ScenarioEngine({ stopsData: validated, eventBus, interactions });
  currentEngine = engine;

  const sceneEl = document.querySelector('a-scene');
  createAframeRenderer({ eventBus, sceneEl });

  eventBus.on('stop:entered',      (payload) => console.log('[stop:entered]', payload));
  eventBus.on('dialogue:line',     (payload) => {
    console.log('[dialogue:line]', payload);
    if (payload.name === 'Dave') {
      currentDaveDialogue = payload.line;
    }
  });
  eventBus.on('actions:available', (payload) => {
    console.log('[actions:available]', payload);
    currentStopActions = payload.actions;
  });
  eventBus.on('action:resolved',   (payload) => console.log('[action:resolved]', payload));
  eventBus.on('consequence:play',  (payload) => console.log('[consequence:play]', payload));
  eventBus.on('score:changed',     (payload) => {
    console.log('[score:changed]', payload);
    const scoreEl = document.querySelector('#hud-score');
    if (scoreEl) scoreEl.textContent = `${payload.total} / 25 PTS`;
  });
  eventBus.on('session:complete',  (payload) => console.log('[session:complete]', payload));

  const start = () => engine.start();
  const btnStart = document.querySelector('#btn-start');
  const instructionsPanel = document.querySelector('#instructions-panel');

  const initGame = () => {
    if (instructionsPanel) instructionsPanel.style.display = 'none';
    if (sceneEl.hasLoaded) {
      start();
    } else {
      sceneEl.addEventListener('loaded', start, { once: true });
    }
  };

  if (btnStart) {
    btnStart.addEventListener('click', initGame);
  } else {
    initGame();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
function playUiClick() {
  const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
  audio.play().catch(() => {});
}

function playSuccessChime() {
  const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
  audio.play().catch(() => {});
}
