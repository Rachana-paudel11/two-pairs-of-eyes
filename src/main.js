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

// Top-level Global for START PATROL button
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
let sessionRoundResults = [];
let hasPromptedAtWaypoint = false;
const HAZARD_PROXIMITY_RADIUS = 4.5;
const STOP_IDS = ['stop_01', 'stop_02', 'stop_03', 'stop_04', 'stop_05'];

// ── UI Elements ─────────────────────────────────────────────────────────────
const btnTalkDave       = document.querySelector('#btn-talk-dave');
const instructionsPanel = document.querySelector('#instructions-panel');
const hudOverlay        = document.querySelector('#hud-overlay');
const controlBar        = document.querySelector('#character-control-bar');
const btnStart          = document.querySelector('#btn-start');
const appLoader         = document.querySelector('#app-loader');
const loadingMessage    = document.querySelector('#loading-message');

function setLoadingState(message, isVisible = true) {
  if (loadingMessage) loadingMessage.textContent = message;
  if (appLoader) {
    appLoader.classList.toggle('hidden', !isVisible);
    appLoader.style.display = isVisible ? 'flex' : 'none';
  }
}

function getPlayerEntity() {
  return document.querySelector('#rig') || document.querySelector('#player-camera');
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
    behaviour: currentDaveBehaviour,
    actions: showMenu ? currentStopActions : [],
    onSelect: handleActionSelect
  });
  playRadioBeep();
  playDaveTalk(4000);
  playAlexTalk(3500);
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

// ── Character Interaction & Action Handlers ─────────────────────────────────
function handleActionSelect(actionKey) {
  if (!currentEngine) return;
  playUiClick();
  const stop = currentEngine.currentStop;
  if (!stop) return;

  // Normalize key if necessary (e.g. 'report' -> 'report_only')
  let normalizedKey = actionKey;
  if (actionKey === 'report' && stop.actions?.report_only) {
    normalizedKey = 'report_only';
  } else if (actionKey === 'report_only' && !stop.actions?.report_only && stop.actions?.report) {
    normalizedKey = 'report';
  }

  const actionDef = stop.actions?.[normalizedKey];
  if (!actionDef) return;

  totalChallengesCount++;
  hideActionMenu();

  try {
    if (currentEngine.machine && currentEngine.machine.state === 'ASSESS') {
      currentEngine.chooseAction(normalizedKey);
    }
  } catch (err) {
    console.warn('[ACTION SELECT ERROR]', err.message);
  }

  // Record round result for debrief
  const existingIdx = sessionRoundResults.findIndex(r => r.stopId === stop?.id);
  const roundItem = {
    stopId: stop?.id || `stop_0${currentWaypointIndex + 1}`,
    actionKey: normalizedKey,
    actionLabel: formatActionLabel(normalizedKey),
    points: actionDef.points ?? 0,
    outcome: actionDef.outcome || 'failure',
    feedback: actionDef.feedback || ''
  };
  if (existingIdx >= 0) {
    sessionRoundResults[existingIdx] = roundItem;
  } else {
    sessionRoundResults.push(roundItem);
  }
}

function talkToDave() {
  if (isMoving) return;
  displaySupervisorDialogue(true);
}

function moveSupervisorTo(index) {
  if (isMoving) return;

  const total = getTotalWaypoints();
  if (index < 0 || index >= total) return;

  isMoving = true;
  currentWaypointIndex = index;
  hasPromptedAtWaypoint = false;
  const target = getWaypoint(index);

  updateHudTitle(target.name);
  updateMissionStatus(index, getTotalWaypoints(), 'Dave & Alex are moving to the next zone…');
  hideDialogue();
  hideActionMenu();

  patrolToWaypoint(target, () => {
    isMoving = false;
    currentDaveDialogue = target.daveDialogue;
    updateMissionStatus(index, getTotalWaypoints(), 'Approach Dave & Alex at the hazard zone');
    promptWhenPlayerArrives();
  });
}

function moveToNextStop() {
  hideDialogue();
  hideActionMenu();

  if (currentEngine && (currentEngine.machine.state === 'FEEDBACK' || currentEngine.machine.state === 'SCORE_UPDATE')) {
    try {
      currentEngine.nextStop();
    } catch (e) {
      console.warn('[ENGINE NEXT STOP]', e.message);
    }
  }

  const nextIndex = currentWaypointIndex + 1;
  if (nextIndex < getTotalWaypoints()) {
    moveSupervisorTo(nextIndex);
  }
}

