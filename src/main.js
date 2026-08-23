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

// ── NPC data (Rachana's characters) ──────────────────────────────────────────
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

// ── DOM refs ──────────────────────────────────────────────────────────────────
const daveEntity      = document.querySelector('#dave');
const alexEntity      = document.querySelector('#alex');
const dialogueBox     = document.querySelector('#dialogue');
const dialogueSpeaker = document.querySelector('#dialogue-speaker');
const dialogueText    = document.querySelector('#dialogue-text');

// ── Base scale (must match index.html) ───────────────────────────────────────
const CHAR_SCALE       = '1 1 1';
const CHAR_SCALE_HOVER = '1.05 1.05 1.05';

// ── Mixamo clip names (verified via gltf.report) ─────────────────────────────
// mixamo.com      = 0.033s T-pose only (single frame, not useful)
// mixamo.com.001  = 6s Standing Idle loop ✓
// Walking         = Walking animation clip name when added
const DAVE_IDLE_CLIP = 'idle';
const ALEX_IDLE_CLIP = 'mixamo.com';
const WALK_CLIP = 'Walking';

// ── Helpers ───────────────────────────────────────────────────────────────────
function showDialogue(speaker, text) {
  if (dialogueSpeaker) dialogueSpeaker.textContent = speaker.toUpperCase();
  if (dialogueText) dialogueText.textContent = text;
  if (dialogueBox) dialogueBox.style.display = 'block';
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

// ── Ensure Standing Idle plays on scene load ──────────────────────────────────
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

// ── Dave click → show dialogue ────────────────────────────────────────────────
if (daveEntity) {
  daveEntity.addEventListener('click', () => {
    showDialogue(daveData.name, daveData.dialogue);
    playDaveAnimation(DAVE_IDLE_CLIP);
    setTimeout(hideDialogue, 4000);
  });

  daveEntity.addEventListener('mouseenter', () => {
    daveEntity.setAttribute('scale', CHAR_SCALE_HOVER);
  });
  daveEntity.addEventListener('mouseleave', () => {
    daveEntity.setAttribute('scale', CHAR_SCALE);
  });
}

// ── Alex click → show dialogue ────────────────────────────────────────────────
if (alexEntity) {
  alexEntity.addEventListener('click', () => {
    showDialogue(alexData.name, alexData.dialogue);
    playAlexAnimation(ALEX_IDLE_CLIP);
    setTimeout(hideDialogue, 4000);
  });

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
let currentSpeaker = 'Dave';
let isMoving = false;
let isDialogueOpen = false;

// ── Dialogue Actions ─────────────────────────────────────────────────────────
function handleAcknowledge() {
  playUiClick();
  isDialogueOpen = false;
  hideDialogue();
}

function handleChallenge() {
  playSuccessChime();
  currentScore = Math.min(25, currentScore + 5);
  totalChallengesCount = Math.min(5, totalChallengesCount + 1);
  updateHudScore(currentScore);

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

// ── Scenario engine boot ──────────────────────────────────────────────────────
function boot() {
  const validated = validateStopsData(stopsData, { knownInteractionNames: interactionNames });
  const eventBus = createEventBus();
  const engine = new ScenarioEngine({ stopsData: validated, eventBus, interactions });

  const sceneEl = document.querySelector('a-scene');
  createAframeRenderer({ eventBus, sceneEl });

  eventBus.on('stop:entered',      (payload) => console.log('[stop:entered]', payload));
  eventBus.on('dialogue:line',     (payload) => console.log('[dialogue:line]', payload));
  eventBus.on('actions:available', (payload) => console.log('[actions:available]', payload));
  eventBus.on('action:resolved',   (payload) => console.log('[action:resolved]', payload));
  eventBus.on('consequence:play',  (payload) => console.log('[consequence:play]', payload));
  eventBus.on('score:changed',     (payload) => console.log('[score:changed]', payload));
  eventBus.on('session:complete',  (payload) => console.log('[session:complete]', payload));

  const start = () => engine.start();
  if (sceneEl.hasLoaded) {
    start();
  } else {
    showDialogue('Alex', 'OPERATIVE // CO-WORKER', 'A', 'Great call! Safety rules exist for a reason. Let us report it.');
    playAlexTalk(3500);
  }
  setTimeout(() => {
    isDialogueOpen = false;
    hideDialogue();
  }, 4000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

function talkToAlex() {
  playRadioBeep();
  isDialogueOpen = true;
  currentSpeaker = 'Alex';
  const wp = getWaypoint(currentWaypointIndex);
  showDialogue('Alex', 'OPERATIVE // CO-WORKER', 'A', wp.alexDialogue);
  playAlexTalk(4000);
}

function advancePatrol() {
  if (isMoving) return;
  isMoving = true;
  playUiClick();

  currentWaypointIndex = (currentWaypointIndex + 1) % getTotalWaypoints();
  const target = getWaypoint(currentWaypointIndex);

  updateHudTitle(target.name);
  highlightCurrentStop(currentWaypointIndex);
  showDialogue('Dave', 'SUPERVISOR // BAY 04', 'D', `Moving to ${target.name}...`);
  isDialogueOpen = true;

  patrolToWaypoint(target, () => {
    isMoving = false;
    showDialogue('Dave', 'SUPERVISOR // BAY 04', 'D', target.daveDialogue);

    // If reached the final stop (Stop 05), trigger the final debrief scorecard
    if (currentWaypointIndex === getTotalWaypoints() - 1) {
      setTimeout(() => {
        showDebrief(currentScore, totalChallengesCount);
      }, 4500);
    }
  });
}

function restartSimulation() {
  playUiClick();
  currentScore = 0;
  totalChallengesCount = 0;
  currentWaypointIndex = 0;
  isMoving = false;
  isDialogueOpen = false;

  updateHudScore(0);
  updateHudTitle(waypoints[0].name);
  highlightCurrentStop(0);
  resetCharacterPositions(waypoints[0]);
  hideDialogue();
  hideDebrief();
  startHudTimer();

  // Automatic message pop-up after 2 seconds on restart
  setTimeout(() => {
    talkToDave();
  }, 2000);
}

// ── Initialize Composition Root on DOM Ready ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize UI Modules
  initHud();
  initDialoguePanel({
    onAcknowledge: handleAcknowledge,
    onChallenge: handleChallenge
  });
  initDebrief({
    onRestart: restartSimulation
  });

  // 2. Initialize 3D Renderer, Scene Loader & Characters
  initSceneLoader();
  initRenderer({
    onDaveClick: talkToDave,
    onAlexClick: talkToAlex
  });

  // 3. Bind Bottom Action Bar Buttons
  const btnTalkDave = document.querySelector('#btn-talk-dave');
  const btnMoveDave = document.querySelector('#btn-move-dave');
  const btnTalkAlex = document.querySelector('#btn-talk-alex');
  const btnStart = document.querySelector('#btn-start');
  const instructionsPanel = document.querySelector('#instructions-panel');

  if (btnStart) {
    btnStart.addEventListener('click', () => {
      playSuccessChime();
      if (instructionsPanel) instructionsPanel.style.display = 'none';
      startHudTimer();

      // Automatic message pop up after 2 seconds on initial entry
      setTimeout(() => {
        talkToDave();
      }, 2000);
    });
  }

  if (btnTalkDave) btnTalkDave.addEventListener('click', talkToDave);
  if (btnMoveDave) btnMoveDave.addEventListener('click', advancePatrol);
  if (btnTalkAlex) btnTalkAlex.addEventListener('click', talkToAlex);

  // 4. Global Keyboard Shortcuts (Pro-Gamer Controls)
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    
    if (key === 'e') {
      talkToDave();
    } else if (key === 't') {
      talkToAlex();
    } else if (key === ' ' && !isDialogueOpen) {
      e.preventDefault();
      advancePatrol();
    } else if (key === '1' && isDialogueOpen) {
      handleAcknowledge();
    } else if (key === '2' && isDialogueOpen) {
      handleChallenge();
    } else if (key === 'escape') {
      isDialogueOpen = false;
      hideDialogue();
      hideDebrief();
    }
  });

  // 5. Set Initial State
  updateHudScore(0);
  updateHudTitle(waypoints[0].name);
  highlightCurrentStop(0);
});
