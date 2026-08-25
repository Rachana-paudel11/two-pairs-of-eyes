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
  dialogueBox = document.querySelector('#dialogue');
  speakerEl   = document.querySelector('#dialogue-speaker');
  roleEl      = document.querySelector('#dialogue-role');
  avatarEl    = document.querySelector('#dialogue-avatar');
  textEl      = document.querySelector('#dialogue-text');
  btnClose    = document.querySelector('#dialogue-close');
  btnMin      = document.querySelector('#dialogue-minimize');

  initActionMenu({ onSelect: onActionSelect });

  if (btnClose) {
    btnClose.addEventListener('click', hideDialogue);
  }

  if (btnMin) {
    btnMin.addEventListener('click', () => {
      isPeekMode = !isPeekMode;
      if (dialogueBox) {
        dialogueBox.style.opacity = isPeekMode ? '0.12' : '';
        btnMin.style.borderColor = isPeekMode ? '#A3E635' : 'rgba(163,230,53,0.35)';
        btnMin.style.background = isPeekMode ? 'rgba(163,230,53,0.25)' : 'rgba(255,255,255,0.08)';
      }
    });
  }
}

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
  }
}

export function hideDialogue() {
  hideActionMenu();
  if (dialogueBox) dialogueBox.style.display = 'none';
}
