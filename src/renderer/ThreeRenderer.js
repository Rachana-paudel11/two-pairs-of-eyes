/**
 * ThreeRenderer.js
 * Core Three.js setup: WebGLRenderer, camera, lighting, and the render loop.
 * This module is the only place that owns the renderer and the animation frame.
 * Everything else subscribes to it or is called by it.
 */
import * as THREE from 'three';

export class ThreeRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    // ─── Renderer ────────────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // ─── Scene ───────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 20, 60);

    // ─── Camera ──────────────────────────────────────────────────────────────
    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 1.65, 0); // eye height ~165cm

    // ─── Lighting ────────────────────────────────────────────────────────────
    this._setupLighting();

    // ─── Resize handler ──────────────────────────────────────────────────────
    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);

    // ─── Loop ────────────────────────────────────────────────────────────────
    this._animationId = null;
    this._clock = new THREE.Clock();
    this._updateCallbacks = new Set();
  }

  _setupLighting() {
    // Ambient — low-level fill so shadows aren't black
    const ambient = new THREE.AmbientLight(0xfff5e0, 0.45);
    this.scene.add(ambient);

    // Main overhead directional light — optimized shadow map footprint
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.8);
    sun.position.set(5, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 512;
    sun.shadow.mapSize.height = 512;
    sun.shadow.camera.near = 1.0;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -15;
    sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -15;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);
    this._sunLight = sun;

    // Secondary fill from opposite side — softens hard shadows
    const fill = new THREE.DirectionalLight(0xc8d8ff, 0.5);
    fill.position.set(-8, 6, -5);
    this.scene.add(fill);

    // Point lights to mimic ceiling strip lights along the aisle
    const stripPositions = [
      [0, 5, -5],
      [0, 5, -15],
      [0, 5, -25],
    ];
    stripPositions.forEach(([x, y, z]) => {
      const strip = new THREE.PointLight(0xfff5d0, 1.2, 18, 2);
      strip.position.set(x, y, z);
      strip.castShadow = false;
      this.scene.add(strip);
    });
  }

  /**
   * Register an update callback called every frame with delta time.
   * @param {(delta: number) => void} fn
   * @returns {() => void} unsubscribe function
   */
  onUpdate(fn) {
    this._updateCallbacks.add(fn);
    return () => this._updateCallbacks.delete(fn);
  }

  /** Start the render loop. */
  start() {
    const loop = () => {
      this._animationId = requestAnimationFrame(loop);
      const rawDelta = this._clock.getDelta();
      // Clamp delta to prevent simulation spikes, physics jitter, or camera pops on frame drops/tab switches
      const delta = Math.min(rawDelta, 0.05);
      for (const fn of this._updateCallbacks) fn(delta);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  /** Stop the render loop and clean up. */
  dispose() {
    if (this._animationId !== null) cancelAnimationFrame(this._animationId);
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }

  /**
   * Dynamically applies graphics presets and renderer resolution limits.
   * @param {{ quality?: string, shadows?: boolean, pixelRatioLimit?: number }} options
   */
  setGraphicsQuality({ quality = 'medium', shadows = true, pixelRatioLimit = 1.0 } = {}) {
    this._graphicsQuality = quality;
    this._pixelRatioLimit = Number(pixelRatioLimit) || 1.0;
    const pr = Math.min(window.devicePixelRatio || 1, this._pixelRatioLimit);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    const enableShadows = quality !== 'low' && Boolean(shadows);
    this.renderer.shadowMap.enabled = enableShadows;
    if (this._sunLight) {
      this._sunLight.castShadow = enableShadows;
    }

    if (this.scene && this.scene.fog) {
      this.scene.fog.near = quality === 'low' ? 25 : (quality === 'high' ? 18 : 20);
      this.scene.fog.far = quality === 'low' ? 55 : (quality === 'high' ? 70 : 60);
    }
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    const pr = Math.min(window.devicePixelRatio || 1, this._pixelRatioLimit || 1.0);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
