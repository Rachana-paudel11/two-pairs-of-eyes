/**
 * WarehouseScene.js
 * 
 * Professional 3D Warehouse Interior Environment:
 *  - Fully enclosed industrial warehouse hall (epoxy concrete floor, safety walkway lines, racking rows, steel trusses, high-bay lights)
 *  - Stop 1: Highly visible glossy fluid spill + tipped chemical drum + 3D Caution Wet Floor sign
 *  - Stop 2: Forklift with tall pallet cargo approaching blind corner cross-junction
 *  - Stop 3: Damaged racking bay with visibly buckled upright + broken pallet
 *  - Stop 4: Industrial battery charger with combustible cardboard stack & flashing amber beacon
 *  - Stop 5: Clear final exit aisle
 *  - Dynamic 3D Cordon Barriers (safety cones + hazard tape) spawning on cordon action
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const FORKLIFT_MODEL = '/assets/models/environment/warehouse_forklift_gameready.glb';
const CHARGER_MODEL = '/assets/models/environment/battery_charger.glb';
const SIGN_MODEL = '/assets/models/environment/psx_wet_floor_sign.glb';
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
    // 1. Build the complete enclosed interior warehouse environment
    this._buildWarehouseInterior();

    // 2. Load stop-specific hazard props asynchronously
    await this._loadStopProps();
  }

  /**
   * Builds an enclosed industrial warehouse interior.
   */
  _buildWarehouseInterior() {
    const root = new THREE.Group();
    root.name = 'WarehouseInterior';

    // ─── 1. Concrete Floor with Safety Markings ──────────────────────
    const floorWidth = 18;
    const floorLength = 60;
    const floorGeo = new THREE.PlaneGeometry(floorWidth, floorLength, 32, 64);
    
    // Create concrete texture procedurally via canvas
    const floorTex = this._createConcreteTexture();
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(6, 20);

    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.35,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -20);
    floor.receiveShadow = true;
    root.add(floor);

    // ─── 2. Yellow Walkway Boundary Lines ───────────────────────────
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xf5a623,
      roughness: 0.4,
      emissive: 0x664400,
      emissiveIntensity: 0.2,
    });

    // Left safety line
    const leftLine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 54), lineMat);
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(-1.8, 0.003, -20);
    root.add(leftLine);

    // Right safety line
    const rightLine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 54), lineMat);
    rightLine.rotation.x = -Math.PI / 2;
    rightLine.position.set(1.8, 0.003, -20);
    root.add(rightLine);

    // Zebra crosswalk stripes at Stop 2 intersection (z = -14.5)
    for (let i = -1.4; i <= 1.4; i += 0.45) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 2.5), lineMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(i, 0.004, -14.5);
      root.add(stripe);
    }

    // ─── 3. Corrugated Metal Walls & Ceiling ─────────────────────────
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      roughness: 0.7,
      metalness: 0.3,
    });
    const wallHeight = 8.5;

    // Left wall
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(floorLength, wallHeight), wallMat);
    leftWall.position.set(-floorWidth / 2, wallHeight / 2, -20);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    root.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(floorLength, wallHeight), wallMat);
    rightWall.position.set(floorWidth / 2, wallHeight / 2, -20);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    root.add(rightWall);

    // Back wall (behind player start)
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(floorWidth, wallHeight), wallMat);
    backWall.position.set(0, wallHeight / 2, 10);
    backWall.rotation.y = Math.PI;
    backWall.receiveShadow = true;
    root.add(backWall);

    // Front wall (far end of aisle)
    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(floorWidth, wallHeight), wallMat);
    frontWall.position.set(0, wallHeight / 2, -50);
    frontWall.receiveShadow = true;
    root.add(frontWall);

    // Ceiling
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.9 });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(floorWidth, floorLength), ceilMat);
    ceil.position.set(0, wallHeight, -20);
    ceil.rotation.x = Math.PI / 2;
    root.add(ceil);

    // ─── 4. Structural Steel Girders & Racking Aisles ───────────────
    this._buildRackingRows(root);
    this._buildSteelTrusses(root, floorWidth, wallHeight);
    this._buildHighBayLights(root);

    this.scene.add(root);
    console.info('[WarehouseScene] Interior warehouse environment built successfully.');
  }

  /**
   * Builds rows of industrial pallet racking on left and right sides.
   */
  _buildRackingRows(root) {
    const rackOrange = new THREE.MeshStandardMaterial({ color: 0xe65100, roughness: 0.5, metalness: 0.2 });
    const rackBlue = new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.5, metalness: 0.2 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xbcaaa4, roughness: 0.9 });

    const createRackBay = (x, z, length = 4.5, height = 6.5) => {
      const bay = new THREE.Group();
      // Upright columns
      for (const dx of [-length / 2, length / 2]) {
        for (const dz of [-0.6, 0.6]) {
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.12, height, 0.12), rackBlue);
          col.position.set(dx, height / 2, dz);
          col.castShadow = true;
          bay.add(col);
        }
      }
      // Horizontal load beams & shelf decks
      for (let y = 1.6; y < height; y += 1.8) {
        for (const dz of [-0.6, 0.6]) {
          const beam = new THREE.Mesh(new THREE.BoxGeometry(length, 0.12, 0.08), rackOrange);
          beam.position.set(0, y, dz);
          bay.add(beam);
        }
        // Pallet on shelf
        const pallet = new THREE.Mesh(new THREE.BoxGeometry(length * 0.85, 0.14, 1.1), woodMat);
        pallet.position.set(0, y + 0.1, 0);
        bay.add(pallet);

        // Crates/boxes on pallet
        for (let bx = -1.2; bx <= 1.2; bx += 1.2) {
          const crate = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 0.85), boxMat);
          crate.position.set(bx, y + 0.65, (Math.random() - 0.5) * 0.2);
          crate.castShadow = true;
          bay.add(crate);
        }
      }
      bay.position.set(x, 0, z);
      return bay;
    };

    // Left racking line (skipping junction at z = -14.5)
    for (let z = 0; z >= -45; z -= 6.0) {
      if (Math.abs(z - (-14.5)) < 3.5) continue; // Gap for junction
      root.add(createRackBay(-3.8, z));
    }

    // Right racking line
    for (let z = 0; z >= -45; z -= 6.0) {
      if (Math.abs(z - (-14.5)) < 3.5) continue;
      root.add(createRackBay(3.8, z));
    }
  }

  _buildSteelTrusses(root, width, height) {
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.6 });
    for (let z = 5; z >= -45; z -= 8.0) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(width, 0.25, 0.25), trussMat);
      beam.position.set(0, height - 0.2, z);
      root.add(beam);
    }
  }

  _buildHighBayLights(root) {
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.0,
    });
    for (let z = 0; z >= -40; z -= 8.0) {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.2, 12), lampMat);
      lamp.position.set(0, 7.8, z);
      root.add(lamp);

      const pLight = new THREE.PointLight(0xfff4e0, 1.2, 14, 1.5);
      pLight.position.set(0, 7.5, z);
      pLight.castShadow = true;
      root.add(pLight);
    }
  }

  /**
   * Stop-Specific Interactive Hazards
   */
  async _loadStopProps() {
    // ─── STOP 1: Highly Visible Glossy Fluid Spill + Drum + Sign ──────
    this._buildStop1SpillHazard(new THREE.Vector3(0.8, 0, -3.2));

    // ─── STOP 2: Forklift at Cross-Junction ───────────────────────────
    const forkliftGroup = new THREE.Group();
    try {
      const flGltf = await this._loadGLTF(FORKLIFT_MODEL);
      const forklift = flGltf.scene;
      this._normalizeProp(forklift, 2.2);
      forklift.position.set(0, 0, 0);
      forklift.rotation.y = -Math.PI / 2;
      forkliftGroup.add(forklift);

      // Stack high cardboard boxes on forks
      this._addHighCargoToGroup(forkliftGroup, new THREE.Vector3(-1.0, 0.7, 0));
    } catch {
      this._buildProceduralForklift(new THREE.Vector3(0, 0, 0));
    }
    forkliftGroup.position.set(4.8, 0, -14.5);
    this.scene.add(forkliftGroup);
    this._forkliftGroup = forkliftGroup;

    // ─── STOP 3: Damaged Rack Upright & Broken Pallet ─────────────────
    try {
      const palletGltf = await this._loadGLTF(BROKEN_PALLET_MODEL);
      const pallet = palletGltf.scene;
      this._normalizeProp(pallet, 1.2);
      pallet.position.set(2.4, 0, -19.5);
      this.scene.add(pallet);
    } catch {
      // Fallback
    }
    this._addBentUprightProp(new THREE.Vector3(2.4, 0, -19.5));

    // ─── STOP 4: Charging Station & Cardboard Combustibles ────────────
    try {
      const chargerGltf = await this._loadGLTF(CHARGER_MODEL);
      const charger = chargerGltf.scene;
      this._normalizeProp(charger, 1.8);
      charger.position.set(-2.5, 0, -25.5);
      charger.rotation.y = Math.PI / 2;
      this.scene.add(charger);
    } catch {
      this._buildProceduralCharger(new THREE.Vector3(-2.5, 0, -25.5));
    }
    this._addAmberBeacon(new THREE.Vector3(-2.5, 1.8, -25.5));
    this._addCombustibleBoxes(new THREE.Vector3(-1.8, 0, -25.0));
  }

  /**
   * Stop 1: Builds a highly realistic oil/chemical spill with reflective sheen,
   * tipped leaking chemical container, and 3D caution sign right in the walkway.
   */
  async _buildStop1SpillHazard(centerPos) {
    const spillGroup = new THREE.Group();
    spillGroup.name = 'Stop1_SpillHazard';

    // 1. High-gloss dark reflective liquid puddle
    const puddleMat = new THREE.MeshStandardMaterial({
      color: 0x181a1e,
      roughness: 0.08,
      metalness: 0.75,
      transparent: true,
      opacity: 0.88,
    });

    // Organic multi-circle puddle shape
    const lobes = [
      { x: 0, z: 0, r: 0.48 },
      { x: 0.28, z: 0.18, r: 0.34 },
      { x: -0.22, z: 0.22, r: 0.3 },
      { x: 0.15, z: -0.25, r: 0.28 },
    ];

    lobes.forEach(({ x, z, r }) => {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(r, 24), puddleMat);
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.set(centerPos.x + x, 0.008, centerPos.z + z);
      spillGroup.add(puddle);
    });

    // 2. Tipped chemical canister leaking fluid (realistic 20L Jerrycan size)
    const drumMat = new THREE.MeshStandardMaterial({
      color: 0x0277bd, // Industrial blue container
      roughness: 0.35,
      metalness: 0.5,
    });
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.42, 16), drumMat);
    drum.rotation.z = Math.PI / 2;
    drum.rotation.y = 0.4;
    drum.position.set(centerPos.x - 0.45, 0.13, centerPos.z - 0.2);
    drum.castShadow = true;
    spillGroup.add(drum);

    // Yellow warning band on canister
    const drumStripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.132, 0.132, 0.12, 16),
      new THREE.MeshStandardMaterial({ color: 0xffd60a, roughness: 0.3 })
    );
    drumStripe.rotation.z = Math.PI / 2;
    drumStripe.rotation.y = 0.4;
    drumStripe.position.set(centerPos.x - 0.45, 0.13, centerPos.z - 0.2);
    spillGroup.add(drumStripe);

    // 3. PSX Caution Wet Floor Sign
    try {
      const signGltf = await this._loadGLTF(SIGN_MODEL);
      const sign = signGltf.scene;
      this._normalizeProp(sign, 0.6); // 0.6m tall sign
      sign.position.set(centerPos.x + 0.55, 0, centerPos.z - 0.15);
      sign.rotation.y = -0.3;
      spillGroup.add(sign);
    } catch {
      this._buildProceduralSign(new THREE.Vector3(centerPos.x + 0.55, 0, centerPos.z - 0.15));
    }

    // 4. Overhead highlight spotlight to make liquid gleam
    const spot = new THREE.SpotLight(0xffffff, 2.5, 8, Math.PI / 4, 0.3);
    spot.position.set(centerPos.x, 4.5, centerPos.z);
    spot.target.position.copy(centerPos);
    spillGroup.add(spot);
    spillGroup.add(spot.target);

    this.scene.add(spillGroup);
  }

  _addHighCargoToGroup(group, localPos) {
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xc49a45, roughness: 0.8 });
    for (let y = 0; y < 3; y++) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), boxMat);
      box.position.set(localPos.x, localPos.y + y * 0.56, localPos.z);
      box.castShadow = true;
      group.add(box);
    }
  }

  /**
   * Clears the forklift down the side corridor after Stop 2 is resolved.
   */
  clearForklift() {
    if (this._forkliftGroup) {
      this._animatedProps.push({
        update: (elapsed, delta = 0.016) => {
          if (this._forkliftGroup.position.x < 12) {
            this._forkliftGroup.position.x += 3.5 * delta;
          }
        },
      });
    }
  }

  _addBentUprightProp(pos) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.6, metalness: 0.4 });
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.5, 0.14), mat);
    upright.position.set(pos.x, 2.25, pos.z);
    upright.rotation.z = 0.22; // Visibly bent buckle
    upright.castShadow = true;
    this.scene.add(upright);
  }

  _addAmberBeacon(pos) {
    const light = new THREE.PointLight(0xff9500, 2.5, 6, 2);
    light.position.copy(pos);
    this.scene.add(light);

    const geo = new THREE.SphereGeometry(0.12, 12, 12);
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
        const intensity = Math.sin(elapsed * 6) > 0 ? 3.0 : 0.2;
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
    const radius = 1.1;
    const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    angles.forEach((a) => {
      const cx = targetPos.x + Math.cos(a) * radius;
      const cz = targetPos.z + Math.sin(a) * radius;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.6, 12), coneMat);
      cone.position.set(cx, 0.3, cz);
      group.add(cone);
    });

    // Cordon tape perimeter
    for (let i = 0; i < 4; i++) {
      const a1 = angles[i];
      const a2 = angles[(i + 1) % 4];
      const p1 = new THREE.Vector3(targetPos.x + Math.cos(a1) * radius, 0.45, targetPos.z + Math.sin(a1) * radius);
      const p2 = new THREE.Vector3(targetPos.x + Math.cos(a2) * radius, 0.45, targetPos.z + Math.sin(a2) * radius);
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

  _normalizeProp(model, targetHeight) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;

    if (size.y > 0.05 && targetHeight) {
      const scale = targetHeight / size.y;
      model.scale.set(scale, scale, scale);
    }
    model.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });
  }

  _createConcreteTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#6b7280';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle noise and joint lines
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 504, 504);

    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const shade = Math.floor(80 + Math.random() * 40);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x, y, 2, 2);
    }

    return new THREE.CanvasTexture(canvas);
  }

  _loadGLTF(url) {
    return new Promise((resolve, reject) => {
      this._loader.load(url, resolve, undefined, reject);
    });
  }

  update(elapsed, delta = 0.016) {
    for (const prop of this._animatedProps) {
      prop.update(elapsed, delta);
    }
  }
}
