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

import { HUD } from './ui/HUD.js';
import { DialoguePanel } from './ui/DialoguePanel.js';
import { ActionMenu } from './ui/ActionMenu.js';
import { Debrief } from './ui/Debrief.js';
import { EmergencyDrillModal } from './ui/EmergencyDrillModal.js';

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

// ─── 5. Scene assets (async) ─────────────────────────────────────────────────
showLoader(true);

const warehouse = new WarehouseScene(renderer.scene);
const characters = new CharacterController(renderer.scene);

await Promise.all([
  warehouse.load(),
  characters.load(),
]);

showLoader(false);

// ─── 6. Camera rig + transition bridge ──────────────────────────────────────
const cameraRig = new CameraRig(renderer.camera);

// StopTransition wires eventBus → cameraRig + characters
new StopTransition(eventBus, cameraRig, characters, warehouse);

window.__app = { renderer, warehouse, characters, cameraRig, engine };

// ─── 7. UI panels ───────────────────────────────────────────────────────────
new HUD(eventBus);
new DialoguePanel(eventBus);
new ActionMenu(eventBus, engine);
new Debrief(eventBus);
new EmergencyDrillModal(eventBus, engine);

// ─── 8. Render loop ─────────────────────────────────────────────────────────
let elapsed = 0;
renderer.onUpdate((delta) => {
  elapsed += delta;
  cameraRig.update(delta);
  characters.update(delta, cameraRig);
  warehouse.update(elapsed, delta);
});

renderer.start();

// ─── 9. Start engine ────────────────────────────────────────────────────────
// A brief delay so the first frame renders before the UI fires
setTimeout(() => engine.start(), 200);

// ─── Loader helper ──────────────────────────────────────────────────────────
function showLoader(visible) {
  let el = document.getElementById('loader');
  if (!el && visible) {
    el = document.createElement('div');
    el.id = 'loader';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', 'Loading warehouse...');
    el.style.cssText = `
      position:fixed;inset:0;display:flex;flex-direction:column;
      align-items:center;justify-content:center;background:#0f1117;
      color:#7a8095;font-family:var(--font,sans-serif);font-size:0.9rem;
      letter-spacing:0.1em;text-transform:uppercase;z-index:999;
    `;
    el.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none"
           style="margin-bottom:16px;animation:spin 1s linear infinite">
        <circle cx="20" cy="20" r="16" stroke="#1e2434" stroke-width="4"/>
        <path d="M20 4a16 16 0 0 1 16 16" stroke="#f5a623"
              stroke-width="4" stroke-linecap="round"/>
      </svg>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
      Loading Warehouse…
    `;
    document.body.appendChild(el);
  } else if (el && !visible) {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.4s';
    setTimeout(() => el.remove(), 450);
  }
}
