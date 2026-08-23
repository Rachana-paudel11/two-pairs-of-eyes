// ── Dialogue Panel Module ───────────────────────────────────────────────────
// Manages the interactive dialogue box, speaker badge, and decision buttons.

let dialogueBox = null;
let speakerEl   = null;
let roleEl      = null;
let avatarEl    = null;
let textEl      = null;
let btnClose    = null;
let btnAck      = null;
let btnChal     = null;

export function initDialoguePanel({ onAcknowledge, onChallenge } = {}) {
  dialogueBox = document.querySelector('#dialogue');
  speakerEl   = document.querySelector('#dialogue-speaker');
  roleEl      = document.querySelector('#dialogue-role');
  avatarEl    = document.querySelector('#dialogue-avatar');
  textEl      = document.querySelector('#dialogue-text');
  btnClose    = document.querySelector('#dialogue-close');
  btnAck      = document.querySelector('#btn-dialogue-ack');
  btnChal     = document.querySelector('#btn-dialogue-challenge');

  if (btnClose) {
    btnClose.addEventListener('click', hideDialogue);
  }

  if (btnAck && onAcknowledge) {
    btnAck.addEventListener('click', onAcknowledge);
  }

  if (btnChal && onChallenge) {
    btnChal.addEventListener('click', onChallenge);
  }
}

export function showDialogue(speaker, role, avatar, text) {
  if (speakerEl) speakerEl.textContent = speaker.toUpperCase();
  if (roleEl) roleEl.textContent = role;
  if (avatarEl) avatarEl.textContent = avatar;
  if (textEl) textEl.textContent = `"${text}"`;
  if (dialogueBox) dialogueBox.style.display = 'block';
}

export function hideDialogue() {
  if (dialogueBox) dialogueBox.style.display = 'none';
}