// ── Keyboard Shortcuts ──────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  
  if (key === 'e') {
    if (!isDialogueOpen()) {
      if (currentEngine && currentEngine.machine.state === 'ASSESS') {
        if (currentEventBus) {
          currentEventBus.emit('state:transition', { 
            state: 'SUPERVISOR_DIALOGUE', 
            stopId: currentEngine.currentStop?.id || 'stop_01' 
          });
        }
      }
      talkToDave();
    }
  } else if (key === ' ' || key === 'enter') {
    // Space or Enter advances if in FEEDBACK / SCORE_UPDATE state
    const continueBtn = document.querySelector('#btn-continue-patrol');
    if (continueBtn && continueBtn.style.display !== 'none') {
      e.preventDefault();
      moveToNextStop();
    }
  } else if (key === 'escape') {
    hideDialogue();
    hideActionMenu();
    hideDebrief();
  }
});

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
  updateHudTitle(getWaypoint(0).name);
  updateMissionStatus(0, getTotalWaypoints());
  currentDaveDialogue = getWaypoint(0).daveDialogue;
  currentDaveBehaviour = 'dismissive';

  stopAlexFollow();
  resetCharacterPositions({ supervisorStart: SUPERVISOR_START, playerStart: PLAYER_START });

  hideDialogue();
  hideActionMenu();
  hideDebrief();
  setLoadingState('Resetting warehouse patrol...');

  hideTitleScreen();
  if (hudOverlay) hudOverlay.style.display = 'flex';
  if (controlBar) controlBar.style.display = 'flex';

  resetHudTimer();
  startHudTimer();

  if (currentEngine && typeof currentEngine.start === 'function') {
    currentEngine.start();
  }
  setTimeout(() => {
    displaySupervisorDialogue(true);
    setLoadingState('Simulation ready', false);
  }, 400);
}

function finishSimulation() {
  playUiClick();
  currentScore = 0;
  totalChallengesCount = 0;
  sessionRoundResults = [];
  currentWaypointIndex = 0;
  isMoving = false;

  updateHudScore(0);
  hideDialogue();
  hideDebrief();

  showTitleScreen();
  if (hudOverlay) hudOverlay.style.display = 'none';
  if (controlBar) controlBar.style.display = 'none';
  stopHudTimer();
  resetHudTimer();

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

  eventBus.on('stop:entered', ({ stop }) => {
    console.log('[stop:entered]', stop.id);
    updateHudTitle(stop.title);
    if (stop.alexStartPosition) {
      setAlexPosition(stop.alexStartPosition);
    }
  });

  eventBus.on('dialogue:line', ({ name, line, behaviour }) => {
    console.log('[dialogue:line]', name, behaviour);
    if (name === 'Dave') {
      currentDaveDialogue = line;
      currentDaveBehaviour = behaviour || 'dismissive';
    }
  });

  eventBus.on('actions:available', (payload) => {
    console.log('[actions:available]', payload);
    currentStopActions = payload.actions || [];

    if (isDialogueOpen()) {
      renderActionMenu({
        actions: currentStopActions,
        stopData: currentEngine?.currentStop,
        onSelect: handleActionSelect
      });
    }
  });

  // State transition event listener (Requirement 2)
  eventBus.on('state:transition', ({ state, stopId }) => {
    console.log('[state:transition]', state, stopId);
    if (state === 'SUPERVISOR_DIALOGUE') {
      displaySupervisorDialogue(true);
    }
  });

  // Hazard mesh clicked in 3D scene → trigger assessment phase
  eventBus.on('hazard:clicked', ({ stopId }) => {
    console.log('[hazard:clicked]', stopId);
    if (isMoving) return;

    eventBus.emit('state:transition', { state: 'SUPERVISOR_DIALOGUE', stopId: stopId || 'stop_01' });
    playUiClick();
    displaySupervisorDialogue(true);
  });

  // Action resolved → animate coworker, update score, reveal continue patrol button
  eventBus.on('action:resolved', (payload) => {
    console.log('[action:resolved]', payload);

    const alexAction = payload.alexAction;
    const targetPosition = payload.alexTargetPosition;
    const alexEl = document.querySelector('#alex');

    // Requirement 4: If 'Cordon Off' selected, trigger animation on coworker entity
    if (payload.actionKey === 'cordon_off' && alexEl) {
      try {
        alexEl.setAttribute('animation-mixer', { clip: 'cordon_off', loop: 'once' });
      } catch (e) {}
    }

    if (alexAction) {
      performAlexAction(alexAction, targetPosition);
    }

    const isOptimal = payload.outcome === 'optimal';
    const isFailure = payload.outcome === 'failure';
    const outcomeLabel = isOptimal ? 'OPTIMAL PROTOCOL (+5 PTS)' : isFailure ? 'UNSAFE SHORTCUT (-3 PTS)' : 'PARTIAL MITIGATION (+3 PTS)';

    if (isFailure) {
      playWarningBuzzer();
    } else {
      playSuccessChime();
    }

    // Render consequence feedback with a clean, high-contrast "CONTINUE TO NEXT ZONE" button
    showDialogue({
      speaker: 'Safety Assessment',
      role: `${outcomeLabel}`,
      avatar: isFailure ? '!' : '✓',
      text: payload.feedback,
      behaviour: isOptimal ? 'correct' : isFailure ? 'dismissive' : 'uncertain'
    });

    // Zone 02: Blind-Corner Forklift Handling
    if (payload.stopId === 'stop_02') {
      const forklift = document.querySelector('#forklift-vehicle');
      if (payload.actionKey === 'hold_position' && forklift) {
        // Pause forklift patrol to show operator safely braked
        forklift.setAttribute('forklift-patrol', 'speed: 0');
      }

      if (payload.actionKey === 'walk_straight_through' || payload.actionKey === 'proceed') {
        // Log near_miss flag to consequences manager
        if (currentEngine?.consequenceState?.flags) {
          currentEngine.consequenceState.flags.add('near_miss');
        }
      }
    }

    // Determine continue prompt label
    const nextZoneNum = (currentWaypointIndex + 2 <= getTotalWaypoints()) ? currentWaypointIndex + 2 : null;
    const continueLabel = (payload.stopId === 'stop_02' || currentWaypointIndex === 1) 
      ? 'CONTINUE TO ZONE 03 →' 
      : (nextZoneNum ? `CONTINUE TO ZONE 0${nextZoneNum} →` : 'COMPLETE SAFETY AUDIT →');

    // Reveal clean, high-contrast rectangular button that says CONTINUE TO ZONE
    const menuContainer = document.querySelector('.dialogue-actions') || document.querySelector('#action-menu');
    if (menuContainer) {
      menuContainer.innerHTML = '';
      menuContainer.style.display = 'flex';

      const continueBtn = document.createElement('button');
      continueBtn.id = 'btn-continue-patrol';
      continueBtn.className = 'btn-dialogue-action start-btn continue-next-zone-btn';
      continueBtn.style.background = '#A3E635';
      continueBtn.style.color = '#0a261a';
      continueBtn.style.fontWeight = '800';
      continueBtn.style.letterSpacing = '1px';
      continueBtn.style.border = '2px solid #bef264';
      continueBtn.style.borderRadius = '8px';
      continueBtn.style.padding = '12px 20px';
      continueBtn.style.width = '100%';
      continueBtn.style.justifyContent = 'center';
      continueBtn.style.cursor = 'pointer';
      continueBtn.style.boxShadow = '0 0 20px rgba(163, 230, 53, 0.4)';
      continueBtn.innerHTML = `
        <span class="key-badge" style="background:#0a261a; color:#A3E635; margin-right:10px; font-weight:700;">SPACE</span>
        <span>${continueLabel}</span>
      `;
      continueBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playUiClick();
        eventBus.emit('stop:continue');
      });
      menuContainer.appendChild(continueBtn);
    }
  });

  eventBus.on('stop:continue', () => {
    console.log('[EVENT] stop:continue emitted -> moving to next hazard zone');
    // Instantly hide the Zone 01 chemical spill puddle
    const staticSpillGroup = document.querySelector('#hazard-fluid-spill-group');
    if (staticSpillGroup) {
      staticSpillGroup.setAttribute('visible', 'false');
      staticSpillGroup.style.display = 'none';
    }
    const fluidSpillMesh = document.querySelector('#fluid-spill-mesh');
    if (fluidSpillMesh) {
      fluidSpillMesh.setAttribute('visible', 'false');
    }
    moveToNextStop();
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
    setTimeout(() => {
      hideDialogue();
      hideActionMenu();
      showDebrief(payload, totalChallengesCount);
    }, 1500);
  });

  return { engine, eventBus };
}

