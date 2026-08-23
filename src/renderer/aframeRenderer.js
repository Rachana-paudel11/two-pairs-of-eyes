// Only file allowed to import A-Frame or touch the DOM scene graph.
// Builds the static environment and every stop's hazard props once, then
// subscribes to engine events to reflect the current stop in the scene:
// the numbered marker for the active stop lights up, the rest stay hidden.
// Hazards themselves stay in the world the whole session, so the warehouse
// is walkable end to end and every hazard is identifiable without on-screen
// text, independent of engine progression.
import { buildStaticEnvironment } from './sceneLoader.js';
import { buildHazardProps, STOP_POSITIONS } from './placeholders.js';

const MARKER_COLORS = {
  stop_01: '#29b6f6',
  stop_02: '#ef5350',
  stop_03: '#ff9800',
  stop_04: '#ff9800',
  stop_05: '#66bb6a'
};

function el(tag, attrs = {}) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  return node;
}

function buildMarker(stopId, index) {
  const origin = STOP_POSITIONS[stopId];
  const marker = el('a-entity', {
    id: `marker-${stopId}`,
    position: `${origin.x} ${origin.y + 0.01} ${origin.z}`,
    visible: 'false'
  });
  marker.appendChild(el('a-circle', {
    radius: '0.55',
    rotation: '-90 0 0',
    material: `color:${MARKER_COLORS[stopId]}; emissive:${MARKER_COLORS[stopId]}; emissiveIntensity:0.6; transparent:true; opacity:0.8`,
    animation: 'property:material.opacity; from:0.8; to:0.2; dur:1100; dir:alternate; loop:true'
  }));
  marker.appendChild(el('a-text', {
    value: String(index + 1),
    align: 'center',
    position: '0 0.005 0',
    rotation: '-90 0 0',
    color: '#ffffff',
    width: '3',
    font: 'mozillavr'
  }));
  return marker;
}

export function createAframeRenderer({ eventBus, sceneEl }) {
  const root = sceneEl.querySelector('#scene-content') ?? sceneEl;

  buildStaticEnvironment(root);

  const hazardsContainer = el('a-entity', { id: 'stop-hazards' });
  const markersContainer = el('a-entity', { id: 'stop-markers' });
  root.appendChild(hazardsContainer);
  root.appendChild(markersContainer);

  const stopIds = Object.keys(STOP_POSITIONS);
  stopIds.forEach((stopId, index) => {
    hazardsContainer.appendChild(buildHazardProps(stopId));
    markersContainer.appendChild(buildMarker(stopId, index));
  });

  function setActiveMarker(activeStopId) {
    for (const stopId of stopIds) {
      const marker = markersContainer.querySelector(`#marker-${stopId}`);
      if (marker) {
        marker.setAttribute('visible', stopId === activeStopId);
      }
    }
  }

  eventBus.on('stop:entered', ({ stop }) => setActiveMarker(stop.id));
  eventBus.on('session:complete', () => setActiveMarker(null));

  return { hazardsContainer, markersContainer };
}
