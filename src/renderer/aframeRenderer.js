// Only file allowed to import A-Frame or touch the DOM scene graph.
// Builds the static environment and every stop's hazard props once, then
// subscribes to engine events to reflect the current stop in the scene.
import { buildStaticEnvironment } from './sceneLoader.js';
import { buildHazardProps, STOP_POSITIONS } from './placeholders.js';
import { waypoints, getWaypoint } from '../characters/npc.js';

// Module-level eventBus reference set by createAframeRenderer and read by the
// hazard-interactive A-Frame component.
let _eventBus = null;

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
let alexIdleClip = 'mixamo.com';
let alexTalkClip = 'mixamo.com';

// Alex follow state
let alexFollowMode = false;
let alexFollowOffset = 1.5; // Distance behind Dave
let alexTargetPosition = null;
let alexCurrentVelocity = null;
let followAnimationFrame = null;
let alexBehaviorState = 'idle'; // idle, following, moving_to_target, holding

export const unfreezeCharacter = (entityId) => {
  const el = document.getElementById(entityId);
  if (!el) return;

  const applyClip = () => {
    const model = el.getObject3D('mesh');
    if (model && model.animations && model.animations.length > 0) {
      // Grab whatever the first animation clip name is automatically
      const firstClipName = model.animations[0].name;
      el.setAttribute('animation-mixer', {
        clip: firstClipName,
        loop: 'repeat',
        timeScale: 1
      });
      console.log(`Successfully playing clip "${firstClipName}" for ${entityId}`);
    } else {
      console.warn(`No embedded animation timelines discovered in ${entityId}`);
    }
  };

  if (el.getObject3D('mesh')) {
    applyClip();
  }
  el.addEventListener('model-loaded', applyClip);
};

export function initCharacterRenderer({ onDaveClick, onAlexClick } = {}) {
  daveEl = document.querySelector('#dave');
  alexEl = document.querySelector('#alex');

  unfreezeCharacter('alex');
  unfreezeCharacter('dave');

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
      daveIdleClip = anims.find(n => n === 'mixamo.com.001' || n.toLowerCase().includes('idle')) || anims[0];
      daveWalkClip = anims.find(n => n.toLowerCase().includes('walk') || n.toLowerCase().includes('run')) || daveIdleClip;
      daveTalkClip = anims.find(n => n === 'Talking') || daveIdleClip;
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
      alexIdleClip = anims.find(n => n === 'mixamo.com.001') || anims[0];
      alexWalkClip = anims.find(n => n === 'mixamo.com.001') || anims[0];
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
    alexEl.addEventListener('employee-walk', () => playAlexWalk());
    alexEl.addEventListener('employee-idle', () => playAlexIdle());
    if (onAlexClick) alexEl.addEventListener('click', onAlexClick);
  }

  // Periodic check to ensure animations start regardless of load timing
  const retryInterval = setInterval(() => {
    unfreezeCharacter('alex');
    unfreezeCharacter('dave');
    if (daveEl && !daveSetupDone) setupDaveAnimations();
    if (alexEl && !alexSetupDone) setupAlexAnimations();
    if (daveSetupDone && alexSetupDone) clearInterval(retryInterval);
  }, 300);
  setTimeout(() => clearInterval(retryInterval), 4000);
}

export function playDaveIdle() {
  if (daveEl) {
    const clip = daveIdleClip || 'mixamo.com.001';
    daveEl.setAttribute('animation-mixer', {
      clip: clip,
      loop: 'repeat',
      timeScale: 1,
      crossFadeDuration: 0.4
    });
  }
}

export function playDaveWalk() {
  if (daveEl && daveWalkClip) {
    daveEl.setAttribute('animation-mixer', { clip: daveWalkClip, loop: 'repeat', crossFadeDuration: 0.4 });
  }
}

export function playDaveTalk(durationMs = 4000) {
  if (daveEl && daveTalkClip) {
    daveEl.setAttribute('animation-mixer', { clip: daveTalkClip, loop: 'repeat', crossFadeDuration: 0.4 });
    setTimeout(playDaveIdle, durationMs);
  }
}

export function playAlexIdle() {
  if (!alexEl) return;
  const clip = alexIdleClip || 'mixamo.com';
  alexEl.setAttribute('animation-mixer', {
    clip: clip,
    loop: 'repeat',
    timeScale: 1,
    crossFadeDuration: 0.4
  });
}

export function playAlexWalk() {
  if (alexEl && alexWalkClip) {
    alexEl.setAttribute('animation-mixer', { clip: alexWalkClip, loop: 'repeat', crossFadeDuration: 0.4 });
  }
}

