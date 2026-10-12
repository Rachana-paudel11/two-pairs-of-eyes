/**
 * main.js — Two Pairs of Eyes (Three.js rebuild)
 *
 * Bootstrap order:
 *  1. Load + validate scenario data
 *  2. Create EventBus
 *  3. Create ScenarioEngine (pure logic — no 3D)
 *  4. Create ThreeRenderer (canvas + lighting)
 *  5. Load WarehouseScene + Characters (async, show loader)
 *  6. Create CameraRig + StopTransition (renderer ↔ engine bridge)
 *  7. Wire all UI panels to the event bus
 *  8. Start render loop
 *  9. Start engine (fires first stop:entered event)
 */

import './ui/styles/main.css';
import { createEventBus } from './engine/eventBus.js';
import { ScenarioEngine } from './engine/scenarioEngine.js';
import { interactions } from './interactions/index.js';

import { ThreeRenderer } from './renderer/ThreeRenderer.js';
import { WarehouseScene } from './renderer/WarehouseScene.js';
import { CharacterController } from './renderer/CharacterController.js';
import { CameraRig } from './renderer/CameraRig.js';
import { StopTransition } from './renderer/StopTransition.js';

import { HUD } from './ui/hud.js';
import { DialoguePanel } from './ui/dialoguePanel.js';
import { ActionMenu } from './ui/actionMenu.js';
import { Debrief } from './ui/debrief.js';
import { EmergencyInspectionTour } from './ui/EmergencyInspectionTour.js';
import { StartScreen } from './ui/StartScreen.js';
import { UserGuide } from './ui/UserGuide.js';
import { FlagAlert } from './ui/FlagAlert.js';
import { Minimap } from './ui/Minimap.js';
import { IntroAnimation } from './ui/IntroAnimation.js';
import { initLoginScreen } from './ui/login.js';
import { loadSessionCheckpoint, saveSessionCheckpoint, clearSessionCheckpoint } from './utils/sessionStore.js';

// ─── 1. Load scenario data ──────────────────────────────────────────────────
import stopsData from './data/stopsData.js';
import { ScenarioService } from './services/ScenarioService.js';
import { audioManager } from './utils/audio.js';
import { settingsManager } from './systems/settings-manager.js';
import { SettingsModal } from './ui/SettingsModal.js';
import { PauseModal } from './ui/PauseModal.js';
import { Subtitles } from './ui/Subtitles.js';

// ─── 2. Event Bus ───────────────────────────────────────────────────────────
const eventBus = createEventBus();
audioManager.attachEventBus(eventBus);

// ─── 3. Scenario Engine ─────────────────────────────────────────────────────
const engine = new ScenarioEngine({ stopsData, eventBus, interactions });

// Synchronize with published backend scenarios if available
ScenarioService.loadScenarios().then((synced) => {
  if (synced && engine.stopIndex === -1) {
    engine.setScenarios(synced);
  }
}).catch((err) => console.warn('[ScenarioService] Scenario sync deferred:', err.message));

// ─── 4. Three.js Renderer ───────────────────────────────────────────────────
const canvas = document.getElementById('app');
const renderer = new ThreeRenderer(canvas);

// ─── 5. Scene assets ────────────────────────────────────────────────────────
const warehouse = new WarehouseScene(renderer.scene);
const characters = new CharacterController(renderer.scene);

// ─── 6. Camera rig + transition bridge ──────────────────────────────────────
const cameraRig = new CameraRig(renderer.camera);

// StopTransition wires eventBus → cameraRig + characters
new StopTransition(eventBus, cameraRig, characters, warehouse);

window.__app = { renderer, warehouse, characters, cameraRig, engine, settingsManager };

// ─── 6b. Settings System Bridge ─────────────────────────────────────────────
eventBus.on('settings:graphics:applied', (opts) => {
  renderer.setGraphicsQuality(opts);
});
eventBus.on('settings:controls:applied', (opts) => {
  cameraRig.setSensitivity(opts.mouseSensitivity, opts.invertY);
});
settingsManager.init(eventBus);

