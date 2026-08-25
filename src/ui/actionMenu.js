// ── Action Menu Module ────────────────────────────────────────────────────────
// Renders contextual action buttons driven by the scenario engine and stop data.
// Displays contextual action names for dynamic interactivity.

let menuContainer = null;
let currentActions = [];
let currentOnSelect = null;
let keyListenerAttached = false;

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
    btn.setAttribute('aria-label', formatActionLabel(actionKey));

    btn.innerHTML = `
      <span class="action-title">${formatActionLabel(actionKey)}</span>
    `;

    btn.addEventListener('click', () => {
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
