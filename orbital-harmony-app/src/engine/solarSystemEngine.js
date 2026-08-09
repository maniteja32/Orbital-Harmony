// ============================================================================
// Space Harmony — Three.js solar-system + pattern-tracer engine.
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
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { PLANETS_BY_KEY, SUN_TEXTURE, MOON_TEXTURE } from '../data/planets.js';
import { currentOrbitAngleRad } from '../utils/currentPosition.js';
import { PATTERN_LINE_WIDTH } from '../utils/resonance.js';
import { buildStarfield } from './starfieldBackdrop.js';

// Pattern-tracer line style presets — dashSize/gapSize are WORLD-space
// units (matching each chord's own local distance range, see
// `patternDistances` below), NOT screen pixels. "solid" uses gapSize: 0 so
// no gap ever opens regardless of dashSize. "dots" uses a dash MUCH
// shorter than its gap (instead of dashed's comparable dash/gap) so it
// reads as small, clearly separated dots rather than a shorter dashed
// line. This is the SINGLE SOURCE OF TRUTH for dash/gap sizing — the
// live WebGL trace uses these values directly, and captureDataURL's
// Canvas-2D redraw derives its OWN pixel dash lengths from these same
// numbers (scaled per-chord to that chord's own projected pixel length,
// see CANVAS_DASH_STYLES below) so the two never drift apart again.
const LINE_STYLES = {
  solid: { dashSize: 1, gapSize: 0 },
  dashed: { dashSize: 2, gapSize: 1 },
  // widthScale doubles the stroke thickness (see setLineStyle and
  // CANVAS_DASH_STYLES) so a dot reads as a clearly visible mark rather
  // than a barely-visible speck, in both the live trace and the capture.
  // dashSize raised from 0.05 — that was so tiny it fell below a pixel
  // for most chords at the live view's typical zoom, so dots barely
  // rendered at all while tracing and only "appeared" once the capture's
  // fixed-pixel dash (see CANVAS_DASH_STYLES) took over — the mark itself
  // must be large enough in WORLD units to survive that projection.
  // gapSize halved (2.6 -> 1.3) for a tighter, denser dot spacing.
  dots: { dashSize: 0.4, gapSize: 1.3, widthScale: 2 },
};

// Capture-only rendering embellishments for captureDataURL's chord redraw
// (see below) — NOT sizing (that comes from LINE_STYLES above, scaled
// per-chord to screen pixels). "dots" pairs a fixedDashPx (a tiny FIXED
// pixel length, ignoring LINE_STYLES.dashSize's per-chord scaling) with a
// round line cap, guaranteeing a true circle regardless of a chord's own
// length/zoom — proportionally scaling even a small world dashSize could
// still stretch into a visible little bar on a long chord. The GAP still
// scales proportionally (see below) so dot spacing/density matches the
// live trace. widthScale matches the live trace's own doubled linewidth
// (see setLineStyle) so neither surface looks bigger/smaller.
const CANVAS_DASH_STYLES = {
  solid: null,
  dashed: { cap: 'butt' },
  dots: { cap: 'round', widthScale: 2, fixedDashPx: 0.6 },
};
import { loadPlanetTexture, buildPlanetBody } from './planetFactory.js';

const DAYS_PER_YEAR = 365.25;
const TWO_PI = Math.PI * 2;
// The cinematic browse-screen camera path holds on a true top-down shot
// (matching the loading screen's overview), then slowly ROTATES down to a
// more angled, dimensional view — see HERO_ELEVATION_START_DEG/
// HERO_ELEVATION_END_DEG below. Distance/frustum/no-zoom are unchanged.

// loadTexture() below is now just a thin alias to the shared
// planetFactory.js loader (single source of truth for texture
// loading/caching/saturation-boosting, shared with the planet swipe
// carousel's preview engine) — kept as a local name since it's used
// throughout this file for the Sun, starfield sprites, etc., not just
// planets.
const loadTexture = loadPlanetTexture;

// A soft radial-gradient sprite used for the Sun's corona glow. Colours are
// ported verbatim from the legacy vanilla-JS prototype's createRadialGlowTexture
// (js/main.js): bright white core -> warm amber -> transparent haze.
function makeGlowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.25, 'rgba(255, 200, 120, 0.6)');
  gradient.addColorStop(1, 'rgba(255, 150, 60, 0)');
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
  // Desaturate the planet's tint toward pale neutral, and keep opacity very
  // low — thin, elegant reference lines (NASA-visualization style) that
  // communicate motion without competing with the planets themselves.
  const tint = new THREE.Color(colorHex).lerp(new THREE.Color(0xffffff), 0.55);
  const material = new THREE.LineBasicMaterial({ color: tint, transparent: true, opacity: 0.14 });
  return new THREE.Line(geometry, material);
}

// The starfield (makeStarSprite / buildStarLayer / sphereStar / buildStarfield)
// now lives in ./starfieldBackdrop.js and is imported above — a SINGLE shared
// source so this engine's skybox and the LoadingScreen backdrop render the
// EXACT same stars at the EXACT same positions (see that module for why the
// star data is a cached singleton), making the loading -> system transition
// perfectly seamless.

