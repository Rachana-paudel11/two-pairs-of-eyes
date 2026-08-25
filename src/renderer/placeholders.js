// Hazard geometry per stop, built using real 3D GLB models.
// Positioned down a continuous 60-meter central warehouse walkway.

export const STOP_POSITIONS = {
  stop_01: { x: 1.5, y: 0, z: -4.0 },
  stop_02: { x: -2.5, y: 0, z: -14.0 },
  stop_03: { x: 2.2, y: 0, z: -24.0 },
  stop_04: { x: -2.0, y: 0, z: -34.0 },
  stop_05: { x: 0.0, y: 0, z: -44.0 }
};

const MODEL_PATHS = {
  oilSpill: '#oil-spill-glb',
  rack2: '#metal-rack-glb',
  wetFloor: '#wet-floor-glb',
  box: '#cardboard-box-glb',
  brokenPallet: '#broken-pallet-glb',
  shelf: '#worn-shelf-glb',
  charger: '#battery-charger-glb',
  palletRacking: '#pallet-racking-glb',
  forklift: '#forklift-glb'
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
  model(entity, MODEL_PATHS.oilSpill, { scale: '0.75 0.75 0.75', position: '0 0 0', rotation: '0 90 0' });
  model(entity, MODEL_PATHS.wetFloor, { scale: '0.7 0.7 0.7', position: '-1.4 0 0.6', rotation: '0 -30 0' });
}

function buildBlindCornerForklift(entity) {
  // 1. 3D Forklift Vehicle at Zone 02 Blind Corner Junction
  model(entity, MODEL_PATHS.forklift, { 
    id: 'forklift-model-entity', 
    scale: '0.85 0.85 0.85', 
    position: '-1.0 0 0', 
    rotation: '0 -90 0', 
    'log-bounds': '' 
  });
  
  // 2. 3D Forklift Driver Operator Character sitting in cabin
  entity.appendChild(el('a-gltf-model', {
    id: 'forklift-driver-character',
    src: './public/assets/models/characters/alex.glb',
    scale: '0.75 0.75 0.75',
    position: '-1.0 0.35 -0.05',
    rotation: '0 90 0'
  }));

  // 3. Floating 3D Driver Operator Indicator Tag
  entity.appendChild(el('a-text', {
    value: 'FORKLIFT OPERATOR',
    position: '-1.0 2.4 0',
    align: 'center',
    width: '3.0',
    color: '#fbbf24',
    font: 'mozillavr'
  }));
  
  // 4. High Cargo Stack on Fork Tines creating sightline hazard
  model(entity, MODEL_PATHS.box, { scale: '0.7 0.7 0.7', position: '-0.2 1.1 0', rotation: '0 10 0' });
  model(entity, MODEL_PATHS.box, { scale: '0.6 0.6 0.6', position: '-0.2 1.6 0.05', rotation: '0 -15 0' });
  
  // 5. Flashing Amber Warning Light Beacon on Canopy
  entity.appendChild(el('a-sphere', { 
    radius: '0.08', 
    color: '#f59e0b', 
    position: '-1.0 2.05 0',
    material: 'emissive: #f59e0b; emissiveIntensity: 1',
    animation: 'property: material.emissiveIntensity; from: 1; to: 0.15; dur: 500; dir: alternate; loop: true'
  }));

  model(entity, MODEL_PATHS.box, { scale: '0.5 0.5 0.5', position: '-1.3 0 0.8', rotation: '0 15 0' });
  model(entity, MODEL_PATHS.box, { scale: '0.4 0.4 0.4', position: '-1.6 0 -0.8', rotation: '0 -20 0' });
}

function buildBentRack(entity) {
  model(entity, MODEL_PATHS.shelf, { scale: '0.55 0.55 0.55', position: '0.9 0 0', rotation: '5 0 -6' });
  model(entity, MODEL_PATHS.brokenPallet, { scale: '0.9 0.9 0.9', position: '-1.6 0 0.7', rotation: '0 25 0' });
  model(entity, MODEL_PATHS.box, { scale: '0.7 0.7 0.7', position: '-1.2 0 -0.6', rotation: '0 10 0' });
}

function buildChargingBay(entity) {
  model(entity, MODEL_PATHS.charger, { scale: '0.5 0.5 0.5', position: '-1.0 0 0', rotation: '0 90 0' });

  entity.appendChild(el('a-sphere', {
    position: '-0.5 1.35 0.15', radius: '0.06', color: '#ffa000',
    material: 'emissive:#ffa000; emissiveIntensity:1',
    animation: 'property:material.emissiveIntensity; from:1; to:0.1; dur:800; dir:alternate; loop:true'
  }));

  model(entity, MODEL_PATHS.box, { scale: '0.7 0.7 0.7', position: '0.2 0 0.3', rotation: '0 10 0' });
  model(entity, MODEL_PATHS.box, { scale: '0.6 0.6 0.6', position: '0.5 0 -0.3', rotation: '0 -15 0' });
}

function buildClearAisle(entity) {
  model(entity, MODEL_PATHS.palletRacking, { scale: '0.9 0.9 0.9', position: '3.8 0 0', rotation: '0 90 0' });
  model(entity, MODEL_PATHS.box, { scale: '0.6 0.6 0.6', position: '3.5 0.78 0.5' });
  model(entity, MODEL_PATHS.box, { scale: '0.6 0.6 0.6', position: '3.5 0.78 -0.3', rotation: '0 15 0' });
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
