/**
 * WarehouseScene.js
 * 
 * Immersive 5-Zone Industrial Warehouse Interior Environment:
 *  - Enclosed warehouse hall with concrete epoxy floor, yellow pedestrian safety markings, and high-bay lighting
 *  - Stop 1 (z: -4.5): Leaking chemical container / fluid spill with high-gloss sheen + 3D wet floor sign
 *  - Stop 2 (z: -14.5): Cross-junction intersection with zebra crossing + forklift with tall pallet cargo approaching
 *  - Stop 3 (z: -17.5): Racking bay with buckled upright column and broken wooden pallet
 *  - Stop 4 (z: -23.5): Charging station with battery charger, combustible cardboard boxes, and flashing amber beacon
 *  - Stop 5 (z: -29.5): Clean loading dock with industrial roller shutter doors and green exit signs
 *  - Dynamic 3D Cordon Barriers (safety cones + hazard tape)
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const OIL_SPILL_MODEL = '/assets/models/environment/oil_spill_container.glb';
const FORKLIFT_MODEL = '/assets/models/environment/warehouse_forklift_gameready.glb';
const CHARGER_MODEL = '/assets/models/environment/battery_charger.glb';
const SIGN_MODEL = '/assets/models/environment/psx_wet_floor_sign.glb';
const BROKEN_PALLET_MODEL = '/assets/models/environment/broken_pallet.glb';

export const STOP_ANCHORS = [
  { x: -0.6, y: 1.65, z: -4.5 },  // Stop 1: Transit walkway
  { x: -1.5, y: 1.65, z: -14.5 }, // Stop 2: Blind corner
  { x: 0.8, y: 1.65, z: -17.5 },  // Stop 3: Racking bay
  { x: 0.8, y: 1.65, z: -23.5 },  // Stop 4: Charging bay
  { x: 0.8, y: 1.65, z: -29.5 },  // Stop 5: Dispatch dock
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
    this._buildWarehouseInterior();
    await this._loadStopProps();
  }

  /**
   * Builds the complete enclosed warehouse interior.
   */
  _buildWarehouseInterior() {
    const root = new THREE.Group();
    root.name = 'WarehouseInterior';

    const floorWidth = 16;
    const floorLength = 48;
    const wallHeight = 7.5;
    const centerZ = -18;

    // ─── 1. Concrete Floor with Industrial Markings ──────────────────
    const floorGeo = new THREE.PlaneGeometry(floorWidth, floorLength, 32, 64);
    const floorTex = this._createConcreteTexture();
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(6, 18);

    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.4,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, centerZ);
    floor.receiveShadow = true;
    root.add(floor);

    // ─── 2. Yellow Walkway Boundary Lines ───────────────────────────
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xf5a623,
      roughness: 0.35,
      emissive: 0x553300,
      emissiveIntensity: 0.2,
    });

    // Left safety line
    const leftLine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, floorLength - 2), lineMat);
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(-1.8, 0.003, centerZ);
    root.add(leftLine);

    // Right safety line
    const rightLine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, floorLength - 2), lineMat);
    rightLine.rotation.x = -Math.PI / 2;
    rightLine.position.set(1.8, 0.003, centerZ);
    root.add(rightLine);

    // Zebra crosswalk stripes at Stop 2 junction (z = -14.5)
    for (let i = -1.5; i <= 1.5; i += 0.45) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 2.5), lineMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(i, 0.004, -14.5);
      root.add(stripe);
    }

    // ─── 3. Enclosing Walls & Ceiling ────────────────────────────────
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.7, metalness: 0.3 });

    // Left Wall
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(floorLength, wallHeight), wallMat);
    leftWall.position.set(-floorWidth / 2, wallHeight / 2, centerZ);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    root.add(leftWall);

    // Right Wall
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(floorLength, wallHeight), wallMat);
    rightWall.position.set(floorWidth / 2, wallHeight / 2, centerZ);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    root.add(rightWall);

    // Back Wall
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(floorWidth, wallHeight), wallMat);
    backWall.position.set(0, wallHeight / 2, 6);
    backWall.rotation.y = Math.PI;
    backWall.receiveShadow = true;
    root.add(backWall);

    // Front Wall (Loading Dock with Roller Doors)
    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(floorWidth, wallHeight), wallMat);
    frontWall.position.set(0, wallHeight / 2, -42);
    frontWall.receiveShadow = true;
    root.add(frontWall);

    // Roller shutter doors at loading dock (Stop 5)
    this._addRollerDoor(root, -3.5, -41.8);
    this._addRollerDoor(root, 3.5, -41.8);

    // Ceiling
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.9 });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(floorWidth, floorLength), ceilMat);
    ceil.position.set(0, wallHeight, centerZ);
    ceil.rotation.x = Math.PI / 2;
    root.add(ceil);

    // ─── 4. High Pallet Racking Rows & Industrial Lighting ──────────
    this._buildRackingRows(root);
    this._buildHighBayLights(root);

    this.scene.add(root);
  }

  _buildRackingRows(root) {
    const rackOrange = new THREE.MeshStandardMaterial({ color: 0xe65100, roughness: 0.5 });
    const rackBlue = new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.5 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xbcaaa4, roughness: 0.9 });

    const createBay = (x, z) => {
      const bay = new THREE.Group();
      const length = 4.8, height = 6.2;

      // Uprights
      for (const dx of [-length / 2, length / 2]) {
        for (const dz of [-0.6, 0.6]) {
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.12, height, 0.12), rackBlue);
          col.position.set(dx, height / 2, dz);
          col.castShadow = true;
          bay.add(col);
        }
      }

      // Shelves with pallets & boxes
      for (let y = 1.6; y < height; y += 1.8) {
        for (const dz of [-0.6, 0.6]) {
          const beam = new THREE.Mesh(new THREE.BoxGeometry(length, 0.12, 0.08), rackOrange);
          beam.position.set(0, y, dz);
          bay.add(beam);
        }
        const pallet = new THREE.Mesh(new THREE.BoxGeometry(length * 0.88, 0.14, 1.1), woodMat);
        pallet.position.set(0, y + 0.1, 0);
        bay.add(pallet);

        for (let bx = -1.4; bx <= 1.4; bx += 1.4) {
          const crate = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.85), boxMat);
          crate.position.set(bx, y + 0.6, (Math.random() - 0.5) * 0.15);
          crate.castShadow = true;
          bay.add(crate);
        }
      }
      bay.position.set(x, 0, z);
      return bay;
    };

    // Left & Right Racking along the 5 stops (leaving cross-junction gap at z = -14.5)
    for (let z = 0; z >= -36; z -= 6.0) {
      if (Math.abs(z - (-14.5)) < 3.5) continue; // Junction gap
      root.add(createBay(-3.6, z));
      root.add(createBay(3.6, z));
    }
  }

  _addRollerDoor(root, x, z) {
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6, metalness: 0.4 });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 5.2), doorMat);
    door.position.set(x, 2.6, z);
    root.add(door);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.25, 0.2), frameMat);
    frame.position.set(x, 5.3, z + 0.1);
    root.add(frame);

    // Green EXIT sign
    const exitCanvas = document.createElement('canvas');
    exitCanvas.width = 128; exitCanvas.height = 48;
    const ctx = exitCanvas.getContext('2d');
    ctx.fillStyle = '#16a34a'; ctx.fillRect(0, 0, 128, 48);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('EXIT', 64, 32);
    const exitTex = new THREE.CanvasTexture(exitCanvas);
    const exitSign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.3),
      new THREE.MeshBasicMaterial({ map: exitTex })
    );
    exitSign.position.set(x, 5.65, z + 0.15);
    root.add(exitSign);
  }

  _buildHighBayLights(root) {
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.0 });
    for (let z = 0; z >= -40; z -= 8.0) {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 0.2, 12), lampMat);
      lamp.position.set(0, 6.8, z);
      root.add(lamp);

      const pLight = new THREE.PointLight(0xfff4e0, 1.2, 14, 1.5);
      pLight.position.set(0, 6.5, z);
      pLight.castShadow = true;
      root.add(pLight);
    }
  }

  /**
   * Loads Stop-Specific Props across the 5 Zones.
   */
  async _loadStopProps() {
    // ─── STOP 1 (z: -4.5): Leaking Container & Fluid Spill ───────────
    await this._buildStop1Spill(new THREE.Vector3(0.4, 0, -6.5));

    // ─── STOP 2 (z: -14.5): Forklift at Cross-Junction ───────────────
    const forkliftGroup = new THREE.Group();
    try {
      const flGltf = await this._loadGLTF(FORKLIFT_MODEL);
      const forklift = flGltf.scene;
      this._normalizeProp(forklift, 2.2);
      forklift.position.set(0, 0, 0);
      forklift.rotation.y = -Math.PI / 2;
      forkliftGroup.add(forklift);
      this._addHighCargoToGroup(forkliftGroup, new THREE.Vector3(-1.0, 0.7, 0));
    } catch {
      this._buildProceduralForklift(new THREE.Vector3(0, 0, 0));
    }
    forkliftGroup.position.set(5.2, 0, -14.5); // Standing in side junction
    this.scene.add(forkliftGroup);
    this._forkliftGroup = forkliftGroup;

    // Corner safety convex mirror at junction
    this._addConvexMirror(new THREE.Vector3(-2.2, 2.8, -13.5));

    // ─── STOP 3 (z: -17.5): Buckled Upright & Broken Pallet ──────────
    try {
      const palletGltf = await this._loadGLTF(BROKEN_PALLET_MODEL);
      const pallet = palletGltf.scene;
      this._normalizeProp(pallet, 1.2);
      pallet.position.set(2.4, 0, -20.5);
      this.scene.add(pallet);
    } catch {}
    this._addBentUprightProp(new THREE.Vector3(2.4, 0, -20.5));

    // ─── STOP 4 (z: -23.5): Charging Bay & Combustibles ──────────────
    try {
      const chargerGltf = await this._loadGLTF(CHARGER_MODEL);
      const charger = chargerGltf.scene;
      this._normalizeProp(charger, 1.8);
      charger.position.set(-2.5, 0, -26.5);
      charger.rotation.y = Math.PI / 2;
      this.scene.add(charger);
    } catch {
      this._buildProceduralCharger(new THREE.Vector3(-2.5, 0, -26.5));
    }
    this._addAmberBeacon(new THREE.Vector3(-2.5, 1.8, -26.5));
    this._addCombustibleBoxes(new THREE.Vector3(-1.8, 0, -26.0));
  }

  /**
   * Stop 1: Realistic Leaking Oil Container & Viscous Spill.
   */
  async _buildStop1Spill(pos) {
    const group = new THREE.Group();
    group.name = 'Stop1_Spill';

    try {
      const gltf = await this._loadGLTF(OIL_SPILL_MODEL);
      const model = gltf.scene;
      this._normalizeProp(model, 0.85);
      model.position.set(pos.x, 0, pos.z);
      group.add(model);
    } catch {
      const puddleMat = new THREE.MeshStandardMaterial({
        color: 0x111317,
        roughness: 0.04,
        metalness: 0.85,
        transparent: true,
        opacity: 0.9,
      });

      const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.7, 32), puddleMat);
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.set(pos.x, 0.008, pos.z);
      group.add(puddle);

      const canMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.5 });
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.45, 16), canMat);
      can.rotation.z = Math.PI / 2;
      can.position.set(pos.x - 0.4, 0.14, pos.z);
      can.castShadow = true;
      group.add(can);
    }

    // Yellow Caution Wet Floor Sign
    try {
      const signGltf = await this._loadGLTF(SIGN_MODEL);
      const sign = signGltf.scene;
      this._normalizeProp(sign, 0.65);
      sign.position.set(pos.x + 0.7, 0, pos.z - 0.2);
      group.add(sign);
    } catch {
      this._buildProceduralSign(new THREE.Vector3(pos.x + 0.7, 0, pos.z - 0.2));
    }

    // Highlight spotlight
    const spot = new THREE.SpotLight(0xffffff, 2.5, 8, Math.PI / 4, 0.3);
    spot.position.set(pos.x, 4.5, pos.z);
    spot.target.position.copy(pos);
    group.add(spot);
    group.add(spot.target);

    this.scene.add(group);
  }

  _addConvexMirror(pos) {
    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.95 });
    const mirror = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), mirrorMat);
    mirror.position.copy(pos);
    mirror.rotation.x = Math.PI / 4;
    mirror.rotation.y = Math.PI / 4;
    this.scene.add(mirror);
  }

  _addHighCargoToGroup(group, localPos) {
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xc49a45, roughness: 0.8 });
    for (let y = 0; y < 3; y++) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.58, 0.75), boxMat);
      box.position.set(localPos.x, localPos.y + y * 0.59, localPos.z);
      box.castShadow = true;
      group.add(box);
    }
  }

  clearForklift() {
    if (this._forkliftGroup) {
      this._animatedProps.push({
        update: (elapsed, delta = 0.016) => {
          if (this._forkliftGroup.position.x < 14) {
            this._forkliftGroup.position.x += 4.0 * delta;
          }
        },
      });
    }
  }

  _addBentUprightProp(pos) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.5, metalness: 0.3 });
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.5, 0.14), mat);
    upright.position.set(pos.x, 2.25, pos.z);
    upright.rotation.z = 0.22;
    upright.castShadow = true;
    this.scene.add(upright);
  }

  _addAmberBeacon(pos) {
    const light = new THREE.PointLight(0xff9500, 2.5, 6, 2);
    light.position.copy(pos);
    this.scene.add(light);

    const geo = new THREE.SphereGeometry(0.12, 12, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff9500, emissive: 0xff9500, emissiveIntensity: 3.0 });
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
    const sign = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 4), mat);
    sign.position.set(pos.x, 0.28, pos.z);
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

    const radius = 0.95;
    const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    angles.forEach((a) => {
      const cx = targetPos.x + Math.cos(a) * radius;
      const cz = targetPos.z + Math.sin(a) * radius;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.55, 12), coneMat);
      cone.position.set(cx, 0.28, cz);
      group.add(cone);
    });

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
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 508, 508);

    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const shade = Math.floor(90 + Math.random() * 40);
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
