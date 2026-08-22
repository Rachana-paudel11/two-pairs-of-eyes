// Builds the static environment. warehouse.glb is a genuinely well-modeled
// building (real corrugated siding, dock, roof detail) and is used as-is
// for the front section it actually covers. Its own geometry only spans
// roughly z=+5 to z=-11.7 though, so the rest of the walk is a hand-built
// extension in matching proportions (same width, same wall height, same
// wall tone), lined with real rack models rather than bare primitive walls,
// so the transition reads as one continuous warehouse rather than a model
// bolted onto an empty box.

// warehouse.glb's full bounding box (x -5.3..7.1, z -11.73..5.24, height 3)
// includes exterior loading-dock geometry attached to the outside of the
// building. The real WALKABLE interior is smaller: raycasting straight down
// -Z from inside found a solid interior wall at z=-8.68, not the model's
// outer bound, so the extension starts there instead - otherwise the space
// between the real wall and the assumed seam would be unreachable.
const WAREHOUSE_SEAM_Z = -8.6;
const EXTENSION = {
  minX: -5.3,
  maxX: 7.1,
  frontZ: WAREHOUSE_SEAM_Z,
  backZ: -35,
  wallHeight: 3
};
const CENTER_X = (EXTENSION.minX + EXTENSION.maxX) / 2;
const EXT_DEPTH = EXTENSION.frontZ - EXTENSION.backZ;
const EXT_CENTER_Z = (EXTENSION.frontZ + EXTENSION.backZ) / 2;
const EXT_WIDTH = EXTENSION.maxX - EXTENSION.minX;

function el(tag, attrs = {}) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  return node;
}

AFRAME.registerComponent('log-bounds', {
  init() {
    this.el.addEventListener('model-loaded', () => {
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) return;
      const box = new THREE.Box3().setFromObject(mesh);
      console.log('[WAREHOUSE] MIN:', JSON.stringify(box.min));
      console.log('[WAREHOUSE] MAX:', JSON.stringify(box.max));
    });
  }
});

function buildWarehouseModel(container) {
  container.appendChild(el('a-gltf-model', {
    id: 'warehouse-env', src: '#warehouse-model', position: '0 0 0', 'log-bounds': ''
  }));
}

function buildExtensionShell(container) {
  // One continuous floor across the whole walk (including under the
  // warehouse.glb section) so there's no seam or gap at the model boundary.
  container.appendChild(el('a-plane', {
    id: 'floor', rotation: '-90 0 0', position: `${CENTER_X} -0.01 ${(5.24 + EXTENSION.backZ) / 2}`,
    width: EXT_WIDTH, height: 5.24 - EXTENSION.backZ, color: '#8a7f72',
    shadow: 'receive: true', material: 'roughness: 1; metalness: 0'
  }));

  container.appendChild(el('a-plane', {
    rotation: '-90 0 0', position: `${CENTER_X} 0.001 ${(5.24 + EXTENSION.backZ) / 2}`,
    width: '0.15', height: 5.24 - EXTENSION.backZ, color: '#f9a825', material: 'shader:flat'
  }));

  // Walls/ceiling/roof only for the hand-built extension; warehouse.glb
  // supplies its own for the section it covers.
  container.appendChild(el('a-plane', {
    rotation: '90 0 0', position: `${CENTER_X} ${EXTENSION.wallHeight} ${EXT_CENTER_Z}`,
    width: EXT_WIDTH, height: EXT_DEPTH, color: '#d9d4cb', material: 'roughness: 1; metalness: 0'
  }));
  container.appendChild(el('a-box', {
    id: 'wall-back', position: `${CENTER_X} ${EXTENSION.wallHeight / 2} ${EXTENSION.backZ}`,
    width: EXT_WIDTH, height: EXTENSION.wallHeight, depth: '0.25', color: '#c0b9b0',
    shadow: 'cast: true; receive: true'
  }));
  container.appendChild(el('a-box', {
    id: 'ext-wall-left', position: `${EXTENSION.minX} ${EXTENSION.wallHeight / 2} ${EXT_CENTER_Z}`,
    width: '0.25', height: EXTENSION.wallHeight, depth: EXT_DEPTH, color: '#d3cec5',
    shadow: 'cast: true; receive: true'
  }));
  container.appendChild(el('a-box', {
    id: 'ext-wall-right', position: `${EXTENSION.maxX} ${EXTENSION.wallHeight / 2} ${EXT_CENTER_Z}`,
    width: '0.25', height: EXTENSION.wallHeight, depth: EXT_DEPTH, color: '#d3cec5',
    shadow: 'cast: true; receive: true'
  }));

  for (let z = EXTENSION.frontZ - 2; z > EXTENSION.backZ; z -= 4) {
    container.appendChild(el('a-box', {
      position: `${CENTER_X} ${EXTENSION.wallHeight - 0.15} ${z}`,
      width: EXT_WIDTH - 0.4, height: '0.15', depth: '0.35', color: '#6b4a32'
    }));
  }

  for (let z = EXTENSION.frontZ - 3; z > EXTENSION.backZ; z -= 6) {
    container.appendChild(el('a-box', {
      position: `${EXTENSION.minX + 0.3} ${EXTENSION.wallHeight / 2} ${z}`,
      width: '0.3', height: EXTENSION.wallHeight, depth: '0.3', color: '#c2bcb2'
    }));
    container.appendChild(el('a-box', {
      position: `${EXTENSION.maxX - 0.3} ${EXTENSION.wallHeight / 2} ${z}`,
      width: '0.3', height: EXTENSION.wallHeight, depth: '0.3', color: '#c2bcb2'
    }));
  }
}

