/**
 * CameraRig.js
 * Controls the player camera position and look-at direction.
 *
 * Modes:
 *  - PATROL  : camera sits at Alex's shoulder (first-person offset)
 *  - INSPECT : camera tilts/zooms slightly toward a hazard point
 *  - OVERVIEW: slightly pulled back third-person for debrief
 */
import * as THREE from 'three';

export const CAM_MODE = Object.freeze({
  PATROL: 'PATROL',
  INSPECT: 'INSPECT',
  OVERVIEW: 'OVERVIEW',
});

const EYE_OFFSET = new THREE.Vector3(0, 1.65, 0.1); // eye height above feet

export class CameraRig {
  /**
   * @param {THREE.PerspectiveCamera} camera
   */
  constructor(camera) {
    this.camera = camera;
    this.mode = CAM_MODE.PATROL;

    this._targetPosition = new THREE.Vector3();
    this._targetLookAt = new THREE.Vector3();
    this._currentLookAt = new THREE.Vector3();

    this._lerpPos = 0.05;  // smooth camera translation
    this._lerpLook = 0.08; // smooth look-at interpolation
  }

  /**
   * Snap (without lerp) to a stop anchor position.
   * Called on the very first stop to avoid a long slide from origin.
   * @param {{x:number, y:number, z:number}} pos — alexStartPosition from stop data
   */
  snapTo(pos) {
    this.camera.position.set(pos.x + EYE_OFFSET.x, pos.y + EYE_OFFSET.y, pos.z + EYE_OFFSET.z);
    const look = new THREE.Vector3(pos.x, EYE_OFFSET.y, pos.z - 3);
    this.camera.lookAt(look);
    this._targetPosition.copy(this.camera.position);
    this._currentLookAt.copy(look);
    this._targetLookAt.copy(look);
  }

  /**
   * Smoothly move camera to a stop anchor position.
   * @param {{x:number, y:number, z:number}} pos
   */
  moveTo(pos) {
    this.mode = CAM_MODE.PATROL;
    this._targetPosition.set(
      pos.x + EYE_OFFSET.x,
      pos.y + EYE_OFFSET.y,
      pos.z + EYE_OFFSET.z
    );
    this._targetLookAt.set(pos.x, EYE_OFFSET.y, pos.z - 3);
  }

  /**
   * Tilt toward a world-space hazard point (inspect mode).
   * @param {THREE.Vector3} hazardPoint
   */
  inspect(hazardPoint) {
    this.mode = CAM_MODE.INSPECT;
    this._targetLookAt.copy(hazardPoint);
  }

  /** Return to patrol look-ahead. */
  exitInspect() {
    this.mode = CAM_MODE.PATROL;
    // Re-use last known target ahead
    const fwd = this._targetPosition.clone();
    fwd.z -= 3;
    this._targetLookAt.copy(fwd);
  }

  /**
   * Pull back for a cinematic overview (end of session).
   * @param {{x:number, y:number, z:number}} center
   */
  overview(center) {
    this.mode = CAM_MODE.OVERVIEW;
    this._targetPosition.set(center.x, center.y + 6, center.z + 10);
    this._targetLookAt.set(center.x, center.y, center.z);
  }

  /**
   * Called every frame.
   * @param {number} delta
   */
  update(delta) {
    // Lerp position
    this.camera.position.lerp(this._targetPosition, this._lerpPos + delta * 0.5);

    // Lerp look-at
    this._currentLookAt.lerp(this._targetLookAt, this._lerpLook + delta * 0.5);
    this.camera.lookAt(this._currentLookAt);
  }
}
