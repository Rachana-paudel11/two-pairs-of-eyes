/**
 * DialoguePanel.js
 * Shows Dave's dialogue as a dynamic 3D speech bubble floating over his head.
 * Subscribes to: dialogue:line, action:resolved
 */
import * as THREE from 'three';

export class DialoguePanel {
  constructor(eventBus) {
    this._el = document.getElementById('dialogue-panel');
    this._eventBus = eventBus;
    this._daveHeadPos = new THREE.Vector3();
    this._screenPos = new THREE.Vector3();
    this._isVisible = false;

    eventBus.on('dialogue:line', ({ name, behaviour, line }) => {
      this._show(name, behaviour, line);
    });

    // Show consequence feedback directly in Dave's speech bubble as an official safety ribbon
    eventBus.on('action:resolved', ({ feedback, outcome = 'optimal', points = 0 }) => {
      if (feedback) {
        this._showFeedback(feedback, outcome, points);
      } else {
        this._hide();
      }
    });

    eventBus.on('stop:entered', () => this._hide());
    eventBus.on('session:complete', () => this._hide());
  }

  _show(name, behaviour, line) {
    this._el.className = 'speech-bubble-dialogue';
    const initial = name.charAt(0).toUpperCase();
    this._el.innerHTML = `
      <div class="speech-bubble-tail" aria-hidden="true"></div>
      <div class="dialogue-header">
        <div class="dialogue-avatar" aria-hidden="true">${initial}</div>
        <span class="dialogue-name">${name}</span>
        <span class="dialogue-behaviour ${behaviour}">${behaviour}</span>
      </div>
      <p class="dialogue-text">"${line}"</p>
    `;
    this._el.removeAttribute('hidden');
    this._isVisible = true;
    this._bubbleWidth = 360;
    this._bubbleHeight = 120;
  }

  _showFeedback(feedback, outcome = 'optimal', points = 0) {
    let outcomeLabel = 'SAFETY RESOLUTION';
    let outcomeIcon = '✓';
    let statusClass = 'optimal';
    let scoreText = points > 0 ? `+${points} PTS` : `${points} PTS`;

    if (outcome === 'failure') {
      outcomeLabel = 'SAFETY HAZARD RISK';
      outcomeIcon = '🛑';
      statusClass = 'failure';
      scoreText = points !== 0 ? (points > 0 ? `+${points} PTS` : `${points} PTS`) : '-3 PTS';
    } else if (outcome === 'partial') {
      outcomeLabel = 'PARTIAL COMPLIANCE';
      outcomeIcon = '⚠️';
      statusClass = 'partial';
      scoreText = points !== 0 ? (points > 0 ? `+${points} PTS` : `${points} PTS`) : '+3 PTS';
    } else {
      scoreText = points !== 0 ? (points > 0 ? `+${points} PTS` : `${points} PTS`) : '+5 PTS';
    }

    this._el.className = `speech-bubble-outcome ${statusClass}`;
    this._el.innerHTML = `
      <div class="speech-bubble-tail" aria-hidden="true"></div>
      <div class="outcome-ribbon-header ${statusClass}">
        <div class="outcome-ribbon-left">
          <span class="outcome-ribbon-icon" aria-hidden="true">${outcomeIcon}</span>
          <span class="outcome-ribbon-title">${outcomeLabel}</span>
        </div>
        <span class="outcome-score-pill ${statusClass}">${scoreText}</span>
      </div>
      <div class="outcome-body">
        <p class="outcome-feedback-text">${feedback}</p>
      </div>
    `;

    this._el.removeAttribute('hidden');
    this._isVisible = true;
    this._bubbleWidth = 360;
    this._bubbleHeight = 130;
  }

  _hide() {
    this._el.className = '';
    this._el.setAttribute('hidden', '');
    this._el.innerHTML = '';
    this._isVisible = false;
  }

  /**
   * Called on every render frame to anchor the bubble directly above Dave's 3D head.
   * Uses hardware-accelerated transforms without triggering DOM layout recalculations.
   * @param {THREE.Camera} camera
   * @param {THREE.Object3D} dave
   */
  _findHeadBone(dave) {
    if (this._cachedDave === dave && this._cachedHeadBone) {
      return this._cachedHeadBone;
    }
    let head = null;
    dave.traverse((node) => {
      if (head) return;
      if (node.isBone && /Head$/i.test(node.name)) {
        head = node;
      }
    });
    this._cachedDave = dave;
    this._cachedHeadBone = head;
    return head;
  }

  update(camera, dave) {
    if (!this._isVisible || !this._el || !camera || !dave) return;

    // Retrieve Dave's actual head bone in 3D world space
    const headBone = this._findHeadBone(dave);

    if (headBone) {
      headBone.getWorldPosition(this._daveHeadPos);
      this._daveHeadPos.y += 0.45; // Hover directly above head
    } else {
      dave.getWorldPosition(this._daveHeadPos);
      this._daveHeadPos.y += 2.0;
    }

    // Project world coordinates to normalized screen coordinates (-1 to +1)
    this._screenPos.copy(this._daveHeadPos).project(camera);

    // If Dave is behind the camera frustum, hide bubble
    if (this._screenPos.z > 1 || this._screenPos.z < -1) {
      if (this._el.style.opacity !== '0') this._el.style.opacity = '0';
      return;
    }

    if (this._el.classList.contains('speech-bubble-outcome')) {
      if (this._el.style.opacity !== '1') this._el.style.opacity = '1';
      this._el.style.transform = `translate3d(-50%, 0, 0)`;
      this._el.style.top = `80px`;
      this._el.style.left = `50%`;
      return;
    }

    // Reset fixed styling when switching back to dialogue speech bubble
    this._el.style.top = `0px`;
    this._el.style.left = `0px`;

    // Convert normalized device coords to screen pixels
    const halfWidth = window.innerWidth * 0.5;
    const halfHeight = window.innerHeight * 0.5;
    const rawX = (this._screenPos.x * halfWidth) + halfWidth;
    const rawY = (-(this._screenPos.y * halfHeight)) + halfHeight;

    // Viewport clamping so bubble stays comfortably on screen
    const bubbleWidth = this._bubbleWidth || 360;
    const bubbleHeight = this._bubbleHeight || 120;
    const padding = 16;

    const clampedX = Math.max(bubbleWidth * 0.5 + padding, Math.min(window.innerWidth - bubbleWidth * 0.5 - padding, rawX));
    const clampedY = Math.max(bubbleHeight + 60, Math.min(window.innerHeight - 20, rawY));

    // Adjust tail horizontal offset so it points directly to Dave's head even when bubble card is clamped
    const offset = rawX - clampedX;
    const tailPercent = Math.max(12, Math.min(88, 50 + (offset / bubbleWidth) * 100));

    if (!this._tailEl || !this._el.contains(this._tailEl)) {
      this._tailEl = this._el.querySelector('.speech-bubble-tail');
    }
    if (this._tailEl) {
      this._tailEl.style.left = `${tailPercent.toFixed(1)}%`;
    }

    if (this._el.style.opacity !== '1') this._el.style.opacity = '1';
    this._el.style.transform = `translate3d(${Math.round(clampedX)}px, ${Math.round(clampedY)}px, 0) translate(-50%, -100%)`;
  }
}
