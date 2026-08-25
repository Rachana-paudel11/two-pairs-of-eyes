// Only file allowed to import A-Frame or touch the DOM scene graph.
// Builds the static environment and every stop's hazard props once, then
// subscribes to engine events to reflect the current stop in the scene.
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

let daveEl = null;
let alexEl = null;
let daveIdleClip = 'mixamo.com.001';
let daveWalkClip = 'mixamo.com.001';
let daveTalkClip = 'mixamo.com.001';
let alexWalkClip = 'mixamo.com.001';
let alexIdleClip = 'mixamo.com.001';
let alexTalkClip = 'mixamo.com.001';

export function initCharacterRenderer({ onDaveClick, onAlexClick } = {}) {
  daveEl = document.querySelector('#dave');
  alexEl = document.querySelector('#alex');

  let daveSetupDone = false;
  let alexSetupDone = false;

  function setupDaveAnimations() {
    if (!daveEl || daveSetupDone) return;
    const mesh = daveEl.getObject3D('mesh');
    if (!mesh) return;

    mesh.traverse((node) => {
      if (node.isMesh && node.material) {
        node.material.needsUpdate = true;
      }
    });

    if (mesh.animations && mesh.animations.length > 0) {
      const anims = mesh.animations.map(c => c.name);
      console.log('[ANIMATION] Dave embedded clips found:', anims);
      daveIdleClip = anims.find(n => n === 'mixamo.com.001' || n.toLowerCase().includes('idle')) || anims.find(n => n !== 'mixamo.com') || anims[0];
      daveWalkClip = anims.find(n => n.toLowerCase().includes('walk') || n.toLowerCase().includes('run')) || daveIdleClip;
      daveTalkClip = daveIdleClip;
      playDaveIdle();
    }
    daveSetupDone = true;
  }

  function setupAlexAnimations() {
    if (!alexEl || alexSetupDone) return;
    const mesh = alexEl.getObject3D('mesh');
    if (!mesh) return;

    mesh.traverse((node) => {
      if (node.isMesh && node.material) {
        node.material.needsUpdate = true;
      }
    });

    if (mesh.animations && mesh.animations.length > 0) {
      const anims = mesh.animations.map(c => c.name);
      console.log('[ANIMATION] Alex embedded clips found:', anims);
      alexIdleClip = anims.find(n => n === 'mixamo.com.001' || n.toLowerCase().includes('idle')) || anims.find(n => n !== 'mixamo.com') || anims[0];
      alexWalkClip = anims.find(n => n.toLowerCase().includes('walk') || n.toLowerCase().includes('run')) || alexIdleClip;
      alexTalkClip = alexIdleClip;
      playAlexIdle();
    }
    alexSetupDone = true;
  }

  if (daveEl) {
    if (daveEl.getObject3D('mesh')) setupDaveAnimations();
    daveEl.addEventListener('model-loaded', setupDaveAnimations);
    if (onDaveClick) daveEl.addEventListener('click', onDaveClick);
  }

  if (alexEl) {
    if (alexEl.getObject3D('mesh')) setupAlexAnimations();
    alexEl.addEventListener('model-loaded', setupAlexAnimations);
    if (onAlexClick) alexEl.addEventListener('click', onAlexClick);
  }

  // Periodic check to ensure animations start regardless of load timing
  const retryInterval = setInterval(() => {
    if (daveEl && !daveSetupDone) setupDaveAnimations();
    if (alexEl && !alexSetupDone) setupAlexAnimations();
    if (daveSetupDone && alexSetupDone) clearInterval(retryInterval);
  }, 300);
  setTimeout(() => clearInterval(retryInterval), 4000);
}

export function playDaveIdle() {
  if (daveEl && daveIdleClip) {
    daveEl.setAttribute('animation-mixer', { clip: daveIdleClip, loop: 'repeat', crossFadeDuration: 0.3 });
  }
}

export function playDaveWalk() {
  if (daveEl && daveWalkClip) {
    daveEl.setAttribute('animation-mixer', { clip: daveWalkClip, loop: 'repeat', crossFadeDuration: 0.2 });
  }
}

export function playDaveTalk(durationMs = 4000) {
  if (daveEl && daveTalkClip) {
    daveEl.setAttribute('animation-mixer', { clip: daveTalkClip, loop: 'repeat', crossFadeDuration: 0.2 });
    setTimeout(playDaveIdle, durationMs);
  }
}

export function playAlexIdle() {
  if (alexEl && alexIdleClip) {
    alexEl.setAttribute('animation-mixer', { clip: alexIdleClip, loop: 'repeat', crossFadeDuration: 0.3 });
  }
}

