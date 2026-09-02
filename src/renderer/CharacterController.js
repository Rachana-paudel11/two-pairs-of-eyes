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

const ALEX_PATH = '/assets/models/characters/dave.glb';
const DAVE_PATH = '/assets/models/characters/alex.glb';

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
    this._alexTarget = new THREE.Vector3(-0.35, 0, -4.5);
    this._daveTarget = new THREE.Vector3(0.55, 0, -4.3);
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
      this._loadCharacter(ALEX_PATH, 'Alex', 0x4a90d9, new THREE.Vector3(-0.35, 0, -4.5)),
      this._loadCharacter(DAVE_PATH, 'Dave', 0xe07b39, new THREE.Vector3(0.55, 0, -4.3)),
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

      // Apply authentic realistic PBR materials to character clothing, skin, and PPE
      this._applyCharacterMaterials(char, name);

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

      // Initial facing: Both characters look forward-left towards the Stop 1 Chemical Hazard
      anchor.rotation.y = (name === 'Dave') ? -0.3 : -0.35;
      anchor.position.copy(offset);
      anchor.visible = true;
      this.scene.add(anchor);

      // Play native Mixamo skeletal animations for characters if present
      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(char);
        const clip = gltf.animations[0];
        const action = mixer.clipAction(clip);
        action.setEffectiveWeight(1.0);
        action.play();
        if (name === 'Dave') {
          this._daveMixer = mixer;
          this._daveAction = action;
        } else if (name === 'Alex') {
          this._alexMixer = mixer;
          this._alexAction = action;
        }
      } else if (name === 'Alex') {
        // Fallback: Lower Alex's arms if static T-pose model without embedded animations
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

      // Cache bone hierarchy for skeletal animation & walking kinematics
      const bones = {};
      char.traverse((n) => {
        if (n.isBone) bones[n.name] = n;
      });
      if (name === 'Alex') this._alexBones = bones;
      if (name === 'Dave') this._daveBones = bones;

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
    this._daveTarget.set(pos.x + 1.1, pos.y, pos.z + 0.2);
    this._scriptedMoving = true;
  }

  /**
   * Applies gentle leg stride kinematics only during active translation.
   */
  _animateWalk(bones, walkTime, weight) {
    if (!bones || typeof bones !== 'object' || weight <= 0.001) return;
    const lUpLeg = bones['mixamorig1LeftUpLeg'] || bones['mixamorigLeftUpLeg'];
    const rUpLeg = bones['mixamorig1RightUpLeg'] || bones['mixamorigRightUpLeg'];
    const lLeg = bones['mixamorig1LeftLeg'] || bones['mixamorigLeftLeg'];
    const rLeg = bones['mixamorig1RightLeg'] || bones['mixamorigRightLeg'];

    if (lUpLeg && rUpLeg) {
      // Alternating leg swing during walking translation
      lUpLeg.rotation.x = Math.sin(walkTime) * 0.45 * weight;
      rUpLeg.rotation.x = -Math.sin(walkTime) * 0.45 * weight;
    }
    if (lLeg && rLeg) {
      // Natural knee lift
      lLeg.rotation.x = Math.max(0, -Math.sin(walkTime)) * 0.55 * weight;
      rLeg.rotation.x = Math.max(0, Math.sin(walkTime)) * 0.55 * weight;
    }
  }

  /**
   * Call every frame from the render loop.
   * @param {number} delta
   * @param {import('./CameraRig.js').CameraRig} [cameraRig]
   */
  update(delta, cameraRig) {
    if (!this._alexWalkTime) this._alexWalkTime = 0;
    if (!this._daveWalkTime) this._daveWalkTime = 0;
    if (!this._alexWalkWeight) this._alexWalkWeight = 0;
    if (!this._daveWalkWeight) this._daveWalkWeight = 0;

    // 1. Update native animation mixers
    this._alexMixer?.update(delta);
    this._daveMixer?.update(delta);

    // 2. Scripted Stop Transition & Hazard Action Movement
    if (this._scriptedMoving) {
      const dt = Math.min(0.1, delta);
      const moveAlpha = 1.0 - Math.exp(-4.5 * dt);

      if (this.alex) {
        const dx = this._alexTarget.x - this.alex.position.x;
        const dz = this._alexTarget.z - this.alex.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.08) {
          this.alex.position.lerp(this._alexTarget, moveAlpha);
          this.alex.rotation.y = Math.atan2(-dx, -dz);
          this._alexWalkTime += dt * 9.5;
          this._alexWalkWeight = Math.min(1.0, this._alexWalkWeight + dt * 5.0);
        } else {
          this.alex.position.copy(this._alexTarget);
          this._alexWalkWeight = Math.max(0.0, this._alexWalkWeight - dt * 6.0);
          if (this.alex.position.z > -9.0) {
            this.alex.rotation.y = -0.35; // Stop 1: look at chemical spill on floor
          } else if (this.alex.position.z > -19.0) {
            this.alex.rotation.y = -0.15; // Stop 2: look at blind forklift crossing
          } else if (this.alex.position.z > -28.0) {
            this.alex.rotation.y = 0.45;  // Stop 3: look at bent rack upright on right
          } else if (this.alex.position.z > -36.0) {
            this.alex.rotation.y = -1.15; // Stop 4: look directly at battery charging bay on left
          } else {
            this.alex.rotation.y = 0.0;   // Stop 5: look down clear dispatch dock
          }
        }
      }
      if (this.dave) {
        const ddx = this._daveTarget.x - this.dave.position.x;
        const ddz = this._daveTarget.z - this.dave.position.z;
        const ddist = Math.hypot(ddx, ddz);
        if (ddist > 0.08) {
          this.dave.position.lerp(this._daveTarget, moveAlpha);
          this.dave.rotation.y = Math.atan2(-ddx, -ddz);
          this._daveWalkTime += dt * 9.5;
          this._daveWalkWeight = Math.min(1.0, this._daveWalkWeight + dt * 5.0);
        } else {
          this.dave.position.copy(this._daveTarget);
          this._daveWalkWeight = Math.max(0.0, this._daveWalkWeight - dt * 6.0);
          if (this.dave.position.z > -9.0) {
            this.dave.rotation.y = -0.3;  // Stop 1: look at chemical spill & gesture
          } else if (this.dave.position.z > -19.0) {
            this.dave.rotation.y = -0.15; // Stop 2: look at blind forklift crossing
          } else if (this.dave.position.z > -28.0) {
            this.dave.rotation.y = 0.55;  // Stop 3: look at bent rack upright
          } else if (this.dave.position.z > -36.0) {
            this.dave.rotation.y = -1.15; // Stop 4: look directly at battery bay
          } else {
            this.dave.rotation.y = 0.0;   // Stop 5: look down dispatch dock
          }
        }
      }

      const alexDone = !this.alex || this.alex.position.distanceTo(this._alexTarget) <= 0.08;
      const daveDone = !this.dave || this.dave.position.distanceTo(this._daveTarget) <= 0.08;
      if (alexDone && daveDone) {
        this._scriptedMoving = false;
      }
    } else {
      this._alexWalkWeight = Math.max(0.0, this._alexWalkWeight - delta * 6.0);
      this._daveWalkWeight = Math.max(0.0, this._daveWalkWeight - delta * 6.0);
    }

    // 3. Apply leg strides only during active movement
    if (this._alexWalkWeight > 0.001) {
      this._animateWalk(this._alexBones, this._alexWalkTime, this._alexWalkWeight);
    }
    if (this._daveWalkWeight > 0.001) {
      this._animateWalk(this._daveBones, this._daveWalkTime, this._daveWalkWeight);
    }

    if (cameraRig && this.alex) {
      cameraRig.followTarget(this.alex.position);
    }
  }

  /**
   * Applies rich PBR materials to individual sub-meshes when Mixamo glTF lacks embedded diffuse maps.
   */
  _applyCharacterMaterials(char, name) {
    // Skin materials
    const alexSkinMat = new THREE.MeshStandardMaterial({
      color: 0xf3c5a8,
      roughness: 0.6,
      metalness: 0.05,
    });
    const daveSkinMat = new THREE.MeshStandardMaterial({
      color: 0xdf9c74,
      roughness: 0.65,
      metalness: 0.05,
    });

    // Clothing materials for Alex (Corporate Suit & Dress Shirt)
    const alexSuitMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Charcoal Navy
      roughness: 0.65,
      metalness: 0.1,
    });
    const alexShirtMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd, // Light Blue Dress Shirt
      roughness: 0.55,
      metalness: 0.05,
    });
    const alexPantsMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // Slate Grey Trousers
      roughness: 0.7,
      metalness: 0.05,
    });
    const alexShoesMat = new THREE.MeshStandardMaterial({
      color: 0x09090b, // Polished Black Leather Shoes
      roughness: 0.3,
      metalness: 0.3,
    });
    const alexBeltMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.4,
      metalness: 0.2,
    });

    // Clothing & PPE materials for Dave (Warehouse Supervisor)
    const daveHelmetMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // White Safety Hard Hat
      roughness: 0.25,
      metalness: 0.15,
    });
    const daveVestMat = new THREE.MeshStandardMaterial({
      color: 0xf97316, // Fluorescent Safety Orange
      roughness: 0.45,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.25,
    });
    const daveShirtMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a5f, // Industrial Dark Navy Work Shirt
      roughness: 0.75,
    });
    const davePantsMat = new THREE.MeshStandardMaterial({
      color: 0x45372b, // Heavy-Duty Distressed Canvas Work Pants
      roughness: 0.85,
    });
    const daveBootsMat = new THREE.MeshStandardMaterial({
      color: 0x854d0e, // Tan/Brown Leather Safety Boots
      roughness: 0.6,
      metalness: 0.1,
    });

    char.traverse((node) => {
      if (node.isMesh) {
        const meshName = node.name.toLowerCase();

        if (name === 'Alex') {
          if (meshName.includes('body')) {
            node.material = alexSkinMat;
          } else if (meshName.includes('suit')) {
            node.material = alexSuitMat;
          } else if (meshName.includes('shirt')) {
            node.material = alexShirtMat;
          } else if (meshName.includes('pants')) {
            node.material = alexPantsMat;
          } else if (meshName.includes('shoes')) {
            node.material = alexShoesMat;
          } else if (meshName.includes('belt')) {
            node.material = alexBeltMat;
          }
          // Note: hair & eyelashes have their own embedded textures preserved
        } else if (name === 'Dave') {
          if (meshName.includes('body')) {
            node.material = daveSkinMat;
          } else if (meshName.includes('helmet')) {
            node.material = daveHelmetMat;
          } else if (meshName.includes('vest')) {
            node.material = daveVestMat;
          } else if (meshName.includes('shirt')) {
            node.material = daveShirtMat;
          } else if (meshName.includes('pants')) {
            node.material = davePantsMat;
          } else if (meshName.includes('boots')) {
            node.material = daveBootsMat;
          }
        }
      }
    });
  }
}
