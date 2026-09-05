/**
 * EmergencyInspectionTour.js
 * Clean, Simple 3D Emergency Hub Highlight & Dialogue Tour for Stop 05.
 * Highlights the 3 emergency stations on the South Wall with clear, easy-to-understand dialogue.
 */
import * as THREE from 'three';

export const EMERGENCY_STATIONS = [
  {
    id: 'eyewash',
    title: 'Eyewash Station Basin',
    icon: '👁️',
    step: '1 / 5',
    position: { x: -3.2, y: 1.35, z: -47.65 },
    speaker: 'Alex',
    role: 'TRAINEE',
    dialogue: 'Eyewash Station — For chemical or acid eye splashes. Push the green paddle with your palm and rinse your eyes continuously for 15 minutes.',
    quickTip: 'Push the paddle for hands-free aerated water flow.'
  },
  {
    id: 'aed',
    title: 'AED Defibrillator Cabinet',
    icon: '⚡',
    step: '2 / 5',
    position: { x: -1.2, y: 1.6, z: -47.65 },
    speaker: 'Alex',
    role: 'TRAINEE',
    dialogue: 'AED Defibrillator — For sudden cardiac arrest. Open the cabinet and the device speaks aloud to guide you step-by-step through CPR and shock pads.',
    quickTip: 'Flashing green LED means the battery self-test is ready.'
  },
  {
    id: 'shower',
    title: 'Emergency Shower Washroom',
    icon: '🚿',
    step: '3 / 5',
    position: { x: -5.4, y: 1.8, z: -47.65 },
    speaker: 'Alex',
    role: 'TRAINEE',
    dialogue: 'Emergency Shower — For large chemical spills over the body. Step into the washroom, pull the overhead handle, and wash chemicals off your clothes.',
    quickTip: 'Keep the 36-inch yellow floor perimeter completely clear.'
  },
  {
    id: 'extinguisher',
    title: 'CO2 Fire Extinguisher Stand',
    icon: '🧯',
    step: '4 / 5',
    position: { x: 3.2, y: 0.9, z: -36.15 },
    speaker: 'Alex',
    role: 'TRAINEE',
    dialogue: 'CO2 Fire Extinguisher — For electrical and equipment fires. Remember the P.A.S.S. rule: Pull the pin, Aim at base of fire, Squeeze handle, Sweep side to side.',
    quickTip: 'Must remain unobstructed with annual inspection tags verified.'
  },
  {
    id: 'spill_kit',
    title: '55-Gallon Spill Kit Drum',
    icon: '🛢️',
    step: '5 / 5',
    position: { x: 2.6, y: 0.6, z: -45.8 },
    speaker: 'Alex',
    role: 'TRAINEE',
    dialogue: '55-Gallon Spill Kit Drum — For liquid, oil, or chemical leaks on the floor. Use absorbent socks to surround the spill and pads to soak it up.',
    quickTip: 'Unscrew the yellow lid for instant access to pads, socks, and neutralizers.'
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

    // 3. Render clean, simple dialogue box
    this._el.innerHTML = `
      <div class="clean-tour-card">
        <div class="clean-tour-header">
          <div class="clean-tour-station">
            <span class="station-icon">${station.icon}</span>
            <span class="station-name">${station.title}</span>
          </div>
          <div class="clean-tour-counter">${station.step}</div>
        </div>

        <div class="clean-tour-body">
          <p class="clean-tour-speech">"${station.dialogue}"</p>
          <div class="clean-tour-tip">
            <span class="tip-badge">TIP</span> ${station.quickTip}
          </div>
        </div>

        <div class="clean-tour-footer">
          <button class="clean-tour-btn prev" id="clean-tour-prev" ${this._currentIndex === 0 ? 'disabled' : ''}>
            ⬅ Previous
          </button>

          <div class="clean-tour-dots">
            ${EMERGENCY_STATIONS.map((_, i) => `
              <span class="clean-dot ${i === this._currentIndex ? 'active' : ''}"></span>
            `).join('')}
          </div>

          <button class="clean-tour-btn next" id="clean-tour-next">
            ${isLast ? 'Finish Inspection ➔' : 'Next Station ➔'}
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
