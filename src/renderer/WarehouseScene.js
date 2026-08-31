/**
 * WarehouseScene.js
 * 
 * 5 Distinct Architectural Rooms for Warehouse Simulation:
 *  - Room 1 (z: 2 to -9): Chemical & Oil Barrel Storage Facility (Hazmat walls, drum racks, tipped leaking drum & sign)
 *  - Room 2 (z: -12 to -16): Heavy Vehicle & Forklift Transit Hall (22m wide hall, safety railings, zebra crossing, forklift)
 *  - Room 3 (z: -16 to -22): High-Bay High-Density Storage Racking Hall (Towering racks, buckled upright & broken pallet)
 *  - Room 4 (z: -22 to -28): Battery Charging & Electrical Maintenance Bay (Charging station, conduits, combustibles, amber beacon)
 *  - Room 5 (z: -28 to -36): Logistics & Dispatch Loading Dock (Roller shutter doors, delivery bays & green EXIT signage)
 *  - Connecting Portals & Doorways with yellow/black hazard striping separating each distinct room
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const OIL_SPILL_MODEL = '/assets/models/environment/oil_spill_container.glb';
const FORKLIFT_MODEL = '/assets/models/environment/warehouse_forklift_gameready.glb';
const CHARGER_MODEL = '/assets/models/environment/battery_charger.glb';
const SIGN_MODEL = '/assets/models/environment/psx_wet_floor_sign.glb';
const BROKEN_PALLET_MODEL = '/assets/models/environment/broken_pallet.glb';

export const STOP_ANCHORS = [
  { x: -0.6, y: 1.65, z: -4.5 },  // Stop 1: Chemical Storage Room
  { x: -1.5, y: 1.65, z: -14.5 }, // Stop 2: Forklift Transit Hall
  { x: 0.8, y: 1.65, z: -17.5 },  // Stop 3: High-Bay Storage Hall
  { x: 0.8, y: 1.65, z: -23.5 },  // Stop 4: Battery Charging Bay
  { x: 0.8, y: 1.65, z: -29.5 },  // Stop 5: Dispatch Loading Dock
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
    this._buildWarehouseRooms();
    await this._loadStopProps();
  }

  /**
   * Builds the 5 distinct architectural rooms and connecting portals.
   */
  _buildWarehouseRooms() {
    const root = new THREE.Group();
    root.name = 'WarehouseRooms';

    // ─── 1. Epoxy Concrete Flooring across Entire Facility ───────────
    const floorGeo = new THREE.PlaneGeometry(24, 48, 32, 64);
    const floorTex = this._createConcreteTexture();
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(8, 20);

    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.35,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -18);
    floor.receiveShadow = true;
    root.add(floor);

    // ─── 2. Yellow Walkway Safety Lines & Zebra Striping ─────────────
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xf5a623,
      roughness: 0.35,
      emissive: 0x553300,
      emissiveIntensity: 0.2,
    });

    const leftLine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 46), lineMat);
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(-1.8, 0.003, -18);
    root.add(leftLine);

    const rightLine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 46), lineMat);
    rightLine.rotation.x = -Math.PI / 2;
    rightLine.position.set(1.8, 0.003, -18);
    root.add(rightLine);

    // Zebra crosswalk in Room 2 (z = -14.5)
    for (let i = -1.5; i <= 1.5; i += 0.45) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 2.5), lineMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(i, 0.004, -14.5);
      root.add(stripe);
    }

    // ─── 3. Build Architectural Room Enclosures & Portals ───────────
    this._buildRoom1_ChemicalStorage(root);
    this._buildRoom2_ForkliftTransit(root);
    this._buildRoom3_HighBayStorage(root);
    this._buildRoom4_ChargingBay(root);
    this._buildRoom5_DispatchDock(root);

    this._buildRoomPortals(root);
    this._buildFacilityLighting(root);

    this.scene.add(root);
  }

  /**
   * Room 1: Chemical & Oil Barrel Storage Facility (z: 3 to -9)
   */
  _buildRoom1_ChemicalStorage(root) {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const hazmatMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });

    // Side walls
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6.5), wallMat);
    leftWall.position.set(-6.5, 3.25, -3);
    leftWall.rotation.y = Math.PI / 2;
    root.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6.5), wallMat);
    rightWall.position.set(6.5, 3.25, -3);
    rightWall.rotation.y = -Math.PI / 2;
    root.add(rightWall);

    // Back wall with entrance door
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(13, 6.5), hazmatMat);
    backWall.position.set(0, 3.25, 3);
    backWall.rotation.y = Math.PI;
    root.add(backWall);

    // Wall barrel storage racks along left wall
    this._addDrumRack(root, -5.2, -1.0);
    this._addDrumRack(root, -5.2, -5.5);

    // Hazmat Warning Sign on back wall
    this._addRoomPlacard(root, 0, 4.2, 2.9, 'HAZMAT & CHEMICAL DRUM STORAGE');
  }

  /**
   * Room 2: Massive Forklift Vehicle Transit Hall (z: -9 to -16, width: 22m)
   */
  _buildRoom2_ForkliftTransit(root) {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.65 });
    const yellowRailingMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });

    // Wide Hall Side Walls (22m wide!)
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(7, 7.5), wallMat);
    leftWall.position.set(-11, 3.75, -14.5);
    leftWall.rotation.y = Math.PI / 2;
    root.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(7, 7.5), wallMat);
    rightWall.position.set(11, 3.75, -14.5);
    rightWall.rotation.y = -Math.PI / 2;
    root.add(rightWall);

    // Pedestrian Safety Guard Railings along walkway
    const makeRailing = (x, zStart, zEnd) => {
      const railing = new THREE.Group();
      const length = Math.abs(zEnd - zStart);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, length, 12), yellowRailingMat);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(x, 0.95, (zStart + zEnd) / 2);
      railing.add(bar);

      const midBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, length, 12), yellowRailingMat);
      midBar.rotation.x = Math.PI / 2;
      midBar.position.set(x, 0.45, (zStart + zEnd) / 2);
      railing.add(midBar);

      // Posts every 1.8m
      for (let z = zStart; z <= zEnd; z += 1.8) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.0, 12), yellowRailingMat);
        post.position.set(x, 0.5, z);
        post.castShadow = true;
        railing.add(post);
      }
      return railing;
    };

    root.add(makeRailing(-2.0, -12.5, -13.5));
    root.add(makeRailing(-2.0, -15.5, -16.5));
    root.add(makeRailing(2.0, -12.5, -13.5));
    root.add(makeRailing(2.0, -15.5, -16.5));

    // Room Placard
    this._addRoomPlacard(root, 0, 5.2, -12.1, 'ZONE 02 | VEHICLE TRANSIT INTERSECTION');
  }

  /**
   * Room 3: High-Bay High-Density Storage Racking Hall (z: -16 to -22)
   */
  _buildRoom3_HighBayStorage(root) {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(6, 7.5), wallMat);
    leftWall.position.set(-7, 3.75, -19);
    leftWall.rotation.y = Math.PI / 2;
    root.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(6, 7.5), wallMat);
    rightWall.position.set(7, 3.75, -19);
    rightWall.rotation.y = -Math.PI / 2;
    root.add(rightWall);

    // Multi-tier Storage Racking Bays
    this._buildRackingBays(root, -4.2, -17.5);
    this._buildRackingBays(root, -4.2, -20.5);
    this._buildRackingBays(root, 4.2, -17.5);

    this._addRoomPlacard(root, 0, 5.2, -16.1, 'ZONE 03 | HIGH-BAY STORAGE AISLE');
  }

  /**
   * Room 4: Battery Charging & Electrical Maintenance Bay (z: -22 to -28)
   */
  _buildRoom4_ChargingBay(root) {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65 });

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(6, 6.5), wallMat);
    leftWall.position.set(-6.5, 3.25, -25);
    leftWall.rotation.y = Math.PI / 2;
    root.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(6, 6.5), wallMat);
    rightWall.position.set(6.5, 3.25, -25);
    rightWall.rotation.y = -Math.PI / 2;
    root.add(rightWall);

    // Fire Extinguisher on wall
    this._addFireExtinguisher(root, -6.3, 1.4, -24.5);

    this._addRoomPlacard(root, 0, 4.8, -22.1, 'ZONE 04 | BATTERY CHARGING & MAINTENANCE');
  }

  /**
   * Room 5: Logistics & Dispatch Loading Dock (z: -28 to -36)
   */
  _buildRoom5_DispatchDock(root) {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.65 });

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 7.5), wallMat);
    leftWall.position.set(-8, 3.75, -32);
    leftWall.rotation.y = Math.PI / 2;
    root.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 7.5), wallMat);
    rightWall.position.set(8, 3.75, -32);
    rightWall.rotation.y = -Math.PI / 2;
    root.add(rightWall);

    // Front Wall with 2 Roller Shutter Doors
    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 7.5), wallMat);
    frontWall.position.set(0, 3.75, -36);
    frontWall.receiveShadow = true;
    root.add(frontWall);

    this._addRollerDoor(root, -3.5, -35.8);
    this._addRollerDoor(root, 3.5, -35.8);

    this._addRoomPlacard(root, 0, 5.2, -28.1, 'ZONE 05 | DISPATCH & LOADING DOCK');
  }

  /**
   * Industrial Doorways / Portals with Yellow-Black Hazard Striping between Rooms.
   */
  _buildRoomPortals(root) {
    const portalZs = [-9.0, -16.0, -22.0, -28.0];
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const hazardStripeTex = this._createHazardStripeTexture();
    const stripeMat = new THREE.MeshBasicMaterial({ map: hazardStripeTex });

    portalZs.forEach((z) => {
      const portal = new THREE.Group();
      // Left Wall partition
      const leftPart = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 6.5), frameMat);
      leftPart.position.set(-4.25, 3.25, z);
      portal.add(leftPart);

      // Right Wall partition
      const rightPart = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 6.5), frameMat);
      rightPart.position.set(4.25, 3.25, z);
      portal.add(rightPart);

      // Top Lintle with hazard stripes
      const topPart = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.6, 0.3), stripeMat);
      topPart.position.set(0, 5.2, z);
      portal.add(topPart);

      // Side frame posts
      const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5.2, 0.3), stripeMat);
      leftPost.position.set(-2.0, 2.6, z);
      portal.add(leftPost);

      const rightPost = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5.2, 0.3), stripeMat);
      rightPost.position.set(2.0, 2.6, z);
      portal.add(rightPost);

      root.add(portal);
    });
  }

  _buildRackingBays(root, x, z) {
    const rackOrange = new THREE.MeshStandardMaterial({ color: 0xe65100, roughness: 0.5 });
    const rackBlue = new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.5 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xbcaaa4, roughness: 0.9 });

    const bay = new THREE.Group();
    const length = 4.6, height = 4.8;

    for (const dx of [-length / 2, length / 2]) {
      for (const dz of [-0.6, 0.6]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.12, height, 0.12), rackBlue);
        col.position.set(dx, height / 2, dz);
        col.castShadow = true;
        bay.add(col);
      }
    }

    for (let y = 1.4; y < height; y += 1.6) {
      for (const dz of [-0.6, 0.6]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(length, 0.12, 0.08), rackOrange);
        beam.position.set(0, y, dz);
        bay.add(beam);
      }
      const pallet = new THREE.Mesh(new THREE.BoxGeometry(length * 0.88, 0.14, 1.1), woodMat);
      pallet.position.set(0, y + 0.1, 0);
      bay.add(pallet);

      for (let bx = -1.3; bx <= 1.3; bx += 1.3) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.85), boxMat);
        crate.position.set(bx, y + 0.55, (Math.random() - 0.5) * 0.15);
        crate.castShadow = true;
        bay.add(crate);
      }
    }
    bay.position.set(x, 0, z);
    root.add(bay);
  }

  _addDrumRack(root, x, z) {
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 });
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.5 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });

    const group = new THREE.Group();
    // Steel cradle frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 1.2), rackMat);
    frame.position.set(0, 0.3, 0);
    group.add(frame);

    // 2 Standing chemical drums
    for (const dx of [-0.4, 0.4]) {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.85, 16), drumMat);
      drum.position.set(dx, 0.95, 0);
      group.add(drum);

      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.222, 0.222, 0.15, 16), yellowMat);
      stripe.position.set(dx, 0.95, 0);
      group.add(stripe);
    }
    group.position.set(x, 0, z);
    root.add(group);
  }

  _addFireExtinguisher(root, x, y, z) {
    const extMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });
    const group = new THREE.Group();
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.45, 12), extMat);
    group.add(tank);
    group.position.set(x, y, z);
    root.add(group);
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
      new THREE.PlaneGeometry(3.2, 0.5),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    placard.position.set(x, y, z);
    root.add(placard);
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

  _buildFacilityLighting(root) {
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.0 });
    const lightZs = [-4.5, -14.5, -19.5, -25.5, -31.5];
    lightZs.forEach((z) => {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 0.2, 12), lampMat);
      lamp.position.set(0, 6.0, z);
      root.add(lamp);

      const pLight = new THREE.PointLight(0xfff4e0, 1.2, 12, 1.5);
      pLight.position.set(0, 5.7, z);
      pLight.castShadow = true;
      root.add(pLight);
    });
  }

  /**
   * Stop-Specific Contextual Hazards across the 5 Rooms.
   */
  async _loadStopProps() {
    // ─── STOP 1 (Room 1, z: -4.5): Drum Pallet with Leaking Drum & Sign ───
    await this._buildStop1DrumPallet(new THREE.Vector3(-0.1, 0, -7.2));

    // ─── STOP 2 (Room 2, z: -14.5): Blind-Corner Forklift ────────────────
    const forkliftGroup = new THREE.Group();
    try {
      const flGltf = await this._loadGLTF(FORKLIFT_MODEL);
      const forklift = flGltf.scene;
      this._normalizeProp(forklift, 2.2);
      forklift.position.set(0, 0, 0);
      forklift.rotation.y = -Math.PI / 2;
      forkliftGroup.add(forklift);

      // Add driver mannequin silhouette
      const driver = this._buildForkliftDriver();
      driver.position.set(0.1, 1.1, -0.2);
      forkliftGroup.add(driver);

      this._addHighCargoToGroup(forkliftGroup, new THREE.Vector3(-1.0, 0.7, 0));
    } catch {
      this._buildProceduralForklift(new THREE.Vector3(0, 0, 0));
    }
    forkliftGroup.position.set(5.5, 0, -14.5);
    this.scene.add(forkliftGroup);
    this._forkliftGroup = forkliftGroup;

    this._addConvexMirror(new THREE.Vector3(-2.2, 2.8, -13.5));

    // ─── STOP 3 (Room 3, z: -17.5): Buckled Upright & Broken Pallet ──────
    try {
      const palletGltf = await this._loadGLTF(BROKEN_PALLET_MODEL);
      const pallet = palletGltf.scene;
      this._normalizeProp(pallet, 1.2);
      pallet.position.set(2.4, 0, -20.5);
      this.scene.add(pallet);
    } catch {}
    this._addBentUprightProp(new THREE.Vector3(2.4, 0, -20.5));

    // ─── STOP 4 (Room 4, z: -23.5): Battery Charger & Combustibles ───────
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

  async _buildStop1DrumPallet(pos) {
    const group = new THREE.Group();
    group.name = 'Stop1_DrumPallet';

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
    const blueDrumMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.5 });
    const yellowStripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });

    // 1. Offload Wooden Pallet
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 1.3), woodMat);
    pallet.position.set(pos.x + 0.5, 0.07, pos.z);
    pallet.receiveShadow = true;
    group.add(pallet);

    // 2. Standing chemical drums
    const drumOffsets = [
      { dx: 0.25, dz: 0.25 },
      { dx: -0.25, dz: 0.25 },
      { dx: 0.25, dz: -0.25 },
    ];
    drumOffsets.forEach(({ dx, dz }) => {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.75, 16), blueDrumMat);
      drum.position.set(pos.x + 0.5 + dx, 0.52, pos.z + dz);
      drum.castShadow = true;
      group.add(drum);

      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.202, 0.202, 0.15, 16), yellowStripeMat);
      stripe.position.set(pos.x + 0.5 + dx, 0.52, pos.z + dz);
      group.add(stripe);
    });

    // 3. Tipped leaking drum
    const tippedDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.75, 16), blueDrumMat);
    tippedDrum.rotation.z = Math.PI / 2;
    tippedDrum.rotation.y = 0.35;
    tippedDrum.position.set(pos.x - 0.3, 0.2, pos.z);
    tippedDrum.castShadow = true;
    group.add(tippedDrum);

    const tippedStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.202, 0.202, 0.15, 16), yellowStripeMat);
    tippedStripe.rotation.z = Math.PI / 2;
    tippedStripe.rotation.y = 0.35;
    tippedStripe.position.set(pos.x - 0.3, 0.2, pos.z);
    group.add(tippedStripe);

    // 4. Glossy reflective oil spill puddle on walkway
    const puddleMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.04,
      metalness: 0.85,
      transparent: true,
      opacity: 0.88,
    });
    const lobes = [
      { x: -0.5, z: 0.1, r: 0.55 },
      { x: -0.25, z: 0.35, r: 0.4 },
      { x: -0.7, z: -0.2, r: 0.35 },
    ];
    lobes.forEach(({ x, z, r }) => {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(r, 24), puddleMat);
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.set(pos.x + x, 0.008, pos.z + z);
      group.add(puddle);
    });

    // 5. PSX Caution Wet Floor Sign
    try {
      const signGltf = await this._loadGLTF(SIGN_MODEL);
      const sign = signGltf.scene;
      this._normalizeProp(sign, 0.65);
      sign.position.set(pos.x - 0.9, 0, pos.z + 0.4);
      sign.rotation.y = 0.4;
      group.add(sign);
    } catch {
      this._buildProceduralSign(new THREE.Vector3(pos.x - 0.9, 0, pos.z + 0.4));
    }

    // 6. Highlight spotlight
    const spot = new THREE.SpotLight(0xffffff, 2.5, 8, Math.PI / 4, 0.3);
    spot.position.set(pos.x - 0.4, 4.5, pos.z);
    spot.target.position.set(pos.x - 0.4, 0, pos.z);
    group.add(spot);
    group.add(spot.target);

    this.scene.add(group);
  }

  _buildForkliftDriver() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const vestMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.25), vestMat);
    torso.position.y = 0.25;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), mat);
    head.position.y = 0.6;
    group.add(head);

    const hatMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.1, 12), hatMat);
    hat.position.y = 0.68;
    group.add(hat);

    return group;
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

  _createHazardStripeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#0f172a';
    for (let x = -64; x < 256; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 20, 0);
      ctx.lineTo(x + 52, 64);
      ctx.lineTo(x + 32, 64);
      ctx.closePath();
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
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
