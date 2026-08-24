// Builds the static environment. warehouse.glb is a genuinely well-modeled
// building (real corrugated siding, dock, roof detail) and is used as-is.

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

function buildWarehouseModel(container) {
  container.appendChild(el('a-gltf-model', {
    id: 'warehouse-env', 
    src: 'public/assets/models/environment/warehouse.glb', 
    position: '0 0 0', 
    'log-bounds': ''
  }));
}

function buildExtensionShell(container) {
  // One continuous floor across the whole walk
  container.appendChild(el('a-plane', {
    id: 'floor', rotation: '-90 0 0', position: `${CENTER_X} -0.01 ${(5.24 + EXTENSION.backZ) / 2}`,
    width: EXT_WIDTH, height: 5.24 - EXTENSION.backZ, color: '#8a7f72',
    shadow: 'receive: true', material: 'roughness: 1; metalness: 0'
  }));

  container.appendChild(el('a-plane', {
    rotation: '-90 0 0', position: `${CENTER_X} 0.001 ${(5.24 + EXTENSION.backZ) / 2}`,
    width: '0.15', height: 5.24 - EXTENSION.backZ, color: '#f9a825', material: 'shader:flat'
  }));

  // Replace primitive walls with 3D model
  container.appendChild(el('a-gltf-model', {
    id: 'warehouse-extension-env', 
    src: 'public/assets/models/environment/warehouse_building.glb', 
    position: `${CENTER_X} 0 -22`, 
    scale: '1 1 1'
  }));
}

function buildWallRacks(container) {
  const positions = [-13, -19, -25, -31];
  positions.forEach((z, i) => {
    const onLeft = i % 2 === 0;
    const x = onLeft ? EXTENSION.minX + 0.65 : EXTENSION.maxX - 0.65;
    container.appendChild(el('a-gltf-model', {
      src: 'public/assets/models/environment/metal_rack_shelf_2k_textures.glb', 
      scale: '0.85 0.85 0.85', 
      position: `${x} 0 ${z}`,
      rotation: onLeft ? '0 90 0' : '0 -90 0'
    }));
  });
}

function buildBlindCorner(container) {
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
}

export function buildStaticEnvironment(root) {
  const container = el('a-entity', { id: 'static-environment' });
  buildWarehouseModel(container);
  buildExtensionShell(container);
  buildWallRacks(container);
  buildBlindCorner(container);
  buildLighting(container);
  root.appendChild(container);
  return container;
}
