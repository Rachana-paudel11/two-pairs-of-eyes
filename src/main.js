import { createNpc } from './characters/npc.js';

// ── NPC Personality & Scenario Definitions ──────────────────────────────────
const daveData = createNpc({
  name: 'Dave',
  behaviour: 'dismissive',
  dialogue: "People have been walking around it all morning. Someone will clean it later."
});

const alexData = createNpc({
  name: 'Alex',
  behaviour: 'uncertain',
  dialogue: "Hey, are you sure we should walk past that hazard? Dave said it's fine, but looks risky to me..."
});

// ── DOM References ──────────────────────────────────────────────────────────
const daveEntity        = document.querySelector('#dave');
const alexEntity        = document.querySelector('#alex');
const dialogueBox       = document.querySelector('#dialogue');
const dialogueSpeaker   = document.querySelector('#dialogue-speaker');
const dialogueRole      = document.querySelector('#dialogue-role');
const dialogueAvatar    = document.querySelector('#dialogue-avatar');
const dialogueText      = document.querySelector('#dialogue-text');
const dialogueClose     = document.querySelector('#dialogue-close');
const btnDialogueAck    = document.querySelector('#btn-dialogue-ack');
const btnDialogueChal   = document.querySelector('#btn-dialogue-challenge');
const hudScore          = document.querySelector('#hud-score');
const hudStopTitle      = document.querySelector('#hud-stop-title');
const proximityPrompt   = document.querySelector('#proximity-prompt');

const btnTalkDave       = document.querySelector('#btn-talk-dave');
const btnMoveDave       = document.querySelector('#btn-move-dave');
const btnTalkAlex       = document.querySelector('#btn-talk-alex');
const playerCamera      = document.querySelector('#player-camera');

// ── Character State & Score ──────────────────────────────────────────────────
let currentScore = 0;
let currentSpeaker = 'Dave';
let daveIdleClip = 'mixamo.com.001';
let daveTalkClip = 'Talking';
let daveWalkClip = 'walking';

let sharedMixamoClips = [];
let alexMixer = null;
let alexIdleAction = null;
let alexTalkAction = null;

const CHAR_SCALE       = '1 1 1';
const CHAR_SCALE_HOVER = '1.08 1.08 1.08';

// ── Waypoints along the warehouse stops ──────────────────────────────────────
const waypoints = [
  {
    position: '1.4 0 -3.0',
    rotation: '0 -45 0',
    name: 'Stop 01 — Fluid Spill Zone',
    daveDialogue: "People have been walking around it all morning. Someone will clean it later.",
    alexDialogue: "That fluid spill looks slippery. Dave wants to ignore it, but we should cordon it off!"
  },
  {
    position: '-1.2 0 -9.5',
    rotation: '0 -120 0',
    name: 'Stop 02 — Blind-Corner Forklift Junction',
    daveDialogue: "I can't tell if the driver sees us, but let's quickly step through.",
    alexDialogue: "Wait! The driver has zero visibility around this blind corner. We must hold position!"
  },
  {
    position: '2.4 0 -16.5',
    rotation: '0 60 0',
    name: 'Stop 03 — Structural Racking Section',
    daveDialogue: "That shelf upright has been bent for weeks. It's sturdy enough, don't worry about it.",
    alexDialogue: "A bent upright reduces load capacity by 50%! We need to report this immediately."
  },
  {
    position: '-1.6 0 -23.0',
    rotation: '0 -80 0',
    name: 'Stop 04 — Battery Bay & Flammables',
    daveDialogue: "Just a flashing amber diagnostic light. Nothing to worry about.",
    alexDialogue: "Amber warning with cardboard combustibles stacked nearby is a serious fire risk!"
  },
  {
    position: '0.9 0 -28.0',
    rotation: '0 0 0',
    name: 'Stop 05 — Main Corridor Exit',
    daveDialogue: "Walkway is clear here. Good job finishing the safety round.",
    alexDialogue: "Clean aisle with no obstructions! This is what proper standard looks like."
  }
];

let currentWaypointIndex = 0;
let isMoving = false;

// ── Helper: Find clip name from loaded model ─────────────────────────────────
function findClipName(model, preferredKeywords) {
  if (!model || !model.animations || model.animations.length === 0) return null;
  const animNames = model.animations.map(a => a.name);
  for (const keyword of preferredKeywords) {
    const match = animNames.find(name => name.toLowerCase().includes(keyword.toLowerCase()));
    if (match) return match;
  }
  return animNames[0];
}

// ── Animation Controllers ───────────────────────────────────────────────────
function playDaveAnimation(clipName) {
  if (!daveEntity || !clipName) return;
  daveEntity.setAttribute('animation-mixer', {
    clip: clipName,
    loop: 'repeat',
    crossFadeDuration: 0.4
  });
}

