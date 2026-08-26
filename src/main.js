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
<<<<<<< HEAD
  resetCharacterPositions,
  setActiveStop
} from './renderer/aframeRenderer.js';
import { waypoints, getWaypoint, getTotalWaypoints, createNpc } from './characters/npc.js';
import { initHud, startHudTimer, stopHudTimer, resetHudTimer, updateHudScore, updateHudTitle } from './ui/hud.js';
import { initDialoguePanel, showDialogue, hideDialogue } from './ui/dialoguePanel.js';

// ── Lazy Dynamic Import Loaders (Optimized Memory & Boot Speed) ───────────
let audioModulePromise = null;
function getAudioModule() {
  if (!audioModulePromise) {
    audioModulePromise = import('./utils/audio.js');
  }
  return audioModulePromise;
}

function playUiClick() {
  getAudioModule().then(m => m.playUiClick()).catch(() => {});
}
function playSuccessChime() {
  getAudioModule().then(m => m.playSuccessChime()).catch(() => {});
}
function playRadioBeep() {
  getAudioModule().then(m => m.playRadioBeep()).catch(() => {});
}

let debriefModulePromise = null;
function getDebriefModule() {
  if (!debriefModulePromise) {
    debriefModulePromise = import('./ui/debrief.js');
  }
  return debriefModulePromise;
}

function initDebrief(options) {
  getDebriefModule().then(m => m.initDebrief(options)).catch(err => console.warn('[DEBRIEF LAZY]', err));
}
function showDebrief(score, roundResults = sessionRoundResults, count = totalChallengesCount) {
  getDebriefModule().then(m => m.showDebrief(score, roundResults, count)).catch(err => console.warn('[DEBRIEF LAZY]', err));
}
function hideDebrief() {
  if (debriefModulePromise) {
    debriefModulePromise.then(m => m.hideDebrief()).catch(() => {});
  }
}
function toggleDebrief(score, roundResults = sessionRoundResults, count = totalChallengesCount) {
  getDebriefModule().then(m => m.toggleDebrief(score, roundResults, count)).catch(err => console.warn('[DEBRIEF LAZY]', err));
}
=======
  moveAlexTo,
  setAlexPosition,
  resetCharacterPositions,
  performAlexAction,
  stopAlexFollow
} from './renderer/aframeRenderer.js';
import { waypoints, getWaypoint, getTotalWaypoints, createNpc, SUPERVISOR_START, PLAYER_START } from './characters/npc.js';
import { STOP_POSITIONS } from './renderer/placeholders.js';
import { 
  initHud, 
  startHudTimer, 
  stopHudTimer, 
  resetHudTimer, 
  updateHudScore, 
  updateHudTitle, 
  updateMissionStatus, 
  flashHudScore 
} from './ui/hud.js';
import { initActionMenu, renderActionMenu, hideActionMenu } from './ui/actionMenu.js';
import { initDialoguePanel, showDialogue, hideDialogue, isDialogueOpen } from './ui/dialoguePanel.js';
import { initDebrief, showDebrief, hideDebrief } from './ui/debrief.js';
import { playUiClick, playSuccessChime, playRadioBeep, playWarningBuzzer } from './utils/audio.js';
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)

// Top-level Emergency Fallback for START PATROL
window.startSimulation = function() {
  const panel = document.querySelector('#instructions-panel');
  const hud = document.querySelector('#hud-overlay');
  const ctrl = document.querySelector('#character-control-bar');
  if (panel) {
    panel.style.setProperty('display', 'none', 'important');
    panel.style.setProperty('visibility', 'hidden', 'important');
    panel.style.setProperty('pointer-events', 'none', 'important');
  }
  if (hud) hud.style.display = 'flex';
  if (ctrl) ctrl.style.display = 'flex';
  try { initHud(); } catch (e) {}
  try { startHudTimer(); } catch (e) {}
  try { updateHudScore(currentScore); } catch (e) {}
  try {
    if (currentEngine && typeof currentEngine.start === 'function') {
      currentEngine.start();
    }
  } catch (e) {}
  setTimeout(() => {
    try { talkToDave(); } catch (e) {}
  }, 400);
};

