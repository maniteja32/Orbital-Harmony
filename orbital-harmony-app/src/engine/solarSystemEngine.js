// ============================================================================
// Orbital Harmony — Three.js solar-system + pattern-tracer engine.
// Framework-agnostic (no React here) so it can be driven from a single
// React wrapper component (see components/SolarSystemCanvas.jsx) in two
// modes:
//   - "full"  — all planets, gently interactive (OrbitControls + camera
//               auto-drift), used by the Solar System browse screen.
//   - "duo"   — exactly two selected planets + the Sun, a fixed top-down
//               camera, and (optionally) the chord pattern tracer — used
//               by the Reveal + Result screens.
// ============================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLANETS_BY_KEY, SUN_TEXTURE, MOON_TEXTURE } from '../data/planets.js';

const DAYS_PER_YEAR = 365.25;
const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

function loadTexture(path, { srgb = true } = {}) {
  if (textureCache.has(path)) return textureCache.get(path);
  const tex = textureLoader.load(path);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set(path, tex);
  return tex;
}

// A soft radial-gradient sprite used for the Sun's glow — cheap, no
// post-processing bloom pipeline required.
function makeGlowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,235,190,0.9)');
  gradient.addColorStop(0.35, 'rgba(255,180,90,0.45)');
  gradient.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function makeOrbitRing(radiusDistance, colorHex) {
  const segments = 128;
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * radiusDistance, 0, Math.sin(a) * radiusDistance));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.28 });
  return new THREE.Line(geometry, material);
}

function buildStarfield() {
  const count = 1400;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 300 + Math.random() * 500;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi));
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0.7, sizeAttenuation: true });
  return new THREE.Points(geometry, material);
}

function buildPlanet(data) {
  const pivot = new THREE.Group();
  const startAngle = Math.random() * Math.PI * 2;
  pivot.rotation.y = startAngle;

  const tiltAnchor = new THREE.Group();
  tiltAnchor.position.set(data.distance, 0, 0);
  pivot.add(tiltAnchor);

  const axialTilt = new THREE.Group();
  axialTilt.rotation.z = THREE.MathUtils.degToRad(data.tilt ?? 0);
  tiltAnchor.add(axialTilt);

  const geometry = new THREE.SphereGeometry(data.radius, 48, 48);
  const material = new THREE.MeshStandardMaterial({
    map: loadTexture(data.texture),
    roughness: 0.85,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(geometry, material);
  axialTilt.add(mesh);

  let clouds = null;
  if (data.hasClouds) {
    const cloudGeo = new THREE.SphereGeometry(data.radius * 1.03, 48, 48);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      alphaMap: loadTexture(data.cloudTexture, { srgb: false }),
      transparent: true,
      depthWrite: false,
      roughness: 1,
    });
    clouds = new THREE.Mesh(cloudGeo, cloudMat);
    mesh.add(clouds);
  }

  if (data.hasAtmosphere) {
    const atmoGeo = new THREE.SphereGeometry(data.radius * 1.06, 48, 48);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x5fa8ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      depthWrite: false,
    });
    mesh.add(new THREE.Mesh(atmoGeo, atmoMat));
  }

  if (data.hasRings) {
    const inner = data.radius * 1.15;
    const outer = data.radius * 2.3;
    const ringGeo = new THREE.RingGeometry(inner, outer, 96, 1);
    const posAttr = ringGeo.attributes.position;
    const uv = ringGeo.attributes.uv;
    const v3 = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v3.fromBufferAttribute(posAttr, i);
      const dist = v3.length();
      const t = (dist - inner) / (outer - inner);
      uv.setXY(i, t, 0.5);
    }
    const ringMat = new THREE.MeshBasicMaterial({
      map: loadTexture(data.ringTexture, { srgb: false }),
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    axialTilt.add(ring);
  }

  let moonPivot = null;
  if (data.hasMoon) {
    moonPivot = new THREE.Group();
    moonPivot.rotation.y = Math.random() * Math.PI * 2;
    const moonGeo = new THREE.SphereGeometry(data.radius * 0.27, 32, 32);
    const moonMat = new THREE.MeshStandardMaterial({ map: loadTexture(MOON_TEXTURE), roughness: 0.95 });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(data.radius * 2.2, 0, 0);
    moonPivot.add(moonMesh);
    axialTilt.add(moonPivot);
  }

  return { data, pivot, tiltAnchor, axialTilt, mesh, clouds, moonPivot, startAngle };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} opts
 * @param {string[]} opts.planetKeys
 * @param {boolean} [opts.interactive]
 * @param {boolean} [opts.tracePattern]
 * @param {boolean} [opts.showOrbitRings]
 * @param {boolean} [opts.cinematicIntro]
 * @param {number} [opts.speedDurationSec]
 * @param {number} [opts.totalSimYears]
 * @param {number} [opts.traceIntervalDays]
 */