export function playAlexTalk(durationMs = 4000) {
  if (alexEl && alexTalkClip) {
    alexEl.setAttribute('animation-mixer', { clip: alexTalkClip, loop: 'repeat', crossFadeDuration: 0.4 });
    setTimeout(playAlexIdle, durationMs);
  }
}

export function moveAlexTo(targetPos, onArrival) {
  if (!alexEl || !targetPos) return;

  const toStr = typeof targetPos === 'string'
    ? targetPos
    : `${targetPos.x} ${targetPos.y} ${targetPos.z}`;

  // Remove any existing move animation to prevent conflicts
  if (alexEl.hasAttribute('animation__alex_move')) {
    alexEl.removeAttribute('animation__alex_move');
  }

  playAlexWalk();

  alexEl.setAttribute('animation__alex_move', {
    property: 'position',
    to: toStr,
    dur: 2800,
    easing: 'easeInOutQuad'
  });

  setTimeout(() => {
    // Ensure we stop walking when we arrive
    playAlexIdle();
    // Remove the animation attribute to clean up
    if (alexEl.hasAttribute('animation__alex_move')) {
      alexEl.removeAttribute('animation__alex_move');
    }
    if (onArrival) onArrival();
  }, 2800);
}

export function setAlexPosition(pos) {
  if (!alexEl || !pos) return;
  const posStr = typeof pos === 'string' ? pos : `${pos.x} ${pos.y} ${pos.z}`;
  alexEl.setAttribute('position', posStr);
  playAlexIdle();
}

export function patrolToWaypoint(waypoint, onArrival) {
  if (!daveEl || !waypoint) return;

  playDaveWalk();

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

  // When characters arrive at the stop, halt movement animations immediately
  setTimeout(() => {
    playDaveIdle();
    playDaveTalk(4000);
    if (onArrival) onArrival();
  }, 3500);
}

export function resetCharacterPositions({ supervisorStart, playerStart } = {}) {
  if (daveEl && supervisorStart) {
    daveEl.setAttribute('position', supervisorStart.position);
    daveEl.setAttribute('rotation', supervisorStart.rotation);
    playDaveIdle();
  }
  if (alexEl && playerStart) {
    alexEl.setAttribute('position', playerStart.position);
    alexEl.setAttribute('rotation', playerStart.rotation);
    playAlexIdle();
  }
  
  // Reset follow mode and behavior state
  stopAlexFollow();
  alexBehaviorState = 'idle';
}

// Alex behavior system - logical hazard responses
export function startAlexFollow() {
  if (!alexEl || !daveEl) return;
  alexFollowMode = true;
  alexBehaviorState = 'following';
  console.log('[ALEX] Starting follow mode - will stay 1 step behind Dave');
  
  // Disable player controls (human-locomotion) to prevent conflict
  if (alexEl.hasAttribute('human-locomotion')) {
    alexEl.setAttribute('human-locomotion', 'enabled', false);
    console.log('[ALEX] Disabled player controls for follow mode');
  }
  
  // Disable employee-walk-sync to prevent animation conflicts
  if (alexEl.hasAttribute('employee-walk-sync')) {
    alexEl.removeAttribute('employee-walk-sync');
    console.log('[ALEX] Disabled employee-walk-sync for follow mode');
  }
  
  // Start the follow loop
  if (!followAnimationFrame) {
    followAnimationFrame = requestAnimationFrame(updateAlexBehavior);
  }
}

export function stopAlexFollow() {
  alexFollowMode = false;
  alexBehaviorState = 'idle';
  if (followAnimationFrame) {
    cancelAnimationFrame(followAnimationFrame);
    followAnimationFrame = null;
  }
  
  // Re-enable player controls
  if (alexEl) {
    if (alexEl.hasAttribute('human-locomotion')) {
      alexEl.setAttribute('human-locomotion', 'enabled', true);
      console.log('[ALEX] Re-enabled player controls');
    }
    
    // Re-enable employee-walk-sync
    if (!alexEl.hasAttribute('employee-walk-sync')) {
      alexEl.setAttribute('employee-walk-sync', '');
      console.log('[ALEX] Re-enabled employee-walk-sync');
    }
    
    playAlexIdle();
  }
  console.log('[ALEX] Stopping follow mode');
}

