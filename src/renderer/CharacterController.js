/**
 * CharacterController.js
 * 
 * Clean Third-Person Character Controller:
 *  - Uses native Mixamo animations embedded in GLB models + FBX gesture overlays.
 *  - Locomotion plays the rigs' own walk clips, retimed to the movement speed.
 *  - Strict position offset for Dave to prevent clipping into Alex.
 *  - Dialogue facing & hazard inspection look-at behaviors.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Swapped paths as per the model assignment
// Model identity, confirmed by inspecting the files rather than their names:
//   alex.glb  meshes Ch17_Body/Boots/Helmet/Pants, clips [mixamo.com, walking]
//   dave.glb  meshes Ch23_Body/Belt/Shirt/Pants,   clips [mixamo.com.001, Talking, walking]
// alex.glb wears the hardhat and boots, so it is the trainee in PPE. dave.glb
// wears a shirt and belt and holds the only Talking clip, and Dave delivers every
// line in the scenario. These were previously swapped, which left the speaking
// character with no speaking animation.
const ALEX_PATH = '/assets/models/characters/alex.glb'; // Trainee, full PPE
const DAVE_PATH = '/assets/models/characters/dave.glb'; // Supervisor, has Talking

const ROTATION_SPEED = 8.0;
const ARRIVE_THRESHOLD = 0.08;


const UP = new THREE.Vector3(0, 1, 0);
const _vForward = new THREE.Vector3();
const _vRight = new THREE.Vector3();
const _vDir = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

// ─── Walking ────────────────────────────────────────────────────────────────
// 1.15 m/s is a standard natural human walk. Stride cadence is matched to this speed.
const WALK_SPEED = 1.15;
const TURN_RATE = 10.0;      // how quickly a walker rotates toward their heading

// Collision & Walkway corridor bounds.
// The central walkable floor corridor runs from x = -1.40 to x = +0.40.
// Clamping to this range prevents characters from clipping into pallet rack columns (x >= 0.65) or side walls.
const WALK_RADIUS = 0.35;
const BODY_BAND_MIN = 0.25;
const BODY_BAND_MAX = 1.70;

// Dave holds this much clear air between himself and Alex. The walkway is 1.80m
// wide, so 0.75m fits at every stop -- but only on one side at four of the five,
// which is why the side is chosen from the destination rather than from wherever
// he happens to be standing.
const DAVE_SEPARATION = 0.75;

// Hard ceiling on how fast a character may pivot, in rad/s. The facing slerp is
// an exponential ease, so a large heading error (turning from the hazard to face
// down the aisle at the start of a journey) produced a first-frame step of ~0.4
// rad -- a 23.8 rad/s snap. 3.0 rad/s is about 172 deg/s: brisk, but a turn.
const MAX_TURN_RATE = 3.0;

const WALKWAY_X_MIN = -1.40;
const WALKWAY_X_MAX = 0.40;

// Backstop in case the hall has an open end; the walls themselves are blockers.
const HALL_X_MIN = -12.6;
const HALL_X_MAX = 12.6;
const HALL_Z_MIN = -46.0;
const HALL_Z_MAX = 7.0;

// Dave keeps pace at a conversational distance rather than glued to Alex.
const DAVE_FOLLOW_FAR = 2.2;   // starts closing the gap past this
const DAVE_FOLLOW_NEAR = 1.4;  // stops here, which is also his personal space

/** Ease an angle toward a target by the shortest way round. */
function turnToward(current, target, alpha) {
  let diff = target - current;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return current + diff * Math.min(1, alpha);
}

export class CharacterController {
  constructor(scene) {
    this.scene = scene;
    
    this.alex = null;
    this.dave = null;

    this._alexMixer = null;
    this._daveMixer = null;

    this._alexActions = {};
    this._daveActions = {};
    this._alexCurrentAction = null;
    this._daveCurrentAction = null;

    this._alexBones = {};
    this._daveBones = {};

    this._alexTarget = new THREE.Vector3(-0.35, 0, -4.5);
    this._daveTarget = new THREE.Vector3(0.75, 0, -4.3);

    this._alexTargetQuat = new THREE.Quaternion();
    this._daveTargetQuat = new THREE.Quaternion();

    // Movement targets: Alex (player trainee) on left, Dave (supervisor NPC) on right
    this._scriptedMoving = false;
    this._alexFaceAt = null; // optional explicit facing target, see moveAlex()

    this._keys = { forward: false, backward: false, left: false, right: false };
    this._moveSpeed = WALK_SPEED;
    this._blockerCache = null;
    this._pendingAlexAction = null;
    this._pendingDaveGesture = null;
    this._settleWaiters = [];
    this._alexWaypoints = [];   // legs still to walk before the final target
    this._daveWaypoints = [];   // legs still to walk before the final target
    this._setupInput();

    this._alexMoving = false;
    this._daveMoving = false;

    // Which locomotion clip each character is currently in, so walk/idle is
    // switched on transitions only and never stamps over a gesture every frame.
    this._alexWalkAnim = false;
    this._daveWalkAnim = false;
    this._playerDriving = false;
  }

