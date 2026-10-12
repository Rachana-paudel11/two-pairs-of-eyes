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

// Over-the-shoulder third-person camera offset (Shifted right and pulled back so Alex frames the left, leaving Dave & corridor open)
const THIRD_PERSON_OFFSET = new THREE.Vector3(0.82, 2.25, 3.8);

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

    // Spherical look angles (radians) — slightly pitched down to frame floor & hazard
    this._yaw = 0.08;
    this._pitch = -0.15;
    this._targetYaw = 0.08;
    this._targetPitch = -0.15;

    this._isDragging = false;
    this._prevPointer = { x: 0, y: 0 };
    this._lookSensitivity = 0.0032;
    this._invertY = false;
    this._enabled = true;

    this._lerpPos = 0.08;
    this._lerpLook = 0.14;

    this._setupInput();
  }

  setSensitivity(value = 50, invertY = false) {
    const factor = 0.25 + (Math.max(0, Math.min(100, Number(value) || 50)) / 100) * 1.75;
    this._lookSensitivity = 0.0032 * factor;
    this._invertY = Boolean(invertY);
  }

  setControlsEnabled(enabled) {
    this._enabled = Boolean(enabled);
    if (!this._enabled) {
      this._isDragging = false;
      if (this.canvas) this.canvas.style.cursor = 'default';
    }
  }

  _setupInput() {
    if (!this.canvas) return;

    const onPointerDown = (e) => {
      if (!this._enabled || e.target !== this.canvas) return;
      this._isDragging = true;
      this._prevPointer.x = e.clientX;
      this._prevPointer.y = e.clientY;
      this.canvas.style.cursor = 'grabbing';
    };

    const onPointerMove = (e) => {
      if (!this._enabled || !this._isDragging || this.mode !== CAM_MODE.PATROL) return;

      const dx = e.clientX - this._prevPointer.x;
      const dy = e.clientY - this._prevPointer.y;
      this._prevPointer.x = e.clientX;
      this._prevPointer.y = e.clientY;

      this._targetYaw -= dx * this._lookSensitivity;
      const yDelta = dy * this._lookSensitivity * (this._invertY ? -1 : 1);
      this._targetPitch += yDelta;

      // Clamp vertical pitch to realistic human eye-level bounds (no ceiling/floor flipping)
      const minPitch = -0.32;
      const maxPitch = 0.18;
      this._targetPitch = Math.max(minPitch, Math.min(maxPitch, this._targetPitch));
    };

    const onPointerUp = () => {
      this._isDragging = false;
      if (this.canvas) {
        this.canvas.style.cursor = 'default';
      }
    };

    this.canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    this.canvas.style.cursor = 'default';
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
    // Deliberately does NOT reset yaw/pitch. This used to slam the look angles
    // back to defaults on every stop entry, throwing away wherever the player
    // had aimed the mouse.
  }

  /**
   * Set spherical look angles, optionally easing smoothly.
   * @param {number} yaw
   * @param {number} [pitch]
   * @param {boolean} [instant=false]
   */
  setLookAngles(yaw, pitch, instant = false) {
    this._targetYaw = yaw;
    if (pitch !== undefined) {
      this._targetPitch = pitch;
    }
    if (instant) {
      this._yaw = yaw;
      if (pitch !== undefined) {
        this._pitch = pitch;
      }
    }
  }

  /**
   * Smoothly ease look angles to target orientation without snapping.
   * @param {number} yaw
   * @param {number} [pitch]
   */
  easeLookAngles(yaw, pitch) {
    this.setLookAngles(yaw, pitch, false);
  }

  /**
   * Smoothly move camera to a stop position.
   * @param {{x:number, y:number, z:number}} pos
   * @param {number} [targetYaw=0.08]
   * @param {number} [targetPitch=-0.15]
   */
  moveTo(pos, targetYaw = 0.08, targetPitch = -0.15) {
    this.mode = CAM_MODE.PATROL;
    this._targetPosition.set(
      pos.x + THIRD_PERSON_OFFSET.x,
      pos.y + THIRD_PERSON_OFFSET.y,
      pos.z + THIRD_PERSON_OFFSET.z
    );
    this._targetYaw = targetYaw;
    this._targetPitch = targetPitch;
  }

  /**
   * Keep camera synced behind Alex during WASD walking.
   * @param {THREE.Vector3} pos
   */
  followTarget(pos) {
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) return;
    if (this.mode !== CAM_MODE.PATROL) return;

    // Track Alex directly — his position is already walkway-clamped by
    // CharacterController, so no extra X clamp is needed here.
    // The old Math.max(0.3, ...) forced the camera right even when Alex
    // stood at left-side stops (e.g. Stop 03 x=-0.90), breaking framing.
    this._targetPosition.set(
      pos.x + THIRD_PERSON_OFFSET.x,
      pos.y + THIRD_PERSON_OFFSET.y,
      pos.z + THIRD_PERSON_OFFSET.z
    );
  }

  /** Smoothed (lerped) yaw — use for rendering. */
  get yaw() {
    return this._yaw;
  }

  /**
   * Instant (un-smoothed) yaw — use for movement direction so WASD
   * responds to the mouse the same frame it moves, not one frame later.
   */
  get targetYaw() {
    return this._targetYaw;
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

  /**
   * Smoothly zoom and focus camera onto a target object from a specified camera vantage position.
   * @param {THREE.Vector3|{x:number, y:number, z:number}} targetPoint
   * @param {THREE.Vector3|{x:number, y:number, z:number}} [cameraPos]
   */
  focusOnPoint(targetPoint, cameraPos) {
    this.mode = CAM_MODE.INSPECT;
    if (cameraPos) {
      this._targetPosition.set(cameraPos.x, cameraPos.y, cameraPos.z);
    }
    const camPos = cameraPos ?? this.camera.position;
    const dir = new THREE.Vector3().subVectors(
      new THREE.Vector3(targetPoint.x, targetPoint.y, targetPoint.z),
      new THREE.Vector3(camPos.x, camPos.y, camPos.z)
    ).normalize();
    this._targetYaw = Math.atan2(-dir.x, -dir.z);
    this._targetPitch = Math.asin(Math.max(-0.5, Math.min(0.5, dir.y)));
  }

  /** Return to normal patrol view. */
  exitInspect(targetYaw = 0.08, targetPitch = -0.14) {
    this.mode = CAM_MODE.PATROL;
    this._targetYaw = targetYaw;
    this._targetPitch = targetPitch;
  }

  /**
   * Call every frame from the render loop.
   * @param {number} delta
   */
  update(delta) {
    // Clamp delta to prevent simulation spikes
    const dt = Math.min(0.1, delta);

    // 1. Unconditionally stable exponential smoothing
    const posAlpha = 1.0 - Math.exp(-8.0 * dt);
    this.camera.position.lerp(this._targetPosition, posAlpha);

    // 2. Smoothly interpolate yaw & pitch (shortest angular path)
    const lookAlpha = 1.0 - Math.exp(-12.0 * dt);
    let diffYaw = this._targetYaw - this._yaw;
    while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
    while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
    this._yaw += diffYaw * lookAlpha;
    this._pitch += (this._targetPitch - this._pitch) * lookAlpha;

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
