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

const ALEX_MODEL_PATH = '/assets/models/characters/alex.glb'; // Alex: Trainee/Floor Worker in full PPE (Hardhat, Orange Safety Vest, Work Boots)
const DAVE_MODEL_PATH = '/assets/models/characters/dave.glb'; // Dave: Experienced Supervisor in smart warehouse jacket, collared shirt, trousers

const UP = new THREE.Vector3(0, 1, 0);

// ─── Walking ────────────────────────────────────────────────────────────────
// 1.8 m/s is an inspection walk. The leg swing in _animateWalk runs at a fixed
// 9.5 rad/s cadence which is not linked to speed, so a faster value makes the
// feet skate; this is the speed that cadence naturally sits at.
const WALK_SPEED = 1.8;
const TURN_RATE = 10.0;      // how quickly a walker rotates toward their heading

// Collision. Boxes are inflated by WALK_RADIUS so the per-frame test is a
// simple point-in-box check. The body band decides what counts as solid: below
// it is floor paint and spills, above it is archway lintels and roof trusses.
const WALK_RADIUS = 0.35;
const BODY_BAND_MIN = 0.25;
const BODY_BAND_MAX = 1.70;

// Backstop in case the hall has an open end; the walls themselves are blockers.
const HALL_X_MIN = -12.6;
const HALL_X_MAX = 12.6;
const HALL_Z_MIN = -46.0;
const HALL_Z_MAX = 7.0;

// Dave keeps pace at a conversational distance rather than glued to Alex.
const DAVE_FOLLOW_FAR = 2.2;   // starts closing the gap past this
const DAVE_FOLLOW_NEAR = 1.4;  // stops here, which is also his personal space

