/**
 * DialoguePanel.js
 * Shows Dave's dialogue speech bubble above the action menu.
 * Subscribes to: dialogue:line
 */
export class DialoguePanel {
  constructor(eventBus) {
    this._el = document.getElementById('dialogue-panel');

    eventBus.on('dialogue:line', ({ name, behaviour, line }) => {
      this._show(name, behaviour, line);
    });

    // Hide panel once player selects an action
    eventBus.on('action:resolved', () => this._hide());
  }

  _show(name, behaviour, line) {
    const initial = name.charAt(0).toUpperCase();
    this._el.innerHTML = `
      <div class="dialogue-header">
        <div class="dialogue-avatar" aria-hidden="true">${initial}</div>
        <span class="dialogue-name">${name}</span>
        <span class="dialogue-behaviour ${behaviour}">${behaviour}</span>
      </div>
      <p class="dialogue-text">"${line}"</p>
    `;
    this._el.removeAttribute('hidden');
  }

  _hide() {
    this._el.setAttribute('hidden', '');
    this._el.innerHTML = '';
  }
}
