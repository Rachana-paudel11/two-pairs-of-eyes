// Composition root: the only module that knows about all layers
// (engine, renderer, ui). Loads and validates stops.json, wires the engine
// to an event bus, and boots the A-Frame renderer and UI overlays.

import stopsData from './data/stopsData.js';
import { createEventBus } from './engine/eventBus.js';
import { ScenarioEngine } from './engine/scenarioEngine.js';
import { validateStopsData } from './engine/stopsValidator.js';
import { interactions, interactionNames } from './interactions/index.js';
import { 
  createAframeRenderer, 
  initCharacterRenderer, 
  playDaveIdle, 
  playDaveTalk, 
  playAlexIdle, 
  playAlexTalk, 
  patrolToWaypoint, 
  resetCharacterPositions 
} from './renderer/aframeRenderer.js';
import { waypoints, getWaypoint, getTotalWaypoints, createNpc } from './characters/npc.js';
import { startHudTimer, stopHudTimer, resetHudTimer, updateHudScore, updateHudTitle } from './ui/hud.js';
import { initDebrief, showDebrief, hideDebrief } from './ui/debrief.js';
import { playUiClick, playSuccessChime, playRadioBeep } from './utils/audio.js';

// Top-level Emergency Fallback for START PATROL
window.startSimulation = function() {
  const panel = document.querySelector('#instructions-panel');
  const hud = document.querySelector('#hud-overlay');
  const ctrl = document.querySelector('#character-control-bar');
  if (panel) {
    panel.style.display = 'none';
    panel.style.visibility = 'hidden';
    panel.style.pointerEvents = 'none';
  }
  if (hud) hud.style.display = 'flex';
  if (ctrl) ctrl.style.display = 'flex';
};

// ── State ───────────────────────────────────────────────────────────────────
let currentEngine = null;
let currentWaypointIndex = 0;
let isMoving = false;
let isDialogueOpen = false;
let currentDaveDialogue = "People have been walking around it all morning. Someone will clean it later.";
let currentStopActions = [];
let currentScore = 0;
let totalChallengesCount = 0;

// ── Character Data ──────────────────────────────────────────────────────────
const daveData = createNpc({
  name: 'Dave',
  behaviour: 'dismissive',
  dialogue: currentDaveDialogue
});

const alexData = createNpc({
  name: 'Alex',
  behaviour: 'uncertain',
  dialogue: "That overturned barrel has chemical fluid spreading right across the walkway! We must cordon it off!"
});

// ── UI Elements ─────────────────────────────────────────────────────────────
const dialogueBox     = document.querySelector('#dialogue');
const dialogueSpeaker = document.querySelector('#dialogue-speaker');
const dialogueText    = document.querySelector('#dialogue-text');
const dialogueAvatar  = document.querySelector('#dialogue-avatar');
const dialogueRole    = document.querySelector('#dialogue-role');
const dialogueClose   = document.querySelector('#dialogue-close');

const btnAck          = document.querySelector('#btn-dialogue-ack');
const btnChallenge    = document.querySelector('#btn-dialogue-challenge');
const btnTalkDave     = document.querySelector('#btn-talk-dave');
const btnMoveDave     = document.querySelector('#btn-move-dave');
const btnTalkAlex     = document.querySelector('#btn-talk-alex');

const instructionsPanel = document.querySelector('#instructions-panel');
const hudOverlay        = document.querySelector('#hud-overlay');
const controlBar        = document.querySelector('#character-control-bar');
const btnStart          = document.querySelector('#btn-start');

// ── Dialogue Controller ─────────────────────────────────────────────────────
function showDialogue(speaker, role, avatarLetter, text, showActions = false) {
  if (dialogueSpeaker) dialogueSpeaker.textContent = speaker.toUpperCase();
  if (dialogueRole) dialogueRole.textContent = role;
  if (dialogueAvatar) dialogueAvatar.textContent = avatarLetter;
  if (dialogueText) dialogueText.textContent = text;
  if (dialogueBox) dialogueBox.style.display = 'block';

  const actionsEl = document.querySelector('.dialogue-actions');
  if (actionsEl) actionsEl.style.display = showActions ? 'flex' : 'none';

  isDialogueOpen = true;
  playRadioBeep();
}

