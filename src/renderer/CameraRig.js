/**
 * CameraRig.js
 * Controls the player camera position and 360° look-at direction.
 *
 * Features:
 *  - 360° Mouse / Touch Drag Look Controls with smooth inertia
 *  - Clamped vertical pitch (prevents camera flipping)
 *  - Modes:
 *      * PATROL  : First-person camera at Alex's eye level with free 360° look
 *      * INSPECT : Focuses camera on a hazard point
 *      * OVERVIEW: Pulled back cinematic view for debrief
 *  - Subtle UI Drag Hint that fades on first interaction
 */
import * as THREE from 'three';

export const CAM_MODE = Object.freeze({
  PATROL: 'PATROL',
  INSPECT: 'INSPECT',
  OVERVIEW: 'OVERVIEW',
});

const THIRD_PERSON_OFFSET = new THREE.Vector3(0, 1.8, 1.8); // Close over-the-shoulder view

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

    // Spherical angles (radians)
    this._yaw = 0; // horizontal angle
    this._pitch = -0.15; // slight downward tilt to see characters and floor
    this._targetYaw = 0;
    this._targetPitch = -0.15;

    this._isDragging = false;
    this._prevPointer = { x: 0, y: 0 };
    this._lookSensitivity = 0.0035;

    this._lerpPos = 0.06;
    this._lerpLook = 0.12;

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

      // Clamp vertical pitch
      const maxPitch = 1.1;
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
    this.camera.position.set(pos.x + THIRD_PERSON_OFFSET.x, pos.y + THIRD_PERSON_OFFSET.y, pos.z + THIRD_PERSON_OFFSET.z);
    this._targetPosition.copy(this.camera.position);
    this._yaw = 0;
    this._pitch = -0.15;
    this._targetYaw = 0;
    this._targetPitch = -0.15;
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
    this._targetPitch = -0.15;
  }

  /**
   * Keep camera following moving character during WASD walking.
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
    this._targetPitch = Math.asin(dir.y);
  }

  /** Return to normal patrol view. */
  exitInspect() {
    this.mode = CAM_MODE.PATROL;
    this._targetYaw = 0;
    this._targetPitch = 0;
  }

  /**
   * Cinematic overview for debrief.
   * @param {{x:number, y:number, z:number}} center
   */
  overview(center) {
    this.mode = CAM_MODE.OVERVIEW;
    this._targetPosition.set(center.x, center.y + 5, center.z + 8);
    const dir = new THREE.Vector3().subVectors(new THREE.Vector3(center.x, center.y, center.z), this._targetPosition).normalize();
    this._targetYaw = Math.atan2(-dir.x, -dir.z);
    this._targetPitch = Math.asin(dir.y);
  }

  /**
   * Update called every frame.
   * @param {number} delta
   */
  update(delta) {
    // Lerp camera position
    this.camera.position.lerp(this._targetPosition, this._lerpPos + delta * 0.5);

    // Lerp yaw and pitch
    this._yaw += (this._targetYaw - this._yaw) * (this._lerpLook + delta * 0.5);
    this._pitch += (this._targetPitch - this._pitch) * (this._lerpLook + delta * 0.5);

    // Calculate look target vector in spherical coords
    const cosPitch = Math.cos(this._pitch);
    const lookDir = new THREE.Vector3(
      -Math.sin(this._yaw) * cosPitch,
      Math.sin(this._pitch),
      -Math.cos(this._yaw) * cosPitch
    );

    const targetLookAt = new THREE.Vector3().addVectors(this.camera.position, lookDir);
    this.camera.lookAt(targetLookAt);
  }
}