/** Ease an angle toward a target by the shortest way round. */
function turnToward(current, target, alpha) {
  let diff = target - current;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return current + diff * Math.min(1, alpha);
}

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

    // Movement targets: Alex (player trainee) on left, Dave (supervisor NPC) on right
    this._alexTarget = new THREE.Vector3(-0.35, 0, -4.5);
    this._daveTarget = new THREE.Vector3(0.55, 0, -4.3);
    this._scriptedMoving = false;
    this._alexFaceAt = null; // optional explicit facing target, see moveAlex()

    this._keys = { forward: false, backward: false, left: false, right: false };
    this._moveSpeed = WALK_SPEED;
    this._blockerCache = null;
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
      this._loadCharacter(ALEX_MODEL_PATH, 'Alex', 0x4a90d9, new THREE.Vector3(-0.35, 0, -4.5)),
      this._loadCharacter(DAVE_MODEL_PATH, 'Dave', 0xe07b39, new THREE.Vector3(0.55, 0, -4.3)),
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

  /**
   * @param {{x:number,y:number,z:number}} pos    where Alex walks to
   * @param {{x:number,z:number}|null}     faceAt optional point to turn towards
   *   on arrival. When omitted, the per-stop staging angles below still apply.
   */
  moveAlex(pos, faceAt = null) {
    if (!this.alex) return;
    this.alex.visible = true;
    this._alexTarget.set(pos.x, pos.y, pos.z);
    this._alexFaceAt = faceAt;
    this._scriptedMoving = true;
  }

  moveDave(pos, faceAt = null) {
    if (!this.dave) return;
    this.dave.visible = true;
    this._daveTarget.set(pos.x, pos.y ?? 0, pos.z);
    this._daveFaceAt = faceAt;
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
  /**
   * Solid geometry the characters cannot walk through, as 2D boxes in the XZ
   * plane. Collected once from the scene and cached.
   *
   * Only meshes whose vertical extent overlaps a body band are kept, which is
   * what makes this cheap and correct: floor paint and the spill sit below it,
   * and the archway lintels sit above it, so the openings stay walkable without
   * anyone having to tag them. Boxes are inflated by the walker's radius up
   * front, which turns the per-frame test into a point-in-box check.
   */
  _blockers() {
    if (this._blockerCache) return this._blockerCache;

    const boxes = [];
    const box = new THREE.Box3();
    this.scene.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      // Characters move; the cordon is deliberately walk-through so a trainee
      // is never trapped inside a perimeter they just placed.
      for (let p = o; p; p = p.parent) {
        if (p.name === 'Alex' || p.name === 'Dave' || (p.name || '').startsWith('Cordon_')) return;
      }
      box.setFromObject(o);
      if (!Number.isFinite(box.min.x)) return;
      if (box.max.y < BODY_BAND_MIN || box.min.y > BODY_BAND_MAX) return;
      boxes.push({
        x0: box.min.x - WALK_RADIUS, x1: box.max.x + WALK_RADIUS,
        z0: box.min.z - WALK_RADIUS, z1: box.max.z + WALK_RADIUS,
      });
    });

    this._blockerCache = boxes;
    return boxes;
  }

  /** True when a walker centred here is clear of every blocker. */
  _isFree(x, z) {
    const b = this._blockers();
    for (let i = 0; i < b.length; i++) {
      if (x > b[i].x0 && x < b[i].x1 && z > b[i].z0 && z < b[i].z1) return false;
    }
    return x > HALL_X_MIN && x < HALL_X_MAX && z > HALL_Z_MIN && z < HALL_Z_MAX;
  }

  /**
   * Slide a walker to a new position, resolving each axis separately so grazing
   * a wall slides along it instead of stopping dead.
   */
  _slide(obj, stepX, stepZ) {
    let moved = false;
    if (stepX && this._isFree(obj.position.x + stepX, obj.position.z)) { obj.position.x += stepX; moved = true; }
    if (stepZ && this._isFree(obj.position.x, obj.position.z + stepZ)) { obj.position.z += stepZ; moved = true; }
    return moved;
  }

  /** Camera-relative walk driven by the WASD / arrow flags. */
  _stepPlayer(dt, cameraRig) {
    const yaw = cameraRig ? cameraRig.yaw : 0;
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(UP, yaw);

    const dir = new THREE.Vector3();
    if (this._keys.forward) dir.add(forward);
    if (this._keys.backward) dir.sub(forward);
    if (this._keys.right) dir.add(right);
    if (this._keys.left) dir.sub(right);
    if (dir.lengthSq() < 1e-6) return;

    // Normalise so holding two keys is not 1.41x faster than one.
    dir.normalize();

    const step = this._moveSpeed * dt;
    const moved = this._slide(this.alex, dir.x * step, dir.z * step);

    // Turn toward the heading rather than snapping to it.
    const targetYaw = Math.atan2(-dir.x, -dir.z);
    this.alex.rotation.y = turnToward(this.alex.rotation.y, targetYaw, 1.0 - Math.exp(-TURN_RATE * dt));
    this._alexFaceAt = null;

    this._alexWalkTime += dt * 9.5;
    this._alexWalkWeight = moved
      ? Math.min(1.0, this._alexWalkWeight + dt * 5.0)
      : Math.max(0.0, this._alexWalkWeight - dt * 6.0);
  }

  /**
   * Dave walks the trainee round, so he keeps up rather than standing frozen.
   * He holds a conversational distance instead of glueing himself to Alex: he
   * only closes the gap once it opens past DAVE_FOLLOW_FAR, and stops again at
   * DAVE_FOLLOW_NEAR, which reads as walking with someone rather than tailing.
   */
  _followWithDave(dt) {
    if (!this.dave || !this.alex) return;

    const dx = this.alex.position.x - this.dave.position.x;
    const dz = this.alex.position.z - this.dave.position.z;
    const gap = Math.hypot(dx, dz);

    if (gap > DAVE_FOLLOW_FAR) {
      const step = Math.min(this._moveSpeed, this._moveSpeed * (gap / DAVE_FOLLOW_FAR)) * dt;
      const nx = (dx / gap) * step;
      const nz = (dz / gap) * step;
      // Never close inside Alex's personal space, so he cannot walk through him.
      if (gap - step > DAVE_FOLLOW_NEAR) {
        const moved = this._slide(this.dave, nx, nz);
        this._daveWalkTime += dt * 9.5;
        this._daveWalkWeight = moved
          ? Math.min(1.0, this._daveWalkWeight + dt * 5.0)
          : Math.max(0.0, this._daveWalkWeight - dt * 6.0);
      }
    } else {
      this._daveWalkWeight = Math.max(0.0, this._daveWalkWeight - dt * 6.0);
    }

    // Face roughly where Alex is facing, eased so he never snaps.
    this.dave.rotation.y = turnToward(this.dave.rotation.y, this.alex.rotation.y, 1.0 - Math.exp(-3.0 * dt));
  }

  update(delta, cameraRig) {
    if (!this._alexWalkTime) this._alexWalkTime = 0;
    if (!this._daveWalkTime) this._daveWalkTime = 0;
    if (!this._alexWalkWeight) this._alexWalkWeight = 0;
    if (!this._daveWalkWeight) this._daveWalkWeight = 0;

    // 1. Update native animation mixers
    this._alexMixer?.update(delta);
    this._daveMixer?.update(delta);

    // 2. Free player movement. Takes priority over the scripted walk so a stop
    //    transition never fights the player for control of Alex.
    const walking = this._keys.forward || this._keys.backward || this._keys.left || this._keys.right;
    if (walking && this.alex) {
      this._scriptedMoving = false;
      this._stepPlayer(Math.min(0.1, delta), cameraRig);
      this._followWithDave(Math.min(0.1, delta));
    } else if (this._scriptedMoving) {
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
            this.alex.rotation.y = -1.45; // Stop 3: look directly at bent rack upright & broken pallet on left
          } else if (this.alex.position.z > -36.0) {
            this.alex.rotation.y = -1.15; // Stop 4: look directly at battery charging bay on left
          } else {
            this.alex.rotation.y = -0.32; // Stop 5: look down central loading dock and dispatch bay
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
            this.dave.rotation.y = -1.35; // Stop 3: stand beside Alex looking at bent rack
          } else if (this.dave.position.z > -36.0) {
            this.dave.rotation.y = -1.15; // Stop 4: look directly at battery bay
          } else {
            this.dave.rotation.y = -0.28; // Stop 5: look down central loading dock and dispatch bay
          }
        }
      }

      const alexDone = !this.alex || this.alex.position.distanceTo(this._alexTarget) <= 0.08;
      const daveDone = !this.dave || this.dave.position.distanceTo(this._daveTarget) <= 0.08;
      if (alexDone && daveDone) {
        if (this.alex && this._alexFaceAt) {
          const dx = this._alexFaceAt.x - this.alex.position.x;
          const dz = this._alexFaceAt.z - this.alex.position.z;
          this.alex.rotation.y = Math.atan2(-dx, -dz);
        }
        if (this.dave && this._daveFaceAt) {
          const ddx = this._daveFaceAt.x - this.dave.position.x;
          const ddz = this._daveFaceAt.z - this.dave.position.z;
          this.dave.rotation.y = Math.atan2(-ddx, -ddz);
        }
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
   * Preserves authentic embedded textures on character models and ensures full warehouse styling.
   * Clones materials per submesh so distinct clothing and PPE elements render with rich PBR fidelity.
   */
  _applyCharacterMaterials(char, name) {
    char.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;

        if (Array.isArray(node.material)) {
          node.material = node.material.map((m) => m.clone());
        } else if (node.material) {
          node.material = node.material.clone();
        }

        const mats = Array.isArray(node.material) ? node.material : [node.material];
        const nodeName = (node.name || '').toLowerCase();

        mats.forEach((mat) => {
          const matName = (mat.name || '').toLowerCase();

          if (name === 'Dave') {
            // Dave: Experienced Warehouse Supervisor (Ch23 with Dark Navy Jacket, Blue Shirt, Charcoal Trousers, Shoes)
            if (!mat.map) {
              if (nodeName.includes('hair') || nodeName.includes('eyelashes') || matName.includes('hair')) {
                mat.color.setHex(0x18181b); // Natural Dark Hair
                mat.roughness = 0.8;
              } else if (nodeName.includes('shirt') || matName.includes('shirt')) {
                mat.color.setHex(0x0284c7); // Warehouse Blue Collared Shirt
                mat.roughness = 0.65;
              } else if (nodeName.includes('suit') || nodeName.includes('jacket') || matName.includes('jacket') || matName.includes('suit')) {
                mat.color.setHex(0x1e293b); // Dark Navy Warehouse Jacket
                mat.roughness = 0.65;
              } else if (nodeName.includes('pants') || matName.includes('pants')) {
                mat.color.setHex(0x334155); // Charcoal Work Trousers
                mat.roughness = 0.75;
              } else if (nodeName.includes('shoes') || nodeName.includes('boots') || matName.includes('shoes')) {
                mat.color.setHex(0x0f172a); // Black Leather Oxford Work Shoes
                mat.roughness = 0.7;
              } else if (nodeName.includes('belt') || matName.includes('belt')) {
                mat.color.setHex(0x1c1917); // Dark Leather Belt
                mat.roughness = 0.5;
              } else if (nodeName.includes('body') || nodeName.includes('head') || nodeName.includes('skin') || matName.includes('skin') || matName.includes('body')) {
                mat.color.setHex(0xdca888); // Natural Realistic Skin Tone
                mat.roughness = 0.55;
              } else {
                mat.color.setHex(0x1e293b);
                mat.roughness = 0.65;
              }
            } else {
              mat.map.colorSpace = THREE.SRGBColorSpace;
              mat.color.setHex(0xffffff);
            }
          } else if (name === 'Alex') {
            // Alex: Trainee/Floor Worker (Ch17 with White Hardhat, High-vis Orange Vest, Cargo Pants, Boots)
            if (!mat.map) {
              if (nodeName.includes('helmet') || matName.includes('helmet')) {
                mat.color.setHex(0xf8fafc); // Clean White Safety Hardhat
                mat.roughness = 0.25;
                mat.metalness = 0.1;
              } else if (nodeName.includes('vest') || matName.includes('vest')) {
                mat.color.setHex(0xf97316); // High-Vis Safety Orange Work Vest
                mat.roughness = 0.55;
                mat.metalness = 0.0;
              } else if (nodeName.includes('shirt') || matName.includes('shirt')) {
                mat.color.setHex(0x334155); // Charcoal / Dark Slate Under-Shirt
                mat.roughness = 0.7;
                mat.metalness = 0.0;
              } else if (nodeName.includes('pants') || matName.includes('pants')) {
                mat.color.setHex(0x1e293b); // Heavy-duty Dark Navy Work Pants
                mat.roughness = 0.8;
                mat.metalness = 0.0;
              } else if (nodeName.includes('boots') || nodeName.includes('shoes') || matName.includes('boots')) {
                mat.color.setHex(0x0f172a); // Steel-toe Black Work Boots
                mat.roughness = 0.7;
                mat.metalness = 0.1;
              } else if (nodeName.includes('hair') || nodeName.includes('eyelashes') || matName.includes('hair')) {
                mat.color.setHex(0x18181b); // Natural Dark Beard & Hair
                mat.roughness = 0.8;
                mat.metalness = 0.0;
              } else if (nodeName.includes('body') || nodeName.includes('head') || nodeName.includes('skin') || matName.includes('skin') || matName.includes('body')) {
                mat.color.setHex(0xdca888); // Natural Realistic Skin Tone
                mat.roughness = 0.55;
                mat.metalness = 0.0;
              } else {
                mat.color.setHex(0xf97316); // Default to safety orange for PPE
                mat.roughness = 0.55;
              }
            } else {
              mat.map.colorSpace = THREE.SRGBColorSpace;
              mat.color.setHex(0xffffff);
            }
          }
        });
      }
    });
  }
}
