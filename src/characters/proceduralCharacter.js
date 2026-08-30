// ── Procedural 3D Human Character Generator (Three.js & A-Frame) ───────────────
// Creates customizable, fully-articulated 3D humanoid characters with industrial
// safety gear (Hard Hat, Hi-Vis Safety Vest, Reflector Stripes, Boots, ID Badge).
// Works seamlessly in pure Three.js scenes and as an A-Frame custom component.

/**
 * Creates a procedural 3D character mesh hierarchy using pure Three.js.
 * 
 * @param {Object} options Configuration parameters
 * @param {string} [options.name="Worker"] Character name
 * @param {string} [options.role="OPERATOR"] Subtitle badge role
 * @param {string} [options.vestColor="#ea580c"] Safety vest color (e.g. #ea580c orange, #84cc16 lime)
 * @param {string} [options.hatColor="#facc15"] Hard hat color (e.g. #facc15 yellow, #ffffff white, #3b82f6 blue)
 * @param {string} [options.shirtColor="#1e293b"] Undershirt / pants color
 * @param {string} [options.skinColor="#d4a373"] Skin tone color
 * @param {number} [options.scale=1.0] Overall scale factor
 * @returns {THREE.Group} Root character group with animated limb references
 */
export function createThreeJsCharacter(THREE, options = {}) {
  const {
    name = 'Worker',
    role = 'OPERATOR',
    vestColor = '#ea580c',
    hatColor = '#facc15',
    shirtColor = '#1e293b',
    pantsColor = '#0f172a',
    skinColor = '#d4a373',
    bootColor = '#451a03',
    scale = 1.0
  } = options;

  const root = new THREE.Group();
  root.name = `character_${name.toLowerCase().replace(/\s+/g, '_')}`;

  // ── Materials ──
  const matSkin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 });
  const matHat = new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.3, metalness: 0.1 });
  const matVest = new THREE.MeshStandardMaterial({ color: vestColor, roughness: 0.5 });
  const matStripe = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.2, emissive: '#cbd5e1', emissiveIntensity: 0.4 });
  const matShirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
  const matPants = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });
  const matBoots = new THREE.MeshStandardMaterial({ color: bootColor, roughness: 0.4 });
  const matHair = new THREE.MeshStandardMaterial({ color: '#271c19', roughness: 0.9 });
  const matEye = new THREE.MeshBasicMaterial({ color: '#0f172a' });

  // ── Pelvis / Root Pivot ──
  const pelvis = new THREE.Group();
  pelvis.position.y = 0.95;
  root.appendChild ? root.add(pelvis) : pelvis;

  // ── Torso / Chest (Height: 0.55m, Width: 0.38m, Depth: 0.24m) ──
  const torsoGroup = new THREE.Group();
  pelvis.add(torsoGroup);

  const torsoGeom = new THREE.BoxGeometry(0.38, 0.52, 0.24);
  const torsoMesh = new THREE.Mesh(torsoGeom, matVest);
  torsoMesh.position.y = 0.26;
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torsoGroup.add(torsoMesh);

  // Hi-Vis Silver Reflective Horizontal Stripe
  const stripeHGeom = new THREE.BoxGeometry(0.385, 0.05, 0.245);
  const stripeHMesh = new THREE.Mesh(stripeHGeom, matStripe);
  stripeHMesh.position.y = 0.22;
  torsoGroup.add(stripeHMesh);

  // Hi-Vis Silver Reflective Vertical Shoulder Harness Stripes
  const stripeVL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.48, 0.246), matStripe);
  stripeVL.position.set(-0.11, 0.26, 0);
  torsoGroup.add(stripeVL);

  const stripeVR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.48, 0.246), matStripe);
  stripeVR.position.set(0.11, 0.26, 0);
  torsoGroup.add(stripeVR);

  // ── Neck & Head ──
  const neckGeom = new THREE.CylinderGeometry(0.07, 0.08, 0.08, 12);
  const neck = new THREE.Mesh(neckGeom, matSkin);
  neck.position.y = 0.56;
  torsoGroup.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.y = 0.72;
  torsoGroup.add(headGroup);

  // Head Base
  const headGeom = new THREE.BoxGeometry(0.22, 0.24, 0.22);
  const headMesh = new THREE.Mesh(headGeom, matSkin);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Hair
  const hairGeom = new THREE.BoxGeometry(0.23, 0.08, 0.23);
  const hair = new THREE.Mesh(hairGeom, matHair);
  hair.position.y = 0.09;
  headGroup.add(hair);

  // Eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), matEye);
  eyeL.position.set(-0.055, 0.02, 0.112);
  headGroup.add(eyeL);

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), matEye);
  eyeR.position.set(0.055, 0.02, 0.112);
  headGroup.add(eyeR);

  // Industrial Hard Hat (Dome + Brim + Peak)
  const hatGroup = new THREE.Group();
  hatGroup.position.y = 0.12;
  headGroup.add(hatGroup);

  const hatDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
    matHat
  );
  hatDome.scale.set(1.0, 0.85, 1.1);
  hatDome.position.y = 0.02;
  hatGroup.add(hatDome);

  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.17, 0.025, 16), matHat);
  hatBrim.position.y = 0.02;
  hatGroup.add(hatBrim);

  const hatPeak = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.015, 0.07), matHat);
  hatPeak.position.set(0, 0.015, 0.16);
  hatPeak.rotation.x = 0.15;
  hatGroup.add(hatPeak);

  // ── Arms (Shoulder Pivot -> Upper Arm -> Forearm) ──
  function createArm(isLeft = false) {
    const side = isLeft ? -1 : 1;
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.24, 0.48, 0);

    // Shoulder / Upper sleeve
    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.26, 12), matShirt);
    upperArm.position.y = -0.13;
    upperArm.castShadow = true;
    armPivot.add(upperArm);

    // Forearm / Hand Pivot
    const elbowPivot = new THREE.Group();
    elbowPivot.position.y = -0.26;
    armPivot.add(elbowPivot);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.24, 12), matSkin);
    forearm.position.y = -0.12;
    forearm.castShadow = true;
    elbowPivot.add(forearm);

    // Hand (fist)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), matSkin);
    hand.position.y = -0.24;
    elbowPivot.add(hand);

    return { armPivot, elbowPivot };
  }

  const leftArm = createArm(true);
  const rightArm = createArm(false);
  torsoGroup.add(leftArm.armPivot);
  torsoGroup.add(rightArm.armPivot);

  // ── Legs (Hip Pivot -> Thigh -> Calf/Boot) ──
  function createLeg(isLeft = false) {
    const side = isLeft ? -1 : 1;
    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * 0.11, 0, 0);

    // Thigh
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.44, 12), matPants);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    hipPivot.add(thigh);

    // Knee Pivot
    const kneePivot = new THREE.Group();
    kneePivot.position.y = -0.44;
    hipPivot.add(kneePivot);

    // Lower Leg
    const lowerLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.42, 12), matPants);
    lowerLeg.position.y = -0.21;
    lowerLeg.castShadow = true;
    kneePivot.add(lowerLeg);

    // Steel-Toe Work Boot
    const bootGroup = new THREE.Group();
    bootGroup.position.y = -0.44;
    kneePivot.add(bootGroup);

    const bootBase = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, 0.22), matBoots);
    bootBase.position.set(0, 0.055, 0.04);
    bootBase.castShadow = true;
    bootGroup.add(bootBase);

    return { hipPivot, kneePivot, bootGroup };
  }

  const leftLeg = createLeg(true);
  const rightLeg = createLeg(false);
  pelvis.add(leftLeg.hipPivot);
  pelvis.add(rightLeg.hipPivot);

  // Apply root scale
  root.scale.set(scale, scale, scale);

  // ── Animation Engine State ──
  let animTime = 0;
  let currentAnimation = 'idle'; // 'idle', 'walk', 'wave', 'alert'

  root.userData = {
    name,
    role,
    limbs: {
      pelvis,
      torsoGroup,
      headGroup,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg
    },
    setAnimation(animName) {
      currentAnimation = animName;
    },
    update(deltaTime = 0.016) {
      animTime += deltaTime;

      if (currentAnimation === 'walk') {
        const walkSpeed = 7.0;
        const legAngle = Math.sin(animTime * walkSpeed) * 0.65;
        const armAngle = -legAngle * 0.6;

        leftLeg.hipPivot.rotation.x = legAngle;
        rightLeg.hipPivot.rotation.x = -legAngle;
        leftLeg.kneePivot.rotation.x = Math.max(0, -legAngle * 0.8);
        rightLeg.kneePivot.rotation.x = Math.max(0, legAngle * 0.8);

        leftArm.armPivot.rotation.x = armAngle;
        rightArm.armPivot.rotation.x = -armAngle;
        leftArm.elbowPivot.rotation.x = -Math.abs(armAngle * 0.5);
        rightArm.elbowPivot.rotation.x = -Math.abs(armAngle * 0.5);

        // Subtle torso bob & bounce
        pelvis.position.y = 0.95 + Math.abs(Math.sin(animTime * walkSpeed * 2)) * 0.035;
        torsoGroup.rotation.y = Math.sin(animTime * walkSpeed) * 0.08;
      } else if (currentAnimation === 'wave') {
        // Idle legs
        leftLeg.hipPivot.rotation.x = 0;
        rightLeg.hipPivot.rotation.x = 0;
        leftLeg.kneePivot.rotation.x = 0;
        rightLeg.kneePivot.rotation.x = 0;
        pelvis.position.y = 0.95;

        // Wave right hand high
        rightArm.armPivot.rotation.z = -2.2;
        rightArm.armPivot.rotation.x = 0.2;
        rightArm.elbowPivot.rotation.z = Math.sin(animTime * 8) * 0.5 - 0.5;
        leftArm.armPivot.rotation.set(0, 0, 0.1);
        leftArm.elbowPivot.rotation.set(0, 0, 0);
      } else {
        // Subtle Breathing Idle
        const breathe = Math.sin(animTime * 2.2);
        torsoGroup.position.y = breathe * 0.012;
        headGroup.rotation.x = breathe * 0.025;
        leftArm.armPivot.rotation.z = 0.06 + breathe * 0.02;
        rightArm.armPivot.rotation.z = -0.06 - breathe * 0.02;
        leftArm.armPivot.rotation.x = 0;
        rightArm.armPivot.rotation.x = 0;
        leftArm.elbowPivot.rotation.x = -0.05;
        rightArm.elbowPivot.rotation.x = -0.05;
        leftLeg.hipPivot.rotation.x = 0;
        rightLeg.hipPivot.rotation.x = 0;
        leftLeg.kneePivot.rotation.x = 0;
        rightLeg.kneePivot.rotation.x = 0;
        pelvis.position.y = 0.95;
      }
    }
  };

  return root;
}

