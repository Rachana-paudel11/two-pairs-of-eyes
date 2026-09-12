/**
 * Minimap.js
 * 
 * Next-Generation Facility Digital Twin & Tactical Locomotion Radar:
 *  - Mode 1: Compact HUD Radar (Top-Right):
 *      Player-Centered Tactical Proximity (16m close-up tracking) with concentric
 *      sonar range rings, 26px high-contrast tactical delta, forward laser guide beam,
 *      walking pulse ripples, motion breadcrumbs, and off-screen target rim guidance.
 *  - Mode 2: Full-Bleed Architectural Facility Blueprint Modal ([M] or Click):
 *      100% full-canvas dedicated CAD Digital Twin schematic with zero text clutter.
 *      Interactive safety layer filters (Hazards, Emergency Equipment, Traffic Routes).
 *      Dual-Mode Zoom: [1x FACILITY OVERVIEW] ⟷ [2.5x TACTICAL FOLLOW].
 *  - Locomotion Tracking System:
 *      Real-time walking breadcrumb trail (fading historical path), forward heading laser beam,
 *      concentric walking motion ripple waves, and dynamic GPS route spline to active objectives.
 *  - Spatial Proximity Trigger for seamless keyboard (WASD) locomotion.
 */

const FACILITY_ZONES = [
  {
    id: 'stop_01',
    num: 1,
    code: 'Z01',
    name: 'Chemical Drum Storage',
    subname: 'Overturned Drum & Fluid Spill',
    standard: 'OSHA 1910.22(a)(2) — Walking-Working Surfaces Clean & Dry',
    coords: { x: 0.15, z: -4.5 },
    hazardCoords: { x: -0.2, z: -5.4 },
    type: 'chemical_spill',
    severity: 'MODERATE SLIP RISK',
    brief: 'Polymer drum ruptured during staging. 15L chemical fluid active on walkway.'
  },
  {
    id: 'stop_02',
    num: 2,
    code: 'Z02',
    name: 'Blind-Corner Transit',
    subname: 'Forklift Intersection Crossing',
    standard: 'OSHA 1910.178(n)(4) — Slow Down & Sound Horn at Cross Aisles',
    coords: { x: 0.30, z: -13.5 },
    hazardCoords: { x: -4.0, z: -13.5 },
    type: 'forklift_conflict',
    severity: 'CRITICAL TRAFFIC CONFLICT',
    brief: 'Heavy forklift crossing with obstructed sightlines from high pallet staging.'
  },
  {
    id: 'stop_03',
    num: 3,
    code: 'Z03',
    name: 'High-Bay Pallet Racking',
    subname: 'Bent Structural Upright Column',
    standard: 'ANSI MH16.1 / OSHA 1910.176 — Structural Racking Safety Integrity',
    coords: { x: -0.90, z: -22.5 },
    hazardCoords: { x: -2.3, z: -22.0 },
    type: 'structural_defect',
    severity: 'SEVERE COLLAPSE RISK',
    brief: 'Severe impact deformation on lower upright column bearing 3-tier loaded pallet skids.'
  },
  {
    id: 'stop_04',
    num: 4,
    code: 'Z04',
    name: 'MHE Battery Charging Bay',
    subname: 'Overheating Charger & Blocked Airflow',
    standard: 'OSHA 1910.178(g) — Battery Charging Ventilation & Electrical Isolation',
    coords: { x: 0.40, z: -32.2 },
    hazardCoords: { x: -4.8, z: -32.0 },
    type: 'electrical_thermal',
    severity: 'THERMAL RUNAWAY HAZARD',
    brief: 'Flashing overheat fault on 480V Stall 2 charger with combustible packaging encroaching intake.'
  },
  {
    id: 'stop_05',
    num: 5,
    code: 'Z05',
    name: 'Loading Dock & Emergency Hub',
    subname: 'Clear Aisle & Station Verification',
    standard: 'OSHA 1910.151(c) & OSHA 1910.157 — Emergency Response Readiness',
    coords: { x: 0.00, z: -46.5 },
    hazardCoords: { x: 1.2, z: -47.5 },
    type: 'emergency_hub',
    severity: 'INSPECTION VERIFIED',
    brief: 'Comprehensive readiness audit of eyewash station, AED, fire extinguisher, and spill response kit.'
  }
];

const EMERGENCY_STATIONS = [
  { id: 'eyewash', label: 'Eyewash Station', icon: '🚿', x: 0.8, z: -47.2, color: '#10b981' },
  { id: 'aed', label: 'AED Defibrillator', icon: '❤️', x: 1.4, z: -47.2, color: '#ef4444' },
  { id: 'extinguisher', label: 'CO2 Fire Extinguisher', icon: '🧯', x: 1.2, z: -47.5, color: '#f97316' },
  { id: 'spillkit', label: '30-Gal Spill Kit Drum', icon: '🛢️', x: -1.6, z: -47.4, color: '#eab308' },
];

export class Minimap {
  /**
   * @param {import('../engine/eventBus.js').EventBus} eventBus
   * @param {import('../engine/scenarioEngine.js').ScenarioEngine} engine
   * @param {import('../renderer/CharacterController.js').CharacterController} characters
   */
  constructor(eventBus, engine, characters) {
    this._bus = eventBus;
    this._engine = engine;
    this._chars = characters;
    this._currentStopIndex = 0;
    this._activeTargetIndex = 0;
    this._awaitingArrival = false;
    this._hasTriggeredForTarget = false;

    // Locomotion tracking
    this._trail = []; // historical { x, z, time }
    this._lastPos = null;
    this._lastPosTime = 0;
    this._lastMoveTime = 0;
    this._walkSpeed = 0;
    this._viewMode = 'overview'; // 'overview' | 'tactical' for blueprint
    this._radarMode = 'proximity'; // 'proximity' (16m close-up) | 'sector' (50m full)

    // Layer filters for expanded blueprint
    this._layers = {
      zones: true,
      hazards: true,
      emergency: true,
      traffic: true,
    };
    this._selectedZone = null;
    this._isExpanded = false;

    this._createDOM();
    this._wireEvents();
  }

