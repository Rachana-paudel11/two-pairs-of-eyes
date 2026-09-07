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
    if (stop.id === 'stop_03') {
      this._rig.setLookAngles(0.32, -0.12);
    } else if (stop.id === 'stop_04') {
      this._rig.setLookAngles(0.32, -0.04);
    } else if (stop.id === 'stop_05') {
      this._rig.setLookAngles(-0.18, -0.08);
    }
    this._chars.moveAlex(startPos);
    let daveOffset;
    if (stop.id === 'stop_03') {
      daveOffset = { x: startPos.x + 0.65, y: startPos.y, z: startPos.z + 0.40 };
    } else if (stop.id === 'stop_05') {
      daveOffset = { x: -0.35, y: startPos.y, z: startPos.z };
    } else {
      daveOffset = { x: startPos.x + 0.85, y: startPos.y, z: startPos.z + 0.25 };
    }
    this._chars.moveDave(daveOffset);
  }

  _onActionResolved(stopId, alexAction, targetPos) {
    if (alexAction === 'cordon_area' && targetPos) {
      this._warehouse.spawnCordonBarrier(stopId, targetPos);

      // Having just cordoned the hazard off, Alex must not be standing inside
      // his own cordon — that is the exact behaviour this stop teaches against.
      const standoff = this._warehouse.getCordonStandoff?.(stopId, targetPos);
      const faceAt = this._warehouse.getCordonCentre?.(stopId);
      const alexPos = standoff ?? targetPos;
      this._chars.moveAlex(alexPos, faceAt ?? null);
      this._chars.moveDave({ x: alexPos.x + 0.85, y: alexPos.y, z: alexPos.z + 0.25 }, faceAt ?? null);
    } else if (alexAction === 'isolate_equipment') {
      // Alex and Dave stay standing in the main aisle, looking directly at the battery charging bay
      if (this._chars.alex) {
        this._chars.alex.rotation.y = -1.15;
      }
      if (this._chars.dave) {
        this._chars.dave.rotation.y = -1.15;
      }
      if (typeof this._warehouse.isolateCharger === 'function') {
        this._warehouse.isolateCharger(stopId);
      }
    } else if (stopId === 'stop_02') {
      if (alexAction === 'hold_position' && targetPos) {
        // Alex and Dave wait behind the hold line while the forklift clears the lane,
        // then walk forward together across the zebra crossing safely into the next zone (Facility 03).
        setTimeout(() => {
          this._chars.moveAlex(targetPos);
          this._chars.moveDave({ x: targetPos.x + 0.65, y: targetPos.y, z: targetPos.z + 0.40 });
        }, 1000);
      } else if (alexAction === 'move_to_safety') {
        // Caution step forward near the line
        const cautiousPos = { x: 0.3, y: 0, z: -15.0 };
        this._chars.moveAlex(cautiousPos);
        this._chars.moveDave({ x: 0.95, y: 0, z: -14.75 });
      } else if (alexAction === 'follow_dave') {
        // Dangerous step into the junction
        const dangerPos = { x: 0.3, y: 0, z: -16.8 };
        this._chars.moveAlex(dangerPos);
        this._chars.moveDave({ x: 0.95, y: 0, z: -16.5 });
      }
    } else if (targetPos) {
      this._chars.moveAlex(targetPos);
      this._chars.moveDave({ x: targetPos.x + 0.85, y: targetPos.y, z: targetPos.z + 0.25 });
    }
  }
}
