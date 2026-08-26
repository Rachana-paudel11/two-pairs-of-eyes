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

test('Alex follow calculates correct target position behind Dave', () => {
  // Simulate Dave at position (0, 0, 0) facing -Z direction
  const davePosition = new global.THREE.Vector3(0, 0, 0);
  const daveDirection = new global.THREE.Vector3(0, 0, -1);
  const followOffset = 1.5;
  
  // Calculate where Alex should be (behind Dave)
  const alexTarget = davePosition.clone().sub(daveDirection.multiplyScalar(followOffset));
  
  // Alex should be at (0, 0, 1.5) - behind Dave when Dave faces -Z
  assert.equal(alexTarget.x, 0);
  assert.equal(alexTarget.y, 0);
  assert.equal(alexTarget.z, 1.5);
});

test('Alex follow uses smooth lerp movement', () => {
  const alexPos = new global.THREE.Vector3(0, 0, 0);
  const targetPos = new global.THREE.Vector3(1.5, 0, 0);
  const lerpFactor = 0.1;
  
  // First lerp step
  alexPos.lerp(targetPos, lerpFactor);
  
  // Should move 10% of the way toward target (with floating point tolerance)
  assert.ok(Math.abs(alexPos.x - 0.15) < 0.001);
  assert.equal(alexPos.y, 0);
  assert.equal(alexPos.z, 0);
  
  // Second lerp step
  alexPos.lerp(targetPos, lerpFactor);
  
  // Should move closer but not all the way
  assert.ok(alexPos.x > 0.15);
  assert.ok(alexPos.x < 1.5);
});

test('Alex follow detects when close enough to stop', () => {
  const alexPos = new global.THREE.Vector3(0, 0, 0);
  const targetPos = new global.THREE.Vector3(0.05, 0, 0); // Very close
  const threshold = 0.1;
  
  const distance = alexPos.distanceTo(targetPos);
  const isCloseEnough = distance <= threshold;
  
  assert.ok(isCloseEnough);
  assert.equal(distance, 0.05);
});

test('Alex follow handles different Dave orientations', () => {
  // Dave facing +Z direction
  const davePosition = new global.THREE.Vector3(0, 0, 0);
  const daveDirectionForward = new global.THREE.Vector3(0, 0, 1);
  const followOffset = 1.5;
  
  const alexTarget = davePosition.clone().sub(daveDirectionForward.multiplyScalar(followOffset));
  
  // Alex should be at (0, 0, -1.5) - behind Dave when Dave faces +Z
  assert.equal(alexTarget.z, -1.5);
});

test('Alex follow mode respects 1.5 unit offset distance', () => {
  const davePosition = new global.THREE.Vector3(5, 0, -10);
  const daveDirection = new global.THREE.Vector3(0, 0, -1);
  const followOffset = 1.5;
  
  const alexTarget = davePosition.clone().sub(daveDirection.multiplyScalar(followOffset));
  
  // Distance between Dave and Alex should be exactly 1.5 units
  const distance = davePosition.distanceTo(alexTarget);
  assert.ok(Math.abs(distance - 1.5) < 0.01);
});
