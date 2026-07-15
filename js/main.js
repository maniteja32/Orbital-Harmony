// ============================================================================
// Orbital Harmony — Realistic Interactive 3D Solar System
// Built with Three.js. Organized into small, reusable functions.
//
// Visual pipeline: physically-inspired lighting + procedural, per-planet
// surface/cloud/ring textures (no external image assets) + a Fresnel
// atmosphere shader + SELECTIVE bloom (only the Sun's corona blooms) + a
// cinematic color-grade/vignette pass.
// ============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

// ----------------------------------------------------------------------------
// Planet data: sizes/distances are "simplified realistic" — proportionally
// believable relative to each other, but compressed so the whole system
// fits comfortably in view and animates at a pleasant speed.
// ----------------------------------------------------------------------------
// tilt = axial tilt in degrees (how far the spin axis leans from vertical).
// spinDirection = 1 for prograde (matches orbital direction, like most
// planets), -1 for retrograde. Venus spins backwards; Uranus is tipped so
// far on its side (~98°) that it effectively rolls along its orbit.
//
// Earth & Venus's `speed` ratio (0.5 : 0.8127) is deliberately set to match
// their REAL orbital period ratio (365.25 : 224.70 days ≈ 1.6255) rather
// than an arbitrary "looks nice" value. This matters specifically for the
// Orbital Harmony pattern tracer below: Earth and Venus are in a near-exact
// 8:13 orbital resonance (8 Earth years ≈ 13 Venus years), which is what
// produces the classic 5-petal "Venus rose" Spirograph figure. Using an
// inaccurate ratio here would trace a smeared/incomplete pattern instead.
const PLANET_DATA = [
  { name: 'Mercury', radius: 0.6, distance: 16, type: 'mercury', speed: 0.79, rotationSpeed: 0.004, tilt: 0.03, spinDirection: 1 },
  { name: 'Venus',   radius: 1.1, distance: 21, type: 'venus',   speed: 0.8127, rotationSpeed: 0.0045, tilt: 3, spinDirection: -1 },
  { name: 'Earth',   radius: 1.2, distance: 25, type: 'earth',   speed: 0.5,  rotationSpeed: 0.02, tilt: 23.4, spinDirection: 1, hasAtmosphere: true, hasClouds: true, hasMoon: true },
  { name: 'Mars',    radius: 0.8, distance: 31, type: 'mars',    speed: 0.40, rotationSpeed: 0.018, tilt: 25, spinDirection: 1 },
  { name: 'Jupiter', radius: 3.6, distance: 42, type: 'jupiter', speed: 0.22, rotationSpeed: 0.045, tilt: 3, spinDirection: 1 },
  { name: 'Saturn',  radius: 3.0, distance: 55, type: 'saturn',  speed: 0.16, rotationSpeed: 0.042, tilt: 27, spinDirection: 1, hasRings: true },
  { name: 'Uranus',  radius: 2.0, distance: 67, type: 'uranus',  speed: 0.11, rotationSpeed: 0.03, tilt: 82, spinDirection: 1 },
  { name: 'Neptune', radius: 1.9, distance: 78, type: 'neptune', speed: 0.09, rotationSpeed: 0.032, tilt: 28, spinDirection: 1 },
];

// Roughness/metalness tuning per surface type — rock is matte, oceans and
// gas/ice giant atmospheres carry a soft sheen.
const MATERIAL_PRESETS = {
  mercury: { roughness: 0.95, metalness: 0.05 },
  venus:   { roughness: 0.92, metalness: 0.0 },
  earth:   { roughness: 0.85, metalness: 0.0 },
  mars:    { roughness: 0.92, metalness: 0.03 },
  jupiter: { roughness: 0.6,  metalness: 0.0 },
  saturn:  { roughness: 0.6,  metalness: 0.0 },
  uranus:  { roughness: 0.5,  metalness: 0.0 },
  neptune: { roughness: 0.5,  metalness: 0.0 },
  moon:    { roughness: 0.95, metalness: 0.02 },
};

// Earth's Moon — sized and lit the same way as every other body (real
// equirectangular texture map, same MeshStandardMaterial recipe via
// MATERIAL_PRESETS.moon), just orbiting Earth instead of the Sun.
// radius: ~0.27x Earth's radius here (1.2), matching the Moon's real
// ~0.273 Earth-diameter ratio, while still reading clearly at this scene's
// scale (same spirit as every other planet's radius in PLANET_DATA — never
// a literal 1:1 astronomical scale, just proportionally faithful).
// distance: comfortably clears Earth's atmosphere shell (radius * 1.06) and
// cloud layer (radius * 1.03) with margin, so the orbit never clips them.
// orbitSpeedMultiplier: derived from the real ratio of orbits — the Moon
// completes ~13.4 orbits per Earth year, so its angular rate here is
// 13.4x Earth's own pivot.rotation.y increment (simDelta * 0.15 * 0.5 =
// simDelta * 0.075), i.e. ~simDelta * 1.0 — reads as a fast, clearly-visible
// orbit around Earth without needing its own gating flag.
const MOON_CONFIG = {
  radius: 0.33,
  distance: 2.6,
  orbitSpeedMultiplier: 1.0,
};

// Real, representationally-accurate equirectangular texture maps (CC BY 4.0,
// solarsystemscope.com — based on NASA Messenger/Viking/Cassini/Hubble
// imagery) served locally from assets/textures/, loaded via
// THREE.TextureLoader instead of procedurally drawn on a <canvas>.
const TEXTURE_LOADER = new THREE.TextureLoader();
const TEXTURE_PATHS = {
  sun: 'assets/textures/sun.jpg',
  moon: 'assets/textures/moon.jpg',
  mercury: 'assets/textures/mercury.jpg',
  venus: 'assets/textures/venus.jpg',
  earth: 'assets/textures/earth_daymap.jpg',
  earthClouds: 'assets/textures/earth_clouds.jpg',
  mars: 'assets/textures/mars.jpg',
  jupiter: 'assets/textures/jupiter.jpg',
  saturn: 'assets/textures/saturn.jpg',
  saturnRing: 'assets/textures/saturn_ring.png',
  uranus: 'assets/textures/uranus.jpg',
  neptune: 'assets/textures/neptune.jpg',
};
const textureCache = new Map();

// Loads (and caches) a texture by key from TEXTURE_PATHS, tagging it with
// the correct color space so lit surfaces render at the right brightness.
function loadPlanetTexture(key, { srgb = true } = {}) {
  if (textureCache.has(key)) return textureCache.get(key);
  const texture = TEXTURE_LOADER.load(TEXTURE_PATHS[key]);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  textureCache.set(key, texture);
  return texture;
}

const SUN_RADIUS = 4.2;
const BLOOM_SCENE = 1; // render layer reserved for objects that should bloom (the Sun)

// Orbital Harmony is primarily a top-down planetary PATTERN GENERATOR, not a
// cinematic planet showcase — so the default view favors clean, stable,
// readable orbital motion over realistic planet self-rotation. When true,
// planets (and the Sun) still revolve around the Sun via their orbitPivot
// exactly as before, but stop spinning on their own local axis, so their
// textures/markings read as steady, recognizable markers from the fixed
// top-down camera instead of constantly rotating 3D bodies. Flip to false
// to restore full realistic self-rotation (e.g. for a future cinematic/
// free-look mode) — the orbit/revolution system itself is unaffected
// either way.
const TOP_VIEW_PATTERN_MODE = false;

// Orbital Harmony prioritizes PATTERN VISUALIZATION and readability over
// strict astronomical accuracy. Even with the presentation angle applied
// as the correct OUTERMOST rotation (see presentationGroup below), each
// planet's real axial tilt (Earth 23.4°, Saturn ~27°, Uranus ~82°,
// Neptune ~28°, etc. — still stored untouched in PLANET_DATA.tilt for a
// future scientific mode) still contributes its own residual Z-component
// to the final composed orientation, which keeps bands/rings from
// reading as perfectly level and recognizable. When true, real axial
// tilt is skipped entirely for rendering (axialTilt.rotation.z stays 0)
// and ONLY the single clean presentation-angle rotation determines each
// planet's visual orientation — giving the level, documentary-style
// "bands horizontal, rings symmetric" look this app is going for. Flip
// to false to restore real per-planet axial tilt for a future
// scientific/educational mode.
const DISABLE_REAL_AXIAL_TILT = true;