function playAlexTalkingAnimation() {
  if (alexTalkAction && alexIdleAction) {
    alexTalkAction.reset();
    alexIdleAction.crossFadeTo(alexTalkAction, 0.3, true);
    alexTalkAction.play();
    setTimeout(() => {
      if (alexIdleAction && alexTalkAction) {
        alexIdleAction.reset();
        alexTalkAction.crossFadeTo(alexIdleAction, 0.4, true);
        alexIdleAction.play();
      }
    }, 3800);
  }
}

// ── Retargeting helper to adapt Dave's Mixamo bones to Alex's mixamorig1 bones ──
function retargetClipForAlex(clip) {
  if (!clip) return null;
  const clonedTracks = clip.tracks.map((track) => {
    const clonedTrack = track.clone();
    clonedTrack.name = clonedTrack.name.replace(/mixamorig:/g, 'mixamorig1:');
    return clonedTrack;
  });
  return new THREE.AnimationClip(clip.name + '_alex', clip.duration, clonedTracks);
}

// ── Setup Shared Mixamo Animation on Alex ───────────────────────────────────
function initAlexAnimation() {
  if (!alexEntity || sharedMixamoClips.length === 0) return;
  
  const alexMesh = alexEntity.getObject3D('mesh') || alexEntity.object3D;
  if (!alexMesh) return;

  if (!alexMixer) {
    alexMixer = new THREE.AnimationMixer(alexMesh);
    window.alexMixer = alexMixer;

    const rawIdleClip = sharedMixamoClips.find(c => c.name === 'mixamo.com.001' || c.name.toLowerCase().includes('idle')) || sharedMixamoClips[0];
    const rawTalkClip = sharedMixamoClips.find(c => c.name.toLowerCase().includes('talk'));

    const alexIdleClip = retargetClipForAlex(rawIdleClip);
    const alexTalkClip = retargetClipForAlex(rawTalkClip);

    if (alexIdleClip) {
      alexIdleAction = alexMixer.clipAction(alexIdleClip);
      alexIdleAction.play();
      console.log('[ANIMATION] Alex retargeted idle animation playing successfully!');
    }
    if (alexTalkClip) {
      alexTalkAction = alexMixer.clipAction(alexTalkClip);
    }
  }
}

// ── Register A-Frame Component for Alex Animation Loop ──────────────────────
if (typeof AFRAME !== 'undefined' && !AFRAME.components['alex-anim-driver']) {
  AFRAME.registerComponent('alex-anim-driver', {
    init: function () {
      this.el.addEventListener('model-loaded', () => {
        initAlexAnimation();
      });
    },
    tick: function (t, dt) {
      if (alexMixer && dt) {
        alexMixer.update(dt / 1000);
      }
    }
  });
}

// ── Model Loading Handlers ──────────────────────────────────────────────────
if (daveEntity) {
  daveEntity.addEventListener('model-loaded', (e) => {
    const model = e.detail.model;
    if (model && model.animations && model.animations.length > 0) {
      sharedMixamoClips = model.animations;
      console.log('[ANIMATION] Dave animations loaded:', sharedMixamoClips.map(c => c.name));
      
      const idle = findClipName(model, ['mixamo.com.001', 'idle', 'stand']);
      const walk = findClipName(model, ['walking', 'walk', 'run']);
      const talk = findClipName(model, ['talking', 'talk', 'speech']);
      if (idle) daveIdleClip = idle;
      if (walk) daveWalkClip = walk;
      if (talk) daveTalkClip = talk;

      playDaveAnimation(daveIdleClip);
      
      // Also initialize Alex with shared clips
      initAlexAnimation();
    }
  });
}

if (alexEntity) {
  alexEntity.addEventListener('model-loaded', () => {
    initAlexAnimation();
  });
}

// ── Dialogue Display ────────────────────────────────────────────────────────
function showDialogue(speaker, role, avatar, text) {
  currentSpeaker = speaker;
  if (dialogueSpeaker) dialogueSpeaker.textContent = speaker.toUpperCase();
  if (dialogueRole) dialogueRole.textContent = role;
  if (dialogueAvatar) dialogueAvatar.textContent = avatar;
  if (dialogueText) dialogueText.textContent = `"${text}"`;
  if (dialogueBox) dialogueBox.style.display = 'block';
}

function hideDialogue() {
  if (dialogueBox) dialogueBox.style.display = 'none';
}

if (dialogueClose) {
  dialogueClose.addEventListener('click', hideDialogue);
}

