/**
 * StopTransition.js
 * Subscribes to engine events and orchestrates all renderer movement
 * when the engine advances from one stop to the next.
 *
 * This is the sole bridge between the ScenarioEngine event bus
 * and the Three.js renderer modules — nothing else should wire them.
 */
import * as THREE from 'three';

export class StopTransition {
  /**
   * @param {object}             eventBus
   * @param {import('./CameraRig.js').CameraRig}             cameraRig
   * @param {import('./CharacterController.js').CharacterController} characters
   * @param {import('./WarehouseScene.js').WarehouseScene}   warehouse
   */
  constructor(eventBus, cameraRig, characters, warehouse) {
    this._bus = eventBus;
    this._rig = cameraRig;
    this._chars = characters;
    this._warehouse = warehouse;
    this._firstStop = true;

    this._wireEvents();
  }

  _wireEvents() {
    // Engine fires this when a new stop begins
    this._bus.on('stop:entered', ({ stop }) => {
      this._onStopEntered(stop);
    });

    // Engine fires this after a player action is resolved
    this._bus.on('action:resolved', ({ alexAction, alexTargetPosition }) => {
      this._onActionResolved(alexAction, alexTargetPosition);
    });
  }

  _onStopEntered(stop) {
    const startPos = stop.alexStartPosition;

    if (this._firstStop) {
      // Snap instantly on game start — no lerp slide from origin
      this._rig.snapTo(startPos);
      this._firstStop = false;
    } else {
      this._rig.moveTo(startPos);
    }

    this._chars.moveAlex(startPos);
    this._chars.moveDave(startPos);
  }

  _onActionResolved(alexAction, targetPos) {
    // Move Alex to his target position based on chosen action
    if (targetPos) {
      this._chars.moveAlex(targetPos);
    }

    // For cordon actions, tilt camera toward the hazard prop in the scene
    if (alexAction === 'cordon_area' && targetPos) {
      const hazardPt = new THREE.Vector3(targetPos.x, 1.0, targetPos.z);
      this._rig.inspect(hazardPt);
      // Return to patrol view after 2.5 seconds
      setTimeout(() => this._rig.exitInspect(), 2500);
    }
  }
}
