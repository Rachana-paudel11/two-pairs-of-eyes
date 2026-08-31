/**
 * CharacterController.js
 * 
 * Clean Third-Person Character Controller using native Mixamo skeletal animations:
 *  - Native animation mixers drive full-body bone hierarchies (anatomically correct legs, boots, pants, vest).
 *  - Smooth WASD movement with camera-relative heading and rotation interpolation.
 *  - Dave supervisor NPC tracks alongside Alex.
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

    /** @type {THREE.Group} */
    this.alex = null;
    /** @type {THREE.Group} */
    this.dave = null;

    this._alexMixer = null;
    this._daveMixer = null;
    this._alexAction = null;
    this._daveAction = null;

    // Movement targets
    this._alexTarget = new THREE.Vector3(0.6, 0, -4.0);
    this._daveTarget = new THREE.Vector3(1.4, 0, -4.3);
    this._scriptedMoving = false;

    this._keys = { forward: false, backward: false, left: false, right: false };
    this._moveSpeed = 3.6;
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
      this._loadCharacter(ALEX_PATH, 'Alex', 0x4a90d9, new THREE.Vector3(0.6, 0, -4.0)),
      this._loadCharacter(DAVE_PATH, 'Dave', 0xe07b39, new THREE.Vector3(1.4, 0, -4.3)),
    ]);
    this.alex = alex;
    this.dave = dave;
    if (this.alex) this.alex.visible = true;
    if (this.dave) this.dave.visible = true;
  }

  async _loadCharacter(path, name, fallbackColor, offset) {
    try {
      const gltf = await new Promise((resolve, reject) =>
        this._loader.load(path, resolve, undefined, reject)
      );
      const char = gltf.scene;
      char.name = `${name}_Mesh`;

      char.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      const anchor = new THREE.Group();
      anchor.name = name;
      anchor.add(char);

      // Measure unscaled bounds
      const box = new THREE.Box3().setFromObject(char);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Center model horizontally and align feet perfectly to anchor floor (y = 0)
      char.position.set(-center.x, -box.min.y, -center.z);

      if (size.y > 0.1) {
        const targetHeight = 1.78;
        const scaleFactor = targetHeight / size.y;
        anchor.scale.set(scaleFactor, scaleFactor, scaleFactor);
      }

      anchor.rotation.y = Math.PI;
      anchor.position.copy(offset);
      anchor.visible = true;
      this.scene.add(anchor);

      // Play native Mixamo idle animation for Dave
      if (name === 'Dave' && gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(char);
        const clip = gltf.animations[0];
        const action = mixer.clipAction(clip);
        action.setEffectiveWeight(1.0);
        action.play();
        this._daveMixer = mixer;
        this._daveAction = action;
      } else if (name === 'Alex') {
        // Lower Alex's arms permanently so they hang naturally down at sides
        char.traverse((n) => {
          if (n.name === 'mixamorig1LeftArm') {
            n.rotation.set(0.1, 0, -1.35);
          } else if (n.name === 'mixamorig1RightArm') {
            n.rotation.set(0.1, 0, 1.35);
          } else if (n.name === 'mixamorig1LeftForeArm' || n.name === 'mixamorig1RightForeArm') {
            n.rotation.set(0, 0, 0);
          }
        });
      }

      console.info(`[CharacterController] Loaded ${name}`);
      return anchor;
    } catch (err) {
      console.warn(`[CharacterController] ${path} fallback:`, err);
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
    group.visible = true;
    this.scene.add(group);
    return group;
  }

  moveAlex(pos) {
    if (!this.alex) return;
    this.alex.visible = true;
    this._alexTarget.set(pos.x, pos.y, pos.z);
    this._scriptedMoving = true;
  }

  moveDave(pos) {
    if (!this.dave) return;
    this.dave.visible = true;
    this._daveTarget.set(pos.x + 1.2, pos.y, pos.z - 0.2);
    this._scriptedMoving = true;
  }

  _relaxArms(bones) {
    if (!bones || typeof bones !== 'object') return;
    for (const [name, bone] of Object.entries(bones)) {
      if (name === 'mixamorig1LeftArm') {
        bone.rotation.set(0.1, 0, -1.35);
      } else if (name === 'mixamorig1RightArm') {
        bone.rotation.set(0.1, 0, 1.35);
      } else if (name === 'mixamorigLeftArm') {
        bone.rotation.set(0.05, 0, 1.32);
      } else if (name === 'mixamorigRightArm') {
        bone.rotation.set(0.05, 0, -1.32);
      }
    }
  }

  /**
   * Call every frame from the render loop.
   * @param {number} delta
   * @param {import('./CameraRig.js').CameraRig} [cameraRig]
   */
  update(delta, cameraRig) {
    // 1. Update native animation mixers
    this._alexMixer?.update(delta);
    this._daveMixer?.update(delta);

    // Ensure arms hang naturally down every frame (no T-pose)
    this._relaxArms(this._alexBones);
    this._relaxArms(this._daveBones);

    const isKeyDown = this._keys.forward || this._keys.backward || this._keys.left || this._keys.right;

    // 2. WASD Player Locomotion
    if (isKeyDown && this.alex) {
      const yaw = cameraRig ? cameraRig.yaw : 0;
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

      const moveDir = new THREE.Vector3();
      if (this._keys.forward) moveDir.add(forward);
      if (this._keys.backward) moveDir.sub(forward);
      if (this._keys.right) moveDir.add(right);
      if (this._keys.left) moveDir.sub(right);

      if (moveDir.lengthSq() > 0.001) {
        moveDir.normalize();

        // Smooth character rotation towards movement direction (PUBG style)
        const targetAngle = Math.atan2(-moveDir.x, -moveDir.z);
        let angleDiff = targetAngle - this.alex.rotation.y;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        this.alex.rotation.y += angleDiff * Math.min(1.0, delta * 12.0);

        // Move character
        const step = moveDir.clone().multiplyScalar(this._moveSpeed * delta);
        this.alex.position.add(step);

        // Clamping within warehouse room bounds
        this.alex.position.x = Math.max(-10.0, Math.min(10.0, this.alex.position.x));
        this.alex.position.z = Math.max(-10.0, Math.min(4.0, this.alex.position.z));

        // Camera tracks Alex
        if (cameraRig) {
          cameraRig.followTarget(this.alex.position);
        }

        // Supervisor Dave pathfinds and follows alongside Alex
        if (this.dave) {
          const daveGoal = new THREE.Vector3(
            this.alex.position.x + 1.2,
            this.alex.position.y,
            this.alex.position.z - 0.2
          );
          const dist = this.dave.position.distanceTo(daveGoal);
          if (dist > 0.1) {
            const daveDir = new THREE.Vector3().subVectors(daveGoal, this.dave.position).normalize();
            this.dave.position.add(daveDir.multiplyScalar(this._moveSpeed * 0.95 * delta));
            const daveAngle = Math.atan2(-daveDir.x, -daveDir.z);
            let dDiff = daveAngle - this.dave.rotation.y;
            while (dDiff < -Math.PI) dDiff += Math.PI * 2;
            while (dDiff > Math.PI) dDiff -= Math.PI * 2;
            this.dave.rotation.y += dDiff * Math.min(1.0, delta * 10.0);
          }
        }
      }
    }

    // 3. Scripted Stop Transition Movement
    if (this._scriptedMoving) {
      if (this.alex) {
        const dist = this.alex.position.distanceTo(this._alexTarget);
        if (dist > 0.05) {
          this.alex.position.lerp(this._alexTarget, delta * 2.8);
          this.alex.lookAt(this._alexTarget.x, this.alex.position.y, this._alexTarget.z);
          if (cameraRig) cameraRig.followTarget(this.alex.position);
        } else {
          this.alex.position.copy(this._alexTarget);
          this.alex.lookAt(-1.45, 0, -6.2); // Look at secured spill
        }
      }
      if (this.dave) {
        const dist = this.dave.position.distanceTo(this._daveTarget);
        if (dist > 0.05) {
          this.dave.position.lerp(this._daveTarget, delta * 2.8);
          this.dave.lookAt(this._daveTarget.x, this.dave.position.y, this._daveTarget.z);
        } else {
          this.dave.position.copy(this._daveTarget);
          this.dave.lookAt(-1.45, 0, -6.2); // Look at secured spill
          this._scriptedMoving = false;
        }
      }
    }
  }
}
