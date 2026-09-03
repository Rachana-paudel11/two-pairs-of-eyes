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
    if (this._warehouse && typeof this._warehouse.setActiveStop === 'function') {
      this._warehouse.setActiveStop(stop.id);
    }
    const startPos = stop.alexStartPosition;

    // Instantly place camera in the new room anchor behind Alex to prevent wall clipping
    this._rig.snapTo(startPos);
    if (stop.id === 'stop_04') {
      this._rig.setLookAngles(0.24, -0.06);
    }
    this._chars.moveAlex(startPos);
    this._chars.moveDave(startPos);
  }

  _onActionResolved(stopId, alexAction, targetPos) {
    if (alexAction === 'cordon_area' && targetPos) {
      this._warehouse.spawnCordonBarrier(stopId, targetPos);

      // Having just cordoned the hazard off, Alex must not be standing inside
      // his own cordon — that is the exact behaviour this stop teaches against.
      // The stand-off is derived from the cordon rather than read from the
      // scenario data, so it stays correct if the hazard or the cordon moves.
      // Stops still on the diamond fallback return null and keep the old move.
      const standoff = this._warehouse.getCordonStandoff?.(stopId, targetPos);
      const faceAt = this._warehouse.getCordonCentre?.(stopId);
      this._chars.moveAlex(standoff ?? targetPos, faceAt ?? null);
    } else if (alexAction === 'isolate_equipment') {
      if (targetPos) this._chars.moveAlex(targetPos);
      if (typeof this._warehouse.isolateCharger === 'function') {
        this._warehouse.isolateCharger(stopId);
      }
    } else if (targetPos) {
      this._chars.moveAlex(targetPos);
    }
  }
}