  _setupInput() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this._keys.forward = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this._keys.backward = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this._keys.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this._keys.right = true;
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this._keys.forward = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this._keys.backward = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this._keys.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this._keys.right = false;
    });
  }

  async load() {
    // Load base GLB models
    const [alex, dave] = await Promise.all([
      this._loadCharacter(ALEX_PATH, 'Alex', new THREE.Vector3(-0.35, 0, -4.5)),
      this._loadCharacter(DAVE_PATH, 'Dave', new THREE.Vector3(0.75, 0, -4.3)),
    ]);
    this.alex = alex;
    this.dave = dave;

    // Initial orientation: facing forward/slight inward look at start
    if (this.alex) {
      this.alex.visible = true;
      this._alexTargetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.35);
      this.alex.quaternion.copy(this._alexTargetQuat);
    }
    if (this.dave) {
      this.dave.visible = true;
      this._daveTargetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.3);
      this.dave.quaternion.copy(this._daveTargetQuat);
    }

    // Both rigs are loaded, so the better walk cycle can now be shared.
    this._unifyLocomotion();

    // Load FBX gesture animations as overlays
    await this._loadGestureAnimations();
  }

  /**
   * Measure the stance quality of each rig's own walk cycle and give BOTH
   * characters the better one.
   *
   * The two clips are not equal. Sampling the planted foot's backward travel:
   *   dave.glb  stance 1.10-1.24 m/s (spread ~12%)  -- a clean locomotion cycle
   *   alex.glb  stance 0.34-0.68 m/s (spread ~65%)  -- uneven, and so slow that
   *                                                    reaching walking pace needs
   *                                                    a ~2x speed-up that reads
   *                                                    as a scurry
   * No timeScale can make the second clip look like walking, so the tighter cycle
   * is retargeted onto whichever rig lacks it. Both skeletons are stock Mixamo
   * with the same 65 bones differing only by prefix, so the rename is exact.
   *
   * The action is always built on the target's OWN mixer. An AnimationAction is
   * bound to one mixer and one skeleton -- sharing the object across characters
   * would drive the wrong body.
   */
  _unifyLocomotion() {
    const rigs = this._rigs;
    if (!rigs || !rigs.Alex || !rigs.Dave) return;

    const scored = [];
    for (const name of ['Alex', 'Dave']) {
      const rig = rigs[name];
      if (!rig || !rig.walkClip) continue;
      const profile = this._stanceProfile(rig.walkClip, rig.anchor, rig.bones, rig.prefix);
      if (profile) scored.push({ name, clip: rig.walkClip, spread: profile.spread });
    }
    if (scored.length === 0) return;
    scored.sort((a, b) => a.spread - b.spread);
    const best = scored[0];

    for (const name of ['Alex', 'Dave']) {
      const rig = rigs[name];
      if (!rig) continue;

      // Always rebuild the walk action from the chosen cycle, for both rigs.
      //
      // _retargetFBXClip renames the tracks onto this rig's prefix (a no-op when
      // this rig is already the source) and drops the Hips rotation track. That
      // track is the reason the walk juddered: measured across the clip, every
      // other bone returns to its starting pose at the loop point, but
      // Hips.quaternion is 36.17deg from where it began, against an ordinary
      // keyframe step of 0.70deg. Since the whole body hangs off the hips, that
      // snapped the character once per cycle -- roughly five times per journey.
      const clip = this._retargetFBXClip(best.clip, rig.prefix, false);
      const walk = rig.mixer.clipAction(clip);
      rig.actions['walk'] = walk;

      // Retime on the rig that will actually play it: limb lengths differ a
      // little, so the same clip does not cover ground at quite the same rate.
      const profile = this._stanceProfile(clip, rig.anchor, rig.bones, rig.prefix);
      if (profile) walk.timeScale = this._clampTimeScale(WALK_SPEED / profile.natural);
      this._rigWalkNatural = this._rigWalkNatural || {};
      this._rigWalkNatural[name] = profile ? profile.natural : null;
    }
  }

  async _loadCharacter(url, name, startPos) {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => {
        const char = gltf.scene;
        char.name = `${name}_Mesh`;
        
        char.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });

        // Apply authentic PBR materials to clothing, skin, and PPE (from develop)
        this._applyCharacterMaterials(char, name);

        // Wrap in anchor
        const anchor = new THREE.Group();
        anchor.name = name;
        anchor.add(char);

        // Normalize scale and ground the model
        const box = new THREE.Box3().setFromObject(char);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Center model horizontally and align feet to anchor floor (y = 0)
        char.position.set(-center.x, -box.min.y, -center.z);

        if (size.y > 0.1) {
          const targetHeight = 1.78;
          const scaleFactor = targetHeight / size.y;
          anchor.scale.set(scaleFactor, scaleFactor, scaleFactor);
        }

        anchor.position.copy(startPos);
        this.scene.add(anchor);

        // Cache bones for kinematic movement & gestures
        const bones = {};
        char.traverse((n) => {
          if (n.isBone) bones[n.name] = n;
        });

        // The two GLB rigs do NOT share a bone naming scheme: one exports as
        // "mixamorigHips", the other as "mixamorig1Hips". The FBX gesture clips
        // are authored against one of them, so the prefix must be detected per
        // character and the clips retargeted onto it -- see _retargetFBXClip.
        const bonePrefix = this._bonePrefix(bones);
        if (name === 'Alex') {
          this._alexBones = bones;
          this._alexBonePrefix = bonePrefix;
        } else {
          this._daveBones = bones;
          this._daveBonePrefix = bonePrefix;
        }

        // Setup Mixer on GLTF scene and register embedded clips
        const mixer = new THREE.AnimationMixer(char);
        const actions = {};
        let walkClip = null;

        if (gltf.animations && gltf.animations.length > 0) {
          for (const raw of gltf.animations) {
            // Root motion is baked into these clips (dave.glb's walk carries
            // 0.396m per 1.23s loop). Position is owned by the movement code, so
            // strip it here exactly as the FBX gestures already have it stripped,
            // otherwise the character drifts off its own target.
            const clip = this._stripRootMotion(raw);
            const action = mixer.clipAction(clip);
            const lowerName = clip.name.toLowerCase();
            if (lowerName.includes('walk')) {
              // Retime the stride to the speed we actually travel at, or the feet skate.
              action.timeScale = this._walkTimeScale(clip, anchor, bones, bonePrefix);
              actions['walk'] = action;
              walkClip = clip;
            } else if (lowerName.includes('talk')) {
              actions['talk'] = action;
            } else {
              actions['idle'] = action;
            }
          }
        }

        if (name === 'Alex') {
          this._alexMixer = mixer;
          this._alexActions = actions;
          if (actions['idle']) this._playAction('Alex', 'idle');
        } else {
          this._daveMixer = mixer;
          this._daveActions = actions;
          if (actions['idle']) this._playAction('Dave', 'idle');
        }

        this._rigs = this._rigs || {};
        this._rigs[name] = { anchor, bones, prefix: bonePrefix, mixer, actions, walkClip };

        // Fallback for static posture if idle clip missing
        if (!actions['idle']) {
          this._applyDefaultArmPosture(bones);
        }

        resolve(anchor);
      }, undefined, reject);
    });
  }

  /** The rig prefix this skeleton actually uses, e.g. "mixamorig" or "mixamorig1". */
  _bonePrefix(bones) {
    for (const boneName of Object.keys(bones)) {
      const match = boneName.match(/^(mixamorig\d*)/);
      if (match) return match[1];
    }
    return '';
  }

  _applyDefaultArmPosture(bones) {
    const lArm = bones['mixamorig1LeftArm'] || bones['mixamorigLeftArm'];
    const rArm = bones['mixamorig1RightArm'] || bones['mixamorigRightArm'];
    if (lArm) lArm.rotation.set(0.1, 0, -1.35);
    if (rArm) rArm.rotation.set(0.1, 0, 1.35);
  }

  async _loadGestureAnimations() {
    const fbxLoader = new FBXLoader();
    const loadFbx = (url) => new Promise((resolve) => fbxLoader.load(url, resolve, undefined, () => resolve(null)));

    const animDir = '/assets/models/characters';
    const clipsToLoad = [
      { name: 'dismiss', file: 'dave_Dismissing Gesture.fbx', for: 'Dave' },
      { name: 'shrug', file: 'dave_Shrugging.fbx', for: 'Dave' },
      { name: 'point', file: 'dave_point.fbx', for: 'Dave' },
      { name: 'nod', file: 'dave_Sarcastic Head Nod.fbx', for: 'Dave' },
      { name: 'place', file: 'alex_place.fbx', for: 'Alex' },
      { name: 'report', file: 'alex_report.fbx', for: 'Alex' }
    ];

    for (const def of clipsToLoad) {
      const fbx = await loadFbx(`${animDir}/${def.file}`);
      if (!fbx || !fbx.animations || fbx.animations.length === 0) continue;
      
      let clip = fbx.animations[0];
      clip.name = def.name;

      const isAlex = def.for === 'Alex';
      const mixer = isAlex ? this._alexMixer : this._daveMixer;
      const actions = isAlex ? this._alexActions : this._daveActions;
      const targetPrefix = isAlex ? this._alexBonePrefix : this._daveBonePrefix;

      const retargetedClip = this._retargetFBXClip(clip, targetPrefix);
      if (retargetedClip && mixer) {
        const action = mixer.clipAction(retargetedClip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = false;
        actions[def.name] = action;
      }
    }
  }

  /**
   * Rebind an FBX clip onto a skeleton that may use a different rig prefix.
   *
   * Mixamo exports vary: tracks arrive as "mixamorig:Hips.quaternion" (namespaced),
   * "mixamorigHips.quaternion", or "mixamorig1Hips.quaternion". The old version only
   * rewrote names containing a colon, so colon-free clips passed through untouched and
   * bound to nothing whenever the target rig used a different prefix -- which is exactly
   * why Dave's gestures animated nothing. Strip whatever prefix the clip carries and
   * re-apply the target's own.
   */
  /** Drop baked root translation; the movement code owns position. */
  _stripRootMotion(clip) {
    const tracks = clip.tracks.filter((t) => !/Hips\.position$/.test(t.name));
    if (tracks.length === clip.tracks.length) return clip;
    return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
  }

  /** Keep a retimed clip within believable bounds whatever the source material. */
  _clampTimeScale(value) {
    if (!isFinite(value)) return 1;
    return Math.min(2.5, Math.max(0.4, value));
  }

  /**
   * How fast the ground passes under a character playing this clip, and how
   * steady that speed is.
   *
   * Root motion cannot tell us: both rigs export near in-place walks (alex drifts
   * 0.063m over 3.03s, dave 0.396m over 1.23s), so the pace has to come from the
   * feet. During stance the planted foot travels backward relative to the body at
   * exactly the speed the ground moves underneath. Stance is isolated as the
   * lower foot while it sits in the bottom quarter of its vertical range, which
   * excludes the swing phase and the fast heel-strike/toe-off transitions that
   * otherwise dominate the distribution.
   *
   * Returns { natural, spread } where spread is the interquartile width relative
   * to the median -- a real walk cycle holds a near-constant stance speed, so a
   * wide spread means the clip is not usable locomotion.
   */
  _stanceProfile(clip, anchor, bones, prefix) {
    try {
      const hips = bones[prefix + 'Hips'];
      const feet = [bones[prefix + 'LeftFoot'], bones[prefix + 'RightFoot']];
      if (!hips || !feet[0] || !feet[1] || !clip || !clip.duration) return null;

      const probe = new THREE.AnimationMixer(anchor);
      probe.clipAction(clip).play();

      const SAMPLES = 240;
      const dt = clip.duration / SAMPLES;
      const relZ = [[], []];
      const footY = [[], []];
      const foot = new THREE.Vector3();
      const hip = new THREE.Vector3();
      for (let i = 0; i < SAMPLES; i++) {
        probe.setTime(i * dt);
        anchor.updateMatrixWorld(true);
        hips.getWorldPosition(hip);
        for (let k = 0; k < 2; k++) {
          feet[k].getWorldPosition(foot);
          relZ[k].push(foot.z - hip.z);
          footY[k].push(foot.y);
        }
      }
      probe.stopAllAction();
      probe.uncacheRoot(anchor);

      const lo = [Math.min.apply(null, footY[0]), Math.min.apply(null, footY[1])];
      const hi = [Math.max.apply(null, footY[0]), Math.max.apply(null, footY[1])];
      const stance = [];
      for (let i = 1; i < SAMPLES; i++) {
        const k = footY[0][i] <= footY[1][i] ? 0 : 1;
        if (footY[k][i] >= lo[k] + 0.25 * (hi[k] - lo[k])) continue; // swinging, not planted
        const v = (relZ[k][i] - relZ[k][i - 1]) / dt;
        if (v < 0) stance.push(-v);
      }
      if (stance.length < 8) return null;

      stance.sort((a, b) => a - b);
      const at = (f) => stance[Math.floor(stance.length * f)];
      const natural = at(0.5);
      if (!isFinite(natural) || natural < 0.05) return null;
      return { natural, spread: (at(0.75) - at(0.25)) / natural };
    } catch (err) {
      return null; // a retimed clip is a nicety; never let it break loading
    }
  }

  /** Playback rate that makes this clip's stride match WALK_SPEED. */
  _walkTimeScale(clip, anchor, bones, prefix) {
    const profile = this._stanceProfile(clip, anchor, bones, prefix);
    if (!profile) return 1;
    return this._clampTimeScale(WALK_SPEED / profile.natural);
  }

  /**
   * Switch a character between their walk and idle clip, on transitions only.
   * Called every frame while moving, so it must not restart or override the
   * clip that is already playing (a gesture, for instance).
   */
  _setLocomotion(who, isWalking) {
    const key = who === 'Alex' ? '_alexWalkAnim' : '_daveWalkAnim';
    if (this[key] === isWalking) return;
    this[key] = isWalking;

    if (isWalking) {
      const actions = who === 'Alex' ? this._alexActions : this._daveActions;
      for (const k in actions) {
        if (k !== 'walk' && k !== 'idle' && actions[k]) {
          actions[k].stop();
          actions[k].weight = 0;
        }
      }
    }

    this._playAction(who, isWalking ? 'walk' : 'idle');
  }



  _retargetFBXClip(clip, targetPrefix, keepRootRotation = false) {
    const newTracks = [];
    for (const track of clip.tracks) {
      const dotIdx = track.name.indexOf('.');
      if (dotIdx <= 0) continue;

      let node = track.name.substring(0, dotIdx);
      const property = track.name.substring(dotIdx);

      const colonIdx = node.indexOf(':');
      if (colonIdx >= 0) node = node.substring(colonIdx + 1);
      node = node.replace(/^mixamorig\d*/, '');

      // Root translation and rotation are dropped so a gesture never teleports
      // the character or pitches them onto their back; position is owned by the
      // movement code and facing by the target quaternion.
      if (node === 'Hips' && property === '.position') continue;
      if (node === 'Hips' && property === '.quaternion' && !keepRootRotation) continue;

      const newTrack = track.clone();
      newTrack.name = targetPrefix + node + property;
      newTracks.push(newTrack);
    }
    return new THREE.AnimationClip(clip.name, clip.duration, newTracks, clip.blendMode);
  }

  _playAction(charName, actionName) {
    const isAlex = charName === 'Alex';
    const actions = isAlex ? this._alexActions : this._daveActions;
    const currentAction = isAlex ? this._alexCurrentAction : this._daveCurrentAction;
    const nextAction = actions[actionName] || actions['idle'];

    if (!nextAction) return;
    if (currentAction === nextAction && nextAction.isRunning()) return;

    nextAction.enabled = true;
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);

    if (currentAction && currentAction !== nextAction) {
      currentAction.crossFadeTo(nextAction, 0.25, true);
    }

    nextAction.reset();
    nextAction.play();

    if (isAlex) {
      this._alexCurrentAction = nextAction;
    } else {
      this._daveCurrentAction = nextAction;
    }
  }

  playDaveGesture(gestureName) {
    if (this._daveMoving) {
      this._pendingDaveGesture = gestureName;
      return;
    }
    const gestureAction = this._daveActions[gestureName] || this._daveActions['talk'];
    if (gestureAction && !this._daveMoving) {
      const actualName = this._daveActions[gestureName] ? gestureName : 'talk';
      this._playAction('Dave', actualName);
      const clipDuration = gestureAction.getClip().duration || 2.0;
      if (this._daveGestureTimer) clearTimeout(this._daveGestureTimer);
      this._daveGestureTimer = setTimeout(() => {
        if (!this._daveMoving) {
          this._playAction('Dave', 'idle');
        }
      }, clipDuration * 1000);
    }
  }

  playAlexAction(actionName) {
    if (this._alexMoving) {
      this._pendingAlexAction = actionName;
      return;
    }
    const alexAction = this._alexActions[actionName];
    if (alexAction && !this._alexMoving) {
      this._playAction('Alex', actionName);
      const rawDuration = alexAction.getClip().duration || 2.0;
      const clipDuration = Math.min(2.2, rawDuration);
      if (this._alexActionTimer) clearTimeout(this._alexActionTimer);
      this._alexActionTimer = setTimeout(() => {
        if (!this._alexMoving) {
          this._playAction('Alex', 'idle');
        }
      }, clipDuration * 1000);
    }
  }

  /**
   * @param {{x:number,y:number,z:number}} pos    where Alex walks to
   * @param {{x:number,z:number}|null}     faceAt optional point to turn towards
   *   on arrival. When omitted, the per-stop staging angles below still apply.
   */
  /**
   * Where Dave stands relative to Alex: DAVE_SEPARATION to one side, on the
   * walkway, never inside the racking.
   *
   * The side is decided by which one actually has room at the destination. The
   * walkway runs x -1.40..0.40 and Alex's stop positions sit close to its edges,
   * so at four of the five stops only one side clears 0.75m (stop_02 right has
   * 0.10m, stop_04 right has 0.00m). Choosing from Dave's current side instead
   * would clamp him to within a body width of Alex.
   */
  _calcDaveOffset(alexPos, hazardPos) {
    const roomRight = WALKWAY_X_MAX - alexPos.x;
    const roomLeft = alexPos.x - WALKWAY_X_MIN;

    // Detect active cordoned hazard zones to guarantee Dave is never placed inside one
    const cordonBoxes = [];
    if (this.scene) {
      const b = new THREE.Box3();
      this.scene.traverse((o) => {
        if (o.isGroup && (o.name || '').startsWith('Cordon_')) {
          b.setFromObject(o);
          if (Number.isFinite(b.min.x)) {
            cordonBoxes.push({ xMin: b.min.x - 0.25, xMax: b.max.x + 0.25, zMin: b.min.z - 0.25, zMax: b.max.z + 0.25 });
          }
        }
      });
    }

    const isInsideAnyCordon = (px, pz) => {
      for (const c of cordonBoxes) {
        if (px >= c.xMin && px <= c.xMax && pz >= c.zMin && pz <= c.zMax) return true;
      }
      return false;
    };

    // Candidate 1: Right-hand side
    const candRightX = Math.min(WALKWAY_X_MAX, alexPos.x + DAVE_SEPARATION);
    const candRightZ = alexPos.z + 0.15;
    const rightClear = !isInsideAnyCordon(candRightX, candRightZ);

    // Candidate 2: Left-hand side
    const candLeftX = Math.max(WALKWAY_X_MIN, alexPos.x - DAVE_SEPARATION);
    const candLeftZ = alexPos.z + 0.15;
    const leftClear = !isInsideAnyCordon(candLeftX, candLeftZ);

    const fits = [];
    if (roomRight >= DAVE_SEPARATION && rightClear) fits.push(1);
    if (roomLeft >= DAVE_SEPARATION && leftClear) fits.push(-1);

    let sign;
    if (fits.length === 2) {
      // Both sides clear; keep sightline to hazard open
      sign = (hazardPos && hazardPos.x > alexPos.x) ? -1 : 1;
    } else if (fits.length === 1) {
      sign = fits[0];
    } else if (rightClear && !leftClear) {
      sign = 1;
    } else if (leftClear && !rightClear) {
      sign = -1;
    } else {
      sign = roomRight >= roomLeft ? 1 : -1;
    }

    let targetX = alexPos.x + sign * DAVE_SEPARATION;
    let targetZ = alexPos.z + 0.15;

    // If placing Dave laterally would put him inside a cordon, stage him safely behind Alex
    if (isInsideAnyCordon(targetX, targetZ)) {
      targetX = Math.max(WALKWAY_X_MIN, Math.min(WALKWAY_X_MAX, alexPos.x + 0.15));
      targetZ = alexPos.z + 0.65;
    } else {
      targetX = Math.max(WALKWAY_X_MIN, Math.min(WALKWAY_X_MAX, targetX));
    }

    return new THREE.Vector3(targetX, alexPos.y, targetZ);
  }

  setPositionAlex(pos, faceAt = null) {
    if (!this.alex) return;
    this.alex.visible = true;
    const safeX = Math.max(WALKWAY_X_MIN, Math.min(WALKWAY_X_MAX, pos.x));
    this.alex.position.set(safeX, pos.y, pos.z);
    this._alexTarget.copy(this.alex.position);
    this._alexMoving = false;
    this._alexLookLock = false;
    this._alexWalkAnim = false;
    if (faceAt) {
      this._setTargetFacing(this.alex, faceAt, this._alexTargetQuat);
      this.alex.quaternion.copy(this._alexTargetQuat);
    }
    this._playAction('Alex', 'idle');
  }

  setPositionDave(pos, hazardPos = null) {
    if (!this.dave) return;
    this.dave.visible = true;
    const davePos = this._calcDaveOffset(pos, hazardPos);
    this.dave.position.copy(davePos);
    this._daveTarget.copy(this.dave.position);
    this._daveMoving = false;
    this._daveLookLock = false;
    this._daveWalkAnim = false;
    if (hazardPos) {
      this._setTargetFacing(this.dave, hazardPos, this._daveTargetQuat);
      this.dave.quaternion.copy(this._daveTargetQuat);
    }
    this._playAction('Dave', 'idle');
  }

  moveAlex(pos, faceAt = null, waypoints = []) {
    if (!this.alex) return;
    this.alex.visible = true;
    this._alexWaypoints = (waypoints || []).map((p) => new THREE.Vector3(
      Math.max(WALKWAY_X_MIN, Math.min(WALKWAY_X_MAX, p.x)),
      p.y ?? 0,
      p.z
    ));
    const safeX = Math.max(WALKWAY_X_MIN, Math.min(WALKWAY_X_MAX, pos.x));
    const finalTarget = new THREE.Vector3(safeX, pos.y ?? 0, pos.z);

    if (this._alexWaypoints.length > 0) {
      const first = this._alexWaypoints.shift();
      this._alexWaypoints.push(finalTarget);
      this._alexTarget.copy(first);
    } else {
      this._alexTarget.copy(finalTarget);
    }

    this._alexFaceAt = faceAt;   // applied on arrival, see update()
    this._alexLookLock = false;  // walking faces travel direction until then
    const dist = this.alex.position.distanceTo(this._alexTarget);
    if (dist > ARRIVE_THRESHOLD) {
      this._alexMoving = true;
      this._setTargetFacing(this.alex, this._alexTarget, this._alexTargetQuat);
      this._setLocomotion('Alex', true);
    }
  }

  moveDave(pos, hazardPos, waypoints = []) {
    if (!this.dave) return;
    this.dave.visible = true;
    const davePos = this._calcDaveOffset(pos, hazardPos);
    this._daveWaypoints = (waypoints || []).map((p) => this._calcDaveOffset(p, hazardPos));

    // If his side has to change for the new stop, crossing straight to it would
    // cut through Alex -- measured at 0.166m apart mid-journey, well inside body
    // width. Step across first, a little further back, so he passes behind Alex,
    // who has already set off; then walk the journey parallel on the new side.
    const sideNow = Math.sign(this.dave.position.x - (this.alex ? this.alex.position.x : pos.x)) || 1;
    const sideEnd = Math.sign(davePos.x - pos.x) || 1;
    if (this.alex && sideNow !== sideEnd && this._daveWaypoints.length === 0) {
      const acrossX = Math.max(WALKWAY_X_MIN, Math.min(WALKWAY_X_MAX,
        this.alex.position.x + sideEnd * DAVE_SEPARATION));
      this._daveWaypoints.push(davePos.clone());
      this._daveTarget.set(acrossX, this.dave.position.y, this.dave.position.z + 0.30);
    } else if (this._daveWaypoints.length > 0) {
      const first = this._daveWaypoints.shift();
      this._daveWaypoints.push(davePos.clone());
      this._daveTarget.copy(first);
    } else {
      this._daveTarget.copy(davePos);
    }

    this._daveFaceAt = hazardPos || null; // turn to the hazard once he arrives
    this._daveLookLock = false;           // walk faces travel until then
    const dist = this.dave.position.distanceTo(this._daveTarget);
    if (dist > ARRIVE_THRESHOLD) {
      this._daveMoving = true;
      this._setTargetFacing(this.dave, this._daveTarget, this._daveTargetQuat);
      this._setLocomotion('Dave', true);
    }
  }

  /**
   * Move Dave to an explicit position without automatic companion offset calculation.
   * Used for explicit staging (e.g. conversational facing debriefs).
   */
  moveDaveTo(exactPos, faceAt = null, waypoints = []) {
    if (!this.dave) return;
    this.dave.visible = true;
    this._daveWaypoints = (waypoints || []).map((p) => new THREE.Vector3(
      Math.max(WALKWAY_X_MIN, Math.min(WALKWAY_X_MAX, p.x)),
      p.y ?? 0,
      p.z
    ));
    const safeX = Math.max(WALKWAY_X_MIN, Math.min(WALKWAY_X_MAX, exactPos.x));
    const finalTarget = new THREE.Vector3(safeX, exactPos.y ?? 0, exactPos.z);

    if (this._daveWaypoints.length > 0) {
      const first = this._daveWaypoints.shift();
      this._daveWaypoints.push(finalTarget);
      this._daveTarget.copy(first);
    } else {
      this._daveTarget.copy(finalTarget);
    }

    this._daveFaceAt = faceAt;
    this._daveLookLock = false;
    const dist = this.dave.position.distanceTo(this._daveTarget);
    if (dist > ARRIVE_THRESHOLD) {
      this._daveMoving = true;
      this._setTargetFacing(this.dave, this._daveTarget, this._daveTargetQuat);
      this._setLocomotion('Dave', true);
    }
  }

  lookAlexAtDave() {
    if (!this.alex || !this.dave) return;
    this._alexLookLock = true;
    this._setTargetFacing(this.alex, this.dave.position, this._alexTargetQuat);
  }

  lookDaveAtAlex() {
    if (!this.dave || !this.alex) return;
    this._daveLookLock = true;
    this._setTargetFacing(this.dave, this.alex.position, this._daveTargetQuat);
  }

  lookAlexAtPosition(pos) {
    if (!this.alex || !pos) return;
    const target = new THREE.Vector3(pos.x, pos.y, pos.z);
    this._alexLookLock = true;
    this._setTargetFacing(this.alex, target, this._alexTargetQuat);
  }

  lookDaveAtPosition(pos) {
    if (!this.dave || !pos) return;
    const target = new THREE.Vector3(pos.x, pos.y, pos.z);
    this._daveLookLock = true;
    this._setTargetFacing(this.dave, target, this._daveTargetQuat);
  }

  _setTargetFacing(character, targetPos, targetQuat) {
    const dx = targetPos.x - character.position.x;
    const dz = targetPos.z - character.position.z;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      const angle = Math.atan2(dx, dz);
      targetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    }
  }

  /** Current Y rotation read back off the quaternion, the single source of truth. */
  /**
   * Ease a character toward their facing target, but never faster than a person
   * can pivot. Plain slerp takes a fixed fraction of the remaining angle, so the
   * bigger the turn the faster the first frame -- which is what snapped Alex
   * round at the start of each journey.
   */
  _easeFacing(obj, targetQuat, dt) {
    const dot = Math.min(1, Math.abs(obj.quaternion.dot(targetQuat)));
    const angle = 2 * Math.acos(dot);
    if (angle < 1e-4) return;
    const eased = ROTATION_SPEED * dt;
    const capped = (MAX_TURN_RATE * dt) / angle;
    obj.quaternion.slerp(targetQuat, Math.min(1, eased, capped));
  }

  _yawOf(obj) {
    _euler.setFromQuaternion(obj.quaternion, 'YXZ');
    return _euler.y;
  }

  /** Strip any pitch/roll from a character root without an Euler round-trip. */
  _forceUpright(obj) {
    if (!obj) return;
    const q = obj.quaternion;
    if (Math.abs(q.x) > 1e-6 || Math.abs(q.z) > 1e-6) {
      q.set(0, q.y, 0, q.w).normalize();
    }
  }

  /** True when neither character is mid-walk. */
  get isSettled() {
    return !this._alexMoving && !this._daveMoving;
  }

  /**
   * Run cb once both characters have finished walking (immediately if they
   * already have). Stop choreography keys off this instead of guessing a fixed
   * delay, because the walk between stops takes as long as the distance needs.
   */
  whenSettled(cb) {
    if (this.isSettled) { cb(); return; }
    this._settleWaiters.push(cb);
  }

  /** Drop queued animation/choreography work; used when the stop changes. */
  cancelPendingActions() {
    this._alexWaypoints.length = 0;
    this._daveWaypoints.length = 0;
    this._pendingAlexAction = null;
    this._pendingDaveGesture = null;
    this._settleWaiters.length = 0;
  }

  _quatFromY(angle) {
    const q = new THREE.Quaternion();
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    return q;
  }



  /**
   * Call every frame from the render loop.
   * @param {number} delta
   * @param {import('./CameraRig.js').CameraRig} [cameraRig]
   */
  /**
   * Solid geometry the characters cannot walk through, as 2D boxes in the XZ
   * plane. Collected once from the scene and cached.
   *
   * Only meshes whose vertical extent overlaps a body band are kept, which is
   * what makes this cheap and correct: floor paint and the spill sit below it,
   * and the archway lintels sit above it, so the openings stay walkable without
   * anyone having to tag them. Boxes are inflated by the walker's radius up
   * front, which turns the per-frame test into a point-in-box check.
   */
  invalidateBlockers() {
    this._blockerCache = null;
  }

  _blockers() {
    if (this._blockerCache) return this._blockerCache;

    const boxes = [];
    const box = new THREE.Box3();
    this.scene.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      // Characters move; cordon geometry is handled distinctly below
      for (let p = o; p; p = p.parent) {
        if (p.name === 'Alex' || p.name === 'Dave' || (p.name || '').startsWith('Cordon_')) return;
      }
      box.setFromObject(o);
      if (!Number.isFinite(box.min.x)) return;
      if (box.max.y < BODY_BAND_MIN || box.min.y > BODY_BAND_MAX) return;
      boxes.push({
        x0: box.min.x - WALK_RADIUS, x1: box.max.x + WALK_RADIUS,
        z0: box.min.z - WALK_RADIUS, z1: box.max.z + WALK_RADIUS,
      });
    });

    // Active Cordon Barriers: Block characters from stepping inside hazard tape
    this.scene.traverse((o) => {
      if (o.isGroup && (o.name || '').startsWith('Cordon_')) {
        box.setFromObject(o);
        if (Number.isFinite(box.min.x)) {
          boxes.push({
            x0: box.min.x - WALK_RADIUS * 0.5,
            x1: box.max.x + WALK_RADIUS * 0.5,
            z0: box.min.z - WALK_RADIUS * 0.5,
            z1: box.max.z + WALK_RADIUS * 0.5,
          });
        }
      }
    });

    this._blockerCache = boxes;
    return boxes;
  }

  /** True when a walker centred here is clear of every blocker. */
  _isFree(x, z) {
    const b = this._blockers();
    for (let i = 0; i < b.length; i++) {
      if (x > b[i].x0 && x < b[i].x1 && z > b[i].z0 && z < b[i].z1) return false;
    }
    return x > HALL_X_MIN && x < HALL_X_MAX && z > HALL_Z_MIN && z < HALL_Z_MAX;
  }

  /**
   * Slide a walker to a new position, resolving each axis separately so grazing
   * a wall slides along it instead of stopping dead.
   */
  _slide(obj, stepX, stepZ) {
    let moved = false;
    if (stepX && this._isFree(obj.position.x + stepX, obj.position.z)) { obj.position.x += stepX; moved = true; }
    if (stepZ && this._isFree(obj.position.x, obj.position.z + stepZ)) { obj.position.z += stepZ; moved = true; }
    return moved;
  }

  /** Camera-relative walk driven by the WASD / arrow flags. */
  _stepPlayer(dt, cameraRig) {
    const yaw = cameraRig ? cameraRig.yaw : 0;
    _vForward.set(0, 0, -1).applyAxisAngle(UP, yaw);
    _vRight.set(1, 0, 0).applyAxisAngle(UP, yaw);

    _vDir.set(0, 0, 0);
    if (this._keys.forward) _vDir.add(_vForward);
    if (this._keys.backward) _vDir.sub(_vForward);
    if (this._keys.right) _vDir.add(_vRight);
    if (this._keys.left) _vDir.sub(_vRight);
    if (_vDir.lengthSq() < 1e-6) {
      this._setLocomotion('Alex', false);
      return;
    }

    // Normalise so holding two keys is not 1.41x faster than one.
    _vDir.normalize();

    const step = this._moveSpeed * dt;
    const moved = this._slide(this.alex, _vDir.x * step, _vDir.z * step);

    // Turn toward the heading rather than snapping to it.
    // These GLB rigs face +Z, not the three.js default -Z (verified against the
    // loaded models), so the heading is atan2(x, z). The negated form used here
    // previously came from a -Z assumption and made Alex walk backwards.
    const targetYaw = Math.atan2(_vDir.x, _vDir.z);
    const facingYaw = turnToward(this._yawOf(this.alex), targetYaw, 1.0 - Math.exp(-TURN_RATE * dt));
    this._alexTargetQuat.setFromAxisAngle(UP, facingYaw);
    this.alex.quaternion.copy(this._alexTargetQuat);
    this._alexFaceAt = null;
    this._alexLookLock = false;
    // The scripted walk must not drag Alex back to a stale stop anchor the
    // moment the player lets go of the keys.
    this._alexTarget.copy(this.alex.position);

    // Walk when he actually covered ground; standing still against a wall or
    // cancelling two keys should read as idle, not a treadmill.
    this._setLocomotion('Alex', moved);
  }

  /**
   * Dave walks the trainee round, so he keeps up rather than standing frozen.
   * He holds a conversational distance instead of glueing himself to Alex: he
   * only closes the gap once it opens past DAVE_FOLLOW_FAR, and stops again at
   * DAVE_FOLLOW_NEAR, which reads as walking with someone rather than tailing.
   */
  _followWithDave(dt) {
    if (!this.dave || !this.alex) return;

    const dx = this.alex.position.x - this.dave.position.x;
    const dz = this.alex.position.z - this.dave.position.z;
    const gap = Math.hypot(dx, dz);

    if (gap > DAVE_FOLLOW_FAR) {
      const step = Math.min(this._moveSpeed, this._moveSpeed * (gap / DAVE_FOLLOW_FAR)) * dt;
      const nx = (dx / gap) * step;
      const nz = (dz / gap) * step;
      if (gap - step > DAVE_FOLLOW_NEAR) {
        const moved = this._slide(this.dave, nx, nz);
        this._setLocomotion('Dave', moved);
        if (moved && !this._daveLookLock) {
          const targetYaw = Math.atan2(nx, nz);
          const facingYaw = turnToward(this._yawOf(this.dave), targetYaw, 1.0 - Math.exp(-TURN_RATE * dt));
          this._daveTargetQuat.setFromAxisAngle(UP, facingYaw);
          this.dave.quaternion.copy(this._daveTargetQuat);
        }
      }
    } else {
      this._setLocomotion('Dave', false);
      if (!this._daveLookLock) {
        const targetYaw = Math.atan2(dx, dz);
        const facingYaw = turnToward(this._yawOf(this.dave), targetYaw, 1.0 - Math.exp(-3.0 * dt));
        this._daveTargetQuat.setFromAxisAngle(UP, facingYaw);
        this.dave.quaternion.copy(this._daveTargetQuat);
      }
    }
    this._daveTarget.copy(this.dave.position);
  }

  update(delta, cameraRig) {
    const dt = Math.min(delta, 0.1);

    this._alexMixer?.update(dt);
    this._daveMixer?.update(dt);

    // Free player movement takes priority over the scripted walk, so a stop
    // transition never fights the player for control of Alex. (from develop)
    const walking = this._keys && (this._keys.forward || this._keys.backward || this._keys.left || this._keys.right);
    if (walking && this.alex) {
      this._alexMoving = false;
      this._daveMoving = false;
      this._stepPlayer(dt, cameraRig);
      this._followWithDave(dt);
      this._playerDriving = true;
      return;
    }

    // Player just let go of the keys: settle both back to idle once, rather
    // than asserting idle every frame (which would cut a gesture short).
    if (this._playerDriving) {
      this._playerDriving = false;
      this._setLocomotion('Alex', false);
      this._setLocomotion('Dave', false);
    }

    // Update Alex movement
    if (this.alex) {
      if (this._alexMoving) {
        const dist = this.alex.position.distanceTo(this._alexTarget);
        if (dist > ARRIVE_THRESHOLD) {
          _vDir.subVectors(this._alexTarget, this.alex.position);
          _vDir.y = 0;
          const remaining = _vDir.length();
          _vDir.normalize();

          const step = Math.min(remaining, WALK_SPEED * dt);
          this.alex.position.x += _vDir.x * step;
          this.alex.position.z += _vDir.z * step;
          this.alex.position.x = Math.max(WALKWAY_X_MIN, Math.min(WALKWAY_X_MAX, this.alex.position.x));
          this._setLocomotion('Alex', true);

          if (!this._alexLookLock && (Math.abs(_vDir.x) > 1e-4 || Math.abs(_vDir.z) > 1e-4)) {
            const targetYaw = Math.atan2(_vDir.x, _vDir.z);
            const facingYaw = turnToward(this._yawOf(this.alex), targetYaw, 1.0 - Math.exp(-TURN_RATE * dt));
            this._alexTargetQuat.setFromAxisAngle(UP, facingYaw);
          }
        } else {
          this.alex.position.copy(this._alexTarget);
          if (this._alexWaypoints.length > 0) {
            this._alexTarget.copy(this._alexWaypoints.shift());
          } else {
            this._alexMoving = false;
            if (this._alexFaceAt && !this._alexLookLock) {
              this._alexLookLock = true;
              this._setTargetFacing(this.alex, this._alexFaceAt, this._alexTargetQuat);
            }
            this._alexWalkAnim = false;
            if (this._pendingAlexAction) {
              const queued = this._pendingAlexAction;
              this._pendingAlexAction = null;
              this.playAlexAction(queued);
            } else {
              this._playAction('Alex', 'idle');
            }
          }
        }
      }
      this._easeFacing(this.alex, this._alexTargetQuat, dt);
    }

    // Update Dave movement
    if (this.dave) {
      if (this._daveMoving) {
        const dist = this.dave.position.distanceTo(this._daveTarget);
        if (dist > ARRIVE_THRESHOLD) {
          _vDir.subVectors(this._daveTarget, this.dave.position);
          _vDir.y = 0;
          const remaining = _vDir.length();
          _vDir.normalize();

          const step = Math.min(remaining, WALK_SPEED * dt);
          this.dave.position.x += _vDir.x * step;
          this.dave.position.z += _vDir.z * step;
          this.dave.position.x = Math.max(WALKWAY_X_MIN, Math.min(WALKWAY_X_MAX, this.dave.position.x));
          this._setLocomotion('Dave', true);

          if (!this._daveLookLock && (Math.abs(_vDir.x) > 1e-4 || Math.abs(_vDir.z) > 1e-4)) {
            const targetYaw = Math.atan2(_vDir.x, _vDir.z);
            const facingYaw = turnToward(this._yawOf(this.dave), targetYaw, 1.0 - Math.exp(-TURN_RATE * dt));
            this._daveTargetQuat.setFromAxisAngle(UP, facingYaw);
          }
        } else {
          this.dave.position.copy(this._daveTarget);
          if (this._daveWaypoints.length > 0) {
            // Crossing leg done; carry straight on to the next one. He stays in
            // the walk state, so this is one continuous journey, not two walks.
            this._daveTarget.copy(this._daveWaypoints.shift());
          } else {
            this._daveMoving = false;
            if (this._daveFaceAt && !this._daveLookLock) {
              this._daveLookLock = true;
              this._setTargetFacing(this.dave, this._daveFaceAt, this._daveTargetQuat);
            }
            this._daveWalkAnim = false;
            if (this._pendingDaveGesture) {
              const queued = this._pendingDaveGesture;
              this._pendingDaveGesture = null;
              this.playDaveGesture(queued);
            } else {
              this._playAction('Dave', 'idle');
            }
          }
        }
      }
      this._easeFacing(this.dave, this._daveTargetQuat, dt);
    }

    if (this._settleWaiters.length > 0 && this.isSettled) {
      const waiters = this._settleWaiters.slice();
      this._settleWaiters.length = 0;
      for (const cb of waiters) cb();
    }

    // Keep both characters upright.
    //
    // This used to be written as `rotation.x = 0; rotation.z = 0`, which looks
    // harmless but is not: Object3D.rotation is only re-derived from the
    // quaternion when the quaternion fires its change callback, and slerp leaves
    // it stale. Assigning to rotation.x then rebuilt the quaternion from that
    // stale Euler every frame, pulling the character back toward its previous
    // facing. The result was an equilibrium partway to every target -- characters
    // that turned most of the way and then stopped, with the error growing the
    // further they had to turn.
    //
    // Every facing writer here produces a Y-only quaternion and slerp between two
    // Y-only quaternions stays Y-only, so upright is guaranteed by construction.
    // This keeps a cheap assertion of that invariant without touching Euler.
    this._forceUpright(this.alex);
    this._forceUpright(this.dave);


    if (cameraRig && this.alex) {
      cameraRig.followTarget(this.alex.position);
    }
  }

  /**
   * Preserves authentic embedded textures on character models and ensures full warehouse styling.
   * Clones materials per submesh so distinct clothing and PPE elements render with rich PBR fidelity.
   */
  _applyCharacterMaterials(char, name) {
    if (name === 'Dave') {
      const texLoader = new THREE.TextureLoader();
      const daveDiffuse = texLoader.load('/assets/textures/dave_diffuse.png');
      daveDiffuse.colorSpace = THREE.SRGBColorSpace;
      daveDiffuse.flipY = false;

      const daveHair = texLoader.load('/assets/textures/dave_hair.png');
      daveHair.colorSpace = THREE.SRGBColorSpace;
      daveHair.flipY = false;

      const bodyMat = new THREE.MeshStandardMaterial({
        map: daveDiffuse,
        roughness: 0.65,
        metalness: 0.08,
      });

      const hairMat = new THREE.MeshStandardMaterial({
        map: daveHair,
        roughness: 0.75,
        transparent: true,
        alphaTest: 0.5,
      });

      char.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          const nodeName = (node.name || '').toLowerCase();
          if (nodeName.includes('hair') || nodeName.includes('eyelash')) {
            node.material = hairMat;
          } else {
            node.material = bodyMat;
          }
        }
      });
      return;
    }

    if (name === 'Alex') {
      const texLoader = new THREE.TextureLoader();
      const alexDiffuse = texLoader.load('/assets/textures/alex_diffuse.png');
      alexDiffuse.colorSpace = THREE.SRGBColorSpace;
      alexDiffuse.flipY = false;

      const alexHair = texLoader.load('/assets/textures/alex_hair.png');
      alexHair.colorSpace = THREE.SRGBColorSpace;
      alexHair.flipY = false;

      const bodyMat = new THREE.MeshStandardMaterial({
        map: alexDiffuse,
        roughness: 0.65,
        metalness: 0.08,
      });

      const hairMat = new THREE.MeshStandardMaterial({
        map: alexHair,
        roughness: 0.75,
        transparent: true,
        alphaTest: 0.5,
      });

      char.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          const nodeName = (node.name || '').toLowerCase();
          if (nodeName.includes('hair') || nodeName.includes('eyelash')) {
            node.material = hairMat;
          } else {
            node.material = bodyMat;
          }
        }
      });
      return;
    }
  }
}
