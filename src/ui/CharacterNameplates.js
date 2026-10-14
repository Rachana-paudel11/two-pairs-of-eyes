/**
 * CharacterNameplates.js
 * 
 * Floating 3D overhead nameplates & role badges for Alex (Player/Trainee) and Dave (Supervisor).
 * Seamlessly projected in screen-space above character heads in the TechNova Nature-Industrial Glass theme.
 * 
 * Features:
 *  - Crystal-clear role identification: Alex is "YOU • TRAINEE" (Moss/Emerald), Dave is "SUPERVISOR" (Amber).
 *  - Dave's badge gracefully hides when his speech bubble is active to prevent visual overlap.
 *  - Sub-pixel delta check (<0.25px) prevents redundant DOM style mutations for buttery 60 FPS performance.
 *  - Automatically hidden when behind the camera frustum or when modals (start, debrief, etc.) are open.
 */

import * as THREE from 'three';

export class CharacterNameplates {
  /**
   * @param {import('../engine/EventBus.js').EventBus} eventBus
   */
  constructor(eventBus) {
    this._bus = eventBus;
    this._container = document.getElementById('character-nameplates');
    this._alexPlate = document.getElementById('nameplate-alex');
    this._davePlate = document.getElementById('nameplate-dave');

    this._alexWorldPos = new THREE.Vector3();
    this._daveWorldPos = new THREE.Vector3();
    this._screenPos = new THREE.Vector3();

    this._alexX = null;
    this._alexY = null;
    this._daveX = null;
    this._daveY = null;

    this._cachedAlexHead = null;
    this._cachedDaveHead = null;

    this._daveBubbleActive = false;
    this._suppressed = true;

    // Listen to dialogue events to hide Dave's badge when his speech bubble appears
    if (this._bus && typeof this._bus.on === 'function') {
      this._bus.on('dialogue:line', () => {
        this._daveBubbleActive = true;
        if (this._davePlate) this._davePlate.style.opacity = '0';
      });

      this._bus.on('action:resolved', () => {
        this._daveBubbleActive = false;
      });

      this._bus.on('stop:entered', () => {
        this._suppressed = false;
        this._daveBubbleActive = false;
      });

      this._bus.on('ui:open-start-screen', () => {
        this._suppressed = true;
        this.hideAll();
      });

      this._bus.on('session:complete', () => {
        this._suppressed = true;
        this.hideAll();
      });

      this._bus.on('game:paused', () => {
        this._suppressed = true;
        this.hideAll();
      });

      this._bus.on('game:resumed', () => {
        this._suppressed = false;
      });
    }
  }

  setSuppressed(suppressed) {
    this._suppressed = Boolean(suppressed);
    if (this._suppressed) {
      this.hideAll();
    }
  }

  hideAll() {
    if (this._alexPlate) this._alexPlate.style.opacity = '0';
    if (this._davePlate) this._davePlate.style.opacity = '0';
  }

  _findHeadBone(char) {
    if (!char) return null;
    let head = null;
    char.traverse((node) => {
      if (head) return;
      if (node.isBone && /Head$/i.test(node.name)) {
        head = node;
      }
    });
    return head;
  }

