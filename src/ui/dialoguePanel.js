<<<<<<< HEAD
// ── Dialogue Panel Module ───────────────────────────────────────────────────
// Manages the interactive dialogue box, speaker badge, peek view, and decision buttons.
import { renderActionMenu, hideActionMenu, initActionMenu } from './actionMenu.js';

let dialogueBox = null;
let speakerEl   = null;
let roleEl      = null;
let avatarEl    = null;
let textEl      = null;
let btnClose    = null;

let btnMin     = null;
let isPeekMode  = false;

export function initDialoguePanel({ onActionSelect } = {}) {
=======
// -- Dialogue Panel Module -----------------------------------------------------
// Manages the supervisor dialogue HUD, speaker avatar, role/behaviour badge,
// comms waveform animation, and auto-dismiss / manual close lifecycle.

let dialogueBox     = null;
let speakerEl       = null;
let roleEl          = null;
let avatarEl        = null;
let textEl          = null;
let closeBtn        = null;
let autoDismissTimer = null;
let isOpen          = false;
let currentOnClose  = null;

export function initDialoguePanel({ onClose } = {}) {
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)
  dialogueBox = document.querySelector('#dialogue');
  speakerEl   = document.querySelector('#dialogue-speaker');
  roleEl      = document.querySelector('#dialogue-role');
  avatarEl    = document.querySelector('#dialogue-avatar');
  textEl      = document.querySelector('#dialogue-text');
<<<<<<< HEAD
  btnClose    = document.querySelector('#dialogue-close');
  btnMin      = document.querySelector('#dialogue-minimize');

  initActionMenu({ onSelect: onActionSelect });
=======
  closeBtn    = document.querySelector('#dialogue-close');
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)

  if (onClose) currentOnClose = onClose;

<<<<<<< HEAD
  if (btnMin) {
    btnMin.addEventListener('click', () => {
      isPeekMode = !isPeekMode;
      if (dialogueBox) {
        dialogueBox.style.opacity = isPeekMode ? '0.12' : '';
        btnMin.style.borderColor = isPeekMode ? '#A3E635' : 'rgba(163,230,53,0.35)';
        btnMin.style.background = isPeekMode ? 'rgba(163,230,53,0.25)' : 'rgba(255,255,255,0.08)';
      }
=======
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hideDialogue();
      if (currentOnClose) currentOnClose();
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)
    });
  }
}

<<<<<<< HEAD
export function showDialogue(speaker, role, avatar, text, actions = [], onSelect = null) {
  if (speakerEl) speakerEl.textContent = speaker.toUpperCase();
  if (roleEl) roleEl.textContent = role;
  if (avatarEl) avatarEl.textContent = avatar;
  if (textEl) textEl.textContent = text.startsWith('"') ? text : `"${text}"`;
  
  isPeekMode = false;
  if (btnMin) {
    btnMin.style.borderColor = 'rgba(163,230,53,0.35)';
    btnMin.style.background = 'rgba(255,255,255,0.08)';
  }

  if (actions && actions.length > 0) {
    renderActionMenu({ actions, onSelect });
  } else {
    hideActionMenu();
  }

  if (dialogueBox) {
    dialogueBox.style.opacity = '';
    dialogueBox.style.display = 'block';
=======
export function showDialogue({
  speaker = 'DAVE',
  role = 'SUPERVISOR // H&S PATROL',
  avatar = 'D',
  text = '',
  behaviour = 'dismissive',
  autoDismissMs = 0,
  onDismiss = null
} = {}) {
  if (!dialogueBox) initDialoguePanel();
  if (!dialogueBox) return;

  if (autoDismissTimer) {
    clearTimeout(autoDismissTimer);
    autoDismissTimer = null;
  }

  if (speakerEl) speakerEl.textContent = String(speaker).toUpperCase();
  
  if (roleEl) {
    const behaviourTag = behaviour ? ` // [${behaviour.toUpperCase()}]` : '';
    roleEl.textContent = `${role}${behaviourTag}`;
    roleEl.className = `dialogue-role-badge role-${behaviour || 'normal'}`;
  }

  if (avatarEl) {
    avatarEl.textContent = avatar || String(speaker).charAt(0).toUpperCase();
  }

  if (textEl) {
    textEl.textContent = text.startsWith('"') ? text : `"${text}"`;
  }

  dialogueBox.style.display = 'block';
  isOpen = true;

  if (autoDismissMs > 0) {
    autoDismissTimer = setTimeout(() => {
      hideDialogue();
      if (onDismiss) onDismiss();
      if (currentOnClose) currentOnClose();
    }, autoDismissMs);
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)
  }
}

export function hideDialogue() {
<<<<<<< HEAD
  hideActionMenu();
  if (dialogueBox) dialogueBox.style.display = 'none';
=======
  if (autoDismissTimer) {
    clearTimeout(autoDismissTimer);
    autoDismissTimer = null;
  }
  if (dialogueBox) {
    dialogueBox.style.display = 'none';
  }
  isOpen = false;
}

export function isDialogueOpen() {
  return isOpen;
>>>>>>> c9d1d61 (feat: add renderer updates and project cleanup)
}
