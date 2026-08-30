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

function buildSingleBarrel(parent, { x = 0, y = 0.44, z = 0, color = '#1e3a5f', bandColor = '#eab308', rot = '0 0 0' } = {}) {
  const barrel = el('a-entity', { position: `${x} ${y} ${z}`, rotation: rot });
  // Barrel main body cylinder
  barrel.appendChild(el('a-cylinder', {
    radius: '0.28',
    height: '0.88',
    material: `color: ${color}; roughness: 0.35; metalness: 0.8`,
    shadow: 'cast: true; receive: true'
  }));
  // Steel reinforcing top & bottom rims
  barrel.appendChild(el('a-torus', {
    position: '0 0.24 0',
    radius: '0.285',
    'radius-tubular': '0.012',
    material: 'color: #0f172a; roughness: 0.3; metalness: 0.9'
  }));
  barrel.appendChild(el('a-torus', {
    position: '0 -0.24 0',
    radius: '0.285',
    'radius-tubular': '0.012',
    material: 'color: #0f172a; roughness: 0.3; metalness: 0.9'
  }));
  // Hazard / Caution identification band
  if (bandColor) {
    barrel.appendChild(el('a-cylinder', {
      radius: '0.282',
      height: '0.2',
      material: `color: ${bandColor}; roughness: 0.5; metalness: 0.2`
    }));
  }
  parent.appendChild(barrel);
}

function buildBarrelPallet(parent, { x = 0, y = 0, z = 0, color = '#1e3a5f', bandColor = '#eab308', stacked = false } = {}) {
  const palletGroup = el('a-entity', { position: `${x} ${y} ${z}` });
  // Base wooden pallet slab
  palletGroup.appendChild(el('a-box', {
    position: '0 0.06 0',
    width: '1.25',
    height: '0.12',
    depth: '1.25',
    material: 'color: #855c32; roughness: 0.9'
  }));
  // 4 Industrial Barrels on pallet base
  buildSingleBarrel(palletGroup, { x: -0.32, y: 0.5, z: -0.32, color, bandColor });
  buildSingleBarrel(palletGroup, { x: 0.32, y: 0.5, z: -0.32, color, bandColor });
  buildSingleBarrel(palletGroup, { x: -0.32, y: 0.5, z: 0.32, color, bandColor });
  buildSingleBarrel(palletGroup, { x: 0.32, y: 0.5, z: 0.32, color, bandColor });

  if (stacked) {
    // Upper tier wooden separator pallet
    palletGroup.appendChild(el('a-box', {
      position: '0 0.98 0',
      width: '1.2',
      height: '0.1',
      depth: '1.2',
      material: 'color: #855c32; roughness: 0.9'
    }));
    // 4 Stacked Barrels on upper tier
    buildSingleBarrel(palletGroup, { x: -0.32, y: 1.48, z: -0.32, color, bandColor });
    buildSingleBarrel(palletGroup, { x: 0.32, y: 1.48, z: -0.32, color, bandColor });
    buildSingleBarrel(palletGroup, { x: -0.32, y: 1.48, z: 0.32, color, bandColor });
    buildSingleBarrel(palletGroup, { x: 0.32, y: 1.48, z: 0.32, color, bandColor });
  }

  parent.appendChild(palletGroup);
}

