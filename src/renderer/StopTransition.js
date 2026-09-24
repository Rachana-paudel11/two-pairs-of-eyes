/**
 * StopTransition.js
 * Subscribes to engine events and orchestrates all renderer movement
 * when the engine advances from one stop to the next.
 *
 * This is the sole bridge between the ScenarioEngine event bus
 * and the Three.js renderer modules — nothing else should wire them.
 *
 * Choreography rule: every delayed phase goes through _after(). Each stop bumps
 * a generation counter, so a phase scheduled during stop N is discarded if it
 * comes due after the player has already moved on. Raw setTimeout here let stale
 * phases from the previous stop re-aim characters mid-scene, which is what made
 * per-stop tuning feel like whack-a-mole.
 */
import * as THREE from 'three';
import { playWarningBuzzer } from '../utils/audio.js';

/**
 * Per-stop staging. One row per stop, so tuning a stop is a single edit here
 * rather than a new branch in the middle of the choreography.
 *
 * camera     — explicit camera look angles [yaw, pitch]; omitted stops keep theirs.
 * scanTarget — where both characters look when the stop has no hazard anchor.
 */
const STOP_STAGING = {
  stop_03: { camera: [0.32, -0.12] },
  stop_04: { camera: [0.92, -0.07] },
  stop_05: { camera: [-0.18, -0.08], scanTarget: { x: 0, y: 0, z: -50.0 } },
};

/** Dave's body language is driven by the stop's supervisor behaviour. */
const GESTURE_FOR_BEHAVIOUR = {
  dismissive: 'dismiss',
  uncertain: 'shrug',
  correct: 'point',
};