function boot() {
  initHud();
  initDialoguePanel();
  initActionMenu({ onSelect: handleActionSelect });
  initDebrief({ onRestart: restartSimulation, onFinish: finishSimulation });

  const { eventBus, engine } = initEngine();

  const sceneEl = document.querySelector('a-scene');
  createAframeRenderer({ eventBus, sceneEl });
  initCharacterRenderer({
    onDaveClick: talkToDave
  });

  if (btnTalkDave) {
    btnTalkDave.addEventListener('click', talkToDave);
  }

  // Click on the puddle in 3D or reticle interaction
  const puddleEl = document.querySelector('#fluid-spill-mesh');
  if (puddleEl) {
    puddleEl.addEventListener('click', () => {
      eventBus.emit('hazard:clicked', { stopId: 'stop_01' });
    });
  }

  const initGame = () => {
    setLoadingState('Starting inspection sequence...');

    if (instructionsPanel) {
      instructionsPanel.style.display = 'none';
      instructionsPanel.style.visibility = 'hidden';
      instructionsPanel.style.pointerEvents = 'none';
    }
    if (hudOverlay) hudOverlay.style.display = 'flex';
    if (controlBar) controlBar.style.display = 'flex';

    setTimeout(() => {
      try {
        playSuccessChime();
      } catch (e) {}

      try {
        if (currentEngine && typeof currentEngine.start === 'function') {
          resetCharacterPositions({ supervisorStart: SUPERVISOR_START, playerStart: PLAYER_START });
          currentEngine.start();
        }
      } catch (err) {
        console.warn('[ENGINE START]', err.message);
      }

      currentWaypointIndex = 0;
      isMoving = false;
      hasPromptedAtWaypoint = true;
      updateHudTitle(getWaypoint(0).name);
      updateMissionStatus(0, getTotalWaypoints(), 'Review hazard & choose response');

      setTimeout(() => {
        setLoadingState('Simulation ready', false);
        displaySupervisorDialogue(true);
        startProximityMonitor();
      }, 350);
    }, 250);
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
