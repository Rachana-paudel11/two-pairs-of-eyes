/**
 * EmergencyInspectionTour.js
 * Clean, Simple 3D Emergency Hub Highlight & Dialogue Tour for Stop 05.
 * Highlights the 3 emergency stations on the South Wall with clear, easy-to-understand dialogue.
 */
import * as THREE from 'three';
// Close-ups rendered from the warehouse scene, one per station
import eyewashPhoto from './assets/stations/eyewash.webp';
import aedPhoto from './assets/stations/aed.webp';
import showerPhoto from './assets/stations/shower.webp';
import extinguisherPhoto from './assets/stations/extinguisher.webp';
import spillKitPhoto from './assets/stations/spill_kit.webp';

const ARROW_LEFT = '<svg class="clean-tour-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="11 6 5 12 11 18"></polyline></svg>';
const ARROW_RIGHT = '<svg class="clean-tour-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="13 6 19 12 13 18"></polyline></svg>';

export const EMERGENCY_STATIONS = [
  {
    id: 'eyewash',
    title: 'Eyewash Station',
    photo: eyewashPhoto,
    iconSvg: `
      <svg class="station-favicon icon-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v2M12 20v2"/>
      </svg>
    `,
    step: '1 / 5',
    position: { x: -3.2, y: 1.35, z: -47.65 },
    speaker: 'Alex',
    role: 'TRAINEE',
    dialogue: 'For chemical splashes to the eyes. Push the green paddle with your palm and flush eyes continuously for 15 minutes.',
    quickTip: 'Push paddle stays open for hands-free flushing.'
  },
  {
    id: 'aed',
    title: 'AED Defibrillator',
    photo: aedPhoto,
    iconSvg: `
      <svg class="station-favicon icon-red" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        <polygon points="11.5,7 8.5,13 12,13 11,18 15.5,12 12,12" fill="#ffffff"/>
      </svg>
    `,
    step: '2 / 5',
    position: { x: -1.2, y: 1.6, z: -47.65 },
    speaker: 'Alex',
    role: 'TRAINEE',
    dialogue: 'For sudden cardiac arrest. Open the cabinet and follow the voice prompts for CPR and shock pads.',
    quickTip: 'Flashing green LED confirms self-test is ready.'
  },
  {
    id: 'shower',
    title: 'Emergency Shower',
    photo: showerPhoto,
    iconSvg: `
      <svg class="station-favicon icon-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 4h7a4 4 0 0 1 4 4v2"/>
        <path d="M10 10h10l-2 4h-6l-2-4z"/>
        <path d="M13 16v1M17 16v1M11 19v1M15 19v1M19 19v1"/>
      </svg>
    `,
    step: '3 / 5',
    position: { x: -5.4, y: 1.8, z: -47.65 },
    speaker: 'Alex',
    role: 'TRAINEE',
    dialogue: 'For large chemical spills on the body. Pull the overhead handle to drench and rinse chemicals from clothing.',
    quickTip: 'Keep the 36-inch floor zone completely clear.'
  },
  {
    id: 'extinguisher',
    title: 'CO2 Fire Extinguisher',
    photo: extinguisherPhoto,
    iconSvg: `
      <svg class="station-favicon icon-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 7h6M12 7V4M10 4h4"/>
        <rect x="8" y="7" width="8" height="14" rx="3"/>
        <path d="M16 10l3 2v4l-3-1"/>
      </svg>
    `,
    step: '4 / 5',
    position: { x: 1.2, y: 1.05, z: -47.4 },
    speaker: 'Alex',
    role: 'TRAINEE',
    dialogue: 'For electrical and machinery fires. Remember P.A.S.S. — Pull pin, Aim horn, Squeeze lever, Sweep base.',
    quickTip: 'Safe on live electrical equipment up to 1000V.'
  },
  {
    id: 'spill_kit',
    title: 'Spill Response Kit',
    photo: spillKitPhoto,
    iconSvg: `
      <svg class="station-favicon icon-yellow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="12" cy="6" rx="7" ry="3"/>
        <path d="M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6"/>
        <path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3"/>
      </svg>
    `,
    step: '5 / 5',
    position: { x: 2.6, y: 0.6, z: -45.8 },
    speaker: 'Alex',
    role: 'TRAINEE',
    dialogue: 'For chemical or oil floor leaks. Use absorbent socks to contain the spill and pads to soak it up.',
    quickTip: 'Twist off the yellow lid for pads and socks.'
  }
];

