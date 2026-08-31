/**
 * CharacterController.js
 * Manages Supervisor Dave (NPC) alongside the First-Person Trainee (Alex).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ALEX_PATH = '/assets/models/characters/alex.glb';
const DAVE_PATH = '/assets/models/characters/dave.glb';

export class CharacterController {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this._loader = new GLTFLoader();

    /** @type {THREE.Object3D} */
    this.alex = null;
    /** @type {THREE.Object3D} */
    this.dave = null;

    this._alexMixer = null;
    this._daveMixer = null;
    this._alexAction = null;
    this._daveAction = null;

    // Movement targets
    this._alexTarget = new THREE.Vector3();
    this._daveTarget = new THREE.Vector3();
    this._lerpSpeed = 2.5;
    this._alexMoving = false;
    this._daveMoving = false;

    this._keys = { forward: false, backward: false, left: false, right: false };
    this._walkSpeed = 4.2;
    this._setupInput();
  }

  _setupInput() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this._keys.forward = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this._keys.backward = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this._keys.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this._keys.right = true;
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this._keys.forward = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this._keys.backward = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this._keys.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this._keys.right = false;
    });
  }

  async load() {
    const [alex, dave] = await Promise.all([
      this._loadCharacter(ALEX_PATH, 'Alex', 0x4a90d9, new THREE.Vector3(-0.6, 0, -4.5)),
      this._loadCharacter(DAVE_PATH, 'Dave', 0xe07b39, new THREE.Vector3(0.6, 0, -4.7)),
    ]);
    this.alex = alex;
    this.dave = dave;
    // In First-Person POV, Alex is the player camera so his model is hidden
    if (this.alex) this.alex.visible = false;
    if (this.dave) this.dave.visible = true;
  }

  async _loadCharacter(path, name, fallbackColor, offset) {
    try {
      const gltf = await new Promise((resolve, reject) =>
        this._loader.load(path, resolve, undefined, reject)
      );
      const char = gltf.scene;
      char.name = name;
      char.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      // Wrap in an anchor group for clean positioning
      const anchor = new THREE.Group();
      anchor.name = name;
      anchor.add(char);

      // Auto-center pivot and normalize height to 1.78m
      const box = new THREE.Box3().setFromObject(char);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      char.position.set(-center.x, -box.min.y, -center.z);

      if (size.y > 0.1) {
        const targetHeight = 1.78;
        const scaleFactor = targetHeight / size.y;
        anchor.scale.set(scaleFactor, scaleFactor, scaleFactor);
      }

      // Dave faces slightly towards Alex and forward into the warehouse
      anchor.rotation.y = name === 'Dave' ? Math.PI * 0.85 : Math.PI;
      anchor.position.copy(offset);
      anchor.visible = name !== 'Alex';
      this.scene.add(anchor);

      // Animation Mixer
      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(char);
        const clip = gltf.animations[0];
        const action = mixer.clipAction(clip);
        action.setEffectiveWeight(1.0);
        action.play();
        if (name === 'Alex') {
          this._alexMixer = mixer;
          this._alexAction = action;
        } else {
          this._daveMixer = mixer;
          this._daveAction = action;
        }
      }

      console.info(`[CharacterController] Loaded ${name}`);
      return anchor;
    } catch (err) {
      console.warn(`[CharacterController] ${path} load fallback:`, err);
      return this._buildPlaceholder(name, fallbackColor, offset);
    }
  }

  _buildPlaceholder(name, color, offset) {
    const group = new THREE.Group();
    group.name = name;

    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.0, 12), mat);
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat);
    head.position.y = 1.65;
    head.castShadow = true;
    group.add(head);

    group.position.copy(offset);
    group.visible = name !== 'Alex';
    this.scene.add(group);
    return group;
  }

  /**
   * Move Alex to a world-space position.
   * @param {{x:number, y:number, z:number}} pos
   */
  moveAlex(pos) {
    if (!this.alex) return;
    this.alex.visible = false;
    this._alexTarget.set(pos.x, pos.y, pos.z);
    this._alexMoving = true;
  }

  /**
   * Move Dave alongside Alex (standing ~1.1m to the right).
   * @param {{x:number, y:number, z:number}} pos
   */
  moveDave(pos) {
    if (!this.dave) return;
    this.dave.visible = true;
    const davePos = new THREE.Vector3(pos.x + 1.1, pos.y, pos.z - 0.3);
    this._daveTarget.copy(davePos);
    this._daveMoving = true;
    // Turn Dave to look towards the player
    this.dave.lookAt(pos.x, pos.y, pos.z);
  }

  _relaxArms(root) {
    if (!root) return;
    root.traverse((n) => {
      if (n.isBone) {
        if (n.name.includes('LeftArm') && !n.name.includes('ForeArm')) {
          n.rotation.set(0.1, 0, 1.25);
        }
        if (n.name.includes('RightArm') && !n.name.includes('ForeArm')) {
          n.rotation.set(0.1, 0, -1.25);
        }
      }
    });
  }

  /**
   * Call every frame from the render loop.
   * @param {number} delta
   * @param {import('./CameraRig.js').CameraRig} [cameraRig]
   */
  update(delta, cameraRig) {
    // Update animation mixers
    this._alexMixer?.update(delta);
    this._daveMixer?.update(delta);

    // ─── WASD / Arrow Keys Free Movement ─────────────────────────────
    const isKeyDown = this._keys.forward || this._keys.backward || this._keys.left || this._keys.right;
    if (isKeyDown && this.alex) {
      const yaw = cameraRig ? cameraRig.yaw : 0;
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

      const moveDir = new THREE.Vector3();
      if (this._keys.forward) moveDir.add(forward);
      if (this._keys.backward) moveDir.sub(forward);
      if (this._keys.right) moveDir.add(right);
      if (this._keys.left) moveDir.sub(right);

      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();
        const moveStep = moveDir.multiplyScalar(this._walkSpeed * delta);
        this.alex.position.add(moveStep);

        // Keep inside warehouse aisle floor bounds
        this.alex.position.x = Math.max(-8, Math.min(8, this.alex.position.x));
        this.alex.position.z = Math.max(-80, Math.min(5, this.alex.position.z));

        // Dave walks alongside Alex
        if (this.dave) {
          this.dave.position.x = this.alex.position.x + 1.1;
          this.dave.position.z = this.alex.position.z - 0.3;
        }

        // Camera smoothly follows player at eye level
        if (cameraRig) {
          cameraRig.followTarget(this.alex.position);
        }

        this._alexMoving = false;
        this._daveMoving = false;
      }
    }

    // LERP scripted positions (when transitioning between stops)
    if (this._alexMoving && this.alex) {
      this.alex.position.lerp(this._alexTarget, delta * this._lerpSpeed);
      if (this.alex.position.distanceTo(this._alexTarget) < 0.01) {
        this.alex.position.copy(this._alexTarget);
        this._alexMoving = false;
      }
    }
    if (this._daveMoving && this.dave) {
      this.dave.position.lerp(this._daveTarget, delta * this._lerpSpeed);
      if (this.dave.position.distanceTo(this._daveTarget) < 0.01) {
        this.dave.position.copy(this._daveTarget);
        this._daveMoving = false;
      }
    }
  }
}