function hideDialogue() {
  if (dialogueBox) dialogueBox.style.display = 'none';
  isDialogueOpen = false;
}

if (dialogueClose) {
  dialogueClose.addEventListener('click', () => {
    playUiClick();
    hideDialogue();
  });
}

// ── Character Interaction Handlers ──────────────────────────────────────────
function talkToDave() {
  const currentWp = getWaypoint(currentWaypointIndex);
  const text = currentDaveDialogue || currentWp.daveDialogue;
  const hasActions = currentStopActions && currentStopActions.length > 0;
  showDialogue('Dave', 'SUPERVISOR // BAY 04', 'D', text, hasActions);
  playDaveTalk(4000);
}

function talkToAlex() {
  const currentWp = getWaypoint(currentWaypointIndex);
  showDialogue('Alex', 'CO-WORKER // BAY 04', 'A', currentWp.alexDialogue, false);
  playAlexTalk(4000);
}

function advancePatrol() {
  if (isMoving) return;

  const total = getTotalWaypoints();
  if (currentWaypointIndex >= total - 1) {
    showDebrief(currentScore, totalChallengesCount);
    return;
  }

  isMoving = true;
  currentWaypointIndex++;
  const target = getWaypoint(currentWaypointIndex);

  updateHudTitle(target.name);
  showDialogue('Dave', 'SUPERVISOR // BAY 04', 'D', `Advancing patrol to ${target.name}...`, false);

  // Smoothly move the camera rig to follow characters into the new zone
  const cameraRig = document.querySelector('#camera-rig');
  if (cameraRig && target.cameraPosition) {
    cameraRig.setAttribute('animation__cam_move', {
      property: 'position',
      to: target.cameraPosition,
      dur: 3500,
      easing: 'easeInOutQuad'
    });
  }

  patrolToWaypoint(target, () => {
    isMoving = false;
    currentDaveDialogue = target.daveDialogue;
    const hasActions = currentStopActions && currentStopActions.length > 0;
    showDialogue('Dave', 'SUPERVISOR // BAY 04', 'D', target.daveDialogue, hasActions);

    if (currentWaypointIndex === total - 1) {
      setTimeout(() => {
        showDebrief(currentScore, totalChallengesCount);
      }, 4000);
    }
  });
}

function handleAcknowledge() {
  playUiClick();
  if (currentEngine && currentStopActions.includes('ignore')) {
    currentEngine.chooseAction('ignore');
  }
  hideDialogue();
}

function handleChallenge() {
  playSuccessChime();
  totalChallengesCount++;
  currentScore += 5;
  updateHudScore(currentScore);

  if (currentEngine) {
    if (currentStopActions.includes('cordon_off')) {
      currentEngine.chooseAction('cordon_off');
    } else if (currentStopActions.includes('hold')) {
      currentEngine.chooseAction('hold');
    } else if (currentStopActions.includes('report')) {
      currentEngine.chooseAction('report');
    } else if (currentStopActions.length > 0) {
      currentEngine.chooseAction(currentStopActions[0]);
    }
  }

  showDialogue('Safety Notice', 'PROTOCOL COMPLIANCE', '✓', 'Protocol Enforced! Hazard logged & mitigated (+5 pts).', false);
  setTimeout(hideDialogue, 3000);
}

if (btnAck) btnAck.addEventListener('click', handleAcknowledge);
if (btnChallenge) btnChallenge.addEventListener('click', handleChallenge);
if (btnTalkDave) btnTalkDave.addEventListener('click', talkToDave);
if (btnMoveDave) btnMoveDave.addEventListener('click', advancePatrol);
if (btnTalkAlex) btnTalkAlex.addEventListener('click', talkToAlex);