/**
 * Hold the arriving stop's dialogue and choices until the characters have
 * actually walked there.
 */
function createArrivalGatedBus(bus, chars) {
  const GATED = new Set(['dialogue:line', 'actions:available']);
  const listeners = new Map();
  const bridged = new Set();
  let queued = [];
  let waiting = false;

  const deliver = (event, payload) => {
    for (const handler of [...(listeners.get(event) ?? [])]) handler(payload);
  };

  const flush = () => {
    waiting = false;
    const pending = queued;
    queued = [];
    for (const item of pending) deliver(item.event, item.payload);
  };

  const bridge = (event) => {
    if (bridged.has(event)) return;
    bridged.add(event);
    bus.on(event, (payload) => {
      if (event === 'stop:entered') {
        queued = [];
        waiting = false;
      }
      if (!GATED.has(event) || chars.isSettled) {
        deliver(event, payload);
        return;
      }
      queued.push({ event, payload });
      if (!waiting) {
        waiting = true;
        chars.whenSettled(flush);
      }
    });
  };

  bridge('stop:entered');

  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      bridge(event);
      return () => listeners.get(event)?.delete(handler);
    },
    off(event, handler) { listeners.get(event)?.delete(handler); },
    subscribe(event, handler) { return this.on(event, handler); },
    unsubscribe(event, handler) { this.off(event, handler); },
    emit(event, payload) { bus.emit(event, payload); },
  };
}

const arrivalBus = createArrivalGatedBus(eventBus, characters);

// ─── 7. UI panels ───────────────────────────────────────────────────────────
new HUD(eventBus);
const dialoguePanel = new DialoguePanel(arrivalBus);
new ActionMenu(arrivalBus, engine);
new Debrief(eventBus);
new EmergencyInspectionTour(eventBus, engine, cameraRig, warehouse);
const startScreen = new StartScreen(eventBus, engine);
startScreen.hideImmediately();

/**
 * Launch the simulation intro sequence & 3D asset preloader (Option A).
 * Preloads warehouse & character models concurrently while displaying the
 * tactical reticle, brand reveal, and initialization checklist.
 */
function launchSimulationIntro() {
  const intro = new IntroAnimation();
  intro.onComplete(() => {
    startScreen.show();
    renderer.start();
  });

  intro.play({
    loadWarehouse: async () => {
      await warehouse.load();
    },
    loadCharacters: async () => {
      await characters.load();
    },
  });
}

// ─── Checkpoint persistence across page reloads ───────────────────────────
eventBus.on('stop:entered', ({ stop }) => {
  const idx = parseInt(stop.id.split('_')[1], 10) - 1;
  saveSessionCheckpoint({ stopIndex: idx >= 0 ? idx : 0 });
});

eventBus.on('score:changed', ({ total, tierCounts, flags }) => {
  saveSessionCheckpoint({
    score: { total, tierCounts },
    flags: flags || []
  });
});

eventBus.on('hud:timer:tick', ({ elapsedSeconds }) => {
  saveSessionCheckpoint({ elapsedSeconds });
});

eventBus.on('session:complete', () => {
  clearSessionCheckpoint();
});

const activeSession = loadSessionCheckpoint();

/**
 * Resumes an in-progress patrol directly at the saved checkpoint upon refresh.
 */
