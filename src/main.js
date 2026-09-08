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

// ─── 5. Scene assets & Intro Sequence ───────────────────────────────────────
const intro = new IntroAnimation();
const warehouse = new WarehouseScene(renderer.scene);
const characters = new CharacterController(renderer.scene);

// ─── 6. Camera rig + transition bridge ──────────────────────────────────────
const cameraRig = new CameraRig(renderer.camera);

// StopTransition wires eventBus → cameraRig + characters
new StopTransition(eventBus, cameraRig, characters, warehouse);

window.__app = { renderer, warehouse, characters, cameraRig, engine };

// ─── 7. UI panels ───────────────────────────────────────────────────────────
new HUD(eventBus);
const dialoguePanel = new DialoguePanel(eventBus);
new ActionMenu(eventBus, engine);
new Debrief(eventBus);
new EmergencyInspectionTour(eventBus, engine, cameraRig, warehouse);
const startScreen = new StartScreen(eventBus, engine);
new UserGuide(eventBus);

// ─── 8. Render loop ─────────────────────────────────────────────────────────
let elapsed = 0;
renderer.onUpdate((delta) => {
  elapsed += delta;
  cameraRig.update(delta);
  characters.update(delta, cameraRig);
  warehouse.update(elapsed, delta);
  dialoguePanel.update(renderer.camera, characters.dave);
});

// Show main menu and start rendering loop after intro animation finishes
intro.onComplete(() => {
  startScreen.show();
  renderer.start();
});

// Play intro animation sequence while tracking 3D asset preloading in parallel
intro.play({
  loadWarehouse: async () => {
    await warehouse.load();
  },
  loadCharacters: async () => {
    await characters.load();
  },
});
