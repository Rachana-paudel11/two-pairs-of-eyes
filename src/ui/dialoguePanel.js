// ── Dialogue Panel Module ───────────────────────────────────────────────────
// Manages the supervisor/hazard dialogue HUD, speaker avatar, role/behaviour badge,
// comms waveform animation, and action options.

import { renderActionMenu, hideActionMenu, initActionMenu } from './actionMenu.js';

let dialogueBox      = null;
let speakerEl        = null;
let roleEl           = null;
let avatarEl         = null;
let textEl           = null;
let closeBtn         = null;
let autoDismissTimer = null;
let isOpen           = false;
let currentOnClose   = null;

export function initDialoguePanel({ onActionSelect, onClose } = {}) {
  dialogueBox = document.querySelector('#dialogue');
  speakerEl   = document.querySelector('#dialogue-speaker');
  roleEl      = document.querySelector('#dialogue-role');
  avatarEl    = document.querySelector('#dialogue-avatar');
  textEl      = document.querySelector('#dialogue-text');
  closeBtn    = document.querySelector('#dialogue-close');

  initActionMenu({ onSelect: onActionSelect });

  if (onClose) currentOnClose = onClose;

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hideDialogue();
      if (currentOnClose) currentOnClose();
    });
  }
}

export function showDialogue(optionsOrSpeaker, roleArg, avatarArg, textArg, actionsArg = [], onSelectArg = null) {
  if (!dialogueBox) initDialoguePanel();
  if (!dialogueBox) return;

  if (autoDismissTimer) {
    clearTimeout(autoDismissTimer);
    autoDismissTimer = null;
  }

  let speaker = 'DAVE';
  let role = 'SUPERVISOR // H&S PATROL';
  let avatar = 'D';
  let text = '';
  let behaviour = 'dismissive';
  let actions = [];
  let onSelect = null;
  let autoDismissMs = 0;

  if (typeof optionsOrSpeaker === 'object' && optionsOrSpeaker !== null) {
    speaker = optionsOrSpeaker.speaker ?? speaker;
    role = optionsOrSpeaker.role ?? role;
    avatar = optionsOrSpeaker.avatar ?? (speaker ? speaker.charAt(0).toUpperCase() : 'D');
    text = optionsOrSpeaker.text ?? '';
    behaviour = optionsOrSpeaker.behaviour ?? 'dismissive';
    actions = optionsOrSpeaker.actions ?? [];
    onSelect = optionsOrSpeaker.onSelect ?? null;
    autoDismissMs = optionsOrSpeaker.autoDismissMs ?? 0;
  } else {
    speaker = optionsOrSpeaker || speaker;
    role = roleArg || role;
    avatar = avatarArg || (speaker ? speaker.charAt(0).toUpperCase() : 'D');
    text = textArg || '';
    actions = actionsArg || [];
    onSelect = onSelectArg || null;
  }

  if (speakerEl) speakerEl.textContent = String(speaker).toUpperCase();

  if (roleEl) {
    roleEl.style.display = 'none';
    roleEl.textContent = '';
  }

  if (avatarEl) {
    avatarEl.textContent = avatar || String(speaker).charAt(0).toUpperCase();
  }

  if (textEl) {
    textEl.textContent = text.startsWith('"') ? text : `"${text}"`;
  }

  if (actions && actions.length > 0) {
    renderActionMenu({ actions, onSelect });
  } else {
    hideActionMenu();
  }

  dialogueBox.style.display = 'block';
  isOpen = true;

  if (autoDismissMs > 0) {
    autoDismissTimer = setTimeout(() => {
      hideDialogue();
      if (currentOnClose) currentOnClose();
    }, autoDismissMs);
  }
}

export function hideDialogue() {
  if (autoDismissTimer) {
    clearTimeout(autoDismissTimer);
    autoDismissTimer = null;
  }
  hideActionMenu();
  if (dialogueBox) {
    dialogueBox.style.display = 'none';
  }
  isOpen = false;
}

export function isDialogueOpen() {
  return isOpen;
}
