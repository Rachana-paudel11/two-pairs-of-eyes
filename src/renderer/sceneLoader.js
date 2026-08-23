// ── Scene Loader & Dynamic Hazard Orchestrator ───────────────────────────────
// Dynamically manages stop hazard assets, inspection spotlights, and scene setup.

import { createHazardPlaceholder } from './placeholders.js';

let sceneEl = null;
let currentHazardMarker = null;

export function initSceneLoader() {
  sceneEl = document.querySelector('a-scene');
}

export function highlightCurrentStop(stopIndex) {
  // Clear any existing active stop pulsing rings
  const allStops = document.querySelectorAll('[id^="stop-0"]');
  allStops.forEach((el, idx) => {
    const circle = el.querySelector('a-circle');
    if (circle) {
      if (idx === stopIndex) {
        circle.setAttribute('material', 'color: #38bdf8; emissive: #38bdf8; emissiveIntensity: 0.9; opacity: 0.9');
      } else {
        circle.setAttribute('material', 'color: #64748b; emissive: #64748b; emissiveIntensity: 0.3; opacity: 0.5');
      }
    }
  });
}

export function verifyModelLoaded(entityEl, fallbackType = 'spill') {
  if (!entityEl) return;
  entityEl.addEventListener('model-error', (e) => {
    console.warn(`[SCENE LOADER] GLTF model failed on ${entityEl.id}, swapping to procedural placeholder fallback.`, e);
    const placeholder = createHazardPlaceholder(fallbackType);
    entityEl.appendChild(placeholder);
  });
}
