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

// ─── Hazard cordon geometry ─────────────────────────────────────────────────
const CORDON_CLEARANCE = 1.0;    // m of standoff wanted on every side of a hazard
const CORDON_STANDOFF = 0.6;     // m outside the tape a trainee stands afterwards
const CONE_HEIGHT = 0.75;        // m — a standard UK traffic cone is 750mm
const CONE_BASE_RADIUS = 0.16;   // m
const TAPE_HEIGHT = 0.55;        // m — sits high on the cone and clears the tipped drum (top 0.45m)
const TAPE_WIDTH = 0.09;         // m — barrier tape is roughly 75-100mm
const TAPE_STRIPE_PITCH = 0.6;   // m of tape per texture repeat, so stripes never stretch

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
    // Hazard footprints, registered by whichever _loadStopNProps built them, so
    // spawnCordonBarrier can size a cordon to the hazard instead of guessing.
    // Each entry: { box: THREE.Box3, clamp: { xMin?, xMax?, zMin?, zMax? } }
    // The clamps record where the warehouse physically blocks the full standoff.
    this._hazardBounds = new Map();
    // The rectangle actually built per stop, so we can place a trainee outside it.
    this._cordonRects = new Map();
    this._stopGroups = new Map();
    this._activeStopId = 'stop_01';
  }

  async load() {
    this._buildDrumStorageWarehouse();
    await Promise.all([
      this._loadStop1Props(),
      this._loadStop2Props(),
      this._loadStop3Props(),
    ]);
    this.setActiveStop('stop_01');
  }

  /**
   * Isolates active stop objects and dynamic machinery so they never interfere with adjacent rooms.
   * @param {string} stopId
   */
  setActiveStop(stopId) {
    this._activeStopId = stopId;

    // Strict Stop-Level Visibility & Occlusion Management:
    if (this._stopGroups.has('stop_01')) {
      this._stopGroups.get('stop_01').visible = (stopId === 'stop_01' || stopId === 'stop_02');
    }

    if (this._stopGroups.has('stop_02')) {
      // Dynamic Stop 2 Forklift machinery is visible ONLY in Stop 1 and Stop 2. Completely hidden in Stop 3+
      this._stopGroups.get('stop_02').visible = (stopId === 'stop_01' || stopId === 'stop_02');
    }

    if (this._stopGroups.has('stop_03')) {
      // Stop 3 Pallet Racking & Hazard Upright is active in Stop 2, 3, 4
      this._stopGroups.get('stop_03').visible = (stopId === 'stop_02' || stopId === 'stop_03' || stopId === 'stop_04');
    }

    if (this._stopGroups.has('stop_04')) {
      this._stopGroups.get('stop_04').visible = (stopId === 'stop_03' || stopId === 'stop_04' || stopId === 'stop_05');
    }

    if (this._stopGroups.has('stop_05')) {
      this._stopGroups.get('stop_05').visible = (stopId === 'stop_04' || stopId === 'stop_05');
    }
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

    // ─── 6. Industrial Partition Firewall & Archway 2 (z = -18.8) (Dividing Forklift Crossing from Racking) ──
    const archway2Left = new THREE.Mesh(new THREE.BoxGeometry(10.5, height, 0.4), firewallMat);
    archway2Left.position.set(-7.75, height / 2, -18.8);
    root.add(archway2Left);

    const archway2Right = new THREE.Mesh(new THREE.BoxGeometry(10.5, height, 0.4), firewallMat);
    archway2Right.position.set(7.75, height / 2, -18.8);
    root.add(archway2Right);

    const archway2Top = new THREE.Mesh(new THREE.BoxGeometry(width, height - 4.5, 0.4), firewallMat);
    archway2Top.position.set(0, height - (height - 4.5) / 2, -18.8);
    root.add(archway2Top);

    const clearanceBar2 = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.25, 0.45), hazardStripeMat);
    clearanceBar2.position.set(0, 4.4, -18.8);
    root.add(clearanceBar2);

    this._addRoomPlacard(root, 0, 4.8, -18.5, 'ZONE 03 | HIGH-BAY STORAGE & STRUCTURAL RACKING AISLE B');

    // ─── 7. Industrial Partition Firewall & Transit Archway 3 (z = -28.5) (To Battery Bay) ──
    const archway3Left = new THREE.Mesh(new THREE.BoxGeometry(10.5, height, 0.4), firewallMat);
    archway3Left.position.set(-7.75, height / 2, -28.5);
    root.add(archway3Left);

    const archway3Right = new THREE.Mesh(new THREE.BoxGeometry(10.5, height, 0.4), firewallMat);
    archway3Right.position.set(7.75, height / 2, -28.5);
    root.add(archway3Right);

    const archway3Top = new THREE.Mesh(new THREE.BoxGeometry(width, height - 4.5, 0.4), firewallMat);
    archway3Top.position.set(0, height - (height - 4.5) / 2, -28.5);
    root.add(archway3Top);

    const clearanceBar3 = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.25, 0.45), hazardStripeMat);
    clearanceBar3.position.set(0, 4.4, -28.5);
    root.add(clearanceBar3);

    this._addRoomPlacard(root, 0, 4.8, -28.2, 'ZONE 04 TRANSIT | BATTERY CHARGING BAY');

    // ─── 8. Green Overhead Roof Trusses & Warm Lighting ─────
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
   * Warm industrial high-bay lighting casting warm reflections on epoxy floor across all facilities.
   */
  _buildWarmIndustrialLighting(root, centerZ) {
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, emissive: 0xffedd5, emissiveIntensity: 2.5 });

    // 1. Ambient & Hemisphere fill lighting for crisp warehouse visibility
    const ambientLight = new THREE.AmbientLight(0xffedd5, 1.1);
    root.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffedd5, 0x1e293b, 0.85);
    root.add(hemiLight);

    // 2. High-bay ceiling lamps along the main aisle across all 5 facilities
    const aisleZStations = [
      4.0, -1.0, -6.0,   // Facility 01 (Chemical Drums)
      -11.5, -15.5,      // Facility 02 (Forklift Transit Crossing)
      -20.5, -24.5,      // Facility 03 (High-Bay Storage & Racking)
      -29.5, -33.5,      // Facility 04 (Battery Bay)
      -38.0, -42.0       // Facility 05 (Loading Dock)
    ];

    aisleZStations.forEach((z) => {
      [-4.5, 0, 4.5].forEach((x) => {
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.48, 0.22, 12), lampMat);
        lamp.position.set(x, 7.8, z);
        root.add(lamp);

        const light = new THREE.PointLight(0xffedd5, 1.3, 20, 1.2);
        light.position.set(x, 7.4, z);
        root.add(light);
      });
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

    // Register the spill's footprint so the cordon can be sized to it. Only the
    // puddle is the thing being cordoned; the pallet and the standing drums are
    // storage, not spill, so they are deliberately excluded from the box.
    const spillBox = new THREE.Box3();
    puddleLobes.forEach(({ x, z, rx, rz }) => {
      spillBox.expandByPoint(new THREE.Vector3(pos.x + x - rx, 0, pos.z + z - rz));
      spillBox.expandByPoint(new THREE.Vector3(pos.x + x + rx, 0, pos.z + z + rz));
    });
    this._hazardBounds.set('stop_01', {
      box: spillBox,
      // Sides where a full standoff will not fit. Measured against this scene:
      //   xMin: the drum pallet occupies x[-3.70, -2.30]
      //   zMin: the partition wall / racking occupies z[-7.61, -7.39]
      // The other two sides are open walkway and get the full clearance.
      clamp: { xMin: -2.15, zMin: -7.30 },
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
      // Kept so the other units in this zone can clone it instead of being
      // rebuilt out of boxes. clone() shares geometry and material, so each
      // extra unit costs one draw call and no additional GPU memory.
      this._forkliftModel = forklift;
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

    // Torso (high-vis work shirt with reflective banding, matching the other
    // two operators in this zone).
    // PALETTE EXEMPTION - deliberate, see the cordon note in spawnCordonBarrier.
    // Hi-vis workwear is orange because that is what makes a person on a
    // warehouse floor readable at a glance. Not a brand colour, do not align it
    // to the palette in main.css.
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.75, metalness: 0.0 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.35 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.55, 12), shirtMat);
    torso.position.y = 0.35;
    operatorGroup.add(torso);

    const torsoBand = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.175, 0.06, 12), stripeMat);
    torsoBand.position.y = 0.42;
    operatorGroup.add(torsoBand);

    // Head + Blue Safety Hardhat
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc68642, roughness: 0.6 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skinMat);
    head.position.y = 0.72;
    operatorGroup.add(head);

    // A hard hat is a dome, so the sphere must stop at its equator. Math.PI/1.8
    // is 100 degrees, which bulges back under itself and reads as a ball.
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.135, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      helmetMat,
    );
    helmet.position.set(0, 0.76, 0);
    operatorGroup.add(helmet);

    const helmetBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 12), helmetMat);
    helmetBrim.position.set(0, 0.75, 0.03);
    operatorGroup.add(helmetBrim);

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

    // 8. Working Forklift in Left Staging Lane (driving along Z safely behind firewall)
    const workingForkliftLeft = this._buildWorkingForklift(-7.5, crossingZ + 2.2, Math.PI, 0.0, 'z-drive');
    group.add(workingForkliftLeft);
    this._addStagingCargoArea(group, -8.2, crossingZ + 2.0, true);

    // 9. Working Forklift in Right Staging Bay (driving along X shuttling pallets to staging wall)
    const workingForkliftRight = this._buildWorkingForklift(7.2, crossingZ + 1.0, -Math.PI / 2, Math.PI, 'x-drive');
    group.add(workingForkliftRight);
    this._addStagingCargoArea(group, 8.2, crossingZ + 1.0, false);

    // 10. Overhead Facility Warning Placard
    this._addRoomPlacard(group, 0, 5.8, crossingZ + 3.2, 'FACILITY 02 | HIGH-BAY LOGISTICS & ACTIVE FORKLIFT CROSSING');

    this.scene.add(group);
  }

  /**
   * Adds dense multi-tier staging racks, freight pallets, and cardboard cargo box stacks strictly contained within Facility 02.
   */
  _addStagingCargoArea(root, originX, originZ, isLeft) {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xd4bda8, roughness: 0.45 });
    const orangeBoxMat = new THREE.MeshStandardMaterial({ color: 0xc27a42, roughness: 0.5 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
    const rackBlueMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.4 });
    const rackOrangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.35 });

    // 1. Wall Cargo Staging Rack (2-Tier Industrial Storage Rack along wall strictly in Facility 02)
    const rackGroup = new THREE.Group();
    const rackX = isLeft ? -9.8 : 9.8;
    rackGroup.position.set(rackX, 0, originZ);

    const rWidth = 1.1;
    const rLength = 3.6;
    const rHeight = 3.2;

    // Uprights
    [-rLength / 2, 0, rLength / 2].forEach((rz) => {
      [-rWidth / 2, rWidth / 2].forEach((rx) => {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.1, rHeight, 0.1), rackBlueMat);
        col.position.set(rx, rHeight / 2, rz);
        rackGroup.add(col);
      });
    });

    // Beams & Stored Cargo Tiers
    [1.3, 2.5].forEach((by) => {
      const beamFront = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, rLength), rackOrangeMat);
      beamFront.position.set(isLeft ? rWidth / 2 : -rWidth / 2, by, 0);
      rackGroup.add(beamFront);

      const beamBack = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, rLength), rackOrangeMat);
      beamBack.position.set(isLeft ? -rWidth / 2 : rWidth / 2, by, 0);
      rackGroup.add(beamBack);

      // Pallets & Cargo Boxes on this rack shelf
      [-1.2, 0.0, 1.2].forEach((pz) => {
        const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 1.0), woodMat);
        pallet.position.set(0, by + 0.05, pz);
        rackGroup.add(pallet);

        const isCrate = Math.random() > 0.5;
        const cargo = new THREE.Mesh(
          new THREE.BoxGeometry(0.85, 0.65, 0.85),
          isCrate ? crateMat : (Math.random() > 0.5 ? orangeBoxMat : boxMat)
        );
        cargo.position.set(0, by + 0.42, pz);
        cargo.castShadow = true;
        rackGroup.add(cargo);
      });
    });
    root.add(rackGroup);

    // 2. Floor Pallet Cargo Stacks strictly within Facility 02 bounds
    const floorOffsets = isLeft
      ? [
          { dx: 1.5, dz: 1.2, h: 3, type: 'boxes' },
          { dx: 1.6, dz: -1.2, h: 3, type: 'mixed' },
          { dx: 0.0, dz: 1.6, h: 2, type: 'crates' },
          { dx: 0.0, dz: -1.6, h: 3, type: 'boxes' },
        ]
      : [
          { dx: -1.5, dz: 1.2, h: 3, type: 'boxes' },
          { dx: -1.6, dz: -1.2, h: 3, type: 'crates' },
          { dx: 0.0, dz: 1.6, h: 3, type: 'mixed' },
          { dx: 0.0, dz: -1.6, h: 3, type: 'boxes' },
        ];

    floorOffsets.forEach(({ dx, dz, h, type }) => {
      const stackGroup = new THREE.Group();
      stackGroup.position.set(originX + dx, 0, originZ + dz);

      const basePallet = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 1.1), woodMat);
      basePallet.position.set(0, 0.05, 0);
      basePallet.receiveShadow = true;
      stackGroup.add(basePallet);

      if (type === 'crates') {
        for (let i = 0; i < h; i++) {
          const crate = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.42, 0.85), crateMat);
          crate.position.set(0, 0.1 + 0.21 + i * 0.44, 0);
          crate.castShadow = true;
          stackGroup.add(crate);
        }
      } else if (type === 'boxes') {
        for (let i = 0; i < h; i++) {
          const bw = 0.82 - i * 0.05;
          const box = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.38, bw), i % 2 === 0 ? boxMat : orangeBoxMat);
          box.position.set(0, 0.1 + 0.19 + i * 0.4, 0);
          box.castShadow = true;
          stackGroup.add(box);

          // Shipping manifest / barcode tag
          const label = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.12), stripeMat);
          label.position.set(0, 0.1 + 0.19 + i * 0.4, bw / 2 + 0.01);
          stackGroup.add(label);
        }
      } else {
        // Multi-tier mixed freight stack
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), boxMat);
        b1.position.set(-0.2, 0.32, -0.2);
        b1.castShadow = true;
        stackGroup.add(b1);

        const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), orangeBoxMat);
        b2.position.set(0.2, 0.32, 0.2);
        b2.castShadow = true;
        stackGroup.add(b2);

        const topCrate = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.38, 0.75), crateMat);
        topCrate.position.set(0, 0.72, 0);
        topCrate.castShadow = true;
        stackGroup.add(topCrate);
      }

      root.add(stackGroup);
    });
  }

  /**
   * Builds an active, operational industrial forklift with working hydraulic carriage and cargo pallet.
   */
  _buildWorkingForklift(x, z, rotY, animOffset = 0, driveType = 'z-drive') {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotY;

    // Yellow equipment parking bay outline on floor
    const outlineMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.1), outlineMat);
    p1.rotation.x = -Math.PI / 2;
    p1.position.set(0, 0.004, 1.8);
    group.add(p1);

    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.1), outlineMat);
    p2.rotation.x = -Math.PI / 2;
    p2.position.set(0, 0.004, -1.8);
    group.add(p2);

    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });

    // Vehicle body. Prefer a clone of the same GLB the animated unit uses, so
    // every forklift in the zone is the same machine at the same fidelity.
    // clone() shares geometry and material with the original: one extra draw
    // call per unit and no new GPU memory, against the 22 flat-shaded
    // primitives this used to be built from.
    const usingModel = Boolean(this._forkliftModel);
    if (usingModel) {
      const body = this._forkliftModel.clone(true);
      body.position.set(0, 0, 0);
      body.rotation.set(0, 0, 0);
      body.scale.copy(this._forkliftModel.scale);
      group.add(body);
    } else {
      // Fallback, unchanged: only reached if the GLB failed to load.
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3, metalness: 0.55 });

      const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.75, 2.1), bodyMat);
      chassis.position.set(0, 0.52, 0);
      chassis.castShadow = true;
      group.add(chassis);

      const cage = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.25, 1.25), darkMat);
      cage.position.set(0, 1.45, -0.2);
      group.add(cage);

      const steerCol = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), darkMat);
      steerCol.position.set(0, 1.05, 0.25);
      steerCol.rotation.x = -Math.PI / 6;
      group.add(steerCol);

      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 8, 16), wheelMat);
      wheel.position.set(0, 1.25, 0.15);
      wheel.rotation.x = Math.PI / 3;
      group.add(wheel);
    }

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

    // High-Vis Orange Torso + Reflective Safety Stripes.
    // PALETTE EXEMPTION - deliberate, same reasoning as the cordon: hi-vis
    // workwear is orange so a person reads instantly against warehouse clutter.
    // Shared with the operator on the animated unit so all three match.
    const torsoMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.75, metalness: 0.0 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.22), torsoMat);
    torso.position.set(0, 0.38, 0);
    opGroup.add(torso);

    // Retroreflective banding is silver-grey, not yellow.
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.35 });
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.23), bandMat);
    s1.position.set(0, 0.38, 0);
    opGroup.add(s1);

    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2 });

    // Arms on Steering Wheel
    const armMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.75 });
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

    // Mast and forks are part of the model, so they are only built by hand when
    // the fallback body is in use — otherwise they would double up on the GLB's.
    if (!usingModel) {
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 0.12), darkMat);
      mast.position.set(0, 1.25, 1.05);
      group.add(mast);
    }

    // ─── Hydraulic Lifting Carriage (Cargo Pallet on the forks) ───
    const carriage = new THREE.Group();
    carriage.position.set(0, 0.0, 0);

    if (!usingModel) {
      const fork1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 1.2), darkMat);
      fork1.position.set(-0.25, 0.05, 1.65);
      carriage.add(fork1);

      const fork2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 1.2), darkMat);
      fork2.position.set(0.25, 0.05, 1.65);
      carriage.add(fork2);
    }

    // Heavy Wooden Cargo Pallet
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.12, 1.1), woodMat);
    pallet.position.set(0, 0.08, 1.65);
    carriage.add(pallet);

    // Stacked Multi-Tier Freight Cargo Boxes with Labels
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xd4bda8, roughness: 0.45 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 });

    const lowerBox = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.65, 0.95), boxMat);
    lowerBox.position.set(0, 0.46, 1.65);
    lowerBox.castShadow = true;
    carriage.add(lowerBox);

    const upperCrate = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, 0.8), crateMat);
    upperCrate.position.set(0, 0.95, 1.65);
    upperCrate.castShadow = true;
    carriage.add(upperCrate);

    // Yellow shipping label
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.18), stripeMat);
    label.position.set(0, 0.5, 2.13);
    carriage.add(label);

    group.add(carriage);

    // Active Flashing Amber Safety Beacon on Roll Cage
    const strobeBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.13, 10),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 2.2 })
    );
    strobeBeacon.position.set(-0.25, 2.2, -0.3);
    group.add(strobeBeacon);

    const strobeLight = new THREE.PointLight(0xf59e0b, 1.8, 5);
    strobeLight.position.set(-0.25, 2.25, -0.3);
    group.add(strobeLight);

    if (!this._workingForklifts) this._workingForklifts = [];
    this._workingForklifts.push({
      group,
      carriage,
      strobeLight,
      baseX: x,
      baseY: 0.0,
      baseZ: z,
      baseRotY: rotY,
      animOffset,
      driveType,
    });

    return group;
  }

  /**
   * Builds Continuous Deep High-Bay Industrial Racking with authentic Forest Green uprights,
   * safety orange beams, wire mesh decking, and shrink-wrapped freight (Matching Reference Images).
   */
  _buildHighBayRacksWithCargo(root) {
    const greenUprightMat = new THREE.MeshStandardMaterial({
      color: 0x166534, // Forest Green matching Reference Photo 1
      roughness: 0.35,
      metalness: 0.65,
    });
    const orangeBeamMat = new THREE.MeshStandardMaterial({
      color: 0xea580c, // Safety Orange matching Reference Photo 1
      roughness: 0.3,
      metalness: 0.6,
    });
    const creasedMetalMat = new THREE.MeshStandardMaterial({
      color: 0xc2410c, // Scraped metal & compression crease
      roughness: 0.55,
      metalness: 0.75,
    });
    const wireMeshMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.4,
      metalness: 0.8,
      wireframe: true,
    });
    const yellowLabelMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.85 });
    const blueChepMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.7 });
    
    // Authentic Industrial Colored Boxes & Cartons (No White Blocks!)
    const kraftBoxMat = new THREE.MeshStandardMaterial({ color: 0xb47846, roughness: 0.65 });
    const tanBoxMat = new THREE.MeshStandardMaterial({ color: 0xc28b5e, roughness: 0.65 });
    const ochreBoxMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.6 });
    const darkBoxMat = new THREE.MeshStandardMaterial({ color: 0x9a5a2a, roughness: 0.65 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.7 });
    const tapeMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.4 });
    const strutMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.4, metalness: 0.6 });

    const boxPalette = [kraftBoxMat, tanBoxMat, ochreBoxMat, darkBoxMat];

    // ─── 1. Deep Multi-Bay Storage Aisles (4 Consecutive Bays on Left & Right) ───
    const rackSides = [-2.2, 2.2];
    const rackZPositions = [-21.0, -24.4, -27.8, -31.2];

    rackSides.forEach((rx) => {
      rackZPositions.forEach((rz) => {
        const rackGroup = new THREE.Group();
        rackGroup.position.set(rx, 0, rz);

        const rackWidth = 1.15;
        const rackLength = 3.2;
        const rackHeight = 3.8;

        const isHazardBay = (rx < 0 && rz === -21.0);

        // 4 Forest Green Vertical Columns (Uprights) with punching slots
        const colOffsets = [
          { x: -rackWidth / 2, z: -rackLength / 2 },
          { x: rackWidth / 2, z: -rackLength / 2 },
          { x: -rackWidth / 2, z: rackLength / 2 },
          { x: rackWidth / 2, z: rackLength / 2 },
        ];
        colOffsets.forEach(({ x, z }) => {
          // If this is the specific damaged foot upright on the LEFT aisle rack (x = 1.15/2, z = -1.6), skip standard column
          if (isHazardBay && x === rackWidth / 2 && z === -rackLength / 2) {
            return;
          }
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.12, rackHeight, 0.12), greenUprightMat);
          col.position.set(x, rackHeight / 2, z);
          col.castShadow = true;
          rackGroup.add(col);

          // Base anchor plate on standard columns
          const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.24), greenUprightMat);
          basePlate.position.set(x, 0.01, z);
          rackGroup.add(basePlate);
        });

        // Diagonal Lattice Cross-Bracing Struts (X-Lacing on rack end frames)
        [-rackLength / 2, rackLength / 2].forEach((endZ) => {
          const strut1 = new THREE.Mesh(new THREE.BoxGeometry(rackWidth, 0.04, 0.04), strutMat);
          strut1.position.set(0, 1.4, endZ);
          strut1.rotation.z = Math.atan2(1.4, rackWidth) * 0.75;
          rackGroup.add(strut1);

          const strut2 = new THREE.Mesh(new THREE.BoxGeometry(rackWidth, 0.04, 0.04), strutMat);
          strut2.position.set(0, 2.7, endZ);
          strut2.rotation.z = -Math.atan2(1.4, rackWidth) * 0.75;
          rackGroup.add(strut2);
        });

        // 2 Tiers of Heavy Orange Horizontal Load Beams at 1.4m and 2.7m
        const beamHeights = [1.4, 2.7];
        beamHeights.forEach((by) => {
          // Back Orange Beam
          const beamBack = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, rackLength), orangeBeamMat);
          beamBack.position.set(rx > 0 ? rackWidth / 2 : -rackWidth / 2, by, 0);
          rackGroup.add(beamBack);

          // Wire Mesh Safety Decking on shelf
          const wireDeck = new THREE.Mesh(new THREE.BoxGeometry(rackWidth - 0.1, 0.02, rackLength - 0.1), wireMeshMat);
          wireDeck.position.set(0, by + 0.01, 0);
          rackGroup.add(wireDeck);

          // ─── Front Aisle Beam: SEVERELY CRIMPED & SAGGING ON HAZARD BAY (Matching Ref Photo 1) ───
          if (isHazardBay && by === 1.4) {
            // 1. Left Beam Segment sloping sharply down to the center crimp
            const sagArm1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, rackLength / 2), orangeBeamMat);
            sagArm1.position.set(rackWidth / 2, by - 0.13, -rackLength / 4);
            sagArm1.rotation.x = -0.16;
            sagArm1.castShadow = true;
            rackGroup.add(sagArm1);

            // 2. Right Beam Segment sloping down from upright to center crimp
            const sagArm2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, rackLength / 2), orangeBeamMat);
            sagArm2.position.set(rackWidth / 2, by - 0.13, rackLength / 4);
            sagArm2.rotation.x = 0.16;
            sagArm2.castShadow = true;
            rackGroup.add(sagArm2);

            // 3. Sharp V-Crimp Buckle in the exact center (Matching Ref Photo 1)
            const crimpJoint = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.32), creasedMetalMat);
            crimpJoint.position.set(rackWidth / 2, by - 0.26, 0.0);
            crimpJoint.rotation.x = 0.05;
            crimpJoint.castShadow = true;
            rackGroup.add(crimpJoint);

            // Connector End Plates with locking pins (Orange)
            const endPlate1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.08), orangeBeamMat);
            endPlate1.position.set(rackWidth / 2, by, -rackLength / 2 + 0.04);
            rackGroup.add(endPlate1);

            const endPlate2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.08), orangeBeamMat);
            endPlate2.position.set(rackWidth / 2, by, rackLength / 2 - 0.04);
            rackGroup.add(endPlate2);
          } else {
            // Standard Straight Orange Beam
            const beamAisle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, rackLength), orangeBeamMat);
            beamAisle.position.set(rx > 0 ? -rackWidth / 2 : rackWidth / 2, by, 0);
            beamAisle.castShadow = true;
            rackGroup.add(beamAisle);
          }

          // Yellow Capacity Barcode Labels on beam face
          const label = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.08), yellowLabelMat);
          label.position.set(rx > 0 ? -rackWidth / 2 - 0.05 : rackWidth / 2 + 0.05, by, 0);
          label.rotation.y = rx > 0 ? -Math.PI / 2 : Math.PI / 2;
          rackGroup.add(label);

          // Loaded Pallets & Colored Freight Boxes (Cardboard Kraft / Tan / Ochre)
          const palletOffsets = [-0.9, 0.9];
          palletOffsets.forEach((pz, idx) => {
            const palletGroup = new THREE.Group();
            palletGroup.position.set(0, by + 0.05, pz);

            // On the hazard bay tier 1, pallets sag heavily into the center V-crimp
            if (isHazardBay && by === 1.4) {
              palletGroup.position.y = by - 0.12;
              palletGroup.rotation.x = pz < 0 ? 0.14 : -0.14;
              palletGroup.rotation.z = -0.06;
            }

            const useChep = (idx % 2 === 0);
            const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 1.1), useChep ? blueChepMat : woodMat);
            pallet.castShadow = true;
            palletGroup.add(pallet);

            // Realistic Stacked Colored Cardboard Boxes
            const chosenMat = boxPalette[(idx + Math.floor(Math.abs(rz))) % boxPalette.length];
            const cargo = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.72, 0.96), chosenMat);
            cargo.position.set(0, 0.46, 0);
            cargo.castShadow = true;
            palletGroup.add(cargo);

            // Top Box Sealing Tape Strip
            const tape = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.01, 0.12), tapeMat);
            tape.position.set(0, 0.825, 0);
            palletGroup.add(tape);

            rackGroup.add(palletGroup);
          });
        });

        root.add(rackGroup);
      });
    });

    // ─── 2. Deep Background Cross-Racks on Left & Right Flanks (Clear Central Aisle) ───
    const bgRackX = [-6.5, 6.5];
    bgRackX.forEach((bx, bIdx) => {
      const bgGroup = new THREE.Group();
      bgGroup.position.set(bx, 0, -35.0);
      const bgWidth = 3.2; const bgLength = 1.15; const bgHeight = 3.8;

      // Uprights
      [-bgWidth / 2, bgWidth / 2].forEach((x) => {
        [-bgLength / 2, bgLength / 2].forEach((z) => {
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.12, bgHeight, 0.12), greenUprightMat);
          col.position.set(x, bgHeight / 2, z);
          bgGroup.add(col);
        });
      });

      // Beams & Freight
      [1.4, 2.7].forEach((by) => {
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(bgWidth, 0.14, 0.08), orangeBeamMat);
        b1.position.set(0, by, -bgLength / 2);
        bgGroup.add(b1);

        const b2 = new THREE.Mesh(new THREE.BoxGeometry(bgWidth, 0.14, 0.08), orangeBeamMat);
        b2.position.set(0, by, bgLength / 2);
        bgGroup.add(b2);

        [-0.9, 0.9].forEach((px, pIdx) => {
          const pal = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 1.0), woodMat);
          pal.position.set(px, by + 0.05, 0);
          bgGroup.add(pal);

          const mat = boxPalette[(bIdx + pIdx) % boxPalette.length];
          const c = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.72, 0.88), mat);
          c.position.set(px, by + 0.46, 0);
          bgGroup.add(c);
        });
      });

      root.add(bgGroup);
    });

    // Yellow Floor Crash Guard Bollards at Aisle Endpoints
    const bollardMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
    const bollardPositions = [
      { x: -1.8, z: -19.5 },
      { x: 1.8, z: -19.5 },
      { x: -1.8, z: -33.0 },
      { x: 1.8, z: -33.0 },
    ];
    bollardPositions.forEach((bp) => {
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.85, 12), bollardMat);
      bollard.position.set(bp.x, 0.425, bp.z);
      bollard.castShadow = true;
      root.add(bollard);
    });
  }

  /**
   * Stop 3: Structural Collision Damage & Floor A-Frame Caution Warning Board.
   */
  async _loadStop3Props() {
    const group = new THREE.Group();
    group.name = 'Stop3_BentRackZone';

    this._buildHighBayRacksWithCargo(group);

    // ─── Damaged Column at x: -1.625, z: -22.6 (Front Aisle Column of the Hazard Bay) ───
    const damagedColumnGroup = new THREE.Group();
    damagedColumnGroup.position.set(-1.625, 0, -22.6);

    const greenSteelMat = new THREE.MeshStandardMaterial({
      color: 0x166534, // Forest Green
      roughness: 0.35,
      metalness: 0.65,
    });
    const orangePrimerMat = new THREE.MeshStandardMaterial({
      color: 0xc2410c, // Bare steel & scraped primer
      roughness: 0.6,
      metalness: 0.8,
    });
    const concreteSpallMat = new THREE.MeshStandardMaterial({
      color: 0x64748b, // Cracked raw concrete floor spall
      roughness: 0.9,
    });
    const boltSteelMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // Galvanized anchor bolt & washer
      roughness: 0.3,
      metalness: 0.9,
    });

    // 1. Cracked Concrete Floor Spall & Anchor Bolt Pullout (Ref Photo 3)
    const spallCrack = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.02, 8), concreteSpallMat);
    spallCrack.position.set(0.08, 0.01, 0.08);
    damagedColumnGroup.add(spallCrack);

    // Sheared Anchor Bolt pulling out at an angle
    const anchorBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 10), boltSteelMat);
    anchorBolt.position.set(0.12, 0.05, 0.08);
    anchorBolt.rotation.z = 0.28;
    damagedColumnGroup.add(anchorBolt);

    const anchorNut = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 6), boltSteelMat);
    anchorNut.position.set(0.12, 0.08, 0.08);
    anchorNut.rotation.z = 0.28;
    damagedColumnGroup.add(anchorNut);

    // 2. Bent & Twisted Baseplate (Ref Photo 3)
    const bentBaseplate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.025, 0.26), orangePrimerMat);
    bentBaseplate.position.set(0.02, 0.02, 0.0);
    bentBaseplate.rotation.z = 0.22;
    damagedColumnGroup.add(bentBaseplate);

    // 3. Severely Crushed & Crumpled Bottom Foot (0.0m to 0.45m) (Ref Photo 3)
    const crushedFoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), orangePrimerMat);
    crushedFoot.position.set(0.06, 0.22, 0.0);
    crushedFoot.rotation.z = 0.35;
    crushedFoot.rotation.y = -0.15;
    damagedColumnGroup.add(crushedFoot);

    // 4. S-Curve Lateral Deflection Upper Column (0.45m to 3.8m) (Ref Photo 2)
    const midSection = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), greenSteelMat);
    midSection.position.set(0.08, 1.2, 0.0);
    midSection.rotation.z = -0.06;
    damagedColumnGroup.add(midSection);

    const topSection = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), greenSteelMat);
    topSection.position.set(0.0, 2.9, 0.0);
    damagedColumnGroup.add(topSection);

    // 5. Subtle Focused Hazard Light grazing the crumpled foot and sagging beam
    const hazardLight = new THREE.PointLight(0xffedd5, 3.5, 8);
    hazardLight.position.set(0.6, 1.2, 0.6);
    damagedColumnGroup.add(hazardLight);

    group.add(damagedColumnGroup);

    // ─── 6. Floor-Standing Industrial A-Frame Warning Board on Walkway ───
    const aFrameGroup = this._buildFloorAFrameWarningSign();
    aFrameGroup.position.set(-0.95, 0, -20.2);
    aFrameGroup.rotation.y = 0.25;
    group.add(aFrameGroup);

    // 7. Overhead High-Bay Industrial Lighting for Aisle B
    const aisleLight1 = new THREE.PointLight(0xfffbeb, 3.5, 16);
    aisleLight1.position.set(0, 5.5, -23.0);
    group.add(aisleLight1);

    const aisleLight2 = new THREE.PointLight(0xfffbeb, 3.5, 16);
    aisleLight2.position.set(0, 5.5, -29.0);
    group.add(aisleLight2);

    // 8. Overhead Facility Placard for Aisle B
    this._addRoomPlacard(group, 0, 5.8, -20.0, 'FACILITY 03 | HIGH-BAY STORAGE & PALLET RACKING AISLE B');

    this._stopGroups.set('stop_03', group);
    this.scene.add(group);
  }

  /**
   * Builds an authentic industrial folding yellow A-frame caution warning board.
   */
  _buildFloorAFrameWarningSign() {
    const signGroup = new THREE.Group();
    signGroup.name = 'AFrameCautionSign';

    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 384;
    const ctx = canvas.getContext('2d');
    
    // Bright High-Visibility Safety Yellow Board
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 384);

    // Top & Bottom Black Hazard Chevrons
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 24);
    ctx.fillRect(0, 360, 256, 24);

    // Red Caution Triangle
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(128, 48);
    ctx.lineTo(192, 138);
    ctx.lineTo(64, 138);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 128, 126);

    // Crisp Text
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('CAUTION', 128, 180);

    ctx.fillStyle = '#b91c1c';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('RACK DEFECT', 128, 220);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('DO NOT LOAD', 128, 260);
    ctx.fillText('KEEP CLEAR', 128, 290);

    const tex = new THREE.CanvasTexture(canvas);
    const signMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, side: THREE.DoubleSide });

    // Front Panel (Angled)
    const frontPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.65), signMat);
    frontPanel.position.set(0, 0.32, 0.1);
    frontPanel.rotation.x = -0.22;
    frontPanel.castShadow = true;
    signGroup.add(frontPanel);

    // Back Panel (Angled)
    const backPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.65), signMat);
    backPanel.position.set(0, 0.32, -0.1);
    backPanel.rotation.x = 0.22;
    backPanel.rotation.y = Math.PI;
    backPanel.castShadow = true;
    signGroup.add(backPanel);

    // Top Hinge Handle
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), handleMat);
    handle.position.set(0, 0.63, 0);
    handle.rotation.z = Math.PI / 2;
    signGroup.add(handle);

    return signGroup;
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

  /**
   * Build the cordon for a stop: four cones at the corners of a rectangle with
   * hazard tape running cone to cone along each side, forming a closed loop.
   *
   * The rectangle is derived from the hazard's registered bounds so it always
   * fits what it is cordoning. Stops with no registered bounds fall back to the
   * original fixed diamond, so nothing that has not been measured is disturbed.
   */
  spawnCordonBarrier(stopId, targetPos) {
    if (this._cordonObjects.has(stopId)) return;

    const group = new THREE.Group();
    group.name = `Cordon_${stopId}`;

    const hazard = this._hazardBounds.get(stopId);
    const corners = hazard
      ? this._cordonCornersFromBounds(stopId, hazard)
      : this._cordonCornersLegacyDiamond(stopId, targetPos);

    // PALETTE EXEMPTION - deliberate, do not "fix" these to brand colours.
    // Hazard tape is yellow with black diagonals and traffic cones are hi-vis
    // orange because that is what a warehouse worker recognises instantly, at a
    // glance, as "do not cross". Same reasoning as hi-vis clothing being orange:
    // on a safety training product, recognisability beats brand consistency.
    // These sit intentionally outside the palette defined in main.css.
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xff5f1f, roughness: 0.45 });

    corners.forEach(({ x, z }) => {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(CONE_BASE_RADIUS, CONE_HEIGHT, 16),
        coneMat,
      );
      cone.position.set(x, CONE_HEIGHT / 2, z);
      cone.castShadow = true;
      group.add(cone);
    });

    for (let i = 0; i < corners.length; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];
      const p1 = new THREE.Vector3(a.x, TAPE_HEIGHT, a.z);
      const p2 = new THREE.Vector3(b.x, TAPE_HEIGHT, b.z);
      const span = p1.distanceTo(p2);
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

      // One texture per segment so the stripe pitch stays a constant physical
      // size whatever the segment length, instead of stretching to fit.
      const tex = this._hazardTapeTexture().clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.max(1, Math.round(span / TAPE_STRIPE_PITCH)), 1);

      const tape = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, TAPE_WIDTH, span),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }),
      );
      tape.position.copy(mid);
      tape.lookAt(p2);
      group.add(tape);
    }

    this.scene.add(group);
    this._cordonObjects.set(stopId, group);
  }

  /** Rectangle corners derived from a registered hazard footprint. */
  _cordonCornersFromBounds(stopId, { box, clamp = {} }) {
    const xMin = Math.max(box.min.x - CORDON_CLEARANCE, clamp.xMin ?? -Infinity);
    const xMax = Math.min(box.max.x + CORDON_CLEARANCE, clamp.xMax ?? Infinity);
    const zMin = Math.max(box.min.z - CORDON_CLEARANCE, clamp.zMin ?? -Infinity);
    const zMax = Math.min(box.max.z + CORDON_CLEARANCE, clamp.zMax ?? Infinity);

    this._cordonRects.set(stopId, { xMin, xMax, zMin, zMax });

    return [
      { x: xMin, z: zMin },
      { x: xMax, z: zMin },
      { x: xMax, z: zMax },
      { x: xMin, z: zMax },
    ];
  }

  /** Original fixed diamond, kept for stops with no registered hazard bounds. */
  _cordonCornersLegacyDiamond(stopId, targetPos) {
    const center = (stopId === 'stop_03')
      ? new THREE.Vector3(-1.625, 0, -21.0)
      : new THREE.Vector3(targetPos.x, targetPos.y || 0, targetPos.z);

    const radius = 1.15;
    return [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a) => ({
      x: center.x + Math.cos(a) * radius,
      z: center.z + Math.sin(a) * radius,
    }));
  }

  /** Yellow-and-black diagonal hazard tape, drawn once and reused. */
  _hazardTapeTexture() {
    if (this._tapeTexture) return this._tapeTexture;

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f2c400';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Diagonal black bars, drawn past both edges so they wrap seamlessly.
    ctx.fillStyle = '#141414';
    const bar = size / 4;
    for (let i = -canvas.height; i < size + canvas.height; i += bar) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + bar / 2, 0);
      ctx.lineTo(i + bar / 2 + canvas.height, canvas.height);
      ctx.lineTo(i + canvas.height, canvas.height);
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this._tapeTexture = tex;
    return tex;
  }

  /**
   * A place to stand after cordoning: just outside the perimeter, on the side
   * the trainee approached from. Returns null for stops with no rectangle, so
   * callers keep their existing behaviour.
   */
  getCordonStandoff(stopId, approachFrom) {
    const rect = this._cordonRects.get(stopId);
    if (!rect || !approachFrom) return null;

    const { xMin, xMax, zMin, zMax } = rect;
    const cx = (xMin + xMax) / 2;
    const cz = (zMin + zMax) / 2;
    const halfX = (xMax - xMin) / 2;
    const halfZ = (zMax - zMin) / 2;
    const dx = approachFrom.x - cx;
    const dz = approachFrom.z - cz;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    // Leave by whichever side the trainee is already closest to being outside.
    if (Math.abs(dx) / halfX > Math.abs(dz) / halfZ) {
      const edge = dx >= 0 ? xMax : xMin;
      return {
        x: edge + Math.sign(dx || 1) * CORDON_STANDOFF,
        y: approachFrom.y ?? 0,
        z: clamp(approachFrom.z, zMin, zMax),
      };
    }
    const edge = dz >= 0 ? zMax : zMin;
    return {
      x: clamp(approachFrom.x, xMin, xMax),
      y: approachFrom.y ?? 0,
      z: edge + Math.sign(dz || 1) * CORDON_STANDOFF,
    };
  }

  /** Centre of a stop's cordon, so a character can be turned to face it. */
  getCordonCentre(stopId) {
    const rect = this._cordonRects.get(stopId);
    if (!rect) return null;
    return {
      x: (rect.xMin + rect.xMax) / 2,
      y: 0,
      z: (rect.zMin + rect.zMax) / 2,
    };
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

    // ─── Dynamic Machinery Animations Gated by Active Stop ───
    if (this._activeStopId === 'stop_01' || this._activeStopId === 'stop_02') {
      // Crossing Forklift Animation in Facility 02
      if (this._forklift) {
        const t = elapsed * 0.65;
        const progress = (Math.sin(t) + 1) * 0.5; // 0 to 1
        this._forklift.position.x = -6.2 + progress * 3.8;
        this._forklift.position.y = Math.abs(Math.sin(elapsed * 7)) * 0.01;

        if (this._strobeLight) {
          this._strobeLight.intensity = (Math.sin(elapsed * 14) > 0.15) ? 3.8 : 0.3;
        }
      }

      // Active Working Forklifts in Staging Bays
      if (this._workingForklifts && this._workingForklifts.length > 0) {
        this._workingForklifts.forEach((wf) => {
          const time = elapsed * 0.75 + wf.animOffset;

          if (wf.carriage) {
            wf.carriage.position.y = 0.12 + (Math.sin(time * 1.1) + 1) * 0.42;
          }

          if (wf.group) {
            if (wf.driveType === 'z-drive') {
              const progress = Math.sin(time);
              wf.group.position.z = wf.baseZ + progress * 1.35;
              wf.group.rotation.y = wf.baseRotY + Math.cos(time) * 0.12;
            } else if (wf.driveType === 'x-drive') {
              const progress = Math.sin(time);
              wf.group.position.x = wf.baseX + progress * 1.15;
              wf.group.rotation.y = wf.baseRotY + Math.cos(time) * 0.09;
            }
            wf.group.position.y = wf.baseY + Math.abs(Math.sin(elapsed * 7.0)) * 0.008;
          }

          if (wf.strobeLight) {
            wf.strobeLight.intensity = (Math.sin(elapsed * 13.0 + wf.animOffset) > 0.1) ? 2.8 : 0.2;
          }
        });
      }
    }

    // Active Hazard Inspection Strobe on Stop 3 Bent Rack Upright
    if (this._activeStopId === 'stop_03' && this._stop3HazardLight) {
      this._stop3HazardLight.intensity = (Math.sin(elapsed * 10.0) > 0.0) ? 5.5 : 1.5;
    }
  }
}
