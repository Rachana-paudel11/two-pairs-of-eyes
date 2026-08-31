/**
 * Debrief.js
 * Full-screen end-of-session results screen.
 * Subscribes to: session:complete, consequence:play (deferred)
 */

const PASS_MARK = 18;

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
      this._show(data);
    });
  }

  _show({ total, tierCounts, log, flags, triggeredRules }) {
    const passed = total >= PASS_MARK && tierCounts.failure === 0;

    const consequenceHTML = this._deferredConsequences.length
      ? this._deferredConsequences.map(({ feedback }) => `
          <div class="debrief-consequence">
            <strong>Compounding Incident:</strong> ${feedback}
          </div>
        `).join('')
      : '';

    const tierHtml = `
      <div class="debrief-tiers">
        <span class="debrief-tier optimal">✅ Optimal x${tierCounts.optimal}</span>
        <span class="debrief-tier partial">⚠️ Partial x${tierCounts.partial}</span>
        <span class="debrief-tier failure">❌ Failure x${tierCounts.failure}</span>
      </div>
    `;

    this._el.innerHTML = `
      <div class="debrief-card">
        <p class="debrief-logo">Two Pairs of Eyes · End of Shift</p>

        <h1 class="debrief-title ${passed ? 'pass' : 'fail'}">
          ${passed ? 'Shift Complete' : 'Shift Failed'}
        </h1>

        <p style="color: var(--c-text-muted); font-size: 0.85rem; margin-bottom: 4px;">
          ${passed
            ? 'You identified and acted on the hazards that mattered.'
            : `Pass mark is ${PASS_MARK}/25 with no failed stops.`}
        </p>

        <div class="debrief-score-block">
          <div class="debrief-score-num">${total}</div>
          <div class="debrief-score-denom">out of 25 points</div>
          ${tierHtml}
        </div>

        ${consequenceHTML}

        <button class="debrief-restart-btn" id="debrief-restart" aria-label="Restart training">
          Restart Training
        </button>
      </div>
    `;

    this._el.removeAttribute('hidden');

    document.getElementById('debrief-restart').addEventListener('click', () => {
      // Hard reload to restart cleanly
      window.location.reload();
    });
  }
}
