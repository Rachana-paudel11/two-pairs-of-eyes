import { createNpc } from './characters/npc.js';

// ── Dave's data ──────────────────────────────────────────────────────────────
const daveData = createNpc({
  name: 'Dave',
  behaviour: 'dismissive',
  dialogue: "People have been walking around it all morning. Someone will clean it later."
});

// ── Alex's data ──────────────────────────────────────────────────────────────
const alexData = createNpc({
  name: 'Alex',
  behaviour: 'uncertain',
  dialogue: "Hey, are you sure we should walk past that hazard? Dave said it's fine, but looks risky to me..."
});

// ── DOM refs ─────────────────────────────────────────────────────────────────
const daveEntity      = document.querySelector('#dave');
const alexEntity      = document.querySelector('#alex');
const dialogueBox     = document.querySelector('#dialogue');
const dialogueSpeaker = document.querySelector('#dialogue-speaker');
const dialogueText    = document.querySelector('#dialogue-text');

// ── Base scale (must match index.html) ───────────────────────────────────────
const CHAR_SCALE       = '1 1 1';
const CHAR_SCALE_HOVER = '1.05 1.05 1.05';

// ── Mixamo clip names (verified via gltf.report) ───────────────────────────
// mixamo.com      = 0.033s T-pose only (single frame, not useful)
// mixamo.com.001  = 6s Standing Idle loop ✓
// Walking         = Walking animation clip name when added
const IDLE_CLIP = 'mixamo.com.001';
const WALK_CLIP = 'Walking';

// ── Helpers ──────────────────────────────────────────────────────────────────
function showDialogue(speaker, text) {
  if (dialogueSpeaker) dialogueSpeaker.textContent = speaker.toUpperCase();
  dialogueText.textContent = text;
  dialogueBox.style.display = 'block';
}

function hideDialogue() {
  dialogueBox.style.display = 'none';
}

function playDaveAnimation(clip) {
  if (daveEntity) {
    daveEntity.setAttribute('animation-mixer', {
      clip,
      loop: 'repeat',
      crossFadeDuration: 0.4
    });
  }
}

function playAlexAnimation(clip) {
  if (alexEntity) {
    alexEntity.setAttribute('animation-mixer', {
      clip,
      loop: 'repeat',
      crossFadeDuration: 0.4
    });
  }
}

// ── Ensure Standing Idle plays on scene load ──────────────────────────────────
if (daveEntity) {
  daveEntity.addEventListener('model-loaded', () => {
    playDaveAnimation(IDLE_CLIP);
  });
}

if (alexEntity) {
  alexEntity.addEventListener('model-loaded', () => {
    playAlexAnimation(IDLE_CLIP);
  });
}

// ── Dave click → show dialogue ───────────────────────────────────────────────
if (daveEntity) {
  daveEntity.addEventListener('click', () => {
    showDialogue(daveData.name, daveData.dialogue);
    playDaveAnimation(IDLE_CLIP);

    setTimeout(() => {
      hideDialogue();
    }, 4000);
  });

  // Hover highlight
  daveEntity.addEventListener('mouseenter', () => {
    daveEntity.setAttribute('scale', CHAR_SCALE_HOVER);
  });
  daveEntity.addEventListener('mouseleave', () => {
    daveEntity.setAttribute('scale', CHAR_SCALE);
  });
}

// ── Alex click → show dialogue ───────────────────────────────────────────────
if (alexEntity) {
  alexEntity.addEventListener('click', () => {
    showDialogue(alexData.name, alexData.dialogue);
    playAlexAnimation(IDLE_CLIP);

    setTimeout(() => {
      hideDialogue();
    }, 4000);
  });

  // Hover highlight
  alexEntity.addEventListener('mouseenter', () => {
    alexEntity.setAttribute('scale', CHAR_SCALE_HOVER);
  });
  alexEntity.addEventListener('mouseleave', () => {
    alexEntity.setAttribute('scale', CHAR_SCALE);
  });
}

// ── Move Dave Waypoints ──────────────────────────────────────────────────────
const waypoints = [
  { position: '0 0 -3', rotation: '0 0 0' },
  { position: '3 0 -6', rotation: '0 -45 0' }
];
let currentWaypointIndex = 0;
let isMoving = false;

const moveBtn = document.querySelector('#btn-move-dave');

if (moveBtn) {
  moveBtn.addEventListener('click', () => {
    if (isMoving) return;

    isMoving = true;
    currentWaypointIndex = (currentWaypointIndex + 1) % waypoints.length;
    const target = waypoints[currentWaypointIndex];

    showDialogue(`Dave: "Moving to position ${target.position}..."`);

    // Switch animation to Walking clip
    playDaveAnimation(WALK_CLIP);

    // Smoothly animate position using A-Frame animation component
    daveEntity.setAttribute('animation__move', {
      property: 'position',
      to: target.position,
      dur: 3000,
      easing: 'easeInOutQuad'
    });

    // Smoothly animate rotation to face destination
    daveEntity.setAttribute('animation__rotate', {
      property: 'rotation',
      to: target.rotation,
      dur: 1000,
      easing: 'easeInOutQuad'
    });

    // When movement completes (3 seconds)
    setTimeout(() => {
      isMoving = false;
      showDialogue(daveData.name, `Arrived at location!`);
      // Return to Idle animation
      playDaveAnimation(IDLE_CLIP);
      setTimeout(hideDialogue, 3000);
    }, 3000);
  });
}
