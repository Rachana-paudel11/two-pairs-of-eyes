// ═══════════════════════════════════════════════════════════════════════════════
// Two Pairs of Eyes — Main Composition Root
// Wires the decoupled Headless Engine, 3D Renderer, Characters, and UI Modules
// ═══════════════════════════════════════════════════════════════════════════════

import { initHud, updateHudScore, updateHudTitle, startHudTimer, stopHudTimer } from './ui/hud.js';
import { initDialoguePanel, showDialogue, hideDialogue } from './ui/dialoguePanel.js';
import { initDebrief, showDebrief, hideDebrief } from './ui/debrief.js';
import { waypoints, getWaypoint, getTotalWaypoints } from './characters/npc.js';
import { initSceneLoader, highlightCurrentStop } from './renderer/sceneLoader.js';
import {
  initRenderer,
  playDaveTalk,
  playAlexTalk,
  patrolToWaypoint,
  resetCharacterPositions
} from './renderer/aframeRenderer.js';
import {
  playUiClick,
  playRadioBeep,
  playSuccessChime
} from './utils/audio.js';

// ── Game State ───────────────────────────────────────────────────────────────
let currentScore = 0;
let totalChallengesCount = 0;
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

  if (currentSpeaker === 'Dave') {
    showDialogue('Dave', 'SUPERVISOR // BAY 04', 'D', 'Fair point. Let us follow official protocol and secure the area first.');
    playDaveTalk(3500);
  } else {
    showDialogue('Alex', 'OPERATIVE // CO-WORKER', 'A', 'Great call! Safety rules exist for a reason. Let us report it.');
    playAlexTalk(3500);
  }
  setTimeout(() => {
    isDialogueOpen = false;
    hideDialogue();
  }, 4000);
}

// ── Character Interaction Triggers ───────────────────────────────────────────
function talkToDave() {
  playRadioBeep();
  isDialogueOpen = true;
  currentSpeaker = 'Dave';
  const wp = getWaypoint(currentWaypointIndex);
  showDialogue('Dave', 'SUPERVISOR // BAY 04', 'D', wp.daveDialogue);
  playDaveTalk(4000);
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
