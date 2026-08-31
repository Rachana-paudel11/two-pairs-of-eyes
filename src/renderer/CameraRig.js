/**
 * CameraRig.js
 * Third-Person Over-the-Shoulder Cinematic Camera Rig.
 * Frames Alex (Trainee) and Dave (Supervisor) in the foreground with a clear view into each distinct warehouse room.
 */
import * as THREE from 'three';

export const CAM_MODE = Object.freeze({
  PATROL: 'PATROL',
  INSPECT: 'INSPECT',
  OVERVIEW: 'OVERVIEW',
});

// Over-the-shoulder offset (behind and slightly above player Alex)
const THIRD_PERSON_OFFSET = new THREE.Vector3(-0.2, 2.05, 2.4);

export class CameraRig {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLCanvasElement} [canvas]
   */
  constructor(camera, canvas = document.getElementById('app')) {
    this.camera = camera;
    this.canvas = canvas;
    this.mode = CAM_MODE.PATROL;

    this._targetPosition = new THREE.Vector3();

    // Spherical look angles (radians)
    this._yaw = 0; // horizontal angle
    this._pitch = -0.14; // slight downward gaze to frame characters and floor hazard
    this._targetYaw = 0;
    this._targetPitch = -0.14;

    this._isDragging = false;
    this._prevPointer = { x: 0, y: 0 };
    this._lookSensitivity = 0.0032;

    this._lerpPos = 0.08;
    this._lerpLook = 0.14;

    this._setupInput();
  }

  _setupInput() {
    if (!this.canvas) return;

    const onPointerDown = (e) => {
      if (e.target !== this.canvas) return;
      this._isDragging = true;
      this._prevPointer.x = e.clientX;
      this._prevPointer.y = e.clientY;
      this.canvas.style.cursor = 'grabbing';
      this._hideLookHint();
    };

    const onPointerMove = (e) => {
      if (!this._isDragging || this.mode !== CAM_MODE.PATROL) return;
      const dx = e.clientX - this._prevPointer.x;
      const dy = e.clientY - this._prevPointer.y;
      this._prevPointer.x = e.clientX;
      this._prevPointer.y = e.clientY;

      this._targetYaw -= dx * this._lookSensitivity;
      this._targetPitch -= dy * this._lookSensitivity;

      // Clamp vertical pitch (approx ±60 degrees)
      const maxPitch = 1.05;
      this._targetPitch = Math.max(-maxPitch, Math.min(maxPitch, this._targetPitch));
    };

    const onPointerUp = () => {
      this._isDragging = false;
      if (this.canvas) this.canvas.style.cursor = 'grab';
    };

    this.canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    this.canvas.style.cursor = 'grab';
  }

  _hideLookHint() {
    const hint = document.getElementById('look-hint');
    if (hint) {
      hint.style.opacity = '0';
      setTimeout(() => hint.remove(), 600);
    }
  }

  /**
   * Instantly snap camera position on game start.
   * @param {{x:number, y:number, z:number}} pos
   */
  snapTo(pos) {
    this.camera.position.set(
      pos.x + THIRD_PERSON_OFFSET.x,
      pos.y + THIRD_PERSON_OFFSET.y,
      pos.z + THIRD_PERSON_OFFSET.z
    );
    this._targetPosition.copy(this.camera.position);
    this._yaw = 0;
    this._pitch = -0.14;
    this._targetYaw = 0;
    this._targetPitch = -0.14;
  }

  /**
   * Smoothly move camera to a stop position.
   * @param {{x:number, y:number, z:number}} pos
   */
  moveTo(pos) {
    this.mode = CAM_MODE.PATROL;
    this._targetPosition.set(
      pos.x + THIRD_PERSON_OFFSET.x,
      pos.y + THIRD_PERSON_OFFSET.y,
      pos.z + THIRD_PERSON_OFFSET.z
    );
    this._targetYaw = 0;
    this._targetPitch = -0.14;
  }

  /**
   * Keep camera synced behind Alex during WASD walking.
   * @param {THREE.Vector3} pos
   */
  followTarget(pos) {
    this._targetPosition.set(
      pos.x + THIRD_PERSON_OFFSET.x,
      pos.y + THIRD_PERSON_OFFSET.y,
      pos.z + THIRD_PERSON_OFFSET.z
    );
  }

  get yaw() {
    return this._yaw;
  }

  /**
   * Smoothly focus camera on a specific 3D hazard coordinate.
   * @param {THREE.Vector3} hazardPoint
   */
  inspect(hazardPoint) {
    this.mode = CAM_MODE.INSPECT;
    const dir = new THREE.Vector3().subVectors(hazardPoint, this.camera.position).normalize();
    this._targetYaw = Math.atan2(-dir.x, -dir.z);
    this._targetPitch = Math.asin(Math.max(-0.5, Math.min(0.5, dir.y)));
  }

  /** Return to normal patrol view. */
  exitInspect() {
    this.mode = CAM_MODE.PATROL;
    this._targetPitch = -0.14;
  }

  /**
   * Call every frame from the render loop.
   * @param {number} delta
   */
  update(delta) {
    // 1. Smoothly interpolate camera position
    this.camera.position.lerp(this._targetPosition, delta * 5.0);

    // 2. Smoothly interpolate yaw & pitch
    this._yaw += (this._targetYaw - this._yaw) * this._lerpLook;
    this._pitch += (this._targetPitch - this._pitch) * this._lerpLook;

    // 3. Compute look direction
    const cosPitch = Math.cos(this._pitch);
    const dir = new THREE.Vector3(
      -Math.sin(this._yaw) * cosPitch,
      Math.sin(this._pitch),
      -Math.cos(this._yaw) * cosPitch
    );

    const lookTarget = new THREE.Vector3().addVectors(this.camera.position, dir);
    this.camera.lookAt(lookTarget);
  }
}
