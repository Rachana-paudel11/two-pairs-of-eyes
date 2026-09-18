/**
 * Debrief.js
 * End-of-walk Safety Inspection Overview.
 *  - Hero header: title, total-score ring and rank card.
 *  - Dave's sign-off, then a zone-by-zone report with a photo of each zone.
 *    Each row expands to show the full feedback and the key lesson.
 *  - Sidebar: inspection summary, quick actions (full report, zone photos).
 *  - Footer: mission tip and "Walk Again".
 */
import stopsData from '../data/stopsData.js';
import { DAVE_AVATAR_B64 } from './assets/daveAvatar.js';
import { saveInspectionReport } from '../utils/api.js';
// Imported (not served from /public) so Vite bundles them and the paths always resolve
import zone1Photo from './assets/zones/zone1.webp';
import zone2Photo from './assets/zones/zone2.webp';
import zone3Photo from './assets/zones/zone3.webp';
import zone4Photo from './assets/zones/zone4.webp';
import zone5Photo from './assets/zones/zone5.webp';

const PASS_MARK = 18;
const MAX_SCORE = 25;
const SHIELD_PATH = 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z';

const ICONS = {
  shield: `<path d="${SHIELD_PATH}"></path>`,
  shieldCheck: `<path d="${SHIELD_PATH}"></path><path d="m9 12 2 2 4-4"></path>`,
  shieldStar: `<path d="${SHIELD_PATH}"></path><path d="m12 7.5 1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4z"></path>`,
  user: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"></path>',
  power: '<path d="M12 2v10"></path><path d="M18.4 6.6a9 9 0 1 1-12.8 0"></path>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path><path d="M12 9v4M12 17h.01"></path>',
  x: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
  check: '<polyline points="20 6 9 17 4 12"></polyline>',
  bang: '<line x1="12" y1="5" x2="12" y2="14"></line><line x1="12" y1="19" x2="12.01" y2="19"></line>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"></path>',
  chevronRight: '<polyline points="9 18 15 12 9 6"></polyline>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>',
  bars: '<line x1="6" y1="20" x2="6" y2="14"></line><line x1="12" y1="20" x2="12" y2="9"></line><line x1="18" y1="20" x2="18" y2="4"></line>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"></path>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-5-5L5 21"></path>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>',
  refresh: '<polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>'
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

const TIERS = {
  optimal: { label: 'Optimal', mark: 'check', scoreIcon: 'star' },
  partial: { label: 'Partial', mark: 'bang', scoreIcon: 'bang' },
  neutral: { label: 'Neutral', mark: 'bang', scoreIcon: 'bang' },
  failure: { label: 'Risk / Hazard', mark: 'x', scoreIcon: 'alert' }
};

const ACTION_TITLES = {
  cordon_off:            'Cordon Off Area',
  report_only:           'Report Only',
  ignore:                'Ignore Hazard',
  hold_position:         'Hold Position & Alert',
  proceed_carefully:     'Proceed Carefully',
  walk_straight_through: 'Walk Straight Through',
  isolate_and_report:    'Isolate & Report',
  emergency_drill:       'Inspect Emergency Hub',
  continue_on:           'Continue On'
};

const ACTION_ICONS = {
  cordon_off:            'shieldCheck',
  report_only:           'file',
  ignore:                'x',
  hold_position:         'user',
  proceed_carefully:     'alert',
  walk_straight_through: 'x',
  isolate_and_report:    'power',
  emergency_drill:       'shieldCheck',
  continue_on:           'chevronRight'
};

const ACTION_NOTES = {
  cordon_off:            'Area secured',
  report_only:           'Logged for follow-up',
  ignore:                'No action taken',
  hold_position:         'Observed until clear',
  proceed_carefully:     'Moved on with caution',
  walk_straight_through: 'No action taken',
  isolate_and_report:    'Power isolated & reported',
  emergency_drill:       'Area clear, safety maintained',
  continue_on:           'Moved on'
};

const ZONE_METADATA = {
  stop_01: { zoneName: 'Ground-Level Fluid Hazard' },
  stop_02: { zoneName: 'Blind-Corner Forklift Traffic' },
  stop_03: { zoneName: 'Bent Pallet Rack Upright' },
  stop_04: { zoneName: 'Battery Charging Bay Warning Light' },
  stop_05: { zoneName: 'Clear Aisle & Emergency Hub' }
};

const ZONE_PHOTOS = [zone1Photo, zone2Photo, zone3Photo, zone4Photo, zone5Photo];
const zonePhoto = (num) => ZONE_PHOTOS[num - 1];

export class Debrief {
  /**
   * @param {object} eventBus
   */
  constructor(eventBus) {
    this._el = document.getElementById('debrief');
    this._deferredConsequences = [];

    eventBus.on('consequence:play', ({ deferred, consequence, feedback }) => {
      if (deferred) {
        this._deferredConsequences.push({ consequence, feedback });
      }
    });

    eventBus.on('session:complete', (data) => {
      this._data = data;
      this._render();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._galleryEl && !this._galleryEl.hidden) {
        this._closeGallery();
      }
    });
  }

  _render() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    const { total, tierCounts, log } = this._data;
    const counts = { optimal: 0, partial: 0, neutral: 0, failure: 0, ...tierCounts };
    const passed = total >= PASS_MARK && counts.failure === 0;

    // Rank & Dave's Reaction
    let rankTitle = 'Safety Champion';
    let rankSubtitle = 'Outstanding awareness. Keep leading the way!';
    let tone = 'good';
    let daveReaction = 'Awesome job, Alex! Walking these aisles with you proved how two pairs of eyes catch what one person misses. We secured that spill, held at the blind corner, caught that bent upright, and isolated the charger. Great leadership!';

    if (!passed) {
      rankTitle = 'Hazards Overlooked';
      rankSubtitle = 'Safety critical hazards bypassed during patrol.';
      tone = 'bad';
      daveReaction = 'We let some critical hazards slip past us today, Alex. Overlooking bent racks or overheating chargers leads straight to workplace injuries. Let’s stay sharper next walk.';
    } else if (total < MAX_SCORE) {
      rankTitle = 'Solid Inspection';
      rankSubtitle = 'Good standard maintained across the facility.';
      tone = 'ok';
      daveReaction = 'Good work out there, Alex! You made solid calls and kept the facility safe. Stay sharp, speak up, and keep leading by example!';
    }

    const ringOffset = 100 - Math.max(0, Math.min(1, total / MAX_SCORE)) * 100;

    // Compounding incident alerts if any
    const consequenceHTML = this._deferredConsequences.map(({ feedback }) => `
      <div class="db-alert" role="note">
        ${icon('alert')}
        <p><strong>Incident escalation:</strong> ${feedback}</p>
      </div>
    `).join('');

    const logMap = {};
    if (Array.isArray(log)) {
      log.forEach(entry => { logMap[entry.stopId] = entry; });
    }

    const zones = stopsData.stops.map((stop, i) => {
      const entry = logMap[stop.id] || { actionKey: 'emergency_drill', points: 5, outcome: 'optimal' };
      const tier = TIERS[entry.outcome] ? entry.outcome : 'optimal';
      const actionDef = (stop.actions && stop.actions[entry.actionKey]) || {};
      const points = entry.points !== undefined ? entry.points : 0;
      return {
        num: i + 1,
        name: (ZONE_METADATA[stop.id] || { zoneName: stop.title }).zoneName,
        tier,
        points,
        actionKey: entry.actionKey,
        actionTitle: ACTION_TITLES[entry.actionKey] || (entry.actionKey
          ? entry.actionKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          : 'Action Taken'),
        feedback: actionDef.feedback || stop.learning_objective || 'Zone inspected.',
        lesson: stop.learning_objective
      };
    });

    const rowsHTML = zones.map(z => `
      <article class="db-row tier-${z.tier}">
        <button type="button" class="db-row-main" aria-expanded="false" aria-controls="db-detail-${z.num}">
          <span class="db-cell db-zone">
            <span class="db-zone-num">${z.num}</span>
            <span class="db-zone-text">
              <span class="db-zone-tag">Zone ${z.num}</span>
              <span class="db-zone-name">${z.name}</span>
            </span>
          </span>
          <span class="db-cell db-photo"><img src="${zonePhoto(z.num)}" alt="" loading="lazy" decoding="async" /></span>
          <span class="db-cell db-action">
            <span class="db-action-icon">${icon(ACTION_ICONS[z.actionKey] || 'chevronRight')}</span>
            <span class="db-action-text">
              <span class="db-action-title">${z.actionTitle}</span>
              <span class="db-action-note">${ACTION_NOTES[z.actionKey] || TIERS[z.tier].label}</span>
            </span>
          </span>
          <span class="db-cell db-outcome">“${z.feedback}”</span>
          <span class="db-cell db-points">
            <span class="db-score-pill">${icon(TIERS[z.tier].scoreIcon)}<span>${z.points > 0 ? `+${z.points}` : z.points} / 5</span></span>
          </span>
          <span class="db-cell db-chevron">${icon('chevronRight')}</span>
        </button>
        <div class="db-row-detail" id="db-detail-${z.num}" hidden>
          <div>
            <span class="db-detail-label">Full feedback</span>
            <p>${z.feedback}</p>
          </div>
          ${z.lesson ? `
            <div>
              <span class="db-detail-label">Key lesson</span>
              <p>${z.lesson}</p>
            </div>
          ` : ''}
        </div>
      </article>
    `).join('');

    const summaryRows = ['optimal', 'partial', 'neutral', 'failure']
      .filter(t => t !== 'neutral' || counts.neutral > 0)
      .map(t => `
        <div class="tier-${t}">
          <dt><span class="db-dot"></span>${TIERS[t].label}</dt>
          <dd>${counts[t]}</dd>
        </div>
      `).join('');

    const galleryHTML = zones.map(z => `
      <figure class="db-photo-card tier-${z.tier}">
        <img src="${zonePhoto(z.num)}" alt="Zone ${z.num}: ${z.name}" loading="lazy" decoding="async" />
        <figcaption>
          <span class="db-zone-tag">Zone ${z.num}</span>
          <span class="db-photo-name">${z.name}</span>
        </figcaption>
      </figure>
    `).join('');

    this._el.innerHTML = `
      <div class="db-shell">
        <!-- 1. Hero header -->
        <header class="db-hero">
          <div class="db-hero-text">
            <span class="db-eyebrow">Warehouse Safety Walk</span>
            <h1 class="db-title">Safety Inspection Overview</h1>
            <p class="db-subtitle">All 5 warehouse zones inspected with Alex and Dave.</p>
            <div id="db-sync-badge" style="margin-top:6px;font-size:0.8rem;color:#94a3b8;display:inline-flex;align-items:center;gap:6px;">
              <span style="opacity:0.8">Saving inspection to database...</span>
            </div>
          </div>

          <div class="db-score tone-${tone}">
            <svg class="db-ring" viewBox="0 0 80 80" aria-hidden="true">
              <circle class="db-ring-track" cx="40" cy="40" r="33"></circle>
              <circle class="db-ring-fill" cx="40" cy="40" r="33" pathLength="100" style="--ring:${ringOffset.toFixed(1)}"></circle>
            </svg>
            <div class="db-score-text">
              <span class="db-score-value"><strong class="${total < 0 ? 'is-negative' : ''}">${total}</strong> / ${MAX_SCORE}</span>
              <span class="db-score-label">Total Score</span>
            </div>
          </div>

          <div class="db-rank tone-${tone}">
            <span class="db-rank-icon">${icon(tone === 'bad' ? 'shieldStar' : 'shieldCheck')}</span>
            <span class="db-rank-text">
              <strong>${rankTitle}</strong>
              <span>${rankSubtitle}</span>
            </span>
          </div>
        </header>

        <div class="db-main">
          <div class="db-col">
            <!-- 2. Supervisor sign-off -->
            <section class="db-dave" aria-label="Supervisor feedback">
              <div class="db-dave-id">
                <img src="${DAVE_AVATAR_B64}" class="db-dave-avatar" alt="Supervisor Dave" />
                <div>
                  <strong class="db-dave-name">Dave</strong>
                  <span class="db-dave-role">Warehouse Shift Supervisor</span>
                </div>
              </div>
              <span class="db-dave-divider" aria-hidden="true"></span>
              <p class="db-dave-quote">“${daveReaction}”</p>
              <div class="db-dave-sign">
                <span class="db-dave-signature">Dave Miller</span>
                <span class="db-dave-signoff">Shift Supervisor Sign-off</span>
              </div>
            </section>

            ${consequenceHTML}

            <!-- 3. Zone-by-zone walk report -->
            <section class="db-report" aria-labelledby="db-report-title">
              <div class="db-report-head">
                <h2 id="db-report-title" class="db-report-title">${icon('pin')}<span>Zone-by-Zone Walk Report</span></h2>
                <ul class="db-legend">
                  <li class="tier-optimal"><span class="db-legend-mark">${icon('check')}</span>Optimal (+5 pts)</li>
                  <li class="tier-partial"><span class="db-legend-mark">${icon('bang')}</span>Partial (+3 pts)</li>
                  <li class="tier-failure"><span class="db-legend-mark">${icon('x')}</span>Risk / Hazard (-3 pts)</li>
                </ul>
              </div>

              <div class="db-cols" aria-hidden="true">
                <span class="db-col-zone">Zone</span>
                <span>Action Taken</span>
                <span>Your Response / Outcome</span>
                <span class="db-col-score">Score</span>
              </div>

              <div class="db-rows">
                ${rowsHTML}
              </div>
            </section>

            <!-- 4. Footer -->
            <footer class="db-footer">
              <p class="db-footer-tip">
                ${icon('eye')}
                <span><strong>Two Pairs of Eyes:</strong> Stay alert, speak up, and never walk past a hazard.</span>
              </p>
              <button type="button" class="db-walk-again" id="debrief-restart">
                ${icon('refresh')}
                <span>Walk Again</span>
              </button>
            </footer>
          </div>

          <!-- Sidebar -->
          <aside class="db-side">
            <section class="db-card">
              <h3 class="db-card-title">${icon('bars')}<span>Inspection Summary</span></h3>
              <dl class="db-summary">
                <div>
                  <dt>Total Zones</dt>
                  <dd>${zones.length}</dd>
                </div>
                ${summaryRows}
              </dl>
            </section>

            <section class="db-card">
              <h3 class="db-card-title">${icon('bolt')}<span>Quick Actions</span></h3>
              <div class="db-quick">
                <button type="button" class="db-quick-btn is-primary" id="db-expand-all" aria-pressed="false">
                  ${icon('file')}
                  <span class="db-quick-label">View Full Report</span>
                  ${icon('chevronRight')}
                </button>
                <button type="button" class="db-quick-btn" id="db-open-photos">
                  ${icon('image')}
                  <span class="db-quick-label">View Zone Photos</span>
                </button>
              </div>
            </section>

            <section class="db-brand" aria-hidden="true">
              ${icon('shieldStar')}
              <p>Safer People<br />Stronger Operations</p>
              <svg class="db-brand-waves" viewBox="0 0 240 90" fill="none" preserveAspectRatio="none">
                <path d="M0 70C50 40 90 90 140 60S220 20 240 36" stroke="currentColor" stroke-width="1.5"></path>
                <path d="M0 82C60 52 100 98 150 72S224 34 240 48" stroke="currentColor" stroke-width="1" opacity="0.6"></path>
              </svg>
            </section>
          </aside>
        </div>
      </div>

      <!-- Zone photo gallery -->
      <div class="db-gallery" id="db-gallery" hidden>
        <div class="db-gallery-card" role="dialog" aria-modal="true" aria-labelledby="db-gallery-title">
          <div class="db-gallery-head">
            <h2 id="db-gallery-title">Zone Photos</h2>
            <button type="button" class="db-gallery-close" id="db-gallery-close" aria-label="Close zone photos">${icon('x')}</button>
          </div>
          <div class="db-gallery-grid">
            ${galleryHTML}
          </div>
        </div>
      </div>
    `;

    this._el.removeAttribute('hidden');
    this._wire();

    // Persist inspection results to MongoDB
    const zoneLogs = zones.map((z) => ({
      stopId: `stop_0${z.num}`,
      zoneName: z.name,
      actionId: z.actionKey,
      delta: z.points,
      tier: z.tier
    }));

    saveInspectionReport({
      traineeName: 'Alex',
      traineeId: 'TR-ALEX-01',
      totalScore: total,
      maxScore: MAX_SCORE,
      passMark: PASS_MARK,
      passed,
      rankTitle,
      rankSubtitle,
      tierCounts: counts,
      zoneLogs,
      flags: this._data.flags || [],
      triggeredRules: this._data.triggeredRules || [],
      supervisorReaction: daveReaction
    }).then((res) => {
      const badgeEl = document.getElementById('db-sync-badge');
      if (badgeEl) {
        if (res.success) {
          badgeEl.innerHTML = `<span style="color:#34d399;display:inline-flex;align-items:center;gap:4px;font-weight:500;">${icon('shieldCheck')} Saved to MongoDB</span>`;
        } else {
          badgeEl.innerHTML = `<span style="color:#94a3b8;display:inline-flex;align-items:center;gap:4px;font-weight:500;">${icon('file')} Stored Locally</span>`;
        }
      }
    });
  }

  _wire() {
    const rows = [...this._el.querySelectorAll('.db-row-main')];
    const expandBtn = this._el.querySelector('#db-expand-all');

    const setOpen = (btn, open) => {
      btn.setAttribute('aria-expanded', String(open));
      btn.closest('.db-row').classList.toggle('is-open', open);
      document.getElementById(btn.getAttribute('aria-controls')).hidden = !open;
    };

    const syncExpandBtn = () => {
      const allOpen = rows.every(btn => btn.getAttribute('aria-expanded') === 'true');
      expandBtn.setAttribute('aria-pressed', String(allOpen));
      expandBtn.querySelector('.db-quick-label').textContent = allOpen ? 'Collapse Report' : 'View Full Report';
    };

    rows.forEach(btn => btn.addEventListener('click', () => {
      setOpen(btn, btn.getAttribute('aria-expanded') !== 'true');
      syncExpandBtn();
    }));

    expandBtn.addEventListener('click', () => {
      const open = expandBtn.getAttribute('aria-pressed') !== 'true';
      rows.forEach(btn => setOpen(btn, open));
      syncExpandBtn();
      if (open) rows[0]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

    this._galleryEl = this._el.querySelector('#db-gallery');
    this._galleryOpener = this._el.querySelector('#db-open-photos');
    this._galleryOpener.addEventListener('click', () => this._openGallery());
    this._el.querySelector('#db-gallery-close').addEventListener('click', () => this._closeGallery());
    this._galleryEl.addEventListener('click', (e) => {
      if (e.target === this._galleryEl) this._closeGallery();
    });

    document.getElementById('debrief-restart').addEventListener('click', () => {
      window.location.reload();
    });
  }

  _openGallery() {
    this._galleryEl.hidden = false;
    this._galleryEl.querySelector('#db-gallery-close').focus();
  }

  _closeGallery() {
    this._galleryEl.hidden = true;
    this._galleryOpener?.focus();
  }
}