// ----------------------------------------------------------------------------
// Staged planet-orientation rollout.
//
// PHASE 1 (current): every planet renders at a canonical, neutral
// baseline — north pole straight up, south pole straight down, equator
// horizontal, zero roll around any axis, no presentation tilt, no hero
// angle, no real axial tilt. This is a deliberate, temporary "all systems
// off" state used to confirm every planet is fundamentally upright and
// correctly UV-mapped BEFORE any cosmetic viewing-angle system is layered
// back on top of it.
//
// PHASE 2 (future): re-enable ENABLE_PRESENTATION_TILT below to layer the
// single-axis presentation angle (see PRESENTATION_ANGLES) back on top of
// this confirmed-clean baseline.
const ENABLE_PRESENTATION_TILT = false;

// ----------------------------------------------------------------------------
// PHASE 1A — True Top-View Baseline.
//
// A PerspectiveCamera, even pointed straight down, still projects with
// perspective: things further from the lens along the view axis appear
// very slightly smaller, and off-center geometry (Saturn's rings, the
// edges of wide orbits) can pick up a faint elliptical/compressed look
// purely from lens perspective — not from any camera tilt. An
// OrthographicCamera has NO perspective falloff at all: parallel lines
// stay parallel, every orbit ring renders as a mathematically perfect
// circle, and every planet renders as a perfect circle regardless of its
// distance from the lens. When true, createCamera()/onWindowResize()
// build and maintain an OrthographicCamera instead of a PerspectiveCamera
// — position, target, OrbitControls, orbit mechanics, pattern generation,
// planet positions/textures/sizes are all completely unaffected.
const TRUE_TOP_VIEW = true;
// Half the vertical world-space height visible at the camera's default
// zoom level (OrthographicCamera has no FOV — its "zoom" is defined by
// this frustum size instead). Must comfortably exceed the outermost
// orbit's radius (Neptune, distance 78 + its own radius ~1.9 ≈ 80) or
// that orbit ring / planet gets clipped at the canvas edge — sized here
// with a deliberate ~15% margin beyond Neptune's orbit so nothing ever
// touches or crosses the frame boundary at the default zoom level.
const ORTHO_VIEW_HALF_HEIGHT = 92;

// ----------------------------------------------------------------------------
// planetOrientation — dedicated, centralized store for any per-planet
// BASELINE rotation correction (degrees) applied to that planet's
// `planetContainer` (see createPlanet()), layered on top of its real axial
// tilt (axialTilt). This is intentionally left EMPTY for every planet right
// now: after an orientation audit, the previous "Hero Angle" experiment
// (which set both an x AND a y rotation on the same object) was found to be
// the root cause of planets appearing rolled/diagonal — composing two
// non-zero Euler components on one object does not yield two independent
// tilts, it yields a single compound rotation around a DIAGONAL axis, which
// reads as an unwanted roll (e.g. Jupiter's bands running diagonally
// instead of horizontally, Earth's continents at an unnatural angle).
// Every planet is reset to a clean, natural, scientifically-neutral
// baseline (no correction) here; only its real axial tilt (a single clean
// Z-axis rotation, from PLANET_DATA) affects its resting orientation. If a
// specific planet's texture is later found to be genuinely mis-mapped
// (upside-down/mirrored), fix it HERE — one small, named, single-axis
// correction per planet — never with ad-hoc multi-axis rotations sprinkled
// through the codebase. Any future artistic "hero angle" / presentation
// system should be re-introduced as a clearly separate, opt-in layer once
// this baseline is confirmed correct — not by re-populating this object
// with combined x+y+z values.
const planetOrientation = {
  mercury: {},
  venus: {},
  earth: {},
  mars: {},
  jupiter: {},
  saturn: {},
  uranus: {},
  neptune: {},
};

// ----------------------------------------------------------------------------
// PRESENTATION_ANGLES — a dedicated planet-presentation layer, applied
// through its own `presentationGroup` (nested INSIDE `planetContainer`,
// see createPlanet()), kept fully separate from the scientific
// `planetOrientation` baseline above.
//
// The actual problem this solves: the solar-system camera looks almost
// straight down (top-view), so every planet's own spin axis points nearly
// AT the camera — the viewer naturally sees each planet's POLE, not its
// recognizable equatorial band (Jupiter/Saturn/Uranus/Neptune's bands,
// Earth/Mars's surface features, Saturn's rings). This is a viewing-angle
// problem, not a rotation problem, and the fix here is deliberately the
// simplest, least "arbitrary" one possible: a SINGLE clean rotation around
// one fixed world axis (X), tilting each planet by a value in the
// ~30°-45° range — equivalent to how a documentary camera would sit at a
// 30-45° elevation above a planet instead of directly overhead — while the
// actual solar-system camera itself never moves.
//
// Earlier revisions of this layer set BOTH an x AND a y Euler component on
// the same object at once. That is NOT two independent tilts: Three.js
// composes multiple non-zero Euler components on one Object3D into a
// single rotation around a diagonal axis, which reads as an unwanted roll
// (Jupiter's bands running diagonally, Earth's continents at a weird
// angle) — i.e. exactly the "random mesh rotation" look this system must
// avoid. Restricting every entry here to X-ONLY (y and z always 0)
// eliminates that compounding entirely: the result is a single, legible,
// non-rolled "viewed from the side" tilt, not an arbitrary orientation.
// Saturn intentionally uses the gentlest value in the range so its rings
// stay clearly open (not edge-on); the rest use a slightly steeper value
// since a plain sphere has no ring-flatness constraint to protect.
// Purely cosmetic — no orbit math, orbit rings, planet positions, pattern
// generation, or camera controls are touched by this. Set once at
// creation time (never animated, never derived from the camera) — no
// lookAt(), no quaternion copying, no billboarding.
const PRESENTATION_ANGLES = {
  mercury: { x: 40, y: 0, z: 0 },
  venus: { x: 40, y: 0, z: 0 },
  earth: { x: 35, y: 0, z: 0 },
  mars: { x: 35, y: 0, z: 0 },
  jupiter: { x: 40, y: 0, z: 0 },
  saturn: { x: 30, y: 0, z: 0 },
  uranus: { x: 40, y: 0, z: 0 },
  neptune: { x: 40, y: 0, z: 0 },
};

// The camera's "designed" vertical field of view at a full, un-shrunk
// window. onWindowResize() adjusts the *actual* vertical FOV away from this
// baseline to compensate when the control panel narrows the canvas, so the
// horizontal field of view (and therefore the composition/zoom level)
// never changes — only the visible vertical extent grows a little.
const BASE_VERTICAL_FOV_DEG = 45;

// A single, uniform, understated grey used for every orbit ring — clean
// and consistent rather than a different tint per planet, so the rings
// read as quiet background reference lines instead of competing for
// attention with the (colorful) planets and pattern-tracer lines.
const ORBIT_RING_COLOR = 0x9a9a9a;
// Every ring's LineMaterial needs its `resolution` uniform kept in sync with
// the actual render size (see onWindowResize) — tracked here so that loop
// doesn't need to know how many rings exist.
const orbitLineMaterials = [];

// ----------------------------------------------------------------------------
// Orbital Harmony pattern tracer — tunable controls.
//
// Trace generation is driven by a SIMULATED calendar (derived from Earth's
// own accumulated orbital angle: one full Earth revolution = 1 simulated
// year = 365.25 simulated days), NOT by real elapsed time or render frame
// count. This is what "decouples" tracing from frame rate: whether the
// browser renders at 30fps or 144fps, a trace point is only appended once
// the simulated calendar has advanced by `traceInterval` days, so the
// resulting geometry is identical regardless of performance.
//
//   simulationYears — how many simulated Earth-years of trace history the
//                     pattern can hold before it simply stops adding new
//                     lines (every line drawn so far is retained
//                     permanently — nothing is ever recycled/discarded).
//                     Set to 8 because Earth and Venus complete a near-
//                     exact 8:13 orbital resonance in 8 Earth years — that
//                     is the full period needed for the classic 5-petal
//                     "Venus rose" figure to close up; anything shorter
//                     only shows a partial, less recognizable arc of it.
//   traceInterval   — sample one new trace line every N simulated days.
//                     Larger = sparser, more distinct lines. Smaller =
//                     denser detail (but risks overdraw if too small).
//   maxTraceLines   — hard safety cap on the buffer size, independent of
//                     the two settings above, so a large simulationYears/
//                     traceInterval combination can never balloon memory
//                     or GPU upload cost.
// ----------------------------------------------------------------------------
// simulationYears is intentionally fixed at 8 (not exposed in the control
// panel) — that's the exact span needed for Earth/Venus's 8:13 resonance
// to close into the full "Venus rose" figure, so it's not a knob users
// should need to tune. traceInterval remains user-adjustable (the panel's
// "Trace Interval" slider) — see rebuildPatternCapacity() below.
const PATTERN_CONFIG = {
  simulationYears: 8,
  traceInterval: 3,
  maxTraceLines: 3200,
};
const DAYS_PER_YEAR = 365.25;
let PATTERN_CAPACITY = computePatternCapacity();

