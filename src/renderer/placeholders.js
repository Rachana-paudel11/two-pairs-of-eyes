// Hazard geometry per stop, built primarily from real glb models rather
// than flat-colored primitives. Direct file paths are used to guarantee
// reliable asynchronous loading in browser environments.

export const STOP_POSITIONS = {
  stop_01: { x: 1.8, y: 0, z: -4 },
  stop_02: { x: -2.6, y: 0, z: -14.4 },
  stop_03: { x: 2.2, y: 0, z: -20.9 },
  stop_04: { x: -1.8, y: 0, z: -26.9 },
  stop_05: { x: 1, y: 0, z: -32.4 }
};

const MODEL_PATHS = {
  oilSpill: 'public/assets/models/environment/oil_spill_container.glb',
  rack2: 'public/assets/models/environment/metal_rack_shelf_2k_textures.glb',
  wetFloor: 'public/assets/models/environment/psx_wet_floor_sign.glb',
  box: 'public/assets/models/environment/cardboard_box.glb',
  brokenPallet: 'public/assets/models/environment/broken_pallet.glb',
  shelf: 'public/assets/models/environment/worn_warehouse_shelf.glb',
  charger: 'public/assets/models/environment/battery_charger.glb',
  palletRacking: 'public/assets/models/environment/pallet_racking.glb'
};

function el(tag, attrs = {}) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  return node;
}

function box(entity, attrs) {
  entity.appendChild(el('a-box', attrs));
}

function model(entity, src, attrs) {
  entity.appendChild(el('a-gltf-model', { src, ...attrs }));
}

function buildSpill(entity) {
  model(entity, MODEL_PATHS.oilSpill, { scale: '0.7 0.7 0.7', position: '0 0 0', rotation: '0 90 0' });
  model(entity, MODEL_PATHS.rack2, { scale: '0.4 0.4 0.4', position: '1.5 0 -0.5', rotation: '0 90 0' });
  model(entity, MODEL_PATHS.wetFloor, { scale: '0.68 0.68 0.68', position: '-1.6 0 0.8', rotation: '0 -30 0' });
}

function buildBlindCornerForklift(entity) {
  box(entity, {
    position: '0 0.5 0', width: '1.9', height: '1.0', depth: '1.1', color: '#f2c318',
    shadow: 'cast: true', material: 'roughness: 0.6; metalness: 0.2'
  });

  const wheelPositions = [
    [0.65, 0.25, 0.45], [0.65, 0.25, -0.45], [-0.65, 0.25, 0.45], [-0.65, 0.25, -0.45]
  ];
  for (const [x, y, z] of wheelPositions) {
    entity.appendChild(el('a-cylinder', {
      position: `${x} ${y} ${z}`, radius: '0.28', height: '0.22', rotation: '0 0 90',
      color: '#1a1a1a', material: 'roughness: 0.9'
    }));
  }

  box(entity, { position: '1.0 1.15 0.35', width: '0.08', height: '2.3', depth: '0.08', color: '#4a4a4a', material: 'roughness: 0.4; metalness: 0.6' });
  box(entity, { position: '1.0 1.15 -0.35', width: '0.08', height: '2.3', depth: '0.08', color: '#4a4a4a', material: 'roughness: 0.4; metalness: 0.6' });

  model(entity, MODEL_PATHS.box, { scale: '1.3 1.3 1.3', position: '1.0 1.85 0', rotation: '0 10 0' });
  model(entity, MODEL_PATHS.box, { scale: '1.15 1.15 1.15', position: '1.05 2.35 0.05', rotation: '0 -15 0' });

  entity.appendChild(el('a-sphere', { radius: '0.09', color: '#5a2020', position: '0.1 2.75 0' }));

  model(entity, MODEL_PATHS.box, { scale: '0.7 0.7 0.7', position: '-0.3 0 1.0', rotation: '0 15 0' });
  model(entity, MODEL_PATHS.box, { scale: '0.6 0.6 0.6', position: '-0.6 0 -1.0', rotation: '0 -20 0' });
}

function buildBentRack(entity) {
  model(entity, MODEL_PATHS.shelf, { scale: '0.515 0.515 0.515', position: '0.9 0 0', rotation: '5 0 -6' });

  box(entity, {
    position: '0.9 0.03 -0.3', width: '0.22', height: '0.02', depth: '0.22', color: '#7a7a72', rotation: '4 0 6'
  });

  model(entity, MODEL_PATHS.brokenPallet, { scale: '0.9 0.9 0.9', position: '-1.6 0 0.7', rotation: '0 25 0' });
  model(entity, MODEL_PATHS.box, { scale: '0.7 0.7 0.7', position: '-1.2 0 -0.6', rotation: '0 10 0' });
  model(entity, MODEL_PATHS.box, { scale: '0.6 0.6 0.6', position: '-1.5 0 -0.9', rotation: '0 -15 0' });
}

function buildChargingBay(entity) {
  model(entity, MODEL_PATHS.charger, { scale: '0.467 0.467 0.467', position: '-1.0 0 0', rotation: '0 90 0' });

  entity.appendChild(el('a-sphere', {
    position: '-0.5 1.35 0.15', radius: '0.06', color: '#ffa000',
    material: 'emissive:#ffa000; emissiveIntensity:1',
    animation: 'property:material.emissiveIntensity; from:1; to:0.1; dur:800; dir:alternate; loop:true'
  }));

  model(entity, MODEL_PATHS.box, { scale: '0.7 0.7 0.7', position: '0.2 0 0.3', rotation: '0 10 0' });
  model(entity, MODEL_PATHS.box, { scale: '0.6 0.6 0.6', position: '0.5 0 -0.3', rotation: '0 -15 0' });
}

function buildClearAisle(entity) {
  model(entity, MODEL_PATHS.palletRacking, { scale: '0.9 0.9 0.9', position: '4.2 0 0', rotation: '0 90 0' });
  model(entity, MODEL_PATHS.box, { scale: '0.6 0.6 0.6', position: '3.9 0.78 0.5' });
  model(entity, MODEL_PATHS.box, { scale: '0.6 0.6 0.6', position: '3.9 0.78 -0.3', rotation: '0 15 0' });
  model(entity, MODEL_PATHS.box, { scale: '0.6 0.6 0.6', position: '3.9 1.68 0.2', rotation: '0 -10 0' });
}

const BUILDERS = {
  stop_01: buildSpill,
  stop_02: buildBlindCornerForklift,
  stop_03: buildBentRack,
  stop_04: buildChargingBay,
  stop_05: buildClearAisle
};

export function buildHazardProps(stopId) {
  const builder = BUILDERS[stopId];
  if (!builder) {
    throw new Error(`No hazard placeholder builder for stop "${stopId}"`);
  }
  const origin = STOP_POSITIONS[stopId];
  const entity = el('a-entity', { id: `hazard-${stopId}`, position: `${origin.x} ${origin.y} ${origin.z}` });
  builder(entity);
  return entity;
}
