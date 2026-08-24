// Hazard geometry per stop, built primarily from real glb models rather
// than flat-colored primitives. Two models in the asset folder render as
// broken/degenerate geometry when loaded (warehouse_storage_racking_fbx_low
// _poly_free.glb and car_charging_point_free_low_poly.glb both render as a
// plain dark sphere) - confirmed by isolated inspection - so they are not
// used anywhere. Primitives remain only where no model can substitute: the
// animated fault-light material, and one small low-contrast anchor plate.
//
// Every glb scale below was derived from measuring each model's actual
// bounding box (scale 1) and solving for a target real-world dimension.
//
// Positions are spatial staging only (not scenario content), so they live
// here rather than in stops.json.
export const STOP_POSITIONS = {
  stop_01: { x: 1.8, y: 0, z: -4 },
  stop_02: { x: -2.6, y: 0, z: -14.4 },
  stop_03: { x: 2.2, y: 0, z: -20.9 },
  stop_04: { x: -1.8, y: 0, z: -26.9 },
  stop_05: { x: 1, y: 0, z: -32.4 }
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

// stop_01 — oil-spill-model is a real barrel-with-puddle asset (not a
// primitive): rotated so the puddle crosses the central walkway. rack2-model
// stands in for "the edge of the racking" the spill runs under, at a small
// scale so it reads as a nearby shelf edge rather than a full bay.
function buildSpill(entity) {
  model(entity, '#oil-spill-model', { scale: '0.7 0.7 0.7', position: '0 0 0', rotation: '0 90 0' });
  model(entity, '#rack2-model', { scale: '0.4 0.4 0.4', position: '1.5 0 -0.5', rotation: '0 90 0' });
  model(entity, '#wet-floor-model', { scale: '0.68 0.68 0.68', position: '-1.6 0 0.8', rotation: '0 -30 0' });
}

// stop_02 — TODO(model): no forklift model exists in the asset set, so the
// chassis stays a primitive; the raised load is real box-model geometry
// (not colored primitives), stacked well above the ~1.6m operator eye line
// so the sightline around the corner is genuinely blocked. The beacon is
// present but deliberately unlit (no emissive).
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

  model(entity, '#box-model', { scale: '1.3 1.3 1.3', position: '1.0 1.85 0', rotation: '0 10 0' });
  model(entity, '#box-model', { scale: '1.15 1.15 1.15', position: '1.05 2.35 0.05', rotation: '0 -15 0' });

  entity.appendChild(el('a-sphere', { radius: '0.09', color: '#5a2020', position: '0.1 2.75 0' }));

  model(entity, '#box-model', { scale: '0.7 0.7 0.7', position: '-0.3 0 1.0', rotation: '0 15 0' });
  model(entity, '#box-model', { scale: '0.6 0.6 0.6', position: '-0.6 0 -1.0', rotation: '0 -20 0' });
}

// stop_03 — worn_warehouse_shelf.glb is a real, already-worn racking model,
// tilted a few degrees to read as structurally deflected rather than built
// from primitive beams. broken-pallet-model and box-model (both real) sit
// on the floor nearby as displaced stock. The anchor plate stays a
// primitive: it must be small and low-contrast so it only reads on close
// inspection, per spec, which a fixed model can't give per-instance.
function buildBentRack(entity) {
  model(entity, '#shelf-model', { scale: '0.515 0.515 0.515', position: '0.9 0 0', rotation: '5 0 -6' });

  box(entity, {
    position: '0.9 0.03 -0.3', width: '0.22', height: '0.02', depth: '0.22', color: '#7a7a72', rotation: '4 0 6'
  });

  model(entity, '#broken-pallet-model', { scale: '0.9 0.9 0.9', position: '-1.6 0 0.7', rotation: '0 25 0' });
  model(entity, '#box-model', { scale: '0.7 0.7 0.7', position: '-1.2 0 -0.6', rotation: '0 10 0' });
  model(entity, '#box-model', { scale: '0.6 0.6 0.6', position: '-1.5 0 -0.9', rotation: '0 -15 0' });
}

// stop_04 — charger-model is a first-pass fit for the unit body (scaled to
// its measured ~1.6m real height), set flush against the left wall. The
// amber sphere stays a primitive: it is the animated fault indicator and
// needs a controllable material. Boxes (real box-model) sit within about a
// metre of the unit, as required by the spec.
function buildChargingBay(entity) {
  model(entity, '#charger-model', { scale: '0.467 0.467 0.467', position: '-1.0 0 0', rotation: '0 90 0' });

  entity.appendChild(el('a-sphere', {
    position: '-0.5 1.35 0.15', radius: '0.06', color: '#ffa000',
    material: 'emissive:#ffa000; emissiveIntensity:1',
    animation: 'property:material.emissiveIntensity; from:1; to:0.1; dur:800; dir:alternate; loop:true'
  }));

  model(entity, '#box-model', { scale: '0.7 0.7 0.7', position: '0.2 0 0.3', rotation: '0 10 0' });
  model(entity, '#box-model', { scale: '0.6 0.6 0.6', position: '0.5 0 -0.3', rotation: '0 -15 0' });
}

// stop_05 — control scenario: hazard.present is false in the data, so no
// hazard geometry is built here. pallet-racking-model (real) sits flush
// against the right wall with stock kept within its shelf heights, so the
// "correct" scene reads as an intact, properly stocked bay rather than an
// empty stub — this is deliberate, not a hazard.
function buildClearAisle(entity) {
  model(entity, '#pallet-racking-model', { scale: '0.9 0.9 0.9', position: '4.2 0 0', rotation: '0 90 0' });
  model(entity, '#box-model', { scale: '0.6 0.6 0.6', position: '3.9 0.78 0.5' });
  model(entity, '#box-model', { scale: '0.6 0.6 0.6', position: '3.9 0.78 -0.3', rotation: '0 15 0' });
  model(entity, '#box-model', { scale: '0.6 0.6 0.6', position: '3.9 1.68 0.2', rotation: '0 -10 0' });
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
