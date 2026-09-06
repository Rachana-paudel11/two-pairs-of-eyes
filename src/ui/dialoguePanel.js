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
  }

  _hide() {
    this._el.className = '';
    this._el.setAttribute('hidden', '');
    this._el.innerHTML = '';
    this._isVisible = false;
  }

  /**
   * Called on every render frame to anchor the bubble directly above Dave's 3D head.
   * @param {THREE.Camera} camera
   * @param {THREE.Object3D} dave
   */
  update(camera, dave) {
    if (!this._isVisible || !this._el || !camera || !dave) return;

    // Retrieve Dave's actual head bone in 3D world space
    const headBone = dave.getObjectByName('mixamorigHead') || 
                     dave.getObjectByName('mixamorig1Head') || 
                     dave.getObjectByName('Head');

    if (headBone) {
      headBone.getWorldPosition(this._daveHeadPos);
      this._daveHeadPos.y += 0.45; // Hover directly above hardhat apex
    } else {
      dave.getWorldPosition(this._daveHeadPos);
      this._daveHeadPos.y += 2.0;
    }

    // Project world coordinates to normalized screen coordinates (-1 to +1)
    this._screenPos.copy(this._daveHeadPos).project(camera);

    // If Dave is behind the camera frustum, hide bubble
    if (this._screenPos.z > 1 || this._screenPos.z < -1) {
      this._el.style.opacity = '0';
      return;
    }

    // Convert normalized device coords to screen pixels
    const halfWidth = window.innerWidth / 2;
    const halfHeight = window.innerHeight / 2;
    let x = (this._screenPos.x * halfWidth) + halfWidth;
    let y = (-(this._screenPos.y * halfHeight)) + halfHeight;

    // Viewport clamping so bubble stays comfortably on screen
    const bubbleWidth = this._el.offsetWidth || 340;
    const bubbleHeight = this._el.offsetHeight || 120;
    const padding = 16;

    x = Math.max(bubbleWidth / 2 + padding, Math.min(window.innerWidth - bubbleWidth / 2 - padding, x));
    y = Math.max(bubbleHeight + 60, Math.min(window.innerHeight - 20, y));

    this._el.style.opacity = '1';
    this._el.style.left = `${Math.round(x)}px`;
    this._el.style.top = `${Math.round(y)}px`;
    this._el.style.transform = 'translate(-50%, -100%)';
  }
}
