/**
 * Minimap.js
 *
 * Site map for the safety walk, drawn with one shared floor-plan renderer so
 * both views look the same:
 *  - Compact map (top-right): follows Alex with "forward" (-z) up, matching
 *    the 3D view's left/right. Shows the route to the next zone and an edge
 *    pointer when that zone is off the map. Click it or press [M] to expand.
 *  - Full map modal: the whole warehouse laid out left-to-right, with an
 *    Overview / Follow zoom ([Z]) and a zone status strip.
 *  - Spatial arrival trigger: walking into the next zone with WASD advances
 *    the scenario, same as pressing continue.
 */

// Floor plan in world metres (x: left/right, z: entrance 1.5 → dock -49.5)
const BUILDING = { x1: -6.0, x2: 6.0, z1: 1.5, z2: -49.5 };
const WALKWAY = { x1: -1.4, x2: 0.4 };
const CROSSING = { z1: -11.5, z2: -15.5 };

const BLOCKS = [
  { x1: -5.5, z1: -1.0, x2: -2.0, z2: -8.5, label: 'Drum storage' },
  { x1: -5.6, z1: -18.5, x2: -2.2, z2: -27.5, label: 'Racking A' },
  { x1: 2.2, z1: -18.5, x2: 5.6, z2: -27.5, label: 'Racking B' },
  { x1: -5.8, z1: -29.0, x2: -2.4, z2: -35.5, label: 'Charging bay', tint: 'amber' },
  { x1: -6.0, z1: -48.5, x2: 6.0, z2: -49.5, label: 'Loading dock', labelBelow: true }
];

const FACILITY_ZONES = [
  { num: 1, name: 'Chemical Drum Storage', coords: { x: 0.15, z: -4.5 }, hazard: { x: -0.2, z: -5.4 } },
  { num: 2, name: 'Blind-Corner Transit', coords: { x: 0.30, z: -13.5 }, hazard: { x: -4.0, z: -13.5 } },
  { num: 3, name: 'High-Bay Pallet Racking', coords: { x: -0.90, z: -22.5 }, hazard: { x: -2.3, z: -22.0 } },
  { num: 4, name: 'MHE Battery Charging Bay', coords: { x: 0.40, z: -32.2 }, hazard: { x: -4.8, z: -32.0 } },
  { num: 5, name: 'Loading Dock & Emergency Hub', coords: { x: 0.00, z: -46.5 }, hazard: { x: 1.2, z: -47.5 } }
];

const EMERGENCY_STATIONS = [
  { x: 0.8, z: -47.2 }, { x: 1.4, z: -47.2 }, { x: 1.2, z: -47.5 }, { x: -1.6, z: -47.4 }
];

// In-game palette (matches the HUD and action menu tokens in main.css)
const C = {
  bg: '#0d141c',
  floor: '#121c26',
  wall: 'rgba(247, 244, 213, 0.26)',
  block: 'rgba(247, 244, 213, 0.05)',
  blockEdge: 'rgba(247, 244, 213, 0.16)',
  amberFill: 'rgba(224, 163, 82, 0.08)',
  amberEdge: 'rgba(224, 163, 82, 0.38)',
  walkway: 'rgba(131, 153, 88, 0.16)',
  walkwayEdge: 'rgba(224, 163, 82, 0.5)',
  crossing: 'rgba(224, 163, 82, 0.08)',
  label: 'rgba(247, 244, 213, 0.5)',
  accent: '#9bb56a',
  target: '#e0a352',
  hazard: '#d3968c',
  player: '#f7f4d5',
  dave: '#4fb0c6',
  upcoming: 'rgba(247, 244, 213, 0.34)'
};

const COMPACT_RADIUS_M = 9;
const FOLLOW_ZOOM = 2.2;
const FONT = "'Inter', system-ui, sans-serif";

const ICON_EXPAND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

