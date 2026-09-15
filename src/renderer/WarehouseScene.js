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

const DAVE_PATH = '/assets/models/characters/dave.opt.glb';
const ALEX_PATH = '/assets/models/characters/alex.opt.glb';
const SIGN_MODEL = '/assets/models/environment/psx_wet_floor_sign.glb';
const FORKLIFT_MODEL = '/assets/models/environment/warehouse_forklift_gameready.opt.glb';
const RACKING_MODEL = '/assets/models/environment/pallet_racking.glb';

// ─── Hazard cordon geometry ─────────────────────────────────────────────────
const CORDON_CLEARANCE = 0.40;    // m of standoff wanted on every side of a hazard
const CORDON_STANDOFF = 0.45;     // m outside the tape a trainee stands afterwards
const CONE_HEIGHT = 0.75;        // m — a standard UK traffic cone is 750mm
const CONE_BASE_RADIUS = 0.16;   // m
const TAPE_HEIGHT = 0.55;        // m — sits high on the cone and clears the tipped drum (top 0.45m)
const TAPE_WIDTH = 0.09;         // m — barrier tape is roughly 75-100mm
const TAPE_STRIPE_PITCH = 0.6;   // m of tape per texture repeat, so stripes never stretch

export const STOP_ANCHORS = [
  { x: 0.6, y: 1.65, z: -4.0 },   // Stop 1: Chemical Drum Storage Warehouse
  { x: 0.3, y: 1.65, z: -13.5 },  // Stop 2: Blind Corner Forklift Crossing
  { x: -0.4, y: 1.65, z: -20.0 }, // Stop 3: High-Bay Bent Rack Upright
  { x: -0.4, y: 1.65, z: -30.0 }, // Stop 4: Battery Charging Station
  { x: 0.0, y: 1.85, z: -37.5 },  // Stop 5: Loading Dock & Dispatch
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
    this._stop4ChargerIsolated = false;
    this._forkliftOperatorHead = null;
    this._forkliftOperatorRightArm = null;
  }

  async _loadGLTF(path) {
    return new Promise((resolve, reject) => {
      this._loader.load(path, resolve, undefined, reject);
    });
  }

  _normalizeProp(obj, targetHeight = 2.0) {
    if (!obj) return;
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    if (size.y > 0.01) {
      const scale = targetHeight / size.y;
      obj.scale.set(scale, scale, scale);
    }
  }

  async load() {
    this._buildDrumStorageWarehouse();
    await Promise.allSettled([
      this._loadStop1Props().catch((err) => console.warn('[WarehouseScene] Stop 1 props error:', err)),
      this._loadStop2Props().catch((err) => console.warn('[WarehouseScene] Stop 2 props error:', err)),
      this._loadStop3Props().catch((err) => console.warn('[WarehouseScene] Stop 3 props error:', err)),
      this._loadStop4Props().catch((err) => console.warn('[WarehouseScene] Stop 4 props error:', err)),
      this._loadStop5Props().catch((err) => console.warn('[WarehouseScene] Stop 5 props error:', err)),
    ]);
    this.setActiveStop('stop_01');
  }

  /**
   * Isolates active stop objects and dynamic machinery so they never interfere with adjacent rooms.
   * @param {string} stopId
   */
  setActiveStop(stopId) {
    this._activeStopId = stopId;

    // Sliding-Window Spatial Persistence across Stops:
    // Ensures adjacent zones and floor markings remain persistent during locomotion transitions
    if (this._stopGroups.has('stop_01')) {
      this._stopGroups.get('stop_01').visible = (stopId === 'stop_01' || stopId === 'stop_02' || stopId === 'stop_03');
    }

    if (this._stopGroups.has('stop_02')) {
      // Stop 2 forklift junction, zebra stripes, and floor markings remain visible across Stops 1, 2, 3, and 4
      this._stopGroups.get('stop_02').visible = (stopId === 'stop_01' || stopId === 'stop_02' || stopId === 'stop_03' || stopId === 'stop_04');
      if (stopId === 'stop_01') {
        this._forkliftCleared = false;
        if (this._forklift) this._forklift.position.x = -5.0;
      }
    }

    if (this._stopGroups.has('stop_03')) {
      // Stop 3 Pallet Racking is visible from Stop 2 and Stop 3 only.
      // Although the racks are geometrically before Archway 3 (z = -28.5),
      // the Stop 4 isolation camera pans left toward the disconnect panel at x = -5.8
      // and the racks fill that line of sight, so they must be hidden at Stop 4.
      this._stopGroups.get('stop_03').visible = (stopId === 'stop_02' || stopId === 'stop_03');
    }

    if (this._stopGroups.has('stop_04')) {
      // Stop 4 Battery Charging Bay is visible from Stop 3, Stop 4, and Stop 5
      this._stopGroups.get('stop_04').visible = (stopId === 'stop_03' || stopId === 'stop_04' || stopId === 'stop_05');
      if (stopId === 'stop_01' || stopId === 'stop_02' || stopId === 'stop_03') {
        this._stop4ChargerIsolated = false;
        if (this._stop4AmberLight) this._stop4AmberLight.visible = true;
        if (this._stop4DisconnectLever) this._stop4DisconnectLever.rotation.z = 0;
        if (this._stop4EStopBtn) this._stop4EStopBtn.position.x = 0.10;
        if (this._stop4EStop) {
          const existing = this._stop4EStop.getObjectByName('LOTO_Assembly');
          if (existing) this._stop4EStop.remove(existing);
        }
      }
    }

    if (this._stopGroups.has('stop_05')) {
      // Stop 5 Emergency Station is visible from Stop 4 and Stop 5
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
    const wallTex = this._createConcreteWallTexture();
    wallTex.wrapS = THREE.RepeatWrapping;
    wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(4, 2);

    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.75,
      metalness: 0.15,
    });

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

    // ─── 4. Chemical Drum Pallets Strictly in Facility 01 (z = 5.0 to z = -8.5) ───
    // Clean, spacious 2-row storage layout (Row 1 along wall, Row 2 along staging lane with open transit space)
    
    // Left Wing:
    // Row 1 (Wall Row at x = -7.0)
    [4.0, 0.5, -3.0, -6.6].forEach((z) => {
      this._addDrumPalletStack(root, -7.0, z, 3);
    });

    // Row 2 (Front Aisle Row at x = -4.4)
    [3.5, 0.0, -3.2].forEach((z) => {
      this._addDrumPalletStack(root, -4.4, z, 2);
    });
    // Note: The hazard leaking pallet stack at x = -4.4, z = -6.6 is built in _loadStop1Props!

    // Right Wing:
    // Row 1 (Wall Row at x = 7.0)
    [4.0, 0.5, -3.0, -6.6].forEach((z) => {
      this._addDrumPalletStack(root, 7.0, z, 3);
    });

    // Row 2 (Front Aisle Row at x = 4.4)
    [3.5, 0.0, -3.2].forEach((z) => {
      this._addDrumPalletStack(root, 4.4, z, 2);
    });
    this._addFloorBayDecal(root, 4.4, -6.6); // Empty staged bay spot matching photo

    // ─── 5. Industrial Partition Firewall & Transit Archway 1 (z = -10.0) ──
    const firewallTex = this._createConcreteWallTexture();
    firewallTex.wrapS = THREE.RepeatWrapping;
    firewallTex.wrapT = THREE.RepeatWrapping;
    firewallTex.repeat.set(2, 2);

    const firewallMat = new THREE.MeshStandardMaterial({
      map: firewallTex,
      color: 0xcfd8dc,
      roughness: 0.65,
      metalness: 0.2,
    });

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
    const hazardStripeTex = this._createHazardStripeTexture();
    hazardStripeTex.repeat.set(5, 1);
    const hazardStripeMat = new THREE.MeshStandardMaterial({
      map: hazardStripeTex,
      roughness: 0.35,
      metalness: 0.2,
    });

    const clearanceBar = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.32, 0.45), hazardStripeMat);
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

    const clearanceBar2 = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.32, 0.45), hazardStripeMat);
    clearanceBar2.position.set(0, 5.2, -18.8);
    root.add(clearanceBar2);

    this._addRoomPlacard(root, 0, 5.6, -18.5, 'ZONE 03 | HIGH-BAY STORAGE & STRUCTURAL RACKING AISLE B');

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

    const clearanceBar3 = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.32, 0.45), hazardStripeMat);
    clearanceBar3.position.set(0, 4.4, -28.5);
    root.add(clearanceBar3);

    this._addRoomPlacard(root, 0, 4.8, -28.2, 'ZONE 04 TRANSIT | BATTERY CHARGING BAY');

    // ─── 8. Industrial Partition Firewall & Transit Archway 4 (z = -36.5) (To Loading Dock) ──
    const archway4Left = new THREE.Mesh(new THREE.BoxGeometry(10.5, height, 0.4), firewallMat);
    archway4Left.position.set(-7.75, height / 2, -36.5);
    root.add(archway4Left);

    const archway4Right = new THREE.Mesh(new THREE.BoxGeometry(10.5, height, 0.4), firewallMat);
    archway4Right.position.set(7.75, height / 2, -36.5);
    root.add(archway4Right);

    const archway4Top = new THREE.Mesh(new THREE.BoxGeometry(width, height - 4.5, 0.4), firewallMat);
    archway4Top.position.set(0, height - (height - 4.5) / 2, -36.5);
    root.add(archway4Top);

    const clearanceBar4 = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.32, 0.45), hazardStripeMat);
    clearanceBar4.position.set(0, 4.4, -36.5);
    root.add(clearanceBar4);

    this._addRoomPlacard(root, 0, 4.8, -36.2, 'ZONE 05 TRANSIT | FINAL CLEAR AISLE & LOADING DOCK');

    // ─── 9. Green Overhead Roof Trusses & Warm Lighting ─────
    this._buildGreenRoofTrusses(root, width, depth, height, centerZ);
    this._buildWarmIndustrialLighting(root, centerZ);

    this._addRoomPlacard(root, 0, 6.2, centerZ + depth / 2 - 1.5, 'FACILITY 01 | HAZMAT CHEMICAL DRUM STORAGE');

    this.scene.add(root);
  }

  /**
   * Green & Steel Roof Trusses (Optimized structural box girders).
   */
  _buildGreenRoofTrusses(root, width, depth, height, centerZ) {
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.45,
      metalness: 0.6,
    });

    for (let z = centerZ + depth / 2 - 2; z >= centerZ - depth / 2 + 2; z -= 6.0) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(width - 0.5, 0.35, 0.35), trussMat);
      beam.position.set(0, height - 0.3, z);
      root.add(beam);
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

    // 2. High-bay ceiling lamp fixtures along the main aisle across all 5 facilities (Glow via Emissive material)
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
      });
    });
  }

  /**
   * Creates a multi-tier pallet stack of 4 drums per pallet with authentic 3D wooden pallet.
   */
  _addDrumPalletStack(root, x, z, tiers = 3, hasFloorDecal = true) {
    if (!this._sharedDrumAssets) {
      const palletTex = this._createWoodPalletTexture();
      const woodMat = new THREE.MeshStandardMaterial({
        map: palletTex,
        roughness: 0.82,
        metalness: 0.08,
      });

      const drumTex1 = this._createChemicalDrumTexture(0x0284c7, false); // Royal blue
      const drumTex2 = this._createChemicalDrumTexture(0x0369a1, false); // Deep blue
      const drumTex3 = this._createChemicalDrumTexture(0x1d4ed8, false); // Cobalt blue

      this._sharedDrumAssets = {
        woodMat,
        drumMats: [
          new THREE.MeshStandardMaterial({ map: drumTex1, roughness: 0.22, metalness: 0.65 }),
          new THREE.MeshStandardMaterial({ map: drumTex2, roughness: 0.22, metalness: 0.65 }),
          new THREE.MeshStandardMaterial({ map: drumTex3, roughness: 0.22, metalness: 0.65 }),
        ],
        rimMat: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.85 }),
        bungMat: new THREE.MeshBasicMaterial({ color: 0x0f172a }),
        drumGeo: new THREE.CylinderGeometry(0.23, 0.23, 0.84, 20),
        rimGeo: new THREE.TorusGeometry(0.22, 0.015, 6, 16),
        bungGeo: new THREE.CircleGeometry(0.035, 8),
      };
    }

    const { woodMat, drumMats, rimMat, bungMat, drumGeo, rimGeo, bungGeo } = this._sharedDrumAssets;

    const group = new THREE.Group();
    const offsets = [
      { dx: -0.32, dz: -0.32 },
      { dx: 0.32, dz: -0.32 },
      { dx: -0.32, dz: 0.32 },
      { dx: 0.32, dz: 0.32 },
    ];

    if (hasFloorDecal) {
      this._addFloorBayDecal(root, x, z);
    }

    // Pick consistent drum material for this pallet stack
    const drumMat = drumMats[Math.abs(Math.floor(x * 3 + z * 7)) % drumMats.length];

    for (let tier = 0; tier < tiers; tier++) {
      const yBase = tier * 1.02;
      // Authentic 3D Wooden Pallet with individual slats & fork pockets
      const pallet = this._buildRealisticPallet(woodMat);
      pallet.position.set(0, yBase, 0);
      group.add(pallet);

      // 4 Shiny chemical drums per tier in 2x2 grid
      offsets.forEach(({ dx, dz }) => {
        const drum = new THREE.Mesh(drumGeo, drumMat);
        drum.position.set(dx, yBase + 0.55, dz);
        drum.castShadow = true;
        group.add(drum);

        // Silver Rim / Chime
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.position.set(dx, yBase + 0.97, dz);
        rim.rotation.x = Math.PI / 2;
        group.add(rim);

        // Bung Cap
        const bung = new THREE.Mesh(bungGeo, bungMat);
        bung.position.set(dx + 0.09, yBase + 0.972, dz);
        bung.rotation.x = -Math.PI / 2;
        group.add(bung);
      });
    }

    group.position.set(x, 0, z);
    root.add(group);
  }

  /**
   * Constructs an authentic 3D wooden pallet with 7 deck slats, 3 stringer bearers, and fork pockets.
   */
  _buildRealisticPallet(woodMat) {
    const palletGroup = new THREE.Group();
    const palletLength = 1.4;

    // 1. Top Deck Slats (7 distinct planks with realistic air gaps)
    const slatWidth = 0.14;
    const slatThickness = 0.024;
    const slatPositions = [-0.58, -0.38, -0.19, 0, 0.19, 0.38, 0.58];

    slatPositions.forEach((sz) => {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(palletLength, slatThickness, slatWidth), woodMat);
      slat.position.set(0, 0.12, sz);
      slat.receiveShadow = true;
      slat.castShadow = true;
      palletGroup.add(slat);
    });

    // 2. Transverse Stringer Bearers (3 wooden runners creating open fork pockets)
    const stringerWidth = 0.10;
    const stringerHeight = 0.085;
    [-0.58, 0, 0.58].forEach((sx) => {
      const stringer = new THREE.Mesh(new THREE.BoxGeometry(stringerWidth, stringerHeight, palletLength), woodMat);
      stringer.position.set(sx, 0.065, 0);
      stringer.receiveShadow = true;
      palletGroup.add(stringer);
    });

    // 3. Bottom Deck Skid Runners (3 base planks)
    const bottomThickness = 0.022;
    [-0.58, 0, 0.58].forEach((sx) => {
      const bottomPlank = new THREE.Mesh(new THREE.BoxGeometry(stringerWidth, bottomThickness, palletLength), woodMat);
      bottomPlank.position.set(sx, 0.011, 0);
      bottomPlank.receiveShadow = true;
      palletGroup.add(bottomPlank);
    });

    return palletGroup;
  }

  /**
   * Adds high-vis yellow floor box marking designating the drum storage bay (Photo style).
   */
  _addFloorBayDecal(root, x, z) {
    if (!this._bayStripeMat) {
      this._bayStripeMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.35,
        emissive: 0x713f12,
        emissiveIntensity: 0.25,
      });
    }
    const lineThick = 0.08;
    const size = 1.6;

    const top = new THREE.Mesh(new THREE.PlaneGeometry(size, lineThick), this._bayStripeMat);
    top.rotation.x = -Math.PI / 2;
    top.position.set(x, 0.002, z - size / 2);
    root.add(top);

    const bottom = new THREE.Mesh(new THREE.PlaneGeometry(size, lineThick), this._bayStripeMat);
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.set(x, 0.002, z + size / 2);
    root.add(bottom);

    const left = new THREE.Mesh(new THREE.PlaneGeometry(lineThick, size), this._bayStripeMat);
    left.rotation.x = -Math.PI / 2;
    left.position.set(x - size / 2, 0.002, z);
    root.add(left);

    const right = new THREE.Mesh(new THREE.PlaneGeometry(lineThick, size), this._bayStripeMat);
    right.rotation.x = -Math.PI / 2;
    right.position.set(x + size / 2, 0.002, z);
    root.add(right);
  }

  /**
   * Stop 1 Hazard: 1 chemical drum fallen from pallet with open bung hole spilling oil across walkway.
   */
  async _loadStop1Props() {
    const stackX = -4.4;
    const stackZ = -6.6;
    const group = new THREE.Group();
    group.name = 'Stop1_ChemicalHazard';

    // 1. Floor Storage Bay Outline for this stack
    this._addFloorBayDecal(group, stackX, stackZ);

    const palletTex = this._createWoodPalletTexture();
    const woodMat = new THREE.MeshStandardMaterial({
      map: palletTex,
      roughness: 0.82,
      metalness: 0.08,
    });

    const blueDrumTex = this._createChemicalDrumTexture(0x0284c7, false);
    const blueDrumMat = new THREE.MeshStandardMaterial({
      map: blueDrumTex,
      roughness: 0.22,
      metalness: 0.65,
    });

    const hazardDrumTex = this._createChemicalDrumTexture(0x0284c7, true);
    const hazardDrumMat = new THREE.MeshStandardMaterial({
      map: hazardDrumTex,
      roughness: 0.22,
      metalness: 0.65,
    });

    const steelRimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.85 });
    const bungMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

    const drumGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.84, 20);
    const rimGeo = new THREE.TorusGeometry(0.22, 0.015, 6, 16);
    const bungGeo = new THREE.CircleGeometry(0.035, 8);

    // 1. Authentic 3D Wooden Pallet with individual slats & fork pockets
    const pallet = this._buildRealisticPallet(woodMat);
    pallet.position.set(stackX, 0, stackZ);
    group.add(pallet);

    // 3 Standing Chemical Drums on the Pallet (back-left, back-right, front-left)
    const standingOffsets = [
      { dx: -0.32, dz: -0.32 },
      { dx: 0.32, dz: -0.32 },
      { dx: -0.32, dz: 0.32 },
    ];

    standingOffsets.forEach(({ dx, dz }) => {
      const drum = new THREE.Mesh(drumGeo, blueDrumMat);
      drum.position.set(stackX + dx, 0.55, stackZ + dz);
      drum.castShadow = true;
      group.add(drum);

      // Rim
      const rim = new THREE.Mesh(rimGeo, steelRimMat);
      rim.position.set(stackX + dx, 0.97, stackZ + dz);
      rim.rotation.x = Math.PI / 2;
      group.add(rim);

      // Bung Cap
      const bung = new THREE.Mesh(bungGeo, bungMat);
      bung.position.set(stackX + dx + 0.09, 0.972, stackZ + dz);
      bung.rotation.x = -Math.PI / 2;
      group.add(bung);
    });

    // 2. Fallen Chemical Drum on Floor with Authentic Galvanized Lid & Open Bung Hole
    const fallenDrumGroup = new THREE.Group();
    fallenDrumGroup.name = 'FallenChemicalDrum';
    fallenDrumGroup.position.set(-3.65, 0.23, -5.95);
    fallenDrumGroup.rotation.set(0.06, 0.68, 0); // Angled +Z axis directly toward walkway & camera

    // Cylinder body open-ended along Z (no end-cap texture artifacts)
    const drumBodyGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.84, 28, 1, true);
    drumBodyGeo.rotateX(Math.PI / 2);
    const fallenBody = new THREE.Mesh(drumBodyGeo, hazardDrumMat);
    fallenBody.castShadow = true;
    fallenDrumGroup.add(fallenBody);

    // Swage rolling hoops (raised structural ribs on barrel body)
    [-0.14, 0.14].forEach((hz) => {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.232, 0.008, 6, 28), steelRimMat);
      hoop.position.set(0, 0, hz);
      fallenDrumGroup.add(hoop);
    });

    // Bottom Chime & Base Plate (at Z = -0.42, rested toward pallet corner)
    const bottomRim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.016, 8, 28), steelRimMat);
    bottomRim.position.set(0, 0, -0.42);
    fallenDrumGroup.add(bottomRim);

    const bottomDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 28),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.7 })
    );
    bottomDisc.position.set(0, 0, -0.421);
    bottomDisc.rotation.y = Math.PI;
    fallenDrumGroup.add(bottomDisc);

    // ─── TOP HEAD: Galvanized Steel Lid Plate (at Z = +0.42, facing Camera & Walkway) ───
    const lidMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // Galvanized metal matching reference photo
      roughness: 0.32,
      metalness: 0.85,
    });

    // Galvanized steel lid disc
    const topLidDisc = new THREE.Mesh(new THREE.CircleGeometry(0.22, 28), lidMat);
    topLidDisc.position.set(0, 0, 0.421);
    fallenDrumGroup.add(topLidDisc);

    // Heavy rolled top chime rim
    const topRim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.016, 8, 28), steelRimMat);
    topRim.position.set(0, 0, 0.42);
    fallenDrumGroup.add(topRim);

    // Stamped concentric recess ring on lid face
    const innerLip = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.006, 6, 28), steelRimMat);
    innerLip.position.set(0, 0, 0.423);
    fallenDrumGroup.add(innerLip);

    // Bung Hole Position: At lower perimeter of the circular lid face (closest to floor for gravity spill)
    const bungX = 0.02;
    const bungY = -0.12;

    // Raised Hexagonal Flange Nut Boss (matching reference photo)
    const hexGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.022, 6);
    hexGeo.rotateX(Math.PI / 2);
    const hexFlange = new THREE.Mesh(hexGeo, steelRimMat);
    hexFlange.position.set(bungX, bungY, 0.432);
    fallenDrumGroup.add(hexFlange);

    // Threaded Bung Collar Lip
    const bungLip = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.005, 6, 18), steelRimMat);
    bungLip.position.set(bungX, bungY, 0.443);
    fallenDrumGroup.add(bungLip);

    // Open Bung Orifice (Pitch Black interior cavity from which oil pours)
    const openHole = new THREE.Mesh(
      new THREE.CircleGeometry(0.032, 18),
      new THREE.MeshBasicMaterial({ color: 0x010101 })
    );
    openHole.position.set(bungX, bungY, 0.444);
    fallenDrumGroup.add(openHole);

    // Dark oil drip trickling at the mouth of the bung
    const dripMat = new THREE.MeshBasicMaterial({ color: 0x05070a });
    const drip = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.05, 0.008), dripMat);
    drip.position.set(bungX, bungY - 0.032, 0.444);
    fallenDrumGroup.add(drip);

    group.add(fallenDrumGroup);

    // 3. Single Seamless Organic Viscous Oil Puddle
    const puddleTex = this._createOrganicOilPuddleTexture();
    const puddleMat = new THREE.MeshStandardMaterial({
      map: puddleTex,
      roughness: 0.04, // Ultra-glossy wet oil sheen
      metalness: 0.92,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
    });

    // Single seamless organic oil puddle expanding from the fallen drum across yellow boundary onto walkway
    const puddleMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.6), puddleMat);
    puddleMesh.rotation.x = -Math.PI / 2;
    puddleMesh.rotation.z = -0.32;
    puddleMesh.position.set(-2.25, 0.008, -5.45);
    puddleMesh.receiveShadow = true;
    group.add(puddleMesh);

    // Register hazard bounds for realistic cordoning around the spill & fallen barrel
    const spillBox = new THREE.Box3();
    spillBox.expandByPoint(new THREE.Vector3(-3.85, 0, -6.35));
    spillBox.expandByPoint(new THREE.Vector3(-0.95, 0, -4.60));
    this._hazardBounds.set('stop_01', {
      box: spillBox,
      clamp: { xMin: -3.9, xMax: -0.7, zMin: -6.45, zMax: -4.4 },
    });

    // 4. Focused overhead spotlight highlighting the spill puddle
    const spot = new THREE.SpotLight(0xffedd5, 3.2, 10, Math.PI / 3.5, 0.25);
    spot.position.set(stackX + 1.95, 5.5, stackZ + 1.05);
    spot.target.position.set(stackX + 1.95, 0, stackZ + 1.05);
    group.add(spot);
    group.add(spot.target);

    this.scene.add(group);
    this._stop1SpillGroup = group;
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
    const lineMatYellow = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });

    for (let zOff = -1.2; zOff <= 1.2; zOff += 0.4) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 0.2),
        (Math.round(zOff * 10) % 2 === 0) ? stripeMatYellow : stripeMatBlack
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.006, crossingZ + zOff);
      stripe.receiveShadow = true;
      group.add(stripe);
    }

    // Pedestrian Hold Lines across Walkway (at z = crossingZ + 1.8m and z = crossingZ - 1.8m)
    const stencilMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.65 });
    const stencilTextMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0x713f12,
      emissiveIntensity: 0.35,
      roughness: 0.3,
    });

    [-1.8, 1.8].forEach((zOff) => {
      const holdLine = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.12), lineMatYellow);
      holdLine.rotation.x = -Math.PI / 2;
      holdLine.position.set(0, 0.007, crossingZ + zOff);
      holdLine.receiveShadow = true;
      group.add(holdLine);

      // STOP • LOOK BOTH WAYS High-Contrast Pedestrian Floor Plaque
      const stencilBoard = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.32), stencilMat);
      stencilBoard.rotation.x = -Math.PI / 2;
      stencilBoard.position.set(0, 0.0065, crossingZ + zOff + (zOff > 0 ? 0.22 : -0.22));
      group.add(stencilBoard);

      // Warning chevron edge stripes
      [-1.22, 1.22].forEach((xOff) => {
        const chevron = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.28), stencilTextMat);
        chevron.rotation.x = -Math.PI / 2;
        chevron.position.set(xOff, 0.0075, crossingZ + zOff + (zOff > 0 ? 0.22 : -0.22));
        group.add(chevron);
      });
    });


    // Forklift Driving Lane Yellow Floor Boundary Stripes across Left & Right Flanks
    [-1.4, 1.4].forEach((zOff) => {
      // Left side lane stripe (x = -9.8 to -2.3)
      const leftStripe = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 0.1), lineMatYellow);
      leftStripe.rotation.x = -Math.PI / 2;
      leftStripe.position.set(-6.05, 0.005, crossingZ + zOff);
      leftStripe.receiveShadow = true;
      group.add(leftStripe);

      // Right side lane stripe (x = +2.3 to +9.8)
      const rightStripe = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 0.1), lineMatYellow);
      rightStripe.rotation.x = -Math.PI / 2;
      rightStripe.position.set(6.05, 0.005, crossingZ + zOff);
      rightStripe.receiveShadow = true;
      group.add(rightStripe);
    });

    // 2. Game-Ready Industrial Forklift with Seated Operator & Loaded Pallet on Forks
    const forkliftGroup = new THREE.Group();
    forkliftGroup.name = 'AnimatedForklift';
    forkliftGroup.position.set(-6.5, 0, crossingZ); // Starts in side cross-aisle
    forkliftGroup.rotation.y = Math.PI / 2; // Facing across the main aisle

    try {
      const forkliftGltf = await this._loadGLTF(FORKLIFT_MODEL);
      const forklift = forkliftGltf.scene;
      this._normalizeProp(forklift, 2.35);
      forklift.position.set(0, 0, 0);

      // Apply authentic multi-tone industrial styling (black rubber wheels, dark steel mast/cage, safety yellow-orange chassis)
      this._applyForkliftMaterials(forklift);

      forkliftGroup.add(forklift);
      this._forkliftModel = forklift;
    } catch {
      // Procedural heavy industrial forklift body
      const forkMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.25, metalness: 0.6 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 2.2), forkMat);
      body.position.set(0, 0.7, 0);
      forkliftGroup.add(body);
    }

    // 3. Tall Stacked Cargo Boxes on Forklift Pallet (Blocking Driver Sightline)
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
    const warnLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.22), labelMat);
    warnLabel.position.set(0, 1.52, 2.03);
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

    // 4. Human Forklift Operator in Driver's Seat with Detailed PPE & Controls
    const operatorGroup = new THREE.Group();
    operatorGroup.name = 'ForkliftOperator';
    operatorGroup.position.set(0, 0.95, 0.15); // Seated in cabin

    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.75, metalness: 0.0 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.2, metalness: 0.4 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc68642, roughness: 0.6 });
    const darkPantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.7 });

    // Torso (High-Vis Safety Vest)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.55, 12), shirtMat);
    torso.position.y = 0.35;
    operatorGroup.add(torso);

    // Reflective Silver Harness Stripes
    const torsoBand = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.18, 0.06, 12), stripeMat);
    torsoBand.position.y = 0.42;
    operatorGroup.add(torsoBand);

    const torsoBandLower = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.165, 0.05, 12), stripeMat);
    torsoBandLower.position.y = 0.22;
    operatorGroup.add(torsoBandLower);

    // Vertical reflective braces
    [-0.09, 0.09].forEach((xOff) => {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.39), stripeMat);
      brace.position.set(xOff, 0.38, 0);
      operatorGroup.add(brace);
    });

    // Seated Legs (Dark Work Cargo Pants)
    const upperLegs = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.15, 0.40), darkPantsMat);
    upperLegs.position.set(0, 0.07, 0.18);
    operatorGroup.add(upperLegs);

    const lowerLegs = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.16), darkPantsMat);
    lowerLegs.position.set(0, -0.12, 0.36);
    operatorGroup.add(lowerLegs);

    // Work Boots
    const bootsMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 });
    [-0.09, 0.09].forEach((xOff) => {
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.2), bootsMat);
      boot.position.set(xOff, -0.28, 0.42);
      operatorGroup.add(boot);
    });

    // Articulated Head Pivot Group
    const operatorHead = new THREE.Group();
    operatorHead.position.set(0, 0.65, 0.02);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), skinMat);
    headMesh.position.set(0, 0.07, 0);
    operatorHead.add(headMesh);

    // Blue Safety Hardhat with extended peak brim
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.1 });
    const helmetDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.138, 14, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      helmetMat
    );
    helmetDome.position.set(0, 0.11, 0);
    operatorHead.add(helmetDome);

    const helmetBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.022, 14), helmetMat);
    helmetBrim.position.set(0, 0.10, 0.04);
    operatorHead.add(helmetBrim);

    // Industrial Safety Earmuffs on Hardhat Sides
    const earmuffMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    [-0.135, 0.135].forEach((xOff) => {
      const muff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.035, 10), earmuffMat);
      muff.rotation.z = Math.PI / 2;
      muff.position.set(xOff, 0.07, 0);
      operatorHead.add(muff);
    });

    // Safety Goggles / Tinted Eye Protection
    const goggleMat = new THREE.MeshStandardMaterial({ color: 0x0e7490, roughness: 0.1, metalness: 0.8 });
    const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.045, 0.05), goggleMat);
    goggles.position.set(0, 0.07, 0.11);
    operatorHead.add(goggles);

    operatorGroup.add(operatorHead);
    this._forkliftOperatorHead = operatorHead;

    // Steering Column & Angled Wheel
    const steeringColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.42, 8), metalMat);
    steeringColumn.position.set(0, 0.34, 0.28);
    steeringColumn.rotation.x = Math.PI / 4.2;
    operatorGroup.add(steeringColumn);

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.018, 8, 20), wheelMat);
    steeringWheel.position.set(0, 0.49, 0.41);
    steeringWheel.rotation.x = Math.PI / 4.2;
    operatorGroup.add(steeringWheel);

    // Left Arm holding the steering wheel
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.38, 8), skinMat);
    leftArm.position.set(-0.16, 0.42, 0.22);
    leftArm.rotation.set(Math.PI / 3.2, 0, -0.22);
    operatorGroup.add(leftArm);

    // Articulated Right Arm Group (can wave or manipulate hydraulic lift levers)
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.16, 0.50, 0.06);

    const rightUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.36, 8), skinMat);
    rightUpperArm.position.set(0, -0.12, 0.14);
    rightUpperArm.rotation.set(Math.PI / 3.4, 0, 0.15);
    rightArmGroup.add(rightUpperArm);

    // Hand gripping lever
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), skinMat);
    hand.position.set(0.02, -0.25, 0.28);
    rightArmGroup.add(hand);

    operatorGroup.add(rightArmGroup);
    this._forkliftOperatorRightArm = rightArmGroup;

    // Hydraulic Levers on Console
    [-0.04, 0.04].forEach((xOff) => {
      const leverStem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 6), metalMat);
      leverStem.position.set(0.15 + xOff, 0.36, 0.32);
      leverStem.rotation.x = -0.2;
      operatorGroup.add(leverStem);

      const leverKnob = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 8, 8),
        new THREE.MeshStandardMaterial({ color: xOff < 0 ? 0xf59e0b : 0x0f172a, roughness: 0.3 })
      );
      leverKnob.position.set(0.15 + xOff, 0.43, 0.305);
      operatorGroup.add(leverKnob);
    });

    forkliftGroup.add(operatorGroup);

    // 5. Amber Safety Warning Strobe Beacon on Roll Cage
    const strobeBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.14, 12),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 2.0 })
    );
    strobeBeacon.position.set(-0.25, 2.25, -0.4);
    forkliftGroup.add(strobeBeacon);

    const strobeLight = new THREE.PointLight(0xf59e0b, 2.5, 6);
    strobeLight.position.set(-0.25, 2.3, -0.4);
    forkliftGroup.add(strobeLight);

    // 6. Headlights casting forward beam onto crossing
    const headlight = new THREE.SpotLight(0xfffbeb, 5.0, 16, Math.PI / 4, 0.3);
    headlight.position.set(0, 1.2, 1.2);
    headlight.target.position.set(0, 0.2, 8.0);
    forkliftGroup.add(headlight);
    forkliftGroup.add(headlight.target);

    group.add(forkliftGroup);
    this._forklift = forkliftGroup;
    this._strobeLight = strobeLight;

    // 7. Organized Perimeter Logistics Staging in Left Bay (North rack & perimeter bays, clear lane)
    this._addStagingCargoArea(group, -7.5, crossingZ, true);

    // 8. Organized Perimeter Logistics Staging in Right Bay (North rack & perimeter bays, clear lane)
    this._addStagingCargoArea(group, 7.5, crossingZ, false);

    // 9. Industrial Convex Safety Mirror on heavy-duty safety post at blind intersection corner
    //    Position: edge of pedestrian hold line (z = crossingZ + 1.65m = -16.35m) and walkway border (x = -2.40m)
    //    rotY = +PI/4: faces both approaching pedestrians and cross-aisle forklift traffic
    this._addConvexSafetyMirror(group, -2.40, 2.45, crossingZ + 1.65, Math.PI / 4);

    // 10. Overhead Facility Warning Placard
    this._addRoomPlacard(group, 0, 5.8, crossingZ + 3.2, 'FACILITY 02 | HIGH-BAY LOGISTICS & ACTIVE FORKLIFT CROSSING');

    this._stopGroups.set('stop_02', group);
    this.scene.add(group);
  }

  /**
   * Generates a procedural convex mirror fisheye reflection texture for realistic warehouse optics.
   */
  _createMirrorTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Soft spherical convex gradient (bright center, darker gradient edge)
    const grad = ctx.createRadialGradient(128, 128, 15, 128, 128, 126);
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(0.35, '#e2e8f0');
    grad.addColorStop(0.7, '#94a3b8');
    grad.addColorStop(0.92, '#475569');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(128, 128, 128, 0, Math.PI * 2);
    ctx.fill();

    // 2. Overhead high-bay warehouse lighting reflections (curved streaks across upper hemisphere)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(128, 64, 76, 16, -0.05, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(128, 102, 58, 11, -0.05, 0, Math.PI * 2);
    ctx.fill();

    // 3. Lower-half subtle aisle/floor reflection gradient
    const floorGrad = ctx.createLinearGradient(0, 140, 0, 256);
    floorGrad.addColorStop(0, 'rgba(71, 85, 105, 0.05)');
    floorGrad.addColorStop(0.5, 'rgba(51, 65, 85, 0.35)');
    floorGrad.addColorStop(1, 'rgba(15, 23, 42, 0.65)');
    ctx.fillStyle = floorGrad;
    ctx.beginPath();
    ctx.arc(128, 128, 124, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.fill();

    // 4. Yellow hazard rim reflection vignette around the perimeter
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(128, 128, 122, 0, Math.PI * 2);
    ctx.stroke();

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * Adds an authentic industrial wide-angle convex safety mirror at the blind intersection.
   * Features a heavy-duty yellow safety bollard/post anchored to the warehouse floor,
   * a steel cantilever arm with ball swivel, and a unified safety-orange convex mirror assembly
   * with hazard rim and reflective dome.
   *
   * @param {THREE.Object3D} parent
   * @param {number} x World X position of post base
   * @param {number} y World Y position of mirror center (typ. 2.45m)
   * @param {number} z World Z position of post base
   * @param {number} rotY Y-rotation of mirror head (faces traffic)
   */
  _addConvexSafetyMirror(parent, x, y = 2.45, z, rotY = Math.PI / 4) {
    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.35,
      metalness: 0.75,
    });
    const boltMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.25,
      metalness: 0.85,
    });
    const postYellowMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.35,
      metalness: 0.15,
    });
    const housingOrangeMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.40,
      metalness: 0.10,
    });
    const hazardRimMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.30,
      metalness: 0.15,
    });

    const mirrorTex = this._createMirrorTexture();
    const mirrorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: mirrorTex || null,
      metalness: 0.78,
      roughness: 0.14,
      emissive: 0x475569,
      emissiveIntensity: 0.25,
    });

    const rootGroup = new THREE.Group();
    rootGroup.name = 'BlindCornerConvexMirror';
    rootGroup.position.set(x, 0, z);

    // ── 1. Heavy-Duty Floor Base Plate & Anchor Bolts ─────────────────────
    const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.24), darkSteelMat);
    basePlate.position.set(0, 0.01, 0);
    basePlate.receiveShadow = true;
    rootGroup.add(basePlate);

    [-0.08, 0.08].forEach((bx) => {
      [-0.08, 0.08].forEach((bz) => {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 8), boltMat);
        bolt.position.set(bx, 0.02, bz);
        rootGroup.add(bolt);
      });
    });

    // ── 2. Vertical Safety-Yellow Steel Bollard / Post (Height 2.22m) ─────
    const postHeight = 2.22;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, postHeight, 16),
      postYellowMat
    );
    post.position.set(0, postHeight / 2, 0);
    post.castShadow = true;
    post.receiveShadow = true;
    rootGroup.add(post);

    // Black hazard contrast bands on post
    [0.35, 0.85, 1.35].forEach((by) => {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.12, 16), darkSteelMat);
      band.position.set(0, by, 0);
      rootGroup.add(band);
    });

    // Top cap collar
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.04, 16), darkSteelMat);
    cap.position.set(0, postHeight + 0.01, 0);
    rootGroup.add(cap);

    // ── 3. Cantilever Bracket & Extension Arm ─────────────────────────────
    const armGroup = new THREE.Group();
    armGroup.position.set(0, postHeight, 0);

    // Vertical riser tubular arm
    const riserLen = Math.max(0.18, y - postHeight);
    const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, riserLen, 12), darkSteelMat);
    riser.position.set(0, riserLen / 2, 0);
    armGroup.add(riser);

    // Forward extension tube toward mirror swivel
    const extLen = 0.16;
    const extTube = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, extLen, 12), darkSteelMat);
    extTube.rotation.x = Math.PI / 2;
    extTube.position.set(0, riserLen, extLen / 2);
    armGroup.add(extTube);

    // Ball-and-socket swivel joint at arm tip
    const ballJoint = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 16), darkSteelMat);
    ballJoint.position.set(0, riserLen, extLen);
    armGroup.add(ballJoint);

    rootGroup.add(armGroup);

    // ── 4. Convex Mirror Head Assembly (Single Unified Solid Unit) ────────
    const headGroup = new THREE.Group();
    headGroup.name = 'MirrorHead';
    headGroup.position.set(0, postHeight + riserLen, extLen + 0.02);
    // Aim the mirror: rotY rotates toward traffic, slight downward pitch (-0.10) frames aisle
    headGroup.rotation.y = rotY;
    headGroup.rotation.x = -0.10;

    // Bracket flange on back of housing (connects directly to ball joint)
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), darkSteelMat);
    flange.rotation.x = Math.PI / 2;
    flange.position.set(0, 0, -0.025);
    headGroup.add(flange);

    // Industrial Orange Weatherproof ABS Backing Housing (Diameter = 0.46m)
    const housingRadius = 0.23;
    const housingThickness = 0.04;
    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(housingRadius, housingRadius, housingThickness, 32),
      housingOrangeMat
    );
    housing.rotation.x = Math.PI / 2;
    housing.position.set(0, 0, 0);
    headGroup.add(housing);

    // Yellow Hazard Safety Rim / Bezel (Border flush with front of housing)
    const rimRadius = housingRadius;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(rimRadius, 0.022, 16, 32),
      hazardRimMat
    );
    rim.position.set(0, 0, housingThickness / 2);
    headGroup.add(rim);

    // Convex Mirror Surface Dome (curved cap bulging forward seamlessly from rim)
    const curveR = 0.55;
    const domeBaseR = 0.222;
    const thetaMax = Math.asin(domeBaseR / curveR); // ~0.41 rad
    const domeGeo = new THREE.SphereGeometry(curveR, 32, 16, 0, Math.PI * 2, 0, thetaMax);
    // Shift geometry so its base rim is at Y = 0 (before rotation)
    domeGeo.translate(0, -curveR * Math.cos(thetaMax), 0);

    const dome = new THREE.Mesh(domeGeo, mirrorMat);
    // Rotate so dome bulges along local +Z
    dome.rotation.x = -Math.PI / 2;
    // Place base flush with front face of housing
    dome.position.set(0, 0, housingThickness / 2);
    headGroup.add(dome);

    rootGroup.add(headGroup);

    parent.add(rootGroup);
    return rootGroup;
  }

  /**
   * Adds clean perimeter staging racks, freight pallets, and organized storage bays along the North/South boundaries,
   * leaving the central transit aisle (z = originZ) completely clear for forklift navigation.
   */
  _addStagingCargoArea(root, originX, originZ, isLeft) {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xd4bda8, roughness: 0.45 });
    const orangeBoxMat = new THREE.MeshStandardMaterial({ color: 0xc27a42, roughness: 0.5 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
    const rackBlueMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.4 });
    const rackOrangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.35 });

    // 1. Storage Racks along Zone 02 Transit Corridor (Both Inner Corridor at x = ±4.4m and Outer Wall at x = ±7.2m, z = -14.0m)
    [-4.4, -7.2].forEach((rxOffset) => {
      const rackGroup = new THREE.Group();
      const rackX = isLeft ? rxOffset : -rxOffset;
      const rackZ = originZ + 4.0; // In Facility 02 (z = -14.0m, clearly visible through Archway 2 from Stop 03)
      rackGroup.position.set(rackX, 0, rackZ);

      const rWidth = 1.1;
      const rLength = 3.6;
      const rHeight = 3.2;

      // Uprights
      [-rLength / 2, 0, rLength / 2].forEach((rx) => {
        [-rWidth / 2, rWidth / 2].forEach((rz) => {
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.1, rHeight, 0.1), rackBlueMat);
          col.position.set(rx, rHeight / 2, rz);
          rackGroup.add(col);
        });
      });

      // Beams & Stored Cargo Tiers
      [1.3, 2.5].forEach((by) => {
        const beamFront = new THREE.Mesh(new THREE.BoxGeometry(rLength, 0.12, 0.06), rackOrangeMat);
        beamFront.position.set(0, by, -rWidth / 2);
        rackGroup.add(beamFront);

        const beamBack = new THREE.Mesh(new THREE.BoxGeometry(rLength, 0.12, 0.06), rackOrangeMat);
        beamBack.position.set(0, by, rWidth / 2);
        rackGroup.add(beamBack);

        // Pallets & Cargo Boxes on this rack shelf
        [-1.2, 0.0, 1.2].forEach((px) => {
          const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 1.0), woodMat);
          pallet.position.set(px, by + 0.05, 0);
          rackGroup.add(pallet);

          const isCrate = Math.random() > 0.5;
          const cargo = new THREE.Mesh(
            new THREE.BoxGeometry(0.85, 0.65, 0.85),
            isCrate ? crateMat : (Math.random() > 0.5 ? orangeBoxMat : boxMat)
          );
          cargo.position.set(px, by + 0.42, 0);
          cargo.castShadow = true;
          rackGroup.add(cargo);
        });
      });
      root.add(rackGroup);
    });

    // 2. Designated Floor Storage Bays strictly inside Facility 02 (z = -16.2m and z = -12.0m)
    // NEVER placed in the central driving corridor or past archways
    const floorPositions = isLeft
      ? [
          { x: -4.4, z: originZ + 1.8, h: 2, type: 'crates' },
          { x: -7.2, z: originZ + 1.8, h: 3, type: 'boxes' },
          { x: -4.4, z: originZ + 6.0, h: 3, type: 'mixed' },
          { x: -7.2, z: originZ + 6.0, h: 2, type: 'boxes' },
        ]
      : [
          { x: 4.4, z: originZ + 1.8, h: 3, type: 'boxes' },
          { x: 7.2, z: originZ + 1.8, h: 2, type: 'crates' },
          { x: 4.4, z: originZ + 6.0, h: 2, type: 'crates' },
          { x: 7.2, z: originZ + 6.0, h: 3, type: 'mixed' },
        ];

    floorPositions.forEach(({ x, z, h, type }) => {
      this._addFloorBayDecal(root, x, z);

      const stackGroup = new THREE.Group();
      stackGroup.position.set(x, 0, z);

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

    // ─── 1. Deep Multi-Bay Storage Aisles (Double Parallel Rows on Left & Right) ───
    const rackSides = [-7.50, -2.85, 2.85, 7.50];
    const rackZPositions = [-23.6, -26.8];

    rackSides.forEach((rx) => {
      rackZPositions.forEach((rz) => {
        const rackGroup = new THREE.Group();
        rackGroup.position.set(rx, 0, rz);

        const rackWidth = 1.1;
        const rackLength = 3.2;
        const rackHeight = 3.6;

        const isHazardBay = (rx === -2.85 && rz === -23.6);

        // 4 Forest Green Vertical Columns (Uprights) with punching slots
        const colOffsets = [
          { x: -rackWidth / 2, z: -rackLength / 2 },
          { x: rackWidth / 2, z: -rackLength / 2 },
          { x: -rackWidth / 2, z: rackLength / 2 },
          { x: rackWidth / 2, z: rackLength / 2 },
        ];
        colOffsets.forEach(({ x, z }) => {
          // If this is the specific damaged foot upright on the LEFT aisle rack (front aisle corner: x = rackWidth/2, z = rackLength/2), skip standard column
          if (isHazardBay && x === rackWidth / 2 && z === rackLength / 2) {
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
          strut1.position.set(0, 1.35, endZ);
          strut1.rotation.z = Math.atan2(1.35, rackWidth) * 0.75;
          rackGroup.add(strut1);

          const strut2 = new THREE.Mesh(new THREE.BoxGeometry(rackWidth, 0.04, 0.04), strutMat);
          strut2.position.set(0, 2.55, endZ);
          strut2.rotation.z = -Math.atan2(1.35, rackWidth) * 0.75;
          rackGroup.add(strut2);
        });

        // 2 Tiers of Heavy Orange Horizontal Load Beams at 1.35m and 2.55m
        const beamHeights = [1.35, 2.55];
        beamHeights.forEach((by) => {
          // Back Orange Beam
          const beamBack = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, rackLength), orangeBeamMat);
          beamBack.position.set(rx > 0 ? rackWidth / 2 : -rackWidth / 2, by, 0);
          rackGroup.add(beamBack);

          // Wire Mesh Safety Decking on shelf
          const wireDeck = new THREE.Mesh(new THREE.BoxGeometry(rackWidth - 0.1, 0.02, rackLength - 0.1), wireMeshMat);
          wireDeck.position.set(0, by + 0.01, 0);
          rackGroup.add(wireDeck);

          // ─── Front Aisle Beam: Smooth Continuous Sagging Deformation on Hazard Bay ───
          if (isHazardBay && by === 1.35) {
            const beamCurve = new THREE.CatmullRomCurve3([
              new THREE.Vector3(rackWidth / 2, by, -rackLength / 2),
              new THREE.Vector3(rackWidth / 2, by - 0.18, -rackLength / 4),
              new THREE.Vector3(rackWidth / 2, by - 0.34, 0.0),
              new THREE.Vector3(rackWidth / 2, by - 0.20, rackLength / 4),
              new THREE.Vector3(rackWidth / 2, by, rackLength / 2),
            ]);
            const beamShape = new THREE.Shape();
            beamShape.moveTo(-0.04, -0.07);
            beamShape.lineTo(0.04, -0.07);
            beamShape.lineTo(0.04, 0.07);
            beamShape.lineTo(-0.04, 0.07);
            beamShape.closePath();
            const beamGeom = new THREE.ExtrudeGeometry(beamShape, { steps: 24, bevelEnabled: false, extrudePath: beamCurve });
            const sagBeam = new THREE.Mesh(beamGeom, orangeBeamMat);
            sagBeam.castShadow = true;
            rackGroup.add(sagBeam);

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
          const label = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.07), yellowLabelMat);
          label.position.set(rx > 0 ? -rackWidth / 2 - 0.05 : rackWidth / 2 + 0.05, by, 0);
          label.rotation.y = rx > 0 ? -Math.PI / 2 : Math.PI / 2;
          rackGroup.add(label);

          // Loaded Pallets & Colored Freight Boxes (Cardboard Kraft / Tan / Ochre)
          const palletOffsets = [-0.85, 0.85];
          palletOffsets.forEach((pz, idx) => {
            const palletGroup = new THREE.Group();
            const basePosY = (isHazardBay && by === 1.35) ? (by - 0.14) : (by + 0.05);
            palletGroup.position.set(0, basePosY, pz);

            if (isHazardBay && by === 1.35) {
              palletGroup.rotation.x = pz < 0 ? -0.12 : 0.12;
              palletGroup.rotation.z = -0.04;
            } else if (isHazardBay && by === 2.55) {
              // Upper tier tilts forward precariously over the compromised upright
              palletGroup.rotation.x = pz < 0 ? -0.06 : 0.09;
              palletGroup.rotation.z = -0.05;
            }

            const useChep = (idx % 2 === 0);
            const pallet = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.09, 1.1), useChep ? blueChepMat : woodMat);
            pallet.castShadow = true;
            palletGroup.add(pallet);

            // Well-proportioned stacked cardboard carton boxes
            const chosenMat = boxPalette[(idx + Math.floor(Math.abs(rz + rx))) % boxPalette.length];
            const cargo = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.58, 0.86), chosenMat);
            // Front carton on upper hazard tier overhangs pallet edge due to structural deflection
            const cargoPosX = (isHazardBay && by === 2.55 && idx === 1) ? 0.08 : 0;
            cargo.position.set(cargoPosX, 0.34, 0);
            cargo.castShadow = true;
            palletGroup.add(cargo);

            // Top Box Sealing Tape Strip
            const tape = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.01, 0.1), tapeMat);
            tape.position.set(0, 0.635, 0);
            palletGroup.add(tape);

            rackGroup.add(palletGroup);
          });
        });

        root.add(rackGroup);
      });
    });

    // ─── 2. Deep Background Cross-Racks on Left & Right Flanks (Clear Central Aisle) ───
    const bgRackX = [-8.8, 8.8];
    bgRackX.forEach((bx, bIdx) => {
      const bgGroup = new THREE.Group();
      bgGroup.position.set(bx, 0, -31.0);
      const bgWidth = 2.4; const bgLength = 1.1; const bgHeight = 3.6;

      // Uprights
      [-bgWidth / 2, bgWidth / 2].forEach((x) => {
        [-bgLength / 2, bgLength / 2].forEach((z) => {
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.12, bgHeight, 0.12), greenUprightMat);
          col.position.set(x, bgHeight / 2, z);
          bgGroup.add(col);
        });
      });

      // Beams & Freight
      [1.35, 2.55].forEach((by) => {
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(bgWidth, 0.14, 0.08), orangeBeamMat);
        b1.position.set(0, by, -bgLength / 2);
        bgGroup.add(b1);

        const b2 = new THREE.Mesh(new THREE.BoxGeometry(bgWidth, 0.14, 0.08), orangeBeamMat);
        b2.position.set(0, by, bgLength / 2);
        bgGroup.add(b2);

        [-0.65, 0.65].forEach((px, pIdx) => {
          const pal = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.09, 0.95), woodMat);
          pal.position.set(px, by + 0.05, 0);
          bgGroup.add(pal);

          const mat = boxPalette[(bIdx + pIdx) % boxPalette.length];
          const c = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.58, 0.8), mat);
          c.position.set(px, by + 0.38, 0);
          bgGroup.add(c);
        });
      });

      root.add(bgGroup);
    });

    // 3. Industrial Wrap-Around Corner Rack-Leg Guards (Mounted directly to corner upright bases)
    const legGuardPositions = [
      { x: 2.30, z: -22.0, rot: -Math.PI / 2 },  // Right Inner Aisle Entry Corner
      { x: -6.95, z: -22.0, rot: Math.PI / 2 },   // Left Outer Row Entry Corner
      { x: 6.95, z: -22.0, rot: -Math.PI / 2 },   // Right Outer Row Entry Corner
      { x: -2.30, z: -31.6, rot: Math.PI },       // Left Inner Aisle Rear Corner
      { x: 2.30, z: -31.6, rot: Math.PI },        // Right Inner Aisle Rear Corner
      { x: -6.95, z: -31.6, rot: Math.PI },       // Left Outer Row Rear Corner
      { x: 6.95, z: -31.6, rot: Math.PI },        // Right Outer Row Rear Corner
    ];

    legGuardPositions.forEach(({ x, z, rot }) => {
      const guard = this._buildRackLegGuard(x, z, rot);
      root.add(guard);
    });
  }

  /**
   * Builds an authentic heavy-duty industrial yellow wrap-around rack leg guard / post protector.
   */
  _buildRackLegGuard(x, z, angleFacing = 0) {
    const guardGroup = new THREE.Group();
    guardGroup.position.set(x, 0, z);
    guardGroup.rotation.y = angleFacing;

    const yellowGuardMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.35,
      metalness: 0.5,
    });
    const blackStripeMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.6,
    });
    const steelBoltMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.3,
      metalness: 0.85,
    });

    const guardHeight = 0.48;

    // 1. Heavy Gauge Steel Angle Shield wrapping corner upright
    const frontFace = new THREE.Mesh(new THREE.BoxGeometry(0.20, guardHeight, 0.025), yellowGuardMat);
    frontFace.position.set(0, guardHeight / 2, 0.085);
    frontFace.castShadow = true;
    guardGroup.add(frontFace);

    const sideFace = new THREE.Mesh(new THREE.BoxGeometry(0.025, guardHeight, 0.18), yellowGuardMat);
    sideFace.position.set(0.085, guardHeight / 2, 0);
    sideFace.castShadow = true;
    guardGroup.add(sideFace);

    // Hazard warning diagonal stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.07, 0.03), blackStripeMat);
    stripe.position.set(0, guardHeight * 0.55, 0.085);
    guardGroup.add(stripe);

    // 2. Bolted Base Anchor Flange
    const baseFlange = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.24), yellowGuardMat);
    baseFlange.position.set(0.03, 0.01, 0.03);
    guardGroup.add(baseFlange);

    // Hex Anchor Bolts
    [
      { bx: -0.05, bz: 0.12 },
      { bx: 0.12, bz: -0.05 },
      { bx: 0.12, bz: 0.12 },
    ].forEach(({ bx, bz }) => {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.035, 6), steelBoltMat);
      bolt.position.set(bx, 0.025, bz);
      guardGroup.add(bolt);
    });

    return guardGroup;
  }

  /**
   * Stop 3: Structural Collision Damage & Racking Defect Zone.
   */
  async _loadStop3Props() {
    const group = new THREE.Group();
    group.name = 'Stop3_BentRackZone';

    this._buildHighBayRacksWithCargo(group);

    // ─── Damaged Column at x: -2.30, z: -22.00 (Front Aisle Column of the Left Hazard Bay) ───
    const damagedColumnGroup = new THREE.Group();
    damagedColumnGroup.position.set(-2.30, 0, -22.00);

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
    bentBaseplate.position.set(0.08, 0.02, 0.0);
    bentBaseplate.rotation.z = 0.22;
    damagedColumnGroup.add(bentBaseplate);

    // 3. Continuous Smooth Bent Column Extrusion (Single seamless solid geometry)
    const colCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.08, 0.0, 0.0),
      new THREE.Vector3(0.18, 0.45, 0.0),
      new THREE.Vector3(0.10, 1.35, 0.0),
      new THREE.Vector3(0.03, 2.50, 0.0),
      new THREE.Vector3(0.0, 3.60, 0.0),
    ]);
    const colShape = new THREE.Shape();
    colShape.moveTo(-0.06, -0.06);
    colShape.lineTo(0.06, -0.06);
    colShape.lineTo(0.06, 0.06);
    colShape.lineTo(-0.06, 0.06);
    colShape.closePath();
    const colGeom = new THREE.ExtrudeGeometry(colShape, { steps: 32, bevelEnabled: false, extrudePath: colCurve });
    const bentCol = new THREE.Mesh(colGeom, greenSteelMat);
    bentCol.castShadow = true;
    damagedColumnGroup.add(bentCol);

    // 4. Scraped Bare Steel & Impact Primer Sleeve at Crushed Foot
    const scrapeFoot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.45, 0.15), orangePrimerMat);
    scrapeFoot.position.set(0.13, 0.24, 0.0);
    scrapeFoot.rotation.z = 0.22;
    damagedColumnGroup.add(scrapeFoot);

    // 4b. Forklift collision yellow paint transfer and gouge marks at y = 0.42m
    const impactGougeMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15, // Forklift yellow paint transfer
      roughness: 0.45,
      metalness: 0.35,
    });
    const gougeScrape = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.14), impactGougeMat);
    gougeScrape.position.set(0.15, 0.42, 0.0);
    gougeScrape.rotation.z = 0.18;
    damagedColumnGroup.add(gougeScrape);

    // 4c. SEMA Defect Notice Tag clamped to upright at eye level (y = 1.65m), facing the pedestrian aisle
    const inspectionTag = this._buildRackInspectionTag();
    inspectionTag.position.set(0.08, 1.65, 0.0);
    inspectionTag.rotation.y = Math.PI / 2;
    damagedColumnGroup.add(inspectionTag);

    // 5. Subtle Focused Hazard Light grazing the crumpled foot and sagging beam
    const hazardLight = new THREE.PointLight(0xffedd5, 3.5, 8);
    hazardLight.position.set(0.6, 1.2, 0.6);
    damagedColumnGroup.add(hazardLight);

    group.add(damagedColumnGroup);

    // Register hazard bounds for realistic cordon placement around the damaged bay
    const hazardBox = new THREE.Box3();
    hazardBox.expandByPoint(new THREE.Vector3(-3.4, 0, -25.4));
    hazardBox.expandByPoint(new THREE.Vector3(-1.8, 0, -21.6));
    this._hazardBounds.set('stop_03', {
      box: hazardBox,
      clamp: { xMin: -3.5, xMax: -1.7, zMin: -25.6, zMax: -21.4 },
    });

    // 6. Overhead High-Bay Industrial Lighting for Aisle B
    const aisleLight1 = new THREE.PointLight(0xfffbeb, 3.5, 16);
    aisleLight1.position.set(0, 5.5, -23.0);
    group.add(aisleLight1);

    const aisleLight2 = new THREE.PointLight(0xfffbeb, 3.5, 16);
    aisleLight2.position.set(0, 5.5, -29.0);
    group.add(aisleLight2);

    // 7. Overhead Facility Placard for Aisle B
    this._addRoomPlacard(group, 0, 5.8, -20.0, 'FACILITY 03 | HIGH-BAY STORAGE & PALLET RACKING AISLE B');

    this._stopGroups.set('stop_03', group);
    this.scene.add(group);
  }

  /**
   * Builds an authentic SEMA magnetic rack damage inspection defect tag.
   */
  _buildRackInspectionTag() {
    const tagGroup = new THREE.Group();
    tagGroup.name = 'RackDamageInspectionTag';

    if (typeof document === 'undefined') return tagGroup;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return tagGroup;

    // High-visibility yellow background with dark border
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(0, 0, 256, 360);
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 244, 348);

    // Red Header Band
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(12, 12, 232, 58);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SEMA DEFECT NOTICE', 128, 48);

    // Severity Box
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(20, 80, 216, 38);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('CATEGORY: RED HAZARD', 128, 106);

    // Defect details
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('DEFECT: COLUMN BENT > 5mm', 24, 150);
    ctx.fillText('ACTION: OFFLOAD BAY NOW', 24, 185);
    ctx.fillText('LOGGED: 6 MONTHS AGO', 24, 220);
    ctx.fillText('INSPECTED BY: D. MILLER', 24, 255);
    ctx.fillText('STATUS: OVERDUE REPAIR', 24, 290);

    // Warning strip at bottom
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(12, 318, 232, 30);
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DO NOT ATTEMPT REPAIR', 128, 338);

    const tex = new THREE.CanvasTexture(canvas);
    const tagMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.35,
      side: THREE.DoubleSide,
    });

    // Magnetic Clip mount
    const clipMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.02), clipMat);
    clip.position.set(0, 0.16, 0.01);
    tagGroup.add(clip);

    const tagCard = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.32), tagMat);
    tagCard.position.set(0, 0, 0.01);
    tagGroup.add(tagCard);

    return tagGroup;
  }

  /**
   * Builds an authentic heavy-duty CO2 fire extinguisher on a red polymer floor stand with full graphics and wire backdrop.
   */
  _buildCO2FireExtinguisherStand(x, z, rotY = 0) {
    const feGroup = new THREE.Group();
    feGroup.position.set(x, 0, z);
    feGroup.rotation.y = rotY;

    const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.75 });
    const standSteelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.85 });

    // Security Wire Mesh Backdrop
    const meshFrameMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.4 });
    const meshBackdrop = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.2, 0.02), meshFrameMat);
    meshBackdrop.position.set(0, 1.1, -0.16);
    feGroup.add(meshBackdrop);

    // Inner wire grid texture for security fence
    const gridCanvas = document.createElement('canvas');
    gridCanvas.width = 128; gridCanvas.height = 128;
    const gctx = gridCanvas.getContext('2d');
    gctx.fillStyle = '#64748b'; gctx.fillRect(0, 0, 128, 128);
    gctx.strokeStyle = '#cbd5e1'; gctx.lineWidth = 4;
    gctx.strokeRect(4, 4, 120, 120);
    gctx.beginPath();
    for (let p = 16; p < 128; p += 16) {
      gctx.moveTo(p, 0); gctx.lineTo(p, 128);
      gctx.moveTo(0, p); gctx.lineTo(128, p);
    }
    gctx.stroke();
    const gridTex = new THREE.CanvasTexture(gridCanvas);
    gridTex.wrapS = THREE.RepeatWrapping;
    gridTex.wrapT = THREE.RepeatWrapping;
    gridTex.repeat.set(6, 14);
    const meshWire = new THREE.Mesh(
      new THREE.PlaneGeometry(0.80, 2.15),
      new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.5, metalness: 0.7 })
    );
    meshWire.position.set(0, 1.1, -0.145);
    feGroup.add(meshWire);

    // Red Molded Polymer Floor Stand
    const standRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });

    // Stand Base Tray (Floor Well)
    const standBase = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.38), standRedMat);
    standBase.position.set(0, 0.04, 0.04);
    standBase.castShadow = true;
    feGroup.add(standBase);

    const standTrayInner = new THREE.Mesh(
      new THREE.BoxGeometry(0.40, 0.05, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5 })
    );
    standTrayInner.position.set(0, 0.065, 0.04);
    feGroup.add(standTrayInner);

    // Stand Upright Back Panel with Curved Side Wings
    const standBack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.25, 0.04), standRedMat);
    standBack.position.set(0, 0.665, -0.13);
    feGroup.add(standBack);

    const standWingL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.75, 0.16), standRedMat);
    standWingL.position.set(-0.21, 0.42, -0.05);
    feGroup.add(standWingL);

    const standWingR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.75, 0.16), standRedMat);
    standWingR.position.set(0.21, 0.42, -0.05);
    feGroup.add(standWingR);

    // Upper Identification & Suitability Signboard (Mounted on Stand Backboard)
    const idCanvas = document.createElement('canvas');
    idCanvas.width = 512; idCanvas.height = 360;
    const idctx = idCanvas.getContext('2d');
    idctx.fillStyle = '#ffffff'; idctx.fillRect(0, 0, 512, 360);
    idctx.strokeStyle = '#dc2626'; idctx.lineWidth = 14;
    idctx.strokeRect(8, 8, 496, 344);

    // Red fire badge on left
    idctx.fillStyle = '#dc2626';
    idctx.fillRect(24, 24, 130, 130);
    idctx.fillStyle = '#ffffff';
    idctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    idctx.textAlign = 'center';
    idctx.fillText('FIRE', 89, 65);
    idctx.fillText('FLAMES', 89, 95);

    // Green suitability boxes (Electrical & Flammable liquids)
    idctx.fillStyle = '#16a34a';
    idctx.fillRect(170, 24, 310, 60);
    idctx.fillStyle = '#ffffff';
    idctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    idctx.textAlign = 'left';
    idctx.fillText('✔ ELECTRICAL (LIVE)', 185, 60);

    idctx.fillStyle = '#16a34a';
    idctx.fillRect(170, 94, 310, 60);
    idctx.fillStyle = '#ffffff';
    idctx.fillText('✔ FLAMMABLE LIQUIDS', 185, 130);

    // Red prohibition boxes (Wood/Paper/Textiles)
    idctx.fillStyle = '#dc2626';
    idctx.fillRect(24, 170, 456, 50);
    idctx.fillStyle = '#ffffff';
    idctx.fillText('✖ DO NOT USE ON WOOD / PAPER / TEXTILES', 40, 202);

    idctx.fillStyle = '#0f172a';
    idctx.font = '900 32px "Segoe UI", Arial, sans-serif';
    idctx.textAlign = 'center';
    idctx.fillText('CARBON DIOXIDE (CO₂)', 256, 275);
    idctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    idctx.fillStyle = '#475569';
    idctx.fillText('SAFE ON ENERGIZED ELECTRICAL EQUIPMENT', 256, 315);

    const idTex = new THREE.CanvasTexture(idCanvas);
    idTex.generateMipmaps = true;
    idTex.anisotropy = 8;
    const standIdSign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.38, 0.27),
      new THREE.MeshStandardMaterial({ map: idTex, roughness: 0.25 })
    );
    standIdSign.position.set(0, 1.05, -0.108);
    feGroup.add(standIdSign);

    // 5kg CO2 Fire Extinguisher Cylinder
    const cylGroup = new THREE.Group();
    cylGroup.position.set(0, 0, 0.03);

    const feWrapCanvas = document.createElement('canvas');
    feWrapCanvas.width = 1024; feWrapCanvas.height = 1024;
    const wctx = feWrapCanvas.getContext('2d');
    wctx.fillStyle = '#dc2626'; wctx.fillRect(0, 0, 1024, 1024);

    wctx.fillStyle = '#09090b';
    wctx.fillRect(200, 180, 624, 130);
    wctx.fillStyle = '#ffffff';
    wctx.font = 'italic 900 110px "Segoe UI", Arial, sans-serif';
    wctx.textAlign = 'center';
    wctx.fillText('CO2', 512, 280);

    wctx.fillStyle = '#ffffff';
    wctx.font = '900 48px "Segoe UI", Arial, sans-serif';
    wctx.fillText('FIRE EXTINGUISHER', 512, 360);
    wctx.font = 'bold 34px "Segoe UI", Arial, sans-serif';
    wctx.fillText('5kg CARBON DIOXIDE', 512, 405);

    wctx.strokeStyle = '#ffffff';
    wctx.lineWidth = 4;
    wctx.strokeRect(220, 435, 584, 85);
    wctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
    wctx.textAlign = 'left';
    wctx.fillText('1. Use upright. Pull out safety pin.', 240, 490);

    wctx.strokeRect(220, 535, 584, 85);
    wctx.fillText('2. Direct horn at base of fire from 1m.', 240, 590);

    wctx.strokeRect(220, 635, 584, 85);
    wctx.fillText('3. Squeeze handles together.', 240, 690);

    wctx.fillStyle = '#ffffff';
    wctx.fillRect(220, 740, 80, 80);
    wctx.fillStyle = '#dc2626';
    wctx.font = '900 56px "Segoe UI", Arial, sans-serif';
    wctx.textAlign = 'center';
    wctx.fillText('⚡', 260, 800);
    wctx.fillStyle = '#ffffff';
    wctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
    wctx.textAlign = 'left';
    wctx.fillText('SAFE UP TO 1000V', 320, 790);

    wctx.fillStyle = '#ffffff';
    wctx.fillRect(220, 845, 584, 95);
    wctx.fillStyle = '#dc2626';
    wctx.font = '900 44px "Segoe UI", Arial, sans-serif';
    wctx.textAlign = 'center';
    wctx.fillText('🔥 KINGS FIRE', 512, 895);
    wctx.fillStyle = '#0f172a';
    wctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    wctx.fillText('SERVICE & SALES: 01582 818200', 512, 928);

    const feWrapTex = new THREE.CanvasTexture(feWrapCanvas);
    feWrapTex.generateMipmaps = true;
    feWrapTex.anisotropy = 8;

    const cylBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.62, 32),
      new THREE.MeshStandardMaterial({ map: feWrapTex, roughness: 0.3, metalness: 0.2 })
    );
    cylBody.position.set(0, 0.40, 0);
    cylBody.castShadow = true;
    cylGroup.add(cylBody);

    const cylDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 })
    );
    cylDome.position.set(0, 0.71, 0);
    cylGroup.add(cylDome);

    const valveNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.09, 16), standSteelMat);
    valveNeck.position.set(0, 0.84, 0);
    cylGroup.add(valveNeck);

    const handleBlack = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.22), new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.6 }));
    handleBlack.position.set(0, 0.90, -0.04);
    cylGroup.add(handleBlack);

    const leverRed = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.018, 0.22), new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 }));
    leverRed.position.set(0, 0.94, -0.04);
    leverRed.rotation.x = -0.15;
    cylGroup.add(leverRed);

    const safetyPin = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 8, 16), standSteelMat);
    safetyPin.position.set(0.03, 0.91, -0.02);
    safetyPin.rotation.y = Math.PI / 2;
    cylGroup.add(safetyPin);

    // Inspection Record Tag (Yellow OSHA Plastic Tag tied with security wire)
    const tagCanvas = document.createElement('canvas');
    tagCanvas.width = 128; tagCanvas.height = 256;
    const tctx = tagCanvas.getContext('2d');
    tctx.fillStyle = '#fef08a'; tctx.fillRect(0, 0, 128, 256);
    tctx.strokeStyle = '#ca8a04'; tctx.lineWidth = 4; tctx.strokeRect(4, 4, 120, 248);
    tctx.fillStyle = '#0f172a'; tctx.font = 'bold 13px sans-serif'; tctx.textAlign = 'center';
    tctx.fillText('INSPECTION', 64, 26);
    tctx.fillText('RECORD', 64, 44);
    tctx.fillStyle = '#15803d'; tctx.fillRect(10, 52, 108, 24);
    tctx.fillStyle = '#ffffff'; tctx.font = 'bold 14px sans-serif';
    tctx.fillText('PASSED', 64, 69);
    tctx.fillStyle = '#0f172a'; tctx.font = '10px monospace';
    tctx.fillText('DATE: 08/2026', 64, 95);
    tctx.fillText('BY: KINGS FIRE', 64, 115);
    tctx.fillText('NEXT: 08/2027', 64, 135);
    tctx.fillText('PRESS: 55 BAR', 64, 155);
    tctx.fillText('PIN: VERIFIED', 64, 175);
    tctx.fillStyle = '#dc2626'; tctx.font = 'bold 10px sans-serif';
    tctx.fillText('DO NOT REMOVE', 64, 210);

    const feTagTex = new THREE.CanvasTexture(tagCanvas);
    const feTag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, 0.16),
      new THREE.MeshStandardMaterial({ map: feTagTex, roughness: 0.4 })
    );
    feTag.position.set(0.06, 0.82, -0.01);
    feTag.rotation.y = Math.PI / 4;
    feTag.rotation.z = -0.15;
    cylGroup.add(feTag);

    // Black Flared Discharge Horn & Swivel Arm
    const hornArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.28, 12),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 })
    );
    hornArm.position.set(0.11, 0.72, 0.04);
    hornArm.rotation.z = -0.55;
    cylGroup.add(hornArm);

    const hornCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.32, 24),
      new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.6 })
    );
    hornCone.position.set(0.20, 0.52, 0.06);
    hornCone.rotation.z = -0.55;
    hornCone.castShadow = true;
    cylGroup.add(hornCone);

    feGroup.add(cylGroup);

    // Floor Clearance Hatching in front of extinguisher
    const feFloorCanvas = document.createElement('canvas');
    feFloorCanvas.width = 256; feFloorCanvas.height = 256;
    const ffctx = feFloorCanvas.getContext('2d');
    ffctx.fillStyle = '#dc2626'; ffctx.fillRect(0, 0, 256, 256);
    ffctx.fillStyle = '#ffffff';
    ffctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    ffctx.textAlign = 'center';
    ffctx.fillText('KEEP CLEAR', 128, 110);
    ffctx.fillText('36 INCHES', 128, 155);
    const feFloorTex = new THREE.CanvasTexture(feFloorCanvas);
    const feFloorHatch = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 0.85),
      new THREE.MeshBasicMaterial({ map: feFloorTex })
    );
    feFloorHatch.rotation.x = -Math.PI / 2;
    feFloorHatch.position.set(0, 0.005, 0.55);
    feGroup.add(feFloorHatch);

    return feGroup;
  }

  /**
   * Stop 4: Forklift Battery Charging Bay & Electrical Overheat Hazard.
   * Faithfully recreated from the industrial reference photo:
   *  - Real glTF Forklift (identical to Stop 02) docked in the charging stall with beige/cream Crown body & black chassis.
   *  - Post-mounted modern black industrial high-frequency charger with digital LCD screen & keypad.
   *  - Heavy charging cable connected directly from charger to forklift side charging port.
   *  - Yellow V-FORCE floor cable tray guard, yellow wheel stops with black hazard chevrons, and footprint floor decals.
   *  - Corrugated metal siding wall with wall-mounted grey disconnect switch and conduit.
   *  - Flashing amber overheat fault strobe and misplaced combustible boxes encroaching the 3ft clearance zone.
   */
  async _loadStop4Props() {
    const group = new THREE.Group();
    group.name = 'Stop4_ChargingBayZone';

    const boxTex1 = this._createCardboardBoxTexture('FRAGILE');
    const boxTex2 = this._createCardboardBoxTexture('HEAVY');

    // ─── Materials ─────────────────────────────────────────────────────────────
    const standSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 });
    const chargerBlackMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.35, metalness: 0.5 });
    const conduitMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.85 });
    const disconnectGreyMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.6 });
    const yellowSafetyMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
    const cableRubberMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 });
    const plugMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.6 });
    const amberStrobeMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 4.0,
      roughness: 0.2,
    });
    const eStopRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });

    // ─── 1. Corrugated Industrial Metal Siding Wall (Matching Photo) ───────────
    const wallGroup = new THREE.Group();
    wallGroup.position.set(-6.8, 0, -31.65); // Centered between z: -28.2 and -35.1

    const sidingMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.5, metalness: 0.6 });
    // Strictly contained within Stop 4 (z: -35.05 to -28.25), zero spillover into Stop 3
    for (let z = -3.4; z <= 3.4; z += 0.25) {
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 6.0, 0.12), sidingMat);
      ridge.position.set(0, 3.0, z);
      wallGroup.add(ridge);
    }
    const wallBack = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 6.0), sidingMat);
    wallBack.position.set(-0.03, 3.0, 0);
    wallBack.rotation.y = Math.PI / 2;
    wallGroup.add(wallBack);

    // Yellow Guardrail along wall base behind both stalls (strictly inside Stop 4 bay)
    const guardrail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 6.8), yellowSafetyMat);
    guardrail.position.set(0.4, 0.35, 0);
    wallGroup.add(guardrail);

    // ─── High-Visibility Industrial Warehouse Signage Boards Mounted on the Siding ───
    // 1. Large Upper Main Facility Board (4.8m wide x 1.1m high)
    const mainCanvas = document.createElement('canvas');
    mainCanvas.width = 1024; mainCanvas.height = 256;
    const mctx = mainCanvas.getContext('2d');

    // Industrial Charcoal base with OSHA Safety Yellow border
    mctx.fillStyle = '#111827';
    mctx.fillRect(0, 0, 1024, 256);

    // Top safety diagonal chevron stripe
    mctx.fillStyle = '#facc15';
    mctx.fillRect(0, 0, 1024, 26);
    mctx.fillStyle = '#111827';
    for (let cx = -20; cx < 1040; cx += 32) {
      mctx.beginPath();
      mctx.moveTo(cx, 0);
      mctx.lineTo(cx + 16, 0);
      mctx.lineTo(cx + 6, 26);
      mctx.lineTo(cx - 10, 26);
      mctx.fill();
    }

    // Bottom safety stripe
    mctx.fillStyle = '#facc15';
    mctx.fillRect(0, 230, 1024, 26);
    mctx.fillStyle = '#111827';
    for (let cx = -20; cx < 1040; cx += 32) {
      mctx.beginPath();
      mctx.moveTo(cx, 230);
      mctx.lineTo(cx + 16, 230);
      mctx.lineTo(cx + 6, 256);
      mctx.lineTo(cx - 10, 256);
      mctx.fill();
    }

    // Red OSHA DANGER Header Pill
    mctx.fillStyle = '#dc2626';
    mctx.fillRect(36, 38, 170, 32);
    mctx.fillStyle = '#ffffff';
    mctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    mctx.textAlign = 'center';
    mctx.fillText('DANGER', 121, 61);

    // Main Station Header Title
    mctx.fillStyle = '#ffffff';
    mctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
    mctx.textAlign = 'left';
    mctx.fillText('MHE BATTERY CHARGING STATION', 224, 63);

    // High Voltage / Hazard Warning Sub-banner
    mctx.fillStyle = '#f87171';
    mctx.font = 'bold 21px "Segoe UI", Arial, sans-serif';
    mctx.textAlign = 'center';
    mctx.fillText('HIGH VOLTAGE 480V 3-PHASE • FLAMMABLE HYDROGEN GAS AREA', 512, 112);

    // Operational Directive
    mctx.fillStyle = '#93c5fd';
    mctx.font = '600 19px "Segoe UI", Arial, sans-serif';
    mctx.fillText('AUTHORIZED PERSONNEL ONLY • EYE & ACID PPE PROTECTION REQUIRED', 512, 150);

    // Safety Mandate Bar
    mctx.fillStyle = '#fbbf24';
    mctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    mctx.fillText('NO SMOKING OR OPEN FLAMES • MAINTAIN 3-FOOT (1M) CLEARANCE AT ALL TIMES', 512, 195);

    const mainSignTex = new THREE.CanvasTexture(mainCanvas);
    const mainSign = new THREE.Mesh(
      new THREE.PlaneGeometry(5.2, 0.95),
      new THREE.MeshStandardMaterial({ map: mainSignTex, roughness: 0.35 })
    );
    mainSign.position.set(0.065, 3.65, 0);
    mainSign.rotation.y = Math.PI / 2;
    wallGroup.add(mainSign);

    // 2. Charging Bay A Placard (Standby Ready)
    const s1Canvas = document.createElement('canvas');
    s1Canvas.width = 512; s1Canvas.height = 128;
    const s1ctx = s1Canvas.getContext('2d');
    s1ctx.fillStyle = '#064e3b'; s1ctx.fillRect(0, 0, 512, 128);
    s1ctx.fillStyle = '#10b981'; s1ctx.fillRect(0, 0, 512, 16);
    s1ctx.fillStyle = '#ffffff'; s1ctx.font = 'bold 30px "Segoe UI", Arial, sans-serif'; s1ctx.textAlign = 'center';
    s1ctx.fillText('CHARGING BAY A — STANDBY', 256, 60);
    s1ctx.fillStyle = '#6ee7b7'; s1ctx.font = 'bold 19px "Segoe UI", Arial, sans-serif';
    s1ctx.fillText('STATION READY / DOCKED CONNECTOR', 256, 95);
    const s1Tex = new THREE.CanvasTexture(s1Canvas);
    const s1Sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.38),
      new THREE.MeshStandardMaterial({ map: s1Tex, roughness: 0.4 })
    );
    s1Sign.position.set(0.065, 2.75, 1.85);
    s1Sign.rotation.y = Math.PI / 2;
    wallGroup.add(s1Sign);

    // 3. Charging Bay B Placard (Active Charge / High Power)
    const s2Canvas = document.createElement('canvas');
    s2Canvas.width = 512; s2Canvas.height = 128;
    const s2ctx = s2Canvas.getContext('2d');
    s2ctx.fillStyle = '#451a03'; s2ctx.fillRect(0, 0, 512, 128);
    s2ctx.fillStyle = '#f59e0b'; s2ctx.fillRect(0, 0, 512, 16);
    s2ctx.fillStyle = '#ffffff'; s2ctx.font = 'bold 30px "Segoe UI", Arial, sans-serif'; s2ctx.textAlign = 'center';
    s2ctx.fillText('CHARGING BAY B — IN USE', 256, 60);
    s2ctx.fillStyle = '#fde68a'; s2ctx.font = 'bold 19px "Segoe UI", Arial, sans-serif';
    s2ctx.fillText('480V FAST CHARGE IN PROGRESS', 256, 95);
    const s2Tex = new THREE.CanvasTexture(s2Canvas);
    const s2Sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.38),
      new THREE.MeshStandardMaterial({ map: s2Tex, roughness: 0.4 })
    );
    s2Sign.position.set(0.065, 2.75, -1.65);
    s2Sign.rotation.y = Math.PI / 2;
    wallGroup.add(s2Sign);

    // 4. Emergency Disconnect Arrow Sign (Above Disconnect Switch)
    const emCanvas = document.createElement('canvas');
    emCanvas.width = 256; emCanvas.height = 128;
    const emctx = emCanvas.getContext('2d');
    emctx.fillStyle = '#991b1b'; emctx.fillRect(0, 0, 256, 128);
    emctx.fillStyle = '#ffffff'; emctx.font = 'bold 18px "Segoe UI", Arial, sans-serif'; emctx.textAlign = 'center';
    emctx.fillText('EMERGENCY', 128, 32);
    emctx.fillText('POWER DISCONNECT', 128, 58);
    emctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
    emctx.fillText('⬇ 480V ISOLATOR ⬇', 128, 98);
    const emTex = new THREE.CanvasTexture(emCanvas);
    const emSign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 0.38),
      new THREE.MeshStandardMaterial({ map: emTex, roughness: 0.4 })
    );
    emSign.position.set(0.065, 2.35, 0.1);
    emSign.rotation.y = Math.PI / 2;
    wallGroup.add(emSign);

    group.add(wallGroup);

    // ─── 2. Polished Concrete Floor with 2 Dedicated Stalls & Footprint Decals ─
    const stallFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(5.4, 6.9),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.25 })
    );
    stallFloor.rotation.x = -Math.PI / 2;
    stallFloor.position.set(-3.9, 0.006, -31.65);
    stallFloor.receiveShadow = true;
    group.add(stallFloor);

    // Yellow Parking Stall Guide Lines (Stall 01 & Stall 02)
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
    
    // Outer & Center Stall Lines (Z: -28.2, -31.65, -35.1)
    [-28.2, -31.65, -35.1].forEach((lz) => {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.1), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(-3.9, 0.008, lz);
      group.add(line);
    });

    // Front Stall Boundary Line
    const frontLine = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 6.9), lineMat);
    frontLine.rotation.x = -Math.PI / 2;
    frontLine.position.set(-1.3, 0.008, -31.65);
    group.add(frontLine);

    // Circular Yellow Footprint Decal on Floor (Matching Reference Photo)
    const footprintCanvas = document.createElement('canvas');
    footprintCanvas.width = 256; footprintCanvas.height = 256;
    const fctx = footprintCanvas.getContext('2d');
    fctx.fillStyle = '#facc15';
    fctx.beginPath(); fctx.arc(128, 128, 120, 0, Math.PI * 2); fctx.fill();
    fctx.fillStyle = '#0f172a';
    fctx.beginPath(); fctx.ellipse(100, 135, 20, 38, -0.1, 0, Math.PI * 2); fctx.fill();
    fctx.beginPath(); fctx.arc(100, 85, 12, 0, Math.PI * 2); fctx.fill();
    fctx.beginPath(); fctx.ellipse(156, 135, 20, 38, 0.1, 0, Math.PI * 2); fctx.fill();
    fctx.beginPath(); fctx.arc(156, 85, 12, 0, Math.PI * 2); fctx.fill();

    const footprintTex = new THREE.CanvasTexture(footprintCanvas);
    const footprintMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 0.75),
      new THREE.MeshBasicMaterial({ map: footprintTex, transparent: true })
    );
    footprintMesh.rotation.x = -Math.PI / 2;
    footprintMesh.position.set(-2.2, 0.01, -32.2);
    group.add(footprintMesh);

    // ─── 3. Yellow Wheel Stops with Black Chevrons for Both Stalls ───────────
    [-29.4, -33.8].forEach((wz) => {
      const wheelStop = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 1.2), yellowSafetyMat);
      wheelStop.position.set(-5.8, 0.09, wz);
      group.add(wheelStop);

      const chevronMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
      for (let cz = -0.4; cz <= 0.4; cz += 0.25) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.19, 0.1), chevronMat);
        stripe.position.set(-5.8, 0.09, wz + cz);
        group.add(stripe);
      }
    });

    // ─── 4. CHARGING POINT 1: Stall 01 Standby V-FORCE Charger (at z = -29.6) ─
    const charger1Group = new THREE.Group();
    charger1Group.position.set(-5.2, 0, -29.6);
    charger1Group.rotation.y = 0.3;

    const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 16), standSteelMat);
    post1.position.set(0, 1.25, 0);
    charger1Group.add(post1);

    const base1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.35), standSteelMat);
    base1.position.set(0, 0.02, 0);
    charger1Group.add(base1);

    const head1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.75, 0.48), chargerBlackMat);
    head1.position.set(0.12, 1.95, 0);
    charger1Group.add(head1);

    // Standby Screen (Normal Green Status)
    const face1Canvas = document.createElement('canvas');
    face1Canvas.width = 256; face1Canvas.height = 384;
    const f1ctx = face1Canvas.getContext('2d');
    f1ctx.fillStyle = '#18181b'; f1ctx.fillRect(0, 0, 256, 384);
    f1ctx.fillStyle = '#09090b'; f1ctx.fillRect(20, 20, 216, 120);
    f1ctx.strokeStyle = '#22c55e'; f1ctx.lineWidth = 3; f1ctx.strokeRect(20, 20, 216, 120);
    f1ctx.fillStyle = '#22c55e'; f1ctx.font = 'bold 20px sans-serif'; f1ctx.textAlign = 'center';
    f1ctx.fillText('STALL 01: READY', 128, 60);
    f1ctx.fillStyle = '#38bdf8'; f1ctx.font = 'bold 16px monospace';
    f1ctx.fillText('STANDBY / CONNECT', 128, 90);
    f1ctx.fillStyle = '#facc15'; f1ctx.font = 'bold 22px sans-serif';
    f1ctx.fillText('⚡ V-FORCE', 128, 180);
    // Keypad
    f1ctx.fillStyle = '#27272a'; f1ctx.strokeStyle = '#71717a'; f1ctx.lineWidth = 2;
    [[80, 230], [128, 230], [176, 230], [80, 280], [128, 280], [176, 280], [128, 330]].forEach(([bx, by]) => {
      f1ctx.beginPath(); f1ctx.arc(bx, by, 16, 0, Math.PI * 2); f1ctx.fill(); f1ctx.stroke();
    });
    const face1Tex = new THREE.CanvasTexture(face1Canvas);
    const face1Mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.72), new THREE.MeshBasicMaterial({ map: face1Tex }));
    face1Mesh.position.set(0.285, 1.95, 0);
    face1Mesh.rotation.y = Math.PI / 2;
    charger1Group.add(face1Mesh);

    // Docked Industrial Connector Handle (Anderson SB350 Plug) in Yellow Holster
    const holster1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.18), yellowSafetyMat);
    holster1.position.set(0.12, 1.35, 0.22);
    charger1Group.add(holster1);

    const dockedPlug = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.22, 0.12), plugMat);
    dockedPlug.position.set(0.12, 1.42, 0.22);
    charger1Group.add(dockedPlug);

    // Plug Pull Handle
    const plugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 16), standSteelMat);
    plugHandle.position.set(0.12, 1.54, 0.22);
    plugHandle.rotation.x = Math.PI / 2;
    charger1Group.add(plugHandle);

    // Natural Draped Heavy Cable (from bottom of charger down in a loop, then up to docked plug)
    const cable1Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.12, 1.58, -0.05), // Bottom of charger
      new THREE.Vector3(0.22, 0.95, -0.02), // Down along post
      new THREE.Vector3(0.28, 0.55, 0.12),  // Hanging loop near floor
      new THREE.Vector3(0.22, 0.90, 0.22),  // Up towards holster
      new THREE.Vector3(0.12, 1.30, 0.22),  // Into base of docked plug
    ]);
    const cable1Geom = new THREE.TubeGeometry(cable1Curve, 24, 0.032, 10, false);
    const cable1Mesh = new THREE.Mesh(cable1Geom, cableRubberMat);
    charger1Group.add(cable1Mesh);

    group.add(charger1Group);

    // ─── 5. CHARGING POINT 2: Stall 02 Overheating V-FORCE Charger (at z = -32.6) ──
    const charger2Group = new THREE.Group();
    charger2Group.position.set(-5.2, 0, -32.6);
    charger2Group.rotation.y = 0.35;

    const post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 16), standSteelMat);
    post2.position.set(0, 1.25, 0);
    charger2Group.add(post2);

    const base2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.35), standSteelMat);
    base2.position.set(0, 0.02, 0);
    charger2Group.add(base2);

    const head2 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.75, 0.48), chargerBlackMat);
    head2.position.set(0.12, 1.95, 0);
    charger2Group.add(head2);

    // Airflow Cooling Ventilation Louvres on charger side (where clutter blocks intake)
    const louverCanvas = document.createElement('canvas');
    louverCanvas.width = 128; louverCanvas.height = 256;
    const lctx = louverCanvas.getContext('2d');
    lctx.fillStyle = '#18181b'; lctx.fillRect(0, 0, 128, 256);
    lctx.fillStyle = '#09090b';
    for (let ly = 16; ly < 240; ly += 14) {
      lctx.fillRect(16, ly, 96, 6);
    }
    const louverTex = new THREE.CanvasTexture(louverCanvas);
    const louverMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.32, 0.62),
      new THREE.MeshStandardMaterial({ map: louverTex, roughness: 0.5 })
    );
    louverMesh.position.set(0.12, 1.95, 0.245);
    charger2Group.add(louverMesh);

    // Critical Overheat Fault Screen
    const face2Canvas = document.createElement('canvas');
    face2Canvas.width = 256; face2Canvas.height = 384;
    const f2ctx = face2Canvas.getContext('2d');
    f2ctx.fillStyle = '#18181b'; f2ctx.fillRect(0, 0, 256, 384);
    f2ctx.fillStyle = '#09090b'; f2ctx.fillRect(20, 20, 216, 120);
    f2ctx.strokeStyle = '#ef4444'; f2ctx.lineWidth = 3; f2ctx.strokeRect(20, 20, 216, 120);
    f2ctx.fillStyle = '#ef4444'; f2ctx.font = 'bold 22px sans-serif'; f2ctx.textAlign = 'center';
    f2ctx.fillText('⚠️ FAULT: OVERHEAT', 128, 60);
    f2ctx.fillStyle = '#facc15';
    f2ctx.font = 'bold 18px monospace';
    f2ctx.fillText('TEMP: 68.4°C [CRIT]', 128, 90);
    f2ctx.fillStyle = '#94a3b8';
    f2ctx.font = '14px monospace';
    f2ctx.fillText('PRESS E-STOP ISOLATE', 128, 120);
    f2ctx.fillStyle = '#facc15';
    f2ctx.font = 'bold 22px sans-serif';
    f2ctx.fillText('⚡ V-FORCE', 128, 180);
    // Keypad
    f2ctx.fillStyle = '#27272a'; f2ctx.strokeStyle = '#71717a'; f2ctx.lineWidth = 2;
    [[80, 230], [128, 230], [176, 230], [80, 280], [128, 280], [176, 280], [128, 330]].forEach(([bx, by]) => {
      f2ctx.beginPath(); f2ctx.arc(bx, by, 16, 0, Math.PI * 2); f2ctx.fill(); f2ctx.stroke();
    });
    const face2Tex = new THREE.CanvasTexture(face2Canvas);
    const face2Mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.72), new THREE.MeshBasicMaterial({ map: face2Tex }));
    face2Mesh.position.set(0.285, 1.95, 0);
    face2Mesh.rotation.y = Math.PI / 2;
    charger2Group.add(face2Mesh);
    this._stop4Charger2Screen = face2Mesh;

    // Flashing Amber Warning Strobe Beacon on Top
    const strobeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.08, 16), standSteelMat);
    strobeBase.position.set(0.12, 2.38, 0);
    charger2Group.add(strobeBase);

    const strobeDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      amberStrobeMat
    );
    strobeDome.position.set(0.12, 2.42, 0);
    charger2Group.add(strobeDome);
    this._stop4AmberStrobe = strobeDome;

    const amberLight = new THREE.PointLight(0xf59e0b, 4.5, 9);
    amberLight.position.set(-4.9, 2.5, -32.6);
    group.add(amberLight);
    this._stop4AmberLight = amberLight;

    // Yellow Cable Holster on Post
    const holster2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.18), yellowSafetyMat);
    holster2.position.set(0.12, 1.35, 0.22);
    charger2Group.add(holster2);

    // Yellow V-FORCE Floor Cable Tray Guard (Matching Photo)
    const trayGroup = new THREE.Group();
    trayGroup.position.set(0.55, 0, 0.65);

    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.6), yellowSafetyMat);
    tray.position.set(0, 0.13, 0);
    trayGroup.add(tray);

    const trayCanvas = document.createElement('canvas');
    trayCanvas.width = 256; trayCanvas.height = 128;
    const tctx = trayCanvas.getContext('2d');
    tctx.fillStyle = '#facc15'; tctx.fillRect(0, 0, 256, 128);
    tctx.fillStyle = '#0f172a'; tctx.font = 'bold 28px sans-serif'; tctx.textAlign = 'center';
    tctx.fillText('⚡ V-FORCE', 128, 70);
    const trayTex = new THREE.CanvasTexture(trayCanvas);
    const trayLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.2), new THREE.MeshBasicMaterial({ map: trayTex }));
    trayLabel.position.set(0.215, 0.13, 0);
    trayLabel.rotation.y = Math.PI / 2;
    trayGroup.add(trayLabel);

    charger2Group.add(trayGroup);

    // Heavy Black Charging Cable plugged from Charger #2 into Forklift Side Battery Port
    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-5.05, 1.62, -32.6), // Out of bottom of charger
      new THREE.Vector3(-4.65, 0.22, -33.0), // Down into yellow floor tray
      new THREE.Vector3(-4.15, 0.38, -33.3), // Across floor towards forklift side
      new THREE.Vector3(-3.7, 0.95, -33.4),  // Plugged into Forklift battery port
    ]);
    const cableGeom = new THREE.TubeGeometry(cableCurve, 24, 0.038, 10, false);
    const chargingCable = new THREE.Mesh(cableGeom, cableRubberMat);
    group.add(chargingCable);

    // Matching Grey Anderson Connector Plug plugged into Forklift Battery Port
    const activePlug = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.24), plugMat);
    activePlug.position.set(-3.7, 0.95, -33.4);
    activePlug.rotation.y = Math.PI / 2;
    group.add(activePlug);

    group.add(charger2Group);

    // ─── 6. DOCKED GLTF FORKLIFT (Straight in Stall 02, Pointing Towards Aisle) ─
    const forkliftGroup = new THREE.Group();
    // Backed cleanly into Stall 02 against the wheel stop, perfectly straight
    // with mast and forks pointing straight along +X into the aisle!
    forkliftGroup.position.set(-3.6, 0, -33.6);
    forkliftGroup.rotation.y = Math.PI / 2; // Perfectly straight in stall parallel to yellow boundary lines!

    try {
      let forklift;
      if (this._forkliftModel) {
        forklift = this._forkliftModel.clone(true);
      } else {
        const forkliftGltf = await this._loadGLTF(FORKLIFT_MODEL);
        forklift = forkliftGltf.scene.clone();
        this._normalizeProp(forklift, 2.35);
      }
      forklift.position.set(0, 0, 0);

      // Preserve native photorealistic PBR texture maps & materials from the glTF asset
      forklift.traverse((n) => {
        if (n.isMesh && n.material) {
          n.castShadow = true;
          n.receiveShadow = true;
          if (n.material.map) {
            n.material.map.colorSpace = THREE.SRGBColorSpace;
            n.material.needsUpdate = true;
          }
        }
      });

      forkliftGroup.add(forklift);
    } catch (e) {
      console.warn('Failed to load glTF forklift for Stop 4, fallback to geometry:', e);
      const fallbackBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 2.4), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
      fallbackBody.position.set(0, 0.7, 0);
      forkliftGroup.add(fallbackBody);
    }
    group.add(forkliftGroup);

    // ─── 7. Wall-Mounted Grey Disconnect Switch Box between Stalls ───────────
    const disconnectGroup = new THREE.Group();
    disconnectGroup.position.set(-5.8, 1.65, -30.4); // Wall-mounted between Stall 1 & 2
    disconnectGroup.name = 'EStopConsole';

    const discBox = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.32), disconnectGreyMat);
    disconnectGroup.add(discBox);

    const discConduit = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 4.0, 8), conduitMat);
    discConduit.position.set(0, 2.0, 0);
    disconnectGroup.add(discConduit);

    const discBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 16), eStopRedMat);
    discBtn.position.set(0.1, -0.05, 0);
    discBtn.rotation.z = Math.PI / 2;
    disconnectGroup.add(discBtn);
    this._stop4EStopBtn = discBtn;

    const discCanvas = document.createElement('canvas');
    discCanvas.width = 128; discCanvas.height = 64;
    const dctx = discCanvas.getContext('2d');
    dctx.fillStyle = '#e2e8f0'; dctx.fillRect(0, 0, 128, 64);
    dctx.fillStyle = '#dc2626'; dctx.font = 'bold 16px sans-serif'; dctx.textAlign = 'center';
    dctx.fillText('DISCONNECT', 64, 28);
    dctx.fillStyle = '#0f172a'; dctx.font = 'bold 12px sans-serif';
    dctx.fillText('480V 3-PHASE', 64, 48);
    const discTex = new THREE.CanvasTexture(discCanvas);
    const discPlacard = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.07), new THREE.MeshBasicMaterial({ map: discTex }));
    discPlacard.position.set(0.092, 0.12, 0);
    discPlacard.rotation.y = Math.PI / 2;
    disconnectGroup.add(discPlacard);

    // Heavy-duty rotary throw disconnect switch lever handle (ON = upright, OFF = down)
    const leverPivot = new THREE.Group();
    leverPivot.name = 'DisconnectLeverPivot';
    leverPivot.position.set(0.10, -0.05, 0); // At switch point on side
    const leverRod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.20, 12), conduitMat);
    leverRod.position.set(0, 0.09, 0);
    leverPivot.add(leverRod);
    const leverGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.08, 16), eStopRedMat);
    leverGrip.position.set(0, 0.17, 0);
    leverPivot.add(leverGrip);
    disconnectGroup.add(leverPivot);
    this._stop4DisconnectLever = leverPivot;

    group.add(disconnectGroup);
    this._stop4EStop = disconnectGroup;

    // ─── 8. THE HAZARD: Misplaced Boxes Encroaching Stall 2 Charger & Cable ───
    const boxGroup = new THREE.Group();
    boxGroup.position.set(-4.8, 0, -32.0); // Tucked next to Charger 2 post and tray, clean clearance for Alex!

    // Wooden shipping skid pallet underneath combustible clutter
    const clutterPallet = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.08, 0.95),
      new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.85 })
    );
    clutterPallet.position.set(0, 0.04, 0);
    boxGroup.add(clutterPallet);

    const box1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.65, 0.72),
      new THREE.MeshStandardMaterial({ map: boxTex1, roughness: 0.7 })
    );
    box1.position.set(0, 0.40, 0);
    box1.rotation.y = 0.14;
    boxGroup.add(box1);

    const box2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.48, 0.62),
      new THREE.MeshStandardMaterial({ map: boxTex2, roughness: 0.7 })
    );
    box2.position.set(0.04, 0.965, 0.02);
    box2.rotation.y = -0.1;
    boxGroup.add(box2);

    // 3rd leaning box pressed against charger intake
    const box3 = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.38, 0.45),
      new THREE.MeshStandardMaterial({ map: boxTex1, roughness: 0.7 })
    );
    box3.position.set(-0.25, 0.27, -0.32);
    box3.rotation.y = 0.32;
    box3.rotation.z = -0.08;
    boxGroup.add(box3);

    // Yellow Floor Warning Stencil violated by the clutter
    const stencilCanvas = document.createElement('canvas');
    stencilCanvas.width = 512; stencilCanvas.height = 128;
    const sctx = stencilCanvas.getContext('2d');
    sctx.fillStyle = '#facc15'; sctx.fillRect(0, 0, 512, 128);
    sctx.fillStyle = '#0f172a';
    sctx.fillRect(8, 8, 496, 112);
    sctx.fillStyle = '#facc15';
    sctx.font = 'bold 22px sans-serif';
    sctx.textAlign = 'center';
    sctx.fillText('DO NOT BLOCK CHARGER AIRFLOW', 256, 50);
    sctx.font = 'bold 18px monospace';
    sctx.fillText('3-FOOT CLEARANCE REQUIRED', 256, 85);
    const stencilTex = new THREE.CanvasTexture(stencilCanvas);
    const stencilMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.42),
      new THREE.MeshBasicMaterial({ map: stencilTex, transparent: true })
    );
    stencilMesh.rotation.x = -Math.PI / 2;
    stencilMesh.position.set(0, 0.012, 0.65);
    boxGroup.add(stencilMesh);

    group.add(boxGroup);


    // ─── 10. Overhead Facility Placard for Battery Bay ─────────────────────────
    this._addRoomPlacard(group, 0, 5.8, -29.0, 'FACILITY 04 | V-FORCE FORKLIFT CHARGING & POWER ISOLATION');

    this._stopGroups.set('stop_04', group);
    this.scene.add(group);
  }

  /**
   * Stop 5: Finished Goods Clear Aisle & Loading Dock Dispatch Bay.
   * Photorealistic, OSHA/ANSI compliant industrial environment:
   *  - Two Industrial Roll-Up Loading Dock Doors with steel tracks, torsion spring shaft, dock leveler pit plates, and articulated dock lamps.
   *  - Pristine High-Bay Storage Racking with wire mesh decking, yellow column boots, rack capacity placards, and shrink-wrapped finished goods.
   *  - Emergency Response Hub: Wall-mounted Eye Wash station, OSHA Fire Extinguisher Cabinet, 30-Gal Spill Kit Drum, and Convex Mirror.
   *  - Green pedestrian safety walkway with white border lines, yellow dock boundary hatching, and emergency egress stencils.
   *  - Overhead Facility & Compliance Signboard: ZONE 05 | FINISHED GOODS & OUTBOUND DISPATCH.
   */
  async _loadStop5Props() {
    const group = new THREE.Group();
    group.name = 'Stop5_FinishedGoodsZone';

    // Materials
    const yellowSafetyMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
    const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.75 });
    const silverSteelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.85 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15, metalness: 0.95 });
    const galvanizedMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.3, metalness: 0.8 });
    const shutterDoorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.6 });
    const rubberBumperMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    const oshaRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
    const oshaGreenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.35 });
    const rackOrangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4, metalness: 0.3 });
    const rackBlueMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4, metalness: 0.3 });
    const woodPalletMat = new THREE.MeshStandardMaterial({ color: 0xb4814d, roughness: 0.85 });
    const spillKitYellowMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.4 });
    const diamondPlateMat = new THREE.MeshStandardMaterial({
      map: this._createDiamondPlateTexture(),
      roughness: 0.35,
      metalness: 0.8,
    });

    const palletTex1 = this._createFinishedGoodsPalletTexture('GLOBAL_LOGISTICS');
    const palletTex2 = this._createFinishedGoodsPalletTexture('PRECISION_PARTS');
    const wrapFilmMat1 = new THREE.MeshStandardMaterial({ map: palletTex1, roughness: 0.3, metalness: 0.15 });
    const wrapFilmMat2 = new THREE.MeshStandardMaterial({ map: palletTex2, roughness: 0.3, metalness: 0.15 });

    // ─── 1. Modern Exterior Covered Loading Dock Pavilion (Matching Photo 2 Reference) ───
    const dockWallGroup = new THREE.Group();
    dockWallGroup.position.set(-6.8, 0, -42.0);

    const corrugateTex = this._createCorrugatedWallTexture();
    const corrugateMat = new THREE.MeshStandardMaterial({ map: corrugateTex, roughness: 0.45, metalness: 0.35 });
    const trailerFloorTex = this._createTrailerWoodFloorTexture();
    const trailerWallTex = this._createTrailerWallTexture();
    const trailerFloorMat = new THREE.MeshStandardMaterial({ map: trailerFloorTex, roughness: 0.6, metalness: 0.1 });
    const trailerWallMat = new THREE.MeshStandardMaterial({ map: trailerWallTex, roughness: 0.4, metalness: 0.2 });
    const dockSealMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 });
    const concreteRampMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });

    // A. South Facade Corrugated Metal Wall Panel (z = -45.8)
    const sidePanelSouth = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5.8), corrugateMat);
    sidePanelSouth.position.set(0.04, 2.9, -3.8);
    sidePanelSouth.rotation.y = Math.PI / 2;
    dockWallGroup.add(sidePanelSouth);

    // ─── B. Loading Dock 02: Closed Roll-Up Sectional Industrial Door (at fsideZ = 3.8, z = -38.2) ───
    const dock2Group = new THREE.Group();
    dock2Group.position.set(0, 0, 3.8);

    // Corrugated backing panel surrounding the door frame
    const dock2BackWall = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5.8), corrugateMat);
    dock2BackWall.position.set(0.02, 2.9, 0);
    dock2BackWall.rotation.y = Math.PI / 2;
    dock2Group.add(dock2BackWall);

    // Dock Door Frame & Vertical Tracks (Heavy Galvanized Steel Channels)
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.35, metalness: 0.8 });
    [-1.45, 1.45].forEach((tz) => {
      const track = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.4, 0.08), trackMat);
      track.position.set(0.06, 2.2, tz);
      dock2Group.add(track);
    });

    // Overhead Torsion Spring Shaft and Cable Drums
    const torsionShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 3.1, 16), darkSteelMat);
    torsionShaft.position.set(0.09, 4.45, 0);
    torsionShaft.rotation.x = Math.PI / 2;
    dock2Group.add(torsionShaft);

    [-1.45, 1.45].forEach((dz) => {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 16), silverSteelMat);
      drum.position.set(0.09, 4.45, dz);
      drum.rotation.x = Math.PI / 2;
      dock2Group.add(drum);
    });

    // Sectional Overhead Roll-Up Door Leaf (Ribbed Steel Panels with Chevron Warning Base)
    const dock2DoorLeaf = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 4.2),
      new THREE.MeshStandardMaterial({
        map: this._createSectionalDoorTexture(),
        roughness: 0.45,
        metalness: 0.35,
      })
    );
    dock2DoorLeaf.position.set(0.05, 2.1, 0);
    dock2DoorLeaf.rotation.y = Math.PI / 2;
    dock2Group.add(dock2DoorLeaf);

    // Heavy Rubber Bottom Astragal Weatherseal
    const bottomSeal = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.08, 2.85),
      rubberBumperMat
    );
    bottomSeal.position.set(0.05, 0.04, 0);
    dock2Group.add(bottomSeal);

    // Wall-Mounted Push-Button Operator Station & Keylock (Beside Track)
    const opBox = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.42, 0.22), silverSteelMat);
    opBox.position.set(0.12, 1.45, 1.8);
    dock2Group.add(opBox);

    // Amber Status Beacon ("STANDBY / DOOR LOCKED")
    const beaconAmber = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.07, 12),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 2.8 })
    );
    beaconAmber.position.set(0.14, 1.78, 1.8);
    dock2Group.add(beaconAmber);

    // Overhead Placard: LOADING DOCK 02 • STANDBY / SECURED
    const d2Canvas = document.createElement('canvas');
    d2Canvas.width = 512; d2Canvas.height = 128;
    const d2ctx = d2Canvas.getContext('2d');
    d2ctx.fillStyle = '#0f172a'; d2ctx.fillRect(0, 0, 512, 128);
    d2ctx.fillStyle = '#f59e0b'; d2ctx.fillRect(0, 0, 512, 16);
    d2ctx.fillStyle = '#ffffff'; d2ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif'; d2ctx.textAlign = 'center';
    d2ctx.fillText('LOADING DOCK 02', 256, 62);
    d2ctx.fillStyle = '#fde68a'; d2ctx.font = 'bold 19px "Segoe UI", Arial, sans-serif';
    d2ctx.fillText('STANDBY FREIGHT BAY • DOOR SECURED & LOCKED', 256, 98);

    const d2Tex = new THREE.CanvasTexture(d2Canvas);
    const d2Sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 0.7),
      new THREE.MeshStandardMaterial({ map: d2Tex, roughness: 0.35 })
    );
    d2Sign.position.set(0.16, 5.0, 0);
    d2Sign.rotation.y = Math.PI / 2;
    dock2Group.add(d2Sign);

    // Dual Heavy Yellow Crash Bollards flanking Dock 02 Frame
    [-1.75, 1.75].forEach((bz) => {
      const bPost = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 16), yellowSafetyMat);
      bPost.position.set(0.35, 0.55, bz);
      bPost.castShadow = true;
      dock2Group.add(bPost);

      const bBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 16), darkSteelMat);
      bBase.position.set(0.35, 0.025, bz);
      dock2Group.add(bBase);
    });

    dockWallGroup.add(dock2Group);

    // Industrial Overhead Canopy Header Beam (Dark Slate Grey)
    const canopyBeam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 11.2), darkSteelMat);
    canopyBeam.position.set(0.2, 5.2, 0);
    dockWallGroup.add(canopyBeam);

    // Overhead Industrial LED Floodlight Bars
    [-3.8, 0, 3.8].forEach((fz) => {
      const floodFixture = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.8), darkSteelMat);
      floodFixture.position.set(0.4, 5.0, fz);
      dockWallGroup.add(floodFixture);

      const floodLens = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.18),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0xf8fafc, emissiveIntensity: 2.5 })
      );
      floodLens.position.set(0.53, 4.95, fz);
      floodLens.rotation.y = Math.PI / 2;
      floodFixture.add(floodLens);

      const floodLight = new THREE.PointLight(0xf8fafc, 2.8, 12);
      floodLight.position.set(0.8, 4.8, fz);
      dockWallGroup.add(floodLight);
    });

    // ─── B. Central Active Truck Docking Bay (z = 0 relative to dockWallGroup, i.e. z = -42.0) ───
    const dockBayGroup = new THREE.Group();
    dockBayGroup.position.set(0, 0, 0);

    // Heavy Black Pleated Compression Dock Shelter / Seal Perimeter (Photo 2)
    const shelterL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.4, 0.38), dockSealMat);
    shelterL.position.set(-0.05, 2.2, -1.8);
    dockBayGroup.add(shelterL);

    const shelterR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.4, 0.38), dockSealMat);
    shelterR.position.set(-0.05, 2.2, 1.8);
    dockBayGroup.add(shelterR);

    const shelterTop = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 3.98), dockSealMat);
    shelterTop.position.set(-0.05, 4.4, 0);
    dockBayGroup.add(shelterTop);

    // ─── Open Outdoor Logistics Yard & Sunlit Horizon (View Outside) ───
    const outdoorVistaTex = this._createOutdoorSkyYardTexture();
    const outdoorVista = new THREE.Mesh(
      new THREE.PlaneGeometry(10.0, 6.5),
      new THREE.MeshBasicMaterial({ map: outdoorVistaTex, side: THREE.DoubleSide })
    );
    outdoorVista.position.set(-4.8, 3.2, 0);
    outdoorVista.rotation.y = Math.PI / 2;
    dockBayGroup.add(outdoorVista);

    // Outdoor Daylight streaming in through the open loading dock portal
    const outdoorSunlight = new THREE.DirectionalLight(0xffedd5, 2.5);
    outdoorSunlight.position.set(-4.5, 5.5, 1.0);
    outdoorSunlight.target.position.set(0, 0, 0);
    dockBayGroup.add(outdoorSunlight);
    dockBayGroup.add(outdoorSunlight.target);

    // Outdoor Asphalt Yard Apron Ground Extension (Outside building)
    const outdoorGround = new THREE.Mesh(
      new THREE.PlaneGeometry(5.0, 7.5),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 })
    );
    outdoorGround.rotation.x = -Math.PI / 2;
    outdoorGround.rotation.z = Math.PI / 2;
    outdoorGround.position.set(-2.5, 0.002, 0);
    outdoorGround.receiveShadow = true;
    dockBayGroup.add(outdoorGround);

    // ─── Freshly Loaded Freight Pallet & Industrial Manual Pallet Jack ───
    const recentFreightGroup = new THREE.Group();
    recentFreightGroup.position.set(-1.4, 0, 0.2);

    // Wood Pallet Base
    const freshWoodPallet = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 1.1), woodPalletMat);
    freshWoodPallet.position.set(0, 0.06, 0);
    freshWoodPallet.castShadow = true;
    recentFreightGroup.add(freshWoodPallet);

    // Recently Loaded Cardboard Cartons with Fresh Labels & Shrinkwrap
    const freshGoods = new THREE.Mesh(
      new THREE.BoxGeometry(1.02, 1.08, 1.02),
      wrapFilmMat1
    );
    freshGoods.position.set(0, 0.66, 0);
    freshGoods.castShadow = true;
    recentFreightGroup.add(freshGoods);

    // Heavy Industrial Pallet Jack (Safety Orange)
    const palletJack = new THREE.Group();
    palletJack.position.set(1.05, 0, 0);

    const jackOrangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.35, metalness: 0.4 });

    // Dual Lifting Forks
    [-0.18, 0.18].forEach((fz) => {
      const fork = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 0.14), jackOrangeMat);
      fork.position.set(-0.55, 0.04, fz);
      fork.castShadow = true;
      palletJack.add(fork);

      // Front Load Rollers
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 12), darkSteelMat);
      roller.position.set(-1.05, 0.035, fz);
      roller.rotation.x = Math.PI / 2;
      palletJack.add(roller);
    });

    // Hydraulic Pump Body & Chassis Base
    const jackChassis = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.52), jackOrangeMat);
    jackChassis.position.set(0.08, 0.14, 0);
    jackChassis.castShadow = true;
    palletJack.add(jackChassis);

    // Steer Wheels
    [-0.15, 0.15].forEach((wz) => {
      const steerWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16), darkSteelMat);
      steerWheel.position.set(0.08, 0.09, wz);
      steerWheel.rotation.x = Math.PI / 2;
      palletJack.add(steerWheel);
    });

    // T-Bar Steering & Pump Handle (Tilted up)
    const handleStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.95, 12), darkSteelMat);
    handleStem.position.set(0.22, 0.55, 0);
    handleStem.rotation.z = -0.35;
    palletJack.add(handleStem);

    const handleGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 12), darkSteelMat);
    handleGrip.position.set(0.38, 0.98, 0);
    handleGrip.rotation.x = Math.PI / 2;
    palletJack.add(handleGrip);

    recentFreightGroup.add(palletJack);
    dockBayGroup.add(recentFreightGroup);

    // Extended Hydraulic Dock Leveler Plate Lip
    const levelerLip = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.2), diamondPlateMat);
    levelerLip.rotation.x = -Math.PI / 2;
    levelerLip.rotation.z = Math.PI / 2;
    levelerLip.position.set(-0.35, 0.015, 0);
    levelerLip.receiveShadow = true;
    dockBayGroup.add(levelerLip);

    // Dock Leveler Pit Plate (Interior)
    const levelerPlate = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.2), diamondPlateMat);
    levelerPlate.rotation.x = -Math.PI / 2;
    levelerPlate.rotation.z = Math.PI / 2;
    levelerPlate.position.set(1.15, 0.007, 0);
    levelerPlate.receiveShadow = true;
    dockBayGroup.add(levelerPlate);

    // Yellow Toe-Guard Curbs
    [-1.12, 1.12].forEach((cz) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.05, 0.08), yellowSafetyMat);
      curb.position.set(1.15, 0.025, cz);
      dockBayGroup.add(curb);
    });

    // Dock Master Status Control Box with Green Restraint Light
    const ctrlBox = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.32), silverSteelMat);
    ctrlBox.position.set(0.12, 1.5, 2.15);
    dockBayGroup.add(ctrlBox);

    const beaconGreen = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.08, 12),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 3.8 })
    );
    beaconGreen.position.set(0.14, 1.88, 2.15);
    dockBayGroup.add(beaconGreen);

    // Articulated Dock Spotlight shining into trailer hold
    const dockLamp = new THREE.PointLight(0xfef08a, 4.5, 16);
    dockLamp.position.set(-0.5, 3.5, 1.5);
    dockBayGroup.add(dockLamp);

    // Overhead Placard: LOADING DOCK 01 • ACTIVE LOGISTICS FREIGHT PORTAL
    const docCanvas = document.createElement('canvas');
    docCanvas.width = 512; docCanvas.height = 128;
    const dctx = docCanvas.getContext('2d');
    dctx.fillStyle = '#0f172a'; dctx.fillRect(0, 0, 512, 128);
    dctx.fillStyle = '#22c55e'; dctx.fillRect(0, 0, 512, 16);
    dctx.fillStyle = '#ffffff'; dctx.font = 'bold 36px "Segoe UI", Arial, sans-serif'; dctx.textAlign = 'center';
    dctx.fillText('LOADING DOCK 01', 256, 62);
    dctx.fillStyle = '#86efac'; dctx.font = 'bold 19px "Segoe UI", Arial, sans-serif';
    dctx.fillText('ACTIVE LOGISTICS FREIGHT BAY • TRUCK RESTRAINED', 256, 98);

    const docTex = new THREE.CanvasTexture(docCanvas);
    const docSign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 0.7),
      new THREE.MeshStandardMaterial({ map: docTex, roughness: 0.35 })
    );
    docSign.position.set(0.16, 5.0, 0);
    docSign.rotation.y = Math.PI / 2;
    dockBayGroup.add(docSign);

    dockWallGroup.add(dockBayGroup);

    // ─── C. Flanking Concrete Access Ramps with Continuous Yellow Pipe Handrails (Photo 2) ───
    [-3.8, 3.8].forEach((rampCenterZ, rIdx) => {
      const rampGroup = new THREE.Group();
      rampGroup.position.set(0, 0, rampCenterZ);

      // Sloped Concrete Side Curb Wall (0.6m high, 3.0m long)
      const rampWall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.16), concreteRampMat);
      rampWall.position.set(1.1, 0.25, rIdx === 0 ? 1.4 : -1.4);
      rampGroup.add(rampWall);

      // Continuous Safety Yellow Pipe Handrail / Guardrails (Photo 2)
      const railZ = (rIdx === 0 ? 1.4 : -1.4);

      // Top Safety Rail (1.05m high)
      const topRail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.024, 2.2, 12),
        yellowSafetyMat
      );
      topRail.position.set(1.1, 1.05, railZ);
      topRail.rotation.z = Math.PI / 2;
      rampGroup.add(topRail);

      // Mid Safety Rail (0.58m high)
      const midRail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 2.2, 12),
        yellowSafetyMat
      );
      midRail.position.set(1.1, 0.58, railZ);
      midRail.rotation.z = Math.PI / 2;
      rampGroup.add(midRail);

      // Vertical Upright Pipe Stanchions every 0.7m
      [0.05, 0.75, 1.45, 2.15].forEach((vx) => {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 1.05, 12),
          yellowSafetyMat
        );
        post.position.set(vx, 0.525, railZ);
        post.castShadow = true;
        rampGroup.add(post);

        // Heavy Base Flange Ring
        const bRing = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 12), darkSteelMat);
        bRing.position.set(vx, 0.015, railZ);
        rampGroup.add(bRing);
      });

      // Yellow Crash Safety Bollard at Corner of Ramp Entry (Photo 2)
      const bollard = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.095, 1.15, 16),
        yellowSafetyMat
      );
      bollard.position.set(2.25, 0.575, railZ);
      bollard.castShadow = true;
      rampGroup.add(bollard);

      const bollardBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 16), darkSteelMat);
      bollardBase.position.set(2.25, 0.03, railZ);
      rampGroup.add(bollardBase);

      dockWallGroup.add(rampGroup);
    });

    group.add(dockWallGroup);

    // ─── 2. Pristine Compliant Pallet Racking (Right Side x = 3.8, z: -37 to -46) ─
    const rackGroup = new THREE.Group();
    rackGroup.position.set(3.8, 0, -41.5);

    // 4 Upright Frames (Safety Blue) + Column Protectors (Safety Yellow)
    [-4.2, -1.4, 1.4, 4.2].forEach((rz) => {
      // Upright Frame
      const postF = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.8, 0.12), rackBlueMat);
      postF.position.set(-0.6, 2.9, rz);
      postF.castShadow = true;
      rackGroup.add(postF);

      const postB = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.8, 0.12), rackBlueMat);
      postB.position.set(0.6, 2.9, rz);
      postB.castShadow = true;
      rackGroup.add(postB);

      // Diagonal Cross Bracing
      for (let by = 0.6; by <= 5.2; by += 1.1) {
        const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.25, 8), silverSteelMat);
        brace.position.set(0, by, rz);
        brace.rotation.z = Math.PI / 2;
        rackGroup.add(brace);
      }

      // Heavy Yellow Steel Wrap-Around Column Protector Boot at Floor Base
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.52, 0.26), yellowSafetyMat);
      boot.position.set(-0.6, 0.26, rz);
      rackGroup.add(boot);
    });

    // Horizontal Orange Load Beams across 3 Bays & 3 Shelf Tiers
    [1.4, 2.8, 4.2].forEach((beamY, tierIdx) => {
      [-2.8, 0.0, 2.8].forEach((bayZ, bayIdx) => {
        const beamFront = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 2.68), rackOrangeMat);
        beamFront.position.set(-0.6, beamY, bayZ);
        rackGroup.add(beamFront);

        const beamBack = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 2.68), rackOrangeMat);
        beamBack.position.set(0.6, beamY, bayZ);
        rackGroup.add(beamBack);

        // Rack Capacity Limit Placard on Front Beam
        const capCanvas = document.createElement('canvas');
        capCanvas.width = 256; capCanvas.height = 64;
        const cpctx = capCanvas.getContext('2d');
        cpctx.fillStyle = '#facc15'; cpctx.fillRect(0, 0, 256, 64);
        cpctx.fillStyle = '#0f172a'; cpctx.fillRect(4, 4, 248, 56);
        cpctx.fillStyle = '#facc15'; cpctx.font = 'bold 16px "Segoe UI", Arial, sans-serif'; cpctx.textAlign = 'center';
        cpctx.fillText(`BAY ${bayIdx + 1} • TIER ${tierIdx + 1}`, 128, 25);
        cpctx.fillStyle = '#ffffff'; cpctx.font = 'bold 18px monospace';
        cpctx.fillText('MAX LOAD: 2500 KG', 128, 48);
        const capTex = new THREE.CanvasTexture(capCanvas);
        const capMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(0.5, 0.12),
          new THREE.MeshBasicMaterial({ map: capTex })
        );
        capMesh.position.set(-0.645, beamY, bayZ);
        capMesh.rotation.y = -Math.PI / 2;
        rackGroup.add(capMesh);

        // Wire Mesh Waterfall Decking Panel across beams
        const wireDeck = new THREE.Mesh(
          new THREE.PlaneGeometry(1.2, 2.65),
          new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.85, wireframe: true })
        );
        wireDeck.rotation.x = -Math.PI / 2;
        wireDeck.position.set(0, beamY + 0.01, bayZ);
        rackGroup.add(wireDeck);

        // Pristine Wooden Pallets loaded with uniform Finished Goods Cartons
        [-0.65, 0.65].forEach((pxOffset, pIdx) => {
          const palletGroup = new THREE.Group();
          palletGroup.position.set(0, beamY + 0.08, bayZ + pxOffset);

          const woodPallet = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 1.0), woodPalletMat);
          woodPallet.position.set(0, 0.06, 0);
          woodPallet.castShadow = true;
          palletGroup.add(woodPallet);

          const goodsMat = (tierIdx + bayIdx + pIdx) % 2 === 0 ? wrapFilmMat1 : wrapFilmMat2;
          const goodsMesh = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.95, 0.92), goodsMat);
          goodsMesh.position.set(0, 0.6, 0);
          goodsMesh.castShadow = true;
          palletGroup.add(goodsMesh);

          rackGroup.add(palletGroup);
        });
      });
    });

    group.add(rackGroup);

    // ─── 3. Distributed Industrial Safety Equipment (Mounted on Solid South Back Wall z = -47.65) ───
    //
    // A. Wall-Mounted AED Station (South Wall: x = -1.2, z = -47.65)
    //    Matches user reference photo: Light grey/white steel cabinet, black recessed pull handle,
    //    smoked window with AED and Red Heart + White Lightning Bolt logo, side decal, and 3D 2-sided projecting overhead arrow sign.
    const aedGroup = new THREE.Group();
    aedGroup.position.set(-1.2, 1.55, -47.65);

    // High-Contrast Dark Mounting Plate on Wall
    // ─── A. AED Station (South Wall: x = -1.2, z = -47.65) ───
    const aedBackPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.86, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
    );
    aedBackPlate.position.set(0, 0, 0.015);
    aedGroup.add(aedBackPlate);

    // Powder-Coated White Steel AED Cabinet with Red Perimeter Trim
    const cabinetMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.1 });
    const aedBox = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.24), cabinetMat);
    aedBox.position.set(0, 0, 0.12);
    aedBox.castShadow = true;
    aedGroup.add(aedBox);

    // Red Front Door Frame
    const redTrimMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
    const aedDoorOuter = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.64, 0.02), redTrimMat);
    aedDoorOuter.position.set(0, 0, 0.235);
    aedGroup.add(aedDoorOuter);

    // 3D AED Unit Inside Cabinet (High-Visibility Yellow & Red)
    const aedUnitMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.35 }); // Safety yellow
    const aedUnit = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.36, 0.12), aedUnitMat);
    aedUnit.position.set(0, -0.02, 0.12);
    aedGroup.add(aedUnit);

    const aedUnitFace = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.02), redTrimMat);
    aedUnitFace.position.set(0, -0.02, 0.185);
    aedGroup.add(aedUnitFace);

    // Flashing Green Status LED on AED Unit
    const aedLed = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 2.5 })
    );
    aedLed.position.set(0.09, 0.06, 0.20);
    aedGroup.add(aedLed);

    // Clear Transparent Glass Viewing Window with AED Heart Emblem
    const winCanvas = document.createElement('canvas');
    winCanvas.width = 512; winCanvas.height = 640;
    const wctx = winCanvas.getContext('2d');
    wctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    wctx.fillRect(0, 0, 512, 640);
    wctx.strokeStyle = '#ffffff';
    wctx.lineWidth = 16;
    wctx.strokeRect(12, 12, 488, 616);
    wctx.fillStyle = '#ffffff';
    wctx.font = '900 72px "Segoe UI", Arial, sans-serif';
    wctx.textAlign = 'center';
    wctx.fillText('AED', 256, 120);
    this._drawAEDHeartLogo(wctx, 256, 320, 240, '#dc2626', '#ffffff');

    const winTex = new THREE.CanvasTexture(winCanvas);
    const aedGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.52),
      new THREE.MeshStandardMaterial({
        map: winTex,
        roughness: 0.1,
        metalness: 0.6,
        transparent: true,
        opacity: 0.85,
      })
    );
    aedGlass.position.set(0, 0, 0.248);
    aedGroup.add(aedGlass);

    // Chrome Latch Handle
    const aedHandle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.04), chromeMat);
    aedHandle.position.set(-0.22, 0, 0.245);
    aedGroup.add(aedHandle);

    // Green Tamper-Evident Inspection Seal across Latch
    const sealCanvas = document.createElement('canvas');
    sealCanvas.width = 128; sealCanvas.height = 64;
    const sctx = sealCanvas.getContext('2d');
    sctx.fillStyle = '#16a34a'; sctx.fillRect(0, 0, 128, 64);
    sctx.strokeStyle = '#ffffff'; sctx.lineWidth = 4; sctx.strokeRect(4, 4, 120, 56);
    sctx.fillStyle = '#ffffff'; sctx.font = 'bold 16px sans-serif'; sctx.textAlign = 'center';
    sctx.fillText('INSPECTED', 64, 28);
    sctx.font = 'bold 13px monospace';
    sctx.fillText('SEAL #4092', 64, 48);
    const sealTex = new THREE.CanvasTexture(sealCanvas);
    const aedSeal = new THREE.Mesh(
      new THREE.PlaneGeometry(0.07, 0.035),
      new THREE.MeshBasicMaterial({ map: sealTex })
    );
    aedSeal.position.set(-0.23, 0, 0.268);
    aedGroup.add(aedSeal);

    // Single Clean Flat Overhead Sign (1:1 Ratio, Razor Sharp)
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 2048; signCanvas.height = 2048;
    const sgctx = signCanvas.getContext('2d');
    sgctx.imageSmoothingEnabled = true;
    sgctx.imageSmoothingQuality = 'high';

    // White backing with thick red border
    sgctx.fillStyle = '#ffffff';
    sgctx.fillRect(0, 0, 2048, 2048);
    sgctx.strokeStyle = '#dc2626';
    sgctx.lineWidth = 36;
    sgctx.strokeRect(18, 18, 2012, 2012);

    // Top Red Header Banner
    sgctx.fillStyle = '#dc2626';
    sgctx.fillRect(36, 36, 1976, 360);

    sgctx.fillStyle = '#ffffff';
    sgctx.font = '900 180px "Segoe UI", Arial, sans-serif';
    sgctx.textAlign = 'center';
    sgctx.fillText('EMERGENCY', 1024, 280);

    // Main AED Text
    sgctx.fillStyle = '#0f172a';
    sgctx.font = '900 340px "Segoe UI", Arial, sans-serif';
    sgctx.fillText('AED', 1024, 760);

    sgctx.font = '900 88px "Segoe UI", Arial, sans-serif';
    sgctx.fillStyle = '#dc2626';
    sgctx.fillText('DEFIBRILLATOR', 1024, 900);

    // High-Resolution Heart Logo with Lightning Bolt
    this._drawAEDHeartLogo(sgctx, 1024, 1300, 640, '#dc2626', '#ffffff');

    // Downward Red Arrow
    sgctx.fillStyle = '#dc2626';
    sgctx.beginPath();
    sgctx.moveTo(760, 1680); sgctx.lineTo(1288, 1680); sgctx.lineTo(1288, 1780);
    sgctx.lineTo(1460, 1780); sgctx.lineTo(1024, 1960); sgctx.lineTo(588, 1780);
    sgctx.lineTo(760, 1780); sgctx.closePath(); sgctx.fill();

    const topSignTex = new THREE.CanvasTexture(signCanvas);
    topSignTex.minFilter = THREE.LinearFilter;
    topSignTex.magFilter = THREE.LinearFilter;
    topSignTex.generateMipmaps = false;

    const aedSignFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.80, 0.80, 0.02),
      darkSteelMat
    );
    aedSignFrame.position.set(0, 0.80, 0.02);
    aedGroup.add(aedSignFrame);

    const aedSign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.76, 0.76),
      new THREE.MeshStandardMaterial({ map: topSignTex, roughness: 0.2 })
    );
    aedSign.position.set(0, 0.80, 0.035);
    aedGroup.add(aedSign);

    group.add(aedGroup);

    // ─── B. Emergency Decontamination Room & Eyewash Station (Mounted on Solid South Back Wall z = -47.65) ───

    // 1. Emergency Body Wash & Safety Shower Decontamination Room Door (South Wall: x = -5.4, z = -47.65)
    const doorGroup = new THREE.Group();
    doorGroup.position.set(-5.4, 0, -47.65);

    // Heavy Industrial Steel Door Frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.7 });
    const dFrameL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.45, 0.12), frameMat);
    dFrameL.position.set(-0.6, 1.225, 0.06);
    doorGroup.add(dFrameL);

    const dFrameR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.45, 0.12), frameMat);
    dFrameR.position.set(0.6, 1.225, 0.06);
    doorGroup.add(dFrameR);

    const dFrameTop = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.1, 0.12), frameMat);
    dFrameTop.position.set(0, 2.45, 0.06);
    doorGroup.add(dFrameTop);

    // Door Leaf (Slate Dark Decontamination Door)
    const doorLeafMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.3 });
    const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.14, 2.38, 0.06), doorLeafMat);
    doorLeaf.position.set(0, 1.19, 0.04);
    doorLeaf.castShadow = true;
    doorGroup.add(doorLeaf);

    // Stainless Kick Plate at Bottom of Door
    const kickPlate = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.26, 0.01), chromeMat);
    kickPlate.position.set(0, 0.15, 0.075);
    doorGroup.add(kickPlate);

    // Safety Wire Glass Vision Panel
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.65,
    });
    const doorWindow = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.65), windowMat);
    doorWindow.position.set(0, 1.62, 0.075);
    doorGroup.add(doorWindow);

    // Heavy Emergency Crash Push Bar (Safety Green with stainless brackets)
    const crashBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.07, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.35 })
    );
    crashBar.position.set(0, 1.05, 0.10);
    doorGroup.add(crashBar);

    // Visible Stainless Steel Overhead Drench Showerhead Inside Room
    const showerHead = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.14, 18), chromeMat);
    showerHead.position.set(0, 2.35, -0.65);
    showerHead.rotation.x = Math.PI;
    doorGroup.add(showerHead);

    const showerPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 12), chromeMat);
    showerPipe.position.set(0, 2.65, -0.65);
    doorGroup.add(showerPipe);

    const pullRod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.85, 8), yellowSafetyMat);
    pullRod.position.set(0.12, 1.85, -0.45);
    doorGroup.add(pullRod);

    // Single Clean Crisp Overhead Sign: EMERGENCY SHOWER & BODY WASH (2:1 Ratio)
    const showerSignTex = this._createFirstAidShowerSignTexture();

    const showerSignFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.24, 0.64, 0.02),
      darkSteelMat
    );
    showerSignFrame.position.set(0, 2.92, 0.05);
    doorGroup.add(showerSignFrame);

    const showerSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.20, 0.60),
      new THREE.MeshStandardMaterial({ map: showerSignTex, roughness: 0.2 })
    );
    showerSign.position.set(0, 2.92, 0.065);
    doorGroup.add(showerSign);

    group.add(doorGroup);

    // 2. Extra-Large Industrial Stainless Steel Eyewash Station (South Wall: x = -3.2, z = -47.65)
    //    Wide 60cm diameter deep stainless steel safety bowl, heavy chrome rolled rim,
    //    dual gooseneck aerated eye/face wash heads with green flip covers, high-vis PUSH flag paddle,
    //    heavy steel wall bracket, chrome P-trap, and water supply lines.
    const eyeWashGroup = new THREE.Group();
    eyeWashGroup.position.set(-3.2, 0, -47.65);

    // Heavy-Duty Wall Mount Backing Plate
    const wallMountPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.68, 0.025),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.6 })
    );
    wallMountPlate.position.set(0, 1.05, 0.012);
    eyeWashGroup.add(wallMountPlate);

    // Cast Steel Support Bracket Arm extending outward beneath the bowl
    const supportArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.26, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.7 })
    );
    supportArm.position.set(0, 1.00, 0.20);
    eyeWashGroup.add(supportArm);

    // Heavy Chrome Drain P-Trap Assembly (Connecting basin bottom to wall)
    const pTrapCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.02, 0.36),    // Bottom of basin drain
      new THREE.Vector3(0, 0.72, 0.36),    // Downward tailpiece
      new THREE.Vector3(0, 0.62, 0.26),    // P-trap bend bottom
      new THREE.Vector3(0, 0.70, 0.12),    // Curve back up
      new THREE.Vector3(0, 0.74, 0.02),    // Into wall outlet
    ]);
    const pTrapGeom = new THREE.TubeGeometry(pTrapCurve, 24, 0.032, 12, false);
    const pTrapMesh = new THREE.Mesh(pTrapGeom, chromeMat);
    eyeWashGroup.add(pTrapMesh);

    // Chrome Water Supply Line with Brass Ball-Valve Shutoff
    const supplyPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.32, 12), chromeMat);
    supplyPipe.position.set(-0.16, 1.04, 0.18);
    supplyPipe.rotation.x = Math.PI / 2;
    eyeWashGroup.add(supplyPipe);

    const shutoffValve = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.045, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.3, metalness: 0.8 })
    );
    shutoffValve.position.set(-0.16, 1.04, 0.15);
    eyeWashGroup.add(shutoffValve);

    const shutoffHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.02, 0.025),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 })
    );
    shutoffHandle.position.set(-0.16, 1.08, 0.15);
    eyeWashGroup.add(shutoffHandle);

    // Weekly Inspection Tag Hanging from Supply Pipe (ANSI Z358.1 Compliance)
    const eyeTagCanvas = document.createElement('canvas');
    eyeTagCanvas.width = 128; eyeTagCanvas.height = 256;
    const etctx = eyeTagCanvas.getContext('2d');
    etctx.fillStyle = '#ffffff'; etctx.fillRect(0, 0, 128, 256);
    etctx.strokeStyle = '#15803d'; etctx.lineWidth = 6; etctx.strokeRect(3, 3, 122, 250);
    etctx.fillStyle = '#15803d'; etctx.fillRect(3, 3, 122, 44);
    etctx.fillStyle = '#ffffff'; etctx.font = 'bold 11px sans-serif'; etctx.textAlign = 'center';
    etctx.fillText('EMERGENCY EYEWASH', 64, 20);
    etctx.fillText('WEEKLY LOG', 64, 36);
    etctx.fillStyle = '#0f172a'; etctx.font = 'bold 10px monospace';
    etctx.fillText('ANSI Z358.1', 64, 62);
    etctx.fillText('FLUSH: 3 MIN OK', 64, 86);
    etctx.fillText('FLOW: 1.5 GPM', 64, 110);
    etctx.fillText('COVERS: INTACT', 64, 134);
    etctx.fillText('TESTED: MONDAY', 64, 158);
    etctx.fillText('SIGN: D. MILLER', 64, 182);
    etctx.fillStyle = '#15803d'; etctx.font = 'bold 13px sans-serif';
    etctx.fillText('✔ COMPLIANT', 64, 218);

    const eyeTagTex = new THREE.CanvasTexture(eyeTagCanvas);
    const eyeTag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.10, 0.20),
      new THREE.MeshStandardMaterial({ map: eyeTagTex, roughness: 0.35 })
    );
    eyeTag.position.set(-0.16, 0.88, 0.18);
    eyeTag.rotation.y = 0.2;
    eyeWashGroup.add(eyeTag);

    // ── Extra Large Polished 304 Stainless Steel Eyewash Bowl (Wide 60cm Basin) ──
    // Thick Rolled Outer Safety Rim
    const bowlRim = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.026, 16, 36), chromeMat);
    bowlRim.position.set(0, 1.20, 0.36);
    bowlRim.rotation.x = Math.PI / 2;
    bowlRim.castShadow = true;
    eyeWashGroup.add(bowlRim);

    // Deep Tapered Dish Basin Interior
    const bowlDish = new THREE.Mesh(
      new THREE.CylinderGeometry(0.30, 0.14, 0.19, 36, 1, true),
      chromeMat
    );
    bowlDish.position.set(0, 1.10, 0.36);
    bowlDish.castShadow = true;
    eyeWashGroup.add(bowlDish);

    // Stainless Steel Drain Strainer Grid in Center of Basin
    const drainGrid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.015, 16),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.8 })
    );
    drainGrid.position.set(0, 1.01, 0.36);
    eyeWashGroup.add(drainGrid);

    // ── Prominent Dual Aerated Eye/Face Wash Spray Assembly ──
    const sprayManifold = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.22, 16), chromeMat);
    sprayManifold.position.set(0, 1.25, 0.36);
    eyeWashGroup.add(sprayManifold);

    [-0.12, 0.12].forEach((sx) => {
      // Curved Gooseneck Spray Arms
      const armCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 1.29, 0.36),
        new THREE.Vector3(sx * 0.6, 1.34, 0.36),
        new THREE.Vector3(sx, 1.41, 0.36),
      ]);
      const armGeom = new THREE.TubeGeometry(armCurve, 14, 0.014, 10, false);
      const armMesh = new THREE.Mesh(armGeom, chromeMat);
      eyeWashGroup.add(armMesh);

      // Chrome Aerated Flow Heads (Angled Inward at 45 Degrees)
      const nozzleHead = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.024, 0.055, 16), chromeMat);
      nozzleHead.position.set(sx, 1.425, 0.36);
      nozzleHead.rotation.z = (sx > 0 ? -0.35 : 0.35);
      eyeWashGroup.add(nozzleHead);

      // Bright Safety-Green Flip Dust Covers
      const dustCover = new THREE.Mesh(
        new THREE.CylinderGeometry(0.038, 0.038, 0.018, 16),
        new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.3 })
      );
      dustCover.position.set(sx, 1.458, 0.36);
      dustCover.rotation.z = (sx > 0 ? -0.35 : 0.35);
      eyeWashGroup.add(dustCover);

      // Stainless Steel Bead Retention Chains
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.11, 6), chromeMat);
      chain.position.set(sx * 1.2, 1.39, 0.33);
      eyeWashGroup.add(chain);
    });

    // ── Emergency PUSH Flag Activator Paddle ──
    const flagArm = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.24, 12), chromeMat);
    flagArm.position.set(0.24, 1.25, 0.36);
    flagArm.rotation.z = Math.PI / 2;
    eyeWashGroup.add(flagArm);

    // Large High-Visibility Green PUSH Paddle Plate (22cm x 22cm)
    const pushCanvas = document.createElement('canvas');
    pushCanvas.width = 256; pushCanvas.height = 256;
    const pctx = pushCanvas.getContext('2d');
    pctx.fillStyle = '#15803d'; pctx.fillRect(0, 0, 256, 256);
    pctx.strokeStyle = '#ffffff'; pctx.lineWidth = 14; pctx.strokeRect(8, 8, 240, 240);
    pctx.fillStyle = '#ffffff';
    pctx.font = '900 68px "Segoe UI", Arial, sans-serif';
    pctx.textAlign = 'center';
    pctx.fillText('PUSH', 128, 115);
    pctx.font = 'bold 44px "Segoe UI", Arial, sans-serif';
    pctx.fillText('✋', 128, 185);

    const pushTex = new THREE.CanvasTexture(pushCanvas);
    const pushPaddle = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.016),
      new THREE.MeshStandardMaterial({ map: pushTex, roughness: 0.3 })
    );
    pushPaddle.position.set(0.36, 1.25, 0.36);
    eyeWashGroup.add(pushPaddle);

    // Single Clean Crisp OSHA First Aid Eyewash Signboard (4:3 Ratio, Razor Sharp)
    const eyeSignTex = this._createFirstAidEyeWashSignTexture();

    const eyeSignFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, 0.84, 0.02),
      darkSteelMat
    );
    eyeSignFrame.position.set(0, 2.05, 0.03);
    eyeWashGroup.add(eyeSignFrame);

    const eyeSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.08, 0.80),
      new THREE.MeshStandardMaterial({ map: eyeSignTex, roughness: 0.2 })
    );
    eyeSign.position.set(0, 2.05, 0.045);
    eyeWashGroup.add(eyeSign);

    group.add(eyeWashGroup);

    // ─── C. CO2 Fire Extinguisher Stand on Floor (South Wall: x = 1.2, z = -47.50) ───
    const feStop5 = this._buildCO2FireExtinguisherStand(1.2, -47.50, 0);
    group.add(feStop5);

    // D. Universal Spill Response Kit Drum (Parked beside Racking End Bay: x = 2.6, z = -45.8)
    //    Matches user reference photo: High-visibility yellow tapered overpack poly drum, triple-ribbed
    //    threaded screw collar, yellow starburst-pattern molded handle lid, wooden pallet base, and AWF PRO Spill Kit hazard decal.
    const spillDrumGroup = new THREE.Group();
    spillDrumGroup.position.set(2.6, 0.05, -45.8);

    // Staging Pallet Base (Matching photo pallet)
    const drumPallet = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 0.10, 0.78),
      woodPalletMat
    );
    drumPallet.position.set(0, 0.05, 0);
    drumPallet.castShadow = true;
    drumPallet.receiveShadow = true;
    spillDrumGroup.add(drumPallet);

    // Pallet Top Slats for realism
    [-0.26, 0, 0.26].forEach((slatZ) => {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.015, 0.18), woodPalletMat);
      slat.position.set(0, 0.108, slatZ);
      spillDrumGroup.add(slat);
    });

    const drumSubGroup = new THREE.Group();
    drumSubGroup.position.set(0, 0.115, 0);

    // Tapered Poly Bucket Body (narrower at base, widening towards top)
    const drumBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.265, 0.215, 0.68, 32),
      spillKitYellowMat
    );
    drumBody.position.set(0, 0.34, 0);
    drumBody.castShadow = true;
    drumSubGroup.add(drumBody);

    // Upper Screw-Thread Flanged Collar Rings (3 stacked molded ridges)
    [0.60, 0.635, 0.67].forEach((ringY, rIdx) => {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.285 - rIdx * 0.005, 0.285 - rIdx * 0.005, 0.025, 32),
        spillKitYellowMat
      );
      ring.position.set(0, ringY, 0);
      ring.castShadow = true;
      drumSubGroup.add(ring);
    });

    // Molded Vertical Reinforcing Ribs on Bucket sides
    [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((angle) => {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.44, 0.03), spillKitYellowMat);
      rib.position.set(Math.sin(angle) * 0.245, 0.32, Math.cos(angle) * 0.245);
      rib.rotation.y = angle;
      drumSubGroup.add(rib);
    });

    // Heavy Molded Yellow Screw-Top Lid
    const lidGroup = new THREE.Group();
    lidGroup.position.set(0, 0.69, 0);

    const lidRim = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.035, 32), spillKitYellowMat);
    lidRim.castShadow = true;
    lidGroup.add(lidRim);

    // Recessed Molded Handle Bar across Top Center
    const handleBar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.03, 0.38), spillKitYellowMat);
    handleBar.position.set(0, 0.025, 0);
    handleBar.castShadow = true;
    lidGroup.add(handleBar);

    // Starburst Molded Radial Tapered Ridges
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.14), spillKitYellowMat);
      spoke.position.set(Math.sin(a) * 0.12, 0.022, Math.cos(a) * 0.12);
      spoke.rotation.y = a;
      lidGroup.add(spoke);
    }
    drumSubGroup.add(lidGroup);

    // High-Vis Tamper-Evident Safety Pull Seal across Rim Collar
    const drumSealCanvas = document.createElement('canvas');
    drumSealCanvas.width = 64; drumSealCanvas.height = 128;
    const dsctx = drumSealCanvas.getContext('2d');
    dsctx.fillStyle = '#dc2626'; dsctx.fillRect(0, 0, 64, 128);
    dsctx.strokeStyle = '#ffffff'; dsctx.lineWidth = 3; dsctx.strokeRect(2, 2, 60, 124);
    dsctx.fillStyle = '#ffffff'; dsctx.font = 'bold 11px sans-serif'; dsctx.textAlign = 'center';
    dsctx.fillText('SEALED', 32, 28);
    dsctx.fillText('SECURITY', 32, 48);
    dsctx.fillText('TAG', 32, 68);
    dsctx.font = 'bold 9px monospace';
    dsctx.fillText('#8821', 32, 98);
    const drumSealTex = new THREE.CanvasTexture(drumSealCanvas);
    const drumSeal = new THREE.Mesh(
      new THREE.PlaneGeometry(0.045, 0.09),
      new THREE.MeshBasicMaterial({ map: drumSealTex })
    );
    drumSeal.position.set(0.24, 0.67, 0.16);
    drumSeal.rotation.y = -Math.PI / 4;
    drumSubGroup.add(drumSeal);

    // High-Fidelity AWF PRO Hazard-Bordered Decal
    const spTex = this._createSpillKitLabelTexture();
    const spSign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, 0.28),
      new THREE.MeshStandardMaterial({ map: spTex, roughness: 0.35 })
    );
    spSign.position.set(0, 0.34, 0.252);
    drumSubGroup.add(spSign);

    spillDrumGroup.add(drumSubGroup);
    group.add(spillDrumGroup);

    // ─── 4. High-Gloss Floor Walkway Markings & Safety Hatching ───────────────
    // Green Pedestrian Transit Highway (z = -36.0 to -47.0)
    const greenWalkway = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 11.2),
      new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.35, metalness: 0.15 })
    );
    greenWalkway.rotation.x = -Math.PI / 2;
    greenWalkway.position.set(0, 0.005, -41.5);
    greenWalkway.receiveShadow = true;
    group.add(greenWalkway);

    // Solid White Border Lines
    [-1.2, 1.2].forEach((bx) => {
      const bLine = new THREE.Mesh(
        new THREE.PlaneGeometry(0.08, 11.2),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
      );
      bLine.rotation.x = -Math.PI / 2;
      bLine.position.set(bx, 0.007, -41.5);
      group.add(bLine);
    });

    // Yellow/Black Diagonal Clearance Boundary in Front of Loading Docks
    [-39.5, -44.5].forEach((hz) => {
      const hatchCanvas = document.createElement('canvas');
      hatchCanvas.width = 512; hatchCanvas.height = 256;
      const hctx = hatchCanvas.getContext('2d');
      hctx.fillStyle = '#0f172a'; hctx.fillRect(0, 0, 512, 256);
      hctx.fillStyle = '#facc15';
      for (let x = -256; x < 768; x += 48) {
        hctx.beginPath();
        hctx.moveTo(x, 0); hctx.lineTo(x + 24, 0);
        hctx.lineTo(x - 104, 256); hctx.lineTo(x - 128, 256);
        hctx.fill();
      }
      hctx.strokeStyle = '#facc15'; hctx.lineWidth = 12;
      hctx.strokeRect(6, 6, 500, 244);

      const hatchTex = new THREE.CanvasTexture(hatchCanvas);
      const hatchMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(3.6, 2.2),
        new THREE.MeshStandardMaterial({ map: hatchTex, roughness: 0.4 })
      );
      hatchMesh.rotation.x = -Math.PI / 2;
      hatchMesh.position.set(-4.5, 0.006, hz);
      group.add(hatchMesh);
    });

    // Crisp Floor Stencil: "KEEP AISLE CLEAR — EMERGENCY EGRESS ROUTE"
    const stencilCanvas = document.createElement('canvas');
    stencilCanvas.width = 1024; stencilCanvas.height = 128;
    const stctx = stencilCanvas.getContext('2d');
    stctx.fillStyle = '#ffffff';
    stctx.font = 'bold 34px "Segoe UI", Arial, sans-serif';
    stctx.textAlign = 'center';
    stctx.fillText('🚶 PEDESTRIAN WALKWAY • KEEP AISLE CLEAR • EMERGENCY EGRESS 🚶', 512, 75);
    const stencilTex = new THREE.CanvasTexture(stencilCanvas);
    const stencilMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(5.2, 0.65),
      new THREE.MeshBasicMaterial({ map: stencilTex, transparent: true, opacity: 0.9 })
    );
    stencilMesh.rotation.x = -Math.PI / 2;
    stencilMesh.position.set(0, 0.009, -38.5);
    group.add(stencilMesh);

    // ─── 5. Overhead Main Facility Board for Zone 05 ──────────────────────────
    const mainCanvas5 = document.createElement('canvas');
    mainCanvas5.width = 1024; mainCanvas5.height = 256;
    const mctx5 = mainCanvas5.getContext('2d');

    // Deep Charcoal slate base with Green/Yellow Compliance stripes
    mctx5.fillStyle = '#111827'; mctx5.fillRect(0, 0, 1024, 256);
    mctx5.fillStyle = '#10b981'; mctx5.fillRect(0, 0, 1024, 24); // Top green compliance bar
    mctx5.fillStyle = '#facc15'; mctx5.fillRect(0, 232, 1024, 24); // Bottom safety yellow bar

    mctx5.fillStyle = '#10b981';
    mctx5.fillRect(36, 38, 170, 32);
    mctx5.fillStyle = '#ffffff';
    mctx5.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    mctx5.textAlign = 'center';
    mctx5.fillText('COMPLIANT', 121, 61);

    mctx5.fillStyle = '#ffffff';
    mctx5.font = 'bold 36px "Segoe UI", Arial, sans-serif';
    mctx5.textAlign = 'left';
    mctx5.fillText('ZONE 05: FINISHED GOODS & DISPATCH AISLE', 224, 63);

    mctx5.fillStyle = '#38bdf8';
    mctx5.font = 'bold 21px "Segoe UI", Arial, sans-serif';
    mctx5.textAlign = 'center';
    mctx5.fillText('LOADING DOCKS 01 & 02 • OUTBOUND LOGISTICS FREIGHT CORRIDOR', 512, 112);

    mctx5.fillStyle = '#a7f3d0';
    mctx5.font = '600 19px "Segoe UI", Arial, sans-serif';
    mctx5.fillText('GOOD SIGHTLINES • CLEAN TRANSIT ROUTE • ZERO STORAGE ENCROACHMENT', 512, 150);

    mctx5.fillStyle = '#fbbf24';
    mctx5.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    mctx5.fillText('SAFETY AUDIT CHECKPOINT — MAINTAIN UNIMPEDED EGRESS AT ALL TIMES', 512, 195);

    const mainSign5Tex = new THREE.CanvasTexture(mainCanvas5);
    const mainSign5 = new THREE.Mesh(
      new THREE.PlaneGeometry(6.2, 1.2),
      new THREE.MeshStandardMaterial({ map: mainSign5Tex, roughness: 0.35 })
    );
    mainSign5.position.set(0, 5.6, -37.5);
    group.add(mainSign5);

    // ─── 6. High-Bay Overhead LED Lighting ────────────────────────────────────
    const dockLight1 = new THREE.PointLight(0xf0fdf4, 3.8, 18);
    dockLight1.position.set(0, 5.8, -39.0);
    group.add(dockLight1);

    const dockLight2 = new THREE.PointLight(0xf0fdf4, 3.8, 18);
    dockLight2.position.set(0, 5.8, -44.0);
    group.add(dockLight2);

    this._stopGroups.set('stop_05', group);
    this.scene.add(group);
  }

  /**
   * Action visual response: Isolates the overheating charging station.
   */
  isolateCharger(stopId) {
    this._stop4ChargerIsolated = true;
    if (this._stop4AmberLight) {
      this._stop4AmberLight.intensity = 0;
      this._stop4AmberLight.visible = false;
    }
    if (this._stop4AmberStrobe) {
      this._stop4AmberStrobe.material.emissive.setHex(0x000000);
      this._stop4AmberStrobe.material.emissiveIntensity = 0;
    }
    if (this._stop4Charger2Screen) {
      // Screen updates to vibrant, authoritative Lockout / Zero Energy State
      const lockCanvas = document.createElement('canvas');
      lockCanvas.width = 256; lockCanvas.height = 384;
      const lctx = lockCanvas.getContext('2d');
      // Dark slate background
      lctx.fillStyle = '#0f172a'; lctx.fillRect(0, 0, 256, 384);

      // Warning red/white perimeter border
      lctx.strokeStyle = '#dc2626'; lctx.lineWidth = 6;
      lctx.strokeRect(4, 4, 248, 376);

      // LCD Display Box with bright red header
      lctx.fillStyle = '#dc2626'; lctx.fillRect(16, 16, 224, 38);
      lctx.fillStyle = '#ffffff'; lctx.font = '900 16px sans-serif'; lctx.textAlign = 'center';
      lctx.fillText('LOCKED OUT / ISOLATED', 128, 41);

      // Main status text
      lctx.fillStyle = '#09090b'; lctx.fillRect(16, 54, 224, 110);
      lctx.strokeStyle = '#334155'; lctx.lineWidth = 2; lctx.strokeRect(16, 54, 224, 110);

      lctx.fillStyle = '#4ade80'; lctx.font = 'bold 18px monospace';
      lctx.fillText('POWER: 0V (OFF)', 128, 85);
      lctx.fillStyle = '#facc15'; lctx.font = 'bold 15px monospace';
      lctx.fillText('ZERO ENERGY VERIFIED', 128, 115);
      lctx.fillStyle = '#38bdf8'; lctx.font = 'bold 12px monospace';
      lctx.fillText('LOTO LOG: #2049-SEC', 128, 145);

      // Lock symbol graphic in center
      lctx.fillStyle = '#dc2626';
      lctx.fillRect(104, 182, 48, 40); // Lock body
      lctx.strokeStyle = '#e2e8f0'; lctx.lineWidth = 6;
      lctx.beginPath();
      lctx.arc(128, 182, 16, Math.PI, 0, false); // Shackle
      lctx.stroke();
      lctx.fillStyle = '#ffffff';
      lctx.beginPath(); lctx.arc(128, 200, 5, 0, Math.PI * 2); lctx.fill();

      lctx.fillStyle = '#f8fafc'; lctx.font = 'bold 14px sans-serif';
      lctx.fillText('DO NOT ENERGIZE', 128, 248);
      lctx.fillStyle = '#94a3b8'; lctx.font = 'bold 11px sans-serif';
      lctx.fillText('MAINTENANCE DISPATCHED', 128, 272);

      // Unlit keypad
      lctx.fillStyle = '#1e293b';
      [[80, 310], [128, 310], [176, 310], [128, 345]].forEach(([bx, by]) => {
        lctx.beginPath(); lctx.arc(bx, by, 12, 0, Math.PI * 2); lctx.fill();
      });

      this._stop4Charger2Screen.material.map = new THREE.CanvasTexture(lockCanvas);
      this._stop4Charger2Screen.material.needsUpdate = true;
    }
    if (this._stop4EStopBtn) {
      this._stop4EStopBtn.position.x = 0.072; // Button depresses inward
    }
    if (this._stop4DisconnectLever) {
      this._stop4DisconnectLever.rotation.z = -Math.PI * 0.52; // Throw lever down to OFF
    }
    this._playSwitchClickSound();
    if (this._stop4EStop) {
      // Remove any existing tag before adding to prevent duplicates
      const existing = this._stop4EStop.getObjectByName('LOTO_Assembly');
      if (existing) this._stop4EStop.remove(existing);

      const lotoGroup = new THREE.Group();
      lotoGroup.name = 'LOTO_Assembly';

      // 1. High-Detail LOTO Safety Tag (Larger 0.30m x 0.16m for crisp visibility)
      const tagCanvas = document.createElement('canvas');
      tagCanvas.width = 512; tagCanvas.height = 256;
      const tctx = tagCanvas.getContext('2d');
      // Tag background
      tctx.fillStyle = '#ffffff'; tctx.fillRect(0, 0, 512, 256);
      tctx.strokeStyle = '#dc2626'; tctx.lineWidth = 10; tctx.strokeRect(5, 5, 502, 246);

      // Red DANGER header
      tctx.fillStyle = '#dc2626'; tctx.fillRect(10, 10, 492, 70);
      tctx.fillStyle = '#ffffff'; tctx.font = '900 38px "Segoe UI", Arial, sans-serif';
      tctx.textAlign = 'center';
      tctx.fillText('DANGER - LOCKED OUT', 256, 58);

      // Main text
      tctx.fillStyle = '#0f172a'; tctx.font = '900 42px "Segoe UI", Arial, sans-serif';
      tctx.fillText('DO NOT OPERATE', 256, 135);
      tctx.font = 'bold 28px monospace';
      tctx.fillStyle = '#dc2626';
      tctx.fillText('EQUIPMENT ISOLATED', 256, 178);

      // Hazard diagonal warning stripes at bottom
      tctx.fillStyle = '#facc15'; tctx.fillRect(10, 215, 492, 31);
      tctx.fillStyle = '#000000';
      for (let x = 10; x < 500; x += 36) {
        tctx.beginPath();
        tctx.moveTo(x, 246); tctx.lineTo(x + 18, 215); tctx.lineTo(x + 30, 215); tctx.lineTo(x + 12, 246);
        tctx.fill();
      }

      const tagTex = new THREE.CanvasTexture(tagCanvas);
      const tag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.30, 0.16),
        new THREE.MeshStandardMaterial({ map: tagTex, roughness: 0.35 })
      );
      tag.position.set(0.16, -0.16, 0.05);
      tag.rotation.y = Math.PI / 2;
      tag.rotation.z = -0.12;
      lotoGroup.add(tag);

      // 2. Heavy-Duty Safety Lockout Padlock (Red Anodized Body + Chrome Shackle)
      const lockBodyMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.35, metalness: 0.2 });
      const lockShackleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.9 });

      const lockBody = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.025), lockBodyMat);
      lockBody.position.set(0.14, -0.07, 0);
      lotoGroup.add(lockBody);

      const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.007, 8, 16, Math.PI), lockShackleMat);
      shackle.position.set(0.14, -0.035, 0);
      shackle.rotation.y = Math.PI / 2;
      lotoGroup.add(shackle);

      // 3. Green Zero-Energy Status Indicator LED on Disconnect Box
      const zeroLed = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 3.5 })
      );
      zeroLed.position.set(0.10, 0.25, 0);
      lotoGroup.add(zeroLed);

      this._stop4EStop.add(lotoGroup);
    }
  }

  /**
   * Generates a crisp, tactile industrial relay switch click via Web Audio API.
   */
  _playSwitchClickSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      // Audio playback fails gracefully if unpermitted
    }
  }

  /**
   * Generates authentic corrugated cardboard texture with fiber noise and printed shipping decals.
   */
  _createCardboardBoxTexture(labelType = 'FRAGILE') {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base Kraft Paper Color
    ctx.fillStyle = '#b77943';
    ctx.fillRect(0, 0, 512, 512);

    // Corrugation & Fiber Noise
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    for (let y = 0; y < 512; y += 4) {
      ctx.fillRect(0, y, 512, 2);
    }
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const alpha = Math.random() * 0.08;
      ctx.fillStyle = `rgba(60, 30, 10, ${alpha})`;
      ctx.fillRect(x, y, 2, 2);
    }

    // Shipping Label (White adhesive paper)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(40, 60, 240, 160);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(40, 60, 240, 160);

    // Barcode
    ctx.fillStyle = '#0f172a';
    for (let bx = 60; bx < 260; bx += Math.floor(Math.random() * 6) + 3) {
      ctx.fillRect(bx, 80, Math.random() > 0.5 ? 3 : 1.5, 45);
    }
    ctx.font = 'bold 12px monospace';
    ctx.fillText('TRACK: #WH-9821-B4', 60, 145);

    if (labelType === 'FRAGILE') {
      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('FRAGILE ⬆', 60, 185);
      ctx.fillStyle = '#0f172a';
      ctx.font = '11px sans-serif';
      ctx.fillText('HANDLE WITH CARE', 60, 202);
    } else if (labelType === 'HEAVY') {
      ctx.fillStyle = '#ea580c';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('⚠️ HEAVY LIFT', 60, 185);
      ctx.fillStyle = '#0f172a';
      ctx.font = '11px sans-serif';
      ctx.fillText('TEAM LIFT > 25KG', 60, 202);
    } else {
      ctx.fillStyle = '#2563eb';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('OEM SPARE PARTS', 60, 185);
      ctx.fillStyle = '#0f172a';
      ctx.font = '11px sans-serif';
      ctx.fillText('INTERNAL LOGISTICS', 60, 202);
    }

    // Kraft Tape crease along center
    ctx.fillStyle = 'rgba(234, 179, 8, 0.45)';
    ctx.fillRect(0, 240, 512, 32);

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * Generates authentic shrink-wrapped finished goods carton textures with shipping labels, barcodes, and QA stamps.
   */
  _createFinishedGoodsPalletTexture(brand = 'GLOBAL_LOGISTICS') {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Industrial kraft carton background
    ctx.fillStyle = '#b47b48';
    ctx.fillRect(0, 0, 512, 512);

    // Box Seams (4 box grid)
    ctx.strokeStyle = '#784c24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(256, 0); ctx.lineTo(256, 512);
    ctx.moveTo(0, 256); ctx.lineTo(512, 256);
    ctx.stroke();

    // Kraft paper fiber & corrugation noise
    ctx.fillStyle = 'rgba(0, 0, 0, 0.035)';
    for (let y = 0; y < 512; y += 4) {
      ctx.fillRect(0, y, 512, 2);
    }
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillStyle = `rgba(50, 25, 5, ${Math.random() * 0.06})`;
      ctx.fillRect(x, y, 2, 2);
    }

    // High-Tension Strapping Bands (Black & Yellow)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(115, 0, 14, 512);
    ctx.fillRect(385, 0, 14, 512);
    ctx.fillRect(0, 115, 512, 14);
    ctx.fillRect(0, 385, 512, 14);

    // Shipping Label 1 (Top Left)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(30, 30, 180, 120);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(30, 30, 180, 120);
    ctx.fillStyle = '#0f172a';
    for (let bx = 45; bx < 195; bx += Math.floor(Math.random() * 5) + 3) {
      ctx.fillRect(bx, 45, Math.random() > 0.5 ? 2.5 : 1.5, 35);
    }
    ctx.font = 'bold 10px monospace';
    ctx.fillText('SHIP: #WH-05-OUT', 45, 95);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#1e3a8a';
    ctx.fillText(brand === 'GLOBAL_LOGISTICS' ? 'GLOBAL FREIGHT' : 'PRECISION MFG', 45, 120);
    ctx.fillStyle = '#dc2626';
    ctx.fillText('THIS WAY UP ⬆', 45, 138);

    // QA Inspection Passed Stamp (Bottom Right)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(290, 290, 180, 120);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(290, 290, 180, 120);

    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 3;
    ctx.strokeRect(300, 300, 160, 100);
    ctx.fillStyle = '#15803d';
    ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('INSPECTED', 380, 335);
    ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    ctx.fillText('PASSED', 380, 362);
    ctx.font = 'bold 12px monospace';
    ctx.fillText('AUDIT STAMP #A-5', 380, 388);

    // Polyethylene Stretch Wrap Sheen & Creases
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    for (let wy = 10; wy < 512; wy += 45) {
      ctx.beginPath();
      ctx.moveTo(0, wy);
      ctx.bezierCurveTo(170, wy + 15, 340, wy - 15, 512, wy + 10);
      ctx.lineTo(512, wy + 20);
      ctx.bezierCurveTo(340, wy - 5, 170, wy + 25, 0, wy + 30);
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /**
   * Helper to draw the authentic red AED heart logo with a white lightning bolt through the center.
   */
  _drawAEDHeartLogo(ctx, cx, cy, size, heartColor = '#dc2626', boltColor = '#ffffff') {
    ctx.save();
    ctx.translate(cx, cy);
    const s = size / 100;
    ctx.scale(s, s);

    // Red Heart Shape
    ctx.fillStyle = heartColor;
    ctx.beginPath();
    ctx.moveTo(0, 30);
    ctx.bezierCurveTo(-50, -20, -50, -60, 0, -35);
    ctx.bezierCurveTo(50, -60, 50, -20, 0, 30);
    ctx.closePath();
    ctx.fill();

    // White Lightning Bolt in Center of Heart
    ctx.fillStyle = boltColor;
    ctx.beginPath();
    ctx.moveTo(3, -38);
    ctx.lineTo(-12, -6);
    ctx.lineTo(0, -6);
    ctx.lineTo(-6, 22);
    ctx.lineTo(12, -10);
    ctx.lineTo(0, -10);
    ctx.lineTo(6, -38);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Generates silk-screened industrial charger faceplate with analog dials, cooling louvers, and OLED readouts.
   */
  _createChargerControlPanelTexture(isOverheat = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Powder-Coated Steel Chassis Face
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 512);

    // Bevel Border
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 500);

    // Manufacturer Silk-Screen Header
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('INDUSTRIAL TRACTION CHARGER 480V', 30, 45);

    // Left Analog Voltmeter (48V)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(120, 140, 65, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VOLTS', 120, 130);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(isOverheat ? '56.2V' : '48.0V', 120, 160);

    // Right Analog Ammeter (150A)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(392, 140, 65, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('AMPS', 392, 130);
    ctx.fillStyle = isOverheat ? '#ef4444' : '#38bdf8';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(isOverheat ? '142A ⚠️' : '80A', 392, 160);

    // Center Diagnostics OLED Display
    ctx.fillStyle = '#020617';
    ctx.fillRect(60, 230, 392, 110);
    ctx.strokeStyle = isOverheat ? '#ef4444' : '#22c55e';
    ctx.lineWidth = 3;
    ctx.strokeRect(60, 230, 392, 110);

    if (isOverheat) {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('⚠️ FAULT: OVERHEAT TRIP', 256, 265);
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('TEMP: 68.4°C [CRITICAL]', 256, 295);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('ACTION: PRESS E-STOP CUTOFF', 256, 325);
    } else {
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('STATUS: CHARGING NORMAL', 256, 265);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('STAGE: BULK CHARGE (80%)', 256, 295);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('CELL TEMP: 28.5°C [OPTIMAL]', 256, 325);
    }

    // Bottom Louver Ventilation Slats
    ctx.fillStyle = '#0f172a';
    for (let ly = 370; ly < 490; ly += 16) {
      ctx.fillRect(40, ly, 432, 10);
    }

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * Generates industrial diamond-plate steel tread texture.
   */
  _createDiamondPlateTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#475569';
    for (let x = 0; x < 256; x += 32) {
      for (let y = 0; y < 256; y += 32) {
        // Cross pattern diamond lugs
        ctx.beginPath();
        ctx.ellipse(x + 16, y + 8, 8, 2.5, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(x + 8, y + 24, 8, 2.5, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 5);
    return tex;
  }

  /**
   * Generates lead-acid traction battery cell texture.
   */
  _createBatteryCellTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 120, 120);

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('2.0V CELL', 64, 40);

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('ACID HAZARD', 64, 75);

    return new THREE.CanvasTexture(canvas);
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

  getHazardAnchor(stopId) {
    if (stopId === 'stop_01' && this._stop1SpillGroup) {
      // Derived dynamically from real spill mesh geometry bounding box
      const box = new THREE.Box3().setFromObject(this._stop1SpillGroup);
      const center = box.getCenter(new THREE.Vector3());
      center.y = 0;
      return center;
    }

    // NOTE FOR RACHANA: Stops 2, 3, and 4 currently use typed anchor coordinates as placeholders
    // pending mesh tagging. Tagging the hazard meshes in stops 2, 3, and 4 the same way stop 1's
    // spill group is tagged will allow both cordon barriers and character facing to derive automatically
    // from real 3D mesh geometry instead of typed coordinates.
    if (stopId === 'stop_02') return new THREE.Vector3(-4.0, 0, -18.0); // Forklift crossing
    if (stopId === 'stop_03') return new THREE.Vector3(-2.30, 0.6, -22.00); // Damaged bent rack column
    if (stopId === 'stop_04') return new THREE.Vector3(-4.90, 1.6, -32.50); // Battery station (Charger #2)

    return null; // Stop 5: hazard.present is false (no hazard anchor)
  }

  getCordonCentre(stopId) {
    if (stopId === 'stop_01') return new THREE.Vector3(-2.25, 0, -5.45);
    if (stopId === 'stop_02') return new THREE.Vector3(-4.0, 0, -18.0);
    if (stopId === 'stop_03') return new THREE.Vector3(-2.60, 0, -23.50);
    if (stopId === 'stop_04') return new THREE.Vector3(-3.5, 0, -32.0);
    return null;
  }

  getCordonStandoff(stopId, approachFrom) {
    // Guaranteed safe standoff positions on the central walkway outside cordon tape.
    // For Stop 01, the spill and cordon span x in [-3.9, -0.7]. Placing Alex at x = 0.15
    // guarantees a wide 0.85m clear margin from the tape and gives Dave ample room
    // to stage on the safe side without crossing into the cordon.
    if (stopId === 'stop_01') return new THREE.Vector3(0.15, 0, -5.4);

    const rect = this._cordonRects.get(stopId);
    if (rect && approachFrom) {
      const { xMin, xMax, zMin, zMax } = rect;
      const cx = (xMin + xMax) / 2;
      const cz = (zMin + zMax) / 2;
      const halfX = (xMax - xMin) / 2;
      const halfZ = (zMax - zMin) / 2;
      const dx = approachFrom.x - cx;
      const dz = approachFrom.z - cz;
      const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

      let posX, posZ;
      if (Math.abs(dx) / halfX > Math.abs(dz) / halfZ) {
        const edge = dx >= 0 ? xMax : xMin;
        posX = edge + Math.sign(dx || 1) * CORDON_STANDOFF;
        posZ = clamp(approachFrom.z, zMin, zMax);
      } else {
        const edge = dz >= 0 ? zMax : zMin;
        posX = clamp(approachFrom.x, xMin, xMax);
        posZ = edge + Math.sign(dz || 1) * CORDON_STANDOFF;
      }
      const safeX = Math.max(-1.40, Math.min(0.40, posX));
      return new THREE.Vector3(safeX, approachFrom.y ?? 0, posZ);
    }

    if (stopId === 'stop_02') return new THREE.Vector3(0.2, 0, -15.5);
    if (stopId === 'stop_03') return new THREE.Vector3(-0.6, 0, -24.5);
    if (stopId === 'stop_04') return new THREE.Vector3(-0.4, 0, -32.0);
    return approachFrom ? new THREE.Vector3(approachFrom.x, approachFrom.y || 0, approachFrom.z) : new THREE.Vector3(0, 0, 0);
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

  /** Registered bounding rectangle for an active cordon. */
  getCordonRect(stopId) {
    return this._cordonRects.get(stopId) || null;
  }

  /** All active cordon rectangles. */
  getAllCordonRects() {
    return Array.from(this._cordonRects.values());
  }

  /**
   * Check if a 2D floor point (x, z) falls inside or within margin of any active cordon.
   */
  isInsideCordon(x, z, padding = 0) {
    for (const rect of this._cordonRects.values()) {
      if (
        x >= rect.xMin - padding &&
        x <= rect.xMax + padding &&
        z >= rect.zMin - padding &&
        z <= rect.zMax + padding
      ) {
        return true;
      }
    }
    return false;
  }

  /**
  /**
   * Applies authentic industrial styling and PBR texture map configuration to the forklift model:
   * - Wheels: Native photorealistic deep black rubber tires
   * - Mast, Roll Cage & Forks: Dark structural steel
   * - Body Panels: Industrial high-visibility finish
   */
  _applyForkliftMaterials(forklift) {
    forklift.traverse((n) => {
      if (n.isMesh && n.material) {
        n.castShadow = true;
        n.receiveShadow = true;
        if (n.material.map) {
          n.material.map.colorSpace = THREE.SRGBColorSpace;
          n.material.map.anisotropy = 8;
          n.material.needsUpdate = true;
        }
        // Ensure proper PBR metallic/roughness response
        if (n.material.roughness !== undefined) {
          n.material.roughness = Math.min(Math.max(n.material.roughness, 0.25), 0.7);
        }
        if (n.material.metalness !== undefined) {
          n.material.metalness = Math.min(Math.max(n.material.metalness, 0.1), 0.8);
        }
        n.material.needsUpdate = true;
      }
    });
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
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // 1. High-Grade Industrial Epoxy Concrete Base
    const baseGrad = ctx.createRadialGradient(512, 512, 100, 512, 512, 720);
    baseGrad.addColorStop(0, '#64748b');
    baseGrad.addColorStop(0.5, '#546478');
    baseGrad.addColorStop(1, '#475569');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    // 2. Organic Polyurethane Resin Mottling & Marbleizing
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let i = 0; i < 24; i++) {
      ctx.beginPath();
      const cx = (i * 137) % 1024;
      const cy = (i * 241) % 1024;
      ctx.ellipse(cx, cy, 140 + (i % 5) * 20, 80 + (i % 3) * 30, (i * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(15, 23, 42, 0.05)';
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      const cx = (i * 191 + 50) % 1024;
      const cy = (i * 173 + 80) % 1024;
      ctx.ellipse(cx, cy, 120 + (i % 4) * 25, 70 + (i % 5) * 20, -(i * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. 4-Panel Laser-Cut Expansion Joint Tile Grid (Etched Bevels & Sealant)
    const gridSize = 512;
    for (let x = 0; x <= 1024; x += gridSize) {
      // Joint Shadow Line
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, 1024);
      ctx.stroke();

      // Joint Specular Highlight Bevel
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 2, 0); ctx.lineTo(x + 2, 1024);
      ctx.stroke();
    }

    for (let y = 0; y <= 1024; y += gridSize) {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(y, 0); ctx.lineTo(y, 1024);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y + 2); ctx.lineTo(1024, y + 2);
      ctx.stroke();
    }

    // 4. Subtle Forklift Tire Tread & Wear Scuff Tracks
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.04)';
    ctx.lineWidth = 28;
    ctx.beginPath();
    ctx.moveTo(140, 0); ctx.lineTo(160, 1024);
    ctx.moveTo(380, 0); ctx.lineTo(360, 1024);
    ctx.stroke();

    // 5. Aggregate Grain & Micro-Surface Specks (5000 fine particles)
    for (let i = 0; i < 5000; i++) {
      const px = Math.random() * 1024;
      const py = Math.random() * 1024;
      const isLight = Math.random() > 0.55;
      const opacity = Math.random() * 0.18 + 0.02;
      ctx.fillStyle = isLight ? `rgba(255,255,255,${opacity})` : `rgba(0,0,0,${opacity})`;
      ctx.fillRect(px, py, Math.random() > 0.8 ? 2 : 1, Math.random() > 0.8 ? 2 : 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  _createConcreteWallTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Precast Concrete Slab Base
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 1024, 512);

    // Horizontal Formwork Pour Seams (Lift lines)
    for (let y = 128; y < 512; y += 128) {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(1024, y);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + 2); ctx.lineTo(1024, y + 2);
      ctx.stroke();
    }

    // Vertical Panel Joints
    for (let x = 256; x < 1024; x += 256) {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, 512);
      ctx.stroke();
    }

    // Form-Tie Cone Holes (Snap-tie circular anchor depressions)
    for (let x = 128; x < 1024; x += 256) {
      for (let y = 64; y < 512; y += 128) {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI);
        ctx.stroke();
      }
    }

    // Concrete Pore Noise
    for (let i = 0; i < 3500; i++) {
      const px = Math.random() * 1024;
      const py = Math.random() * 512;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(px, py, 1.5, 1.5);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createHazardStripeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // OSHA Safety Yellow
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 512, 128);

    // 45-Degree Bold Black Safety Chevrons
    ctx.fillStyle = '#0f172a';
    const stripeWidth = 48;
    for (let x = -128; x < 512 + 128; x += stripeWidth * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeWidth, 0);
      ctx.lineTo(x + stripeWidth + 128, 128);
      ctx.lineTo(x + 128, 128);
      ctx.closePath();
      ctx.fill();
    }

    // Top and Bottom Trim Borders
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 4);
    ctx.fillRect(0, 124, 512, 4);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createWoodPalletTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Pine Wood Base
    ctx.fillStyle = '#a27b5c';
    ctx.fillRect(0, 0, 512, 512);

    // 7 Wooden Deck Slats with Gaps
    const slatH = 64;
    const gap = 9;
    for (let y = 0; y < 512; y += slatH + gap) {
      const tone = Math.floor(Math.random() * 20 - 10);
      ctx.fillStyle = `rgb(${162 + tone}, ${123 + tone}, ${92 + tone})`;
      ctx.fillRect(0, y, 512, slatH);

      // Fine Wood Grain Veins
      ctx.strokeStyle = 'rgba(74, 44, 23, 0.25)';
      ctx.lineWidth = 1;
      for (let g = 0; g < 6; g++) {
        ctx.beginPath();
        const gy = y + 8 + g * 9;
        ctx.moveTo(0, gy + Math.sin(g) * 3);
        ctx.bezierCurveTo(150, gy - 4, 350, gy + 5, 512, gy + 1);
        ctx.stroke();
      }

      // Slat Dark Bottom Gap
      ctx.fillStyle = '#3e2717';
      ctx.fillRect(0, y + slatH, 512, gap);

      // Metal Nail Fasteners at left, center, right
      [28, 256, 484].forEach(nx => {
        ctx.fillStyle = '#261b12';
        ctx.beginPath();
        ctx.arc(nx, y + 16, 3, 0, Math.PI * 2);
        ctx.arc(nx, y + slatH - 16, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Official IPPC HT Brand Stamp on center slat
    ctx.fillStyle = '#3e2717';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('[IPPC 🝮 US-114 HT]', 180, 260);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createChemicalDrumTexture(colorHex = 0x0284c7, isHazard = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Drum Paint Base
    const c = new THREE.Color(colorHex);
    ctx.fillStyle = `#${c.getHexString()}`;
    ctx.fillRect(0, 0, 512, 512);

    // Rolled Steel Swage Ribs (Top & Bottom Hoops)
    [140, 360].forEach(ry => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, ry - 6, 512, 12);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(0, ry - 6, 512, 3);
    });

    // Hazmat GHS Placard Diamond in Center
    const dcX = 256;
    const dcY = 250;
    const dSize = 65;

    ctx.save();
    ctx.translate(dcX, dcY);
    ctx.rotate(Math.PI / 4);

    // Diamond Background
    ctx.fillStyle = isHazard ? '#dc2626' : '#f59e0b';
    ctx.fillRect(-dSize, -dSize, dSize * 2, dSize * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(-dSize + 4, -dSize + 4, (dSize - 4) * 2, (dSize - 4) * 2);

    ctx.restore();

    // Hazard Text & Class Number
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 16px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isHazard ? 'FLAMMABLE' : 'HAZCHEM', dcX, dcY + 12);
    ctx.font = '900 24px monospace';
    ctx.fillText(isHazard ? '3' : '8', dcX, dcY + 48);

    // Manufacturer Lot Decal
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(180, 390, 152, 45);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('LOT: CH-9042-E', 256, 412);
    ctx.fillText('UN 1263 PAINT', 256, 426);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Preserves authentic embedded PBR materials and textures on game-ready forklift model.
   */
  _applyForkliftMaterials(forklift) {
    forklift.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
  }

  _drawAEDHeartLogo(ctx, cx, cy, size, heartColor = '#dc2626', boltColor = '#ffffff') {
    ctx.save();
    // Red Heart base
    ctx.fillStyle = heartColor;
    ctx.beginPath();
    ctx.moveTo(cx, cy + size * 0.42);
    ctx.bezierCurveTo(
      cx - size * 0.55, cy - size * 0.08,
      cx - size * 0.55, cy - size * 0.45,
      cx, cy - size * 0.15
    );
    ctx.bezierCurveTo(
      cx + size * 0.55, cy - size * 0.45,
      cx + size * 0.55, cy - size * 0.08,
      cx, cy + size * 0.42
    );
    ctx.closePath();
    ctx.fill();

    // White Lightning Bolt in center
    ctx.fillStyle = boltColor;
    ctx.beginPath();
    const bw = size * 0.34;
    const bh = size * 0.62;
    ctx.moveTo(cx + bw * 0.12, cy - bh * 0.45);
    ctx.lineTo(cx - bw * 0.42, cy + bh * 0.04);
    ctx.lineTo(cx - bw * 0.06, cy + bh * 0.04);
    ctx.lineTo(cx - bw * 0.28, cy + bh * 0.45);
    ctx.lineTo(cx + bw * 0.42, cy - bh * 0.04);
    ctx.lineTo(cx + bw * 0.06, cy - bh * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _createFinishedGoodsPalletTexture(brandType = 'GLOBAL_LOGISTICS') {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Industrial kraft carton base
    ctx.fillStyle = '#b4814d';
    ctx.fillRect(0, 0, 512, 512);

    // Box grid / seams
    ctx.strokeStyle = '#8c5928';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 504, 504);
    ctx.beginPath();
    ctx.moveTo(256, 0); ctx.lineTo(256, 512);
    ctx.moveTo(0, 256); ctx.lineTo(512, 256);
    ctx.stroke();

    // Shipping & Barcode Labels
    [[24, 32], [280, 32], [24, 288], [280, 288]].forEach(([lx, ly], idx) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(lx, ly, 208, 108);

      // Barcode bars
      ctx.fillStyle = '#0f172a';
      for (let bx = lx + 12; bx < lx + 190; bx += Math.floor((idx * 3 + bx) % 5 + 3)) {
        ctx.fillRect(bx, ly + 10, 2, 48);
      }
      ctx.font = 'bold 12px monospace';
      ctx.fillText(brandType === 'GLOBAL_LOGISTICS' ? 'LOT #8842-OK' : 'PART #TX-902', lx + 12, ly + 76);
      ctx.fillStyle = '#16a34a';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('✓ QC PASSED', lx + 118, ly + 95);
    });

    // Clear stretch wrap specular sheen highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(160, 0); ctx.lineTo(0, 320); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(512, 180); ctx.lineTo(512, 480); ctx.lineTo(340, 512); ctx.lineTo(180, 512); ctx.closePath(); ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  _createSpillKitLabelTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // High-visibility yellow label base
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 512, 512);

    // Diagonal hazard stripe border (black & yellow perimeter)
    const bw = 28;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 512, 512);
    ctx.rect(bw, bw, 512 - bw * 2, 512 - bw * 2);
    ctx.clip('evenodd');

    ctx.fillStyle = '#0f172a';
    for (let x = -512; x < 1024; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 18, 0);
      ctx.lineTo(x - 512 + 18, 512);
      ctx.lineTo(x - 512, 512);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Inner thin border line
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.strokeRect(bw + 4, bw + 4, 512 - (bw + 4) * 2, 512 - (bw + 4) * 2);

    // Branding Header (AWF PRO)
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 44px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AWF PRO®', 256, 115);

    // Main Title
    ctx.font = '900 64px "Segoe UI", Arial, sans-serif';
    ctx.fillText('SPILL KIT', 256, 185);

    // Divider line
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(56, 210);
    ctx.lineTo(456, 210);
    ctx.stroke();

    // Checkboxes / Options
    ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';

    // Left Column
    ctx.fillText('☑ 30 Gallon', 70, 265);
    ctx.fillText('☐ 20 Gallon', 70, 310);
    ctx.fillText('☐ 50 Gallon', 70, 355);

    // Right Column
    ctx.fillText('☑ Universal', 270, 265);
    ctx.fillText('☐ Hazmat', 270, 310);
    ctx.fillText('☐ Oil Only', 270, 355);
    ctx.fillText('☐ Battery Acid', 270, 400);

    // Footer
    ctx.font = '600 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('www.awfprospill.com', 256, 455);

    return new THREE.CanvasTexture(canvas);
  }

  _createTrailerWoodFloorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Laminated hardwood base
    ctx.fillStyle = '#b48a5c';
    ctx.fillRect(0, 0, 512, 512);

    // Individual wood plank strips
    const plankWidth = 32;
    for (let x = 0; x < 512; x += plankWidth) {
      const shade = Math.floor(Math.random() * 26 - 13);
      ctx.fillStyle = `rgb(${180 + shade}, ${138 + shade}, ${92 + shade})`;
      ctx.fillRect(x, 0, plankWidth, 512);

      // Plank seam
      ctx.strokeStyle = '#6b4f2c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();

      // Screw rivets along planks
      ctx.fillStyle = '#4a3720';
      for (let y = 30; y < 512; y += 64) {
        ctx.beginPath();
        ctx.arc(x + plankWidth / 2, y + ((x / plankWidth) % 3) * 12, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return new THREE.CanvasTexture(canvas);
  }

  _createTrailerWallTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Semi-gloss white trailer liner
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, 512, 512);

    // Corrugated aluminum vertical ribs & scuff panels
    for (let x = 0; x < 512; x += 40) {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x, 0, 18, 512);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x + 18, 0, 3, 512);
    }

    // Heavy yellow/wood scuff-liner along bottom of trailer wall
    ctx.fillStyle = '#d97706';
    ctx.fillRect(0, 428, 512, 84);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(0, 424, 512, 4);

    return new THREE.CanvasTexture(canvas);
  }

  _createCorrugatedWallTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Clean modern light silver-grey metal siding base
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, 512, 512);

    // Corrugated vertical panel seams & highlights
    for (let x = 0; x < 512; x += 32) {
      // Bright edge reflection
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x, 0, 5, 512);
      // Flat panel face
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x + 5, 0, 22, 512);
      // Shadow groove
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x + 27, 0, 5, 512);
    }

    return new THREE.CanvasTexture(canvas);
  }

  _createSectionalDoorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Industrial coated sheet steel base (Charcoal / Slate Grey)
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 512, 1024);

    // 6 Sectional Panel Hinges / Seams (every 170px)
    const panelHeight = 170;
    for (let p = 0; p < 6; p++) {
      const y = p * panelHeight;

      // Panel face gradient
      const grad = ctx.createLinearGradient(0, y, 0, y + panelHeight);
      grad.addColorStop(0, '#475569');
      grad.addColorStop(0.08, '#3b495d');
      grad.addColorStop(0.92, '#334155');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, y, 512, panelHeight);

      // Horizontal embossed stiffening ribs (2 per panel)
      [0.35, 0.65].forEach((ribFrac) => {
        const ry = y + panelHeight * ribFrac;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(16, ry - 3, 480, 6);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(16, ry - 1, 480, 2);
      });

      // Side hinge plate accents
      [24, 488].forEach((hx) => {
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(hx - 10, y + panelHeight - 16, 20, 14);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(hx - 4, y + panelHeight - 12, 8, 6);
      });

      // Horizontal Panel Shadow & Highlight Seam
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, y + panelHeight - 4, 512, 4);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, y, 512, 2);
    }

    // Bottom Panel: Black and Yellow Safety Hazard Chevrons
    const bottomY = 5 * panelHeight;
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, bottomY + 30, 512, panelHeight - 30);
    ctx.fillStyle = '#0f172a';
    for (let x = -100; x < 600; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, bottomY + 30);
      ctx.lineTo(x + 24, bottomY + 30);
      ctx.lineTo(x - 24, bottomY + panelHeight);
      ctx.lineTo(x - 48, bottomY + panelHeight);
      ctx.fill();
    }

    // Centered Warning Signboard on 3rd Panel
    const signY = 2 * panelHeight + 35;
    ctx.fillStyle = '#facc15';
    ctx.fillRect(96, signY, 320, 100);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 6;
    ctx.strokeRect(102, signY + 6, 308, 88);
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 24px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CAUTION', 256, signY + 38);
    ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
    ctx.fillText('KEEP CLEAR AT ALL TIMES', 256, signY + 62);
    ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText('AUTOMATIC OVERHEAD DOOR', 256, signY + 82);

    return new THREE.CanvasTexture(canvas);
  }

  _drawAEDHeartLogo(ctx, cx, cy, size, heartColor, boltColor) {
    ctx.save();
    ctx.translate(cx, cy);
    const scale = size / 200;
    ctx.scale(scale, scale);

    // Heart shape
    ctx.fillStyle = heartColor;
    ctx.beginPath();
    ctx.moveTo(0, 35);
    ctx.bezierCurveTo(-10, 20, -70, -25, -70, -65);
    ctx.bezierCurveTo(-70, -105, -30, -115, 0, -80);
    ctx.bezierCurveTo(30, -115, 70, -105, 70, -65);
    ctx.bezierCurveTo(70, -25, 10, 20, 0, 35);
    ctx.closePath();
    ctx.fill();

    // Electrical Lightning Bolt
    ctx.fillStyle = boltColor;
    ctx.beginPath();
    ctx.moveTo(6, -95);
    ctx.lineTo(-24, -45);
    ctx.lineTo(-4, -45);
    ctx.lineTo(-14, 5);
    ctx.lineTo(24, -38);
    ctx.lineTo(4, -38);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  _createFirstAidEyeWashSignTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1500;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // OSHA Crisp White Backing
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 2048, 1500);

    // Thick Green Outer Border
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 36;
    ctx.strokeRect(18, 18, 2012, 1464);

    // Green Header Banner
    ctx.fillStyle = '#15803d';
    ctx.fillRect(36, 36, 1976, 320);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 180px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EMERGENCY', 1024, 255);

    // Left Side: Bold High-Contrast Text
    ctx.fillStyle = '#065f46';
    ctx.font = '900 220px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('EYE WASH', 70, 640);
    ctx.fillText('STATION', 70, 880);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 68px "Segoe UI", Arial, sans-serif';
    ctx.fillText('FLUSH EYES FOR 15 MINUTES', 70, 1060);
    ctx.fillStyle = '#dc2626';
    ctx.fillText('KEEP AREA CLEAR AT ALL TIMES', 70, 1180);

    // Vertical Divider Line
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(1330, 370);
    ctx.lineTo(1330, 1460);
    ctx.stroke();

    // Right Side: Graphic Eye Wash Pictogram Box
    const pcX = 1680;
    const pcY = 720;

    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(pcX - 290, pcY - 300, 580, 680, 36);
    } else {
      ctx.rect(pcX - 290, pcY - 300, 580, 680);
    }
    ctx.fill();

    // Stylized Open Eye Outline in White
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 30;
    ctx.beginPath();
    ctx.moveTo(pcX - 220, pcY - 80);
    ctx.bezierCurveTo(pcX - 130, pcY - 240, pcX + 130, pcY - 240, pcX + 220, pcY - 80);
    ctx.bezierCurveTo(pcX + 130, pcY + 80, pcX - 130, pcY + 80, pcX - 220, pcY - 80);
    ctx.stroke();

    // Eyeball Iris / Pupil
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pcX, pcY - 80, 76, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(pcX - 14, pcY - 86, 36, 0, Math.PI * 2);
    ctx.fill();

    // Eyewash Spray Cup / Nozzle Base below eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(pcX - 140, pcY + 130);
    ctx.bezierCurveTo(pcX - 110, pcY + 210, pcX - 70, pcY + 270, pcX - 50, pcY + 330);
    ctx.lineTo(pcX + 50, pcY + 330);
    ctx.bezierCurveTo(pcX + 70, pcY + 270, pcX + 110, pcY + 210, pcX + 140, pcY + 130);
    ctx.closePath();
    ctx.fill();

    // Upward Spraying Water Droplets
    const droplets = [
      [pcX - 110, pcY + 50, 16],
      [pcX - 75, pcY, 18],
      [pcX - 40, pcY - 20, 16],
      [pcX + 40, pcY - 20, 16],
      [pcX + 75, pcY, 18],
      [pcX + 110, pcY + 50, 16],
      [pcX - 150, pcY - 110, 14],
      [pcX - 130, pcY - 170, 16],
      [pcX + 130, pcY - 170, 16],
      [pcX + 150, pcY - 110, 14],
      [pcX - 90, pcY - 210, 14],
      [pcX + 90, pcY - 210, 14],
    ];

    droplets.forEach(([dx, dy, dr]) => {
      ctx.beginPath();
      ctx.arc(dx, dy, dr, 0, Math.PI * 2);
      ctx.fill();
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  _createFirstAidShowerSignTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // OSHA Crisp White Backing
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 2048, 1024);

    // Thick Green Outer Border
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 32;
    ctx.strokeRect(16, 16, 2016, 992);

    // Green Header Banner
    ctx.fillStyle = '#15803d';
    ctx.fillRect(32, 32, 1984, 240);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 160px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EMERGENCY', 1024, 200);

    // Left Side: Bold High-Contrast Text
    ctx.fillStyle = '#065f46';
    ctx.font = '900 160px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SAFETY SHOWER', 70, 470);
    ctx.fillText('& BODY WASH', 70, 640);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 56px "Segoe UI", Arial, sans-serif';
    ctx.fillText('DECONTAMINATION ROOM', 70, 770);
    ctx.fillStyle = '#dc2626';
    ctx.fillText('KEEP ACCESS CLEAR 24/7', 70, 860);

    // Vertical Divider
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(1380, 290);
    ctx.lineTo(1380, 990);
    ctx.stroke();

    // Right Side: Graphic Shower Pictogram
    const scX = 1710;
    const scY = 510;

    // Green Background Box for Pictogram
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(scX - 270, scY - 200, 540, 640, 32);
    } else {
      ctx.rect(scX - 270, scY - 200, 540, 640);
    }
    ctx.fill();

    // Overhead Drench Shower Head Rose in White
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(scX, scY - 80, 90, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Supply Pipe at top
    ctx.fillRect(scX - 16, scY - 180, 32, 100);

    // Drench Water Spray Droplets
    const showerDrops = [
      [scX - 64, scY, 11], [scX - 28, scY - 6, 11], [scX + 28, scY - 6, 11], [scX + 64, scY, 11],
      [scX - 90, scY + 70, 12], [scX - 38, scY + 60, 11], [scX + 38, scY + 60, 11], [scX + 90, scY + 70, 12],
      [scX - 118, scY + 150, 11], [scX - 60, scY + 135, 12], [scX + 60, scY + 135, 12], [scX + 118, scY + 150, 11],
      [scX - 146, scY + 240, 10], [scX - 78, scY + 225, 11], [scX + 78, scY + 225, 11], [scX + 146, scY + 240, 10],
    ];
    showerDrops.forEach(([dx, dy, dr]) => {
      ctx.beginPath();
      ctx.arc(dx, dy, dr, 0, Math.PI * 2);
      ctx.fill();
    });

    // Person Silhouette Under Shower
    // Head
    ctx.beginPath();
    ctx.arc(scX, scY + 170, 48, 0, Math.PI * 2);
    ctx.fill();

    // Torso / Body Figure
    ctx.beginPath();
    ctx.moveTo(scX - 70, scY + 270);
    ctx.quadraticCurveTo(scX - 100, scY + 340, scX - 60, scY + 370);
    ctx.lineTo(scX + 60, scY + 370);
    ctx.quadraticCurveTo(scX + 100, scY + 340, scX + 70, scY + 270);
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  _createOutdoorSkyYardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Sky Gradient (Clean daytime blue fading to sunny horizon)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 600);
    skyGrad.addColorStop(0, '#0284c7');
    skyGrad.addColorStop(0.55, '#38bdf8');
    skyGrad.addColorStop(0.85, '#bae6fd');
    skyGrad.addColorStop(1, '#e0f2fe');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 1024, 600);

    // Sun radiance glow
    const sunGrad = ctx.createRadialGradient(320, 180, 20, 320, 180, 220);
    sunGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    sunGrad.addColorStop(0.3, 'rgba(254, 240, 138, 0.45)');
    sunGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, 700, 450);

    // Realistic light cumulus clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
    [
      [160, 220, 130, 32],
      [240, 210, 150, 42],
      [700, 250, 170, 38],
      [780, 240, 190, 48],
      [460, 320, 120, 28],
    ].forEach(([cx, cy, rx, ry]) => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Distant Industrial Logistics Park Horizon & Silhouettes
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 520, 1024, 80);
    [
      [40, 460, 150, 60],
      [220, 440, 190, 80],
      [430, 470, 130, 50],
      [590, 430, 230, 90],
      [850, 455, 170, 65],
    ].forEach(([bx, by, bw, bh]) => {
      ctx.fillRect(bx, by, bw, bh);
    });

    // Security Perimeter Fence Line
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 540);
    ctx.lineTo(1024, 540);
    ctx.stroke();

    // Outdoor Asphalt Logistics Yard Apron Ground
    const yardGrad = ctx.createLinearGradient(0, 600, 0, 1024);
    yardGrad.addColorStop(0, '#475569');
    yardGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = yardGrad;
    ctx.fillRect(0, 600, 1024, 424);

    // Yellow Truck Parking Guidance Stripes
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 14;
    [
      [180, 600, 80, 1024],
      [512, 600, 512, 1024],
      [844, 600, 944, 1024],
    ].forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    return new THREE.CanvasTexture(canvas);
  }

  _createOrganicOilPuddleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Transparent clear background
    ctx.clearRect(0, 0, 1024, 1024);

    ctx.save();

    // 1. Viscous Primary Fluid Pool with natural flowing organic contour
    ctx.beginPath();
    
    // Asymmetrical, natural spreading spill contour
    const contour = [
      { x: 180, y: 240 }, // Leak origin at bung
      { x: 280, y: 160 },
      { x: 440, y: 130 },
      { x: 640, y: 170 },
      { x: 820, y: 280 },
      { x: 920, y: 440 },
      { x: 930, y: 600 },
      { x: 840, y: 740 },
      { x: 680, y: 860 },
      { x: 480, y: 890 },
      { x: 320, y: 840 },
      { x: 210, y: 710 },
      { x: 150, y: 540 },
      { x: 140, y: 380 },
    ];

    ctx.moveTo((contour[0].x + contour[contour.length - 1].x) / 2, (contour[0].y + contour[contour.length - 1].y) / 2);
    for (let i = 0; i < contour.length; i++) {
      const next = contour[(i + 1) % contour.length];
      const midX = (contour[i].x + next.x) / 2;
      const midY = (contour[i].y + next.y) / 2;
      ctx.quadraticCurveTo(contour[i].x, contour[i].y, midX, midY);
    }
    ctx.closePath();

    // Deep petroleum fluid gradient (Dense pitch black-amber center with soft viscous antialiased fluid edge)
    const fluidGrad = ctx.createRadialGradient(520, 500, 80, 520, 500, 480);
    fluidGrad.addColorStop(0, 'rgba(8, 10, 14, 0.98)');
    fluidGrad.addColorStop(0.55, 'rgba(12, 15, 20, 0.96)');
    fluidGrad.addColorStop(0.80, 'rgba(16, 20, 26, 0.92)');
    fluidGrad.addColorStop(0.92, 'rgba(22, 27, 34, 0.72)');
    fluidGrad.addColorStop(0.97, 'rgba(26, 32, 40, 0.30)');
    fluidGrad.addColorStop(1.0, 'rgba(30, 36, 46, 0.0)');
    ctx.fillStyle = fluidGrad;
    ctx.fill();

    // 2. Direct connection stream pooling out of the open bung nozzle
    ctx.beginPath();
    ctx.moveTo(130, 240);
    ctx.quadraticCurveTo(180, 190, 260, 220);
    ctx.quadraticCurveTo(300, 280, 230, 330);
    ctx.quadraticCurveTo(140, 310, 130, 240);
    ctx.closePath();
    ctx.fillStyle = 'rgba(8, 10, 14, 0.98)';
    ctx.fill();

    // 3. Ultra-glossy wet specular sheen highlights across puddle surface
    const sheenGrad = ctx.createLinearGradient(200, 160, 840, 800);
    sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
    sheenGrad.addColorStop(0.44, 'rgba(200, 225, 255, 0.02)');
    sheenGrad.addColorStop(0.50, 'rgba(255, 255, 255, 0.12)');
    sheenGrad.addColorStop(0.56, 'rgba(200, 225, 255, 0.02)');
    sheenGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = sheenGrad;
    ctx.fill();

    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  _loadGLTF(url) {
    return new Promise((resolve, reject) => {
      this._loader.load(url, resolve, undefined, reject);
    });
  }

  /**
   * Applies realistic industrial PBR materials to the forklift GLTF model,
   * preserving native texture maps or applying high-visibility safety yellow chassis,
   * dark steel roll-cage/mast, and black rubber tires.
   */
  _applyForkliftMaterials(forklift) {
    const yellowChassisMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.32,
      metalness: 0.35,
    });
    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.45,
      metalness: 0.75,
    });
    const blackRubberMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
      metalness: 0.05,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.1,
      metalness: 0.9,
    });

    forklift.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;

        const name = (n.name || '').toLowerCase();
        const mat = n.material;
        const matName = ((Array.isArray(mat) ? mat[0]?.name : mat?.name) || '').toLowerCase();

        if (n.material) {
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach((m) => {
            if (m.map) {
              m.map.colorSpace = THREE.SRGBColorSpace;
              m.needsUpdate = true;
            } else {
              if (name.includes('wheel') || name.includes('tire') || matName.includes('wheel') || matName.includes('tire')) {
                n.material = blackRubberMat;
              } else if (name.includes('mast') || name.includes('fork') || name.includes('cage') || name.includes('frame') || matName.includes('metal') || matName.includes('steel')) {
                n.material = darkSteelMat;
              } else if (name.includes('glass') || name.includes('light') || matName.includes('glass')) {
                n.material = glassMat;
              } else {
                n.material = yellowChassisMat;
              }
            }
          });
        }
      }
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

    // Active Overheat Warning Strobe on Stop 4 Battery Charger (stops immediately upon isolation)
    if (this._activeStopId === 'stop_04' && this._stop4AmberLight && !this._stop4ChargerIsolated) {
      const isFlash = Math.sin(elapsed * 12.0) > 0.0;
      this._stop4AmberLight.intensity = isFlash ? 4.5 : 0.4;
      if (this._stop4AmberStrobe) {
        this._stop4AmberStrobe.material.emissiveIntensity = isFlash ? 3.5 : 0.5;
      }
    }

    // Active 3D Inspection Reticle for Stop 05 Emergency Equipment Tour
    if (this._inspectionHighlight && this._inspectionHighlight.visible) {
      const pulse = 1.0 + Math.sin(elapsed * 4.0) * 0.08;
      if (this._highlightRing) {
        this._highlightRing.scale.set(pulse, pulse, 1);
        this._highlightRing.rotation.z = elapsed * 0.5;
      }
      if (this._highlightSpot) {
        this._highlightSpot.intensity = 3.5 + Math.sin(elapsed * 6.0) * 1.5;
      }
    }
  }

  /**
   * Highlight a specific 3D safety equipment station for Stop 05 inspection tour.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  highlightEquipment(x, y, z) {
    if (!this._inspectionHighlight) {
      this._inspectionHighlight = new THREE.Group();

      // Pulsing cyan outer inspection ring
      const ringGeom = new THREE.TorusGeometry(0.82, 0.022, 16, 36);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.88,
        wireframe: false
      });
      this._highlightRing = new THREE.Mesh(ringGeom, ringMat);
      this._inspectionHighlight.add(this._highlightRing);

      // Corner Reticle Brackets (4 corners)
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2 + Math.PI / 4;
        const bracket = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.035, 0.015),
          new THREE.MeshBasicMaterial({ color: 0x4dff91 })
        );
        bracket.position.set(Math.cos(angle) * 0.90, Math.sin(angle) * 0.90, 0);
        bracket.rotation.z = angle;
        this._inspectionHighlight.add(bracket);
      }

      // Dynamic Inspection Focus Light
      this._highlightSpot = new THREE.PointLight(0x00d4ff, 4.5, 5.0);
      this._highlightSpot.position.set(0, 0, 0.5);
      this._inspectionHighlight.add(this._highlightSpot);

      this.scene.add(this._inspectionHighlight);
    }

    this._inspectionHighlight.position.set(x, y, z + 0.45);
    this._inspectionHighlight.visible = true;
  }

  /**
   * Remove 3D equipment highlight indicator.
   */
  clearHighlight() {
    if (this._inspectionHighlight) {
      this._inspectionHighlight.visible = false;
    }
  }

  _applyForkliftMaterials(forklift) {
    const texLoader = new THREE.TextureLoader();
    const fkDiffuse = texLoader.load('/assets/textures/forklift_diffuse.png');
    fkDiffuse.colorSpace = THREE.SRGBColorSpace;
    fkDiffuse.flipY = false;

    const forkliftMat = new THREE.MeshStandardMaterial({
      map: fkDiffuse,
      roughness: 0.4,
      metalness: 0.5,
    });

    forklift.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
        n.material = forkliftMat;
      }
    });
  }

  /**
   * Clears the Stop 2 forklift crossing by driving the forklift across the roadway into the side bay.
   */
  clearForkliftCrossing() {
    this._forkliftCleared = true;
  }

  /**
   * Per-frame animation updates for interactive equipment, forklift traffic, and visual indicators.
   * @param {number} elapsed
   * @param {number} delta
   */
  update(elapsed, delta = 0.016) {
    for (const prop of this._animatedProps) {
      if (prop && prop.update) prop.update(elapsed, delta);
    }

    // Dynamic Forklift Traffic across the Blind Cross-Aisle Intersection
    if (this._forklift) {
      if (this._forkliftCleared) {
        // Smooth, realistic clearance drive into the deep right flank bay (parks at x = 9.5m)
        const targetX = 9.5;
        const dist = targetX - this._forklift.position.x;
        if (dist > 0.05) {
          // Controlled warehouse cruising speed (~2.2 m/s), smoothly decelerating as it settles
          const speed = Math.max(0.6, Math.min(2.4, dist * 0.85));
          this._forklift.position.x += speed * delta;
          this._forklift.position.y = (Math.sin(elapsed * 7) * 0.5 + 0.5) * 0.005;

          // Operator acknowledges waiting pedestrians with an appreciative wave
          if (this._forkliftOperatorRightArm) {
            if (dist > 2.2) {
              // Right arm raised in friendly wave
              this._forkliftOperatorRightArm.rotation.x = -Math.PI / 2.3 + Math.sin(elapsed * 7.5) * 0.22;
              this._forkliftOperatorRightArm.rotation.z = 0.25;
            } else {
              // Lowering arm back to wheel/console
              this._forkliftOperatorRightArm.rotation.x = Math.PI / 3.4;
              this._forkliftOperatorRightArm.rotation.z = 0.05;
            }
          }

          if (this._forkliftOperatorHead) {
            // Operator looks toward pedestrians in the aisle while clearing
            this._forkliftOperatorHead.rotation.y = -0.42;
            this._forkliftOperatorHead.rotation.x = 0.06;
          }
        } else {
          this._forklift.position.x = targetX;
          this._forklift.position.y = 0;
          if (this._forkliftOperatorRightArm) {
            this._forkliftOperatorRightArm.rotation.x = Math.PI / 3.4;
            this._forkliftOperatorRightArm.rotation.z = 0.05;
          }
          if (this._forkliftOperatorHead) {
            this._forkliftOperatorHead.rotation.y = 0;
            this._forkliftOperatorHead.rotation.x = 0.1;
          }
        }
      } else {
        // Smooth transit motion: drives from side cross-aisle toward the crossing
        const t = elapsed * 0.65;
        const progress = (Math.sin(t) + 1) * 0.5; // 0 to 1
        this._forklift.position.x = -6.2 + progress * 3.8; // Drives between -6.2m and -2.4m
        this._forklift.position.y = (Math.sin(elapsed * 7) * 0.5 + 0.5) * 0.006;

        // Operator head scans blind corner and checks instrument console
        if (this._forkliftOperatorHead) {
          // Looking between the high pallet stack blind spot and oncoming traffic
          this._forkliftOperatorHead.rotation.y = Math.sin(elapsed * 1.6) * 0.38;
          this._forkliftOperatorHead.rotation.x = 0.12 + Math.cos(elapsed * 0.8) * 0.06;
        }

        if (this._forkliftOperatorRightArm) {
          // Micro-movement on hydraulic levers with engine vibration
          this._forkliftOperatorRightArm.rotation.x = Math.PI / 3.4 + Math.sin(elapsed * 4.0) * 0.04;
          this._forkliftOperatorRightArm.rotation.z = 0.05;
        }
      }

      // Flashing Amber Safety Strobe Beacon on Roll Cage
      if (this._strobeLight) {
        if (this._forkliftCleared && this._forklift.position.x >= 9.4) {
          // Parked idle state: soft steady glow
          this._strobeLight.intensity = 0.8;
        } else {
          // Active traffic flashing beacon
          this._strobeLight.intensity = (Math.sin(elapsed * 14) > 0.15) ? 3.8 : 0.3;
        }
      }
    }

    if (this._inspectionHighlight && this._inspectionHighlight.visible) {
      this._inspectionHighlight.rotation.z += delta * 0.6;
    }
  }
}