// ── Register A-Frame Custom Component ─────────────────────────────────────────
if (typeof window !== 'undefined' && window.AFRAME) {
  window.AFRAME.registerComponent('procedural-character', {
    schema: {
      name: { type: 'string', default: 'Worker' },
      role: { type: 'string', default: 'SAFETY OPERATOR' },
      vestColor: { type: 'string', default: '#ea580c' },
      hatColor: { type: 'string', default: '#facc15' },
      shirtColor: { type: 'string', default: '#1e293b' },
      pantsColor: { type: 'string', default: '#0f172a' },
      skinColor: { type: 'string', default: '#d4a373' },
      scale: { type: 'number', default: 1.0 },
      animation: { type: 'string', default: 'idle' } // 'idle', 'walk', 'wave'
    },
    init: function () {
      const THREE = window.AFRAME.THREE || window.THREE;
      this.charGroup = createThreeJsCharacter(THREE, this.data);
      this.el.setObject3D('mesh', this.charGroup);

      // Create Overhead 3D Nameplate Badge
      const badge = document.createElement('a-entity');
      badge.setAttribute('position', '0 2.2 0');
      badge.setAttribute('look-at', '#player-camera');

      const plate = document.createElement('a-plane');
      plate.setAttribute('color', '#0a261a');
      plate.setAttribute('opacity', '0.85');
      plate.setAttribute('width', '1.8');
      plate.setAttribute('height', '0.35');
      plate.setAttribute('position', '0 0 0');

      const text = document.createElement('a-text');
      text.setAttribute('value', `${this.data.name.toUpperCase()}  //  ${this.data.role.toUpperCase()}`);
      text.setAttribute('color', this.data.hatColor || '#A3E635');
      text.setAttribute('align', 'center');
      text.setAttribute('width', '2.4');
      text.setAttribute('font', 'mozillavr');
      text.setAttribute('position', '0 0 0.01');

      plate.appendChild(text);
      badge.appendChild(plate);
      this.el.appendChild(badge);
    },
    update: function () {
      if (this.charGroup && this.charGroup.userData) {
        this.charGroup.userData.setAnimation(this.data.animation);
      }
    },
    tick: function (time, timeDelta) {
      if (this.charGroup && this.charGroup.userData) {
        const dt = Math.min((timeDelta || 16) / 1000, 0.05);
        this.charGroup.userData.update(dt);
      }
    }
  });
}
