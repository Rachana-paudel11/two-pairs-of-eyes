// ── A-Frame 3D Renderer Module ───────────────────────────────────────────────
// Encapsulates 3D model binding, Mixamo animations, and procedural gestures.

let daveEl = null;
let alexEl = null;
let daveIdleClip = null;
let daveWalkClip = null;
let daveTalkClip = null;
let alexIdleClip = null;
let alexWalkClip = null;
let alexTalkClip = null;

export function initRenderer({ onDaveClick, onAlexClick } = {}) {
  daveEl = document.querySelector('#dave');
  alexEl = document.querySelector('#alex');

  function setupDaveAnimations() {
    if (!daveEl) return;
    const mesh = daveEl.getObject3D('mesh');
    if (mesh && mesh.animations && mesh.animations.length > 0) {
      const anims = mesh.animations.map(c => c.name);
      daveIdleClip = anims.find(n => n.toLowerCase().includes('mixamo') || n.toLowerCase().includes('idle')) || anims[0];
      daveWalkClip = anims.find(n => n.toLowerCase().includes('walk') || n.toLowerCase().includes('run')) || anims[1] || anims[0];
      daveTalkClip = anims.find(n => n.toLowerCase().includes('talk') || n.toLowerCase().includes('speech')) || anims[2] || anims[0];
      playDaveIdle();
    }
  }

  function setupAlexAnimations() {
    if (!alexEl) return;
    const mesh = alexEl.getObject3D('mesh');
    if (mesh && mesh.animations && mesh.animations.length > 0) {
      const anims = mesh.animations.map(c => c.name);
      console.log('[ANIMATION] Alex embedded clips found:', anims);
      alexWalkClip = anims.find(n => n.toLowerCase().includes('walk') || n.toLowerCase().includes('run')) || anims[0];
      alexIdleClip = anims.find(n => n.toLowerCase().includes('idle') || n.toLowerCase().includes('mixamo') || n.toLowerCase().includes('stand')) || anims[0];
      alexTalkClip = anims.find(n => n.toLowerCase().includes('talk') || n.toLowerCase().includes('speech')) || anims[0];
      
      alexEl.setAttribute('animation-mixer', {
        clip: alexWalkClip || anims[0],
        loop: 'repeat',
        crossFadeDuration: 0.2
      });
    }
  }

  if (daveEl) {
    if (daveEl.getObject3D('mesh')) setupDaveAnimations();
    daveEl.addEventListener('model-loaded', setupDaveAnimations);
    if (onDaveClick) daveEl.addEventListener('click', onDaveClick);
  }

  if (alexEl) {
    if (alexEl.getObject3D('mesh')) setupAlexAnimations();
    alexEl.addEventListener('model-loaded', setupAlexAnimations);
    if (onAlexClick) alexEl.addEventListener('click', onAlexClick);
  }

  // Periodic check to ensure animations start regardless of load timing
  const retryInterval = setInterval(() => {
    if (daveEl && !daveIdleClip) setupDaveAnimations();
    if (alexEl && !alexWalkClip) setupAlexAnimations();
    if (daveIdleClip && alexWalkClip) clearInterval(retryInterval);
  }, 200);
  setTimeout(() => clearInterval(retryInterval), 4000);
}

export function playDaveIdle() {
  if (daveEl && daveIdleClip) {
    daveEl.setAttribute('animation-mixer', { clip: daveIdleClip, loop: 'repeat', crossFadeDuration: 0.3 });
  }
}

export function playDaveWalk() {
  if (daveEl && daveWalkClip) {
    daveEl.setAttribute('animation-mixer', { clip: daveWalkClip, loop: 'repeat', crossFadeDuration: 0.2 });
  }
}

export function playDaveTalk(durationMs = 4000) {
  if (daveEl && daveTalkClip) {
    daveEl.setAttribute('animation-mixer', { clip: daveTalkClip, loop: 'repeat', crossFadeDuration: 0.2 });
    setTimeout(playDaveIdle, durationMs);
  }
}

export function playAlexIdle() {
  if (alexEl && alexIdleClip) {
    alexEl.setAttribute('animation-mixer', { clip: alexIdleClip, loop: 'repeat', crossFadeDuration: 0.3 });
  }
}

export function playAlexWalk() {
  if (alexEl && alexWalkClip) {
    alexEl.setAttribute('animation-mixer', { clip: alexWalkClip, loop: 'repeat', crossFadeDuration: 0.2 });
  }
}

export function playAlexTalk(durationMs = 4000) {
  if (alexEl && alexTalkClip) {
    alexEl.setAttribute('animation-mixer', { clip: alexTalkClip, loop: 'repeat', crossFadeDuration: 0.2 });
    setTimeout(playAlexIdle, durationMs);
  } else if (window.alexProcedural) {
    window.alexProcedural.playTalk(durationMs);
  }
}

export function patrolToWaypoint(waypoint, onArrival) {
  if (!daveEl || !waypoint) return;

  playDaveWalk();
  playAlexWalk();
  if (window.alexProcedural) window.alexProcedural.setWalking(true);

  // Dave smooth path
  daveEl.setAttribute('animation__move', {
    property: 'position',
    to: waypoint.position,
    dur: 3500,
    easing: 'easeInOutQuad'
  });
  daveEl.setAttribute('animation__rotate', {
    property: 'rotation',
    to: waypoint.rotation,
    dur: 1200,
    easing: 'easeInOutQuad'
  });

  // Alex synchronized path
  if (alexEl) {
    const [tx, ty, tz] = waypoint.position.split(' ').map(Number);
    const alexPos = `${(tx - 1.1).toFixed(2)} ${ty} ${(tz - 0.2).toFixed(2)}`;
    alexEl.setAttribute('animation__move', {
      property: 'position',
      to: alexPos,
      dur: 3500,
      easing: 'easeInOutQuad'
    });
    alexEl.setAttribute('animation__rotate', {
      property: 'rotation',
      to: waypoint.rotation,
      dur: 1200,
      easing: 'easeInOutQuad'
    });
  }

  setTimeout(() => {
    playDaveTalk(4000);
    playAlexIdle();
    if (window.alexProcedural) window.alexProcedural.setWalking(false);
    if (onArrival) onArrival();
  }, 3500);
}

export function resetCharacterPositions(startWaypoint) {
  if (daveEl && startWaypoint) {
    daveEl.setAttribute('position', startWaypoint.position);
    daveEl.setAttribute('rotation', startWaypoint.rotation);
    playDaveIdle();
  }
  if (alexEl && startWaypoint) {
    const [tx, ty, tz] = startWaypoint.position.split(' ').map(Number);
    alexEl.setAttribute('position', `${(tx - 1.1).toFixed(2)} ${ty} ${(tz - 0.2).toFixed(2)}`);
    alexEl.setAttribute('rotation', startWaypoint.rotation);
    playAlexIdle();
  }
}
