// Hazard geometry per stop, built using real 3D GLB models.
// Positioned down a continuous 60-meter central warehouse walkway.

export const STOP_POSITIONS = {
  stop_01: { x: 0, y: 0, z: -4.0 },
  stop_02: { x: 0, y: 0, z: -14.0 },
  stop_03: { x: 0, y: 0, z: -24.0 },
  stop_04: { x: 0, y: 0, z: -34.0 },
  stop_05: { x: 0, y: 0, z: -44.0 }
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
  forklift: '#forklift-glb',
  palletBoxes: '#pallet-boxes-glb',
  deterioratedBoxes: '#deteriorated-boxes-glb'
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
  // ── 1. Left Storage Aisle: 2K Textured Industrial Metal Shelving & Pallet Boxes ──
  model(entity, MODEL_PATHS.rack2, {
    position: '-3.4 0 -1.8',
    scale: '0.65 0.65 0.65',
    rotation: '0 90 0'
  });
  model(entity, MODEL_PATHS.palletBoxes, {
    position: '-3.2 0 0.7',
    scale: '0.85 0.85 0.85',
    rotation: '0 15 0'
  });

  // ── 2. Right Storage Aisle: 2K Textured Storage Shelving & Pallet Stock ──
  model(entity, MODEL_PATHS.rack2, {
    position: '3.4 0 -1.8',
    scale: '0.65 0.65 0.65',
    rotation: '0 -90 0'
  });
  model(entity, MODEL_PATHS.deterioratedBoxes, {
    position: '3.2 0 0.7',
    scale: '0.8 0.8 0.8',
    rotation: '0 -20 0'
  });

  // ── 3. Central Walkway Hazard: High-Quality Textured Oil Spill Container ──
  model(entity, MODEL_PATHS.oilSpill, {
    id: 'tipped-oil-drum',
    class: 'hazard-target clickable',
    'data-stop-id': 'stop_01',
    position: '0.4 0 -1.8',
    scale: '1.1 1.1 1.1',
    rotation: '0 25 0'
  });

  // ── 4. High-Gloss Viscous Chemical Fluid Spreading into Walkway ──
  entity.appendChild(el('a-ellipse', {
    id: 'fluid-spill-mesh',
    class: 'hazard-target clickable',
    'data-stop-id': 'stop_01',
    position: '0.2 0.03 -2.0',
    'radius-x': '1.8',
    'radius-y': '1.3',
    rotation: '-90 20 0',
    material: 'color: #080d0a; roughness: 0.03; metalness: 0.95; opacity: 0.96',
    shadow: 'receive: true'
  }));

  entity.appendChild(el('a-circle', {
    position: '0.35 0.035 -1.9',
    radius: '1.0',
    rotation: '-90 0 0',
    material: 'color: #050806; roughness: 0.02; metalness: 0.98; opacity: 0.92'
  }));

  // ── 5. Real 3D PSX Textured "Caution: Wet Floor" Sign ──
  model(entity, MODEL_PATHS.wetFloor, {
    scale: '0.75 0.75 0.75',
    position: '-1.4 0.02 0.6',
    rotation: '0 -30 0'
  });

  // ── 6. Floating 3D Hazard Inspection HUD Tag ──
  entity.appendChild(el('a-text', {
    value: 'HAZARD: CHEMICAL SPILL',
    position: '0.4 1.2 -1.8',
    align: 'center',
    width: '2.5',
    color: '#ef4444',
    font: 'mozillavr'
  }));
}