const pad2 = (n) => String(n).padStart(2, '0');

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
    this._done = new Set();

    this._trail = []; // recent { x, z, time } footsteps
    this._viewMode = 'overview'; // full map: 'overview' | 'follow'
    this._isExpanded = false;
    this._reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    this._createDOM();
    this._wireEvents();
    this._updateObjectiveDisplay();
  }

  _createDOM() {
    const pod = document.createElement('div');
    pod.id = 'hud-minimap';
    pod.className = 'mm-pod';
    pod.innerHTML = `
      <div class="mm-head">
        <span class="mm-title">Site Map</span>
        <span class="mm-progress" id="mm-progress">0 / 5 zones</span>
      </div>
      <button type="button" class="mm-scope" id="mm-scope" aria-label="Open full site map (M)">
        <canvas id="mm-canvas" aria-hidden="true"></canvas>
        <span class="mm-expand">${ICON_EXPAND}</span>
      </button>
      <div class="mm-foot">
        <div class="mm-objective"><span class="mm-obj-dot"></span><span id="mm-objective"></span></div>
      </div>
    `;

    const modal = document.createElement('div');
    modal.id = 'site-map-modal';
    modal.className = 'mm-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="mm-modal-backdrop" id="mm-backdrop"></div>
      <div class="mm-window" role="dialog" aria-modal="true" aria-labelledby="mm-modal-title">
        <div class="mm-window-head">
          <div class="mm-window-title">
            <span class="mm-eyebrow">Warehouse floor plan</span>
            <h2 id="mm-modal-title">Site Map</h2>
          </div>
          <div class="mm-objective-pill"><span class="mm-obj-dot"></span><span id="mm-modal-objective"></span></div>
          <div class="mm-view-toggle" role="group" aria-label="Map zoom">
            <button type="button" data-view="overview" aria-pressed="true">Overview</button>
            <button type="button" data-view="follow" aria-pressed="false">Follow</button>
          </div>
          <button type="button" class="mm-close" id="mm-close" aria-label="Close site map">${ICON_CLOSE}</button>
        </div>

        <div class="mm-map-wrap">
          <canvas id="mm-full-canvas" aria-label="Warehouse floor plan showing zones, Alex and Dave"></canvas>
          <ul class="mm-legend">
            <li><span class="mm-sw walk"></span>Walkway</li>
            <li><span class="mm-sw cross"></span>Forklift crossing</li>
            <li><span class="mm-sw route"></span>Route to next zone</li>
            <li><span class="mm-sw hazard"></span>Hazard</li>
            <li><span class="mm-sw you"></span>Alex (you)</li>
            <li><span class="mm-sw dave"></span>Dave</li>
          </ul>
        </div>

        <ol class="mm-zone-list" id="mm-zone-list"></ol>

        <div class="mm-window-foot">
          <kbd>WASD</kbd> Move <span aria-hidden="true">·</span>
          <kbd>Z</kbd> Zoom <span aria-hidden="true">·</span>
          <kbd>M</kbd> or <kbd>Esc</kbd> Close
        </div>
      </div>
    `;

    document.body.appendChild(pod);
    document.body.appendChild(modal);

    this._podEl = pod;
    this._modalEl = modal;
    this._scopeBtn = pod.querySelector('#mm-scope');
    this._canvas = pod.querySelector('#mm-canvas');
    this._ctx = this._canvas.getContext('2d');
    this._fullCanvas = modal.querySelector('#mm-full-canvas');
    this._fullCtx = this._fullCanvas.getContext('2d');
    this._progressEl = pod.querySelector('#mm-progress');
    this._objectiveEl = pod.querySelector('#mm-objective');
    this._modalObjectiveEl = modal.querySelector('#mm-modal-objective');
    this._zoneListEl = modal.querySelector('#mm-zone-list');
    this._viewBtns = [...modal.querySelectorAll('[data-view]')];

    this._scopeBtn.addEventListener('click', () => this.openMap());
    modal.querySelector('#mm-close').addEventListener('click', () => this.closeMap());
    modal.querySelector('#mm-backdrop').addEventListener('click', () => this.closeMap());
    this._viewBtns.forEach(btn => btn.addEventListener('click', () => this.setViewMode(btn.dataset.view)));
    this._fullCanvas.addEventListener('click', () => {
      this.setViewMode(this._viewMode === 'overview' ? 'follow' : 'overview');
    });

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.repeat) return;
      if (e.code === 'KeyM') {
        e.preventDefault();
        this.toggleMap();
      } else if (e.code === 'Escape' && this._isExpanded) {
        e.preventDefault();
        this.closeMap();
      } else if (e.code === 'KeyZ' && this._isExpanded) {
        e.preventDefault();
        this.setViewMode(this._viewMode === 'overview' ? 'follow' : 'overview');
      }
    });
  }

  setViewMode(mode) {
    this._viewMode = mode;
    this._viewBtns.forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.view === mode)));
    if (this._isExpanded) this._renderFull();
  }

  toggleMap() {
    if (this._isExpanded) this.closeMap();
    else this.openMap();
  }

  openMap() {
    this._isExpanded = true;
    this._modalEl.hidden = false;
    this._renderFull();
    this._modalEl.querySelector('#mm-close').focus();
  }

  closeMap() {
    if (!this._isExpanded) return;
    this._isExpanded = false;
    this._modalEl.hidden = true;
    if (this._podEl.style.display !== 'none') this._scopeBtn.focus({ preventScroll: true });
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
      this._done.add(this._currentStopIndex);
      if (this._currentStopIndex < FACILITY_ZONES.length - 1) {
        this._activeTargetIndex = this._currentStopIndex + 1;
        this._awaitingArrival = true;
        this._hasTriggeredForTarget = false;
      }
      this._updateObjectiveDisplay();
    });

    this._bus.on('session:complete', () => {
      this._awaitingArrival = false;
      this._podEl.style.display = 'none';
      this.closeMap();
    });
  }

  /** 'done' | 'next' (walking to it) | 'active' (inspecting) | 'upcoming' */
  _zoneState(index) {
    if (this._done.has(index)) return 'done';
    if (index === this._activeTargetIndex) return this._awaitingArrival ? 'next' : 'active';
    return 'upcoming';
  }

  _objectiveText(distance) {
    const zone = FACILITY_ZONES[this._activeTargetIndex];
    if (this._done.size >= FACILITY_ZONES.length) return 'All zones inspected';
    if (this._awaitingArrival) {
      const dist = distance !== undefined ? ` · ${Math.round(distance)} m` : '';
      return `Next: Zone ${pad2(zone.num)}${dist}`;
    }
    return `Inspecting Zone ${pad2(zone.num)}`;
  }

  _updateObjectiveDisplay() {
    const zone = FACILITY_ZONES[this._activeTargetIndex];
    const state = this._awaitingArrival ? 'next' : 'active';
    this._podEl.dataset.state = state;
    this._modalEl.dataset.state = state;
    this._progressEl.textContent = `${this._done.size} / ${FACILITY_ZONES.length} zones`;
    this._objectiveEl.textContent = this._objectiveText();
    this._modalObjectiveEl.textContent = `${this._objectiveText()} — ${zone.name}`;

    const labels = { done: 'Inspected', next: 'Next', active: 'Inspecting', upcoming: 'Upcoming' };
    this._zoneListEl.innerHTML = FACILITY_ZONES.map((z, i) => {
      const s = this._zoneState(i);
      return `
        <li class="mm-zone is-${s}">
          <span class="mm-zone-badge">${z.num}</span>
          <span class="mm-zone-text">
            <span class="mm-zone-state">${labels[s]}</span>
            <span class="mm-zone-name">${z.name}</span>
          </span>
        </li>
      `;
    }).join('');
  }

  /**
   * Called on every frame from the Three.js render loop.
   */
  update() {
    const alex = this._chars?.alex;
    if (!alex) return;

    const now = performance.now();
    const pos = alex.position;

    // Footstep trail
    const last = this._trail[this._trail.length - 1];
    if (!last || Math.hypot(pos.x - last.x, pos.z - last.z) > 0.35) {
      this._trail.push({ x: pos.x, z: pos.z, time: now });
      if (this._trail.length > 40) this._trail.shift();
    }
    this._trail = this._trail.filter(pt => now - pt.time < 6000);

    const targetZone = FACILITY_ZONES[this._activeTargetIndex] || FACILITY_ZONES[0];
    const distToTarget = Math.hypot(pos.x - targetZone.coords.x, pos.z - targetZone.coords.z);

    if (this._awaitingArrival) {
      const text = this._objectiveText(distToTarget);
      if (this._objectiveEl.textContent !== text) this._objectiveEl.textContent = text;
    }

    // Spatial proximity trigger for keyboard (WASD) movement
    if (this._awaitingArrival && !this._hasTriggeredForTarget && this._chars?.isSettled !== false) {
      if (Math.abs(pos.z - targetZone.coords.z) < 1.6 && Math.abs(pos.x - targetZone.coords.x) < 2.0) {
        this._hasTriggeredForTarget = true;
        this._awaitingArrival = false;
        this._updateObjectiveDisplay();
        this._bus.emit('ui:continue');
      }
    }

    this._renderCompact(now);
    if (this._isExpanded) this._renderFull(now);
  }

  // ─── Canvas helpers ────────────────────────────────────────────────────────

  /** Match the backing store to CSS size × devicePixelRatio; returns CSS px size. */
  _fit(canvas, ctx) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return null;
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { W: w, H: h };
  }

  _rect(toS, x1, z1, x2, z2) {
    const [ax, ay] = toS(x1, z1);
    const [bx, by] = toS(x2, z2);
    return [Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay)];
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  /**
   * Shared floor plan. `toS(x, z)` maps world metres to canvas px; `s` is px per metre.
   */
  _drawFloor(ctx, toS, s, { full }) {
    // Building shell + floor
    const [bx, by, bw, bh] = this._rect(toS, BUILDING.x1, BUILDING.z1, BUILDING.x2, BUILDING.z2);
    this._roundRect(ctx, bx, by, bw, bh, 4);
    ctx.fillStyle = C.floor;
    ctx.fill();
    ctx.strokeStyle = C.wall;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Forklift crossing band
    const [cx, cy, cw, ch] = this._rect(toS, BUILDING.x1, CROSSING.z1, BUILDING.x2, CROSSING.z2);
    ctx.fillStyle = C.crossing;
    ctx.fillRect(cx, cy, cw, ch);
    ctx.save();
    ctx.strokeStyle = C.amberEdge;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(cx, cy, cw, ch);
    ctx.restore();

    // Racking, bays, dock
    for (const b of BLOCKS) {
      const [x, y, w, h] = this._rect(toS, b.x1, b.z1, b.x2, b.z2);
      this._roundRect(ctx, x, y, w, h, 3);
      ctx.fillStyle = b.tint === 'amber' ? C.amberFill : C.block;
      ctx.fill();
      ctx.strokeStyle = b.tint === 'amber' ? C.amberEdge : C.blockEdge;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Pedestrian walkway
    const [wx, wy, ww, wh] = this._rect(toS, WALKWAY.x1, BUILDING.z1, WALKWAY.x2, BUILDING.z2);
    ctx.fillStyle = C.walkway;
    ctx.fillRect(wx, wy, ww, wh);
    ctx.strokeStyle = C.walkwayEdge;
    ctx.lineWidth = 1;
    if (ww > wh) {
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + ww, wy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wx, wy + wh); ctx.lineTo(wx + ww, wy + wh); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx, wy + wh); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wx + ww, wy); ctx.lineTo(wx + ww, wy + wh); ctx.stroke();
    }

    if (!full) return;

    // Area labels, tucked along each area's top edge so markers stay readable
    ctx.font = `600 ${Math.max(10, Math.min(12, s * 0.55))}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.label;
    for (const b of BLOCKS) {
      const [x, y, w, h] = this._rect(toS, b.x1, b.z1, b.x2, b.z2);
      if (b.labelBelow) {
        ctx.textAlign = 'center';
        ctx.fillText(b.label, x + w / 2, y + h + 11);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(b.label, x + 8, y + 11);
      }
    }
    ctx.textAlign = 'center';
    const [lx, ly] = toS(5.2, (CROSSING.z1 + CROSSING.z2) / 2);
    ctx.fillText('Forklift crossing', lx, ly);

    // Emergency stations
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 1.2;
    for (const st of EMERGENCY_STATIONS) {
      const [sx, sy] = toS(st.x, st.z);
      ctx.strokeRect(sx - 3.5, sy - 3.5, 7, 7);
    }

    // Hazards
    for (const z of FACILITY_ZONES) {
      const [hx, hy] = toS(z.hazard.x, z.hazard.z);
      ctx.beginPath();
      ctx.moveTo(hx, hy - 5);
      ctx.lineTo(hx + 5, hy + 4);
      ctx.lineTo(hx - 5, hy + 4);
      ctx.closePath();
      ctx.fillStyle = C.hazard;
      ctx.fill();
    }
  }

  _drawRoute(ctx, toS, now, alexPos, zone) {
    if (!this._awaitingArrival) return;
    const pts = [
      toS(alexPos.x, alexPos.z),
      toS(0, alexPos.z),
      toS(0, zone.coords.z),
      toS(zone.coords.x, zone.coords.z)
    ];
    ctx.save();
    ctx.strokeStyle = C.target;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = this._reducedMotion ? 0 : -((now / 60) % 11);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.restore();
  }

  _drawTrail(ctx, toS, now) {
    for (const pt of this._trail) {
      const alpha = Math.max(0, 1 - (now - pt.time) / 6000) * 0.5;
      const [px, py] = toS(pt.x, pt.z);
      ctx.fillStyle = `rgba(155, 181, 106, ${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawZones(ctx, toS, now, { full }) {
    const r = full ? 10 : 6.5;
    FACILITY_ZONES.forEach((z, i) => {
      const state = this._zoneState(i);
      const [zx, zy] = toS(z.coords.x, z.coords.z);

      if (state === 'next' && !this._reducedMotion) {
        const pulse = (now % 1600) / 1600;
        ctx.strokeStyle = `rgba(224, 163, 82, ${0.8 * (1 - pulse)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(zx, zy, r + 2 + pulse * r * 1.4, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(zx, zy, r, 0, Math.PI * 2);
      if (state === 'upcoming') {
        ctx.fillStyle = C.bg;
        ctx.fill();
        ctx.strokeStyle = C.upcoming;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = state === 'done' ? C.accent : C.target;
        ctx.fill();
      }

      ctx.fillStyle = state === 'upcoming' ? C.upcoming : C.bg;
      ctx.font = `700 ${full ? 11 : 8}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(z.num), zx, zy + 0.5);
    });
  }

  _drawCharacters(ctx, toS, s, { full }) {
    const alex = this._chars?.alex;
    const dave = this._chars?.dave;

    if (dave) {
      const [dx, dy] = toS(dave.position.x, dave.position.z);
      ctx.beginPath();
      ctx.arc(dx, dy, full ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = C.dave;
      ctx.fill();
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (!alex) return;
    const yaw = this._chars?._yawOf ? this._chars._yawOf(alex) : Math.PI;
    const [ax, ay] = toS(alex.position.x, alex.position.z);
    // Screen direction of Alex's forward vector (world forward is (sin yaw, cos yaw))
    const [fx, fy] = toS(alex.position.x + Math.sin(yaw), alex.position.z + Math.cos(yaw));
    const angle = Math.atan2(fx - ax, -(fy - ay));
    const k = full ? 1.3 : 0.85;

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);

    // Soft view cone
    const coneR = full ? 38 : 22;
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, coneR);
    grad.addColorStop(0, 'rgba(247, 244, 213, 0.22)');
    grad.addColorStop(1, 'rgba(247, 244, 213, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, coneR, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
    ctx.closePath();
    ctx.fill();

    // Arrow
    ctx.beginPath();
    ctx.moveTo(0, -9 * k);
    ctx.lineTo(6.5 * k, 7 * k);
    ctx.lineTo(0, 3.5 * k);
    ctx.lineTo(-6.5 * k, 7 * k);
    ctx.closePath();
    ctx.shadowColor = 'rgba(155, 181, 106, 0.7)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = C.player;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = C.bg;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  // ─── Compact map (follows Alex, forward up) ─────────────────────────────────
  _renderCompact(now) {
    const alex = this._chars?.alex;
    const size = this._fit(this._canvas, this._ctx);
    if (!size || !alex) return;
    const { W, H } = size;
    const ctx = this._ctx;
    const s = (Math.min(W, H) / 2) / COMPACT_RADIUS_M;
    const cx = W / 2;
    const cy = H / 2;
    const { x: ax, z: az } = alex.position;
    // x right, -z up: a proper top-down view (not mirrored) facing down the aisle
    const toS = (x, z) => [cx + (x - ax) * s, cy + (z - az) * s];

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    const zone = FACILITY_ZONES[this._activeTargetIndex] || FACILITY_ZONES[0];
    this._drawFloor(ctx, toS, s, { full: false });
    this._drawTrail(ctx, toS, now);
    this._drawRoute(ctx, toS, now, alex.position, zone);
    this._drawZones(ctx, toS, now, { full: false });
    this._drawCharacters(ctx, toS, s, { full: false });

    // Edge pointer when the next zone is off the map
    if (this._awaitingArrival) {
      const [tx, ty] = toS(zone.coords.x, zone.coords.z);
      const inset = 12;
      if (tx < inset || tx > W - inset || ty < inset || ty > H - inset) {
        const dx = tx - cx;
        const dy = ty - cy;
        const k = Math.min((W / 2 - inset) / Math.abs(dx || 1e-6), (H / 2 - inset) / Math.abs(dy || 1e-6));
        ctx.save();
        ctx.translate(cx + dx * k, cy + dy * k);
        ctx.rotate(Math.atan2(dy, dx) + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(6, 5);
        ctx.lineTo(-6, 5);
        ctx.closePath();
        ctx.fillStyle = C.target;
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // ─── Full map (whole warehouse, entrance left → dock right) ─────────────────
  _renderFull(now = performance.now()) {
    const size = this._fit(this._fullCanvas, this._fullCtx);
    if (!size) return;
    const { W, H } = size;
    const ctx = this._fullCtx;
    const alex = this._chars?.alex;

    const spanZ = BUILDING.z1 - BUILDING.z2;
    const spanX = BUILDING.x2 - BUILDING.x1;
    const padX = 36;
    const padY = 30;
    let s = Math.min((W - padX * 2) / spanZ, (H - padY * 2 - 18) / spanX);
    let midZ = (BUILDING.z1 + BUILDING.z2) / 2;

    if (this._viewMode === 'follow' && alex) {
      s *= FOLLOW_ZOOM;
      const halfViewZ = (W / 2 - padX) / s;
      const minMid = BUILDING.z2 + halfViewZ;
      const maxMid = BUILDING.z1 - halfViewZ;
      midZ = minMid < maxMid ? Math.min(maxMid, Math.max(minMid, alex.position.z)) : midZ;
    }

    // -z runs right, +x runs down: a proper (non-mirrored) top-down view
    const toS = (x, z) => [W / 2 + (midZ - z) * s, H / 2 - 9 + x * s];

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    const zone = FACILITY_ZONES[this._activeTargetIndex] || FACILITY_ZONES[0];
    this._drawFloor(ctx, toS, s, { full: true });
    this._drawTrail(ctx, toS, now);
    if (alex) this._drawRoute(ctx, toS, now, alex.position, zone);
    this._drawZones(ctx, toS, now, { full: true });
    this._drawCharacters(ctx, toS, s, { full: true });
  }
}
