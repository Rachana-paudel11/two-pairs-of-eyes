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
import { ActionMenu } from './ui/ActionMenu.js';
import { Debrief } from './ui/Debrief.js';
import { EmergencyInspectionTour } from './ui/EmergencyInspectionTour.js';
import { StartScreen } from './ui/StartScreen.js';
import { UserGuide } from './ui/UserGuide.js';
import { IntroAnimation } from './ui/IntroAnimation.js';

// ─── 1. Load scenario data ──────────────────────────────────────────────────
// Dynamic import so Vite can tree-shake and the JSON is loaded as a module
import stopsData from './data/stopsData.js';

// ─── 2. Event Bus ───────────────────────────────────────────────────────────
const eventBus = createEventBus();

// ─── 3. Scenario Engine ─────────────────────────────────────────────────────
const engine = new ScenarioEngine({ stopsData, eventBus, interactions });

// ─── 4. Three.js Renderer ───────────────────────────────────────────────────
const canvas = document.getElementById('app');
const renderer = new ThreeRenderer(canvas);

// ─── 5. Scene assets & Intro Sequence ────────────────────────────────────────
const warehouse = new WarehouseScene(renderer.scene);
const characters = new CharacterController(renderer.scene);

const intro = new IntroAnimation();

// ─── 6. Camera rig + transition bridge ──────────────────────────────────────
const cameraRig = new CameraRig(renderer.camera);

// StopTransition wires eventBus → cameraRig + characters
new StopTransition(eventBus, cameraRig, characters, warehouse);

window.__app = { renderer, warehouse, characters, cameraRig, engine };

/**
 * Hold the arriving stop's dialogue and choices until the characters have
 * actually walked there.
 *
 * The engine fires stop:entered, dialogue:line and actions:available in one
 * synchronous tick — it has no concept of a journey, and shouldn't. But the walk
 * between stops covers 8-9.8m and takes several seconds, so those two events
 * would otherwise pop up while Alex and Dave are still mid-aisle.
 *
 * This gate is a thin bus proxy: everything passes straight through except
 * dialogue:line and actions:available, which are queued and released by the
 * renderer's whenSettled(). It lives here because main.js is the composition
 * root — the only place that already knows both the bus and the renderer — so
 * neither the engine nor the UI panels need to learn about walking.
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
      // Leaving a stop invalidates anything still held for it.
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

  bridge('stop:entered'); // always bridged, so the queue is reset even if unused

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
new UserGuide(eventBus);

// ─── 8. Render loop setup ───────────────────────────────────────────────────
let elapsed = 0;
renderer.onUpdate((delta) => {
  elapsed += delta;
  cameraRig.update(delta);
  characters.update(delta, cameraRig);
  warehouse.update(elapsed, delta);
  dialoguePanel.update(renderer.camera, characters.dave);
});

// ─── 9. Play Opening Animation & Preload 3D Scene ────────────────────────────
intro.onComplete(() => {
  startScreen.show();
  renderer.start();
});

intro.play(async () => {
  await Promise.all([
    warehouse.load(),
    characters.load(),
  ]);
});