// ── Dialogue Interaction Choices ────────────────────────────────────────────
if (btnDialogueAck) {
  btnDialogueAck.addEventListener('click', () => {
    if (currentSpeaker === 'Dave') {
      showDialogue('Dave', 'Supervisor', '👷‍♂️', 'Good. Keep moving, no need to overcomplicate things.');
      playDaveAnimation(daveTalkClip);
      setTimeout(() => playDaveAnimation(daveIdleClip), 3000);
    } else {
      showDialogue('Alex', 'Co-Worker', '🧑‍💼', 'Hmm... I still think we should have logged the hazard properly.');
      playAlexTalkingAnimation();
    }
    setTimeout(hideDialogue, 3500);
  });
}

if (btnDialogueChal) {
  btnDialogueChal.addEventListener('click', () => {
    currentScore = Math.min(25, currentScore + 5);
    if (hudScore) hudScore.textContent = `Score: ${currentScore} / 25`;

    if (currentSpeaker === 'Dave') {
      showDialogue('Dave', 'Supervisor', '👷‍♂️', 'Fair point. Let us follow official protocol and secure the area first.');
      playDaveAnimation(daveTalkClip);
      setTimeout(() => playDaveAnimation(daveIdleClip), 3500);
    } else {
      showDialogue('Alex', 'Co-Worker', '🧑‍💼', 'Great call! Safety rules exist for a reason. Let us report it.');
      playAlexTalkingAnimation();
    }
    setTimeout(hideDialogue, 4000);
  });
}

// ── Trigger Character Dialogue ──────────────────────────────────────────────
function talkToDave() {
  const wp = waypoints[currentWaypointIndex];
  showDialogue('Dave', 'Supervisor', '👷‍♂️', wp.daveDialogue);
  playDaveAnimation(daveTalkClip);
  setTimeout(() => {
    if (!isMoving) playDaveAnimation(daveIdleClip);
  }, 4000);
}

function talkToAlex() {
  const wp = waypoints[currentWaypointIndex];
  showDialogue('Alex', 'Co-Worker', '🧑‍💼', wp.alexDialogue);
  playAlexTalkingAnimation();
}

// ── Dave Click & Hover Events ───────────────────────────────────────────────
if (daveEntity) {
  daveEntity.addEventListener('click', talkToDave);
  daveEntity.addEventListener('mouseenter', () => {
    daveEntity.setAttribute('scale', CHAR_SCALE_HOVER);
  });
  daveEntity.addEventListener('mouseleave', () => {
    daveEntity.setAttribute('scale', CHAR_SCALE);
  });
}

// ── Alex Click & Hover Events ───────────────────────────────────────────────
if (alexEntity) {
  alexEntity.addEventListener('click', talkToAlex);
  alexEntity.addEventListener('mouseenter', () => {
    alexEntity.setAttribute('scale', CHAR_SCALE_HOVER);
  });
  alexEntity.addEventListener('mouseleave', () => {
    alexEntity.setAttribute('scale', CHAR_SCALE);
  });
}

// ── HUD Buttons ─────────────────────────────────────────────────────────────
if (btnTalkDave) btnTalkDave.addEventListener('click', talkToDave);
if (btnTalkAlex) btnTalkAlex.addEventListener('click', talkToAlex);

// ── Dave Patrol / Waypoint Movement ─────────────────────────────────────────
if (btnMoveDave) {
  btnMoveDave.addEventListener('click', () => {
    if (isMoving || !daveEntity) return;

    isMoving = true;
    currentWaypointIndex = (currentWaypointIndex + 1) % waypoints.length;
    const target = waypoints[currentWaypointIndex];

    if (hudStopTitle) {
      hudStopTitle.textContent = `📍 ${target.name}`;
    }

    showDialogue('Dave', 'Supervisor', '👷‍♂️', `Moving to ${target.name}...`);
    playDaveAnimation(daveWalkClip);

    // Smooth movement
    daveEntity.setAttribute('animation__move', {
      property: 'position',
      to: target.position,
      dur: 3500,
      easing: 'easeInOutQuad'
    });

    // Smooth rotation
    daveEntity.setAttribute('animation__rotate', {
      property: 'rotation',
      to: target.rotation,
      dur: 1200,
      easing: 'easeInOutQuad'
    });

    setTimeout(() => {
      isMoving = false;
      playDaveAnimation(daveTalkClip);
      showDialogue('Dave', 'Supervisor', '👷‍♂️', target.daveDialogue);
      setTimeout(() => playDaveAnimation(daveIdleClip), 4000);
    }, 3500);
  });
}

// ── Keyboard Shortcuts (E to interact, ESC to close dialogue) ───────────────
window.addEventListener('keydown', (e) => {
  if (e.key === 'e' || e.key === 'E') {
    talkToDave();
  } else if (e.key === 'Escape') {
    hideDialogue();
  }
});