// Pattern-tracer line style presets — dashSize/gapSize are in the SAME
// screen-space pixel units as `linewidth` (worldUnits defaults to false on
// LineMaterial). "solid" uses gapSize: 0 so no gap ever opens, regardless
// of dashSize.
const LINE_STYLES = {
  solid: { dashSize: 1, gapSize: 0 },
  dashed: { dashSize: 2, gapSize: 2 },
  dots: { dashSize: 0.5, gapSize: 1 },
};

function computePatternCapacity() {
  return Math.min(
    Math.ceil((PATTERN_CONFIG.simulationYears * DAYS_PER_YEAR) / PATTERN_CONFIG.traceInterval),
    PATTERN_CONFIG.maxTraceLines
  );
}

// ----------------------------------------------------------------------------
// Core Three.js setup
// ----------------------------------------------------------------------------
let scene, camera, renderer, controls, clock;
let bloomComposer, finalComposer, colorGradePass;
let starfieldMaterial = null; // kept so animate() can advance the twinkle uniform
let starfieldTime = 0;
const planets = []; // { pivot, mesh, clouds, data, angle }

// Sun corona sprites — kept so `animate()` can breathe/pulse their scale and
// opacity each frame (see createSun()), the same "alive" feel as the
// loading screen's pulsing CSS sun.
const sunCorona = []; // { sprite, baseScale, baseOpacity, speed, phase }
let sunPulseTime = 0;
// The Sun's own sphere mesh — kept so animate() can give it the same slow,
// stable self-rotation every planet has (real photosphere rotation is
// ~25 real days at the equator; deliberately very slow here so it reads as
// gentle life rather than a fast spin). Only rotation.y is ever touched on
// this mesh — same single-axis-per-object pattern used for planets — so
// there's no risk of the Euler-composition wobble planets previously had.
let sunMesh = null;

// Orbital Harmony pattern tracer state
let patternLines, patternPositions, patternLineCount = 0;
let lastTraceSimDay = 0;
const _patternPosA = new THREE.Vector3();
const _patternPosB = new THREE.Vector3();

// Control-panel state — simulation playback and the two planets currently
// being traced. Mutated only through the `api` object exported at the
// bottom of this file.
let simulationSpeedMultiplier = 1;
let isPaused = false;
let planetASelection = 'Venus';
let planetBSelection = 'Earth';
// The pattern tracer stays idle until the user explicitly clicks
// "Generate Pattern" — nothing should accumulate on page load, and
// changing a planet selector shouldn't silently start tracing either.
let isGenerating = false;

// Selective-bloom bookkeeping
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_SCENE);
const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
const materialCache = new Map();

// Cinematic intro camera fly-in — ends in a clear top-down overhead view
// for unambiguous, clean viewing of the orbital system
const introStart = new THREE.Vector3(0, 190, 60);
const introEnd = new THREE.Vector3(0, 180, 0);
let introElapsed = 0;
const introDuration = 3.2;

init();
animate();

function init() {
  scene = createScene();
  camera = createCamera();
  renderer = createRenderer();
  controls = createControls(camera, renderer);
  clock = new THREE.Clock();

  starfieldMaterial = createStarfield(9000);
  createLighting();
  const sun = createSun();
  scene.add(sun);

  PLANET_DATA.forEach((data) => {
    const planet = createPlanet(data);
    scene.add(planet.pivot);
    scene.add(createOrbitLine(data.distance));
    planets.push(planet);
  });
  applyActivePlanets();

  createPatternTracer();

  setupPostProcessing(renderer, scene, camera);

  window.addEventListener('resize', onWindowResize);
  // Sync camera aspect/FOV to the canvas's ACTUAL initial size right away —
  // createCamera() only had window.innerWidth/innerHeight to go on (before
  // the renderer/canvas existed), which doesn't match the real canvas size
  // whenever the panel is already reserving space on load. Skipping this
  // left camera.aspect mismatched from the render surface, stretching
  // every sphere into a vertical ellipse until the next manual resize.
  onWindowResize();

  // Hide the loading overlay once the first frame is ready
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    requestAnimationFrame(() => loadingEl.classList.add('hidden'));
  }
}

// ----------------------------------------------------------------------------
// Scene / Camera / Renderer / Controls
// ----------------------------------------------------------------------------
function createScene() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x00000a);
  s.fog = new THREE.FogExp2(0x00000a, 0.0013);
  return s;
}

function createCamera() {
  if (TRUE_TOP_VIEW) {
    const aspect = window.innerWidth / window.innerHeight;
    const halfHeight = ORTHO_VIEW_HALF_HEIGHT;
    const halfWidth = halfHeight * aspect;
    const cam = new THREE.OrthographicCamera(-halfWidth, halfWidth, halfHeight, -halfHeight, 0.1, 2000);
    // Start pulled back for the intro fly-in; eases to the framing shot.
    // Position still matters for an orthographic camera (it determines
    // WHERE it sits / what direction it looks, just not how big things
    // appear — that's controlled by the left/right/top/bottom frustum
    // above instead of by distance).
    cam.position.copy(introStart);
    return cam;
  }

  const cam = new THREE.PerspectiveCamera(
    BASE_VERTICAL_FOV_DEG,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );
  // Start pulled back for the intro fly-in; eases to the framing shot
  cam.position.copy(introStart);
  return cam;
}

function createRenderer() {
  const canvas = document.getElementById('app');
  const r = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  // updateStyle=false: our own CSS controls the canvas's box size (it
  // shrinks to leave room for the control panel), we just match the
  // renderer's internal resolution to whatever that computed size is.
  r.setSize(canvas.clientWidth, canvas.clientHeight, false);
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  r.outputColorSpace = THREE.SRGBColorSpace;
  return r;
}

function createControls(cam, r) {
  const c = new OrbitControls(cam, r.domElement);
  c.enableDamping = true;
  c.dampingFactor = 0.06;
  if (cam.isOrthographicCamera) {
    // OrbitControls dollies an OrthographicCamera by scaling `camera.zoom`
    // (via minZoom/maxZoom) rather than moving it closer/further along the
    // view axis (minDistance/maxDistance, which only apply to perspective
    // cameras and would otherwise be silently ignored here).
    c.minZoom = 0.2;
    c.maxZoom = 12;
  } else {
    c.minDistance = 15;
    c.maxDistance = 400;
  }
  c.enablePan = true;
  c.target.set(0, 0, 0);
  // Ambient camera auto-orbit is kept off independent of TOP_VIEW_PATTERN_MODE
  // — planet self-rotation (spin) and camera auto-orbit are two separate
  // concerns; enabling realistic per-planet spin should not also make the
  // camera itself drift/orbit. Set to true manually for a future cinematic
  // idle-drift mode if ever wanted.
  c.autoRotate = false;
  c.autoRotateSpeed = 0.25;
  return c;
}

