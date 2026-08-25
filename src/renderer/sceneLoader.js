// Builds the complete, authentic 3D warehouse environment.
// Relies cleanly on warehouse.glb as the primary 3D building structure
// with zero artificial box clipping or character visual obstruction.

function el(tag, attrs = {}) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  return node;
}

function buildWarehouseModel(container) {
  // Primary 3D Warehouse Building Model (Expanded Scale 1.8x)
  container.appendChild(el('a-gltf-model', {
    id: 'warehouse-env', 
    src: '#warehouse-glb', 
    position: '0 0 0', 
    scale: '1.8 1.8 1.8',
    'log-bounds': ''
  }));
}

function buildLighting(container) {
  container.appendChild(el('a-light', { type: 'ambient', color: '#ffffff', intensity: '1.1' }));
  container.appendChild(el('a-light', {
    type: 'directional', color: '#fff8e1', intensity: '0.9', position: '5 15 5'
  }));
  for (let z = -4; z > -45; z -= 10) {
    container.appendChild(el('a-light', {
      type: 'point', color: '#fffde7', intensity: '0.45', position: `0 3 ${z}`, distance: '14'
    }));
  }
}

export function buildStaticEnvironment(root) {
  const container = el('a-entity', { id: 'static-environment' });
  buildWarehouseModel(container);
  buildLighting(container);
  root.appendChild(container);
  return container;
}