// ── State ───────────────────────────────────────────────────────────────────
let currentEngine = null;
let currentEventBus = null;
let currentWaypointIndex = 0;
let isMoving = false;
let currentDaveDialogue = "People have been walking around it all morning. Someone will clean it later.";
let currentDaveBehaviour = 'dismissive';
let currentStopActions = [];
let currentScore = 0;
let totalChallengesCount = 0;
<<<<<<< HEAD
let sessionRoundResults = [];

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

=======
let hasPromptedAtWaypoint = false;
const HAZARD_PROXIMITY_RADIUS = 3.2;
const STOP_IDS = ['stop_01', 'stop_02', 'stop_03', 'stop_04', 'stop_05'];

// ── UI Elements ─────────────────────────────────────────────────────────────
const btnTalkDave       = document.querySelector('#btn-talk-dave');
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)
const instructionsPanel = document.querySelector('#instructions-panel');
const hudOverlay        = document.querySelector('#hud-overlay');
const controlBar        = document.querySelector('#character-control-bar');
const btnStart          = document.querySelector('#btn-start');
const appLoader         = document.querySelector('#app-loader');
const loadingMessage    = document.querySelector('#loading-message');

<<<<<<< HEAD
=======
function setLoadingState(message, isVisible = true) {
  if (loadingMessage) loadingMessage.textContent = message;
  if (appLoader) {
    appLoader.classList.toggle('hidden', !isVisible);
    appLoader.style.display = isVisible ? 'flex' : 'none';
  }
}

function getPlayerEntity() {
  return document.querySelector('#alex');
}

function getCurrentHazardPosition() {
  const stopId = STOP_IDS[currentWaypointIndex];
  return STOP_POSITIONS[stopId] ?? null;
}

function isPlayerNearHazard() {
  const player = getPlayerEntity();
  const hazard = getCurrentHazardPosition();
  if (!player?.object3D || !hazard || typeof window.THREE === 'undefined') return true;

  const playerPosition = player.object3D.getWorldPosition(new window.THREE.Vector3());
  const hazardPosition = new window.THREE.Vector3(hazard.x, hazard.y, hazard.z);
  return playerPosition.distanceTo(hazardPosition) <= HAZARD_PROXIMITY_RADIUS;
}

function displaySupervisorDialogue(showMenu = true) {
  const currentWp = getWaypoint(currentWaypointIndex);
  const text = currentDaveDialogue || currentWp.daveDialogue;
  const role = `SUPERVISOR // ${currentWp.name.split('//')[0].trim()}`;

  showDialogue({
    speaker: 'Dave',
    role,
    avatar: 'D',
    text,
    behaviour: currentDaveBehaviour
  });
  playRadioBeep();
  playDaveTalk(4000);

  if (showMenu && currentStopActions.length > 0) {
    renderActionMenu({
      actions: currentStopActions,
      stopData: currentEngine?.currentStop,
      onSelect: handleAction
    });
  }
}

function promptWhenPlayerArrives() {
  if (isMoving || isDialogueOpen() || hasPromptedAtWaypoint || !currentStopActions.length) return;
  if (!isPlayerNearHazard()) return;

  hasPromptedAtWaypoint = true;
  updateMissionStatus(currentWaypointIndex, getTotalWaypoints(), 'Review hazard & choose response');
  displaySupervisorDialogue(true);
}

function startProximityMonitor() {
  const check = () => {
    promptWhenPlayerArrives();
    requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}

>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)
// ── Character Interaction Handlers ──────────────────────────────────────────
function handleActionSelect(actionKey) {
  if (!currentEngine) return;
  playUiClick();
  const stop = currentEngine.currentStop;
  const actionDef = stop?.actions?.[actionKey];

  if (currentEngine.machine && currentEngine.machine.state === 'ASSESS') {
    currentEngine.chooseAction(actionKey);

    const existingIdx = sessionRoundResults.findIndex(r => r.stopId === stop?.id);
    const roundItem = {
      stopId: stop?.id || `stop_0${currentWaypointIndex + 1}`,
      actionKey: actionKey,
      actionLabel: actionKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      points: actionDef?.points ?? 0,
      outcome: actionDef?.outcome || 'failure',
      feedback: actionDef?.feedback || ''
    };
    if (existingIdx >= 0) {
      sessionRoundResults[existingIdx] = roundItem;
    } else {
      sessionRoundResults.push(roundItem);
    }

    if (actionDef?.outcome === 'optimal' || actionDef?.outcome === 'partial') {
      totalChallengesCount++;
      playSuccessChime();
    }

    const feedback = actionDef?.feedback || 'Action executed.';
    showDialogue('Safety Notice', 'PROTOCOL EVALUATION', '✓', feedback, [], null);
    setTimeout(() => {
      hideDialogue();
    }, 4000);
  }
}

