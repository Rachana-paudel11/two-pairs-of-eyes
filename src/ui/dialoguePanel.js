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

let btnMin     = null;
let isPeekMode  = false;

export function initDialoguePanel({ onAcknowledge, onChallenge } = {}) {
  dialogueBox = document.querySelector('#dialogue');
  speakerEl   = document.querySelector('#dialogue-speaker');
  roleEl      = document.querySelector('#dialogue-role');
  avatarEl    = document.querySelector('#dialogue-avatar');
  textEl      = document.querySelector('#dialogue-text');
  btnClose    = document.querySelector('#dialogue-close');
  btnMin      = document.querySelector('#dialogue-minimize');
  btnAck      = document.querySelector('#btn-dialogue-ack');
  btnChal     = document.querySelector('#btn-dialogue-challenge');

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
  isPeekMode = false;
  if (btnMin) {
    btnMin.style.borderColor = 'rgba(163,230,53,0.35)';
    btnMin.style.background = 'rgba(255,255,255,0.08)';
  }
  if (dialogueBox) {
    dialogueBox.style.opacity = '';
    dialogueBox.style.display = 'block';
  }
}

export function hideDialogue() {
  if (dialogueBox) dialogueBox.style.display = 'none';
}
