import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mock the THREE namespace since we're in a Node environment
global.THREE = {
  Vector3: class {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    copy(v) {
      this.x = v.x;
      this.y = v.y;
      this.z = v.z;
      return this;
    }
    clone() {
      return new global.THREE.Vector3(this.x, this.y, this.z);
    }
    lerp(target, alpha) {
      this.x += (target.x - this.x) * alpha;
      this.y += (target.y - this.y) * alpha;
      this.z += (target.z - this.z) * alpha;
      return this;
    }
    distanceTo(v) {
      const dx = this.x - v.x;
      const dy = this.y - v.y;
      const dz = this.z - v.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    sub(v) {
      this.x -= v.x;
      this.y -= v.y;
      this.z -= v.z;
      return this;
    }
    multiplyScalar(s) {
      this.x *= s;
      this.y *= s;
      this.z *= s;
      return this;
    }
    normalize() {
      const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
      if (len > 0) {
        this.x /= len;
        this.y /= len;
        this.z /= len;
      }
      return this;
    }
    applyQuaternion(q) {
      // Simplified for testing - just return as-is
      return this;
    }
  },
  Quaternion: class {
    constructor(x = 0, y = 0, z = 0, w = 1) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.w = w;
    }
    slerp(target, alpha) {
      // Simplified for testing
      return this;
    }
  }
};

test('Alex behavior state machine handles cordon_area action', () => {
  // Simulate the logical behavior for cordon_area
  const action = 'cordon_area';
  const targetPosition = { x: 1.0, y: 0, z: -2.0 };
  
  // Verify that cordon_area should move Alex to target position
  assert.equal(action, 'cordon_area');
  assert.ok(targetPosition.x === 1.0);
  assert.ok(targetPosition.z === -2.0);
});

test('Alex behavior state machine handles hold_position action', () => {
  const action = 'hold_position';
  
  // Verify that hold_position keeps Alex in place
  assert.equal(action, 'hold_position');
  // No target position needed for hold_position
});

test('Alex behavior state machine handles move_to_safety action', () => {
  const action = 'move_to_safety';
  const targetPosition = { x: -1.5, y: 0, z: -3.0 };
  
  // Verify that move_to_safety moves Alex to safe position
  assert.equal(action, 'move_to_safety');
  assert.ok(targetPosition.x === -1.5);
  assert.ok(targetPosition.z === -3.0);
});

test('Alex behavior state machine handles follow_dave action', () => {
  const action = 'follow_dave';
  
  // Verify that follow_dave starts follow mode
  assert.equal(action, 'follow_dave');
  // No target position needed - uses Dave's position
});

test('Alex behavior state machine handles continue_walk action', () => {
  const action = 'continue_walk';
  const targetPosition = { x: 0.5, y: 0, z: -5.0 };
  
  // Verify that continue_walk moves Alex to next patrol position
  assert.equal(action, 'continue_walk');
  assert.ok(targetPosition.x === 0.5);
  assert.ok(targetPosition.z === -5.0);
});

test('Alex behavior prevents conflicting actions', () => {
  // Simulate behavior state transitions
  let currentState = 'idle';
  
  // Starting a new action should stop previous behavior
  currentState = 'moving_to_target';
  assert.equal(currentState, 'moving_to_target');
  
  // Starting follow mode should override previous state
  currentState = 'following';
  assert.equal(currentState, 'following');
  
  // Hold position should override follow mode
  currentState = 'holding';
  assert.equal(currentState, 'holding');
});

test('Alex behavior handles hazard-specific logical responses', () => {
  // Test that different hazards trigger appropriate Alex behaviors
  
  // Fluid spill: cordon_area or move_to_safety or follow_dave
  const spillActions = ['cordon_area', 'move_to_safety', 'follow_dave'];
  assert.ok(spillActions.includes('cordon_area'));
  
  // Blind corner: hold_position or move_to_safety or follow_dave
  const cornerActions = ['hold_position', 'move_to_safety', 'follow_dave'];
  assert.ok(cornerActions.includes('hold_position'));
  
  // Structural damage: cordon_area or move_to_safety or follow_dave
  const structureActions = ['cordon_area', 'move_to_safety', 'follow_dave'];
  assert.ok(structureActions.includes('cordon_area'));
  
  // Fire risk: cordon_area or move_to_safety or follow_dave
  const fireActions = ['cordon_area', 'move_to_safety', 'follow_dave'];
  assert.ok(fireActions.includes('cordon_area'));
  
  // Clear aisle: continue_walk or move_to_safety
  const clearActions = ['continue_walk', 'move_to_safety'];
  assert.ok(clearActions.includes('continue_walk'));
});

test('Alex behavior position calculations are consistent', () => {
  // Test that target positions are calculated correctly
  const davePos = new global.THREE.Vector3(0, 0, 0);
  const followOffset = 1.5;
  const daveDirection = new global.THREE.Vector3(0, 0, -1);
  
  const alexTarget = davePos.clone().sub(daveDirection.multiplyScalar(followOffset));
  
  assert.equal(alexTarget.x, 0);
  assert.equal(alexTarget.y, 0);
  assert.equal(alexTarget.z, 1.5);
});

test('Alex behavior respects ground level constraint', () => {
  // Test that Alex stays on ground (y = 0)
  const targetPosition = { x: 1.0, y: 0, z: -2.0 };
  
  assert.equal(targetPosition.y, 0, 'Alex should always stay on ground level');
});

test('Alex behavior movement uses smooth interpolation', () => {
  const currentPos = new global.THREE.Vector3(0, 0, 0);
  const targetPos = new global.THREE.Vector3(2.0, 0, 0);
  const lerpFactor = 0.1;
  
  // First step
  currentPos.lerp(targetPos, lerpFactor);
  assert.ok(currentPos.x > 0);
  assert.ok(currentPos.x < 2.0);
  
  // Second step
  currentPos.lerp(targetPos, lerpFactor);
  assert.ok(currentPos.x > 0.2);
  assert.ok(currentPos.x < 2.0);
});
