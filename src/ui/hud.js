/**
 * HUD.js
 * 
 * Clean, borderless Top Navbar:
 *  - Left: Clean title & scenario metadata (Stop X of 5, Title, Location).
 *  - Center: Minimalist progress timeline (connected circular milestones, no capsule container).
 *  - Right: Clean typographic score counter & controls hint.
 */

const STOP_NAMES = [
  { id: 'stop_01', num: 1, name: 'Chemical Spill', zone: 'Drum Storage' },
  { id: 'stop_02', num: 2, name: 'Blind Corner', zone: 'Vehicle Transit' },
  { id: 'stop_03', num: 3, name: 'Pallet Racking', zone: 'High-Bay Storage' },
  { id: 'stop_04', num: 4, name: 'Battery Station', zone: 'Charging Bay' },
  { id: 'stop_05', num: 5, name: 'Loading Dock', zone: 'Dispatch Area' },
];

export class HUD {
  /**
   * @param {import('../engine/EventBus.js').EventBus} eventBus
   */
  constructor(eventBus) {
    this._el = document.getElementById('hud');
    this._stopIndex = 1;
    this._totalStops = 5;
    this._score = 0;
    this._currentStop = {
      id: 'stop_01',
      title: 'Ground-Level Fluid Hazard',
      location: 'Drum Storage Zone',
    };
    this._completedStops = new Set();

    this._render();

    eventBus.on('stop:entered', ({ stop }) => {
      this._stopIndex = parseInt(stop.id.split('_')[1], 10) || 1;
      this._currentStop = stop;
      this._render();
    });

    eventBus.on('score:changed', ({ total, delta = 0 }) => {
      this._score = total;
      if (this._stopIndex > 0) {
        this._completedStops.add(this._stopIndex);
      }
      this._render(delta > 0 ? `+${delta}` : '');
    });

    eventBus.on('stop:completed', ({ stopId }) => {
      const idx = parseInt(stopId.split('_')[1], 10);
      if (idx) this._completedStops.add(idx);
      this._render();
    });
  }

  _render(scoreDeltaText = '') {
    const currentMeta = STOP_NAMES[this._stopIndex - 1] || STOP_NAMES[0];
    const stopTitle = this._currentStop?.title || currentMeta.name;
    const locationName = currentMeta.zone;

    // Clean connected step timeline (no pill wrappers)
    const timelineHtml = STOP_NAMES.map((s, idx) => {
      const isCurrent = s.num === this._stopIndex;
      const isDone = this._completedStops.has(s.num) || s.num < this._stopIndex;
      
      let dotClass = 'pending';
      let content = s.num;
      if (isDone) {
        dotClass = 'completed';
        content = '✓';
      } else if (isCurrent) {
        dotClass = 'active';
      }

      return `
        <div class="timeline-node ${dotClass}">
          <span class="timeline-dot">${content}</span>
          <span class="timeline-text">${s.name}</span>
        </div>
        ${idx < STOP_NAMES.length - 1 ? `<div class="timeline-connector ${isDone ? 'done' : ''}"></div>` : ''}
      `;
    }).join('');

    this._el.innerHTML = `
      <nav class="nav-clean">
        <!-- 1. Left: Clean Title & Scenario Details -->
        <div class="nav-left">
          <span class="nav-title">Two Pairs of Eyes</span>
          <span class="nav-sep">/</span>
          <div class="nav-scenario-meta">
            <span class="scenario-name">Stop ${this._stopIndex}: ${stopTitle}</span>
            <span class="scenario-zone">${locationName}</span>
          </div>
        </div>

        <!-- 2. Center: Minimalist Step Timeline -->
        <div class="nav-center">
          <div class="timeline-track">
            ${timelineHtml}
          </div>
        </div>

        <!-- 3. Right: Clean Score -->
        <div class="nav-right">
          <div class="score-display">
            <span class="score-title">SCORE</span>
            <span class="score-num">${this._score}</span>
            <span class="score-denom">/ 25</span>
            ${scoreDeltaText ? `<span class="score-delta animate-pop">${scoreDeltaText}</span>` : ''}
          </div>
        </div>
      </nav>
    `;
  }
}
