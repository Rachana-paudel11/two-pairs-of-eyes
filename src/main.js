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

function boot() {
  const validated = validateStopsData(stopsData, { knownInteractionNames: interactionNames });
  const eventBus = createEventBus();
  const engine = new ScenarioEngine({ stopsData: validated, eventBus, interactions });

  const sceneEl = document.querySelector('a-scene');
  createAframeRenderer({ eventBus, sceneEl });

  eventBus.on('stop:entered', (payload) => console.log('[stop:entered]', payload));
  eventBus.on('dialogue:line', (payload) => console.log('[dialogue:line]', payload));
  eventBus.on('actions:available', (payload) => console.log('[actions:available]', payload));
  eventBus.on('action:resolved', (payload) => console.log('[action:resolved]', payload));
  eventBus.on('consequence:play', (payload) => console.log('[consequence:play]', payload));
  eventBus.on('score:changed', (payload) => console.log('[score:changed]', payload));
  eventBus.on('session:complete', (payload) => console.log('[session:complete]', payload));

  const start = () => engine.start();
  if (sceneEl.hasLoaded) {
    start();
  } else {
    sceneEl.addEventListener('loaded', start, { once: true });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
