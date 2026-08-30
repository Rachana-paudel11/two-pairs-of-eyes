// ── Action Menu Module ────────────────────────────────────────────────────────
// Renders contextual action buttons driven by the scenario engine and stop data.

let menuContainer = null;
let currentActions = [];
let currentOnSelect = null;
let keyListenerAttached = false;

const ACTION_DESCRIPTIONS = {
  cordon_off: 'Cordon off area immediately',
  report_only: 'Report to maintenance later',
  report: 'Report to maintenance later',
  ignore: 'Ignore & walk past',
  yield_and_wait: 'Hold position & yield right-of-way',
  honk_and_pass: 'Honk & proceed into intersection',
  tag_out_rack: 'Tag out & isolate damaged bay',
  lighten_load: 'Reduce load & continue operating',
  turn_off_charger: 'Isolate & shut down charging unit',
  unplug_live: 'Unplug cables without isolation',
  report_clutter: 'Log clear aisle status report',
  leave_area: 'Skip audit & leave zone'
};

export function initActionMenu({ containerEl, onSelect } = {}) {
  menuContainer = containerEl || document.querySelector('.dialogue-actions') || document.querySelector('#action-menu');
  if (onSelect) currentOnSelect = onSelect;

  if (!keyListenerAttached) {
    window.addEventListener('keydown', handleKeyDown);
    keyListenerAttached = true;
  }
}

function handleKeyDown(e) {
  if (!menuContainer || menuContainer.style.display === 'none' || !currentOnSelect) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

  const key = e.key.toLowerCase();

  if (/^[1-9]$/.test(key)) {
    const index = parseInt(key, 10) - 1;
    if (index >= 0 && index < currentActions.length) {
      e.preventDefault();
      currentOnSelect(currentActions[index]);
    }
  }
}

export function formatActionLabel(actionKey) {
  if (ACTION_DESCRIPTIONS[actionKey]) {
    return ACTION_DESCRIPTIONS[actionKey];
  }
  return actionKey
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function renderActionMenu({
  actions = [],
  stopData = null,
  onSelect = null
} = {}) {
  if (!menuContainer) {
    menuContainer = document.querySelector('.dialogue-actions') || document.querySelector('#action-menu');
  }
  if (!menuContainer) return;

  currentActions = [...actions];
  if (onSelect) currentOnSelect = onSelect;

  menuContainer.innerHTML = '';
  menuContainer.style.display = 'flex';

  currentActions.forEach((actionKey, idx) => {
    const btn = document.createElement('button');
    btn.className = `btn-dialogue-action btn-action-option action-type-${actionKey}`;
    btn.setAttribute('aria-label', `Option ${idx + 1}: ${formatActionLabel(actionKey)}`);
    btn.dataset.action = actionKey;

    btn.innerHTML = `
      <span class="key-badge">${idx + 1}</span>
      <span class="action-title">${formatActionLabel(actionKey)}</span>
    `;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentOnSelect) currentOnSelect(actionKey);
    });

    menuContainer.appendChild(btn);
  });
}

export function hideActionMenu() {
  if (menuContainer) {
    menuContainer.style.display = 'none';
    menuContainer.innerHTML = '';
  }
  currentActions = [];
}