function talkToDave() {
<<<<<<< HEAD
  const currentWp = getWaypoint(currentWaypointIndex);
  const text = currentDaveDialogue || currentWp.daveDialogue;
  const actions = currentStopActions || [];
  // Render and display action choice buttons inside the dialogue card
  showDialogue('Dave', 'SUPERVISOR', 'D', text, actions, handleActionSelect);
  playDaveTalk(4000);
}

function talkToAlex() {
  const currentWp = getWaypoint(currentWaypointIndex);
  showDialogue('Alex', 'CO-WORKER', 'A', currentWp.alexDialogue, [], null);
  playAlexTalk(4000);
}

function advancePatrol() {
=======
  if (isMoving) return;
  displaySupervisorDialogue(true);
}

function moveSupervisorTo(index) {
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)
  if (isMoving) return;

  if (currentEngine && currentEngine.machine && currentEngine.machine.state === 'ASSESS' && currentEngine.currentStop) {
    const stop = currentEngine.currentStop;
    const actions = stop.actions || {};
    const passiveKey = Object.keys(actions).find(k => actions[k].outcome === 'failure') 
      || Object.keys(actions).find(k => actions[k].outcome === 'partial') 
      || Object.keys(actions)[0];
    if (passiveKey) {
      currentEngine.chooseAction(passiveKey);
    }
  }

  const total = getTotalWaypoints();
  if (index < 0 || index >= total) return;

  isMoving = true;
  currentWaypointIndex = index;
  hasPromptedAtWaypoint = false;
  const target = getWaypoint(index);

  updateHudTitle(target.name);
<<<<<<< HEAD
=======
  updateMissionStatus(index, getTotalWaypoints(), 'Dave is moving to the next zone…');
  hideDialogue();
  hideActionMenu();
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)

  // Stop Alex follow mode during Dave's movement
  stopAlexFollow();

  patrolToWaypoint(target, () => {
    isMoving = false;
    currentDaveDialogue = target.daveDialogue;
<<<<<<< HEAD
    // Show supervisor dialogue ONLY (hazard buttons hidden until Respond at Hazard is clicked)
    showDialogue('Dave', 'SUPERVISOR', 'D', target.daveDialogue, [], null);
=======
    updateMissionStatus(index, getTotalWaypoints(), 'Approach Dave and the hazard zone');
    
    // After Dave arrives, make Alex follow him to the new location
    console.log('[MAIN] Dave arrived, making Alex follow to new location');
    performAlexAction('follow_dave');
    
    promptWhenPlayerArrives();
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)
  });
}

function moveToNextStop() {
  const nextIndex = currentWaypointIndex + 1;
  if (nextIndex < getTotalWaypoints()) {
    moveSupervisorTo(nextIndex);
  }
}

function handleAction(actionKey) {
  if (isMoving) return;
  playUiClick();
<<<<<<< HEAD
  if (currentEngine && currentEngine.currentStop) {
    const stop = currentEngine.currentStop;
    const actions = stop.actions || {};
    // Find passive/failure action or fall back to last action key
    const passiveKey = Object.keys(actions).find(k => actions[k].outcome === 'failure') 
      || Object.keys(actions).find(k => actions[k].outcome === 'partial') 
      || Object.keys(actions)[0];
    
    if (passiveKey && currentEngine.machine.state === 'ASSESS') {
      currentEngine.chooseAction(passiveKey);
    }
  }
  hideDialogue();
}

