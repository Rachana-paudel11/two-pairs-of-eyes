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

// ─── 1. Load scenario data ──────────────────────────────────────────────────
import stopsData from './data/stopsData.js';

// ─── 2. Event Bus ───────────────────────────────────────────────────────────
const eventBus = createEventBus();

// ─── 3. Scenario Engine ─────────────────────────────────────────────────────
const engine = new ScenarioEngine({ stopsData, eventBus, interactions });

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

window.__app = { renderer, warehouse, characters, cameraRig, engine };

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

// Wire Login & Authentication Gateway (including Instant Demo / Guest access)
const loginOverlay = document.getElementById('login-screen');
if (loginOverlay) {
  loginOverlay.classList.remove('hidden');
  initLoginScreen((traineeData) => {
    console.log('[AUTH] Access granted:', traineeData);
    window.__app = window.__app || {};
    window.__app.trainee = traineeData;
    launchSimulationIntro();
  });
} else {
  launchSimulationIntro();
}
new UserGuide(eventBus);
new FlagAlert(eventBus);
const minimap = new Minimap(eventBus, engine, characters);

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