// ----------------------------------------------------------------------------
// Starfield — realistic deep-space backdrop with per-star color & size
// (custom shader points: soft circular falloff + stellar-temperature colors)
// ----------------------------------------------------------------------------
function createStarfield(count) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  // Per-star twinkle parameters — only a small minority of stars actually
  // twinkle (twinkleAmount > 0); everyone else stays a constant, calm
  // pinprick so the effect reads as "a handful of real stars twinkling"
  // rather than the whole sky shimmering.
  const twinklePhases = new Float32Array(count);
  const twinkleSpeeds = new Float32Array(count);
  const twinkleAmounts = new Float32Array(count);

  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    // Distribute stars on a large sphere shell around the scene
    const radius = THREE.MathUtils.randFloat(350, 950);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);

    // Roughly mimic real stellar populations: mostly white/blue-white,
    // some warm yellow/orange, occasional cool red dwarfs.
    const roll = Math.random();
    if (roll < 0.55) color.setHSL(0.58, 0.25, THREE.MathUtils.randFloat(0.75, 0.95)); // blue-white
    else if (roll < 0.8) color.setHSL(0.12, 0.35, THREE.MathUtils.randFloat(0.75, 0.9)); // warm white/yellow
    else if (roll < 0.93) color.setHSL(0.09, 0.55, THREE.MathUtils.randFloat(0.65, 0.8)); // amber
    else color.setHSL(0.02, 0.6, THREE.MathUtils.randFloat(0.55, 0.7)); // reddish

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    // A handful of brighter "hero" stars, most are faint pinpricks
    sizes[i] = roll > 0.97 ? THREE.MathUtils.randFloat(2.2, 3.4) : THREE.MathUtils.randFloat(0.6, 1.6);

    // ~28% of stars twinkle (randomized phase/speed so they never sync up
    // into a uniform pulse); the rest get twinkleAmount = 0, i.e. no
    // brightness modulation at all — matches a real night sky, where a
    // noticeable handful of stars visibly scintillate at any given moment,
    // while most stay steady.
    twinklePhases[i] = Math.random() * Math.PI * 2;
    twinkleSpeeds[i] = THREE.MathUtils.randFloat(1.2, 3.5);
    twinkleAmounts[i] = Math.random() < 0.28 ? THREE.MathUtils.randFloat(0.5, 0.9) : 0;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('twinklePhase', new THREE.BufferAttribute(twinklePhases, 1));
  geometry.setAttribute('twinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1));
  geometry.setAttribute('twinkleAmount', new THREE.BufferAttribute(twinkleAmounts, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      attribute float twinklePhase;
      attribute float twinkleSpeed;
      attribute float twinkleAmount;
      uniform float uTime;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vColor = color;
        // Stars with twinkleAmount = 0 stay at a constant vTwinkle = 1.0
        // regardless of uTime — only the ~28% picked to twinkle actually
        // swing in brightness (both dimmer AND brighter than resting, for
        // a real sparkle rather than just a fade), each at its own random
        // speed/phase so they never sync up into a uniform pulse.
        float wave = sin(uTime * twinkleSpeed + twinklePhase);
        vTwinkle = 1.0 + twinkleAmount * wave;
        // Twinkling stars also pulse slightly in size at their brightest
        // moments, reinforcing the sparkle instead of only a color change.
        float sizePulse = 1.0 + max(wave, 0.0) * twinkleAmount * 0.6;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * sizePulse * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float alpha = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor * vTwinkle, alpha * clamp(vTwinkle, 0.0, 1.0));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
  return material;
}

// ----------------------------------------------------------------------------
// Lighting — a hot point light at the Sun (inverse square falloff) for
// directional shading, plus generous fill lighting so every planet reads as
// a fully-visible, evenly-lit sphere (like the reference NASA composite
// renders) rather than half-swallowed by a hard day/night terminator.
// ----------------------------------------------------------------------------
function createLighting() {
  const sunLight = new THREE.PointLight(0xfff1d6, 1700, 0, 2); // physical decay=2
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  const hemi = new THREE.HemisphereLight(0x4a72ad, 0x232a3a, 1.3);
  scene.add(hemi);

  // A strong "headlight" fixed to the camera so the whole side of every
  // planet facing the viewer is clearly and evenly lit, regardless of where
  // the Sun is — matching reference imagery (like NASA's composite planet
  // mosaics) where every planet is fully visible with no dark/night side.
  // decay=0 means it does NOT fall off with distance (a deliberate, non-
  // physical stylization) so it works equally well for Mercury and Neptune.
  const fillLight = new THREE.PointLight(0xfff6e8, 4.6, 0, 0);
  camera.add(fillLight);
  scene.add(camera);
}

// ----------------------------------------------------------------------------
// Sun — limb-darkened photosphere (bright center, dimmer edge, like real
// photos) with turbulent granulation/sunspots, a couple of looping
// prominence "flares", and a restrained corona. The Sun (and only the Sun)
// sits on the BLOOM_SCENE layer so the bloom pass makes it glow without
// blowing out the planets.
// ----------------------------------------------------------------------------
function createSun() {
  const group = new THREE.Group();

  const geometry = new THREE.SphereGeometry(SUN_RADIUS, 96, 96);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      // Real photographic solar surface texture (CC BY 4.0, same source as
      // the planet texture maps) instead of the earlier procedural canvas
      // granulation, for a more visually authentic photosphere — the
      // limb-darkening/highlight shading below is layered on top of it
      // exactly as before.
      surfaceMap: { value: loadPlanetTexture('sun') },
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
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vec3 tex = texture2D(surfaceMap, vUv).rgb;
        // Classic limb darkening: the photosphere's edge (grazing angle to
        // the viewer) is cooler and dimmer than its center — real photos of
        // the Sun always show this falloff. Pushed a bit deeper/sharper than
        // before so the disc reads as a genuine lit sphere with volume,
        // instead of a flat, uniformly-bright circle.
        float facing = clamp(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
        float limb = mix(0.1, 0.88, pow(facing, 0.75));

        // Off-center hot spot — same upper-left highlight position as the
        // loading screen's CSS sun ("circle at 35% 35%") — reinforces the
        // 3D illusion by giving the sphere an implied light direction
        // instead of perfectly symmetric shading.
        vec3 highlightDir = normalize(vec3(-0.4, 0.4, 0.85));
        float highlight = pow(clamp(dot(vNormal, highlightDir), 0.0, 1.0), 5.0);

        vec3 color = tex * limb + vec3(1.0, 0.96, 0.85) * highlight * 0.28;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const sunMeshInner = new THREE.Mesh(geometry, material);
  sunMeshInner.layers.enable(BLOOM_SCENE);
  sunMesh = sunMeshInner;
  group.add(sunMeshInner);

  // Glowing halo — same warm gradient as the loading screen's sun (bright
  // cream core #fff2cf -> orange #ffb347 -> soft outer haze #ff7a3d), just
  // dialed back a bit in size/opacity so it reads as a glow rather than
  // dominating the frame. Each sprite is also registered in `sunCorona` so
  // `animate()` can gently breathe its scale/opacity over time — the same
  // "alive" pulsing quality as the loader's CSS sun, instead of a static halo.
  const coronaLayers = [
    { scale: 2.5, color: 0xfff2cf, opacity: 0.22, speed: 0.6, phase: 0 },
    { scale: 3.7, color: 0xffb347, opacity: 0.12, speed: 0.45, phase: 1.4 },
    { scale: 5.1, color: 0xff7a3d, opacity: 0.06, speed: 0.35, phase: 2.7 },
  ];
  const glowTexture = createRadialGlowTexture();

  coronaLayers.forEach(({ scale, color, opacity, speed, phase }) => {
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(glowMaterial);
    const baseScale = SUN_RADIUS * scale;
    sprite.scale.set(baseScale, baseScale, 1);
    sprite.layers.enable(BLOOM_SCENE);
    group.add(sprite);
    sunCorona.push({ sprite, baseScale, baseOpacity: opacity, speed, phase });
  });

  return group;
}

// Soft radial-gradient sprite texture used for corona layers (no external assets)
function createRadialGlowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.25, 'rgba(255, 200, 120, 0.6)');
  gradient.addColorStop(1, 'rgba(255, 150, 60, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ----------------------------------------------------------------------------
// Planet creation — each planet orbits via a rotating `pivot`, but its axial
// tilt lives on a separate `tiltAnchor` group that counter-rotates against
// the pivot every frame (see animate()). Without this, the tilt/spin axis
// would be a CHILD of the orbit rotation and would visibly precess a full
// 360° over the course of one orbit — most obvious on Saturn, where a flat
// ring plane makes that drift look like the whole planet "wobbling". Real
// planets keep their axial tilt pointed the same way in space regardless of
// where they are in their orbit.
// ----------------------------------------------------------------------------
function createPlanet(data) {
  const pivot = new THREE.Group();
  // Random starting angle so planets don't all line up
  const angle = Math.random() * Math.PI * 2;
  pivot.rotation.y = angle;

  const tiltAnchor = new THREE.Group();
  tiltAnchor.position.set(data.distance, 0, 0);
  pivot.add(tiltAnchor);

  // ---- Jupiter-only "lean toward the Sun" (visual only) --------------------
  // A tiny, dedicated presentation layer that exists ONLY for Jupiter — no
  // other planet is touched by this. tiltAnchor's counter-rotation (see
  // animate()) deliberately holds the rest of the hierarchy's ORIENTATION
  // fixed in world space as the planet orbits (so its real axial tilt
  // doesn't precess) — which means the direction "back toward the Sun",
  // expressed inside that counter-rotated subtree, does NOT stay fixed;
  // it appears to sweep around as Jupiter orbits. To make Jupiter always
  // lean toward the Sun regardless of where it currently is on its orbit,
  // `sunLeanTrack` re-applies the SAME rotation.y tiltAnchor is canceling
  // (kept updated every frame in animate(), single-axis only — same safe
  // pattern as tiltAnchor's own counter-rotation), which telescopes with
  // it back to identity: Ry(-orbitAngle) * Ry(+orbitAngle) = no rotation.
  // That restores this one small subtree's local -X axis as an always-
  // sun-facing radial direction, without affecting orbit math, orbit
  // speed, or pattern generation (tiltAnchor's position/counter-rotation,
  // pivot's revolution, and everything else are untouched).
  // `sunLean` (child of sunLeanTrack) then applies ONE constant, never-
  // animated rotation.z of 5° — tipping Jupiter's "up" slightly toward
  // that always-sun-facing -X direction. Purely visual: no lookAt(), no
  // billboarding, no camera-facing logic, no texture rotation, and
  // Jupiter's bands/orientation are otherwise unchanged.
  let sunLeanTrack = null;
  let rotationParent = tiltAnchor;
  if (data.type === 'jupiter') {
    sunLeanTrack = new THREE.Group();
    tiltAnchor.add(sunLeanTrack);

    const sunLean = new THREE.Group();
    sunLean.rotation.z = THREE.MathUtils.degToRad(5);
    sunLeanTrack.add(sunLean);

    rotationParent = sunLean;
  }

  // presentationGroup: the OUTERMOST rotation wrapper — deliberately
  // parented BEFORE (outside) axialTilt, not nested inside it. This order
  // matters: it carries a single clean X-axis "presentation angle" (see
  // PRESENTATION_ANGLES), applied as ONE rigid rotation to the ENTIRE
  // already-tilted planet+rings assembly beneath it — mathematically
  // equivalent to viewing the whole planet from a camera at a 30-45°
  // elevation, with no internal shearing.
  //
  // AUDIT FINDING: an EARLIER revision nested this the other way around
  // (axialTilt as the outer parent, presentationGroup as its inner child).
  // That ordering composes as Rz(realAxialTilt) * Rx(presentationAngle) —
  // the real axial tilt (which is large for Saturn ~27°, Uranus ~82°,
  // Neptune ~28°) gets applied AFTER, i.e. on top of, the presentation
  // tilt, additionally twisting/rolling the whole already-tilted sphere
  // around the world Z axis. That extra roll is what made Jupiter's bands
  // (very sensitive to even a few degrees of roll, being high-contrast
  // stripes), Saturn's rings, and Uranus/Neptune's spheres all look
  // rolled/diagonal. Swapping the order so presentationGroup wraps
  // axialTilt (world = Rx(presentation) * Rz(realTilt) * mesh) fixes this:
  // the real tilt is now baked into the LOCAL geometry first, and the
  // presentation tilt reorients that whole rigid result once, uniformly,
  // exactly like moving a camera around a static object.
  //
  // PHASE 1: ENABLE_PRESENTATION_TILT is false, so this stays at (0,0,0)
  // for every planet — a true canonical baseline (north pole up, equator
  // horizontal, zero roll) — while PRESENTATION_ANGLES itself remains
  // fully populated and ready for Phase 2.
  const presentation = ENABLE_PRESENTATION_TILT
    ? PRESENTATION_ANGLES[data.type] ?? { x: 0, y: 0, z: 0 }
    : { x: 0, y: 0, z: 0 };
  const presentationGroup = new THREE.Group();
  presentationGroup.rotation.set(
    THREE.MathUtils.degToRad(presentation.x ?? 0),
    THREE.MathUtils.degToRad(presentation.y ?? 0),
    THREE.MathUtils.degToRad(presentation.z ?? 0)
  );
  rotationParent.add(presentationGroup);

  // Axial tilt lives on its OWN group, set once and never touched again —
  // deliberately kept off the mesh itself. If a mesh's rotation.z (tilt)
  // and rotation.y (spin) were both animated on the SAME Object3D, Three.js
  // would recompute a fresh Euler-XYZ matrix each frame from that (0, y, z)
  // triple, which composes as Rz(tilt) * Ry(spin): the "spin" term rotates
  // around the ORIGINAL fixed Y-axis, then the WHOLE thing (spin included)
  // gets tilted afterwards — so the sphere's spin axis itself sweeps a
  // cone every frame, visible as a wobble/precession on any planet with a
  // textured surface. Parenting the tilt on its own static group and only
  // ever animating mesh.rotation.y correctly carries the spin axis along
  // with the tilt instead, producing a clean, stable rotation.
  //
  // Real tilt is skipped (stays 0) when DISABLE_REAL_AXIAL_TILT is true —
  // data.tilt itself is untouched/unread in that case, ready to be
  // reinstated for a future scientific mode by flipping that one flag.
  const axialTilt = new THREE.Group();
  axialTilt.rotation.z = DISABLE_REAL_AXIAL_TILT ? 0 : THREE.MathUtils.degToRad(data.tilt ?? 15);
  presentationGroup.add(axialTilt);

  const surface = buildSurfaceTexture(data);
  const preset = MATERIAL_PRESETS[data.type];

  const geometry = new THREE.SphereGeometry(data.radius, 64, 64);
  const materialOptions = {
    map: surface.map,
    roughness: preset.roughness,
    metalness: preset.metalness,
  };
  if (surface.roughnessMap) materialOptions.roughnessMap = surface.roughnessMap;

  const material = new THREE.MeshStandardMaterial(materialOptions);
  const mesh = new THREE.Mesh(geometry, material);

  // planetContainer: innermost wrapper, fully decoupled from orbit motion
  // (pivot). It applies ONLY the named, single-purpose SCIENTIFIC baseline
  // correction from `planetOrientation` (currently empty/identity for
  // every planet — see that config's comment for why). It never affects
  // position, orbit speed, or orbit ring alignment, and is set once here
  // (never animated), so there's no per-frame wobble risk.
  const orientation = planetOrientation[data.type] ?? {};
  const planetContainer = new THREE.Group();
  planetContainer.rotation.set(
    THREE.MathUtils.degToRad(orientation.x ?? 0),
    THREE.MathUtils.degToRad(orientation.y ?? 0),
    THREE.MathUtils.degToRad(orientation.z ?? 0)
  );
  // No non-uniform scale — every planet is a true, perfectly spherical
  // THREE.SphereGeometry at uniform scale (1,1,1). Only Saturn's separate
  // ring mesh is flattened (that's real ring geometry, not the sphere).
  planetContainer.add(mesh);
  axialTilt.add(planetContainer);

  let clouds = null;
  if (data.hasClouds) {
    // Clouds stay a child of mesh so they still inherit the SAME axial
    // tilt + presentation angle automatically, while preserving mesh's
    // independent self-rotation as their parent — this is what lets
    // clouds drift slightly faster than the surface for a parallax effect
    // (see animate()) whenever self-rotation is enabled.
    clouds = createCloudLayer(data.radius, surface.cloudMap);
    mesh.add(clouds);
  }

  if (data.hasAtmosphere) {
    mesh.add(createAtmosphere(data.radius));
  }

  if (data.hasRings) {
    // Rings are parented to axialTilt (a SIBLING of planetContainer) —
    // they inherit Saturn's real equatorial tilt AND the outer presentation
    // angle (both correctly composed, no roll), so they stay aligned with
    // Saturn's actual equator and never appear edge-on, but stay
    // independent of mesh's own self-rotation, so the ring plane never
    // spins with the planet's fast per-frame rotation.y.
    axialTilt.add(createSaturnRings(data.radius));
  }

  // Moon: parented directly to `axialTilt` (a SIBLING of planetContainer, NOT
  // a child of mesh) so its orbit is completely independent of Earth's own
  // self-rotation/spin — exactly like the planet/Sun relationship, just one
  // level down. `moonPivot` is deliberately given NO counter-rotation (unlike
  // `tiltAnchor` above, which cancels its own spin to prevent precession):
  // leaving the Moon mesh's local rotation untouched means it rigidly
  // rotates along with moonPivot's increasing rotation.y every frame, which
  // is exactly real tidal locking — the same face of the Moon always faces
  // Earth, for free, with no extra per-frame code.
  let moonPivot = null;
  if (data.hasMoon) {
    moonPivot = createMoon();
    axialTilt.add(moonPivot);
  }

  return { pivot, tiltAnchor, sunLeanTrack, presentationGroup, axialTilt, planetContainer, mesh, clouds, moonPivot, data, angle };
}

// Dispatches to the right real-texture loader per planet type. Returns
// { map, roughnessMap?, cloudMap? }. Every planet uses a real, licensed
// equirectangular photographic/elevation texture map (see TEXTURE_PATHS)
// loaded via THREE.TextureLoader — no procedural/gradient surfaces.
function buildSurfaceTexture(data) {
  switch (data.type) {
    case 'mercury': return { map: loadPlanetTexture('mercury') };
    case 'venus': return { map: loadPlanetTexture('venus') };
    case 'earth': return { map: loadPlanetTexture('earth'), cloudMap: loadPlanetTexture('earthClouds', { srgb: false }) };
    case 'mars': return { map: loadPlanetTexture('mars') };
    case 'jupiter': return { map: loadPlanetTexture('jupiter') };
    case 'saturn': return { map: loadPlanetTexture('saturn') };
    case 'uranus': return { map: loadPlanetTexture('uranus') };
    case 'neptune': return { map: loadPlanetTexture('neptune') };
    default: return { map: loadPlanetTexture('mercury') };
  }
}

// Earth's cloud layer: a real cloud-density photograph used as a luminance
// alphaMap (bright = opaque cloud, dark = transparent) over a plain white
// diffuse color, rather than a procedurally-painted swirl texture.
function createCloudLayer(planetRadius, cloudMap) {
  const geometry = new THREE.SphereGeometry(planetRadius * 1.03, 64, 64);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    alphaMap: cloudMap,
    transparent: true,
    depthWrite: false,
    roughness: 1,
  });
  return new THREE.Mesh(geometry, material);
}