function handleChallenge() {
  playSuccessChime();
  if (currentEngine && currentEngine.currentStop) {
    const stop = currentEngine.currentStop;
    const actions = stop.actions || {};
    // Find optimal action key (e.g. cordon_off, hold_position, continue_on)
    const optimalKey = Object.keys(actions).find(k => actions[k].outcome === 'optimal') 
      || Object.keys(actions)[0];
    
    if (optimalKey && currentEngine.machine.state === 'ASSESS') {
      const actionDef = actions[optimalKey];
      currentEngine.chooseAction(optimalKey);
      totalChallengesCount++;
      showDialogue(
        'Safety Notice', 
        'PROTOCOL COMPLIANCE', 
        '✓', 
        actionDef?.feedback || 'Protocol Enforced! Hazard logged & mitigated.', 
        false
      );
      setTimeout(hideDialogue, 3000);
      return;
    }
  }
  hideDialogue();
}

const hudScoreCard = document.querySelector('.hud-score-card');
if (hudScoreCard) {
  hudScoreCard.setAttribute('title', 'Click or press Tab/M to view mid-patrol scorecard');
  hudScoreCard.addEventListener('click', () => {
    playUiClick();
    toggleDebrief(currentScore, totalChallengesCount);
  });
}

if (btnAck) btnAck.addEventListener('click', handleAcknowledge);
if (btnChallenge) btnChallenge.addEventListener('click', handleChallenge);
if (btnTalkDave) btnTalkDave.addEventListener('click', talkToDave);
if (btnMoveDave) btnMoveDave.addEventListener('click', advancePatrol);
=======
  if (!currentEngine) return;

  if (!currentStopActions.includes(actionKey)) return;

  totalChallengesCount++;
  hideActionMenu();

  try {
    currentEngine.chooseAction(actionKey);
  } catch (err) {
    console.warn('[ACTION ERROR]', err.message);
  }
}

if (btnTalkDave) {
  btnTalkDave.addEventListener('click', talkToDave);
}
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)

// ── Keyboard Shortcuts ──────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  
  if (key === 'e') {
<<<<<<< HEAD
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
  } else if (key === 'm' || key === 'tab') {
    e.preventDefault();
    playUiClick();
    toggleDebrief(currentScore, totalChallengesCount);
=======
    if (!isDialogueOpen()) {
      talkToDave();
    }
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)
  } else if (key === 'escape') {
    hideDialogue();
    hideActionMenu();
    hideDebrief();
  }
});

let currentEventBus = null;

function hideTitleScreen() {
  const panel = document.querySelector('#instructions-panel');
  if (panel) {
    panel.style.setProperty('display', 'none', 'important');
    panel.style.setProperty('visibility', 'hidden', 'important');
    panel.style.setProperty('pointer-events', 'none', 'important');
  }
}

function showTitleScreen() {
  const panel = document.querySelector('#instructions-panel');
  if (panel) {
    panel.style.setProperty('display', 'flex', 'important');
    panel.style.setProperty('visibility', 'visible', 'important');
    panel.style.setProperty('pointer-events', 'auto', 'important');
  }
}

// ── Simulation Restart & Finish Flow ─────────────────────────────────────────
function restartSimulation() {
  playUiClick();
  currentScore = 0;
  totalChallengesCount = 0;
  sessionRoundResults = [];
  currentWaypointIndex = 0;
  isMoving = false;
  hasPromptedAtWaypoint = false;
  currentStopActions = [];

  if (currentEventBus) {
    const validated = validateStopsData(stopsData, { knownInteractionNames: interactionNames });
    currentEngine = new ScenarioEngine({ stopsData: validated, eventBus: currentEventBus, interactions });
  }

  updateHudScore(0);
<<<<<<< HEAD
  const firstWp = getWaypoint(0);
  updateHudTitle(firstWp.name);
  currentDaveDialogue = firstWp.daveDialogue;
  resetCharacterPositions(firstWp);

  const cameraRig = document.querySelector('#camera-rig');
  if (cameraRig) {
    cameraRig.removeAttribute('animation__cam_move');
    if (firstWp.cameraPosition) {
      cameraRig.setAttribute('position', firstWp.cameraPosition);
    }
  }

  // Explicitly render Stop 01 hazard props in 3D environment
  setActiveStop('stop_01');

=======
  updateHudTitle(getWaypoint(0).name);
  updateMissionStatus(0, getTotalWaypoints());
  currentDaveDialogue = getWaypoint(0).daveDialogue;
  currentDaveBehaviour = 'dismissive';

  // Stop Alex behavior mode
  stopAlexFollow();
  
  resetCharacterPositions({ supervisorStart: SUPERVISOR_START, playerStart: PLAYER_START });
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)
  hideDialogue();
  hideActionMenu();
  hideDebrief();
  setLoadingState('Resetting warehouse patrol...');

  // Hide Title Screen & show HUD/controls
  hideTitleScreen();
  if (hudOverlay) hudOverlay.style.display = 'flex';
  if (controlBar) controlBar.style.display = 'flex';

  resetHudTimer();
  startHudTimer();

  // Start scenario engine & show supervisor dialogue (action buttons stay hidden until Respond at Hazard is clicked)
  if (currentEngine && typeof currentEngine.start === 'function') {
    currentEngine.start();
  }
  showDialogue('Dave', 'SUPERVISOR', 'D', firstWp.daveDialogue, [], null);
}