// Logical Alex behaviors for hazard scenarios
export function performAlexAction(action, targetPosition = null) {
  if (!alexEl) return;
  
  console.log('[ALEX] Performing action:', action);
  
  // Stop any existing behavior first
  stopAlexFollow();
  
  // Remove any existing animations to prevent conflicts
  if (alexEl.hasAttribute('animation__alex_move')) {
    alexEl.removeAttribute('animation__alex_move');
  }
  
  switch(action) {
    case 'cordon_area':
      // Alex moves to cordon off the hazard area
      alexBehaviorState = 'moving_to_target';
      if (targetPosition) {
        moveAlexTo(targetPosition, () => {
          alexBehaviorState = 'holding';
          playAlexIdle();
          console.log('[ALEX] Area cordoned off, holding position');
        });
      }
      break;
      
    case 'hold_position':
      // Alex stays in current position
      alexBehaviorState = 'holding';
      playAlexIdle();
      console.log('[ALEX] Holding position as instructed');
      break;
      
    case 'move_to_safety':
      // Alex moves to safe position
      alexBehaviorState = 'moving_to_target';
      if (targetPosition) {
        moveAlexTo(targetPosition, () => {
          alexBehaviorState = 'idle';
          playAlexIdle();
          console.log('[ALEX] Moved to safety');
        });
      }
      break;
      
    case 'follow_dave':
      // Alex follows Dave (used when ignoring hazards)
      console.log('[ALEX] Starting follow mode for follow_dave action');
      alexBehaviorState = 'following';
      // Small delay to ensure any previous animations are cleared
      setTimeout(() => {
        startAlexFollow();
      }, 100);
      break;
      
    case 'continue_walk':
      // Alex continues walking to next position
      alexBehaviorState = 'moving_to_target';
      if (targetPosition) {
        moveAlexTo(targetPosition, () => {
          alexBehaviorState = 'idle';
          playAlexIdle();
          console.log('[ALEX] Continuing patrol');
        });
      }
      break;
      
    default:
      console.log('[ALEX] Unknown action:', action);
      alexBehaviorState = 'idle';
      playAlexIdle();
  }
}

