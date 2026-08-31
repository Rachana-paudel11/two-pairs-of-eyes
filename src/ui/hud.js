/**
 * HUD.js
 * Renders the top-bar stop counter and score display.
 * Subscribes to: score:changed, stop:entered
 */
export class HUD {
  constructor(eventBus) {
    this._el = document.getElementById('hud');
    this._stopIndex = 0;
    this._totalStops = 5;
    this._score = 0;
    this._render();

    eventBus.on('stop:entered', ({ stop }) => {
      // Derive stop number from id e.g. "stop_03" -> 3
      this._stopIndex = parseInt(stop.id.split('_')[1], 10);
      this._render();
    });

    eventBus.on('score:changed', ({ total }) => {
      this._score = total;
      this._render();
    });
  }

  _render() {
    this._el.innerHTML = `
      <span class="hud-stop">
        Stop <strong>${this._stopIndex}</strong> of <strong>${this._totalStops}</strong>
      </span>
      <div class="hud-divider" aria-hidden="true"></div>
      <span class="hud-score">
        Score&nbsp;<strong>${this._score}</strong>&nbsp;/ 25
      </span>
    `;
  }
}