function finishSimulation() {
  playUiClick();
  currentScore = 0;
  totalChallengesCount = 0;
  sessionRoundResults = [];
  currentWaypointIndex = 0;
  isMoving = false;
  isDialogueOpen = false;

  if (currentEventBus) {
    const validated = validateStopsData(stopsData, { knownInteractionNames: interactionNames });
    currentEngine = new ScenarioEngine({ stopsData: validated, eventBus: currentEventBus, interactions });
  }

  updateHudScore(0);
  const firstWp = getWaypoint(0);
  updateHudTitle(firstWp.name);
  currentDaveDialogue = firstWp.daveDialogue;
  resetCharacterPositions(firstWp);

  const cameraRig = document.querySelector('#camera-rig');
  if (cameraRig) {
    cameraRig.removeAttribute('animation__cam_move');
    if (firstWp.cameraPosition) {
      cameraRig.setAttribute('position', firstWp.cameraPosition);
    }
  }

  setActiveStop('stop_01');

  hideDialogue();
  hideDebrief();

  // Show Main Title Menu Page & hide HUD
  showTitleScreen();
  if (hudOverlay) hudOverlay.style.display = 'none';
  if (controlBar) controlBar.style.display = 'none';
  stopHudTimer();
  resetHudTimer();

  // Rebuild engine for clean state
  initEngine();

  setTimeout(() => setLoadingState('Simulation ready', false), 300);
}