export function playAlexWalk() {
  if (alexEl && alexWalkClip) {
    alexEl.setAttribute('animation-mixer', { clip: alexWalkClip, loop: 'repeat', crossFadeDuration: 0.2 });
  }
}

export function playAlexTalk(durationMs = 4000) {
  if (alexEl && alexTalkClip) {
    alexEl.setAttribute('animation-mixer', { clip: alexTalkClip, loop: 'repeat', crossFadeDuration: 0.2 });
    setTimeout(playAlexIdle, durationMs);
  }
}

export function patrolToWaypoint(waypoint, onArrival) {
  if (!daveEl || !waypoint) return;

  playDaveWalk();
  playAlexWalk();

  // Dave smooth path to exact stop coordinates
  daveEl.setAttribute('animation__move', {
    property: 'position',
    to: waypoint.position,
    dur: 3500,
    easing: 'easeInOutQuad'
  });
  daveEl.setAttribute('animation__rotate', {
    property: 'rotation',
    to: waypoint.rotation,
    dur: 1200,
    easing: 'easeInOutQuad'
  });

  // Alex synchronized path stopping beside Dave
  if (alexEl) {
    const [tx, ty, tz] = waypoint.position.split(' ').map(Number);
    const alexPos = `${(tx - 1.2).toFixed(2)} ${ty} ${(tz - 0.1).toFixed(2)}`;
    alexEl.setAttribute('animation__move', {
      property: 'position',
      to: alexPos,
      dur: 3500,
      easing: 'easeInOutQuad'
    });
    alexEl.setAttribute('animation__rotate', {
      property: 'rotation',
      to: waypoint.rotation,
      dur: 1200,
      easing: 'easeInOutQuad'
    });
  }

  // When characters arrive at the stop, halt movement animations immediately
  setTimeout(() => {
    playDaveIdle();
    playAlexIdle();
    playDaveTalk(4000);
    if (onArrival) onArrival();
  }, 3500);
}

export function resetCharacterPositions(startWaypoint) {
  if (daveEl && startWaypoint) {
    daveEl.setAttribute('position', startWaypoint.position);
    daveEl.setAttribute('rotation', startWaypoint.rotation);
    playDaveIdle();
  }
  if (alexEl && startWaypoint) {
    const [tx, ty, tz] = startWaypoint.position.split(' ').map(Number);
    alexEl.setAttribute('position', `${(tx - 1.1).toFixed(2)} ${ty} ${(tz - 0.2).toFixed(2)}`);
    alexEl.setAttribute('rotation', startWaypoint.rotation);
    playAlexIdle();
  }
}

function buildMarker(stopId, index) {
  const origin = STOP_POSITIONS[stopId];
  if (!origin) return null;
  const marker = el('a-entity', {
    id: `marker-${stopId}`,
    position: `${origin.x} ${origin.y + 0.01} ${origin.z}`,
    visible: 'false'
  });
  marker.appendChild(el('a-circle', {
    radius: '0.55',
    rotation: '-90 0 0',
    material: `color:${MARKER_COLORS[stopId] || '#29b6f6'}; emissive:${MARKER_COLORS[stopId] || '#29b6f6'}; emissiveIntensity:0.6; transparent:true; opacity:0.8`,
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
  let currentHazardEntity = null;

  // Lazy Load active stop hazard to ensure zero clutter, zero overlap, and 60 FPS
  function loadActiveHazard(activeStopId) {
    if (currentHazardEntity && currentHazardEntity.parentNode) {
      currentHazardEntity.parentNode.removeChild(currentHazardEntity);
      currentHazardEntity = null;
    }
    if (activeStopId) {
      const hazard = buildHazardProps(activeStopId);
      if (hazard) {
        hazardsContainer.appendChild(hazard);
        currentHazardEntity = hazard;
      }
    }
  }

  // Build ground target markers once
  stopIds.forEach((stopId, index) => {
    const marker = buildMarker(stopId, index);
    if (marker) markersContainer.appendChild(marker);
  });

  function setActiveStop(activeStopId) {
    loadActiveHazard(activeStopId);
    for (const stopId of stopIds) {
      const marker = markersContainer.querySelector(`#marker-${stopId}`);
      if (marker) {
        marker.setAttribute('visible', stopId === activeStopId);
      }
    }
  }

  // Boot initial Zone 01 hazard on load
  setActiveStop('stop_01');

  if (eventBus) {
    eventBus.on('stop:entered', ({ stop }) => setActiveStop(stop.id));
    eventBus.on('session:complete', () => setActiveStop(null));
  }

  return { hazardsContainer, markersContainer };
}