  /**
   * Called every render frame from renderer.onUpdate.
   * @param {THREE.Camera} camera
   * @param {THREE.Object3D} alex
   * @param {THREE.Object3D} dave
   */
  update(camera, alex, dave) {
    if (this._suppressed || !camera) {
      this.hideAll();
      return;
    }

    const halfW = window.innerWidth * 0.5;
    const halfH = window.innerHeight * 0.5;

    // ─── 1. Update Alex (Player / Trainee) Nameplate ───
    if (this._alexPlate && alex) {
      if (!this._cachedAlexHead || this._cachedAlexChar !== alex) {
        this._cachedAlexHead = this._findHeadBone(alex);
        this._cachedAlexChar = alex;
      }

      if (this._cachedAlexHead) {
        this._cachedAlexHead.getWorldPosition(this._alexWorldPos);
        this._alexWorldPos.y += 0.40; // Hover just above hardhat
      } else {
        alex.getWorldPosition(this._alexWorldPos);
        this._alexWorldPos.y += 1.95;
      }

      this._screenPos.copy(this._alexWorldPos).project(camera);

      // Frustum & boundary check
      if (this._screenPos.z > 1 || this._screenPos.z < -1 || this._screenPos.x < -1.1 || this._screenPos.x > 1.1) {
        if (this._alexPlate.style.opacity !== '0') this._alexPlate.style.opacity = '0';
      } else {
        const rawX = (this._screenPos.x * halfW) + halfW;
        const rawY = (-(this._screenPos.y * halfH)) + halfH;

        if (this._alexX === null || this._alexY === null) {
          this._alexX = rawX;
          this._alexY = rawY;
        } else {
          this._alexX += (rawX - this._alexX) * 0.28;
          this._alexY += (rawY - this._alexY) * 0.28;
        }

        // Anti-lag: Only write transform to DOM if moved more than 0.25px
        if (this._lastAlexX === undefined ||
            Math.abs(this._alexX - this._lastAlexX) > 0.25 ||
            Math.abs(this._alexY - this._lastAlexY) > 0.25) {
          this._alexPlate.style.transform = `translate3d(${this._alexX.toFixed(1)}px, ${this._alexY.toFixed(1)}px, 0) translate(-50%, -100%)`;
          this._lastAlexX = this._alexX;
          this._lastAlexY = this._alexY;
        }

        if (this._alexPlate.style.opacity !== '1') {
          this._alexPlate.style.opacity = '1';
        }
      }
    }

    // ─── 2. Update Dave (Supervisor) Nameplate ───
    if (this._davePlate && dave) {
      if (this._daveBubbleActive) {
        if (this._davePlate.style.opacity !== '0') this._davePlate.style.opacity = '0';
        return;
      }

      if (!this._cachedDaveHead || this._cachedDaveChar !== dave) {
        this._cachedDaveHead = this._findHeadBone(dave);
        this._cachedDaveChar = dave;
      }

      if (this._cachedDaveHead) {
        this._cachedDaveHead.getWorldPosition(this._daveWorldPos);
        this._daveWorldPos.y += 0.40; // Hover just above head
      } else {
        dave.getWorldPosition(this._daveWorldPos);
        this._daveWorldPos.y += 1.95;
      }

      this._screenPos.copy(this._daveWorldPos).project(camera);

      // Frustum & boundary check
      if (this._screenPos.z > 1 || this._screenPos.z < -1 || this._screenPos.x < -1.1 || this._screenPos.x > 1.1) {
        if (this._davePlate.style.opacity !== '0') this._davePlate.style.opacity = '0';
      } else {
        const rawX = (this._screenPos.x * halfW) + halfW;
        const rawY = (-(this._screenPos.y * halfH)) + halfH;

        if (this._daveX === null || this._daveY === null) {
          this._daveX = rawX;
          this._daveY = rawY;
        } else {
          this._daveX += (rawX - this._daveX) * 0.28;
          this._daveY += (rawY - this._daveY) * 0.28;
        }

        // Anti-lag: Only write transform to DOM if moved more than 0.25px
        if (this._lastDaveX === undefined ||
            Math.abs(this._daveX - this._lastDaveX) > 0.25 ||
            Math.abs(this._daveY - this._lastDaveY) > 0.25) {
          this._davePlate.style.transform = `translate3d(${this._daveX.toFixed(1)}px, ${this._daveY.toFixed(1)}px, 0) translate(-50%, -100%)`;
          this._lastDaveX = this._daveX;
          this._lastDaveY = this._daveY;
        }

        if (this._davePlate.style.opacity !== '1') {
          this._davePlate.style.opacity = '1';
        }
      }
    }
  }
}