function buildSpill(entity) {
  // ── 1. Left Storage Bay: Chemical & Hazmat Barrel Rows ──
  buildBarrelPallet(entity, { x: -3.2, y: 0, z: -0.8, color: '#1e3a5f', bandColor: '#eab308', stacked: true });
  buildBarrelPallet(entity, { x: -3.2, y: 0, z: -2.3, color: '#ca8a04', bandColor: '#0f172a', stacked: true });
  buildBarrelPallet(entity, { x: -3.2, y: 0, z: -3.8, color: '#1e3a5f', bandColor: '#eab308', stacked: false });

  // ── 2. Right Storage Bay: Oil & Lubricant Barrel Rows ──
  buildBarrelPallet(entity, { x: 3.2, y: 0, z: -0.8, color: '#e4e4e7', bandColor: '#dc2626', stacked: true });
  buildBarrelPallet(entity, { x: 3.2, y: 0, z: -2.3, color: '#18181b', bandColor: '#22c55e', stacked: true });
  buildBarrelPallet(entity, { x: 3.2, y: 0, z: -3.8, color: '#e4e4e7', bandColor: '#dc2626', stacked: false });

  // ── 3. Central Transit Aisle: Overturned Chemical Drum ──
  const tippedDrum = el('a-entity', {
    id: 'tipped-oil-drum',
    class: 'hazard-target clickable',
    'data-stop-id': 'stop_01',
    position: '0.5 0.3 -1.8',
    rotation: '0 35 90'
  });

  // Main Steel Drum Shell
  tippedDrum.appendChild(el('a-cylinder', {
    radius: '0.29',
    height: '0.86',
    material: 'color: #1e3a5f; roughness: 0.35; metalness: 0.85',
    shadow: 'cast: true; receive: true'
  }));

  // Reinforcing Steel Rim Bands
  tippedDrum.appendChild(el('a-torus', {
    radius: '0.295',
    'radius-tubular': '0.012',
    material: 'color: #0f1f33; roughness: 0.3; metalness: 0.9'
  }));
  tippedDrum.appendChild(el('a-torus', {
    position: '0 0.22 0',
    radius: '0.295',
    'radius-tubular': '0.012',
    material: 'color: #0f1f33; roughness: 0.3; metalness: 0.9'
  }));
  tippedDrum.appendChild(el('a-torus', {
    position: '0 -0.22 0',
    radius: '0.295',
    'radius-tubular': '0.012',
    material: 'color: #0f1f33; roughness: 0.3; metalness: 0.9'
  }));

  // Yellow Hazard Warning Decal Band
  tippedDrum.appendChild(el('a-cylinder', {
    radius: '0.292',
    height: '0.2',
    material: 'color: #eab308; roughness: 0.6; metalness: 0.2'
  }));

  // Drum Bung Spout Cap with active leak flow
  tippedDrum.appendChild(el('a-cylinder', {
    position: '0.12 0.43 0',
    radius: '0.04',
    height: '0.03',
    material: 'color: #050806; roughness: 0.1; metalness: 0.9'
  }));

  entity.appendChild(tippedDrum);

  // Standing Reserve Chemical Drum alongside the aisle
  const standingDrum = el('a-entity', {
    position: '1.3 0.44 -1.4'
  });
  standingDrum.appendChild(el('a-cylinder', {
    radius: '0.29',
    height: '0.88',
    material: 'color: #1e3a5f; roughness: 0.35; metalness: 0.85',
    shadow: 'cast: true'
  }));
  standingDrum.appendChild(el('a-torus', {
    rotation: '90 0 0',
    radius: '0.295',
    'radius-tubular': '0.012',
    material: 'color: #0f1f33; roughness: 0.3; metalness: 0.9'
  }));
  standingDrum.appendChild(el('a-cylinder', {
    radius: '0.292',
    height: '0.2',
    material: 'color: #eab308; roughness: 0.6; metalness: 0.2'
  }));
  entity.appendChild(standingDrum);

  // ── 4. Multi-Layer Viscous Dark Fluid Leakage Puddle ──
  // Primary reflective glossy oil puddle (Y=0.03)
  entity.appendChild(el('a-ellipse', {
    id: 'fluid-spill-mesh',
    class: 'hazard-target clickable',
    'data-stop-id': 'stop_01',
    position: '0 0.03 -2',
    'radius-x': '1.9',
    'radius-y': '1.3',
    rotation: '-90 20 0',
    material: 'color: #080d0a; roughness: 0.03; metalness: 0.95; opacity: 0.96',
    shadow: 'receive: true'
  }));

  // Inner dense puddle layer (Y=0.035)
  entity.appendChild(el('a-circle', {
    position: '0.2 0.035 -1.9',
    radius: '1.0',
    rotation: '-90 0 0',
    material: 'color: #050806; roughness: 0.02; metalness: 0.98; opacity: 0.9'
  }));

  // Spatter droplets expanding outward into walkway
  entity.appendChild(el('a-circle', {
    position: '-1.2 0.035 -2.3',
    radius: '0.28',
    rotation: '-90 0 0',
    material: 'color: #080d0a; roughness: 0.04; metalness: 0.95'
  }));
  entity.appendChild(el('a-circle', {
    position: '0.7 0.035 -2.8',
    radius: '0.32',
    rotation: '-90 0 0',
    material: 'color: #080d0a; roughness: 0.04; metalness: 0.95'
  }));
  entity.appendChild(el('a-circle', {
    position: '-0.8 0.035 -1.2',
    radius: '0.22',
    rotation: '-90 0 0',
    material: 'color: #080d0a; roughness: 0.04; metalness: 0.95'
  }));

  // ── 5. Safety Caution Cone & Wet Floor Warning Sign ──
  const cone = el('a-entity', { position: '-1.5 0 -1.6' });
  cone.appendChild(el('a-cone', {
    position: '0 0.35 0',
    'radius-bottom': '0.22',
    'radius-top': '0.04',
    height: '0.7',
    material: 'color: #f97316; roughness: 0.5',
    shadow: 'cast: true'
  }));
  cone.appendChild(el('a-box', {
    position: '0 0.02 0',
    width: '0.44',
    height: '0.04',
    depth: '0.44',
    material: 'color: #ea580c; roughness: 0.6'
  }));
  entity.appendChild(cone);

  // PSX Wet-floor warning sign alongside the spill
  model(entity, MODEL_PATHS.wetFloor, {
    scale: '0.7 0.7 0.7',
    position: '-1.4 0.02 0.6',
    rotation: '0 -30 0'
  });

  // ── 6. Floating 3D Hazard Inspection Tag ──
  entity.appendChild(el('a-text', {
    value: 'HAZARD: CHEMICAL SPILL',
    position: '0.5 0.85 -1.8',
    align: 'center',
    width: '2.2',
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
