/**
 * WarehouseScene.js
 * 
 * Stop 1: Grand Chemical & Oil Drum Storage Warehouse (Matching Reference Image 2)
 *  - Massive open drum storage facility (24m wide x 20m deep)
 *  - Rows of 3-tier and 4-tier wooden pallets stacked with hundreds of blue & cyan chemical barrels
 *  - Green and steel overhead roof trusses with hanging industrial high-bay lamps
 *  - Polished concrete epoxy floor with warm lighting reflections and yellow safety boundary lines
 *  - Active hazard: Centered chemical offload pallet with 3 standing drums + 1 tipped leaking drum & PSX Wet Floor sign
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const SIGN_MODEL = '/assets/models/environment/psx_wet_floor_sign.glb';

export const STOP_ANCHORS = [
  { x: 0.6, y: 1.65, z: -4.0 },  // Stop 1: Chemical Drum Storage Warehouse
  { x: -1.5, y: 1.65, z: -14.5 }, // Stop 2
  { x: 0.8, y: 1.65, z: -17.5 },  // Stop 3
  { x: 0.8, y: 1.65, z: -23.5 },  // Stop 4
  { x: 0.8, y: 1.65, z: -29.5 },  // Stop 5
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
    this._buildDrumStorageWarehouse();
    await this._loadStop1Props();
  }

  /**
   * Builds the Grand Chemical Drum Storage Warehouse (Image 2 style).
   */
  _buildDrumStorageWarehouse() {
    const root = new THREE.Group();
    root.name = 'DrumWarehouse';

    const width = 26;
    const depth = 22;
    const height = 8.5;
    const centerZ = -5.0;

    // ─── 1. Polished Concrete Epoxy Floor with Warm Reflections ───────
    const floorGeo = new THREE.PlaneGeometry(width, depth, 32, 32);
    const floorTex = this._createConcreteTexture();
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(10, 10);

    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.22, // Sleek epoxy sheen matching Image 2
      metalness: 0.25,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, centerZ);
    floor.receiveShadow = true;
    root.add(floor);

    // ─── 2. Yellow Walkway Safety Markings ───────────────────────────
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xf5a623,
      roughness: 0.35,
      emissive: 0x553300,
      emissiveIntensity: 0.3,
    });

    const leftLine = new THREE.Mesh(new THREE.PlaneGeometry(0.14, depth), lineMat);
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(-2.2, 0.003, centerZ);
    root.add(leftLine);

    const rightLine = new THREE.Mesh(new THREE.PlaneGeometry(0.14, depth), lineMat);
    rightLine.rotation.x = -Math.PI / 2;
    rightLine.position.set(2.2, 0.003, centerZ);
    root.add(rightLine);

    // ─── 3. Warehouse Walls (Industrial Corrugated Panels) ────────────
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const hazmatWallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });

    // Left Wall
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), wallMat);
    leftWall.position.set(-width / 2, height / 2, centerZ);
    leftWall.rotation.y = Math.PI / 2;
    root.add(leftWall);

    // Right Wall
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), wallMat);
    rightWall.position.set(width / 2, height / 2, centerZ);
    rightWall.rotation.y = -Math.PI / 2;
    root.add(rightWall);

    // Back Wall (Entrance)
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), hazmatWallMat);
    backWall.position.set(0, height / 2, centerZ + depth / 2);
    backWall.rotation.y = Math.PI;
    root.add(backWall);

    // Front Wall (Exit Corridor)
    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), hazmatWallMat);
    frontWall.position.set(0, height / 2, centerZ - depth / 2);
    root.add(frontWall);

    // ─── 4. Massive Drum Pallet Stacks (Matching Image 2) ─────────────
    // Left side: 3 deep rows of 3-tier and 4-tier drum stacks
    for (let x = -4.8; x >= -10.5; x -= 2.6) {
      for (let z = 3.0; z >= -13.0; z -= 3.0) {
        const tiers = (Math.abs(x) > 7.5) ? 4 : 3;
        const drumColor = (Math.random() > 0.3) ? 0x0284c7 : 0x0ea5e9; // Blue & Cyan mix
        this._addDrumPalletStack(root, x, z, tiers, drumColor);
      }
    }

    // Right side: 3 deep rows of 3-tier and 4-tier drum stacks
    for (let x = 4.8; x <= 10.5; x += 2.6) {
      for (let z = 3.0; z >= -13.0; z -= 3.0) {
        const tiers = (x > 7.5) ? 4 : 3;
        const drumColor = (Math.random() > 0.3) ? 0x0284c7 : 0x0369a1; // Deep blue mix
        this._addDrumPalletStack(root, x, z, tiers, drumColor);
      }
    }

    // ─── 5. Green Overhead Roof Trusses & Warm Lighting (Image 2) ─────
    this._buildGreenRoofTrusses(root, width, depth, height, centerZ);
    this._buildWarmIndustrialLighting(root, centerZ);

    this._addRoomPlacard(root, 0, 6.2, 5.8, 'FACILITY 01 | HAZMAT CHEMICAL DRUM STORAGE');

    this.scene.add(root);
  }

  /**
   * Green & Steel Roof Trusses matching Image 2 reference photo.
   */
  _buildGreenRoofTrusses(root, width, depth, height, centerZ) {
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x15803d, // Industrial green trusses from Image 2
      roughness: 0.45,
      metalness: 0.6,
    });

    for (let z = centerZ + depth / 2 - 2; z >= centerZ - depth / 2 + 2; z -= 4.5) {
      const truss = new THREE.Group();
      // Main cross beam
      const beam = new THREE.Mesh(new THREE.BoxGeometry(width - 0.5, 0.22, 0.22), trussMat);
      beam.position.set(0, height - 0.5, z);
      truss.add(beam);

      // Webbing diagonal struts
      for (let x = -width / 2 + 2; x <= width / 2 - 2; x += 2.5) {
        const strut1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), trussMat);
        strut1.position.set(x, height - 0.1, z);
        strut1.rotation.z = 0.45;
        truss.add(strut1);

        const strut2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), trussMat);
        strut2.position.set(x + 1.2, height - 0.1, z);
        strut2.rotation.z = -0.45;
        truss.add(strut2);
      }
      root.add(truss);
    }
  }

  /**
   * Warm industrial high-bay lighting casting warm reflections on epoxy floor (Image 2).
   */
  _buildWarmIndustrialLighting(root, centerZ) {
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, emissive: 0xffedd5, emissiveIntensity: 2.5 });

    const lightCoords = [
      { x: -5.5, z: centerZ + 5 },
      { x: 5.5, z: centerZ + 5 },
      { x: 0, z: centerZ },
      { x: -5.5, z: centerZ - 5 },
      { x: 5.5, z: centerZ - 5 },
    ];

    lightCoords.forEach(({ x, z }) => {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 0.25, 12), lampMat);
      lamp.position.set(x, 7.8, z);
      root.add(lamp);

      // Warm amber/white high-bay spotlight
      const light = new THREE.PointLight(0xffedd5, 1.6, 18, 1.3);
      light.position.set(x, 7.4, z);
      light.castShadow = true;
      root.add(light);
    });
  }

  /**
   * Creates a multi-tier pallet stack of 4 drums per pallet (Image 2 style).
   */
  _addDrumPalletStack(root, x, z, tiers = 3, color = 0x0284c7) {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
    const drumMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.2, // Shiny metallic sheen matching Image 2
      metalness: 0.75,
    });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });

    const group = new THREE.Group();
    const offsets = [
      { dx: -0.32, dz: -0.32 },
      { dx: 0.32, dz: -0.32 },
      { dx: -0.32, dz: 0.32 },
      { dx: 0.32, dz: 0.32 },
    ];

    for (let tier = 0; tier < tiers; tier++) {
      const yBase = tier * 1.02;
      // Wooden Pallet
      const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 1.4), woodMat);
      pallet.position.set(0, yBase + 0.07, 0);
      group.add(pallet);

      // 4 Shiny chemical drums per tier with industrial rib rings
      offsets.forEach(({ dx, dz }) => {
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.82, 16), drumMat);
        drum.position.set(dx, yBase + 0.54, dz);
        drum.castShadow = true;
        group.add(drum);

        // Yellow hazard stripe
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.222, 0.222, 0.14, 16), stripeMat);
        stripe.position.set(dx, yBase + 0.54, dz);
        group.add(stripe);
      });
    }

    group.position.set(x, 0, z);
    root.add(group);
  }

  /**
   * Stop 1 Hazard: Chemical drum leaking fluid from the left storage tier onto walkway (User Directed).
   */
  async _loadStop1Props() {
    const pos = new THREE.Vector3(-2.6, 0, -6.5);
    const group = new THREE.Group();
    group.name = 'Stop1_ChemicalHazard';

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
    const blueDrumMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.18,
      metalness: 0.8,
    });
    const yellowStripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
    const steelRimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.9 });

    // 1. Offload Wooden Pallet resting at edge of drum racks
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 1.4), woodMat);
    pallet.position.set(pos.x - 0.4, 0.07, pos.z);
    pallet.receiveShadow = true;
    group.add(pallet);

    // 2. Standing chemical drums on the pallet
    const drumOffsets = [
      { dx: -0.25, dz: 0.25 },
      { dx: -0.25, dz: -0.25 },
      { dx: 0.25, dz: -0.25 },
    ];
    drumOffsets.forEach(({ dx, dz }) => {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.82, 16), blueDrumMat);
      drum.position.set(pos.x - 0.4 + dx, 0.54, pos.z + dz);
      drum.castShadow = true;
      group.add(drum);

      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.222, 0.222, 0.14, 16), yellowStripeMat);
      stripe.position.set(pos.x - 0.4 + dx, 0.54, pos.z + dz);
      group.add(stripe);
    });

    // 3. Tipped chemical drum on floor with spout pointing towards walkway
    const tippedDrumGroup = new THREE.Group();
    tippedDrumGroup.position.set(pos.x + 0.45, 0.22, pos.z + 0.1);
    tippedDrumGroup.rotation.y = -0.3; // Angle spout towards walkway
    tippedDrumGroup.rotation.z = Math.PI / 2;

    const drumBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.82, 20), blueDrumMat);
    drumBody.castShadow = true;
    tippedDrumGroup.add(drumBody);

    const drumStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.222, 0.222, 0.14, 20), yellowStripeMat);
    tippedDrumGroup.add(drumStripe);

    // Drum top rim & bung hole (spout)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.02, 8, 20), steelRimMat);
    rim.position.y = 0.41;
    rim.rotation.x = Math.PI / 2;
    tippedDrumGroup.add(rim);

    // Open bung hole (leak origin)
    const bung = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    bung.position.set(0.1, 0.411, 0);
    bung.rotation.x = -Math.PI / 2;
    tippedDrumGroup.add(bung);

    group.add(tippedDrumGroup);

    // 4. Glossy, viscous fluid leaking from the drum bung into a spreading pool
    const puddleMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.03, // Ultra-glossy wet sheen
      metalness: 0.95,
      transparent: true,
      opacity: 0.92,
    });

    // Fluid stream emerging from mouth of tipped drum
    const stream = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.55), puddleMat);
    stream.rotation.x = -Math.PI / 2;
    stream.rotation.z = -0.3;
    stream.position.set(pos.x + 0.85, 0.007, pos.z + 0.2);
    group.add(stream);

    // Spreading organic fluid puddle expanding onto the walkway floor
    const puddleLobes = [
      { x: 1.15, z: 0.25, rx: 0.55, rz: 0.48 },
      { x: 1.45, z: 0.05, rx: 0.42, rz: 0.38 },
      { x: 1.25, z: 0.55, rx: 0.38, rz: 0.32 },
      { x: 0.95, z: 0.40, rx: 0.35, rz: 0.30 },
      { x: 1.60, z: 0.30, rx: 0.28, rz: 0.24 }, // Trailing trickle
    ];

    puddleLobes.forEach(({ x, z, rx, rz }) => {
      const lobe = new THREE.Mesh(new THREE.CircleGeometry(rx, 24), puddleMat);
      lobe.scale.set(1.0, rz / rx, 1.0);
      lobe.rotation.x = -Math.PI / 2;
      lobe.position.set(pos.x + x, 0.009, pos.z + z);
      lobe.receiveShadow = true;
      group.add(lobe);
    });

    // 5. Yellow PSX Caution Wet Floor Sign standing prominently next to spill
    try {
      const signGltf = await this._loadGLTF(SIGN_MODEL);
      const sign = signGltf.scene;
      this._normalizeProp(sign, 0.72);
      sign.position.set(pos.x + 1.85, 0, pos.z + 0.75);
      sign.rotation.y = -0.4;
      group.add(sign);
    } catch {
      this._buildProceduralSign(new THREE.Vector3(pos.x + 1.85, 0, pos.z + 0.75));
    }

    // 6. Focused overhead spotlight highlighting the spill and caution sign
    const spot = new THREE.SpotLight(0xffedd5, 3.2, 10, Math.PI / 3.5, 0.25);
    spot.position.set(pos.x + 1.2, 5.5, pos.z + 0.3);
    spot.target.position.set(pos.x + 1.2, 0, pos.z + 0.3);
    group.add(spot);
    group.add(spot.target);

    this.scene.add(group);
  }

  _buildProceduralSign(pos) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd60a, roughness: 0.4 });
    const sign = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 4), mat);
    sign.position.set(pos.x, 0.28, pos.z);
    this.scene.add(sign);
  }

  _addRoomPlacard(root, x, y, z, text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 80;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 512, 80);
    ctx.strokeStyle = '#f5a623'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, 504, 72);
    ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center'; ctx.fillText(text, 256, 48);
    const tex = new THREE.CanvasTexture(canvas);
    const placard = new THREE.Mesh(
      new THREE.PlaneGeometry(4.0, 0.6),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    placard.position.set(x, y, z);
    root.add(placard);
  }

  spawnCordonBarrier(stopId, targetPos) {
    if (this._cordonObjects.has(stopId)) return;

    // Center cordon around the exact hazard location
    const center = (stopId === 'stop_01')
      ? new THREE.Vector3(-1.45, 0, -6.2)
      : new THREE.Vector3(targetPos.x, targetPos.y || 0, targetPos.z);

    const group = new THREE.Group();
    group.name = `Cordon_${stopId}`;

    const coneMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.3 });
    const tapeMat = new THREE.MeshStandardMaterial({
      color: 0xffd60a,
      roughness: 0.4,
      emissive: 0xffd60a,
      emissiveIntensity: 0.5,
    });

    const radius = 1.15;
    const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    angles.forEach((a) => {
      const cx = center.x + Math.cos(a) * radius;
      const cz = center.z + Math.sin(a) * radius;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.55, 12), coneMat);
      cone.position.set(cx, 0.28, cz);
      cone.castShadow = true;
      group.add(cone);
    });

    for (let i = 0; i < 4; i++) {
      const a1 = angles[i];
      const a2 = angles[(i + 1) % 4];
      const p1 = new THREE.Vector3(center.x + Math.cos(a1) * radius, 0.42, center.z + Math.sin(a1) * radius);
      const p2 = new THREE.Vector3(center.x + Math.cos(a2) * radius, 0.42, center.z + Math.sin(a2) * radius);
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
