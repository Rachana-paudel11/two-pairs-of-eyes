/**
 * WarehouseScene.js
 * Builds the 3D warehouse environment.
 *
 * Strategy: Attempt to load warehouse.glb from /assets/models/warehouse.glb.
 * If the file is absent (placeholder mode), build a convincing procedural
 * warehouse from Three.js primitives so development can continue without assets.
 *
 * Stop anchor positions are read from stops.json so the engine and renderer
 * stay in sync automatically.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_PATH = '/assets/models/environment/warehouse.glb';

// Stop camera anchor positions — mirrored from stops.json alexStartPosition
// so the camera knows where to stand at each stop.
export const STOP_ANCHORS = [
  { x: -0.6,  y: 1.65, z: -4.5  }, // stop_01 transit walkway
  { x: -1.5,  y: 1.65, z: -14.5 }, // stop_02 blind corner
  { x:  0.8,  y: 1.65, z: -17.5 }, // stop_03 racking bay
  { x:  0.8,  y: 1.65, z: -23.5 }, // stop_04 charging bay
  { x:  0.8,  y: 1.65, z: -29.5 }, // stop_05 main aisle
];

export class WarehouseScene {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this._loader = new GLTFLoader();
    this._procedural = null;
  }

  /** Load the warehouse model, falling back to procedural geometry. */
  async load() {
    try {
      const gltf = await this._tryLoadGLTF();
      this.scene.add(gltf.scene);
      console.info('[WarehouseScene] Loaded warehouse.glb');
    } catch {
      console.warn('[WarehouseScene] warehouse.glb not found — using procedural fallback');
      this._buildProcedural();
    }
  }

  _tryLoadGLTF() {
    return new Promise((resolve, reject) => {
      this._loader.load(MODEL_PATH, resolve, undefined, reject);
    });
  }

  // ─── Procedural warehouse ────────────────────────────────────────────────

  _buildProcedural() {
    const root = new THREE.Group();
    root.name = 'warehouse_procedural';

    this._addFloor(root);
    this._addWalls(root);
    this._addCeiling(root);
    this._addRacking(root);
    this._addHazardProps(root);
    this._addStopMarkers(root);

    this.scene.add(root);
    this._procedural = root;
  }

  _mat(color, roughness = 0.85, metalness = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  _addFloor(root) {
    // Concrete floor — 10m wide, 40m long aisle
    const geo = new THREE.PlaneGeometry(10, 42);
    const mat = this._mat(0x6b6b6b, 0.95);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0, -16);
    mesh.receiveShadow = true;
    root.add(mesh);

    // Painted pedestrian walkway stripes
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf0c800, roughness: 0.9 });
    [-1.5, 1.5].forEach((x) => {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 42), stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, 0.002, -16);
      root.add(stripe);
    });
  }

  _addWalls(root) {
    const wallMat = this._mat(0x4a4e5a, 0.9);
    // Back wall
    const back = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 0.2), wallMat);
    back.position.set(0, 4, -37);
    back.receiveShadow = true;
    root.add(back);
    // Side walls
    [-5, 5].forEach((x) => {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.2, 8, 40), wallMat);
      side.position.set(x, 4, -17);
      side.receiveShadow = true;
      root.add(side);
    });
  }

  _addCeiling(root) {
    const mat = this._mat(0x3a3d47, 0.8);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(10, 42), mat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 8, -16);
    root.add(ceil);
  }

  _addRacking(root) {
    const upright = this._mat(0x3a7bd5, 0.7, 0.3);
    const shelf = this._mat(0x888888, 0.8, 0.2);
    const box = this._mat(0xc8a96e, 0.9);

    const rackPositions = [-3, 3];
    const zPositions = [-5, -10, -15, -20, -25, -30];

    rackPositions.forEach((rx) => {
      zPositions.forEach((rz) => {
        // Upright
        const u = new THREE.Mesh(new THREE.BoxGeometry(0.08, 5, 0.08), upright);
        u.position.set(rx, 2.5, rz);
        u.castShadow = true;
        root.add(u);

        // Three shelf levels
        [1.0, 2.5, 3.8].forEach((sy) => {
          const s = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.8), shelf);
          s.position.set(rx, sy, rz);
          s.receiveShadow = true;
          root.add(s);

          // Boxes on shelf
          for (let b = 0; b < 2; b++) {
            const bm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.35), box);
            bm.position.set(rx + (b === 0 ? -0.35 : 0.35), sy + 0.2, rz);
            bm.castShadow = true;
            root.add(bm);
          }
        });
      });
    });
  }

  _addHazardProps(root) {
    // Stop 01 — fluid spill (dark puddle decal on floor)
    const spillGeo = new THREE.CircleGeometry(0.35, 16);
    const spillMat = new THREE.MeshStandardMaterial({
      color: 0x2a1a00,
      roughness: 0.1,
      metalness: 0.5,
      transparent: true,
      opacity: 0.85,
    });
    const spill = new THREE.Mesh(spillGeo, spillMat);
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(0.4, 0.002, -4.2);
    spill.name = 'hazard_spill';
    root.add(spill);

    // Stop 03 — bent rack upright (rotated box to simulate buckle)
    const bentMat = this._mat(0xff4422, 0.7, 0.4);
    const bent = new THREE.Mesh(new THREE.BoxGeometry(0.1, 5, 0.1), bentMat);
    bent.position.set(3, 2.5, -20);
    bent.rotation.z = 0.12; // visible lean
    bent.castShadow = true;
    bent.name = 'hazard_bent_rack';
    root.add(bent);

    // Stop 04 — charging station with amber indicator light
    const chargerBase = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.4), this._mat(0x333333));
    chargerBase.position.set(-1.5, 0.6, -26);
    chargerBase.castShadow = true;
    root.add(chargerBase);

    // Amber blinking indicator (emissive)
    const indicatorMat = new THREE.MeshStandardMaterial({
      color: 0xff9500,
      emissive: 0xff9500,
      emissiveIntensity: 2.0,
    });
    const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), indicatorMat);
    indicator.position.set(-1.5, 1.28, -25.82);
    indicator.name = 'hazard_indicator';
    root.add(indicator);

    // Cardboard boxes near charger (combustibles)
    const cardboard = this._mat(0xc8a96e, 0.95);
    [0, 0.45].forEach((offset) => {
      const cb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), cardboard);
      cb.position.set(-1.5 + offset, 0.2, -25.4);
      cb.castShadow = true;
      root.add(cb);
    });

    // Store reference for animation
    this._amberIndicator = indicator;
  }

  _addStopMarkers(root) {
    // Subtle floor rings at each stop so devs know where the camera will land
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ffcc,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.25,
    });
    STOP_ANCHORS.forEach((pos, i) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.3, 24), markerMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pos.x, 0.003, pos.z);
      ring.name = `stop_marker_${i + 1}`;
      root.add(ring);
    });
  }

  /**
   * Called every frame from the render loop.
   * @param {number} elapsed — total elapsed seconds
   */
  update(elapsed) {
    // Blink the amber indicator at Stop 04
    if (this._amberIndicator) {
      const blink = Math.sin(elapsed * 4) > 0 ? 2.0 : 0.2;
      this._amberIndicator.material.emissiveIntensity = blink;
    }
  }
}