// Fresnel-based atmosphere glow — brighter at the grazing edge, transparent
// facing the camera, giving Earth a believable thin blue rim of air.
function createAtmosphere(planetRadius) {
  const geometry = new THREE.SphereGeometry(planetRadius * 1.06, 64, 64);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0x5fa8ff) },
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.5 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.5);
        gl_FragColor = vec4(glowColor, clamp(intensity, 0.0, 1.0) * 0.55);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}

// Earth's Moon: a small rocky sphere with the same real-texture-map +
// MeshStandardMaterial recipe as every other body (see MATERIAL_PRESETS.moon
// / TEXTURE_PATHS.moon), sitting inside its own orbit-pivot group at
// MOON_CONFIG.distance so animate() only ever has to touch one rotation.y
// per frame (the pivot's) to advance its orbit.
function createMoon() {
  const moonPivot = new THREE.Group();
  // Random starting angle, same reasoning as each planet's own orbit pivot.
  moonPivot.rotation.y = Math.random() * Math.PI * 2;

  const geometry = new THREE.SphereGeometry(MOON_CONFIG.radius, 48, 48);
  const material = new THREE.MeshStandardMaterial({
    map: loadPlanetTexture('moon'),
    roughness: MATERIAL_PRESETS.moon.roughness,
    metalness: MATERIAL_PRESETS.moon.metalness,
  });
  const moonMesh = new THREE.Mesh(geometry, material);
  moonMesh.position.set(MOON_CONFIG.distance, 0, 0);
  moonPivot.add(moonMesh);

  return moonPivot;
}