export function createSolarSystemEngine(canvas, opts) {
  const {
    planetKeys,
    interactive = false,
    tracePattern = false,
    showOrbitRings = true,
    cinematicIntro = false,
    speedDurationSec = 10,
    totalSimYears = 8,
    traceIntervalDays = 3,
  } = opts;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x00000a);

  const parent = canvas.parentElement;
  const width = parent?.clientWidth || window.innerWidth;
  const height = parent?.clientHeight || window.innerHeight;

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene.add(new THREE.AmbientLight(0xffffff, 0.18));
  const sunLight = new THREE.PointLight(0xfff2d8, 3.2, 0, 0.15);
  scene.add(sunLight);

  scene.add(buildStarfield());

  const sunGeo = new THREE.SphereGeometry(4.2, 48, 48);
  const sunMat = new THREE.MeshBasicMaterial({ map: loadTexture(SUN_TEXTURE) });
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  scene.add(sunMesh);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  glow.scale.set(26, 26, 1);
  scene.add(glow);

  // A second, larger, softer sprite layered behind the tight glow above —
  // a cheap "subtle bloom" stand-in (no post-processing pipeline needed)
  // so the Sun reads as a genuine light source, not just a lit sphere.
  const outerGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.55,
  }));
  outerGlow.scale.set(52, 52, 1);
  scene.add(outerGlow);

  const planets = planetKeys
    .map((key) => PLANETS_BY_KEY[key])
    .filter(Boolean)
    .map((data) => {
      const planet = buildPlanet(data);
      scene.add(planet.pivot);
      if (showOrbitRings) scene.add(makeOrbitRing(data.distance, data.color));
      return planet;
    });

  const maxDistance = Math.max(...planets.map((p) => p.data.distance), 20);
  const framingMargin = planets.length <= 2 ? 1.4 : 1.18;

  // A fixed-vertical-FOV PerspectiveCamera shows a NARROWER horizontal slice
  // than vertical whenever aspect (width/height) < 1 — exactly the case for
  // every mobile-first portrait viewport (and this app's centered, capped
  // -width column even on desktop). Framing the circular solar system by a
  // single "distance = maxDistance * margin" constant (no aspect term)
  // therefore fit the TOP/BOTTOM correctly but clipped the LEFT/RIGHT edges
  // on any portrait-ish viewport — planets and outer orbit rings visibly
  // cut off. Fix: solve for the camera distance that fits `maxDistance`
  // within BOTH the vertical AND horizontal half-extents, i.e. divide by
  // whichever of (1, aspect) is smaller.
  function distanceToFit(aspect) {
    const vFovRad = THREE.MathUtils.degToRad(camera.fov);
    return (maxDistance * framingMargin) / (Math.tan(vFovRad / 2) * Math.min(1, aspect));
  }

  // Looking straight down the Y axis is a DEGENERATE case for a raw
  // lookAt() call with the default up vector (0,1,0) — up ends up parallel
  // to the view direction, so the forward×up cross product collapses
  // toward zero and the orientation becomes unstable/skewed (a lopsided
  // "fan" render instead of a symmetric top-down view). A non-parallel up
  // vector like (0,0,-1) fixes THAT — but only for a camera driven purely
  // by manual lookAt() calls (the non-interactive duo/pattern mode below).
  //
  // OrbitControls, however, derives its own spherical coordinates from
  // camera.up internally (`quat.setFromUnitVectors(camera.up, (0,1,0))`) —
  // changing camera.up away from the default there re-interprets the
  // camera's offset-from-target vector in a ROTATED frame, which (for an
  // offset that's almost pure +Y) makes OrbitControls think the camera is
  // sitting near the "equator" instead of the "pole", snapping the view to
  // edge-on (orbits collapse into near-vertical lines) the moment
  // controls.update() runs. So: only touch camera.up for the non-interactive
  // path; the interactive path keeps the default up and lets
  // OrbitControls.update() (called every frame) establish orientation
  // itself — it handles the near-pole case correctly on its own.
  const dist = distanceToFit(width / height);

  // ---- Cinematic intro camera path (Solar System browse screen) -----------
  // A scripted, oblique (never purely top-down) camera move: hold on a
  // distant establishing shot of the whole system, then ease inward to a
  // closer, Sun-dominant hero framing near Earth's orbit. Oblique angles
  // throughout mean a plain lookAt() with the DEFAULT up vector is always
  // safe here (never the degenerate straight-down case above), and — since
  // OrbitControls is only attached once the scripted move finishes — the
  // camera.up/OrbitControls conflict noted above never applies either.
  function heroPosition(distance, elevationDeg) {
    const rad = THREE.MathUtils.degToRad(elevationDeg);
    return new THREE.Vector3(0, distance * Math.sin(rad), distance * Math.cos(rad));
  }
  const earthRefDistance = PLANETS_BY_KEY.earth?.distance ?? maxDistance * 0.35;
  const heroWidePos = heroPosition(dist, 80);
  const heroClosePos = heroPosition(earthRefDistance * 1.6, 32);
  const INTRO_HOLD_SEC = 1.6;
  const INTRO_TRAVEL_SEC = 4.2;
  let introPhase = cinematicIntro ? 'hold' : 'done';
  let introElapsed = 0;
  let introCompleteCb = null;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  }

  let controls = null;
  function attachOrbitControls() {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = maxDistance * 0.4;
    controls.maxDistance = maxDistance * 3.2;
    controls.enablePan = false;
    // Calm/settled after a scripted cinematic move — no lingering ambient
    // auto-orbit fighting the composition the intro just settled into.
    controls.autoRotate = !cinematicIntro;
    controls.autoRotateSpeed = 0.35;
  }

  if (cinematicIntro) {
    camera.position.copy(heroWidePos);
    camera.lookAt(0, 0, 0);
    // OrbitControls (if this screen wants it) is attached once the scripted
    // move finishes — see tick() below.
  } else if (interactive) {
    camera.position.set(0, dist, dist * 0.001);
    attachOrbitControls();
  } else {
    camera.up.set(0, 0, -1);
    camera.position.set(0, dist, 0.0001);
    camera.lookAt(0, 0, 0);
  }

  // ---- Pattern tracer (chord between the two active planets) --------------
  let patternLines = null;
  let patternPositions = null;
  let patternCapacity = 0;
  let patternCount = 0;
  const posA = new THREE.Vector3();
  const posB = new THREE.Vector3();

  if (tracePattern && planets.length === 2) {
    patternCapacity = Math.min(Math.ceil((totalSimYears * DAYS_PER_YEAR) / traceIntervalDays), 8000);
    patternPositions = new Float32Array(patternCapacity * 2 * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(patternPositions, 3));
    geometry.setDrawRange(0, 0);
    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    patternLines = new THREE.LineSegments(geometry, material);
    patternLines.frustumCulled = false;
    scene.add(patternLines);
  }

  // ---- Simulation clock -----------------------------------------------------
  // A single simDaysElapsed accumulator drives every planet's orbit angle in
  // BOTH modes, just at a different rate: pattern mode advances fast enough
  // to complete `totalSimYears` of simulated time in exactly
  // `speedDurationSec` real seconds (deterministic reveal duration); browse
  // mode advances at a fixed, gentle rate for ambient motion.
  const clock = new THREE.Clock();
  let simDaysElapsed = 0;
  let lastSampledDay = 0;
  const BROWSE_DAYS_PER_REAL_SECOND = 6;
  const simDaysPerRealSecond = tracePattern
    ? (totalSimYears * DAYS_PER_YEAR) / speedDurationSec
    : BROWSE_DAYS_PER_REAL_SECOND;
  let paused = false;
  let completed = false;
  let onCompleteCb = null;
  let rafId = null;

  function sampleChordIfDue() {
    if (!patternLines || patternCount >= patternCapacity) return;
    while (simDaysElapsed - lastSampledDay >= traceIntervalDays && patternCount < patternCapacity) {
      lastSampledDay += traceIntervalDays;
      planets[0].mesh.getWorldPosition(posA);
      planets[1].mesh.getWorldPosition(posB);
      const base = patternCount * 6;
      patternPositions[base] = posA.x;
      patternPositions[base + 1] = posA.y;
      patternPositions[base + 2] = posA.z;
      patternPositions[base + 3] = posB.x;
      patternPositions[base + 4] = posB.y;
      patternPositions[base + 5] = posB.z;
      patternCount++;
    }
    patternLines.geometry.setDrawRange(0, patternCount * 2);
    patternLines.geometry.attributes.position.needsUpdate = true;
  }

  function tick() {
    rafId = requestAnimationFrame(tick);
    const delta = Math.min(clock.getDelta(), 0.05);
    if (paused) {
      renderer.render(scene, camera);
      return;
    }

    sunMesh.rotation.y += delta * 0.05;

    if (!completed) simDaysElapsed += delta * simDaysPerRealSecond;
    planets.forEach((planet) => {
      // Real orbital period drives the angle directly — accurate relative
      // speeds for free (and, in pattern mode, a deterministic total
      // reveal duration), plus each planet's own random start offset.
      planet.pivot.rotation.y = planet.startAngle + (simDaysElapsed / planet.data.orbitalPeriodDays) * Math.PI * 2;
    });

    planets.forEach((planet) => {
      planet.mesh.rotation.y += delta * 60 * planet.data.rotationSpeed * (planet.data.spinDirection ?? 1);
      if (planet.clouds) planet.clouds.rotation.y += delta * 60 * planet.data.rotationSpeed * 1.4 * (planet.data.spinDirection ?? 1);
      if (planet.moonPivot) planet.moonPivot.rotation.y += delta * 1.4;
    });

    scene.updateMatrixWorld(true);
    if (tracePattern) sampleChordIfDue();

    if (tracePattern && !completed && simDaysElapsed >= totalSimYears * DAYS_PER_YEAR) {
      completed = true;
      if (onCompleteCb) onCompleteCb();
    }

    // ---- Cinematic intro camera move (hold, then ease inward) -------------
    if (introPhase !== 'done') {
      introElapsed += delta;
      if (introPhase === 'hold') {
        if (introElapsed >= INTRO_HOLD_SEC) {
          introPhase = 'travel';
          introElapsed = 0;
        }
      } else if (introPhase === 'travel') {
        const t = Math.min(introElapsed / INTRO_TRAVEL_SEC, 1);
        camera.position.lerpVectors(heroWidePos, heroClosePos, easeInOutCubic(t));
        camera.lookAt(0, 0, 0);
        if (t >= 1) {
          introPhase = 'done';
          if (interactive) attachOrbitControls();
          if (introCompleteCb) introCompleteCb();
        }
      }
    }

    if (controls) controls.update();
    renderer.render(scene, camera);
  }

  function resize() {
    const w = parent?.clientWidth || window.innerWidth;
    const h = parent?.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    // Only re-fit distance in non-interactive (duo/pattern) mode — in
    // interactive "full" browse mode the user may have manually zoomed via
    // OrbitControls, and forcibly resetting distance on every resize would
    // fight that. The initial distanceToFit() call above already gives
    // OrbitControls a correctly-framed starting point either way.
    if (!controls) {
      const dist = distanceToFit(w / h);
      camera.position.setLength(dist);
    }
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  const resizeObserver = new ResizeObserver(resize);
  if (parent) resizeObserver.observe(parent);
  window.addEventListener('resize', resize);

  return {
    start() {
      if (rafId == null) tick();
    },
    setPaused(value) {
      paused = value;
    },
    getProgress() {
      if (!tracePattern) return 0;
      return Math.min(simDaysElapsed / (totalSimYears * DAYS_PER_YEAR), 1);
    },
    onComplete(cb) {
      onCompleteCb = cb;
    },
    onIntroComplete(cb) {
      introCompleteCb = cb;
      if (introPhase === 'done') cb();
    },
    captureDataURL() {
      return renderer.domElement.toDataURL('image/png');
    },
    destroy() {
      if (rafId != null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      resizeObserver.disconnect();
      if (controls) controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((m) => m.dispose());
        }
      });
    },
  };
}