// ── Keyboard Shortcuts ──────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  
  if (key === 'e') {
    talkToDave();
  } else if (key === 't' || key === 'f') {
    talkToAlex();
  } else if (key === ' ' && !isDialogueOpen) {
    e.preventDefault();
    advancePatrol();
  } else if (key === '1' && isDialogueOpen) {
    handleAcknowledge();
  } else if (key === '2' && isDialogueOpen) {
    handleChallenge();
  } else if (key === 'escape') {
    hideDialogue();
    hideDebrief();
  }
});

// ── Simulation Restart Flow ─────────────────────────────────────────────────
function restartSimulation() {
  playUiClick();
  currentScore = 0;
  totalChallengesCount = 0;
  currentWaypointIndex = 0;
  isMoving = false;
  isDialogueOpen = false;

  updateHudScore(0);
  const firstWp = getWaypoint(0);
  updateHudTitle(firstWp.name);
  currentDaveDialogue = firstWp.daveDialogue;
  resetCharacterPositions(firstWp);
  hideDialogue();
  hideDebrief();

  if (instructionsPanel) instructionsPanel.style.display = 'flex';
  if (hudOverlay) hudOverlay.style.display = 'none';
  if (controlBar) controlBar.style.display = 'none';
  stopHudTimer();
  resetHudTimer();
}

// ── Application Boot & Scenario Engine ──────────────────────────────────────
function boot() {
  const validated = validateStopsData(stopsData, { knownInteractionNames: interactionNames });
  const eventBus = createEventBus();
  const engine = new ScenarioEngine({ stopsData: validated, eventBus, interactions });
  currentEngine = engine;

  const sceneEl = document.querySelector('a-scene');
  createAframeRenderer({ eventBus, sceneEl });
  initCharacterRenderer({
    onDaveClick: talkToDave,
    onAlexClick: talkToAlex
  });

  initDebrief({ onRestart: restartSimulation });

  eventBus.on('stop:entered', (payload) => {
    console.log('[stop:entered]', payload);
  });

  eventBus.on('dialogue:line', (payload) => {
    console.log('[dialogue:line]', payload);
    if (payload.name === 'Dave') {
      currentDaveDialogue = payload.line;
    }
  });

  eventBus.on('actions:available', (payload) => {
    console.log('[actions:available]', payload);
    currentStopActions = payload.actions;
  });

  eventBus.on('action:resolved',  (payload) => console.log('[action:resolved]', payload));
  eventBus.on('consequence:play', (payload) => console.log('[consequence:play]', payload));
  
  eventBus.on('score:changed', (payload) => {
    console.log('[score:changed]', payload);
    currentScore = payload.total;
    updateHudScore(payload.total);
  });

  eventBus.on('session:complete', (payload) => {
    console.log('[session:complete]', payload);
    showDebrief(currentScore, totalChallengesCount);
  });

  const initGame = () => {
    // 1. Hide title menu immediately
    const panel = document.querySelector('#instructions-panel');
    const hud = document.querySelector('#hud-overlay');
    const ctrl = document.querySelector('#character-control-bar');

    if (panel) {
      panel.style.display = 'none';
      panel.style.visibility = 'hidden';
      panel.style.pointerEvents = 'none';
    }
    if (hud) hud.style.display = 'flex';
    if (ctrl) ctrl.style.display = 'flex';

    // 2. Play audio & start timers safely
    try {
      playSuccessChime();
    } catch (e) {
      console.warn('Audio chime notice:', e);
    }

    try {
      startHudTimer();
    } catch (e) {
      console.warn('Timer notice:', e);
    }

    try {
      if (engine && typeof engine.start === 'function') {
        engine.start();
      }
    } catch (err) {
      console.warn('[ENGINE START]', err.message);
    }

    setTimeout(() => {
      try {
        talkToDave();
      } catch (e) {
        console.warn('Talk to Dave notice:', e);
      }
    }, 1000);
  };

  window.startSimulation = initGame;

  const btnStartEl = document.querySelector('#btn-start');
  if (btnStartEl) {
    btnStartEl.addEventListener('mouseenter', () => {
      try { playUiClick(); } catch (e) {}
    });
    btnStartEl.addEventListener('click', initGame);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
