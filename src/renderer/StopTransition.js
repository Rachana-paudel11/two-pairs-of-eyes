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
    this._bus.on('action:resolved', ({ stopId, alexAction, alexTargetPosition }) => {
      this._onActionResolved(stopId, alexAction, alexTargetPosition);
    });
  }

  _onStopEntered(stop) {
    this._currentStop = stop;
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

  _onActionResolved(stopId, alexAction, targetPos) {
    // Move Alex to his target position based on chosen action
    if (alexAction === 'cordon_area' && targetPos) {
      // Alex stands safely in front of the cordon perimeter (not inside the hazard)
      const standingPos = { x: targetPos.x - 0.7, y: 0, z: targetPos.z - 1.2 };
      this._chars.moveAlex(standingPos);
      this._warehouse.spawnCordonBarrier(stopId, targetPos);
    } else if (targetPos) {
      this._chars.moveAlex(targetPos);
    }

    if (stopId === 'stop_02') {
      this._warehouse.clearForklift();
    }
  }
}
