/**
 * CharacterController.js
 * Loads Alex and Dave as GLB characters (or procedural capsule stand-ins).
 * Manages their AnimationMixer and exposes moveTo() for positional transitions.
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
    this._clock = new THREE.Clock();

    /** @type {THREE.Object3D} */
    this.alex = null;
    /** @type {THREE.Object3D} */
    this.dave = null;

    this._alexMixer = null;
    this._daveMixer = null;
    this._alexAction = null;
    this._daveAction = null;

    // LERP target positions
    this._alexTarget = new THREE.Vector3();
    this._daveTarget = new THREE.Vector3();
    this._lerpSpeed = 2.0; // units/sec
    this._alexMoving = false;
    this._daveMoving = false;
  }

  async load() {
    const [alex, dave] = await Promise.all([
      this._loadCharacter(ALEX_PATH, 'Alex', 0x4a90d9, new THREE.Vector3(-0.6, 0, -4.5)),
      this._loadCharacter(DAVE_PATH, 'Dave', 0xe07b39, new THREE.Vector3(0.5, 0, -4.7)),
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
      char.name = name;
      char.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      // Wrap in an anchor group so transforms and lerps are clean
      const anchor = new THREE.Group();
      anchor.name = name;
      anchor.add(char);

      // ─── Auto-center pivot and normalize height to 1.78m ─────────
      const box = new THREE.Box3().setFromObject(char);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // Center horizontally and put feet at ground y=0
      char.position.set(-center.x, -box.min.y, -center.z);

      // Normalize scale if exported in non-meter units
      if (size.y > 0.1) {
        const targetHeight = 1.78;
        const scaleFactor = targetHeight / size.y;
        anchor.scale.set(scaleFactor, scaleFactor, scaleFactor);
      }

      // Characters face forward down the aisle (-Z)
      anchor.rotation.y = Math.PI;
      anchor.position.copy(offset);
      anchor.visible = true;
      this.scene.add(anchor);

      // Setup Animation Mixer on the character root
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

      console.info(`[CharacterController] Loaded and animated ${name}`);
      return anchor;
    } catch (err) {
      console.warn(`[CharacterController] ${path} load failed:`, err);
      return this._buildPlaceholder(name, fallbackColor, offset);
    }
  }

  _buildPlaceholder(name, color, offset) {
    const group = new THREE.Group();
    group.name = name;

    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });

    // Body (capsule approximated with cylinder + two spheres)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.0, 12), mat);
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat);
    head.position.y = 1.65;
    head.castShadow = true;
    group.add(head);

    // Name label (uses a simple sprite-like approach via canvas texture)
    const label = this._makeLabel(name);
    label.position.set(0, 2.1, 0);
    group.add(label);

    group.position.copy(offset);
    group.visible = true;
    this.scene.add(group);
    return group;
  }

  _makeLabel(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.roundRect(4, 4, 248, 56, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.0, 0.25, 1);
    return sprite;
  }

  /**
   * Move Alex to a world-space position.
   * @param {{x:number, y:number, z:number}} pos
   */
  moveAlex(pos) {
    if (!this.alex) return;
    this.alex.visible = true;
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
    const davePos = new THREE.Vector3(pos.x + 1.1, pos.y, pos.z - 0.2);
    this._daveTarget.copy(davePos);
    this._daveMoving = true;
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
   */
  update(delta) {
    // Update animation mixers
    this._alexMixer?.update(delta);
    this._daveMixer?.update(delta);

    // Apply natural arm resting posture
    this._relaxArms(this.alex);
    this._relaxArms(this.dave);

    // LERP positions
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
