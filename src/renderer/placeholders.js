// ── Asset Placeholders & Geometric Fallbacks ─────────────────────────────────
// Provides primitive 3D geometries (capsules, disks, markers) if GLB assets
// fail to load or when running in low-bandwidth/fallback environments.

export function createCharacterPlaceholder(name, color = '#38bdf8') {
  const container = document.createElement('a-entity');
  container.setAttribute('class', 'character-placeholder');

  // Body capsule
  const body = document.createElement('a-cylinder');
  body.setAttribute('radius', '0.25');
  body.setAttribute('height', '1.4');
  body.setAttribute('position', '0 0.7 0');
  body.setAttribute('color', color);
  body.setAttribute('roughness', '0.7');

  // Head sphere
  const head = document.createElement('a-sphere');
  head.setAttribute('radius', '0.2');
  head.setAttribute('position', '0 1.5 0');
  head.setAttribute('color', '#fed7aa');

  // Safety hard hat
  const hat = document.createElement('a-cylinder');
  hat.setAttribute('radius', '0.23');
  hat.setAttribute('height', '0.1');
  hat.setAttribute('position', '0 1.62 0');
  hat.setAttribute('color', '#facc15');

  // Name tag
  const text = document.createElement('a-text');
  text.setAttribute('value', name);
  text.setAttribute('align', 'center');
  text.setAttribute('color', color);
  text.setAttribute('width', '2.0');
  text.setAttribute('position', '0 1.85 0');
  text.setAttribute('look-at', '#player-camera');

  container.appendChild(body);
  container.appendChild(head);
  container.appendChild(hat);
  container.appendChild(text);

  return container;
}

export function createHazardPlaceholder(type) {
  const hazard = document.createElement('a-entity');
  
  if (type === 'spill') {
    const disk = document.createElement('a-circle');
    disk.setAttribute('radius', '0.9');
    disk.setAttribute('rotation', '-90 0 0');
    disk.setAttribute('position', '0 0.01 0');
    disk.setAttribute('color', '#0284c7');
    disk.setAttribute('material', 'opacity: 0.85; transparent: true; roughness: 0.1; metalness: 0.8');
    hazard.appendChild(disk);
  } else if (type === 'forklift_blindspot') {
    const cone = document.createElement('a-cone');
    cone.setAttribute('radius-bottom', '0.4');
    cone.setAttribute('height', '0.8');
    cone.setAttribute('position', '0 0.4 0');
    cone.setAttribute('color', '#f97316');
    hazard.appendChild(cone);
  } else if (type === 'battery_hazard') {
    const box = document.createElement('a-box');
    box.setAttribute('depth', '0.6');
    box.setAttribute('width', '0.6');
    box.setAttribute('height', '0.8');
    box.setAttribute('position', '0 0.4 0');
    box.setAttribute('color', '#eab308');
    hazard.appendChild(box);
  }

  return hazard;
}