function updateAlexBehavior() {
  if (!alexEl || !daveEl) {
    followAnimationFrame = null;
    return;
  }
  
  // Only process follow behavior when in follow mode
  if (alexFollowMode && alexBehaviorState === 'following') {
    // Get A-Frame's THREE from the scene
    const THREE = window.AFRAME?.THREE || window.THREE;
    if (!THREE) {
      console.warn('[ALEX] THREE not available');
      followAnimationFrame = null;
      return;
    }
    
    // Initialize vectors if needed
    if (!alexTargetPosition) alexTargetPosition = new THREE.Vector3();
    
    // Get Dave's current position and rotation
    const davePos = new THREE.Vector3();
    daveEl.object3D.getWorldPosition(davePos);
    
    // Calculate the target position behind Dave based on his facing direction
    const daveDirection = new THREE.Vector3(0, 0, -1);
    daveDirection.applyQuaternion(daveEl.object3D.quaternion);
    daveDirection.normalize();
    
    // Target position is Dave's position minus direction * offset
    alexTargetPosition.copy(davePos).sub(daveDirection.multiplyScalar(alexFollowOffset));
    alexTargetPosition.y = 0; // Keep on ground
    
    // Get Alex's current position
    const alexPos = new THREE.Vector3();
    alexEl.object3D.getWorldPosition(alexPos);
    
    // Calculate distance to target
    const distanceToTarget = alexPos.distanceTo(alexTargetPosition);
    
    // Only move if not already at target (with tolerance)
    if (distanceToTarget > 0.3) {
      // Move Alex towards target using smooth lerp
      const lerpFactor = 0.1; // Faster for more responsive following
      const newPos = alexPos.clone().lerp(alexTargetPosition, lerpFactor);
      
      // Update Alex's position
      alexEl.object3D.position.copy(newPos);
      
      // Make Alex face the same direction as Dave
      alexEl.object3D.quaternion.slerp(daveEl.object3D.quaternion, 0.2);
      
      // Play walk animation
      playAlexWalk();
    } else {
      // Close enough, stop and play idle
      playAlexIdle();
    }
  }
  
  // Continue the loop only if in follow mode
  if (alexFollowMode) {
    followAnimationFrame = requestAnimationFrame(updateAlexBehavior);
  } else {
    followAnimationFrame = null;
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

export let setActiveStop = () => {};

export function createAframeRenderer({ eventBus, sceneEl }) {
  _eventBus = eventBus;

  // ── hazard-interactive component ──────────────────────────────────────────
  // Registered here (inside the module boundary that owns A-Frame) so it only
  // runs in the browser and has closure access to _eventBus.  The component is
  // safe to register multiple times – A-Frame silently skips re-registration.
  if (typeof AFRAME !== 'undefined' && !AFRAME.components['hazard-interactive']) {
    AFRAME.registerComponent('hazard-interactive', {
      init() {
        const hazardEl = this.el;
        const stopId = hazardEl.dataset.stopId ||
                       hazardEl.getAttribute('data-stop-id');

        // Ensure the raycaster cursor can find this element
        hazardEl.classList.add('hazard-target');

        // Visual feedback on hover
        hazardEl.addEventListener('mouseenter', () => {
          hazardEl.querySelectorAll('a-gltf-model, a-sphere, a-box').forEach(child => {
            const mat = child.getAttribute('material') || {};
            if (!child._origEmissive) {
              child._origEmissive = typeof mat === 'object' ? (mat.emissiveIntensity ?? null) : null;
            }
            child.setAttribute('material', 'emissiveIntensity', 1.5);
          });
        });

        hazardEl.addEventListener('mouseleave', () => {
          hazardEl.querySelectorAll('a-gltf-model, a-sphere, a-box').forEach(child => {
            const orig = child._origEmissive;
            child.setAttribute('material', 'emissiveIntensity', orig ?? 0);
          });
        });

        // Click → emit hazard:clicked on the central eventBus
        hazardEl.addEventListener('click', (evt) => {
          evt.stopPropagation();
          const resolvedStopId = stopId ||
            hazardEl.closest('[data-stop-id]')?.dataset.stopId ||
            (evt.target?.closest?.('[data-stop-id]'))?.dataset.stopId;

          console.log('[HAZARD] Clicked stop:', resolvedStopId);

          if (_eventBus && resolvedStopId) {
            _eventBus.emit('hazard:clicked', { stopId: resolvedStopId });
          }
        });
      }
    });
  }
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

  setActiveStop = function(activeStopId) {
    loadActiveHazard(activeStopId);
    for (const stopId of stopIds) {
      const marker = markersContainer.querySelector(`#marker-${stopId}`);
      if (marker) {
        marker.setAttribute('visible', stopId === activeStopId);
      }
    }
  };

  // Boot initial Zone 01 hazard on load
  setActiveStop('stop_01');

  if (eventBus) {
    // ── stop:entered ──────────────────────────────────────────────────────────
    // 1. Swap the hazard mesh for the incoming stop.
    // 2. Move Dave to his authored waypoint position/rotation for the stop.
    //    stop_01 → waypoints[0], stop_02 → waypoints[1], … stop_05 → waypoints[4]
    eventBus.on('stop:entered', ({ stop }) => {
      setActiveStop(stop.id);

      // Derive the 0-based waypoint index from the stop id ("stop_01" → 0)
      const stopIndex = parseInt(stop.id.replace('stop_', ''), 10) - 1;
      const waypoint = getWaypoint(stopIndex);

      if (waypoint) {
        // Animate Dave to the correct patrol position for this stop
        patrolToWaypoint(waypoint, () => {
          console.log('[RENDERER] Dave arrived at', waypoint.name);
        });
      }
    });

    // ── action:resolved ───────────────────────────────────────────────────────
    // Map the engine's semantic alexAction string to:
    //   a) the existing performAlexAction() behaviour (movement / follow logic)
    //   b) an animation-mixer clip change on the Alex entity so the GLB plays
    //      the closest available clip for the action.
    //
    // Clip name mapping (falls back to the idle/walk clips already discovered
    // during initCharacterRenderer's setupAlexAnimations):
    //
    //   cordon_area  → walk clip (Alex moves to cordon)
    //   hold_position → idle clip (Alex stands firm)
    //   move_to_safety → walk clip (Alex walks clear)
    //   follow_dave  → walk clip (Alex follows)
    //   continue_walk → walk clip (Alex continues patrol)
    const ALEX_ACTION_CLIPS = {
      cordon_area:    'walk',   // semantic label resolved below
      hold_position:  'idle',
      move_to_safety: 'walk',
      follow_dave:    'walk',
      continue_walk:  'walk'
    };

    eventBus.on('action:resolved', (result) => {
      const { alexAction, alexTargetPosition, outcome } = result;
      if (!alexAction) return;

      console.log('[RENDERER] action:resolved – alexAction:', alexAction, 'outcome:', outcome);

      // Drive Alex movement/behaviour through the existing system
      performAlexAction(alexAction, alexTargetPosition);

      // Additionally sync the animation-mixer on the Alex entity so the
      // GLB animation reflects the semantic intent of the chosen action.
      if (alexEl) {
        const clipHint = ALEX_ACTION_CLIPS[alexAction] ?? 'idle';
        // alexWalkClip / alexIdleClip are the real discovered clip names;
        // fall back to the string in case the module variable is stale.
        const clip = clipHint === 'walk'
          ? (alexWalkClip || 'mixamo.com.001')
          : (alexIdleClip || 'mixamo.com');

        alexEl.setAttribute('animation-mixer', {
          clip,
          loop: 'repeat',
          crossFadeDuration: 0.35
        });
        console.log('[RENDERER] Alex animation-mixer clip →', clip, '(hint:', clipHint, ')');
      }
    });

    eventBus.on('session:complete', () => setActiveStop(null));
  }

  return { hazardsContainer, markersContainer };
}
