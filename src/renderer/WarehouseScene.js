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

const DAVE_PATH = '/assets/models/characters/dave.glb';
const ALEX_PATH = '/assets/models/characters/alex.glb';
const SIGN_MODEL = '/assets/models/environment/psx_wet_floor_sign.glb';
const FORKLIFT_MODEL = '/assets/models/environment/warehouse_forklift_gameready.glb';
const RACKING_MODEL = '/assets/models/environment/pallet_racking.glb';

export const STOP_ANCHORS = [
  { x: 0.6, y: 1.65, z: -4.0 },   // Stop 1: Chemical Drum Storage Warehouse
  { x: 0.3, y: 1.65, z: -13.5 },  // Stop 2: Blind Corner Forklift Crossing
  { x: 0.3, y: 1.65, z: -22.0 },  // Stop 3: High-Bay Bent Rack Upright
  { x: -0.4, y: 1.65, z: -30.0 }, // Stop 4: Battery Charging Station
  { x: 0.0, y: 1.65, z: -37.0 },  // Stop 5: Loading Dock & Dispatch
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
    await Promise.all([
      this._loadStop1Props(),
      this._loadStop2Props(),
      this._loadStop3Props(),
    ]);
  }

  /**
   * Builds the Grand Chemical Drum Storage Warehouse & Extended Forklift Transit Zone.
   */
  _buildDrumStorageWarehouse() {
    const root = new THREE.Group();
    root.name = 'DrumWarehouse';

    const width = 26;
    const depth = 56;
    const height = 8.5;
    const centerZ = -20.0;

    // ─── 1. Polished Concrete Epoxy Floor with Warm Reflections ───────
    const floorGeo = new THREE.PlaneGeometry(width, depth, 32, 32);
    const floorTex = this._createConcreteTexture();
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(10, 16);

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

    // ─── 3. Structural Concrete Warehouse Perimeter Walls ────────────
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, height, depth), wallMat);
    leftWall.position.set(-width / 2, height / 2, centerZ);
    root.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, height, depth), wallMat);
    rightWall.position.set(width / 2, height / 2, centerZ);
    root.add(rightWall);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.5), wallMat);
    backWall.position.set(0, height / 2, centerZ + depth / 2);
    root.add(backWall);

    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.5), wallMat);
    frontWall.position.set(0, height / 2, centerZ - depth / 2);
    root.add(frontWall);

    // ─── 4. Chemical Drum Pallets Strictly in Facility 01 (z = 4.0 to z = -8.0) ───
    const drumPositions = [
      { x: -5.8, z: 2.0, count: 4 },
      { x: -5.8, z: -3.0, count: 4 },
      { x: -5.8, z: -8.0, count: 4 },
      { x: 5.8, z: 2.0, count: 4 },
      { x: 5.8, z: -3.0, count: 3 },
      { x: 5.8, z: -8.0, count: 4 },
    ];

    for (const pos of drumPositions) {
      this._addDrumPalletStack(root, pos.x, pos.z, pos.count, 0x0284c7);
    }

    // ─── 5. Industrial Partition Firewall & Transit Archway 1 (z = -10.0) ──
    const firewallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const archwayLeft = new THREE.Mesh(new THREE.BoxGeometry(10.5, height, 0.4), firewallMat);
    archwayLeft.position.set(-7.75, height / 2, -10.0);
    root.add(archwayLeft);

    const archwayRight = new THREE.Mesh(new THREE.BoxGeometry(10.5, height, 0.4), firewallMat);
    archwayRight.position.set(7.75, height / 2, -10.0);
    root.add(archwayRight);

    const archwayTop = new THREE.Mesh(new THREE.BoxGeometry(width, height - 4.5, 0.4), firewallMat);
    archwayTop.position.set(0, height - (height - 4.5) / 2, -10.0);
    root.add(archwayTop);

    // Yellow/Black Caution Clearance Header on Archway
    const hazardStripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
    const clearanceBar = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.25, 0.45), hazardStripeMat);
    clearanceBar.position.set(0, 4.4, -10.0);
    root.add(clearanceBar);

    this._addRoomPlacard(root, 0, 4.8, -9.7, 'ZONE 02 TRANSIT | CAUTION: FORKLIFT CROSS-TRAFFIC');

    // ─── 6. Industrial Partition Firewall & Transit Archway 2 (z = -28.0) ──
    const archway2Left = new THREE.Mesh(new THREE.BoxGeometry(10.5, height, 0.4), firewallMat);
    archway2Left.position.set(-7.75, height / 2, -28.0);
    root.add(archway2Left);

    const archway2Right = new THREE.Mesh(new THREE.BoxGeometry(10.5, height, 0.4), firewallMat);
    archway2Right.position.set(7.75, height / 2, -28.0);
    root.add(archway2Right);

    const archway2Top = new THREE.Mesh(new THREE.BoxGeometry(width, height - 4.5, 0.4), firewallMat);
    archway2Top.position.set(0, height - (height - 4.5) / 2, -28.0);
    root.add(archway2Top);

    const clearanceBar2 = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.25, 0.45), hazardStripeMat);
    clearanceBar2.position.set(0, 4.4, -28.0);
    root.add(clearanceBar2);

    this._addRoomPlacard(root, 0, 4.8, -27.7, 'ZONE 04 TRANSIT | BATTERY CHARGING BAY');

    // ─── 7. Green Overhead Roof Trusses & Warm Lighting ─────
    this._buildGreenRoofTrusses(root, width, depth, height, centerZ);
    this._buildWarmIndustrialLighting(root, centerZ);

    this._addRoomPlacard(root, 0, 6.2, centerZ + depth / 2 - 1.5, 'FACILITY 01 | HAZMAT CHEMICAL DRUM STORAGE');

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

  /**
   * Stop 2: High-Bay Pallet Racking & Active Forklift Traffic (Matching Reference Photo).
   */
  async _loadStop2Props() {
    const group = new THREE.Group();
    group.name = 'Stop2_ForkliftJunction';

    const crossingZ = -18.0;

    // 1. High-Visibility Yellow/Black Zebra Crossing on Walkway Floor
    const stripeMatYellow = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.35,
      emissive: 0x713f12,
      emissiveIntensity: 0.2,
    });
    const stripeMatBlack = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });

    for (let zOff = -1.8; zOff <= 1.8; zOff += 0.45) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 0.22),
        (Math.round(zOff * 10) % 2 === 0) ? stripeMatYellow : stripeMatBlack
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.006, crossingZ + zOff);
      stripe.receiveShadow = true;
      group.add(stripe);
    }

    // 2. Authentic High-Bay Industrial Racking (Blue Uprights + Orange Beams from Photo)
    this._buildHighBayRacksWithCargo(group, crossingZ);

    // 3. Game-Ready Industrial Forklift with Seated Operator & Loaded Pallet on Forks
    const forkliftGroup = new THREE.Group();
    forkliftGroup.name = 'AnimatedForklift';
    forkliftGroup.position.set(-5.5, 0, crossingZ); // Starts in side cross-aisle
    forkliftGroup.rotation.y = Math.PI / 2; // Facing across the main aisle

    try {
      const forkliftGltf = await this._loadGLTF(FORKLIFT_MODEL);
      const forklift = forkliftGltf.scene;
      this._normalizeProp(forklift, 2.35);
      forklift.position.set(0, 0, 0);
      forkliftGroup.add(forklift);
    } catch {
      // Procedural heavy industrial forklift body
      const forkMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.25, metalness: 0.6 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 2.2), forkMat);
      body.position.set(0, 0.7, 0);
      forkliftGroup.add(body);
    }

    // 4. Tall Stacked Cargo Boxes on Forklift Pallet (Blocking Driver Sightline)
    const cargoPallet = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.12, 1.15),
      new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 })
    );
    cargoPallet.position.set(0, 0.24, 1.55);
    forkliftGroup.add(cargoPallet);

    // Box Materials
    const cardboardMat1 = new THREE.MeshStandardMaterial({ color: 0xd4bda8, roughness: 0.45 });
    const cardboardMat2 = new THREE.MeshStandardMaterial({ color: 0xc4a482, roughness: 0.45 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 });
    const labelMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });

    // Tier 1 (Bottom): 4 Boxes
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.52, 0.52), cardboardMat1);
    b1.position.set(-0.3, 0.56, 1.3);
    forkliftGroup.add(b1);

    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.52, 0.52), cardboardMat2);
    b2.position.set(0.3, 0.56, 1.3);
    forkliftGroup.add(b2);

    const b3 = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.52, 0.52), crateMat);
    b3.position.set(-0.3, 0.56, 1.8);
    forkliftGroup.add(b3);

    const b4 = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.52, 0.52), cardboardMat1);
    b4.position.set(0.3, 0.56, 1.8);
    forkliftGroup.add(b4);

    // Tier 2 (Middle): 4 Stacked Boxes
    const b5 = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.48, 0.5), cardboardMat2);
    b5.position.set(-0.29, 1.06, 1.32);
    forkliftGroup.add(b5);

    const b6 = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.48, 0.5), cardboardMat1);
    b6.position.set(0.29, 1.06, 1.32);
    forkliftGroup.add(b6);

    const b7 = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.48, 0.5), cardboardMat1);
    b7.position.set(-0.29, 1.06, 1.78);
    forkliftGroup.add(b7);

    const b8 = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.48, 0.5), crateMat);
    b8.position.set(0.29, 1.06, 1.78);
    forkliftGroup.add(b8);

    // Tier 3 (Top Overload): Tall Top Carton (Reaching 1.75m — Blocks Sightline!)
    const bTop = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.45, 0.95), cardboardMat1);
    bTop.position.set(0, 1.52, 1.55);
    forkliftGroup.add(bTop);

    // Fragile / Warning Labels on Stack Face
    const warnLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18), labelMat);
    warnLabel.position.set(0, 1.52, 2.04);
    forkliftGroup.add(warnLabel);

    // Translucent Plastic Stretch Wrap enveloping the entire tall stack
    const wrapMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.28,
      roughness: 0.05,
      metalness: 0.9,
    });
    const stretchWrap = new THREE.Mesh(new THREE.BoxGeometry(1.22, 1.48, 1.12), wrapMat);
    stretchWrap.position.set(0, 1.04, 1.55);
    forkliftGroup.add(stretchWrap);

    // 5. Human Forklift Operator in Driver's Seat (From Reference Photo)
    const operatorGroup = new THREE.Group();
    operatorGroup.position.set(0, 0.95, 0.15); // Seated in cabin

    // Torso (Orange high-vis work shirt)
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.55, 12), shirtMat);
    torso.position.y = 0.35;
    operatorGroup.add(torso);

    // Head + Blue Safety Hardhat
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc68642, roughness: 0.6 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skinMat);
    head.position.y = 0.72;
    operatorGroup.add(head);

    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 }); // Blue hardhat from photo
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.8), helmetMat);
    helmet.position.set(0, 0.76, 0);
    operatorGroup.add(helmet);

    // Arms reaching for steering wheel
    const armMat = new THREE.MeshStandardMaterial({ color: 0xc68642, roughness: 0.6 });
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.35, 8), armMat);
    leftArm.position.set(-0.16, 0.38, 0.18);
    leftArm.rotation.x = Math.PI / 3;
    operatorGroup.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.35, 8), armMat);
    rightArm.position.set(0.16, 0.38, 0.18);
    rightArm.rotation.x = Math.PI / 3;
    operatorGroup.add(rightArm);

    // Seated Legs (Dark work pants)
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const upperLegs = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.38), pantsMat);
    upperLegs.position.set(0, 0.07, 0.16);
    operatorGroup.add(upperLegs);

    forkliftGroup.add(operatorGroup);

    // 6. Amber Safety Warning Strobe Beacon on Roll Cage
    const strobeBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.14, 12),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 2.0 })
    );
    strobeBeacon.position.set(-0.25, 2.25, -0.4);
    forkliftGroup.add(strobeBeacon);

    const strobeLight = new THREE.PointLight(0xf59e0b, 2.5, 6);
    strobeLight.position.set(-0.25, 2.3, -0.4);
    forkliftGroup.add(strobeLight);

    // 7. Headlights casting forward beam onto crossing
    const headlight = new THREE.SpotLight(0xfffbeb, 5.0, 16, Math.PI / 4, 0.3);
    headlight.position.set(0, 1.2, 1.2);
    headlight.target.position.set(0, 0.2, 8.0);
    forkliftGroup.add(headlight);
    forkliftGroup.add(headlight.target);

    group.add(forkliftGroup);
    this._forklift = forkliftGroup;
    this._strobeLight = strobeLight;

    // 8. Parked Stationary (Non-Working) Forklift in Circled Left Staging Alcove (Empty, engine off)
    const parkedForkliftLeft = this._buildStationaryForklift(-7.6, crossingZ + 3.4, Math.PI / 8);
    group.add(parkedForkliftLeft);

    // 9. Parked Stationary (Non-Working) Forklift in Right Staging Bay
    const parkedForkliftRight = this._buildStationaryForklift(7.2, crossingZ, -Math.PI / 2);
    group.add(parkedForkliftRight);

    // 10. Overhead Facility Warning Placard
    this._addRoomPlacard(group, 0, 5.8, crossingZ + 3.2, 'FACILITY 02 | HIGH-BAY LOGISTICS & ACTIVE FORKLIFT CROSSING');

    this.scene.add(group);
  }

  /**
   * Builds a parked, stationary (non-working) industrial forklift in an equipment bay.
   */
  _buildStationaryForklift(x, z, rotY) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotY;

    // Yellow equipment parking bay outline on floor
    const outlineMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.1), outlineMat);
    p1.rotation.x = -Math.PI / 2;
    p1.position.set(0, 0.004, 1.6);
    group.add(p1);

    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.1), outlineMat);
    p2.rotation.x = -Math.PI / 2;
    p2.position.set(0, 0.004, -1.6);
    group.add(p2);

    // Forklift Chassis (Matching vibrant industrial orange)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3, metalness: 0.55 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.75, 2.1), bodyMat);
    chassis.position.set(0, 0.52, 0);
    chassis.castShadow = true;
    group.add(chassis);

    // Roll Cage & Overhead Guard
    const cage = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.25, 1.25), darkMat);
    cage.position.set(0, 1.45, -0.2);
    group.add(cage);

    // Steering Column & Wheel
    const steerCol = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), darkMat);
    steerCol.position.set(0, 1.05, 0.25);
    steerCol.rotation.x = -Math.PI / 6;
    group.add(steerCol);

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 8, 16), wheelMat);
    wheel.position.set(0, 1.25, 0.15);
    wheel.rotation.x = Math.PI / 3;
    group.add(wheel);

    // Seated Operator (Worker in high-vis shirt and hardhat)
    const opGroup = new THREE.Group();
    opGroup.position.set(0, 0.88, -0.15);

    // Head + Hardhat
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0a98b, roughness: 0.6 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), skinMat);
    head.position.set(0, 0.68, 0);
    opGroup.add(head);

    const hardhatMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 });
    const hardhat = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), hardhatMat);
    hardhat.position.set(0, 0.72, 0);
    opGroup.add(hardhat);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 12), hardhatMat);
    brim.position.set(0, 0.71, 0.03);
    opGroup.add(brim);

    // High-Vis Orange Torso + Reflective Safety Stripes
    const torsoMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.5 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.22), torsoMat);
    torso.position.set(0, 0.38, 0);
    opGroup.add(torso);

    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2 });
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.23), stripeMat);
    s1.position.set(0, 0.38, 0);
    opGroup.add(s1);

    // Arms on Steering Wheel
    const armMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.5 });
    const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.35, 8), armMat);
    lArm.position.set(-0.16, 0.38, 0.18);
    lArm.rotation.x = Math.PI / 3;
    opGroup.add(lArm);

    const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.35, 8), armMat);
    rArm.position.set(0.16, 0.38, 0.18);
    rArm.rotation.x = Math.PI / 3;
    opGroup.add(rArm);

    // Seated Legs (Dark work pants)
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.38), pantsMat);
    legs.position.set(0, 0.07, 0.16);
    opGroup.add(legs);

    group.add(opGroup);

    // Mast & Heavy Lifting Forks
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.0, 0.12), darkMat);
    mast.position.set(0, 1.05, 1.05);
    group.add(mast);

    const fork1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 1.1), darkMat);
    fork1.position.set(-0.25, 0.05, 1.6);
    group.add(fork1);

    const fork2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 1.1), darkMat);
    fork2.position.set(0.25, 0.05, 1.6);
    group.add(fork2);

    // Wooden Pallet with Cardboard Cargo Box on Forks
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.0), woodMat);
    pallet.position.set(0, 0.06, 1.6);
    group.add(pallet);

    const cargoBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.7, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xd4bda8, roughness: 0.45 })
    );
    cargoBox.position.set(0, 0.46, 1.6);
    cargoBox.castShadow = true;
    group.add(cargoBox);

    // Unpowered Amber Beacon (Off)
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 })
    );
    beacon.position.set(-0.25, 2.1, -0.3);
    group.add(beacon);

    return group;
  }

  /**
   * Builds High-Bay Industrial Racking with Orange Beams, Blue Uprights & Pallet Cargo (Matching Photo).
   */
  _buildHighBayRacksWithCargo(root, crossingZ) {
    const blueUprightMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.35, metalness: 0.7 });
    const orangeBeamMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.3, metalness: 0.6 });
    const yellowLabelMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.4 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xd4bda8, roughness: 0.4 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 });

    // Left and Right High-Bay Racks
    const rackSides = [-4.6, 4.6];
    const rackZPositions = [crossingZ + 3.2, crossingZ - 3.2];

    rackSides.forEach((rx) => {
      rackZPositions.forEach((rz) => {
        const rackGroup = new THREE.Group();
        rackGroup.position.set(rx, 0, rz);

        const rackWidth = 1.4;
        const rackLength = 4.2;
        const rackHeight = 6.8;

        // 4 Blue Vertical Columns (Uprights)
        const colOffsets = [
          { x: -rackWidth / 2, z: -rackLength / 2 },
          { x: rackWidth / 2, z: -rackLength / 2 },
          { x: -rackWidth / 2, z: rackLength / 2 },
          { x: rackWidth / 2, z: rackLength / 2 },
        ];
        colOffsets.forEach(({ x, z }) => {
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.12, rackHeight, 0.12), blueUprightMat);
          col.position.set(x, rackHeight / 2, z);
          col.castShadow = true;
          rackGroup.add(col);
        });

        // 4 Tiers of Orange Horizontal Beams + Yellow Barcode Labels + Cargo
        const beamHeights = [1.6, 3.2, 4.8, 6.4];
        beamHeights.forEach((by) => {
          // Front and Back Orange Beams
          const beamFront = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, rackLength), orangeBeamMat);
          beamFront.position.set(rx > 0 ? -rackWidth / 2 : rackWidth / 2, by, 0);
          rackGroup.add(beamFront);

          const beamBack = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, rackLength), orangeBeamMat);
          beamBack.position.set(rx > 0 ? rackWidth / 2 : -rackWidth / 2, by, 0);
          rackGroup.add(beamBack);

          // Yellow Safety Barcode / Capacity Labels on beam face
          const label = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.08), yellowLabelMat);
          label.position.set(rx > 0 ? -rackWidth / 2 - 0.05 : rackWidth / 2 + 0.05, by, 0);
          label.rotation.y = rx > 0 ? -Math.PI / 2 : Math.PI / 2;
          rackGroup.add(label);

          // Loaded Pallets & Cargo Boxes on this tier
          const palletOffsets = [-1.3, 0, 1.3];
          palletOffsets.forEach((pz) => {
            const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.0), woodMat);
            pallet.position.set(0, by + 0.06, pz);
            rackGroup.add(pallet);

            const isCrate = Math.random() > 0.5;
            const cargo = new THREE.Mesh(
              new THREE.BoxGeometry(1.0, 0.85, 0.85),
              isCrate ? crateMat : boxMat
            );
            cargo.position.set(0, by + 0.54, pz);
            cargo.castShadow = true;
            rackGroup.add(cargo);
          });
        });

        root.add(rackGroup);
      });
    });
  }

  /**
   * Stop 3: High-Bay Pallet Racking with Buckled / Bent Structural Steel Upright.
   */
  async _loadStop3Props() {
    const group = new THREE.Group();
    group.name = 'Stop3_BentRackZone';

    const rackZ = -24.5;
    this._buildHighBayRacksWithCargo(group, rackZ);

    // ─── Damaged / Bent Structural Steel Upright Column at x: 2.1, z: -24.5 ───
    const damagedColumnGroup = new THREE.Group();
    damagedColumnGroup.position.set(2.1, 0, rackZ);

    const blueSteelMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.3,
      metalness: 0.8,
    });
    const bentMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Impact scrape showing primer/metal
      roughness: 0.4,
      metalness: 0.7,
    });

    // 1. Lower base column (from floor to collision point)
    const baseLeg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), blueSteelMat);
    baseLeg.position.set(0, 0.225, 0);
    damagedColumnGroup.add(baseLeg);

    // 2. Buckled / Kinked Elbow (Collision point from previous forklift impact)
    const kinkedElbow = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.55, 0.13), bentMat);
    kinkedElbow.position.set(-0.16, 0.65, 0.08);
    kinkedElbow.rotation.z = -0.38; // Angled kink jutting outward
    kinkedElbow.rotation.y = 0.15;
    damagedColumnGroup.add(kinkedElbow);

    // 3. Upper tilted column connecting to upper load beam
    const upperLeg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.8, 0.12), blueSteelMat);
    upperLeg.position.set(-0.06, 3.8, 0.03);
    upperLeg.rotation.z = 0.04;
    damagedColumnGroup.add(upperLeg);

    // 4. Crumpled Steel Floor Footplate & Anchors
    const footplate = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.03, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 })
    );
    footplate.position.set(0, 0.015, 0);
    damagedColumnGroup.add(footplate);

    // 5. High-Vis Warning Marker on Bent Upright
    const warningCanvas = document.createElement('canvas');
    warningCanvas.width = 256; warningCanvas.height = 128;
    const wctx = warningCanvas.getContext('2d');
    wctx.fillStyle = '#facc15'; wctx.fillRect(0, 0, 256, 128);
    wctx.fillStyle = '#0f172a';
    wctx.font = 'bold 24px sans-serif';
    wctx.textAlign = 'center';
    wctx.fillText('⚠️ DEFECT', 128, 48);
    wctx.font = 'bold 16px sans-serif';
    wctx.fillText('BENT UPRIGHT', 128, 80);
    wctx.font = '12px sans-serif';
    wctx.fillText('ACTION REQUIRED', 128, 105);
    const tagTex = new THREE.CanvasTexture(warningCanvas);

    const defectTag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.38, 0.22),
      new THREE.MeshBasicMaterial({ map: tagTex })
    );
    defectTag.position.set(-0.25, 0.95, 0.12);
    defectTag.rotation.y = -Math.PI / 6;
    damagedColumnGroup.add(defectTag);

    group.add(damagedColumnGroup);

    // 6. Overhead Facility Placard
    this._addRoomPlacard(group, 0, 5.8, rackZ + 4.0, 'FACILITY 03 | HIGH-BAY STORAGE & STRUCTURAL RACKING AISLE B');

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
      : (stopId === 'stop_03')
        ? new THREE.Vector3(2.1, 0, -24.5)
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

    // Dynamic Forklift Traffic across the Blind Cross-Aisle Intersection
    if (this._forklift) {
      // Smooth transit motion: drives from side cross-aisle toward the crossing
      const t = elapsed * 0.65;
      const progress = (Math.sin(t) + 1) * 0.5; // 0 to 1
      this._forklift.position.x = -6.2 + progress * 3.8; // Drives between -6.2m and -2.4m

      // Subtle engine vibration / suspension bounce
      this._forklift.position.y = Math.abs(Math.sin(elapsed * 7)) * 0.01;

      // Flashing Amber Safety Strobe Beacon on Roll Cage
      if (this._strobeLight) {
        this._strobeLight.intensity = (Math.sin(elapsed * 14) > 0.15) ? 3.8 : 0.3;
      }
    }
  }
}