// Phase timings, measured from the moment BOTH characters finish walking in.
//
// The engine fires stop:entered, dialogue:line and actions:available in the same
// tick, but the walk between stops covers ~9m and takes several seconds. Timing
// these beats from the event meant the talking beat played while they were still
// sliding into position, and how much you saw depended on the walk distance --
// which is why each stop needed its own hand-tuned numbers.
const DIALOGUE_FACE_DELAY = 300;    // beat after arrival, then they turn to talk
const DIALOGUE_GESTURE_DELAY = 700;
// Dave's gestures run 2.0-3.3s, so hold the talking beat long enough for the
// longest of them to finish before both turn to inspect the hazard.
const INSPECT_DELAY = 3800;
const DAVE_LOOK_AWAY_DISMISSIVE = 1200;
const DAVE_LOOK_AWAY_UNCERTAIN = 1400;

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
    this._currentStopId = null;
    this._currentStop = null;

    this._seq = 0;              // bumped on every stop change
    this._timers = new Set();

    this._wireEvents();
  }

  /**
   * Schedule a phase belonging to the current stop. If the stop changes before
   * it fires, it is dropped rather than re-aiming the new scene.
   */
  _after(ms, fn) {
    const seq = this._seq;
    const id = setTimeout(() => {
      this._timers.delete(id);
      if (seq !== this._seq) return;
      fn();
    }, ms);
    this._timers.add(id);
    return id;
  }

  /**
   * Schedule a phase that should play once the characters have walked in.
   * Falls back to a plain delay if the controller predates the settle API.
   */
  _afterSettled(ms, fn) {
    const seq = this._seq;
    const run = () => {
      if (seq !== this._seq) return;
      this._after(ms, fn);
    };
    if (typeof this._chars.whenSettled === 'function') this._chars.whenSettled(run);
    else this._after(ms, fn);
  }

  _cancelPending() {
    for (const id of this._timers) clearTimeout(id);
    this._timers.clear();
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

    // Dave speaks → Alex turns to face Dave, Dave turns to face Alex
    this._bus.on('dialogue:line', ({ behaviour }) => {
      this._onDaveDialogue(behaviour);
    });

    // Action menu appears → Alex turns to inspect the hazard
    this._bus.on('actions:available', ({ stopId }) => {
      this._onActionsAvailable(stopId);
    });
  }

  _onStopEntered(stop) {
    // Anything still pending belongs to the stop we are leaving.
    this._seq++;
    this._cancelPending();
    const startPos = stop.alexStartPosition;
    const hazardPos = this._warehouse.getHazardAnchor(stop.id);
    const staging = STOP_STAGING[stop.id];
    const travelYaw = staging && staging.camera ? staging.camera[0] : 0.08;

    if (this._rig && typeof this._rig.exitInspect === 'function') {
      this._rig.exitInspect(travelYaw, -0.14);
    }
    if (this._rig && typeof this._rig.setLookAngles === 'function') {
      this._rig.setLookAngles(travelYaw, -0.14);
    }
    if (typeof this._chars.cancelPendingActions === 'function') {
      // A long clip queued at the previous stop (Alex's report runs 23s) must not
      // surface here after the walk completes.
      this._chars.cancelPendingActions();
    }

    this._currentStop = stop;
    if (this._warehouse && typeof this._warehouse.setActiveStop === 'function') {
      this._warehouse.setActiveStop(stop.id);
    }
    this._currentStopId = stop.id;

    const isFirstStop = this._firstStop;
    this._firstStop = false;

    if (isFirstStop) {
      // Opening shot: there is nowhere to walk from, so place everyone and frame
      // the scene directly.
      this._rig.snapTo(startPos);
      if (typeof this._chars.setPositionAlex === 'function') this._chars.setPositionAlex(startPos, hazardPos || null);
      else this._chars.moveAlex(startPos, hazardPos || null);

      if (typeof this._chars.setPositionDave === 'function') this._chars.setPositionDave(startPos, hazardPos);
      else this._chars.moveDave(startPos, hazardPos);
    } else {
      // Every stop-to-stop gap is 8-9.8m, so this is the journey: both characters
      // walk it and the camera follows them there.
      const waypoints = [];
      // When departing Stop 01 towards Stop 02, route via safe right-hand walkway
      // (x = 0.25) to cleanly bypass the Stop 01 hazard/cordon footprint (z = -6.45)
      if (stop.id === 'stop_02') {
        waypoints.push({ x: 0.25, y: 0, z: -7.2 });
      } else if (stop.id === 'stop_05') {
        // When departing Stop 04 towards Stop 05, Alex and Dave may have moved
        // to the left-wall battery disconnect console (-5.30, 0, -30.4).
        // Route them smoothly back into the central walkway (x = 0.0, z = -32.5)
        // so they do not clip walls or teleport.
        waypoints.push({ x: 0.0, y: 0, z: -32.5 });
      }

      const isLeavingStop4 = (stop.id === 'stop_05');
      this._chars.moveAlex(startPos, hazardPos || null, waypoints, isLeavingStop4);
      this._chars.moveDave(startPos, hazardPos, waypoints, isLeavingStop4);
    }

    // The per-stop framing belongs to the arrival, not the departure -- applying
    // it up front would swing the camera off the walk and override the player's
    // mouse look for the whole journey.
    if (staging && staging.camera) {
      this._afterSettled(0, () => this._rig.setLookAngles(staging.camera[0], staging.camera[1]));
    }
  }

  /**
   * PHASE 1: Dialogue delivery — Dave and Alex face each other while he talks.
   */
  _onDaveDialogue(behaviour) {
    this._afterSettled(DIALOGUE_FACE_DELAY, () => {
      if (this._chars.lookAlexAtDave) this._chars.lookAlexAtDave();
      if (this._chars.lookDaveAtAlex) this._chars.lookDaveAtAlex();
    });

    const gesture = GESTURE_FOR_BEHAVIOUR[behaviour];
    if (gesture && this._chars.playDaveGesture) {
      this._afterSettled(DIALOGUE_GESTURE_DELAY, () => this._chars.playDaveGesture(gesture));
    }
  }

  /**
   * PHASE 2: Post-dialogue hazard inspection — driven by the hazard anchor and
   * the supervisor's behaviour for this stop.
   */
  _onActionsAvailable(stopId) {
    const hazardPos = this._warehouse.getHazardAnchor(stopId);
    const behaviour = this._currentStop && this._currentStop.supervisor
      ? this._currentStop.supervisor.behaviour
      : null;
    const staging = STOP_STAGING[stopId];

    this._afterSettled(INSPECT_DELAY, () => {
      if (!hazardPos) {
        // No hazard anchor (stop 5): both scan the aisle ahead instead.
        const scan = staging && staging.scanTarget;
        if (!scan) return;
        const scanTarget = new THREE.Vector3(scan.x, scan.y, scan.z);
        if (this._chars.lookAlexAtPosition) this._chars.lookAlexAtPosition(scanTarget);
        if (this._chars.lookDaveAtPosition) this._chars.lookDaveAtPosition(scanTarget);
        return;
      }

      // Alex always inspects the hazard; only Dave's follow-through varies.
      if (this._chars.lookAlexAtPosition) this._chars.lookAlexAtPosition(hazardPos);
      if (this._chars.lookDaveAtPosition) this._chars.lookDaveAtPosition(hazardPos);

      if (behaviour === 'dismissive') {
        // Glances at it, then turns away — he has stopped seeing the hazard.
        this._after(DAVE_LOOK_AWAY_DISMISSIVE, () => {
          if (this._chars.lookDaveAtAlex) this._chars.lookDaveAtAlex();
        });
      } else if (behaviour === 'uncertain') {
        // Looks over, then back to Alex for reassurance.
        this._after(DAVE_LOOK_AWAY_UNCERTAIN, () => {
          if (this._chars.lookDaveAtAlex) this._chars.lookDaveAtAlex();
        });
      }
      // 'correct': Dave stays on the hazard, so there is nothing further to do.
    });
  }

  _onActionResolved(stopId, alexAction, targetPos) {
    // Resolving an action supersedes the observation choreography: a pending
    // "look at the hazard" beat must not re-aim them after they have acted.
    this._seq++;
    this._cancelPending();

    const hazardPos = this._warehouse.getHazardAnchor(stopId);

    if (stopId === 'stop_01') {
      if (alexAction === 'cordon_area' && targetPos) {
        this._warehouse.spawnCordonBarrier(stopId, targetPos);
        if (typeof this._chars.invalidateBlockers === 'function') {
          this._chars.invalidateBlockers();
        }
      }

      // Professional interpersonal staging: keep them comfortably separated (1.4m)
      // on the safe right-hand walkway, directly facing each other for discussion.
      const alexPos = new THREE.Vector3(0.20, 0, -5.5);
      const davePos = new THREE.Vector3(0.20, 0, -4.1);

      this._chars.moveAlex(alexPos, davePos);
      if (typeof this._chars.moveDaveTo === 'function') {
        this._chars.moveDaveTo(davePos, alexPos);
      } else {
        this._chars.moveDave(davePos, alexPos);
      }

      this._afterSettled(150, () => {
        if (this._chars.lookAlexAtPosition) this._chars.lookAlexAtPosition(davePos);
        if (this._chars.lookDaveAtPosition) this._chars.lookDaveAtPosition(alexPos);
      });

      if (alexAction === 'cordon_area' && this._chars.playAlexAction) {
        // Cap at 1.0s: only the clean arm-reach phase of place.fbx, before the forward lean.
        this._afterSettled(DIALOGUE_GESTURE_DELAY, () => this._chars.playAlexAction('place', 1.0));
      }
    } else if (stopId === 'stop_03') {
      // ── Stop 03 Structural Rack Damage Choreography ─────────────────────────
      if (alexAction === 'cordon_area') {
        // Option 1: Cordon Off — Alex places cones right in front of the damaged column; Dave stays close
        this._warehouse.spawnCordonBarrier(stopId, targetPos);
        if (typeof this._chars.invalidateBlockers === 'function') {
          this._chars.invalidateBlockers();
        }

        const alexPos = new THREE.Vector3(-0.65, 0, -22.50);
        const faceAt = hazardPos || new THREE.Vector3(-2.30, 0.6, -22.00);
        const daveStandoffPos = new THREE.Vector3(0.15, 0, -22.30);

        this._chars.moveAlex(alexPos, faceAt);
        if (typeof this._chars.moveDaveTo === 'function') {
          this._chars.moveDaveTo(daveStandoffPos, alexPos);
        } else {
          this._chars.moveDave(daveStandoffPos, alexPos);
        }

        this._afterSettled(DIALOGUE_GESTURE_DELAY, () => {
          if (this._chars.playAlexAction) {
            this._chars.playAlexAction('place', 1.0);
          }
        });
        this._afterSettled(DIALOGUE_GESTURE_DELAY + 900, () => {
          if (this._chars.lookDaveAtPosition) this._chars.lookDaveAtPosition(alexPos);
          if (this._chars.playDaveGesture) this._chars.playDaveGesture('nod');
          if (this._chars.lookAlexAtPosition) this._chars.lookAlexAtPosition(daveStandoffPos);
        });
      } else if (alexAction === 'move_to_safety') {
        // Option 2: Report Only — Alex takes a slight half-step back to log defect without wandering off
        const safeReportPos = new THREE.Vector3(-0.60, 0, -22.65);
        const daveWatchPos = new THREE.Vector3(0.15, 0, -22.35);

        this._chars.moveAlex(safeReportPos, hazardPos || null);
        if (typeof this._chars.moveDaveTo === 'function') {
          this._chars.moveDaveTo(daveWatchPos, hazardPos || null);
        } else {
          this._chars.moveDave(daveWatchPos, hazardPos || null);
        }

        this._afterSettled(DIALOGUE_GESTURE_DELAY, () => {
          if (this._chars.playAlexAction) {
            this._chars.playAlexAction('report', 1.4);
          }
        });
        this._afterSettled(DIALOGUE_GESTURE_DELAY + 400, () => {
          if (this._chars.playDaveGesture) {
            this._chars.playDaveGesture('nod');
          }
        });
      } else if (alexAction === 'follow_dave') {
        // Option 3: Ignore — Dave takes a brief step forward past the column, Alex follows close behind
        const daveLeadPos = new THREE.Vector3(0.00, 0, -23.40);
        const alexFollowPos = new THREE.Vector3(-0.55, 0, -23.00);

        if (typeof this._chars.moveDaveTo === 'function') {
          this._chars.moveDaveTo(daveLeadPos, { x: 0.00, y: 0, z: -28.0 });
        } else {
          this._chars.moveDave(daveLeadPos, { x: 0.00, y: 0, z: -28.0 });
        }
        this._chars.moveAlex(alexFollowPos, daveLeadPos);

        this._afterSettled(DIALOGUE_GESTURE_DELAY, () => {
          if (this._chars.playDaveGesture) {
            this._chars.playDaveGesture('dismiss');
          }
        });
      }
    } else if (alexAction === 'cordon_area' && targetPos) {
      this._warehouse.spawnCordonBarrier(stopId, targetPos);
      if (typeof this._chars.invalidateBlockers === 'function') {
        this._chars.invalidateBlockers();
      }

      // Having just cordoned the hazard off, Alex must not be standing inside
      // his own cordon — that is the exact behaviour this stop teaches against.
      const standoff = this._warehouse.getCordonStandoff
        ? this._warehouse.getCordonStandoff(stopId, targetPos)
        : null;
      const faceAt = this._warehouse.getCordonCentre
        ? this._warehouse.getCordonCentre(stopId)
        : null;
      const alexPos = standoff || targetPos;
      this._chars.moveAlex(alexPos, faceAt || null);
      this._chars.moveDave(alexPos, faceAt || null);

      if (this._chars.playAlexAction) {
        // Cap at 1.0s: only the clean arm-reach phase of place.fbx, before the forward lean.
        this._afterSettled(DIALOGUE_GESTURE_DELAY, () => this._chars.playAlexAction('place', 1.0));
      }
    } else if (alexAction === 'isolate_equipment') {
      // ── Stop 04 Isolation Choreography ──────────────────────────────────────
      // VISIBILITY FIX: Camera must be placed INSIDE Room 4 (past the z = -28.5 firewall)
      // looking back towards the left wall (-5.8, 1.65, -30.4). This completely avoids
      // the Room 3 pallet rack and gives a wide, unobstructed cinematic view of the button press.
      //
      // Positions:
      //   consolePos  — Alex stands directly in front of the wall-mounted disconnect box
      //   daveWatchPos — Dave holds back in the charging bay aisle, watching
      //   cameraVantage — Wide angle inside Room 4 (x: -0.6, y: 1.85, z: -33.6) looking at the panel

      const consolePos  = new THREE.Vector3(-5.30, 0, -30.4); // Natural arm's reach from disconnect box
      const daveWatchPos = new THREE.Vector3(-2.80, 0, -30.0); // Aisle observation position
      const consoleFaceAt = new THREE.Vector3(-5.8, 1.60, -30.4); // The emergency stop button & switch itself

      // Alex walks alertly to the console (unconstrained — exits the central walkway bounds at brisk pace)
      if (typeof this._chars.moveAlex === 'function') {
        this._chars.moveAlex(consolePos, consoleFaceAt, [], true, 1.65);
      }
      // Dave moves to the aisle watch-point and looks at the console
      if (typeof this._chars.moveDaveTo === 'function') {
        this._chars.moveDaveTo(daveWatchPos, consoleFaceAt, [], true);
      } else if (typeof this._chars.moveDave === 'function') {
        this._chars.moveDave(daveWatchPos, consoleFaceAt, [], true);
      }

      // Smoothly frame the isolation scene from INSIDE Room 4:
      // Completely avoids the Room 3 pallet racks and frames Alex, the switch, and the forklift.
      const cameraVantage = new THREE.Vector3(-0.6, 1.85, -33.6);
      if (typeof this._rig.focusOnPoint === 'function') {
        this._rig.focusOnPoint(new THREE.Vector3(-5.6, 1.60, -30.4), cameraVantage);
      } else {
        this._rig.setLookAngles(1.15, -0.06);
      }

      // Once Alex has walked across and settled directly at the disconnect console:
      // Alex physically reaches out and presses the emergency disconnect switch.
      // At contact, the switch depresses inward, the lever flips, the screen locks out,
      // the LOTO padlock attaches, followed by Dave's supervisory nod and the outcome card.
      this._afterSettled(300, () => {
        if (typeof this._chars.pressDisconnectButton === 'function') {
          this._chars.pressDisconnectButton(
            // Contact callback: hand hits button
            () => {
              if (typeof this._warehouse.isolateCharger === 'function') {
                this._warehouse.isolateCharger(stopId);
              }
              // Notify UI that the physical isolation has occurred
              if (this._bus) {
                this._bus.emit('stop04:isolated');
              }
            },
            // Finish callback: arm returns to idle
            () => {
              if (this._chars.lookDaveAtPosition) this._chars.lookDaveAtPosition(consolePos);
              if (this._chars.playDaveGesture) this._chars.playDaveGesture('nod');
              if (this._chars.lookAlexAtPosition) this._chars.lookAlexAtPosition(daveWatchPos);

              // Maintain clean debrief staging together in the charging bay while outcome card is viewed.
              // Camera frames both characters in a comfortable medium two-shot:
              const safeRoom4Vantage = new THREE.Vector3(-0.80, 1.95, -32.8);
              const sceneFocusTarget = new THREE.Vector3(-3.90, 1.50, -30.2);

              if (this._rig && typeof this._rig.focusOnPoint === 'function') {
                this._rig.focusOnPoint(sceneFocusTarget, safeRoom4Vantage);
              }
            }
          );
        } else {
          if (typeof this._warehouse.isolateCharger === 'function') {
            this._warehouse.isolateCharger(stopId);
          }
          if (this._bus) {
            this._bus.emit('stop04:isolated');
          }
          if (this._chars.lookDaveAtPosition) this._chars.lookDaveAtPosition(consolePos);
          if (this._chars.lookAlexAtPosition) this._chars.lookAlexAtPosition(daveWatchPos);
        }
      });
    } else if (stopId === 'stop_02') {
      if (alexAction === 'hold_position') {
        // Option 1: Stop and Wait — Forklift accelerates across the crossing and clears the lane permanently.
        // Alex and Dave hold position safely behind the yellow line watching the clear.
        if (typeof this._warehouse.clearForkliftCrossing === 'function') {
          this._warehouse.clearForkliftCrossing();
        }
        // After 2.0s when forklift clears, Dave and Alex face each other in agreement
        this._after(2000, () => {
          if (this._chars.lookDaveAtAlex) this._chars.lookDaveAtAlex();
          if (this._chars.lookAlexAtDave) this._chars.lookAlexAtDave();
          if (this._chars.playDaveGesture) this._chars.playDaveGesture('talk');
        });
      } else if (alexAction === 'move_to_safety') {
        // Option 2: Wave and Cross — Caution step near line; Alex signals driver, forklift clears
        const cautiousPos = { x: 0.25, y: 0, z: -13.6 };
        const daveCautiousPos = { x: -0.35, y: 0, z: -13.6 };

        this._chars.moveAlex(cautiousPos, hazardPos || null);
        if (typeof this._chars.moveDaveTo === 'function') {
          this._chars.moveDaveTo(daveCautiousPos, hazardPos || null);
        } else {
          this._chars.moveDave(daveCautiousPos, hazardPos || null);
        }

        // Alex raises arm to signal/wave at the oncoming vehicle
        this._afterSettled(DIALOGUE_GESTURE_DELAY, () => {
          if (this._chars.playAlexAction) {
            this._chars.playAlexAction('point', 1.4);
          }
        });
        // Dave nods cautiously
        this._afterSettled(DIALOGUE_GESTURE_DELAY + 400, () => {
          if (this._chars.playDaveGesture) {
            this._chars.playDaveGesture('nod');
          }
        });
        // Forklift clears across after hesitation
        this._after(900, () => {
          if (typeof this._warehouse.clearForkliftCrossing === 'function') {
            this._warehouse.clearForkliftCrossing();
          }
        });
        // Once forklift clears, Dave and Alex face each other naturally to discuss the wave
        // They stay properly framed in front of the camera rather than facing away into the aisle
        this._after(1800, () => {
          if (this._chars.lookDaveAtAlex) this._chars.lookDaveAtAlex();
          if (this._chars.lookAlexAtDave) this._chars.lookAlexAtDave();
          if (this._chars.playDaveGesture) this._chars.playDaveGesture('talk');
        });
      } else if (alexAction === 'follow_dave') {
        // Option 3: Walk Straight Across — Dave leads dangerously into junction, Alex follows
        const daveDangerPos = { x: -0.25, y: 0, z: -16.6 };
        const alexDangerPos = { x: 0.25, y: 0, z: -16.2 };

        if (typeof this._chars.moveDaveTo === 'function') {
          this._chars.moveDaveTo(daveDangerPos, hazardPos || null);
        } else {
          this._chars.moveDave(daveDangerPos, hazardPos || null);
        }
        this._chars.moveAlex(alexDangerPos, hazardPos || null);

        // Near-miss audio alert buzzer / vehicle horn
        try { playWarningBuzzer(); } catch (_) {}

        // Dave realizes how close the near-miss was and reacts with startle/shrug
        this._afterSettled(DIALOGUE_GESTURE_DELAY, () => {
          if (this._chars.playDaveGesture) {
            this._chars.playDaveGesture('shrug');
          }
        });
        // Forklift accelerates safely across after near-miss so it doesn't collide repeatedly
        this._after(1500, () => {
          if (typeof this._warehouse.clearForkliftCrossing === 'function') {
            this._warehouse.clearForkliftCrossing();
          }
        });
      }
    } else if (targetPos) {
      this._chars.moveAlex(targetPos, hazardPos || null);
      this._chars.moveDave(targetPos, hazardPos || null);
    }

    // Post-action gesture beat:
    // - move_to_safety: Alex relocates only; the report.fbx has a forward body-lean
    //   that reads as an awkward bow. No gesture — just settle to idle.
    //   Dave gives a brief acknowledgement nod so the scene stays lively.
    // - isolate_equipment: a very short excerpt of the report clip is acceptable
    //   because the character is reaching for the panel (cap kept tight at 1.4 s).
    if (alexAction === 'move_to_safety' && stopId !== 'stop_02' && stopId !== 'stop_03') {
      if (this._chars.playDaveGesture) {
        this._afterSettled(DIALOGUE_GESTURE_DELAY, () => this._chars.playDaveGesture('nod'));
      }
    } else if (alexAction === 'isolate_equipment') {
      // Gesture and isolation are fully handled inside the 'isolate_equipment' branch
      // above with correct settle-relative timing — nothing extra needed here.
    } else if (stopId === 'stop_05' && alexAction === 'continue_walk') {
      if (this._chars.playAlexAction) {
        this._afterSettled(DIALOGUE_GESTURE_DELAY, () => this._chars.playAlexAction('report', 1.4));
      }
      if (this._chars.playDaveGesture) {
        this._afterSettled(DIALOGUE_GESTURE_DELAY + 500, () => this._chars.playDaveGesture('nod'));
      }
    }
  }
}