export class EmergencyInspectionTour {
  /**
   * @param {object} eventBus
   * @param {import('../engine/scenarioEngine.js').ScenarioEngine} engine
   * @param {import('../renderer/CameraRig.js').CameraRig} cameraRig
   * @param {import('../renderer/WarehouseScene.js').WarehouseScene} warehouse
   */
  constructor(eventBus, engine, cameraRig, warehouse) {
    this._eventBus = eventBus;
    this._engine = engine;
    this._cameraRig = cameraRig;
    this._warehouse = warehouse;

    this._el = document.getElementById('emergency-tour-dialogue');
    if (!this._el) {
      this._el = document.createElement('div');
      this._el.id = 'emergency-tour-dialogue';
      this._el.className = 'clean-tour-dialogue';
      this._el.hidden = true;
      this._el.style.display = 'none';
      document.body.appendChild(this._el);
    }

    this._currentIndex = 0;

    // Listen for tour start
    eventBus.on('drill:start', () => this.startTour());
    eventBus.on('tour:start', () => this.startTour());
  }

  startTour() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    // Hide standard dialogue panel and action menu so they don't overlap
    const diagPanel = document.getElementById('dialogue-panel');
    if (diagPanel) diagPanel.setAttribute('hidden', '');
    const actMenu = document.getElementById('action-menu');
    if (actMenu) actMenu.setAttribute('hidden', '');

    this._currentIndex = 0;
    this._el.removeAttribute('hidden');
    this._el.style.display = 'block';
    this._goToStep(0);
  }

  _goToStep(index) {
    this._currentIndex = index;
    const station = EMERGENCY_STATIONS[this._currentIndex];
    const isLast = this._currentIndex === EMERGENCY_STATIONS.length - 1;

    // 1. Smoothly look at the exact 3D station
    if (this._cameraRig) {
      this._cameraRig.inspect(new THREE.Vector3(station.position.x, station.position.y, station.position.z));
    }

    // 2. Highlight the 3D station with pulsing reticle and spotlight
    if (this._warehouse && typeof this._warehouse.highlightEquipment === 'function') {
      this._warehouse.highlightEquipment(station.position.x, station.position.y, station.position.z);
    }

    // 3. Render clean, simple dialogue box with SVG favicon badge
    this._el.innerHTML = `
      <div class="clean-tour-card">
        <div class="clean-tour-header">
          <div class="clean-tour-station">
            <div class="station-icon-badge">${station.iconSvg}</div>
            <span class="station-name">${station.title}</span>
          </div>
          <div class="clean-tour-counter">${station.step}</div>
        </div>

        <div class="clean-tour-body">
          <div class="clean-tour-media">
            <div class="clean-tour-thumb">
              <img src="${station.photo}" alt="${station.title} in the warehouse" width="76" height="76" decoding="async" />
            </div>
            <p class="clean-tour-speech">“${station.dialogue}”</p>
          </div>
          <div class="clean-tour-tip">
            <span class="tip-badge">TIP</span>
            <span>${station.quickTip}</span>
          </div>
        </div>

        <div class="clean-tour-footer">
          <button type="button" class="clean-tour-btn prev" id="clean-tour-prev" ${this._currentIndex === 0 ? 'disabled' : ''}>
            ${ARROW_LEFT}<span>Previous</span>
          </button>

          <div class="clean-tour-dots" aria-hidden="true">
            ${EMERGENCY_STATIONS.map((_, i) => `
              <span class="clean-dot ${i === this._currentIndex ? 'active' : (i < this._currentIndex ? 'done' : '')}"></span>
            `).join('')}
          </div>

          <button type="button" class="clean-tour-btn next" id="clean-tour-next">
            <span>${isLast ? 'Finish Inspection' : 'Next Station'}</span>${ARROW_RIGHT}
          </button>
        </div>
      </div>
    `;

    // Bind buttons
    const prevBtn = this._el.querySelector('#clean-tour-prev');
    if (prevBtn && this._currentIndex > 0) {
      prevBtn.addEventListener('click', () => this._goToStep(this._currentIndex - 1));
    }

    const nextBtn = this._el.querySelector('#clean-tour-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (isLast) {
          this._finishTour();
        } else {
          this._goToStep(this._currentIndex + 1);
        }
      });
    }
  }

  _finishTour() {
    this._el.setAttribute('hidden', '');
    this._el.style.display = 'none';

    // Clear 3D highlight and reset camera
    if (this._warehouse && typeof this._warehouse.clearHighlight === 'function') {
      this._warehouse.clearHighlight();
    }
    if (this._cameraRig) {
      this._cameraRig.exitInspect();
    }

    // Finish stop 05 with emergency_drill optimal action
    this._engine.chooseAction('emergency_drill');
  }
}