// ── Application Boot & Scenario Engine ──────────────────────────────────────
function initEngine() {
  const validated = validateStopsData(stopsData, { knownInteractionNames: interactionNames });
  const eventBus = createEventBus();
  currentEventBus = eventBus;
  const engine = new ScenarioEngine({ stopsData: validated, eventBus, interactions });
  currentEngine = engine;
  currentEventBus = eventBus;

  eventBus.on('stop:entered', ({ stop }) => {
    console.log('[stop:entered]', stop.id);
    updateHudTitle(stop.title);
    if (stop.alexStartPosition) {
      setAlexPosition(stop.alexStartPosition);
    }
  });

<<<<<<< HEAD
  initDebrief({ onRestart: restartSimulation, onFinish: finishSimulation });
  initHud();
  initDialoguePanel({ onActionSelect: handleActionSelect });

  eventBus.on('stop:entered', (payload) => {
    console.log('[stop:entered]', payload);
  });

  eventBus.on('dialogue:line', (payload) => {
    console.log('[dialogue:line]', payload);
    if (payload.name === 'Dave') {
      currentDaveDialogue = payload.line;
=======
  eventBus.on('dialogue:line', ({ name, line, behaviour }) => {
    console.log('[dialogue:line]', name, behaviour);
    if (name === 'Dave') {
      currentDaveDialogue = line;
      currentDaveBehaviour = behaviour || 'dismissive';
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)
    }
  });

  eventBus.on('actions:available', (payload) => {
    console.log('[actions:available]', payload);
    currentStopActions = payload.actions || [];

    if (isDialogueOpen()) {
      renderActionMenu({
        actions: currentStopActions,
        stopData: currentEngine?.currentStop,
        onSelect: handleAction
      });
    }
  });

  eventBus.on('action:resolved', (payload) => {
    console.log('[action:resolved]', payload);

    // Handle Alex actions based on the resolved action using the new behavior system
    const alexAction = payload.alexAction;
    const targetPosition = payload.alexTargetPosition;
    
    console.log('[MAIN] Alex action:', alexAction, 'Target position:', targetPosition);
    
    // Use the new performAlexAction function for logical hazard responses
    if (alexAction) {
      performAlexAction(alexAction, targetPosition);
    }

    // Terminal action resolved
    const isOptimal = payload.outcome === 'optimal';
    const isFailure = payload.outcome === 'failure';
    const outcomeLabel = isOptimal ? 'OPTIMAL PROTOCOL' : isFailure ? 'UNSAFE SHORTCUT' : 'PARTIAL MITIGATION';
    const delta = payload.points;
    const pointsBadge = delta > 0 ? `+${delta} PTS` : delta < 0 ? `${delta} PTS` : '0 PTS';

    if (isFailure) {
      playWarningBuzzer();
    } else {
      playSuccessChime();
    }

    showDialogue({
      speaker: 'Safety Assessment',
      role: `${outcomeLabel} // ${pointsBadge}`,
      avatar: isFailure ? '!' : '✓',
      text: payload.feedback,
      behaviour: isOptimal ? 'correct' : isFailure ? 'dismissive' : 'uncertain',
      autoDismissMs: 4000
    });

    const nextIndex = currentWaypointIndex + 1;
    if (nextIndex < getTotalWaypoints()) {
      setTimeout(() => {
        // Stop Alex behavior before moving to next stop
        stopAlexFollow();
        moveToNextStop();
      }, 4100);
    }
  });

  eventBus.on('score:changed', (payload) => {
    console.log('[score:changed]', payload);
    const delta = payload.total - currentScore;
    currentScore = payload.total;
    updateHudScore(payload.total);
    flashHudScore(delta);
  });

  eventBus.on('session:complete', (payload) => {
    console.log('[session:complete]', payload);
<<<<<<< HEAD
    currentScore = payload.total;
    const optimalChallenges = (payload.tierCounts?.optimal || 0) + (payload.tierCounts?.partial || 0);
    showDebrief(payload.total, optimalChallenges);
  });

  const initGame = () => {
    // 1. Hide title menu immediately
    hideTitleScreen();
    const hud = document.querySelector('#hud-overlay');
    const ctrl = document.querySelector('#character-control-bar');

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
=======
    setTimeout(() => {
      hideDialogue();
      hideActionMenu();
      showDebrief(payload, totalChallengesCount);
    }, 2000);
  });

  return { engine, eventBus };
}

function boot() {
  initHud();
  initDialoguePanel();
  initActionMenu({ onSelect: handleAction });
  initDebrief({ onRestart: restartSimulation });

  const { eventBus, engine } = initEngine();

  const sceneEl = document.querySelector('a-scene');
  createAframeRenderer({ eventBus, sceneEl });
  initCharacterRenderer({
    onDaveClick: talkToDave
  });

  const initGame = () => {
    setLoadingState('Starting inspection sequence...');

    if (instructionsPanel) {
      instructionsPanel.style.display = 'none';
      instructionsPanel.style.visibility = 'hidden';
      instructionsPanel.style.pointerEvents = 'none';
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)
    }
    if (hudOverlay) hudOverlay.style.display = 'flex';
    if (controlBar) controlBar.style.display = 'flex';

<<<<<<< HEAD
    const firstWp = getWaypoint(0);
    showDialogue('Dave', 'SUPERVISOR', 'D', firstWp.daveDialogue, [], null);
=======
    setTimeout(() => {
      try {
        playSuccessChime();
      } catch (e) {}

      try {
        startHudTimer();
      } catch (e) {}

      try {
        if (currentEngine && typeof currentEngine.start === 'function') {
          resetCharacterPositions({ supervisorStart: SUPERVISOR_START, playerStart: PLAYER_START });
          currentEngine.start();
          moveSupervisorTo(0);
        }
      } catch (err) {
        console.warn('[ENGINE START]', err.message);
      }

      setTimeout(() => {
        setLoadingState('Simulation ready', false);
        startProximityMonitor();
      }, 500);
    }, 250);
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)
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