// Saturn's ring system — a real ring texture (color + alpha baked into one
// horizontal gradient strip, including the Cassini Division gap), mapped
// radially across a flat RingGeometry.
function createSaturnRings(planetRadius) {
  // Real Saturn's rings begin very close to the cloud tops (~1.11 planet
  // radii) and end around ~2.3 radii — a wide gap here reads as a solid
  // black "moat" rather than a translucent ring.
  const innerRadius = planetRadius * 1.15;
  const outerRadius = planetRadius * 2.3;
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 128, 1);

  // RingGeometry UVs are radial; remap so the ring texture (a 1D strip
  // spanning inner->outer radius, including its own alpha channel) reads
  // cleanly across the ring's span instead of radiating from the center.
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const v3 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    const distance = v3.length();
    const t = (distance - innerRadius) / (outerRadius - innerRadius);
    uv.setXY(i, t, 1);
  }
  uv.needsUpdate = true;

  const material = new THREE.MeshStandardMaterial({
    map: loadPlanetTexture('saturnRing', { srgb: false }),
    side: THREE.DoubleSide,
    transparent: true,
    roughness: 1,
  });

  const rings = new THREE.Mesh(geometry, material);
  // RingGeometry lies flat in the local XY plane by default; rotate 90° so
  // it instead lies in the equatorial (XZ) plane. The ring is parented to
  // axialTilt (see createPlanet), which already carries Saturn's ~27°
  // axial tilt and travels with the planet, but does NOT spin along with
  // Saturn's own fast rotation — keeping the ring plane visually stable
  // instead of appearing to rotate with the surface texture.
  rings.rotation.x = THREE.MathUtils.degToRad(90);
  return rings;
}

// ----------------------------------------------------------------------------
// Orbit lines — each ring is tinted to match its own planet's dominant hue
// (instead of one flat neutral gray-blue for all eight) and rendered with
// additive blending for a soft, "energy ring" glow against the dark
// starfield. Built with the same LineSegments2/LineMaterial "fat line"
// technique as the pattern tracer below, so the stroke stays a crisp,
// consistent screen-space width regardless of zoom or device pixel ratio
// (plain THREE.Line ignores linewidth on most GPUs/platforms). See
// ORBIT_RING_COLOR / orbitLineMaterials near the top of the file.
// ----------------------------------------------------------------------------
function createOrbitLine(radius) {
  const segments = 128;
  // LineSegmentsGeometry expects flat (x,y,z) pairs per segment — end of
  // segment i is the start of segment i+1, closing the loop back to theta=0.
  const positions = [];
  for (let i = 0; i < segments; i++) {
    const theta0 = (i / segments) * Math.PI * 2;
    const theta1 = ((i + 1) / segments) * Math.PI * 2;
    positions.push(
      Math.cos(theta0) * radius, 0, Math.sin(theta0) * radius,
      Math.cos(theta1) * radius, 0, Math.sin(theta1) * radius
    );
  }

  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);

  // Plain (non-additive) blending + a single uniform grey — thin, quiet
  // reference lines rather than glowing colored rings, so they never
  // compete with the planets or the pattern-tracer lines for attention.
  const material = new LineMaterial({
    color: ORBIT_RING_COLOR,
    transparent: true,
    opacity: 0.18,
    linewidth: 0.75, // screen-space pixels, since worldUnits defaults to false
    depthWrite: false,
  });
  material.resolution.set(window.innerWidth, window.innerHeight);
  orbitLineMaterials.push(material);

  const line = new LineSegments2(geometry, material);
  line.frustumCulled = false;
  return line;
}

// ============================================================================
// Orbital Harmony pattern tracer — reveals the geometric figure formed by
// the line connecting two "active" planets as they orbit. A new chord is
// appended only once per simulated calendar interval (see PATTERN_CONFIG
// above) — NOT once per rendered frame — so the resulting geometry is
// sparse, legible, and independent of frame rate. Every trailing line is
// retained permanently once drawn (never overwritten); once PATTERN_CAPACITY
// is reached, new chords simply stop being added rather than recycling
// older ones.
//
// Rendered with Line2/LineSegments2 (three.js's "fat lines" addon) rather
// than plain LineBasicMaterial, because standard WebGL line rendering
// ignores `linewidth` on most platforms — the control panel's "Line
// Thickness" slider would otherwise silently do nothing.
// ============================================================================

// Builds one big pre-allocated buffer (holding up to PATTERN_CAPACITY
// chords) so we never reallocate the underlying typed array at runtime —
// just write new vertex data into it and re-upload via setPositions().
function createPatternTracer() {
  patternPositions = new Float32Array(PATTERN_CAPACITY * 2 * 3); // 2 points, 3 floats each

  const geometry = new LineSegmentsGeometry();
  // Allocate the full buffer ONCE, at fixed capacity. Calling setPositions()
  // again later with a different-sized array (e.g. once per new trace line)
  // causes GPU buffer/instance-count mismatches ("vertex buffer is not big
  // enough for the draw call"). Instead, frequent updates mutate this same
  // buffer in place and reveal new segments via `instanceCount` — the
  // instanced-rendering equivalent of BufferGeometry's setDrawRange().
  geometry.setPositions(patternPositions);
  geometry.instanceCount = 0;

  // Thin, elegant, near-white lines at full opacity — deliberately no
  // bright/saturated colors so the emerging geometry reads as scientific
  // rather than decorative. `dashed` is left permanently enabled so the
  // "Line Style" control (solid/dashed/dots) only ever has to tweak the
  // dashSize/gapSize NUMBERS (plain uniforms, safe to change any time) —
  // never the `dashed` boolean itself, which is a compile-time define that
  // would need a costly shader recompile (material.needsUpdate) to toggle.
  // gapSize: 0 (the "solid" default) simply never opens a visible gap.
  const material = new LineMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    linewidth: 1, // in pixels (screen-space), since worldUnits defaults to false
    depthWrite: false,
    dashed: true,
    dashScale: 1,
    dashSize: LINE_STYLES.solid.dashSize,
    gapSize: LINE_STYLES.solid.gapSize,
  });
  material.resolution.set(window.innerWidth, window.innerHeight);

  patternLines = new LineSegments2(geometry, material);
  patternLines.frustumCulled = false;
  scene.add(patternLines);
}

