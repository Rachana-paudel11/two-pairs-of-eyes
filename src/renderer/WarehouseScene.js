/**
 * WarehouseScene.js
 * Builds the 3D warehouse environment and places stop-specific hazard GLB props:
 *  - Stop 1: Fluid spill + PSX wet floor sign / oil container
 *  - Stop 2: Forklift approaching blind corner with tall pallet cargo
 *  - Stop 3: Damaged racking upright / broken pallet
 *  - Stop 4: Industrial battery charger with combustible boxes & pulsing warning beacon
 *  - Dynamic Cordon / Hazard Cones when player cordons off an area
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const WAREHOUSE_MODEL = '/assets/models/environment/warehouse.glb';
const FORKLIFT_MODEL = '/assets/models/environment/warehouse_forklift_gameready.glb';
const CHARGER_MODEL = '/assets/models/environment/battery_charger.glb';
const SIGN_MODEL = '/assets/models/environment/psx_wet_floor_sign.glb';
const BOX_MODEL = '/assets/models/environment/cardboard_box.glb';
const BROKEN_PALLET_MODEL = '/assets/models/environment/broken_pallet.glb';

export const STOP_ANCHORS = [
  { x: -0.6, y: 1.65, z: -4.5 },  // Stop 1: Transit walkway
  { x: -1.5, y: 1.65, z: -14.5 }, // Stop 2: Blind corner
  { x: 0.8, y: 1.65, z: -17.5 },  // Stop 3: Racking bay
  { x: 0.8, y: 1.65, z: -23.5 },  // Stop 4: Charging bay
  { x: 0.8, y: 1.65, z: -29.5 },  // Stop 5: Main aisle
];

export class WarehouseScene {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this._loader = new GLTFLoader();
    this._animatedProps = [];
    this._cordonObjects = new Map();
  }

  async load() {
    // 1. Load the warehouse environment
    await this._loadWarehouse();

    // 2. Load stop-specific hazard props asynchronously
    this._loadStopProps();
  }

  async _loadWarehouse() {
    try {
      const gltf = await this._loadGLTF(WAREHOUSE_MODEL);
      const model = gltf.scene;
      model.traverse((node) => {
        if (node.isMesh) {
          node.receiveShadow = true;
          node.castShadow = true;
        }
      });
      this.scene.add(model);
      console.info('[WarehouseScene] Loaded warehouse.glb');
    } catch (err) {
      console.warn('[WarehouseScene] warehouse.glb failed, building procedural warehouse:', err);
      this._buildProcedural();
    }
  }

  async _loadStopProps() {
    // ─── Stop 1: Wet Floor Sign & Spill Decal ──────────────────────────────
    this._addFluidSpill(new THREE.Vector3(0.5, 0.01, -4.0));
    try {
      const signGltf = await this._loadGLTF(SIGN_MODEL);
      const sign = signGltf.scene;
      sign.position.set(1.1, 0, -3.6);
      sign.scale.set(1.2, 1.2, 1.2);
      this.scene.add(sign);
    } catch {
      // Procedural fallback sign
      this._buildProceduralSign(new THREE.Vector3(1.1, 0, -3.6));
    }

    // ─── Stop 2: Forklift at Blind Corner with Tall Cargo ──────────────────
    try {
      const flGltf = await this._loadGLTF(FORKLIFT_MODEL);
      const forklift = flGltf.scene;
      forklift.position.set(1.6, 0, -15.2);
      forklift.rotation.y = Math.PI / 2; // Facing across junction
      forklift.scale.set(1.0, 1.0, 1.0);
      forklift.traverse((n) => { if (n.isMesh) n.castShadow = true; });
      this.scene.add(forklift);

      // Stack high cardboard boxes on forks to block eye line
      this._addHighCargo(new THREE.Vector3(0.7, 0.8, -15.2));
    } catch {
      this._buildProceduralForklift(new THREE.Vector3(1.6, 0, -15.2));
    }

    // ─── Stop 3: Damaged Rack Upright & Broken Pallet ──────────────────────
    try {
      const palletGltf = await this._loadGLTF(BROKEN_PALLET_MODEL);
      const pallet = palletGltf.scene;
      pallet.position.set(2.0, 0, -20.5);
      pallet.scale.set(0.9, 0.9, 0.9);
      this.scene.add(pallet);
    } catch {
      // Fallback
    }
    this._addBentUprightProp(new THREE.Vector3(2.4, 0, -20.5));

    // ─── Stop 4: Charging Station & Cardboard Combustibles ─────────────────
    try {
      const chargerGltf = await this._loadGLTF(CHARGER_MODEL);
      const charger = chargerGltf.scene;
      charger.position.set(-1.8, 0, -26.5);
      charger.rotation.y = Math.PI / 2;
      charger.scale.set(1.2, 1.2, 1.2);
      this.scene.add(charger);
    } catch {
      this._buildProceduralCharger(new THREE.Vector3(-1.8, 0, -26.5));
    }
    this._addAmberBeacon(new THREE.Vector3(-1.8, 1.8, -26.5));
    this._addCombustibleBoxes(new THREE.Vector3(-1.2, 0, -26.0));
  }

  _loadGLTF(url) {
    return new Promise((resolve, reject) => {
      this._loader.load(url, resolve, undefined, reject);
    });
  }

  // ─── Hazard & Prop Helpers ───────────────────────────────────────────────

  _addFluidSpill(pos) {
    const geo = new THREE.CircleGeometry(0.55, 24);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a1208,
      roughness: 0.05,
      metalness: 0.7,
      transparent: true,
      opacity: 0.85,
    });
    const puddle = new THREE.Mesh(geo, mat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.copy(pos);
    puddle.position.y = 0.005;
    this.scene.add(puddle);
  }

  _addHighCargo(pos) {
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xc49a45, roughness: 0.8 });
    for (let y = 0; y < 3; y++) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), boxMat);
      box.position.set(pos.x, pos.y + y * 0.56, pos.z);
      box.castShadow = true;
      this.scene.add(box);
    }
  }

  _addBentUprightProp(pos) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.6, metalness: 0.4 });
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.5, 0.12), mat);
    upright.position.set(pos.x, 2.25, pos.z);
    upright.rotation.z = 0.18; // Visibly bent buckle
    upright.castShadow = true;
    this.scene.add(upright);
  }

  _addAmberBeacon(pos) {
    const light = new THREE.PointLight(0xff9500, 2.5, 6, 2);
    light.position.copy(pos);
    this.scene.add(light);

    const geo = new THREE.SphereGeometry(0.08, 12, 12);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff9500,
      emissive: 0xff9500,
      emissiveIntensity: 3.0,
    });
    const bulb = new THREE.Mesh(geo, mat);
    bulb.position.copy(pos);
    this.scene.add(bulb);

    this._animatedProps.push({
      update: (elapsed) => {
        const intensity = Math.sin(elapsed * 5) > 0 ? 3.0 : 0.2;
        mat.emissiveIntensity = intensity;
        light.intensity = intensity;
      },
    });
  }

  _addCombustibleBoxes(pos) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xb58a44, roughness: 0.9 });
    const positions = [
      [0, 0.25, 0],
      [0.45, 0.25, 0.1],
      [0.15, 0.7, 0.05],
    ];
    positions.forEach(([dx, dy, dz]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), mat);
      b.position.set(pos.x + dx, dy, pos.z + dz);
      b.castShadow = true;
      this.scene.add(b);
    });
  }

  _buildProceduralSign(pos) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd60a, roughness: 0.4 });
    const sign = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 4), mat);
    sign.position.set(pos.x, 0.3, pos.z);
    this.scene.add(sign);
  }

  _buildProceduralForklift(pos) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.4, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.5 })
    );
    body.position.y = 0.8;
    group.add(body);
    group.position.copy(pos);
    group.rotation.y = Math.PI / 2;
    this.scene.add(group);
  }

  _buildProceduralCharger(pos) {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.5, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x2c2c2e })
    );
    base.position.set(pos.x, 0.75, pos.z);
    this.scene.add(base);
  }

  /**
   * Spawn 3D cordon barrier / hazard tape around a cordoned zone.
   * @param {string} stopId
   * @param {{x:number, y:number, z:number}} targetPos
   */
  spawnCordonBarrier(stopId, targetPos) {
    if (this._cordonObjects.has(stopId)) return;

    const group = new THREE.Group();
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.3 });
    const tapeMat = new THREE.MeshStandardMaterial({
      color: 0xffd60a,
      roughness: 0.4,
      emissive: 0xffd60a,
      emissiveIntensity: 0.5,
    });

    // 4 Corner safety cones
    const radius = 0.9;
    const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    angles.forEach((a) => {
      const cx = targetPos.x + Math.cos(a) * radius;
      const cz = targetPos.z + Math.sin(a) * radius;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 12), coneMat);
      cone.position.set(cx, 0.28, cz);
      group.add(cone);
    });

    // Cordon tape perimeter
    for (let i = 0; i < 4; i++) {
      const a1 = angles[i];
      const a2 = angles[(i + 1) % 4];
      const p1 = new THREE.Vector3(targetPos.x + Math.cos(a1) * radius, 0.42, targetPos.z + Math.sin(a1) * radius);
      const p2 = new THREE.Vector3(targetPos.x + Math.cos(a2) * radius, 0.42, targetPos.z + Math.sin(a2) * radius);
      const dist = p1.distanceTo(p2);
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

      const tape = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, dist), tapeMat);
      tape.position.copy(mid);
      tape.lookAt(p2);
      group.add(tape);
    }

    this.scene.add(group);
    this._cordonObjects.set(stopId, group);
  }

  _buildProcedural() {
    const root = new THREE.Group();
    const floorGeo = new THREE.PlaneGeometry(12, 50);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x48484a, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -20);
    floor.receiveShadow = true;
    root.add(floor);
    this.scene.add(root);
  }

  update(elapsed) {
    for (const prop of this._animatedProps) {
      prop.update(elapsed);
    }
  }
}