// Real rack models lining the extension's walls, alternating sides, so the
// hand-built section reads as furnished warehouse rather than bare walls.
function buildWallRacks(container) {
  const positions = [-13, -19, -25, -31];
  positions.forEach((z, i) => {
    const onLeft = i % 2 === 0;
    const x = onLeft ? EXTENSION.minX + 0.65 : EXTENSION.maxX - 0.65;
    container.appendChild(el('a-gltf-model', {
      src: '#rack2-model', scale: '0.85 0.85 0.85', position: `${x} 0 ${z}`,
      rotation: onLeft ? '0 90 0' : '0 -90 0'
    }));
  });
}

function buildBlindCorner(container) {
  // Wall creating stop_02's blind corner, placed in the extension (not
  // inside warehouse.glb's own interior, whose internal dressing is
  // outside our control) so the player has to round it to see the hazard.
  container.appendChild(el('a-box', {
    id: 'wall-blind-corner',
    position: `-0.8 ${EXTENSION.wallHeight / 2} -11.9`,
    width: '0.25', height: EXTENSION.wallHeight, depth: '4',
    color: '#c2bcb2', material: 'roughness: 1; metalness: 0',
    shadow: 'cast: true; receive: true'
  }));
}

function buildLighting(container) {
  container.appendChild(el('a-light', { type: 'ambient', color: '#ffffff', intensity: '1.0' }));
  container.appendChild(el('a-light', {
    type: 'directional', color: '#fff8e1', intensity: '0.8', position: '0 10 0', castShadow: 'true'
  }));
  for (let z = -4; z > EXTENSION.backZ; z -= 7) {
    container.appendChild(el('a-light', {
      type: 'point', color: '#fffde7', intensity: '0.45', position: `${CENTER_X} 3 ${z}`, distance: '13'
    }));
  }
  container.appendChild(el('a-sky', { color: '#5c6a7a' }));
}

function buildCameraRig(container) {
  const cameraRig = el('a-entity', { id: 'camera-rig', position: '0.9 0 -0.5' });
  const camera = el('a-camera', {
    'wasd-controls': 'acceleration: 25; fly: false',
    'look-controls': 'pointerLockEnabled: true',
    fov: '75',
    near: '0.1'
  });
  camera.appendChild(el('a-ring', {
    color: '#ffffff', 'radius-inner': '0.005', 'radius-outer': '0.009',
    position: '0 0 -0.5', material: 'shader:flat; opacity:0.7; transparent:true'
  }));
  cameraRig.appendChild(camera);
  container.appendChild(cameraRig);
}

export function buildStaticEnvironment(root) {
  const container = el('a-entity', { id: 'static-environment' });
  buildWarehouseModel(container);
  buildExtensionShell(container);
  buildWallRacks(container);
  buildBlindCorner(container);
  buildLighting(container);
  buildCameraRig(container);
  root.appendChild(container);
  return container;
}