// Earth completes exactly one full revolution (2π radians of pivot
// rotation) per simulated year, by definition — so its accumulated orbital
// angle gives us a frame-rate-independent simulated calendar for free,
// without needing a separate "sim time" clock to keep in sync.
function getSimulatedDays() {
  const earth = planets.find((p) => p.data.name === 'Earth');
  if (!earth) return 0;
  const simulatedYears = earth.pivot.rotation.y / (Math.PI * 2);
  return simulatedYears * DAYS_PER_YEAR;
}

// Appends one new chord (whichever two planets are "active") to the buffer
// in place and reveals it via instanceCount. Called only when the simulated
// calendar has advanced by traceInterval days. Once PATTERN_CAPACITY is
// reached, older lines are NEVER overwritten — every trailing line stays on
// screen permanently; new chords simply stop being added.
function updatePatternTracer() {
  if (patternLineCount >= PATTERN_CAPACITY) return; // buffer full — retain everything already drawn

  const active = planets.filter((p) => p.data.active);
  if (active.length !== 2) return; // pattern is only defined for exactly two active planets

  active[0].mesh.getWorldPosition(_patternPosA);
  active[1].mesh.getWorldPosition(_patternPosB);

  const base = patternLineCount * 6;
  patternPositions[base] = _patternPosA.x;
  patternPositions[base + 1] = _patternPosA.y;
  patternPositions[base + 2] = _patternPosA.z;
  patternPositions[base + 3] = _patternPosB.x;
  patternPositions[base + 4] = _patternPosB.y;
  patternPositions[base + 5] = _patternPosB.z;

  patternLineCount++;

  // instanceStart & instanceEnd are two views over the SAME InterleavedBuffer
  // (see LineSegmentsGeometry.setPositions), so flagging one is enough.
  patternLines.geometry.attributes.instanceStart.data.needsUpdate = true;
  patternLines.geometry.instanceCount = patternLineCount;
  // Required for the dashed/dotted line styles — recomputes the
  // instanceDistanceStart/End attribute the dashed shader reads from.
  // NOTE: this is a method on the LineSegments2 *mesh* (added for
  // backwards-compatibility with Line2), not on its geometry — calling it on
  // `.geometry` silently throws (`computeLineDistances is not a function`).
  patternLines.computeLineDistances();
}

// Sets which two planets are traced, based on the current planetASelection
// / planetBSelection control-panel state.
function applyActivePlanets() {
  planets.forEach((planet) => {
    planet.data.active = planet.data.name === planetASelection || planet.data.name === planetBSelection;
  });
}

// Wipes the accumulated pattern (used by "Clear Pattern" / "Generate
// Pattern", and whenever simulationYears/traceInterval change and the
// buffer needs to be resized).
function clearPatternBuffer() {
  patternLineCount = 0;
  lastTraceSimDay = getSimulatedDays();
  if (patternLines) {
    patternLines.geometry.instanceCount = 0;
  }
}

// Recomputes PATTERN_CAPACITY from the current PATTERN_CONFIG and
// reallocates the pattern buffer accordingly. Called by the control
// panel's Years Simulated / Trace Interval sliders. This is the one place
// setPositions() is called again after initial creation — an infrequent,
// explicit user action, not a per-frame operation, so a full reallocation
// here is safe and simple.
function rebuildPatternCapacity() {
  PATTERN_CAPACITY = computePatternCapacity();
  patternPositions = new Float32Array(PATTERN_CAPACITY * 2 * 3);
  if (patternLines) {
    patternLines.geometry.setPositions(patternPositions);
  }
  clearPatternBuffer();
}



//   2) finalComposer  — renders the full scene normally, additively blends
//      in the Sun's bloom texture, then applies cinematic color grading
//      (contrast/saturation/teal-orange tint/vignette) and outputs to screen.
// ----------------------------------------------------------------------------
function setupPostProcessing(r, s, cam) {
  const size = new THREE.Vector2(window.innerWidth, window.innerHeight);

  bloomComposer = new EffectComposer(r);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(new RenderPass(s, cam));
  bloomComposer.addPass(new UnrealBloomPass(size, 0.32, 0.18, 0.9));

  const mixPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D baseTexture;
        uniform sampler2D bloomTexture;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(baseTexture, vUv) + vec4(1.0) * texture2D(bloomTexture, vUv);
        }
      `,
      defines: {},
    }),
    'baseTexture'
  );
  mixPass.needsSwap = true;

  colorGradePass = new ShaderPass(createColorGradeShader());

  // Color grading must run AFTER tone-mapping/encoding (OutputPass), since it
  // assumes display-referred [0,1] data. Running it on linear HDR values
  // would push near-zero background pixels slightly negative and, once
  // ACES-tonemapped, that shows up as an unwanted color cast across the
  // whole frame.
  finalComposer = new EffectComposer(r);
  finalComposer.addPass(new RenderPass(s, cam));
  finalComposer.addPass(mixPass);
  finalComposer.addPass(new OutputPass());
  finalComposer.addPass(colorGradePass);
}

// Cinematic color grade: gentle contrast/saturation boost, subtle
// teal-shadow / warm-highlight split-tone, and a soft vignette.
function createColorGradeShader() {
  return {
    uniforms: {
      tDiffuse: { value: null },
      contrast: { value: 1.08 },
      saturation: { value: 1.12 },
      vignetteStrength: { value: 0.35 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float contrast;
      uniform float saturation;
      uniform float vignetteStrength;
      varying vec2 vUv;

      void main() {
        vec4 color = texture2D(tDiffuse, vUv);
        color.rgb = clamp(color.rgb, 0.0, 1.0);

        // Contrast
        color.rgb = (color.rgb - 0.5) * contrast + 0.5;

        // Saturation
        float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        color.rgb = mix(vec3(gray), color.rgb, saturation);

        // Cinematic split-tone: cool shadows, warm highlights
        vec3 shadowTint = vec3(-0.01, 0.0, 0.015);
        vec3 highlightTint = vec3(0.02, 0.01, -0.015);
        float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        color.rgb += mix(shadowTint, highlightTint, luma);

        // Vignette
        vec2 uv = vUv - 0.5;
        float vig = 1.0 - dot(uv, uv) * vignetteStrength;
        color.rgb *= vig;

        color.rgb = clamp(color.rgb, 0.0, 1.0);
        gl_FragColor = color;
      }
    `,
  };
}

// ----------------------------------------------------------------------------
// Selective bloom helpers — temporarily replace non-bloom materials with
// solid black so the bloom pass only "sees" the Sun. This must cover every
// renderable type (meshes, lines, points) — missing the pattern-tracer
// LineSegments here previously let thousands of additive-blended chords
// feed straight into the bloom pass and blow out to solid white.
// ----------------------------------------------------------------------------
function darkenNonBloomed(obj) {
  if (obj.material && bloomLayer.test(obj.layers) === false) {
    materialCache.set(obj.uuid, obj.material);
    obj.material = darkMaterial;
  }
}

function restoreMaterial(obj) {
  if (materialCache.has(obj.uuid)) {
    obj.material = materialCache.get(obj.uuid);
    materialCache.delete(obj.uuid);
  }
}