function buildBlindCornerForklift(entity) {
  // 0. Perform Zone 02 Spatial Transformations
  if (typeof document !== 'undefined') {
    const spillMesh = document.querySelector('#fluid-spill-mesh') || document.querySelector('#hazard-fluid-spill-group') || document.querySelector('#hazard-stop_01');
    if (spillMesh) spillMesh.setAttribute('visible', 'false');
    const staticSpill = document.querySelector('#hazard-fluid-spill-group');
    if (staticSpill) {
      staticSpill.setAttribute('visible', 'false');
      staticSpill.style.display = 'none';
    }

    const daveEl = document.querySelector('#dave');
    if (daveEl) {
      daveEl.setAttribute('position', '1.5 0 -14');
    }
    const alexEl = document.querySelector('#alex');
    if (alexEl) {
      alexEl.setAttribute('position', '-1.5 0 -14.5');
    }
  }

  // 1. Main Forklift Vehicle Parent Container (Drives between Z = -12 and Z = -26)
  // Note: Parent entity is anchored at Z = -14; local range [2 to -12] translates to world [Z = -12 to Z = -26]
  const forkliftVehicle = el('a-entity', {
    id: 'forklift-vehicle',
    class: 'hazard-target clickable',
    'data-stop-id': 'stop_02',
    position: '2.2 0 2',
    rotation: '0 180 0',
    'forklift-patrol': 'startZ: 2; endZ: -12; speed: 2.5'
  });

  // Forklift Body Model
  model(forkliftVehicle, MODEL_PATHS.forklift, { 
    id: 'forklift-model', 
    scale: '0.85 0.85 0.85', 
    position: '0 0 0', 
    rotation: '0 0 0', 
    'log-bounds': '' 
  });
  
  // 2. Nested Forklift Operator sitting inside the cabin space
  forkliftVehicle.appendChild(el('a-entity', {
    id: 'forklift-operator',
    'gltf-model': '#alex-glb',
    scale: '0.75 0.75 0.75',
    position: '0 0.35 -0.05',
    rotation: '0 180 0',
    'forklift-operator-setup': ''
  }));

  // 3. Floating 3D Driver Operator Indicator Tag
  forkliftVehicle.appendChild(el('a-text', {
    value: 'FORKLIFT OPERATOR',
    position: '0 2.4 0',
    align: 'center',
    width: '3.0',
    color: '#fbbf24',
    font: 'mozillavr'
  }));
  
  // 4. High Cargo Stack on Fork Tines creating sightline hazard
  model(forkliftVehicle, MODEL_PATHS.box, { scale: '0.7 0.7 0.7', position: '0 1.1 0.8', rotation: '0 10 0' });
  model(forkliftVehicle, MODEL_PATHS.box, { scale: '0.6 0.6 0.6', position: '0 1.6 0.85', rotation: '0 -15 0' });
  
  // 5. Flashing Amber Warning Light Beacon on Canopy
  forkliftVehicle.appendChild(el('a-sphere', { 
    radius: '0.08', 
    color: '#f59e0b', 
    position: '0 2.05 0',
    material: 'emissive: #f59e0b; emissiveIntensity: 1',
    animation: 'property: material.emissiveIntensity; from: 1; to: 0.15; dur: 500; dir: alternate; loop: true'
  }));

  entity.appendChild(forkliftVehicle);

  // Peripheral storage bay pallet boxes
  model(entity, MODEL_PATHS.box, { scale: '0.5 0.5 0.5', position: '3.3 0 0.8', rotation: '0 15 0' });
  model(entity, MODEL_PATHS.box, { scale: '0.4 0.4 0.4', position: '3.6 0 -0.8', rotation: '0 -20 0' });
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

  // Root wrapper: tagged so the reticle raycaster (objects: .hazard-target) can hit it
  // and so click-event handlers know which stop was interacted with.
  const entity = el('a-entity', {
    id: `hazard-${stopId}`,
    class: 'hazard-target',
    'data-stop-id': stopId,
    position: `${origin.x} ${origin.y} ${origin.z}`,
    'hazard-interactive': ''
  });

  builder(entity);

  // Also propagate the class to every direct child GLB/mesh element so the
  // cursor raycaster can intersect them and bubble the click up to the root.
  for (const child of entity.children) {
    child.classList.add('hazard-target');
    child.dataset.stopId = stopId;
  }

  return entity;
}