  _createDOM() {
    // 1. Compact HUD Radar Pod (Docked Top-Right)
    const radarContainer = document.createElement('div');
    radarContainer.id = 'hud-radar-pod';
    radarContainer.className = 'hud-radar-pod';
    radarContainer.innerHTML = `
      <div class="radar-pod-header">
        <div class="radar-header-left">
          <span class="radar-pulsar"></span>
          <span class="radar-label">TACTICAL RADAR</span>
        </div>
        <div class="radar-header-right">
          <button class="radar-mode-btn" id="radar-mode-btn" title="Toggle 16m Proximity / 50m Sector">16m</button>
          <div class="radar-bearing" id="radar-bearing-val">180° S</div>
        </div>
      </div>

      <div class="radar-scope-wrapper" id="radar-scope-wrapper">
        <canvas id="radar-canvas" width="220" height="220"></canvas>
        <div class="radar-hud-coords" id="radar-coords">GRID: 0.0, -4.5</div>
      </div>

      <div class="radar-pod-footer">
        <div class="radar-target-strip">
          <span class="target-radar-icon">🎯</span>
          <span class="target-radar-text" id="radar-target-text">Z01 CHEMICAL DRUMS</span>
        </div>
        <div class="radar-keys-row">
          <span class="radar-key">WASD</span> Walk
          <span class="radar-key">E</span> Transit
          <span class="radar-key key-m">Click</span> Map
        </div>
      </div>
    `;

    // 2. Full-Screen Facility Blueprint Modal (Dedicated Full-Bleed Map)
    const modalContainer = document.createElement('div');
    modalContainer.id = 'facility-blueprint-modal';
    modalContainer.className = 'facility-blueprint-modal';
    modalContainer.setAttribute('hidden', '');
    modalContainer.innerHTML = `
      <div class="blueprint-modal-backdrop" id="blueprint-backdrop"></div>
      <div class="blueprint-window" role="dialog" aria-label="Facility Digital Twin Blueprint">
        <div class="blueprint-window-header">
          <div class="blueprint-header-title">
            <div class="cad-badge">FACILITY DIGITAL TWIN // ARCHITECTURAL SCHEMATIC</div>
            <h2>LOGISTICS BAY 04 • HIGH-BAY SAFETY AUDIT</h2>
          </div>

          <div class="blueprint-objective-badge" id="blueprint-obj-badge">
            <span class="obj-pulsar"></span>
            <span id="blueprint-obj-text">TARGET: ZONE 01 • CHEMICAL DRUMS</span>
          </div>

          <button class="blueprint-close-btn" id="blueprint-close-btn" aria-label="Close Blueprint [Esc]">✕</button>
        </div>

        <div class="blueprint-window-body">
          <div class="blueprint-canvas-container">
            <div class="blueprint-view-controls">
              <button class="view-ctrl-btn active" id="btn-view-overview">1x FACILITY OVERVIEW</button>
              <button class="view-ctrl-btn" id="btn-view-tactical">2.5x TACTICAL FOLLOW</button>
            </div>

            <canvas id="blueprint-canvas" width="1040" height="680"></canvas>

            <div class="blueprint-floating-legend">
              <span class="legend-item"><span class="leg-swatch walk"></span> Pedestrian Walkway</span>
              <span class="legend-item"><span class="leg-swatch fork"></span> Forklift Crossing</span>
              <span class="legend-item"><span class="leg-swatch hazard"></span> Active Hazard</span>
              <span class="legend-item"><span class="leg-swatch route"></span> GPS Navigation Spline</span>
            </div>

            <div class="blueprint-scale-legend">
              <span class="scale-bar"></span>
              <span class="scale-text" id="blueprint-scale-text">SCALE: 1:100 (56m AISLE SPAN)</span>
            </div>
          </div>
        </div>

        <div class="blueprint-window-footer">
          <div class="footer-telemetry">
            <span class="tel-item cad-online">● CAD ENGINE ACTIVE</span>
            <span class="tel-item" id="blueprint-speed-val">SPEED: 0.0 m/s</span>
            <span class="tel-item" id="blueprint-heading-val">HEADING: 180° S</span>
            <span class="tel-item" id="blueprint-player-loc">PLAYER LOC: (0.0, -4.5)</span>
          </div>
          <div class="footer-hint">
            <kbd>WASD</kbd> Move • <kbd>Z</kbd> Toggle Zoom • <kbd>M</kbd> or <kbd>Esc</kbd> Close
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(radarContainer);
    document.body.appendChild(modalContainer);

    this._radarEl = radarContainer;
    this._modalEl = modalContainer;
    this._radarCanvas = document.getElementById('radar-canvas');
    this._radarCtx = this._radarCanvas.getContext('2d');
    this._blueprintCanvas = document.getElementById('blueprint-canvas');
    this._blueprintCtx = this._blueprintCanvas.getContext('2d');

    this._bearingEl = document.getElementById('radar-bearing-val');
    this._coordsEl = document.getElementById('radar-coords');
    this._targetTextEl = document.getElementById('radar-target-text');
    this._radarModeBtn = document.getElementById('radar-mode-btn');
    this._playerLocEl = document.getElementById('blueprint-player-loc');
    this._speedEl = document.getElementById('blueprint-speed-val');
    this._headingEl = document.getElementById('blueprint-heading-val');
    this._objTextEl = document.getElementById('blueprint-obj-text');
    this._scaleTextEl = document.getElementById('blueprint-scale-text');

    this._btnOverview = document.getElementById('btn-view-overview');
    this._btnTactical = document.getElementById('btn-view-tactical');

    // Button actions
    // Open blueprint by clicking the radar canvas/scope
    document.getElementById('radar-scope-wrapper').addEventListener('click', () => this.openBlueprint());
    document.getElementById('blueprint-close-btn').addEventListener('click', () => this.closeBlueprint());
    document.getElementById('blueprint-backdrop').addEventListener('click', () => this.closeBlueprint());

    // Radar mode toggle (16m proximity vs 50m sector)
    if (this._radarModeBtn) {
      this._radarModeBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent bubbling to radar scope wrapper
        this._radarMode = this._radarMode === 'proximity' ? 'sector' : 'proximity';
        this._radarModeBtn.textContent = this._radarMode === 'proximity' ? '16m' : '50m';
      });
    }

    // View mode buttons (blueprint)
    this._btnOverview.addEventListener('click', () => this.setViewMode('overview'));
    this._btnTactical.addEventListener('click', () => this.setViewMode('tactical'));

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'KeyM') {
        e.preventDefault();
        this.toggleBlueprint();
      } else if (e.code === 'Escape' && this._isExpanded) {
        e.preventDefault();
        this.closeBlueprint();
      } else if (e.code === 'KeyZ' && this._isExpanded) {
        e.preventDefault();
        this.setViewMode(this._viewMode === 'overview' ? 'tactical' : 'overview');
      }
    });

    // Blueprint canvas click hit-testing for quick focus
    this._blueprintCanvas.addEventListener('click', (e) => this._onBlueprintClick(e));
  }

  setViewMode(mode) {
    this._viewMode = mode;
    if (this._btnOverview && this._btnTactical) {
      this._btnOverview.classList.toggle('active', mode === 'overview');
      this._btnTactical.classList.toggle('active', mode === 'tactical');
    }
    if (this._scaleTextEl) {
      this._scaleTextEl.textContent = mode === 'overview' 
        ? 'SCALE: 1:100 (56m AISLE SPAN)' 
        : 'SCALE: 1:35 (20m TACTICAL PROXIMITY)';
    }
    this._renderBlueprint();
  }

  toggleBlueprint() {
    if (this._isExpanded) this.closeBlueprint();
    else this.openBlueprint();
  }

  openBlueprint() {
    this._isExpanded = true;
    this._modalEl.removeAttribute('hidden');
    this._renderBlueprint();
  }

  closeBlueprint() {
    this._isExpanded = false;
    this._modalEl.setAttribute('hidden', '');
  }

  _wireEvents() {
    this._bus.on('stop:entered', ({ stop }) => {
      const idx = parseInt(stop.id.split('_')[1], 10) - 1;
      this._currentStopIndex = idx;
      this._activeTargetIndex = idx;
      this._awaitingArrival = false;
      this._hasTriggeredForTarget = true;
      this._updateObjectiveDisplay();
    });

    this._bus.on('action:resolved', () => {
      if (this._currentStopIndex < FACILITY_ZONES.length - 1) {
        this._activeTargetIndex = this._currentStopIndex + 1;
        this._awaitingArrival = true;
        this._hasTriggeredForTarget = false;
        this._updateObjectiveDisplay();
      }
    });

    this._bus.on('session:complete', () => {
      this._awaitingArrival = false;
      if (this._radarEl) this._radarEl.style.display = 'none';
      this.closeBlueprint();
    });
  }

  _updateObjectiveDisplay() {
    const targetZone = FACILITY_ZONES[this._activeTargetIndex] || FACILITY_ZONES[0];
    if (this._objTextEl) {
      if (this._awaitingArrival) {
        this._objTextEl.textContent = `TARGET: ${targetZone.code} • ${targetZone.name.toUpperCase()}`;
      } else {
        this._objTextEl.textContent = `AUDITING: ${targetZone.code} • ${targetZone.name.toUpperCase()}`;
      }
    }
  }

  _onBlueprintClick(e) {
    this.setViewMode(this._viewMode === 'overview' ? 'tactical' : 'overview');
  }

  /**
   * Called on every frame from the Three.js render loop.
   */
  update() {
    const alex = this._chars?.alex;
    const dave = this._chars?.dave;
    if (!alex) return;

    const alexPos = alex.position;
    const davePos = dave ? dave.position : null;
    const now = Date.now();

    // 1. Locomotion Speed & Trail Breadcrumb Recording
    if (this._lastPos) {
      const dx = alexPos.x - this._lastPos.x;
      const dz = alexPos.z - this._lastPos.z;
      const dist = Math.hypot(dx, dz);
      const dtSec = Math.max(0.001, (now - (this._lastPosTime || now)) / 1000);
      const instSpeed = dist / dtSec;
      this._walkSpeed = this._walkSpeed * 0.75 + instSpeed * 0.25;

      if (dist > 0.035) {
        this._lastMoveTime = now;
        const lastPt = this._trail[this._trail.length - 1];
        if (!lastPt || Math.hypot(alexPos.x - lastPt.x, alexPos.z - lastPt.z) > 0.3) {
          this._trail.push({ x: alexPos.x, z: alexPos.z, time: now });
          if (this._trail.length > 35) this._trail.shift();
        }
      }
    }
    this._lastPos = { x: alexPos.x, z: alexPos.z };
    this._lastPosTime = now;

    // Prune stale breadcrumbs older than 5.5 seconds
    this._trail = this._trail.filter(pt => (now - pt.time) < 5500);

    // 2. Compass Bearing & Heading
    const headingRad = this._chars?._yawOf ? this._chars._yawOf(alex) : 0;
    let deg = Math.round((headingRad * (180 / Math.PI)) % 360);
    if (deg < 0) deg += 360;

    const cardinal = deg >= 337 || deg < 23 ? 'N' :
                     deg >= 23  && deg < 68 ? 'NE' :
                     deg >= 68  && deg < 113 ? 'E' :
                     deg >= 113 && deg < 158 ? 'SE' :
                     deg >= 158 && deg < 203 ? 'S' :
                     deg >= 203 && deg < 248 ? 'SW' :
                     deg >= 248 && deg < 293 ? 'W' : 'NW';

    if (this._bearingEl) {
      this._bearingEl.textContent = `${deg}° ${cardinal}`;
    }
    if (this._headingEl) {
      this._headingEl.textContent = `HEADING: ${deg}° ${cardinal}`;
    }
    if (this._speedEl) {
      this._speedEl.textContent = `SPEED: ${this._walkSpeed.toFixed(1)} m/s`;
    }

    // 3. Coordinate Readout
    if (this._coordsEl) {
      this._coordsEl.textContent = `GRID: ${alexPos.x.toFixed(1)}, ${alexPos.z.toFixed(1)}`;
    }
    if (this._playerLocEl) {
      this._playerLocEl.textContent = `PLAYER LOC: (${alexPos.x.toFixed(2)}, ${alexPos.z.toFixed(2)})`;
    }

    // 4. Target Waypoint Distance Readout
    const targetZone = FACILITY_ZONES[this._activeTargetIndex] || FACILITY_ZONES[0];
    const distToTarget = Math.hypot(alexPos.x - targetZone.coords.x, alexPos.z - targetZone.coords.z);

    if (this._targetTextEl) {
      if (this._awaitingArrival) {
        this._targetTextEl.textContent = `WALK TO ${targetZone.code} (${Math.round(distToTarget)}m)`;
      } else {
        this._targetTextEl.textContent = `AUDITING ${targetZone.code}`;
      }
    }

    // 5. Spatial Proximity Trigger for Keyboard WASD Movement
    if (this._awaitingArrival && !this._hasTriggeredForTarget && this._chars?.isSettled !== false) {
      const dz = Math.abs(alexPos.z - targetZone.coords.z);
      const dx = Math.abs(alexPos.x - targetZone.coords.x);
      if (dz < 1.6 && dx < 2.0) {
        this._hasTriggeredForTarget = true;
        this._awaitingArrival = false;
        this._bus.emit('ui:continue');
      }
    }

    // 6. Render Canvas Views
    this._renderRadar(alex, davePos, targetZone, headingRad);
    if (this._isExpanded) {
      this._renderBlueprint();
    }
  }

  // ─── Compact Tactical Radar Rendering (High-Visibility Player-Centered) ─────
  _renderRadar(alex, davePos, targetZone, headingRad) {
    const ctx = this._radarCtx;
    if (!ctx || !alex) return;
    const W = this._radarCanvas.width;
    const H = this._radarCanvas.height;
    const centerX = W / 2;
    const centerY = H / 2;
    const now = Date.now();
    const isWalking = (now - this._lastMoveTime) < 350 || this._walkSpeed > 0.12;

    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // Circular radar clip mask
    ctx.beginPath();
    ctx.arc(centerX, centerY, W / 2 - 3, 0, Math.PI * 2);
    ctx.clip();

    // Dark obsidian tactical background
    ctx.fillStyle = '#050a14';
    ctx.fillRect(0, 0, W, H);

    // Coordinate Mapping:
    let mapX, mapY, scale;
    if (this._radarMode === 'sector') {
      // 50m full sector overview
      const zMin = -50.0; const zMax = 2.0;
      const xMin = -6.0;  const xMax = 6.0;
      const pad = 12;
      mapX = (x) => ((x - xMin) / (xMax - xMin)) * (W - pad * 2) + pad;
      mapY = (z) => ((zMax - z) / (zMax - zMin)) * (H - pad * 2) + pad;
      scale = (H - pad * 2) / 52.0;

      // Sector Grid
      ctx.strokeStyle = 'rgba(30, 58, 138, 0.25)';
      ctx.lineWidth = 1;
      for (let x = -4; x <= 4; x += 2) {
        const mx = mapX(x);
        ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, H); ctx.stroke();
      }
      for (let z = 0; z >= -48; z -= 8) {
        const my = mapY(z);
        ctx.beginPath(); ctx.moveTo(0, my); ctx.lineTo(W, my); ctx.stroke();
      }
    } else {
      // 16m tactical close-up proximity (Centered on Alex!)
      const radiusMeters = 8.5; // 17m diameter
      scale = (W / 2 - 14) / radiusMeters; // ~11.5 px per meter
      mapX = (x) => centerX + (x - alex.position.x) * scale;
      mapY = (z) => centerY + (alex.position.z - z) * scale;

      // Concentric Range Rings (4m, 8m)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(centerX, centerY, 4 * scale, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(centerX, centerY, 8 * scale, 0, Math.PI * 2); ctx.stroke();

      // Crosshairs
      ctx.strokeStyle = 'rgba(30, 58, 138, 0.3)';
      ctx.beginPath(); ctx.moveTo(centerX, 0); ctx.lineTo(centerX, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(W, centerY); ctx.stroke();

      // Distance tags
      ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.font = '800 7px monospace';
      ctx.fillText('4m', centerX + 3, centerY - 4 * scale + 9);
      ctx.fillText('8m', centerX + 3, centerY - 8 * scale + 9);
    }

    // Helper: draw a hatched rectangle (engineering-style structural racks)
    const drawHatchRect = (rx, ry, rw, rh, fillColor, strokeColor, hatchColor) => {
      ctx.fillStyle = fillColor;
      ctx.fillRect(rx, ry, rw, rh);
      // Diagonal hatch lines
      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.clip();
      ctx.strokeStyle = hatchColor;
      ctx.lineWidth = 0.8;
      const step = 6;
      for (let i = -rh; i < rw + rh; i += step) {
        ctx.beginPath();
        ctx.moveTo(rx + i, ry);
        ctx.lineTo(rx + i + rh, ry + rh);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx, ry, rw, rh);
    };

    // Zone 1 Staging Racks — hatched
    drawHatchRect(
      mapX(-5.4), mapY(-1.5), mapX(-2.0) - mapX(-5.4), mapY(-8.0) - mapY(-1.5),
      'rgba(20, 30, 48, 0.8)', 'rgba(71, 85, 105, 0.9)', 'rgba(71, 85, 105, 0.35)'
    );

    // Zone 3 High-Bay Racks (left + right) — hatched
    drawHatchRect(
      mapX(-5.5), mapY(-18.5), mapX(-2.2) - mapX(-5.5), mapY(-27.0) - mapY(-18.5),
      'rgba(20, 30, 48, 0.8)', 'rgba(71, 85, 105, 0.9)', 'rgba(71, 85, 105, 0.35)'
    );
    drawHatchRect(
      mapX(2.2), mapY(-18.5), mapX(5.5) - mapX(2.2), mapY(-27.0) - mapY(-18.5),
      'rgba(20, 30, 48, 0.8)', 'rgba(71, 85, 105, 0.9)', 'rgba(71, 85, 105, 0.35)'
    );

    // Zone 4 Battery Charging Bay — teal tinted hatched
    drawHatchRect(
      mapX(-5.8), mapY(-29.0), mapX(-2.4) - mapX(-5.8), mapY(-35.0) - mapY(-29.0),
      'rgba(8, 60, 75, 0.45)', '#06b6d4', 'rgba(6, 182, 212, 0.22)'
    );

    // Zone 2 Forklift Cross-Transit Line — subtle, not dominant
    const juncTop = mapY(-11.5);
    const juncBottom = mapY(-15.5);
    ctx.fillStyle = 'rgba(234, 179, 8, 0.07)';
    ctx.fillRect(0, juncTop, W, juncBottom - juncTop);
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, juncTop); ctx.lineTo(W, juncTop); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, juncBottom); ctx.lineTo(W, juncBottom); ctx.stroke();
    ctx.setLineDash([]);

    // Central OSHA Pedestrian Walkway (High-Contrast Green Safety Zone)
    const walkLeft = mapX(-1.40);
    const walkRight = mapX(0.40);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
    ctx.fillRect(walkLeft, -H, walkRight - walkLeft, H * 3);
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(walkLeft, -H); ctx.lineTo(walkLeft, H * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(walkRight, -H); ctx.lineTo(walkRight, H * 2); ctx.stroke();

    // Active GPS Route Spline to Target — glow + animated chevron arrows
    if (this._awaitingArrival && targetZone) {
      const ax = mapX(alex.position.x);
      const ay = mapY(alex.position.z);
      const tx = mapX(targetZone.coords.x);
      const ty = mapY(targetZone.coords.z);
      const midX = mapX(0.0);

      ctx.save();
      // Glow underpass
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 6;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(ax, ay); ctx.lineTo(midX, ay); ctx.lineTo(midX, ty); ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Animated dash
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -((now / 45) % 10);
      ctx.beginPath();
      ctx.moveTo(ax, ay); ctx.lineTo(midX, ay); ctx.lineTo(midX, ty); ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);
      // Arrow chevrons along segments
      const segs = [
        { x1: ax, y1: ay, x2: midX, y2: ay },
        { x1: midX, y1: ay, x2: midX, y2: ty },
        { x1: midX, y1: ty, x2: tx, y2: ty },
      ];
      const chevSpacing = 30;
      const chevOffset = (now / 45) % chevSpacing;
      ctx.fillStyle = '#f59e0b';
      for (const seg of segs) {
        const sdx = seg.x2 - seg.x1, sdy = seg.y2 - seg.y1;
        const slen = Math.hypot(sdx, sdy);
        if (slen < 16) continue;
        const ang = Math.atan2(sdy, sdx);
        let d = chevOffset;
        while (d < slen - 8) {
          const cx = seg.x1 + (sdx / slen) * d;
          const cy = seg.y1 + (sdy / slen) * d;
          ctx.save();
          ctx.translate(cx, cy); ctx.rotate(ang);
          ctx.beginPath();
          ctx.moveTo(5, 0); ctx.lineTo(-3, -4); ctx.lineTo(-2, 0); ctx.lineTo(-3, 4);
          ctx.closePath(); ctx.fill();
          ctx.restore();
          d += chevSpacing;
        }
      }
      ctx.restore();
    }

    // Motion Breadcrumbs (Fading Footsteps Trail)
    if (this._trail.length > 1) {
      for (let i = 0; i < this._trail.length; i++) {
        const pt = this._trail[i];
        const age = (now - pt.time) / 5500;
        const alpha = Math.max(0, 1 - age) * 0.85;
        const px = mapX(pt.x);
        const py = mapY(pt.z);

        ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();

        if (i > 0) {
          const prev = this._trail[i - 1];
          ctx.strokeStyle = `rgba(52, 211, 153, ${alpha * 0.7})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(mapX(prev.x), mapY(prev.z));
          ctx.lineTo(px, py);
          ctx.stroke();
        }
      }
    }

    // Dynamic LiDAR 360° Sweep Line
    const sweepAngle = (now / 1200) * Math.PI * 2;
    const sweepRadius = W / 2 - 4;
    const sweepX = centerX + Math.cos(sweepAngle) * sweepRadius;
    const sweepY = centerY + Math.sin(sweepAngle) * sweepRadius;
    ctx.save();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(sweepX, sweepY);
    ctx.stroke();
    ctx.restore();

    // Dave Companion Marker — clipped inside radar circle, no floating text
    if (davePos) {
      const dvx = mapX(davePos.x);
      const dvy = mapY(davePos.z);
      const distDave = Math.hypot(alex.position.x - davePos.x, alex.position.z - davePos.z);
      // Only render if the dot is actually inside the circular clip area
      const inCircle = Math.hypot(dvx - centerX, dvy - centerY) < W / 2 - 8;

      if (inCircle && (distDave < 9.0 || this._radarMode === 'sector')) {
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(dvx, dvy, 7, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // 'D' label inside the dot — no floating text outside circle
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('D', dvx, dvy);
        ctx.textBaseline = 'alphabetic';
      }
    }

    // Facility Inspection Waypoints & Off-Screen Rim Indicator
    FACILITY_ZONES.forEach((z) => {
      const zx = mapX(z.coords.x);
      const zy = mapY(z.coords.z);
      const distZ = Math.hypot(alex.position.x - z.coords.x, alex.position.z - z.coords.z);
      const isCompleted = z.num <= this._currentStopIndex && !this._awaitingArrival;
      const isTarget = z.num === targetZone.num && this._awaitingArrival;

      if (distZ <= 8.5 || this._radarMode === 'sector') {
        // Pulsing ring for active target
        if (isTarget) {
          const pulse = (now % 1400) / 1400;
          ctx.strokeStyle = `rgba(245, 158, 11, ${(1 - pulse) * 0.9})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(zx, zy, 8 + pulse * 14, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#f59e0b';
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 14;
        } else if (isCompleted) {
          ctx.fillStyle = '#10b981';
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = '#64748b';
          ctx.shadowBlur = 0;
        }

        // Main dot
        ctx.beginPath();
        ctx.arc(zx, zy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Zone number inside dot
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(z.num), zx, zy);
        ctx.textBaseline = 'alphabetic';

        // Zone code label — pill badge background for readability
        const labelColor = isTarget ? '#fbbf24' : (isCompleted ? '#a7f3d0' : '#94a3b8');
        const codeLabel = z.code;
        ctx.font = '800 8px monospace';
        const lw = ctx.measureText(codeLabel).width;
        const lx = zx + 10;
        const ly = zy - 4;
        // Pill background
        ctx.fillStyle = 'rgba(10, 15, 26, 0.82)';
        ctx.beginPath();
        ctx.roundRect(lx - 2, ly, lw + 6, 11, 3);
        ctx.fill();
        ctx.fillStyle = labelColor;
        ctx.fillText(codeLabel, lx + 1, ly + 9);
      } else if (isTarget && this._radarMode === 'proximity') {
        // Off-screen waypoint pointer locked to radar perimeter rim
        const dx = z.coords.x - alex.position.x;
        const dz = z.coords.z - alex.position.z;
        const targetAngle = Math.atan2(dx, -dz);
        const rimRadius = W / 2 - 16;
        const rimX = centerX + Math.sin(targetAngle) * rimRadius;
        const rimY = centerY - Math.cos(targetAngle) * rimRadius;

        ctx.save();
        ctx.translate(rimX, rimY);
        ctx.rotate(targetAngle);

        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(6, 4);
        ctx.lineTo(0, 1);
        ctx.lineTo(-6, 4);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();

        // Distance badge
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
        ctx.lineWidth = 1;
        const label = `${z.code} • ${Math.round(distZ)}m`;
        ctx.font = '900 8px monospace';
        const txtW = ctx.measureText(label).width;
        const badgeX = Math.max(8, Math.min(W - txtW - 14, rimX - txtW / 2));
        const badgeY = Math.max(16, Math.min(H - 12, rimY + (rimY > centerY ? -14 : 16)));
        ctx.strokeRect(badgeX - 3, badgeY - 8, txtW + 6, 12);
        ctx.fillRect(badgeX - 3, badgeY - 8, txtW + 6, 12);
        ctx.fillStyle = '#facc15';
        ctx.fillText(label, badgeX, badgeY + 1);
      }
    });

    // Alex Player Marker (PROMINENT, HIGH-VISIBILITY NEON DELTA)
    const ax = mapX(alex.position.x);
    const ay = mapY(alex.position.z);

    // Forward laser guide beam — direction matches the chevron (sin for canvas-x, -cos for canvas-y)
    const laserDistPx = 80;
    const fwdLaserX = ax + Math.sin(headingRad) * laserDistPx;
    const fwdLaserY = ay - Math.cos(headingRad) * laserDistPx;
    ctx.save();
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = 'rgba(74, 222, 128, 1.0)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -((now / 40) % 9);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(fwdLaserX, fwdLaserY);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(headingRad);

    // Vision Cone — vibrant wide-angle flashlight
    const coneGrad = ctx.createRadialGradient(0, 0, 8, 0, -65, 70);
    coneGrad.addColorStop(0, 'rgba(74, 222, 128, 0.7)');
    coneGrad.addColorStop(0.5, 'rgba(74, 222, 128, 0.28)');
    coneGrad.addColorStop(1, 'rgba(74, 222, 128, 0)');
    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 70, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55);
    ctx.closePath();
    ctx.fill();

    // Walking Motion Ripples (two concurrent waves for clarity)
    if (isWalking) {
      const rip1 = ((now / 420) % 1);
      const rip2 = ((now / 420 + 0.5) % 1);
      for (const rip of [rip1, rip2]) {
        ctx.strokeStyle = `rgba(34, 197, 94, ${0.95 * (1 - rip)})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(0, 0, 12 + rip * 28, -Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8);
        ctx.stroke();
      }
    }

    // Outer glow halo ring around player
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.35)';
    ctx.lineWidth = 6;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();

    // Directional Chevron — larger and bolder (28px span)
    ctx.fillStyle = '#22c55e';
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.moveTo(0, -18);   // Forward tip
    ctx.lineTo(12, 11);   // Right wing
    ctx.lineTo(0, 4);     // Inner notch
    ctx.lineTo(-12, 11);  // Left wing
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // Center Core Locator Dot
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(0, 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();

    ctx.restore(); // restore circular clip

    // Circular Outer Border Glow & Ticks
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, W / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Cardinal tick markers on rim (N, E, S, W)
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', centerX, 10);
    ctx.fillText('S', centerX, H - 9);
    ctx.fillText('E', W - 9, centerY);
    ctx.fillText('W', 9, centerY);
    ctx.restore();
  }

  // ─── Full-Bleed Architectural Facility Blueprint Rendering ─────────────────
  _renderBlueprint() {
    const ctx = this._blueprintCtx;
    if (!ctx) return;
    const W = this._blueprintCanvas.width;
    const H = this._blueprintCanvas.height;
    const alex = this._chars?.alex;
    const dave = this._chars?.dave;
    const now = Date.now();
    const isWalking = (now - this._lastMoveTime) < 350 || this._walkSpeed > 0.12;

    // Deep architectural CAD blueprint background
    ctx.fillStyle = '#060d1b';
    ctx.fillRect(0, 0, W, H);

    // Coordinate Mapping (Dual-Mode Zoom: Overview vs. Tactical Follow)
    let zMin, zMax, xMin, xMax;
    if (this._viewMode === 'tactical' && alex) {
      const ax = alex.position.x;
      const az = alex.position.z;
      xMin = ax - 7.5;
      xMax = ax + 7.5;
      zMin = az - 11.0;
      zMax = az + 11.0;
    } else {
      // Overview mode: entire 56m facility
      xMin = -7.5;
      xMax = 7.5;
      zMin = -52.0;
      zMax = 2.0;
    }

    const pad = 48;
    const mapX = (x) => ((x - xMin) / (xMax - xMin)) * (W - pad * 2) + pad;
    const mapY = (z) => ((zMax - z) / (zMax - zMin)) * (H - pad * 2) + pad;

    // 1. Engineering CAD Grid
    ctx.strokeStyle = 'rgba(30, 58, 138, 0.28)';
    ctx.lineWidth = 1;
    for (let x = -8; x <= 8; x += 1) {
      const mx = mapX(x);
      if (mx >= 0 && mx <= W) {
        ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, H); ctx.stroke();
      }
    }
    for (let z = 4; z >= -54; z -= 2) {
      const my = mapY(z);
      if (my >= 0 && my <= H) {
        ctx.beginPath(); ctx.moveTo(0, my); ctx.lineTo(W, my); ctx.stroke();
      }
    }

    // 2. Outer Structural Facility Walls (14m span x 56m depth)
    const wallLeft = mapX(-6.0);
    const wallRight = mapX(6.0);
    const wallTop = mapY(1.5);
    const wallBottom = mapY(-49.5);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(wallLeft, wallTop, wallRight - wallLeft, wallBottom - wallTop);

    // Dimension Callouts (Overview mode)
    if (this._viewMode === 'overview') {
      ctx.fillStyle = '#64748b';
      ctx.font = '900 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('◄── 14.0m CLEAR SPAN ──►', (wallLeft + wallRight) / 2, wallTop - 12);
      ctx.save();
      ctx.translate(wallLeft - 14, (wallTop + wallBottom) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('◄── 56.0m FACILITY LOGISTICS AISLE ──►', 0, 0);
      ctx.restore();
    }

    // 3. High-Bay Structural Pallet Racking
    // Zone 1: Chemical Drum Staging Area
    ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.fillRect(mapX(-5.5), mapY(-1.0), mapX(-2.0) - mapX(-5.5), mapY(-8.5) - mapY(-1.0));
    ctx.strokeRect(mapX(-5.5), mapY(-1.0), mapX(-2.0) - mapX(-5.5), mapY(-8.5) - mapY(-1.0));
    ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'left';
    ctx.fillText('FACILITY 01: HAZMAT DRUMS', mapX(-5.3), mapY(-1.5));

    // Zone 2: Forklift Cross-Aisle Intersection (Yellow Hazard Striping)
    if (this._layers.traffic) {
      const jt = mapY(-11.5); const jb = mapY(-15.5);
      ctx.fillStyle = 'rgba(234, 179, 8, 0.12)';
      ctx.fillRect(wallLeft, jt, wallRight - wallLeft, jb - jt);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(wallLeft, jt); ctx.lineTo(wallRight, jt); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wallLeft, jb); ctx.lineTo(wallRight, jb); ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#facc15'; ctx.font = '900 9px monospace'; ctx.textAlign = 'left';
      ctx.fillText('◄ FORKLIFT CROSSING (8 KM/H MAX)', wallLeft + 8, jt + 12);
    }

    // Zone 3: High-Bay Pallet Racks Aisle A & B
    ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
    ctx.strokeStyle = '#64748b';
    ctx.fillRect(mapX(-5.6), mapY(-18.5), mapX(-2.2) - mapX(-5.6), mapY(-27.5) - mapY(-18.5));
    ctx.strokeRect(mapX(-5.6), mapY(-18.5), mapX(-2.2) - mapX(-5.6), mapY(-27.5) - mapY(-18.5));
    ctx.fillRect(mapX(2.2), mapY(-18.5), mapX(5.6) - mapX(2.2), mapY(-27.5) - mapY(-18.5));
    ctx.strokeRect(mapX(2.2), mapY(-18.5), mapX(5.6) - mapX(2.2), mapY(-27.5) - mapY(-18.5));
    ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'left';
    ctx.fillText('AISLE A RACKING', mapX(-5.3), mapY(-19.2));
    ctx.fillText('AISLE B RACKING', mapX(2.5), mapY(-19.2));

    // Zone 4: Battery Charging Bay
    ctx.fillStyle = 'rgba(14, 116, 144, 0.22)';
    ctx.strokeStyle = '#06b6d4';
    ctx.fillRect(mapX(-5.8), mapY(-29.0), mapX(-2.4) - mapX(-5.8), mapY(-35.5) - mapY(-29.0));
    ctx.strokeRect(mapX(-5.8), mapY(-29.0), mapX(-2.4) - mapX(-5.8), mapY(-35.5) - mapY(-29.0));
    ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'left';
    ctx.fillText('CHARGING BAY 04 (480V)', mapX(-5.5), mapY(-29.6));

    // Zone 5: Loading Dock & Freight Doors
    ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
    ctx.strokeStyle = '#64748b';
    ctx.fillRect(wallLeft, mapY(-48.5), wallRight - wallLeft, wallBottom - mapY(-48.5));
    ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
    ctx.fillText('OVERHEAD DOCK DOORS [BAY 01 - 02]', (wallLeft + wallRight) / 2, mapY(-49.2));

    // Central OSHA Pedestrian Walkway (Green Epoxy + Yellow Edges)
    const wl = mapX(-1.40); const wr = mapX(0.40);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
    ctx.fillRect(wl, wallTop, wr - wl, wallBottom - wallTop);
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(wl, wallTop); ctx.lineTo(wl, wallBottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wr, wallTop); ctx.lineTo(wr, wallBottom); ctx.stroke();

    // Active GPS Route Spline to Target Zone — animated + arrow chevrons
    const targetZone = FACILITY_ZONES[this._activeTargetIndex] || FACILITY_ZONES[0];
    if (alex && targetZone && this._awaitingArrival) {
      const ax = mapX(alex.position.x);
      const ay = mapY(alex.position.z);
      const tx = mapX(targetZone.coords.x);
      const ty = mapY(targetZone.coords.z);
      const midX = mapX(0.0);

      // Route glow base pass
      ctx.save();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 9;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(midX, ay);
      ctx.lineTo(midX, ty);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Animated dashed line on top
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 7]);
      ctx.lineDashOffset = -((now / 35) % 17);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(midX, ay);
      ctx.lineTo(midX, ty);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw animated arrow chevrons along the route segments
      const routeSegs = [
        { x1: ax, y1: ay, x2: midX, y2: ay },
        { x1: midX, y1: ay, x2: midX, y2: ty },
        { x1: midX, y1: ty, x2: tx, y2: ty },
      ];
      const chevronSpacing = 44;
      const chevronOffset = (now / 35) % chevronSpacing;
      ctx.fillStyle = '#f59e0b';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 10;
      for (const seg of routeSegs) {
        const dx = seg.x2 - seg.x1;
        const dy = seg.y2 - seg.y1;
        const len = Math.hypot(dx, dy);
        if (len < 20) continue;
        const ux = dx / len;
        const uy = dy / len;
        const angle = Math.atan2(dy, dx);
        let d = chevronOffset;
        while (d < len - 10) {
          const cx = seg.x1 + ux * d;
          const cy = seg.y1 + uy * d;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(7, 0);
          ctx.lineTo(-4, -5);
          ctx.lineTo(-2, 0);
          ctx.lineTo(-4, 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          d += chevronSpacing;
        }
      }
      ctx.shadowBlur = 0;

      // Pulsing target ring at destination
      const pulse = (now % 1200) / 1200;
      ctx.strokeStyle = `rgba(251, 191, 36, ${1 - pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tx, ty, 18 + pulse * 20, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // Dynamic Footstep Breadcrumb Trail (fading historical locomotion)
    if (this._trail.length > 1) {
      for (let i = 0; i < this._trail.length; i++) {
        const pt = this._trail[i];
        const age = (now - pt.time) / 5500;
        const alpha = Math.max(0, 1 - age) * 0.8;
        const radius = (1 - age * 0.4) * 3.5;
        const px = mapX(pt.x);
        const py = mapY(pt.z);

        ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();

        if (i > 0) {
          const prev = this._trail[i - 1];
          ctx.strokeStyle = `rgba(52, 211, 153, ${alpha * 0.6})`;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(mapX(prev.x), mapY(prev.z));
          ctx.lineTo(px, py);
          ctx.stroke();
        }
      }
    }

    // Layer: Hazards
    if (this._layers.hazards) {
      FACILITY_ZONES.forEach((z) => {
        const hx = mapX(z.hazardCoords.x);
        const hy = mapY(z.hazardCoords.z);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(hx, hy, 12, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.font = '900 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️', hx, hy + 4);
      });
    }

    // Layer: Emergency Response Hubs
    if (this._layers.emergency) {
      EMERGENCY_STATIONS.forEach((st) => {
        const sx = mapX(st.x);
        const sy = mapY(st.z);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = st.color;
        ctx.lineWidth = 1.8;
        ctx.strokeRect(sx - 13, sy - 13, 26, 26);
        ctx.fillRect(sx - 13, sy - 13, 26, 26);
        ctx.fillStyle = st.color;
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(st.icon, sx, sy + 4);
      });
    }

    // Layer: Inspection Zones (Z01 - Z05)
    if (this._layers.zones) {
      FACILITY_ZONES.forEach((z) => {
        const zx = mapX(z.coords.x);
        const zy = mapY(z.coords.z);
        const isCompleted = z.num <= this._currentStopIndex && !this._awaitingArrival;
        const isTarget = z.num === targetZone.num && this._awaitingArrival;

        if (isTarget) {
          const pulse = (now % 1400) / 1400;
          ctx.strokeStyle = `rgba(245, 158, 11, ${1 - pulse})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(zx, zy, 10 + pulse * 14, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#f59e0b';
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 14;
        } else if (isCompleted) {
          ctx.fillStyle = '#10b981';
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = '#475569';
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.arc(zx, zy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#0f172a';
        ctx.font = '900 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(z.num), zx, zy + 3.5);

        ctx.fillStyle = isTarget ? '#fbbf24' : (isCompleted ? '#a7f3d0' : '#cbd5e1');
        ctx.font = '900 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(z.code, zx + 14, zy + 4);
      });
    }

    // Dave Companion Marker (Offset from Alex)
    if (dave) {
      const dx = mapX(dave.position.x);
      const dy = mapY(dave.position.z);
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(dx, dy, 7, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('D', dx, dy + 3);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('DAVE (SUPERVISOR)', dx + 12, dy + 3.5);
    }

    // Alex Player Marker — MAXIMUM VISIBILITY (Large chevron + laser + halo)
    if (alex) {
      const ax = mapX(alex.position.x);
      const ay = mapY(alex.position.z);
      const headingRad = this._chars?._yawOf ? this._chars._yawOf(alex) : 0;

      // Forward heading laser — direction: sin for canvas-X, -cos for canvas-Y (matches chevron "up" direction)
      const laserDist = 9.0;
      const fwdX = alex.position.x + Math.sin(headingRad) * laserDist;
      const fwdZ = alex.position.z - Math.cos(headingRad) * laserDist;

      ctx.save();
      ctx.shadowColor = '#4ade80';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = 'rgba(74, 222, 128, 1.0)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -((now / 40) % 11);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(mapX(fwdX), mapY(fwdZ));
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(headingRad);

      // Wide vibrant vision cone
      const coneGrad = ctx.createRadialGradient(0, 0, 6, 0, -70, 85);
      coneGrad.addColorStop(0, 'rgba(74, 222, 128, 0.6)');
      coneGrad.addColorStop(0.5, 'rgba(74, 222, 128, 0.2)');
      coneGrad.addColorStop(1, 'rgba(74, 222, 128, 0)');
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 85, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55);
      ctx.closePath();
      ctx.fill();

      // Two-wave walking motion ripples
      if (isWalking) {
        const rip1 = ((now / 420) % 1);
        const rip2 = ((now / 420 + 0.5) % 1);
        for (const rip of [rip1, rip2]) {
          ctx.strokeStyle = `rgba(34, 197, 94, ${0.95 * (1 - rip)})`;
          ctx.lineWidth = 3.5;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(0, 0, 14 + rip * 32, -Math.PI / 2 - 0.85, -Math.PI / 2 + 0.85);
          ctx.stroke();
        }
      }

      // Outer halo pulse ring
      const halopulse = (now % 1600) / 1600;
      ctx.strokeStyle = `rgba(34, 197, 94, ${0.6 * (1 - halopulse)})`;
      ctx.lineWidth = 4;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(0, 0, 18 + halopulse * 14, 0, Math.PI * 2);
      ctx.stroke();

      // Directional Chevron — large, maximum glow
      ctx.fillStyle = '#22c55e';
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 28;
      ctx.beginPath();
      ctx.moveTo(0, -20);   // Forward tip
      ctx.lineTo(14, 13);   // Right wing
      ctx.lineTo(0, 5);     // Inner notch
      ctx.lineTo(-14, 13);  // Left wing
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Center pivot dot
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 5, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();
    }
  }
}