// ----------------------------------------------------------------------------
// Animation loop
// ----------------------------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  // Simulation speed/pause affect orbital motion & pattern tracing only —
  // the camera fly-in and OrbitControls damping keep running regardless,
  // so pausing the simulation never freezes the viewer's own navigation.
  const simDelta = isPaused ? 0 : delta * simulationSpeedMultiplier;

  // Smooth cinematic camera fly-in on load, then hand off to OrbitControls
  if (introElapsed < introDuration) {
    introElapsed += delta;
    const t = Math.min(introElapsed / introDuration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    camera.position.lerpVectors(introStart, introEnd, eased);
  }

  planets.forEach((planet) => {
    // Orbit around the Sun (all planets orbit the same direction — prograde)
    // — always active, regardless of TOP_VIEW_PATTERN_MODE, since orbital
    // revolution is the whole point of the pattern generator.
    planet.pivot.rotation.y += simDelta * 0.15 * planet.data.speed;
    // Counter-rotate the tilt anchor so the axial tilt stays fixed in world
    // space as the planet revolves, instead of precessing with the orbit.
    planet.tiltAnchor.rotation.y = -planet.pivot.rotation.y;
    // Jupiter-only: re-apply the SAME rotation tiltAnchor just canceled,
    // so this one small subtree (the "lean toward the Sun", see
    // createPlanet()) tracks the current orbital angle instead of staying
    // world-fixed — telescoping back to identity with tiltAnchor's
    // counter-rotation, so the lean's local -X axis always points at the
    // Sun regardless of where Jupiter currently is on its orbit.
    if (planet.sunLeanTrack) planet.sunLeanTrack.rotation.y = planet.pivot.rotation.y;
    // Moon: orbits Earth via its own pivot, always active regardless of
    // TOP_VIEW_PATTERN_MODE — exactly like planet.pivot's own revolution
    // around the Sun above, just one level down. No counter-rotation is
    // applied (see createMoon()/createPlanet() comments), so this single
    // line also produces the Moon's real tidal-locked spin for free.
    if (planet.moonPivot) planet.moonPivot.rotation.y += simDelta * MOON_CONFIG.orbitSpeedMultiplier;
    // Self-rotation (spin) is skipped entirely in TOP_VIEW_PATTERN_MODE so
    // each planet's texture stays a stable, readable marker from the fixed
    // top-down camera instead of continuously spinning — set
    // TOP_VIEW_PATTERN_MODE to false to restore realistic axial spin.
    if (!TOP_VIEW_PATTERN_MODE) {
      // Spin on its own axis (Venus spins retrograde, so its sign is flipped)
      planet.mesh.rotation.y += simDelta * 60 * planet.data.rotationSpeed * (planet.data.spinDirection ?? 1);
      // Clouds drift slightly faster than the surface for a parallax effect
      if (planet.clouds) planet.clouds.rotation.y += simDelta * 60 * planet.data.rotationSpeed * 1.4 * (planet.data.spinDirection ?? 1);
    }
  });

  // Slow, stable self-rotation for the Sun's photosphere texture — same
  // single-axis (rotation.y only) pattern used for planet spin, so there's
  // no tilt/spin Euler-composition wobble risk (the Sun has no axial tilt
  // group at all, so this is even simpler than the planets' case). Also
  // skipped in TOP_VIEW_PATTERN_MODE for the same "stable, readable marker"
  // reasoning as the planets above.
  if (sunMesh && !TOP_VIEW_PATTERN_MODE) sunMesh.rotation.y += simDelta * 0.03;

  // Advance the starfield's twinkle uniform — driven by real elapsed time
  // (not simDelta), so stars keep gently twinkling even while the
  // simulation itself is paused, just like a real night sky.
  starfieldTime += delta;
  if (starfieldMaterial) starfieldMaterial.uniforms.uTime.value = starfieldTime;

  // Gently "breathe" the Sun's corona layers so the glow feels alive rather
  // than a static halo — each layer pulses at its own speed/phase so the
  // glow shimmers organically instead of pumping in lockstep.
  sunPulseTime += delta;
  sunCorona.forEach(({ sprite, baseScale, baseOpacity, speed, phase }) => {
    const wave = Math.sin(sunPulseTime * speed + phase);
    const scale = baseScale * (1 + wave * 0.06);
    sprite.scale.set(scale, scale, 1);
    sprite.material.opacity = baseOpacity * (1 + wave * 0.18);
  });

  // Trace a new chord only once the simulated calendar has advanced by
  // traceInterval days — decoupled from render frame rate, so the
  // pattern's geometry is identical regardless of FPS. Gated on
  // isGenerating so nothing accumulates until "Generate Pattern" is clicked.
  const simDay = getSimulatedDays();
  if (isGenerating && simDay - lastTraceSimDay >= PATTERN_CONFIG.traceInterval) {
    lastTraceSimDay = simDay;
    updatePatternTracer();
  }

  controls.update();

  // Render pass 1: bloom-only pass (darken everything except the Sun)
  scene.traverse(darkenNonBloomed);
  bloomComposer.render();
  scene.traverse(restoreMaterial);

  // Render pass 2: full scene + additive bloom + color grade
  finalComposer.render();
}

// ----------------------------------------------------------------------------
// Responsive canvas
// ----------------------------------------------------------------------------
// Reads the canvas's own CSS-computed size (not window.innerWidth/innerHeight)
// so the 3D view correctly shrinks to leave dedicated space for the control
// panel (see #app's width rule in style.css) instead of the panel floating
// on top of, and hiding, part of the scene.
//
// Simply recomputing `camera.aspect` from the narrower canvas would keep
// shapes undistorted, but it also narrows the HORIZONTAL field of view —
// visually "compressing" the composition and clipping planets (Neptune,
// Uranus, Saturn...) near the panel edge that used to comfortably fit in
// frame. To avoid that, we keep the horizontal FOV constant (matching the
// full, un-shrunk window) and compensate by adjusting the *vertical* FOV
// instead — so the same amount of world stays visible left-to-right no
// matter how much width the panel currently reserves; only the framing
// gets a bit taller, never narrower.
function onWindowResize() {
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const currentAspect = width / height;

  if (camera.isOrthographicCamera) {
    // No FOV to compensate for — an OrthographicCamera's "zoom level" is
    // just the frustum's half-height, kept fixed; only the half-width
    // needs to track the current aspect ratio so circles stay circles
    // (never stretched/squashed) at any canvas size.
    const halfHeight = ORTHO_VIEW_HALF_HEIGHT;
    camera.left = -halfHeight * currentAspect;
    camera.right = halfHeight * currentAspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
  } else {
    const referenceAspect = window.innerWidth / window.innerHeight;
    const baseHorizontalFovRad =
      2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(BASE_VERTICAL_FOV_DEG) / 2) * referenceAspect);
    const compensatedVerticalFovRad = 2 * Math.atan(Math.tan(baseHorizontalFovRad / 2) / currentAspect);
    camera.fov = THREE.MathUtils.radToDeg(compensatedVerticalFovRad);
    camera.aspect = currentAspect;
  }
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  bloomComposer.setSize(width, height);
  finalComposer.setSize(width, height);
  if (patternLines) patternLines.material.resolution.set(width, height);
  orbitLineMaterials.forEach((m) => m.resolution.set(width, height));
}

// ============================================================================
// Public control API — consumed by js/ui.js (the floating control panel).
// Keeping this as a single exported object means the 3D engine never needs
// to know anything about DOM elements, and the UI layer never touches
// Three.js internals directly.
// ============================================================================
export const PLANET_NAMES = PLANET_DATA.map((d) => d.name);
export const DEFAULT_PLANET_A = planetASelection;
export const DEFAULT_PLANET_B = planetBSelection;

export const api = {
  // --- Celestial bodies ---
  setPlanetA(name) {
    planetASelection = name;
    applyActivePlanets();
    // Changing the pair invalidates whatever was being traced — require an
    // explicit "Generate Pattern" click to start tracing the new pair.
    isGenerating = false;
    clearPatternBuffer();
  },
  setPlanetB(name) {
    planetBSelection = name;
    applyActivePlanets();
    isGenerating = false;
    clearPatternBuffer();
  },

  // --- Simulation ---
  setSimulationSpeed(multiplier) {
    simulationSpeedMultiplier = multiplier;
  },
  setTraceInterval(days) {
    PATTERN_CONFIG.traceInterval = days;
    rebuildPatternCapacity();
  },
  pauseSimulation() {
    isPaused = true;
  },
  resumeSimulation() {
    isPaused = false;
  },
  isPaused() {
    return isPaused;
  },
  // Read-only snapshot consumed by the Viewer panel — never mutates state.
  getPatternStats() {
    return {
      lineCount: patternLineCount,
      capacity: PATTERN_CAPACITY,
      completion: PATTERN_CAPACITY > 0 ? patternLineCount / PATTERN_CAPACITY : 0,
      simulatedYears: getSimulatedDays() / DAYS_PER_YEAR,
      isPaused,
    };
  },

  // --- Visualization ---
  // style: 'solid' | 'dashed' | 'dots' — see LINE_STYLES. Only touches the
  // dashSize/gapSize uniforms (never the `dashed` boolean itself, which
  // stays permanently true from creation), so this is safe to call any
  // time with no shader recompile.
  setLineStyle(style) {
    const preset = LINE_STYLES[style] ?? LINE_STYLES.solid;
    patternLines.material.dashSize = preset.dashSize;
    patternLines.material.gapSize = preset.gapSize;
  },

  // --- Actions ---
  generatePattern() {
    applyActivePlanets();
    clearPatternBuffer();
    isPaused = false;
    isGenerating = true;
  },
  clearPattern() {
    // Also stop generation (not just wipe the buffer) — otherwise, if
    // "Generate" had been clicked previously, tracing would silently
    // resume on its own right after clearing instead of staying idle
    // until the user explicitly clicks "Generate" again.
    isGenerating = false;
    clearPatternBuffer();
  },

  // Called by the UI while the control panel's open/close CSS transition is
  // playing, so the 3D viewport smoothly resizes alongside it instead of
  // only snapping to the correct size once the animation finishes.
  syncViewportSize() {
    onWindowResize();
  },
};
