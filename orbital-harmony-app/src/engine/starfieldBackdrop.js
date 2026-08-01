import * as THREE from 'three';

/**
 * Standalone starfield backdrop — the EXACT same star field the Solar System
 * screen renders as its skybox (see buildStarfield/buildStarLayer in
 * solarSystemEngine.js), extracted so the LoadingScreen can render the
 * identical stars behind its orrery. This makes the loading -> system
 * transition seamless: the stars are literally the same points, shader,
 * tint, sizes, and twinkle. Keep this in sync with solarSystemEngine.js if
 * either side's star code changes.
 */

let starSpriteCache = null;
function makeStarSprite() {
  if (starSpriteCache) return starSpriteCache;
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  starSpriteCache = new THREE.CanvasTexture(canvas);
  return starSpriteCache;
}

// Star LAYER specs (count/size/opacity/radii/spin). Used to build BOTH the
// loading backdrop AND the Solar System engine's skybox (which imports
// buildStarfield from here), so the two screens render the IDENTICAL field.
const LAYER_SPECS = [
  { count: 2400, size: 2.2, opacity: 0.6, minR: 900, maxR: 1700, spin: 0.0015 },
  { count: 1300, size: 3.0, opacity: 0.72, minR: 650, maxR: 950, spin: 0.003 },
  { count: 240, size: 4.0, opacity: 0.95, minR: 480, maxR: 680, spin: 0.005 },
];

function sphereStar(minR, maxR) {
  return () => {
    const r = minR + Math.random() * (maxR - minR);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    return {
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.cos(phi),
      z: r * Math.sin(phi) * Math.sin(theta),
    };
  };
}

// The random star DATA (positions/colours/twinkle params) is generated exactly
// ONCE and cached at module scope. Because this module is a singleton shared by
// BOTH the LoadingScreen backdrop and solarSystemEngine.js, both screens build
// their geometry from the SAME arrays — so every star sits at the SAME position
// in both, which (together with matching the camera orientation) makes the
// loading -> system transition perfectly seamless with zero star drift. The
// arrays are never mutated (twinkle happens in the shader via uTime), so it is
// safe to reference them from two separate WebGL contexts.
let starDataCache = null;
function getStarData() {
  if (starDataCache) return starDataCache;
  starDataCache = LAYER_SPECS.map((spec) => {
    const { count } = spec;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const twinklePhase = new Float32Array(count);
    const twinkleSpeed = new Float32Array(count);
    const twinkleAmount = new Float32Array(count);
    const place = sphereStar(spec.minR, spec.maxR);
    for (let i = 0; i < count; i++) {
      const p = place();
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      const b = 0.4 + Math.random() * 0.6;
      colors[i * 3] = b;
      colors[i * 3 + 1] = b;
      colors[i * 3 + 2] = b;
      twinklePhase[i] = Math.random() * Math.PI * 2;
      twinkleSpeed[i] = 1.2 + Math.random() * 2.3;
      twinkleAmount[i] = Math.random() < 0.26 ? 0.5 + Math.random() * 0.4 : 0;
    }
    return { count, positions, colors, twinklePhase, twinkleSpeed, twinkleAmount };
  });
  return starDataCache;
}

function buildStarLayer(data, size, opacity) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  geometry.setAttribute('twinklePhase', new THREE.BufferAttribute(data.twinklePhase, 1));
  geometry.setAttribute('twinkleSpeed', new THREE.BufferAttribute(data.twinkleSpeed, 1));
  geometry.setAttribute('twinkleAmount', new THREE.BufferAttribute(data.twinkleAmount, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: size },
      uOpacity: { value: opacity },
      uTint: { value: new THREE.Color(0xfff6ea) },
      uMap: { value: makeStarSprite() },
    },
    vertexShader: `
      attribute vec3 color;
      attribute float twinklePhase;
      attribute float twinkleSpeed;
      attribute float twinkleAmount;
      uniform float uTime;
      uniform float uSize;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vColor = color;
        float wave = sin(uTime * twinkleSpeed + twinklePhase);
        vTwinkle = 1.0 + twinkleAmount * wave;
        float sizePulse = 1.0 + max(wave, 0.0) * twinkleAmount * 0.6;
        gl_PointSize = uSize * sizePulse;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uOpacity;
      uniform vec3 uTint;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        float sprite = texture2D(uMap, gl_PointCoord).a;
        float alpha = sprite * uOpacity * clamp(vTwinkle, 0.0, 1.4);
        gl_FragColor = vec4(uTint * vColor * vTwinkle, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

// Build a starfield GROUP from the shared cached data. Exported so
// solarSystemEngine.js renders the EXACT same field (same star positions) as
// the loading backdrop.
export function buildStarfield() {
  const group = new THREE.Group();
  const data = getStarData();
  LAYER_SPECS.forEach((spec, i) => {
    const layer = buildStarLayer(data[i], spec.size, spec.opacity);
    layer.userData.spin = spec.spin;
    group.add(layer);
  });
  return group;
}

/**
 * Mount the starfield onto a canvas. Returns a `dispose()` to tear it down.
 * The renderer is transparent (alpha) so whatever is behind the canvas (the
 * page's black background) shows through, and anything drawn on top (the
 * loading orrery on its own 2D canvas) composites over the stars.
 */
export function createStarfieldBackdrop(canvas) {
  const parent = canvas.parentElement;
  const getSize = () => ({
    w: parent?.clientWidth || window.innerWidth,
    h: parent?.clientHeight || window.innerHeight,
  });

  let { w: width, h: height } = getSize();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  // Perspective camera at the origin (fov 85), identical to the Solar System
  // skybox camera. Oriented TOP-DOWN (looking down -Y with up -Z) to exactly
  // match the engine's cinematic-intro START orientation
  // (HERO_ELEVATION_START_DEG = 90, heroUp(90) = (0,0,-1)) — this is the pose
  // the engine's skybox holds during the loading -> system crossfade, so with
  // the shared star DATA the two fields line up pixel-for-pixel at the hand-off.
  const camera = new THREE.PerspectiveCamera(85, width / height, 1, 4000);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, -1, 0);
  const starfield = buildStarfield();
  scene.add(starfield);

  let last = performance.now();
  let rafId = null;
  function tick(now) {
    rafId = requestAnimationFrame(tick);
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    // NOTE: the layer spin is deliberately NOT applied here — the field is
    // held perfectly still so it stays aligned with the engine's freshly
    // mounted (spin ≈ 0) starfield at the crossfade. Only the per-star
    // twinkle animates (a shader uniform, identical maths to the engine).
    starfield.children.forEach((layer) => {
      if (layer.material.uniforms?.uTime) layer.material.uniforms.uTime.value += delta;
    });
    renderer.render(scene, camera);
  }

  function resize() {
    ({ w: width, h: height } = getSize());
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  window.addEventListener('resize', resize);
  rafId = requestAnimationFrame(tick);

  return {
    dispose() {
      if (rafId != null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      renderer.dispose();
    },
  };
}