async function resumeActiveSimulation(checkpoint) {
  const resumeOverlay = document.createElement('div');
  resumeOverlay.id = 'resume-session-overlay';
  resumeOverlay.style.cssText = `
    position: fixed; inset: 0; z-index: 10000;
    background: #0f172a;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: var(--font, 'Inter', sans-serif); color: #f8fafc;
    transition: opacity 0.3s ease;
  `;
  const zoneNum = String((checkpoint.stopIndex || 0) + 1).padStart(2, '0');
  resumeOverlay.innerHTML = `
    <div class="resume-spinner" style="width: 44px; height: 44px; border: 3px solid rgba(56, 189, 248, 0.2); border-top-color: #38bdf8; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
    <p style="margin-top: 18px; font-size: 0.95rem; font-weight: 700; letter-spacing: 0.08em; color: #38bdf8; text-transform: uppercase;">Resuming Safety Patrol</p>
    <p style="margin-top: 6px; font-size: 0.82rem; color: #94a3b8;">Restoring Zone ${zoneNum} Location & Progress...</p>
    <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
  `;
  document.body.appendChild(resumeOverlay);

  await Promise.all([warehouse.load(), characters.load()]);
  renderer.start();
  if (checkpoint.elapsedSeconds) {
    eventBus.emit('session:resume:timer', { elapsedSeconds: checkpoint.elapsedSeconds });
  }
  engine.start(checkpoint.stopIndex || 0, checkpoint.score || null, checkpoint.flags || null);

  resumeOverlay.style.opacity = '0';
  setTimeout(() => resumeOverlay.remove(), 350);
}

// Wire Login & Authentication Gateway or direct session resumption
const loginOverlay = document.getElementById('login-screen');
const returnToStart = sessionStorage.getItem('technova_return_to_start') === 'true';
let savedTrainee = null;
try {
  const rawT = sessionStorage.getItem('technova_trainee_session');
  if (rawT) savedTrainee = JSON.parse(rawT);
} catch (_) {}

if (returnToStart) {
  // Direct redirection to the Start Patrol page (from Debrief "Walk Again" or Pause Menu)
  sessionStorage.removeItem('technova_return_to_start');
  if (loginOverlay) loginOverlay.classList.add('hidden');
  window.__app = window.__app || {};
  if (savedTrainee) window.__app.trainee = savedTrainee;
  saveSessionCheckpoint({
    trainee: savedTrainee || { name: 'Alex' },
    stopIndex: 0,
    score: { total: 0, tierCounts: { optimal: 0, partial: 0, failure: 0 } },
    flags: [],
    elapsedSeconds: 0
  });

  Promise.all([warehouse.load(), characters.load()]).then(() => {
    renderer.start();
    startScreen.show();
  });
} else if (activeSession && activeSession.trainee) {
  // Active session exists: bypass login screen and resume directly
  if (loginOverlay) loginOverlay.classList.add('hidden');
  window.__app = window.__app || {};
  window.__app.trainee = activeSession.trainee;
  resumeActiveSimulation(activeSession);
} else {
  // No active session: standard gateway flow
  if (loginOverlay) {
    loginOverlay.classList.remove('hidden');
    initLoginScreen((traineeData) => {
      console.log('[AUTH] Access granted:', traineeData);
      window.__app = window.__app || {};
      window.__app.trainee = traineeData;
      saveSessionCheckpoint({
        trainee: traineeData,
        stopIndex: 0,
        score: { total: 0, tierCounts: { optimal: 0, partial: 0, failure: 0 } },
        flags: [],
        elapsedSeconds: 0
      });
      launchSimulationIntro();
    });
  } else {
    launchSimulationIntro();
  }
}
new UserGuide(eventBus);
new FlagAlert(eventBus);
const minimap = new Minimap(eventBus, engine, characters);
new SettingsModal(eventBus, settingsManager, { cameraRig, characters, renderer });
new PauseModal(eventBus, engine, { cameraRig, characters, renderer, startScreen });
new Subtitles(eventBus, settingsManager);

eventBus.on('ui:open-start-screen', () => {
  startScreen.show();
});

// ─── 8. Render loop setup ───────────────────────────────────────────────────
let elapsed = 0;
renderer.onUpdate((delta) => {
  elapsed += delta;
  cameraRig.update(delta);
  characters.update(delta, cameraRig);
  warehouse.update(elapsed, delta);
  dialoguePanel.update(renderer.camera, characters.dave);
  minimap.update();
});