// Sun surface material — ported from the legacy vanilla-JS prototype's
// createSun() shader (js/main.js) so the mobile Sun matches it exactly: the
// real photographic sun.jpg texture (surfaceMap) with classic limb darkening
// (the disc's grazing edge is cooler/dimmer than its centre) plus a single
// off-centre upper-left hot-spot highlight for an implied light direction.
// Unlit (the Sun is a light source, not lit by scene lights). The "alive"
// pulsing now lives entirely on the corona glow sprites (see below), exactly
// as in the legacy prototype, rather than on the surface shader.
function makeSunMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      surfaceMap: { value: loadTexture(SUN_TEXTURE) },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D surfaceMap;
      uniform float time;
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        // Brighten the photosphere and nudge it toward hot yellow-white so
        // the disc ALWAYS reads as a hot star, never a dim reddish planet
        // (users noted the pulse trough could look like Mars).
        vec3 tex = texture2D(surfaceMap, vUv).rgb * 0.45;
        tex = mix(tex, vec3(1.0, 0.92, 0.72), 0.18);
        // Classic limb darkening, but with a higher floor (0.32, not 0.1) so
        // even the disc edge stays clearly lit rather than going dark/dull.
        float facing = clamp(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
        float limb = mix(0.32, 0.95, pow(facing, 0.75));
        // Off-center hot spot (upper-left) — an implied light direction that
        // reinforces the 3D illusion instead of perfectly symmetric shading.
        vec3 highlightDir = normalize(vec3(-0.4, 0.4, 0.85));
        float highlight = pow(clamp(dot(vNormal, highlightDir), 0.0, 1.0), 5.0);
        vec3 color = tex * limb + vec3(1.0, 0.96, 0.85) * highlight * 0.28;
        // INNER glow breathes UP from a solid baseline (0.55 min) — it only
        // ever ADDS warmth towards the centre, never removes brightness.
        float core = pow(facing, 2.0);
        float glowWave = 0.5 + 0.5 * sin(time * 1.6);
        color += vec3(1.0, 0.88, 0.6) * core * (0.55 + 0.35 * glowWave);
        // The overall breathing is ADDITIVE-ONLY (0 -> +): the Sun only ever
        // glows BRIGHTER than its bright baseline, never dimmer — so no frame
        // ever reads as a dull, dim disc.
        float breath = 0.5 + 0.5 * sin(time * 1.6);
        color *= 1.0 + 0.28 * breath;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

// Browse-mode (ambient, non-pattern) orbit speed is deliberately NOT a
// linear real-time scale of orbitalPeriodDays — Mercury (88d) to Neptune
// (60,182d) is a ~684x range, so a linear scale makes Mercury zip around
// in ~15s while Neptune takes ~2.8 REAL HOURS per revolution (looks
// completely frozen on a short mobile session). Instead, compress the
// range with a power curve (exponent < 1) relative to Mercury's period:
// still slower-the-further-out (correct Kepler ordering/feel), just not
// an impractical 684x spread. With BROWSE_REFERENCE_ORBIT_SEC=10 and
// BROWSE_COMPRESSION_EXPONENT=0.35, full-orbit durations work out to
// roughly Mercury 10s / Venus 14s / Earth 17s / Mars 21s / Jupiter 39s /
// Saturn 54s / Uranus 78s / Neptune 98s — every planet visibly moving
// within a normal viewing window instead of some looking static.
const BROWSE_REFERENCE_PERIOD_DAYS = 87.969; // Mercury
const BROWSE_REFERENCE_ORBIT_SEC = 10;
const BROWSE_COMPRESSION_EXPONENT = 0.35;

function browseAngularSpeed(periodDays) {
  const orbitSeconds =
    BROWSE_REFERENCE_ORBIT_SEC *
    Math.pow(periodDays / BROWSE_REFERENCE_PERIOD_DAYS, BROWSE_COMPRESSION_EXPONENT);
  return (Math.PI * 2) / orbitSeconds;
}

function buildPlanet(data, startDate, showMoon = true) {
  const pivot = new THREE.Group();
  // Real orbital position (see utils/currentPosition.js) instead of a
  // random angle — planets start where they actually are in their real
  // orbits, relative to each other. `startDate` (optional) lets the
  // Cosmic Signature flow anchor the phase to a person's BIRTH date;
  // undefined => the real current time (browse/Explore flow).
  const startAngle = currentOrbitAngleRad(data, startDate);
  pivot.rotation.y = startAngle;

  const tiltAnchor = new THREE.Group();
  tiltAnchor.position.set(data.distance, 0, 0);
  pivot.add(tiltAnchor);

  // Real sphere/material/clouds/atmosphere/rings — shared, single-source-
  // of-truth builder (planetFactory.js) also used by the planet swipe
  // carousel, so a planet looks IDENTICAL everywhere in the app. This
  // engine's camera is top-down, hence tiltAxis: 'z'.
  const { tiltGroup: axialTilt, mesh, clouds, ring } = buildPlanetBody(data, { tiltAxis: 'z' });
  tiltAnchor.add(axialTilt);

  let moonPivot = null;
  if (data.hasMoon && showMoon) {
    moonPivot = new THREE.Group();
    moonPivot.rotation.y = Math.random() * Math.PI * 2;
    const moonGeo = new THREE.SphereGeometry(data.radius * 0.27, 32, 32);
    const moonMat = new THREE.MeshStandardMaterial({ map: loadTexture(MOON_TEXTURE), roughness: 0.95 });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    // Tightened from 2.2x to 1.9x Earth's (now larger) radius so the Moon
    // hugs Earth more closely and its orbit can never visually reach
    // toward Mars's orbit, no matter Earth/Mars's current real angular
    // position relative to each other.
    moonMesh.position.set(data.radius * 1.9, 0, 0);
    moonPivot.add(moonMesh);
    axialTilt.add(moonPivot);
  }

  return {
    data,
    pivot,
    tiltAnchor,
    axialTilt,
    mesh,
    clouds,
    moonPivot,
    startAngle,
    browseSpeed: browseAngularSpeed(data.orbitalPeriodDays),
  };
}

function computeRewindTurns(periodDays, minPeriodDays, maxPeriodDays) {
  const safePeriod = Math.max(periodDays, 1);
  const minLog = Math.log(Math.max(minPeriodDays, 1));
  const maxLog = Math.log(Math.max(maxPeriodDays, minPeriodDays + 1));
  const pLog = Math.log(safePeriod);
  const denom = Math.max(maxLog - minLog, 1e-6);
  const fastPlanetBias = (maxLog - pLog) / denom;
  const minTurns = 0.65;
  const maxTurns = 2.35;
  return minTurns + (maxTurns - minTurns) * fastPlanetBias;
}

function orbitDirection(data) {
  return data.orbitDirection ?? 1;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} opts
 * @param {string[]} opts.planetKeys
 * @param {boolean} [opts.interactive]
 * @param {boolean} [opts.tracePattern]
 * @param {boolean} [opts.showOrbitRings]
 * @param {boolean} [opts.showMoon]
 * @param {boolean} [opts.cinematicIntro]
 * @param {boolean} [opts.orthographic] - true top-down projection (no
 *   perspective distortion/foreshortening at all) instead of the default
 *   PerspectiveCamera. Only used by the Solar System browse screen so far;
 *   the duo/pattern screens keep the perspective camera unchanged.
 * @param {number} [opts.speedDurationSec]
 * @param {number} [opts.totalSimYears]
 * @param {number} [opts.traceIntervalDays]
 */
export function createSolarSystemEngine(canvas, opts) {
  const {
    planetKeys,
    interactive = false,
    tracePattern = false,
    physicalPattern = false,
    connectAllPlanets = false,
    showOrbitRings = true,
    showMoon = true,
    cinematicIntro = false,
    startSettled = false,
    orthographic = false,
    speedDurationSec = 10,
    totalSimYears = 8,
    traceIntervalDays = 3,
    patternOpacity = 1,
    patternRates = null,
    startPaused = false,
    initialSpeedMultiplier = 1,
    miniBodiesIntro = false,
    miniSunScale = 0.5,
    miniPlanetScale = 0.58,
    miniIntroDurationSec = 1.15,
    miniMotionRampSec = 2.6,
    initialSunScale = 1,
    initialPlanetScale = 1,
    patternStartDate = undefined,
    cosmicSnapshotDate = undefined,
  } = opts;

  const scene = new THREE.Scene();
  // Background left null (not a solid Color) so the separate starfield skybox
  // pass shows through behind the solar system — the renderer's clear color
  // (set below) paints the pure-black backdrop. A scene.background Color would
  // repaint over the stars during the main pass and hide them.
  scene.background = null;

  const parent = canvas.parentElement;
  const width = parent?.clientWidth || window.innerWidth;
  const height = parent?.clientHeight || window.innerHeight;

  const validPatternKeys = (planetKeys || []).filter((k) => PLANETS_BY_KEY[k]);
  const useLegacyPattern = tracePattern && !connectAllPlanets && validPatternKeys.length === 2;

  // Orthographic = a true top-down projection with ZERO perspective
  // foreshortening — every orbit ring renders as a mathematically perfect
  // circle and a planet's on-screen size never changes just because the
  // camera dollies closer/further, unlike a PerspectiveCamera. Vertical
  // half-height is fixed; horizontal half-width simply follows the current
  // aspect ratio (updated on resize, see resize() below) — same "fixed
  // vertical extent, adaptive horizontal extent" convention the old
  // PerspectiveCamera's fixed-FOV approach used.
  const ORTHO_HALF_HEIGHT = 46;
  const camera = orthographic
    ? new THREE.OrthographicCamera(
        (-ORTHO_HALF_HEIGHT * width) / height,
        (ORTHO_HALF_HEIGHT * width) / height,
        ORTHO_HALF_HEIGHT,
        -ORTHO_HALF_HEIGHT,
        0.1,
        4000,
      )
    : new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);

  // NOTE: no `preserveDrawingBuffer` here. Setting it makes WebKit/Safari fall
  // back to a NON-multisampled backbuffer, which silently disables the MSAA
  // requested by `antialias: true` — planet limbs and orbit lines then render
  // jagged/"pixelated" (this was why the mobile app looked less crisp than the
  // legacy prototype, which never set it). Snapshots are instead taken by
  // rendering on-demand right before toDataURL (see captureDataURL below).
  // `powerPreference: high-performance` matches the legacy prototype and asks
  // multi-GPU Macs to use the discrete GPU for better quality/throughput.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Manual two-pass rendering (starfield skybox, then the main scene) — see
  // renderScene(). autoClear off so the main pass doesn't wipe the stars; the
  // clear color paints the pure-black backdrop at the start of each frame.
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);

  // Brightened overall (ambient was 0.18 -> 0.42 -> 0.62, sun 3.2/decay 0.15
  // -> 4.2/decay 0.12 -> 4.8/decay 0.1) — on lower-brightness mobile
  // displays (e.g. Pixel 8a) the planets' unlit/night side still read too
  // close to black. Ambient light raised the most (again) since that's
  // what lifts the SHADOWED side specifically (it's a uniform fill,
  // independent of the Sun's direction) without blowing out the already-lit
  // side; the Sun's own intensity/decay were nudged too so outer, farther-
  // out planets still read clearly instead of looking dim from
  // inverse-square falloff. A second faint fill light was added behind the
  // camera's general direction purely to lift the far/night hemisphere a
  // little further without adding a second visible highlight (very low
  // intensity, huge decay-free falloff so it reads as a soft ambient-like
  // top-up rather than a second sun).
  scene.add(new THREE.AmbientLight(0xffffff, 0.62));
  const sunLight = new THREE.PointLight(0xfff2d8, 4.8, 0, 0.1);
  scene.add(sunLight);
  const fillLight = new THREE.HemisphereLight(0xfff7ea, 0x2a2f45, 0.28);
  scene.add(fillLight);

  // Sun radius — legacy real size (4.2), same for browse + pattern. The
  // legacy pattern's tight, large-radius orbits keep the Sun small relative
  // to the traced spiral on their own, so no per-mode shrink is needed.
  const SUN_RADIUS = 4.2;
  // Landing screen (browse, orthographic top-down) ONLY: the Sun and every
  // planet body render at a fixed fraction of their normal size so the full
  // 8-planet system reads as a spacious, elegant overview rather than a
  // crowded "planet showcase" — orbital DISTANCES/spacing are completely
  // untouched (only the visual body geometry scales down, via
  // axialTilt.scale / sunMesh.scale below), so this never affects the
  // pattern/duo screens (they don't set `orthographic`). Sun shrinks less
  // than the planets so it stays the clear focal point of the scene.
  const LANDING_SUN_SCALE = 0.75;
  // Bumped from the original 0.68 up to full size (1.0) across a few passes
  // so the full 8-planet browse view reads a little less sparse, still
  // landing-screen only via the `orthographic` gate.
  const LANDING_PLANET_SCALE = 1.0;
  // Extra per-planet bump on top of LANDING_PLANET_SCALE (landing page only,
  // sun untouched) — the four inner rocky planets plus the two outer ice
  // giants read a bit small at the base scale, so they get a bigger 1.2x
  // bump; Jupiter/Saturn are already the biggest bodies so they only get a
  // gentler 1.1x nudge.
  const LANDING_PLANET_SCALE_BUMP = {
    mercury: 1.2,
    venus: 1.2,
    earth: 1.2,
    mars: 1.2,
    jupiter: 1,
    saturn: 1,
    uranus: 1.2,
    neptune: 1.2,
  };
  const sunGeo = new THREE.SphereGeometry(SUN_RADIUS, 64, 64);
  const sunMat = makeSunMaterial();
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  if (orthographic) sunMesh.scale.setScalar(LANDING_SUN_SCALE);
  scene.add(sunMesh);
  const sunGlowSprites = [];

  // Sun corona — three additive glow-sprite layers in a warm cream (#fff2cf)
  // -> orange (#ffb347) -> soft haze (#ff7a3d) gradient, ported from the
  // legacy prototype (js/main.js createSun). Opacity/scale are CONSTANT (not
  // animated): a continuously breathing halo layered on top of the surface
  // glow pulse read as artificial, so the halo is held steady and the subtle
  // surface breathing (see makeSunMaterial) alone gives the Sun its natural
  // "alive" glow. Scales are relative to SUN_RADIUS (unchanged at 4.2), so the
  // Sun's on-screen SIZE is exactly the same as before.
  const sunGlowTexture = makeGlowTexture();
  [
    { scale: 2.5, color: 0xfff2cf, opacity: 0.56 },
    { scale: 3.7, color: 0xffb347, opacity: 0.32 },
    { scale: 5.1, color: 0xff7a3d, opacity: 0.18 },
  ].forEach(({ scale, color, opacity }) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunGlowTexture,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    const s = SUN_RADIUS * scale * (orthographic ? LANDING_SUN_SCALE : 1);
    sprite.scale.set(s, s, 1);
    sprite.userData.baseScale = s;
    sunGlowSprites.push(sprite);
    scene.add(sprite);
  });

  // Resolve the planet data. Calculate orbit distances based on mode:
  // - For 2-planet PATTERN mode: outer planet = reference frame (100%), inner
  //   planet scaled proportionally by real AU ratio. Ensures scientific accuracy
  //   while maintaining consistent visual framing (e.g., Earth–Jupiter: outer=50,
  //   inner=50*(1.0/5.2)=9.6, preserving the 1:5.2 AU ratio).
  // - For BROWSE/COSMIC mode: use each planet's hand-tuned `distance` field
  //   (NOT real AU distances). Real AU ratios are far too compressed against
  //   SUN_RADIUS (4.2) and the planets' own visual radii — e.g. Jupiter's real
  //   distance would land literally inside the Sun's sphere — so the full
  //   8-planet browse view needs its own believable, non-overlapping layout,
  //   same as before real AU distances were introduced for pattern geometry.
  let planetDatas = planetKeys
    .map((key) => PLANETS_BY_KEY[key])
    .filter(Boolean);

  if (useLegacyPattern && planetDatas.length === 2) {
    // Two-planet pattern mode: use outer planet as reference orbit (100% radius).
    // Inner planet scales proportionally by real AU ratio.
    const PATTERN_REFERENCE_DISTANCE = 50; // Outer planet orbit size (frame reference)
    const maxAU = Math.max(...planetDatas.map((p) => p.realDistanceAU));
    planetDatas = planetDatas.map((d) => ({
      ...d,
      distance: (d.realDistanceAU / maxAU) * PATTERN_REFERENCE_DISTANCE,
    }));
  } else {
    // Browse/Cosmic mode: keep each planet's hand-tuned visual `distance`.
    planetDatas = planetDatas.map((d) => ({ ...d }));
  }

  const planets = planetDatas.map((data) => {
    const planet = buildPlanet(data, patternStartDate, showMoon);
    // Landing screen only (see LANDING_PLANET_SCALE above) — shrink the
    // whole visual body (mesh + rings + clouds/atmosphere, all children of
    // axialTilt) in place, leaving tiltAnchor's `data.distance` position
    // (and therefore orbital spacing) completely untouched. The extra
    // per-planet bump (see LANDING_PLANET_SCALE_BUMP above) is layered on
    // top of the same base scale.
    if (orthographic) {
      const bump = LANDING_PLANET_SCALE_BUMP[data.key] ?? 1;
      planet.axialTilt.scale.setScalar(LANDING_PLANET_SCALE * bump);
    }
    scene.add(planet.pivot);
    if (showOrbitRings) scene.add(makeOrbitRing(data.distance, data.color));
    return planet;
  });

  // For pattern mode with startPaused=true, we want planets at FULL SIZE on load,
  // then scale down AFTER Play is clicked. Track this separately from the
  // miniBodiesIntro logic (which is used elsewhere).
  const shouldScaleAfterPlay = tracePattern && startPaused;
  const miniBodiesEnabled = (miniBodiesIntro && planets.length > 0) || shouldScaleAfterPlay;
  let miniBodiesElapsed = 0;
  let miniBodiesDone = !miniBodiesEnabled && !shouldScaleAfterPlay;
  let miniMotionElapsed = 0;
  let playInitiated = false;
  let scaleAnimationDelaySec = 0.3; // Delay before scale-down begins after Play

  function applyMiniBodyScale(t) {
    const easedT = THREE.MathUtils.clamp(t, 0, 1);
    const sunScale = THREE.MathUtils.lerp(initialSunScale, miniSunScale, easedT);
    const planetScale = THREE.MathUtils.lerp(initialPlanetScale, miniPlanetScale, easedT);

    sunMesh.scale.setScalar(sunScale);
    sunGlowSprites.forEach((sprite) => {
      const baseScale = sprite.userData.baseScale;
      sprite.scale.set(baseScale * sunScale, baseScale * sunScale, 1);
    });
    planets.forEach((planet) => {
      planet.axialTilt.scale.setScalar(planetScale);
    });
  }

  if (miniBodiesEnabled) applyMiniBodyScale(0);

  const maxDistance = Math.max(...planets.map((p) => p.data.distance), 20);
  const cosmicSnapshotEnabled = cosmicSnapshotDate instanceof Date && !Number.isNaN(cosmicSnapshotDate.getTime());
  const COSMIC_OVERVIEW_HOLD_SEC = 2.2;
  const COSMIC_SNAPSHOT_SETTLE_SEC = 7.2;
  const COSMIC_PRE_DRAW_HOLD_SEC = 0.7;
  const COSMIC_SIGNATURE_DRAW_SEC = 2.8;
  const COSMIC_ARTIFACT_FORM_SEC = 4.2;
  const COSMIC_ARTIFACT_COPIES = 36;

  const cosmicTargetAngles = cosmicSnapshotEnabled
    ? planets.map((planet) => currentOrbitAngleRad(planet.data, cosmicSnapshotDate))
    : null;
  const cosmicStartAngles = planets.map((planet) => planet.startAngle);
  const minPeriodDays = Math.min(...planets.map((planet) => planet.data.orbitalPeriodDays));
  const maxPeriodDays = Math.max(...planets.map((planet) => planet.data.orbitalPeriodDays));
  const cosmicReverseArcs = cosmicSnapshotEnabled
    ? cosmicStartAngles.map((startAngle, index) => {
        const targetAngle = cosmicTargetAngles[index];
        const isRetrogradeOrbit = orbitDirection(planets[index].data) < 0;
        const baseReverseArc = isRetrogradeOrbit
          ? ((targetAngle - startAngle) % TWO_PI + TWO_PI) % TWO_PI
          : ((startAngle - targetAngle) % TWO_PI + TWO_PI) % TWO_PI;
        const extraTurns = computeRewindTurns(
          planets[index].data.orbitalPeriodDays,
          minPeriodDays,
          maxPeriodDays,
        );
        return baseReverseArc + extraTurns * TWO_PI;
      })
    : null;
  let cosmicOverviewElapsed = 0;
  let cosmicOverviewDone = !cosmicSnapshotEnabled;
  let cosmicSettleElapsed = 0;
  let cosmicPreDrawElapsed = 0;
  let cosmicDrawElapsed = 0;
  let cosmicArtifactElapsed = 0;
  let cosmicSettled = !cosmicSnapshotEnabled;
  let cosmicReadyToDraw = !cosmicSnapshotEnabled;
  let cosmicBaseLinesDone = !cosmicSnapshotEnabled;
  let cosmicArtifactDone = !cosmicSnapshotEnabled;

  let cosmicSignatureLines = [];
  let cosmicArtifactLines = [];
  let cosmicSignatureVertexCount = 0;
  if (cosmicSnapshotEnabled && planets.length >= 2) {
    const order = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
    const byKey = new Map(planets.map((planet) => [planet.data.key, planet]));
    const ordered = order.map((key) => byKey.get(key)).filter(Boolean);

    if (ordered.length >= 2) {
      const anchorPoints = [new THREE.Vector3(0, 0, 0)];
      ordered.forEach((planet) => {
        const planetIndex = planets.indexOf(planet);
        const angle = cosmicTargetAngles?.[planetIndex] ?? planet.startAngle;
        anchorPoints.push(new THREE.Vector3(
          planet.data.distance * Math.cos(angle),
          0,
          -planet.data.distance * Math.sin(angle),
        ));
      });

      // Keep the cosmic geometry strictly straight: connect anchors directly
      // in sequence, then close the loop by returning to the starting point.
      const signaturePoints = [...anchorPoints, anchorPoints[0].clone()];
      cosmicSignatureVertexCount = signaturePoints.length;

      const makeSignatureLine = (opacity) => {
        const geometry = new THREE.BufferGeometry().setFromPoints(signaturePoints);
        geometry.setDrawRange(0, 2);
        const material = new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity,
        });
        const line = new THREE.Line(geometry, material);
        line.visible = false;
        return line;
      };

      // Brightened from the original 0.18/0.66 (Cosmic Signature's own
      // separate line system — NOT the shared PATTERN_LINE_WIDTH/opacity
      // used by the Explore chord trace) — the low originals read as much
      // fainter/thinner than Explore's denser, brighter pattern.
      cosmicSignatureLines = [
        makeSignatureLine(0.24),
        makeSignatureLine(0.85),
      ];
      cosmicSignatureLines.forEach((line) => scene.add(line));

      const createArtifactLinePair = (rotationY) => {
        const makeArtifactLine = (opacity) => {
          const geometry = new THREE.BufferGeometry().setFromPoints(signaturePoints);
          geometry.setDrawRange(0, 2);
          const material = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
          });
          const line = new THREE.Line(geometry, material);
          line.rotation.y = rotationY;
          line.visible = false;
          line.userData.baseOpacity = opacity;
          return line;
        };

        // Brightened from the original 0.08/0.24 for the same reason.
        return [
          makeArtifactLine(0.13),
          makeArtifactLine(0.38),
        ];
      };

      for (let i = 0; i < COSMIC_ARTIFACT_COPIES; i++) {
        const rotationY = (i / COSMIC_ARTIFACT_COPIES) * TWO_PI;
        const pair = createArtifactLinePair(rotationY);
        pair.forEach((line) => {
          cosmicArtifactLines.push(line);
          scene.add(line);
        });
      }
    }
  }
  // Legacy pattern: frame the outer selected orbit to ~0.83 of the smaller
  // viewport dimension (margin 1.2) — the whole spiral lives within the outer
  // orbit, so this fills the frame while leaving a little breathing room for
  // the outer planet's own sphere. Non-pattern paths keep their prior framing.
  // For 8-planet browse mode, need more margin to prevent planets from overlapping
  // visually on screen.
  const framingMargin = useLegacyPattern
    ? 1.2
    : planets.length <= 2
      ? 1.4
      : 0.5;

  // Same "fixed vertical extent, adaptive horizontal extent" convention as
  // the perspective path below, but for an orthographic camera the FRUSTUM
  // half-height is what governs on-screen scale (NOT camera distance —
  // moving an orthographic camera closer/further does nothing visually,
  // a common trap). `restFrameRadius`/`restFrameMargin` are MUTABLE (not
  // const) because the "zoom to Sun+Earth" intro phase below changes what
  // the camera should stay framed on at rest — resize() re-derives the
  // frustum from whichever of these is current, so a resize mid-zoom or
  // after it settles still respects the current framing instead of
  // snapping back to the full-system view.
  function orthoHalfHeight(radius, margin, aspect) {
    return (radius * margin) / Math.min(1, aspect);
  }
  let restFrameRadius = maxDistance;
  let restFrameMargin = framingMargin;
  // Tracks whatever vertical half-height is ACTUALLY on screen right now
  // (updated every time the frustum is explicitly set below, including
  // every frame of the intro's zoom animation). resize() reuses this
  // directly instead of recomputing from restFrameRadius/restFrameMargin
  // (which only ever hold the FINAL rest-state values) — that mismatch
  // was the cause of a visible size "jump": a resize firing mid-intro
  // (hold/travel/zoom) would snap the frustum straight to the final
  // zoomed-in size, then the next tick() frame would snap it back to the
  // correct in-progress value, reading as a one-frame flash right around
  // the zoom transition.
  let currentOrthoHalf = null;

  // Now that the real planet set is known, size the orthographic frustum
  // to actually fit it (the placeholder bounds passed to the constructor
  // above were just a stand-in).
  if (camera.isOrthographicCamera) {
    const half = orthoHalfHeight(restFrameRadius, restFrameMargin, width / height);
    camera.left = (-half * width) / height;
    camera.right = (half * width) / height;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
    currentOrthoHalf = half;
  }

  // Starfield is rendered as a separate "skybox" pass: its own scene + a
  // perspective camera at the origin that copies the MAIN camera's orientation
  // each frame (see renderScene()). This fills the frame at any angle for BOTH
  // camera types — critically, it sidesteps the orthographic browse camera's
  // narrow frustum, which would otherwise clip an in-scene star sphere away to
  // nothing (the pure-black, star-less sky bug).
  const starfield = buildStarfield();
  const starScene = new THREE.Scene();
  starScene.add(starfield);
  const starCamera = new THREE.PerspectiveCamera(85, width / height, 1, 4000);

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
  function distanceToFit(aspect, radius = maxDistance, margin = framingMargin) {
    if (camera.isOrthographicCamera) {
      // An orthographic camera's on-screen scale comes entirely from its
      // frustum (set above), never from distance — this just returns a
      // physically safe distance to place the camera along its viewing
      // ray (near/far clipping, depth sorting), independent of framing.
      return Math.max(radius * margin * 3, 200);
    }
    const vFovRad = THREE.MathUtils.degToRad(camera.fov);
    return (radius * margin) / (Math.tan(vFovRad / 2) * Math.min(1, aspect));
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
  // Holds on a near top-down establishing shot (just shy of 90° to avoid the
  // exact lookAt pole singularity with default camera up), then slowly
  // loading screen's flat overview), then slowly ROTATES down to a more
  // angled, dimensional view (24°) over several seconds — distance/frustum
  // (see the orthographic frustum-fit block above) and the "no zoom" rule
  // are completely unchanged, only the viewing ANGLE animates.
  const HERO_ELEVATION_START_DEG = 89.6;
  const HERO_ELEVATION_END_DEG = 24;
  function heroPosition(distance, elevationDeg) {
    const rad = THREE.MathUtils.degToRad(elevationDeg);
    return new THREE.Vector3(0, distance * Math.sin(rad), distance * Math.cos(rad));
  }
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  }
  // Quintic smootherstep (6t^5-15t^4+10t^3): zero 1st AND 2nd derivative at
  // both ends, so a motion eased with it starts and stops with no perceptible
  // jerk — noticeably smoother than cubic for the zoom-in settle.
  function smootherStep(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  const earthRefDistance = PLANETS_BY_KEY.earth?.distance ?? maxDistance * 0.35;
  const heroWidePos = heroPosition(dist, HERO_ELEVATION_START_DEG);
  const heroAngledPos = heroPosition(dist, HERO_ELEVATION_END_DEG);
  // Rest state for the landing screen (both the first-time cinematic intro
  // and the returning-visitor `startSettled` framing below land on this
  // exact same framing, so there's never a first-visit vs. repeat-visit
  // scale mismatch).
  const heroWideHalf = orthoHalfHeight(maxDistance, framingMargin, width / height);
  // A wider "establishing shot" frustum used only for the very START of the
  // cinematic intro (top-down hold + the rotate into the angled view) — the
  // intro then slowly ZOOMS IN from this pulled-back establishing shot down
  // to the normal `heroWideHalf` resting framing above, giving the intro a
  // genuine push-in beat instead of holding at the same scale throughout.
  // Kept as its OWN fixed margin (not derived from `framingMargin`) — the
  // final resting zoom can be tightened independently without also
  // cropping this initial wide top-down view, which should always show the
  // WHOLE system comfortably regardless of how close the final zoom ends up.
  const INTRO_ESTABLISH_MARGIN = 1.35;
  const heroEstablishHalf = orthoHalfHeight(maxDistance, INTRO_ESTABLISH_MARGIN, width / height);
  // Keep vertical centering controlled by the shared CSS center variable.
  const introLookTarget = new THREE.Vector3(0, 0, 0);
  const INTRO_HOLD_SEC = 0.8;
  const INTRO_TRAVEL_SEC = 2.1;
  const INTRO_ZOOM_SEC = 2.2;
  let introPhase = cinematicIntro ? 'hold' : 'done';
  let introElapsed = 0;
  let introCompleteCb = null;
  let pendingIntroComplete = false;

  let controls = null;
  let onKeyZoom = null;
  let suppressControlsUpdateFrames = 0;
  function attachOrbitControls(target) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target ?? new THREE.Vector3(0, 0, 0));
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    // Zoom ENABLED — pinch-to-zoom with two fingers on mobile, mouse wheel on
    // web. For the orthographic camera OrbitControls scales `camera.zoom`
    // (bounded below), NOT the camera distance. minZoom 1 = the settled
    // establishing shot is the most zoomed-OUT view (can't pull back into
    // empty space); maxZoom lets the user push in up to 3.5x for a close look.
    controls.enableZoom = true;
    controls.zoomSpeed = 0.9;
    controls.minZoom = 1;
    controls.maxZoom = 3.5;
    controls.enablePan = false;

    // Force OrbitControls to capture the camera/target in a settled state
    // before damping/autorotate take over, which avoids a small first-frame
    // correction nudge at cinematic handoff.
    controls.enableDamping = false;
    controls.autoRotate = false;
    controls.update();
    controls.enableDamping = true;
    suppressControlsUpdateFrames = 2;

    // Calm/settled after a scripted cinematic move — no lingering ambient
    // auto-orbit fighting the composition the intro just settled into.
    controls.autoRotate = !cinematicIntro;
    controls.autoRotateSpeed = 0.35;

    // Keyboard zoom for web (+ / = to zoom in, - / _ to zoom out). OrbitControls
    // has no built-in keyboard zoom (its arrow keys pan), so nudge camera.zoom
    // directly — safe because OrbitControls only rewrites camera.zoom on an
    // actual wheel/pinch dolly, leaving a manual set untouched otherwise.
    if (!onKeyZoom) {
      onKeyZoom = (e) => {
        if (!controls || !controls.enableZoom || !camera.isOrthographicCamera) return;
        let factor;
        if (e.key === '+' || e.key === '=') factor = 1.12;
        else if (e.key === '-' || e.key === '_') factor = 1 / 1.12;
        else return;
        camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom);
        camera.updateProjectionMatrix();
        e.preventDefault();
      };
      window.addEventListener('keydown', onKeyZoom);
    }
  }

  if (cinematicIntro) {
    camera.up.set(0, 1, 0);
    camera.position.copy(heroWidePos);
    camera.lookAt(introLookTarget);
    // Start on the wider "establishing shot" frustum — the hold + rotate
    // phases keep this same wide scale (angle-only motion); the zoom phase
    // further below is what pushes in from here to `heroWideHalf`.
    if (camera.isOrthographicCamera) {
      camera.left = (-heroEstablishHalf * width) / height;
      camera.right = (heroEstablishHalf * width) / height;
      camera.top = heroEstablishHalf;
      camera.bottom = -heroEstablishHalf;
      camera.updateProjectionMatrix();
      currentOrthoHalf = heroEstablishHalf;
    }
    // OrbitControls (if this screen wants it) is attached once the scripted
    // move finishes — see tick() below.
  } else if (startSettled && interactive) {
    // Intro already played on a prior load (systemIntroPlayed persisted in
    // localStorage) — skip the animation and jump STRAIGHT to the full-system
    // view with the nice angled hero position, ready for OrbitControls. The
    // zoom-in effect was just a cinematic flourish; the persistent default is
    // the full solar system, not an Earth-centric zoom.
    camera.up.set(0, 1, 0);
    camera.position.copy(heroAngledPos);
    camera.lookAt(introLookTarget);
    if (camera.isOrthographicCamera) {
      // Use the full-system framing (heroWideHalf), not the zoomed framing
      const half = heroWideHalf;
      camera.left = (-half * width) / height;
      camera.right = (half * width) / height;
      camera.top = half;
      camera.bottom = -half;
      camera.updateProjectionMatrix();
      currentOrthoHalf = half;
      // Keep the full-system framing as the rest state
      restFrameRadius = maxDistance;
      restFrameMargin = framingMargin;
    }
    camera.lookAt(introLookTarget);
    attachOrbitControls(introLookTarget);
    controls.autoRotate = false;
  } else if (interactive) {
    camera.position.set(0, dist, dist * 0.001);
    attachOrbitControls();
  } else {
    camera.up.set(0, 0, -1);
    camera.position.set(0, dist, 0.0001);
    camera.lookAt(0, 0, 0);
  }

  // ---- Pattern tracer (chord between the two active planets) --------------
  // Uses the "fat line" addon (LineSegments2/LineSegmentsGeometry/
  // LineMaterial) instead of plain THREE.LineSegments/LineBasicMaterial —
  // ported from the original vanilla-JS prototype (js/main.js) — because
  // it's the only way to get a real, reliable dashed/dotted line style for
  // a buffer of disconnected 2-point segments (plain LineDashedMaterial's
  // distance-based dashing only works cleanly on a single continuous
  // polyline). `dashed` is left permanently enabled — the Line/Dots toggle
  // only ever changes the dashSize/gapSize NUMBERS (safe to change any
  // time), never the `dashed` boolean itself (a compile-time shader define
  // that would need a costly recompile to toggle) — gapSize: 0 (solid)
  // simply never opens a visible gap.
  let patternLines = null;
  let patternPositions = null;
  let patternDistances = null;
  let distanceBuffer = null;
  let patternCapacity = 0;
  let patternCount = 0;
  // Which planet index-pairs get a chord each sample: just the two planets
  // for Explore, or a closed loop wiring EVERY planet together for the
  // Cosmic Signature (set in the setup block below).
  let patternEdges = [[0, 1]];
  const posA = new THREE.Vector3();
  const posB = new THREE.Vector3();

  if (tracePattern && planets.length >= 2) {
    // Connectivity: a single chord between the two picked planets (Explore),
    // or a closed loop connecting EVERY planet in orbit order (Cosmic
    // Signature) — each planet sits at its real position for the birth
    // date/time (see `patternStartDate`) and the whole wired figure is swept
    // over time to generate the signature.
    patternEdges = connectAllPlanets
      ? planets.map((_, i) => [i, (i + 1) % planets.length])
      : [[0, 1]];
    // Raised from 8000: RevealScreen.jsx now sizes `totalSimYears` to fully
    // CLOSE a pair's natural resonance pattern (see the note there) rather
    // than an arbitrary short span, which for slow outer-planet pairs can
    // need many more sampled chords than the old cap allowed — hitting it
    // silently truncated the shape partway through (the same "abrupt stop"
    // symptom, just from this cap instead of totalSimYears being too
    // short). 40000 comfortably covers even the slowest realistic pairs
    // (findResonance caps the orbit-count side at 20, so this is a very
    // generous margin) at negligible memory cost (~1MB of Float32Array).
    const sampleCount = Math.ceil((totalSimYears * DAYS_PER_YEAR) / traceIntervalDays);
    patternCapacity = Math.min(sampleCount * patternEdges.length, 40000);
    patternPositions = new Float32Array(patternCapacity * 2 * 3);
    const geometry = new LineSegmentsGeometry();
    // Allocate the full buffer ONCE, at fixed capacity — calling
    // setPositions() again later with a different-sized array causes GPU
    // buffer/instance-count mismatches. Frequent updates instead mutate
    // this same buffer in place and reveal new segments via
    // `instanceCount` (the instanced-rendering equivalent of
    // BufferGeometry's setDrawRange()).
    geometry.setPositions(patternPositions);
    geometry.instanceCount = 0;
    // Distances feeding the dashed/dotted shader are computed LOCALLY per
    // chord (each segment's own range always starts at 0) instead of via
    // LineSegments2's built-in computeLineDistances(), which accumulates
    // distance CONTINUOUSLY across every segment as if they were one long
    // connected polyline. For a pattern with hundreds of disconnected
    // chords that running total climbs into the thousands of units, and
    // at that magnitude float32 precision loss in the shader's
    // `mod(vLineDistance, dashSize + gapSize)` check flips seemingly-
    // random pixels across the discard threshold — rendering as fine
    // "static" noise instead of clean lines, especially for pairs whose
    // resonance needs many chords (e.g. Venus:Earth's 8:13). Resetting
    // each chord's own distance range to start at 0 keeps every value
    // tiny (at most one chord's length), eliminating the precision issue.
    patternDistances = new Float32Array(patternCapacity * 2);
    distanceBuffer = new THREE.InstancedInterleavedBuffer(patternDistances, 2, 1);
    geometry.setAttribute('instanceDistanceStart', new THREE.InterleavedBufferAttribute(distanceBuffer, 1, 0));
    geometry.setAttribute('instanceDistanceEnd', new THREE.InterleavedBufferAttribute(distanceBuffer, 1, 1));
    const material = new LineMaterial({
      color: 0xffffff,
      transparent: true,
      // Crisp, opaque white lines with NORMAL blending — matches the
      // original vanilla-JS build (js/main.js), whose dense (3-day
      // sampled) opaque chords read as smooth, bright "Venus rose" curves.
      // The earlier additive + 0.5-opacity approach, paired with sparse
      // (10-day) sampling, instead rendered as a faint, spiky web: the
      // individual straight chords stayed visible and washed-out instead
      // of blending into a smooth, luminous envelope.
      //
      // `patternOpacity` (< 1 only for overcrowded high-loop pairs, see
      // computePatternPlan in utils/resonance.js) lets the MANY overlapping
      // chords of an extreme-ratio figure (e.g. Mercury:Neptune) ACCUMULATE
      // into a legible density gradient that reveals the hidden structure,
      // instead of saturating to a flat white disc. Low/moderate pairs get
      // patternOpacity = 1 and stay crisp/opaque as before.
      opacity: patternOpacity,
      // Shared with the Pattern Gallery via PATTERN_LINE_WIDTH so every pair
      // renders at one consistent stroke weight across both surfaces. In
      // pixels (screen-space), since worldUnits defaults to false.
      linewidth: PATTERN_LINE_WIDTH,
      depthWrite: false,
      dashed: true,
      dashScale: 1,
      dashSize: LINE_STYLES.solid.dashSize,
      gapSize: LINE_STYLES.solid.gapSize,
    });
    material.resolution.set(width, height);
    patternLines = new LineSegments2(geometry, material);
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
  let browseElapsedSec = 0;
  let lastSampledDay = 0;
  const BROWSE_DAYS_PER_REAL_SECOND = 6;
  const baseSimDaysPerRealSecond = tracePattern
    ? (totalSimYears * DAYS_PER_YEAR) / speedDurationSec
    : BROWSE_DAYS_PER_REAL_SECOND;
  // Live playback-rate multiplier — lets a caller speed up/slow down an
  // ALREADY-RUNNING pattern reveal in real time (e.g. a "rocket" slider
  // control) without restarting the simulation or recomputing
  // `totalSimYears`/`speedDurationSec`, unlike changing those fixed
  // values which only take effect on the next fresh engine instance.
  // Starts from `initialSpeedMultiplier` (default 1x) rather than always
  // 1x so a caller can start an already-fast reveal (e.g. the mobile
  // Simulation screen's default "5x" pace) without a separate initial
  // setSpeedMultiplier() call racing the first rendered frame.
  let speedMultiplier = initialSpeedMultiplier;
  let paused = startPaused;
  let completed = false;
  let onCompleteCb = null;
  let rafId = null;
  // Tracked separately from the material's raw dashSize/gapSize so
  // captureDataURL's Canvas-2D redraw (a completely different rasterizer)
  // knows which style is active and can apply its OWN equivalent dash
  // pattern (see CANVAS_DASH_STYLES) instead of always drawing solid.
  let currentLineStyle = 'solid';

  // Master-clock angle for a planet at an EXACT simulated day. `day` is the
  // single unified time variable shared by BOTH planets of a chord, so the
  // angles are locked to the same instant:
  //   theta = startAngle + 2*PI * day / effectivePeriodDays
  // where effectivePeriodDays = DAYS_PER_YEAR / revsPerYear (the compressed
  // trace rate for Explore, or the real orbital period when physicalPattern
  // is set). Evaluating this per sample — instead of reading the live mesh,
  // which only ever holds the CURRENT frame's end angle — is what fixes the
  // chord "bunching": at high speed multipliers several trace steps fall in
  // one frame, and each MUST use its own `day`, not the frame's single final
  // angle (which collapsed those steps onto one spot, then jumped).
  function planetAngleAt(planet, day) {
    // `patternRates` (Explore) overrides with an IDEALIZED whole-loop rate
    // per planet so the traced figure shuts EXACTLY and is cleanly p-fold
    // symmetric (see computePatternPlan) — an imperceptible nudge off the
    // real rate that removes the gap/lopsidedness a fractional final loop
    // would leave. Falls back to the real orbital rate (physicalPattern) or
    // the compressed artistic traceSpeed otherwise.
    const overrideRate = patternRates ? patternRates[planet.data.key] : undefined;
    const revsPerYear = overrideRate != null
      ? overrideRate
      : physicalPattern
        ? 365.256 / planet.data.orbitalPeriodDays
        : (planet.data.traceSpeed ?? (365.256 / planet.data.orbitalPeriodDays));
    return planet.startAngle + orbitDirection(planet.data) * (day / DAYS_PER_YEAR) * revsPerYear * TWO_PI;
  }

  // Analytic world position of a planet at `day`. Orbits are circular in the
  // XZ plane centred on the origin, and pivot.rotation.y = theta maps local
  // (distance,0,0) -> (distance*cos, 0, -distance*sin), so this matches the
  // live mesh exactly while letting us sample any historical instant.
  function planetWorldPosAt(planet, day, target) {
    const theta = planetAngleAt(planet, day);
    return target.set(
      planet.data.distance * Math.cos(theta),
      0,
      -planet.data.distance * Math.sin(theta),
    );
  }

  function sampleChordIfDue() {
    if (!patternLines || patternCount >= patternCapacity) return;
    let added = false;
    const edgeCount = patternEdges.length;
    while (
      simDaysElapsed - lastSampledDay >= traceIntervalDays &&
      patternCount + edgeCount <= patternCapacity
    ) {
      lastSampledDay += traceIntervalDays;
      for (let e = 0; e < edgeCount; e++) {
        const edge = patternEdges[e];
        planetWorldPosAt(planets[edge[0]], lastSampledDay, posA);
        planetWorldPosAt(planets[edge[1]], lastSampledDay, posB);
        const base = patternCount * 6;
        patternPositions[base] = posA.x;
        patternPositions[base + 1] = posA.y;
        patternPositions[base + 2] = posA.z;
        patternPositions[base + 3] = posB.x;
        patternPositions[base + 4] = posB.y;
        patternPositions[base + 5] = posB.z;
        const distBase = patternCount * 2;
        patternDistances[distBase] = 0;
        patternDistances[distBase + 1] = posA.distanceTo(posB);
        patternCount++;
      }
      added = true;
    }
    if (!added) return;
    // instanceStart & instanceEnd are two views over the SAME
    // InterleavedBuffer (see LineSegmentsGeometry.setPositions), so
    // flagging one is enough.
    patternLines.geometry.attributes.instanceStart.data.needsUpdate = true;
    patternLines.geometry.instanceCount = patternCount;
    // Push the freshly-written LOCAL distances (see construction above)
    // up to the GPU — replaces the old computeLineDistances() call.
    distanceBuffer.needsUpdate = true;
  }

  // Two-pass render: the starfield skybox first (its camera copies the main
  // camera's orientation so the sky tracks the view), then the solar system on
  // top. clearDepth() between passes so the near star shell never
  // depth-occludes the scene.
  function renderScene() {
    renderer.clear();
    starCamera.quaternion.copy(camera.quaternion);
    renderer.render(starScene, starCamera);
    renderer.clearDepth();
    renderer.render(scene, camera);
  }

  function tick() {
    rafId = requestAnimationFrame(tick);
    const delta = Math.min(clock.getDelta(), 0.05);

    // Detect when Play is first clicked (paused changes from true to false)
    if (shouldScaleAfterPlay && !playInitiated && !paused) {
      playInitiated = true;
      miniBodiesElapsed = 0;
    }

    if (!miniBodiesDone) {
      miniBodiesElapsed += delta;
      let scaleProgress = 0;
      
      if (shouldScaleAfterPlay && playInitiated) {
        // Scale-down animation: starts after a small delay, then animates over miniIntroDurationSec
        const delayedElapsed = Math.max(0, miniBodiesElapsed - scaleAnimationDelaySec);
        scaleProgress = Math.min(delayedElapsed / Math.max(0.01, miniIntroDurationSec), 1);
      } else if (miniBodiesIntro && !shouldScaleAfterPlay) {
        // Original mini-bodies intro (used on browse screen, etc.) — never
        // runs here when `shouldScaleAfterPlay` is set, otherwise bodies
        // shrank the instant this screen mounted, before Play was pressed.
        scaleProgress = Math.min(miniBodiesElapsed / Math.max(0.01, miniIntroDurationSec), 1);
      }
      
      applyMiniBodyScale(smootherStep(scaleProgress));
      
      if (scaleProgress >= 1) {
        miniBodiesDone = true;
      }
    }

    if (miniBodiesEnabled && miniBodiesDone) {
      miniMotionElapsed = Math.min(miniMotionElapsed + delta, Math.max(0.01, miniMotionRampSec));
    }

    const motionRamp = miniBodiesEnabled
      ? (miniBodiesDone ? THREE.MathUtils.clamp(miniMotionElapsed / Math.max(0.01, miniMotionRampSec), 0, 1) : 0)
      : 1;

    if (paused) {
      renderScene();
      return;
    }

    sunMesh.rotation.y += delta * 0.03;
    sunMat.uniforms.time.value += delta;
    starfield.children.forEach((layer) => {
      layer.rotation.y += delta * layer.userData.spin;
      // Advance each layer's twinkle clock (the ~26% of stars with
      // twinkleAmount > 0 scintillate off this uTime uniform).
      if (layer.material.uniforms?.uTime) layer.material.uniforms.uTime.value += delta;
    });

    if (!completed) simDaysElapsed += delta * baseSimDaysPerRealSecond * speedMultiplier * motionRamp;
    if (!completed) browseElapsedSec += delta * motionRamp;

    if (cosmicSnapshotEnabled && !cosmicOverviewDone) {
      cosmicOverviewElapsed += delta;
      planets.forEach((planet, index) => {
        const angle = cosmicStartAngles[index];
        planet.pivot.rotation.y = angle;
        planet.tiltAnchor.rotation.y = -angle;
      });
      if (cosmicOverviewElapsed >= COSMIC_OVERVIEW_HOLD_SEC) {
        cosmicOverviewDone = true;
      }
    } else if (cosmicSnapshotEnabled && !cosmicSettled) {
      cosmicSettleElapsed += delta;
      const t = Math.min(cosmicSettleElapsed / COSMIC_SNAPSHOT_SETTLE_SEC, 1);
      const eased = easeInOutCubic(t);
      planets.forEach((planet, index) => {
        const angle = orbitDirection(planet.data) < 0
          ? cosmicStartAngles[index] + cosmicReverseArcs[index] * eased
          : cosmicStartAngles[index] - cosmicReverseArcs[index] * eased;
        planet.pivot.rotation.y = angle;
        planet.tiltAnchor.rotation.y = -angle;
      });
      if (t >= 1) cosmicSettled = true;
    } else if (cosmicSnapshotEnabled && !cosmicReadyToDraw) {
      planets.forEach((planet, index) => {
        const angle = cosmicTargetAngles[index];
        planet.pivot.rotation.y = angle;
        planet.tiltAnchor.rotation.y = -angle;
      });
      cosmicPreDrawElapsed += delta;
      if (cosmicPreDrawElapsed >= COSMIC_PRE_DRAW_HOLD_SEC) {
        cosmicReadyToDraw = true;
      }
    } else if (cosmicSnapshotEnabled) {
      planets.forEach((planet, index) => {
        const angle = cosmicTargetAngles[index];
        planet.pivot.rotation.y = angle;
        planet.tiltAnchor.rotation.y = -angle;
      });
    } else {
      planets.forEach((planet) => {
        if (tracePattern) {
        // Pattern/reveal mode. The orbit angle comes from the shared
        // master-clock helper (planetAngleAt) driven by `simDaysElapsed`, the
        // SAME unified time variable the chord sampler uses — so the visible
        // planet and its traced chord endpoint are always locked to the exact
        // same instant. By default the rate is the planet's Earth-relative
        // `traceSpeed` (compresses every pair into a calm 1-2 lobe rosette);
        // when `physicalPattern` is set it's the REAL orbital period instead,
        // so each pair traces its true resonance pattern (e.g. Earth+Venus's
        // 8:13 => clean 5-petaled rose).
        planet.pivot.rotation.y = planetAngleAt(planet, simDaysElapsed);
      } else {
        // Browse mode: compressed, mobile-friendly ambient speed (see
        // browseAngularSpeed() above) instead of the real linear scale.
          planet.pivot.rotation.y =
            planet.startAngle + browseElapsedSec * planet.browseSpeed * orbitDirection(planet.data);
        }
        // Counter-rotate tiltAnchor by the exact same amount so the axial
        // tilt's WORLD orientation stays fixed as the planet orbits, instead
        // of precessing/sweeping around once per orbit (tiltAnchor has no
        // rotation of its own otherwise, so without this its child axialTilt
        // would inherit pivot's spin and the "north pole direction" would
        // visibly rotate together with orbital position — real planets keep
        // their axis pointed the same way in space throughout their orbit,
        // e.g. Earth's axis always points toward Polaris regardless of where
        // Earth is along its orbit, which is what causes the seasons).
        planet.tiltAnchor.rotation.y = -planet.pivot.rotation.y;
      });

      planets.forEach((planet) => {
        planet.mesh.rotation.y += delta * 60 * planet.data.rotationSpeed * (planet.data.spinDirection ?? 1) * motionRamp;
        if (planet.clouds) {
          planet.clouds.rotation.y +=
            delta * 60 * planet.data.rotationSpeed * 1.4 * (planet.data.spinDirection ?? 1) * motionRamp;
        }
        if (planet.moonPivot) planet.moonPivot.rotation.y += delta * 1.4;
      });
    }

    scene.updateMatrixWorld(true);
    
    // Delay pattern tracing until scale-down animation completes (if applicable)
    const scaleAnimationComplete = !shouldScaleAfterPlay || miniBodiesDone;
    if (tracePattern && scaleAnimationComplete) sampleChordIfDue();

    if (cosmicSnapshotEnabled && cosmicSettled && cosmicReadyToDraw && cosmicSignatureLines.length > 0 && !cosmicBaseLinesDone) {
      cosmicDrawElapsed += delta;
      const t = Math.min(cosmicDrawElapsed / COSMIC_SIGNATURE_DRAW_SEC, 1);
      const eased = smootherStep(t);
      const drawCount = Math.max(2, Math.floor(2 + eased * (cosmicSignatureVertexCount - 2)));
      cosmicSignatureLines.forEach((line) => {
        line.visible = true;
        line.geometry.setDrawRange(0, drawCount);
      });
      if (t >= 1) cosmicBaseLinesDone = true;
    }

    if (cosmicSnapshotEnabled && cosmicBaseLinesDone && cosmicArtifactLines.length > 0 && !cosmicArtifactDone) {
      cosmicArtifactElapsed += delta;
      const t = Math.min(cosmicArtifactElapsed / COSMIC_ARTIFACT_FORM_SEC, 1);
      const eased = smootherStep(t);

      cosmicSignatureLines.forEach((line) => {
        line.material.opacity = line.material.opacity * (1 - eased * 0.9);
      });

      const pairCount = COSMIC_ARTIFACT_COPIES;
      for (let i = 0; i < pairCount; i++) {
        const stagger = i / Math.max(1, pairCount - 1);
        const local = THREE.MathUtils.clamp((eased - stagger * 0.5) / 0.5, 0, 1);
        const drawCount = Math.max(2, Math.floor(2 + smootherStep(local) * (cosmicSignatureVertexCount - 2)));

        const glowLine = cosmicArtifactLines[i * 2];
        const coreLine = cosmicArtifactLines[i * 2 + 1];
        [glowLine, coreLine].forEach((line) => {
          line.visible = local > 0;
          line.geometry.setDrawRange(0, drawCount);
          line.material.opacity = line.userData.baseOpacity * local;
        });
      }

      if (t >= 1) cosmicArtifactDone = true;
    }

    if (tracePattern && !completed && simDaysElapsed >= totalSimYears * DAYS_PER_YEAR) {
      completed = true;
      if (onCompleteCb) onCompleteCb();
    }
    if (cosmicSnapshotEnabled && cosmicArtifactDone && !completed) {
      completed = true;
      if (onCompleteCb) onCompleteCb();
    }

    // ---- Cinematic intro camera path: hold top-down, slowly ROTATE into
    // the angled view, then dolly straight in toward Sun+Earth (each phase
    // only ever changes ONE thing — angle, then distance — never both at
    // once) ------------------------------------------------------------
    if (introPhase !== 'done') {
      introElapsed += delta;
      if (introPhase === 'hold') {
        if (introElapsed >= INTRO_HOLD_SEC) {
          introPhase = 'travel';
          introElapsed = 0;
        }
      } else if (introPhase === 'travel') {
        const t = Math.min(introElapsed / INTRO_TRAVEL_SEC, 1);
        const eased = easeInOutCubic(t);
        camera.position.lerpVectors(heroWidePos, heroAngledPos, eased);
        camera.lookAt(introLookTarget);
        if (t >= 1) {
          introPhase = 'zoom';
          introElapsed = 0;
        }
      } else if (introPhase === 'zoom') {
        // Camera position/angle/up are already at their final `travel`-end
        // values and stay completely FROZEN here — only the frustum
        // half-height animates, pushing in from the wider establishing
        // shot (`heroEstablishHalf`) down to the normal resting framing
        // (`heroWideHalf`). Interpolated GEOMETRICALLY (exponentially)
        // rather than linearly since zoom reads logarithmically to the eye
        // — a linear lerp races through the wide part and crawls at the end.
        const t = Math.min(introElapsed / INTRO_ZOOM_SEC, 1);
        const eased = smootherStep(t);
        if (camera.isOrthographicCamera) {
          const half = heroEstablishHalf * Math.pow(heroWideHalf / heroEstablishHalf, eased);
          camera.left = (-half * width) / height;
          camera.right = (half * width) / height;
          camera.top = half;
          camera.bottom = -half;
          camera.updateProjectionMatrix();
          currentOrthoHalf = half;
        }
        if (t >= 1) {
          introPhase = 'done';
          restFrameRadius = maxDistance;
          restFrameMargin = framingMargin;
          camera.lookAt(introLookTarget);
          if (interactive) attachOrbitControls(introLookTarget);
          if (introCompleteCb) pendingIntroComplete = true;
        }
      }
    }

    if (controls) {
      if (suppressControlsUpdateFrames > 0) suppressControlsUpdateFrames -= 1;
      else controls.update();
    }
    renderScene();

    if (pendingIntroComplete) {
      pendingIntroComplete = false;
      introCompleteCb?.();
    }
  }

  function resize() {
    const w = parent?.clientWidth || window.innerWidth;
    const h = parent?.clientHeight || window.innerHeight;
    if (camera.isOrthographicCamera) {
      // No "distance" concept for framing here — just recompute the
      // frustum bounds from the new aspect (fixed vertical half-height,
      // adaptive horizontal half-width), same fit formula used at setup.
      // Reuses `currentOrthoHalf` (NOT a fresh recompute from
      // `restFrameRadius`/`restFrameMargin`, which only ever hold the
      // FINAL rest-state values) so a resize firing mid-intro (hold/
      // travel/zoom) keeps whatever half-height is ACTUALLY on screen
      // right now instead of snapping to the final framing — see the
      // `currentOrthoHalf` declaration above for why that snap was
      // causing a visible "jump" right around the zoom transition.
      const half = currentOrthoHalf ?? orthoHalfHeight(restFrameRadius, restFrameMargin, w / h);
      camera.left = (-half * w) / h;
      camera.right = (half * w) / h;
      camera.top = half;
      camera.bottom = -half;
    } else {
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
    }
    camera.updateProjectionMatrix();
    // Keep the starfield skybox camera's aspect in sync so the sky never
    // stretches/crops on resize or orientation change.
    starCamera.aspect = w / h;
    starCamera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    // LineMaterial's dashing/width math is screen-space (pixels), so its
    // `resolution` uniform must stay in sync with the actual render size.
    if (patternLines) patternLines.material.resolution.set(w, h);
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
    // style: 'solid' | 'dashed' | 'dots' — see LINE_STYLES. Only touches the
    // dashSize/gapSize NUMBERS (never the `dashed` boolean itself, which
    // is a compile-time shader define that would need a costly recompile
    // to toggle).
    setLineStyle(style) {
      currentLineStyle = LINE_STYLES[style] ? style : 'solid';
      if (!patternLines) return;
      const preset = LINE_STYLES[currentLineStyle];
      patternLines.material.dashSize = preset.dashSize;
      patternLines.material.gapSize = preset.gapSize;
      // Matches CANVAS_DASH_STYLES' widthScale so the live trace's stroke
      // weight already looks like the final captured image, instead of
      // jumping thicker/thinner the moment it's swapped in.
      patternLines.material.linewidth = PATTERN_LINE_WIDTH * (preset.widthScale ?? 1);
    },
    // Live playback-rate multiplier for an already-running pattern reveal
    // (e.g. driven by a "rocket" speed slider) — see baseSimDaysPerRealSecond
    // above for why this is a separate live multiplier rather than
    // recomputing the fixed speedDurationSec/totalSimYears configuration.
    setSpeedMultiplier(value) {
      speedMultiplier = Math.max(0.1, value);
    },
    // Restarts the pattern reveal from the very beginning — clears every
    // sampled trace chord, rewinds every planet to its original starting
    // orbital angle, and resets the completion/progress state. Renders
    // one frame immediately so the reset is visible right away even while
    // paused (the normal tick() loop skips all position/geometry updates
    // while paused, so simply zeroing the counters wouldn't repaint until
    // the next unpause otherwise).
    reset() {
      simDaysElapsed = 0;
      lastSampledDay = 0;
      patternCount = 0;
      completed = false;
      miniBodiesElapsed = 0;
      miniBodiesDone = !miniBodiesEnabled && !shouldScaleAfterPlay;
      miniMotionElapsed = 0;
      playInitiated = false;
      if (miniBodiesEnabled) applyMiniBodyScale(0);
      if (patternLines) {
        patternLines.geometry.instanceCount = 0;
      }
      planets.forEach((planet) => {
        planet.pivot.rotation.y = planet.startAngle;
        planet.tiltAnchor.rotation.y = -planet.startAngle;
      });
      scene.updateMatrixWorld(true);
      renderScene();
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
      // The saved/shared/downloaded image is the traced resonance pattern
      // itself — planet body markers (those are simulation aids, not part
      // of the artifact) are hidden. The Sun is intentionally KEPT visible
      // (already tiny at initialSunScale) as a small anchor dot at the
      // pattern's center — matching the Pattern Gallery preview's own
      // small orange centre dot, instead of leaving a blank/muddy gap
      // where all the chords converge. Only the glow sprites (a soft
      // haze, not a crisp dot) are hidden so the anchor stays sharp.
      // Hide for this one synchronous render, capture, then restore
      // immediately so the still-running live view (this frame continues
      // rendering for a moment before the screen navigates away) is
      // completely unaffected. Orbit rings are intentionally left visible.
      //
      // SUPERSAMPLE the capture: the live pixel ratio is capped at the
      // real screen's devicePixelRatio (1x on many test/desktop setups),
      // which under-resolves the hundreds of thin chords converging near
      // the centre into a muddy/aliased blob. The Pattern Gallery preview
      // always rasterizes at a fixed 2x regardless of screen DPR and
      // looks clean there for exactly this reason. Force at least 2x for
      // this one-shot render so the SAVED image matches that same
      // fidelity, independent of the viewing device's real pixel ratio.
      const captureRatio = Math.max(renderer.getPixelRatio(), 2);
      renderer.setPixelRatio(captureRatio);
      renderer.setSize(width, height, false);
      sunGlowSprites.forEach((sprite) => {
        sprite.visible = false;
      });
      planets.forEach((planet) => {
        planet.pivot.visible = false;
      });
      // The chord pattern itself is drawn with the Pattern Gallery's OWN
      // technique — a separate Canvas 2D stroke() per chord, alpha-blended
      // on top of one another — instead of WebGL's LineSegments2/LineMaterial
      // fat-line quads. Both draw the exact same math (same endpoints, same
      // opacity, same width), but the two rasterizers accumulate overlapping
      // semi-transparent strokes differently, which was reading as a visibly
      // different texture at the dense chord-convergence core. Hiding
      // patternLines for this WebGL pass keeps the background (starfield,
      // orbit rings, Sun anchor dot) exactly as before; only the chords
      // themselves are then re-drawn via Canvas 2D on top, using the SAME
      // sampled `patternPositions` buffer the live trace already produced
      // (projected through the real camera, so framing matches exactly).
      const wasPatternVisible = patternLines ? patternLines.visible : false;
      if (patternLines) patternLines.visible = false;
      renderScene();
      if (patternLines) patternLines.visible = wasPatternVisible;

      const physicalWidth = renderer.domElement.width;
      const physicalHeight = renderer.domElement.height;
      const outCanvas = document.createElement('canvas');
      outCanvas.width = physicalWidth;
      outCanvas.height = physicalHeight;
      const ctx = outCanvas.getContext('2d');
      ctx.drawImage(renderer.domElement, 0, 0);

      if (patternLines && patternCount > 0) {
        ctx.strokeStyle = `rgba(255,255,255,${patternOpacity})`;
        ctx.lineJoin = 'round';
        // Apply the CURRENTLY SELECTED line style instead of always
        // stroking solid chords — previously this ignored `currentLineStyle`
        // entirely, so a saved/shared pattern always reverted to a solid
        // line even when Dashed or Dots was selected.
        const dashStyle = CANVAS_DASH_STYLES[currentLineStyle];
        const linePreset = LINE_STYLES[currentLineStyle];
        ctx.lineWidth = PATTERN_LINE_WIDTH * captureRatio * (dashStyle?.widthScale ?? 1);
        ctx.lineCap = dashStyle?.cap ?? 'round';
        const v = new THREE.Vector3();
        for (let i = 0; i < patternCount; i++) {
          const base = i * 6;
          v.set(patternPositions[base], patternPositions[base + 1], patternPositions[base + 2]).project(camera);
          const ax = (v.x * 0.5 + 0.5) * physicalWidth;
          const ay = (1 - (v.y * 0.5 + 0.5)) * physicalHeight;
          v.set(patternPositions[base + 3], patternPositions[base + 4], patternPositions[base + 5]).project(camera);
          const bx = (v.x * 0.5 + 0.5) * physicalWidth;
          const by = (1 - (v.y * 0.5 + 0.5)) * physicalHeight;
          // Derive THIS chord's dash/gap in screen pixels from the SAME
          // world-space dashSize/gapSize the live WebGL trace uses (see
          // LINE_STYLES), scaled by its own projected pixel-per-world-unit
          // ratio — instead of one FIXED pixel length shared by every
          // chord regardless of length/zoom. Without this, the captured
          // image's dash/dot density had no relation to the live trace's
          // (different unit systems entirely), so the pattern visibly
          // changed rhythm the instant it finished and swapped to the
          // captured image.
          if (dashStyle && currentLineStyle !== 'solid') {
            const chordWorldLen = patternDistances[i * 2 + 1] || 1;
            const chordPixelLen = Math.hypot(bx - ax, by - ay) || 1;
            const pxPerWorld = chordPixelLen / chordWorldLen;
            const dashPx = dashStyle.fixedDashPx != null ? dashStyle.fixedDashPx * captureRatio : linePreset.dashSize * pxPerWorld;
            ctx.setLineDash([dashPx, linePreset.gapSize * pxPerWorld]);
          } else {
            ctx.setLineDash([]);
          }
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }

      const dataUrl = outCanvas.toDataURL('image/png');
      sunGlowSprites.forEach((sprite) => {
        sprite.visible = true;
      });
      planets.forEach((planet) => {
        planet.pivot.visible = true;
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderScene();
      return dataUrl;
    },
    destroy() {
      if (rafId != null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      if (onKeyZoom) window.removeEventListener('keydown', onKeyZoom);
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
