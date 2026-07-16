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
import { currentOrbitAngleRad } from '../utils/currentPosition.js';

const DAYS_PER_YEAR = 365.25;
// The cinematic browse-screen camera path holds on a true top-down shot
// (matching the loading screen's overview), then slowly ROTATES down to a
// more angled, dimensional view — see HERO_ELEVATION_START_DEG/
// HERO_ELEVATION_END_DEG below. Distance/frustum/no-zoom are unchanged.
const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

function loadTexture(path, { srgb = true, saturate = false } = {}) {
  const cacheKey = saturate ? `${path}::sat` : path;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);
  const tex = textureLoader.load(path, saturate ? boostTextureSaturation : undefined);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set(cacheKey, tex);
  return tex;
}

// Redraws a loaded texture's image through a canvas 2D `filter` (saturate +
// a touch of contrast) so planets read as more vivid/colorful on-screen —
// cheap, one-time, no full post-processing/bloom pipeline needed (this
// project deliberately avoids that for bundle simplicity). Runs once per
// texture right after its image finishes loading (passed as the
// TextureLoader `onLoad` callback, which receives the Texture itself), then
// swaps `texture.image` to the boosted canvas and flags `needsUpdate` so
// Three.js re-uploads the adjusted pixels to the GPU.
function boostTextureSaturation(texture, amount = 1.4) {
  const img = texture.image;
  if (!img || !img.width) return;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.filter = `saturate(${amount * 100}%) contrast(106%)`;
  ctx.drawImage(img, 0, 0);
  texture.image = canvas;
  texture.needsUpdate = true;
}

// A soft radial-gradient sprite used for the Sun's glow — cheap, no
// post-processing bloom pipeline required.
function makeGlowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,250,225,0.95)');
  gradient.addColorStop(0.35, 'rgba(255,210,130,0.5)');
  gradient.addColorStop(1, 'rgba(255,160,70,0)');
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

// A small, soft circular sprite for star points — WITHOUT this, a plain
// THREE.PointsMaterial with no map always rasterizes as a hard-edged
// SQUARE, which reads as an artificial grid of little boxes rather than
// glowing points of light. A tight radial gradient (bright core fading to
// fully transparent) is the cheapest way to make every star read as a
// soft, natural glow instead.
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

function buildStarLayer(count, minR, maxR, size, opacity) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = minR + Math.random() * (maxR - minR);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi));
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    // Per-star brightness variation (0.45-1.0) via vertex color — reads as
    // a natural scatter of stronger/weaker stars instead of one uniform
    // dot size/brightness repeated identically everywhere.
    const b = 0.45 + Math.random() * 0.55;
    colors[i * 3] = b;
    colors[i * 3 + 1] = b;
    colors[i * 3 + 2] = b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    // Very slightly warm-white (never blue) — plain #ffffff read a touch
    // cold/blue-ish once blended with the pitch-black background.
    color: 0xfff6ea,
    vertexColors: true,
    map: makeStarSprite(),
    size,
    transparent: true,
    opacity,
    // Additive so overlapping/near-touching stars blend into a soft glow
    // instead of a flat alpha-blended disc — reads as actual light rather
    // than a painted dot.
    blending: THREE.AdditiveBlending,
    // OFF, not the default true: with sizeAttenuation on, a point's ON-
    // SCREEN size scales with its distance from the camera exactly like a
    // real 3D object would — but these shells sit 900-1700 world units out
    // while the camera itself only ever sits ~100-300 units away, so the
    // apparent size collapsed to a sub-pixel, invisible speck. Real stars
    // are effectively at infinity and don't visibly shrink as the camera
    // dollies a few hundred units, so a FIXED screen-space size (constant
    // regardless of distance) is both the fix and the more physically
    // honest choice here.
    sizeAttenuation: false,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

// Three depth layers (far/dim -> near/bright) read as a much denser, more
// realistic field than one uniform layer of points. Each layer is later
// given its own slow, independent rotation in tick() — a cheap stand-in
// for parallax depth since the camera itself never pans, only zooms.
function buildStarfield() {
  // Shell radii are deliberately kept well beyond both the wide AND close
  // hero camera distances (~200-500 units) so no star ever renders closer
  // to the camera than the solar system itself — otherwise sizeAttenuation
  // blows a "nearby" star up into a large, distracting square. Sizes are
  // small fixed screen-space pixel counts now (see buildStarLayer) rather
  // than world units, tuned for a natural, subtly glowing scatter instead
  // of a dense/artificial-looking field.
  const group = new THREE.Group();
  const far = buildStarLayer(2400, 900, 1700, 2.2, 0.65);
  const mid = buildStarLayer(1300, 650, 950, 3, 0.75);
  const near = buildStarLayer(220, 480, 680, 3.8, 0.9);
  far.userData.spin = 0.0015;
  mid.userData.spin = 0.003;
  near.userData.spin = 0.005;
  group.add(far, mid, near);
  return group;
}

// Unlit (the Sun is a light source, not something lit by scene lights) but
// shaded with a simple view-dependent term for physical believability: a
// gentle limb darkening across the disc (real photospheres read darker at
// the edge than the center) plus a thin warm brightening right at the
// silhouette edge (a cheap stand-in for the chromosphere/corona). ALSO
// (per request) a strong warm CORE glow that brightens toward the center
// of the disc — the opposite falloff direction from the limb/edge terms —
// plus a slow brightness pulse, so the light reads as radiating outward
// from WITHIN the surface itself rather than relying on the external
// additive glow sprites layered behind it (see buildSunGlowSprites) to do
// all the work. Reads as genuine solar surface detail/light emission,
// not a flat, evenly-lit texture with a bolted-on halo.
function makeSunMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: loadTexture(SUN_TEXTURE) },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      void main() {
        vUv = uv;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform float time;
      varying vec2 vUv;
      varying vec3 vNormalView;
      void main() {
        vec3 base = texture2D(map, vUv).rgb;
        float rim = clamp(1.0 - abs(vNormalView.z), 0.0, 1.0);
        float limbDarken = 1.0 - 0.32 * pow(rim, 1.5);
        vec3 color = base * limbDarken;

        // Layered, slightly irregular breathing pulse (two sine waves at
        // different frequencies/phases, rather than one perfectly uniform
        // sine) — reads as a living, faintly turbulent light source
        // instead of a mechanically-even blink.
        float pulse = 0.93 + 0.05 * sin(time * 0.6) + 0.03 * sin(time * 1.7 + 1.3);

        // Fine-grained procedural flicker across the surface — a cheap
        // trig-based pseudo-noise standing in for solar granulation/
        // convection cells, so the inner glow doesn't read as a perfectly
        // flat, uniform wash of light but as roiling plasma welling up
        // from within.
        float grain = sin(vUv.x * 42.0 + time * 1.4) * sin(vUv.y * 39.0 - time * 1.1);
        float flicker = 0.92 + 0.08 * grain;

        // Warm CORE glow — brightens toward the CENTER of the disc
        // (1.0 - rim, the opposite direction from the limb darkening and
        // edge glow below), as if light were welling up from inside the
        // surface rather than just being lit from outside. Lower exponent
        // + higher strength than before so the inner glow reaches further
        // across the disc and reads unmistakably as an internal light
        // source, not just a subtle center highlight. Kept close to
        // yellow-white (not deep orange) so the Sun reads as a genuinely
        // hot, bright star rather than a dim reddish body (users flagged
        // an earlier, more-orange version as looking "almost like Mars").
        float coreGlow = pow(1.0 - rim, 1.6);
        color += vec3(1.0, 0.93, 0.72) * coreGlow * 1.0 * pulse * flicker;
        // Overall brightening so the whole disc reads as radiant/emissive,
        // not just a photograph of a lit sphere.
        color *= 1.4 * pulse;

        float edgeGlow = pow(rim, 7.0) * 0.55;
        color += vec3(1.0, 0.78, 0.52) * edgeGlow;
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

function buildPlanet(data) {
  const pivot = new THREE.Group();
  // Real current orbital position (see utils/currentPosition.js) instead
  // of a random angle — planets now start roughly where they actually are
  // in their real orbits right now, relative to each other.
  const startAngle = currentOrbitAngleRad(data);
  pivot.rotation.y = startAngle;

  const tiltAnchor = new THREE.Group();
  tiltAnchor.position.set(data.distance, 0, 0);
  pivot.add(tiltAnchor);

  const axialTilt = new THREE.Group();
  axialTilt.rotation.z = THREE.MathUtils.degToRad(data.tilt ?? 0);
  tiltAnchor.add(axialTilt);

  const geometry = new THREE.SphereGeometry(data.radius, 48, 48);
  const material = new THREE.MeshStandardMaterial({
    map: loadTexture(data.texture, { saturate: true }),
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
      // Without an explicit opacity cap, the alphaMap alone drives alpha
      // (bright/white cloud-covered pixels in the texture render at FULL
      // opacity, 1.0), which blankets the whole globe and hides the actual
      // planet surface underneath almost entirely. Capping opacity lets
      // the Earth texture read clearly through the cloud layer, even under
      // the densest cloud regions.
      opacity: 0.1,
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

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} opts
 * @param {string[]} opts.planetKeys
 * @param {boolean} [opts.interactive]
 * @param {boolean} [opts.tracePattern]
 * @param {boolean} [opts.showOrbitRings]
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
    showOrbitRings = true,
    cinematicIntro = false,
    orthographic = false,
    speedDurationSec = 10,
    totalSimYears = 8,
    traceIntervalDays = 3,
  } = opts;

  const scene = new THREE.Scene();
  // Pitch black — deliberately pure (0,0,0), not the earlier near-black
  // 0x00000a, so there's no residual blue tint anywhere in the backdrop.
  scene.background = new THREE.Color(0x000000);

  const parent = canvas.parentElement;
  const width = parent?.clientWidth || window.innerWidth;
  const height = parent?.clientHeight || window.innerHeight;

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

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

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

  const starfield = buildStarfield();
  scene.add(starfield);

  const sunGeo = new THREE.SphereGeometry(4.2, 64, 64);
  const sunMat = makeSunMaterial();
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  scene.add(sunMesh);

  // Tight, realistic corona: a small bright core glow plus a softer, much
  // fainter outer layer, both scaled close to the Sun's own radius (not the
  // old huge diffuse halo) so it reads as a corona, not a glowing blob.
  // Deliberately toned down (opacity 0.5/0.22 -> 0.32/0.14) now that the
  // Sun's own shader carries a strong internal core glow (see
  // makeSunMaterial) — these sprites are just a subtle assist, not the
  // main source of the "glowing" read anymore.
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.45,
  }));
  glow.scale.set(10.5, 10.5, 1);
  scene.add(glow);

  // A second, larger, softer sprite layered behind the tight glow above —
  // a cheap "subtle bloom" stand-in (no post-processing pipeline needed)
  // so the Sun reads as a genuine light source, not just a lit sphere.
  const outerGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.2,
  }));
  outerGlow.scale.set(16.5, 16.5, 1);
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
  }

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
  // Holds on a true top-down establishing shot (elevation 90° — matches the
  // loading screen's flat overview), then slowly ROTATES down to a more
  // angled, dimensional view (34°) over several seconds — distance/frustum
  // (see the orthographic frustum-fit block above) and the "no zoom" rule
  // are completely unchanged, only the viewing ANGLE animates.
  const HERO_ELEVATION_START_DEG = 90;
  const HERO_ELEVATION_END_DEG = 34;
  function heroPosition(distance, elevationDeg) {
    const rad = THREE.MathUtils.degToRad(elevationDeg);
    return new THREE.Vector3(0, distance * Math.sin(rad), distance * Math.cos(rad));
  }
  // A camera-up vector that stays PERPENDICULAR to the view direction at
  // every elevation angle (including exactly 90°) — this is what lets the
  // rotation pass smoothly THROUGH the true top-down pole position without
  // ever hitting the degenerate "up parallel to view direction" case a
  // plain default up=(0,1,0) would (see the long comment above about why
  // straight-down + default up is unstable for lookAt()). Verified
  // algebraically: dot(up, forward) = 0 for all elevationDeg.
  function heroUp(elevationDeg) {
    const rad = THREE.MathUtils.degToRad(elevationDeg);
    return new THREE.Vector3(0, Math.cos(rad), -Math.sin(rad));
  }
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  }
  const earthRefDistance = PLANETS_BY_KEY.earth?.distance ?? maxDistance * 0.35;
  const heroWidePos = heroPosition(dist, HERO_ELEVATION_START_DEG);
  const heroAngledPos = heroPosition(dist, HERO_ELEVATION_END_DEG);
  // Final resting shot: framed tight on Earth's own orbit (not the whole
  // system) with just enough margin so Earth/its orbit ring are never
  // cropped, while sitting noticeably closer than before (was 1.75 — read
  // as too zoomed-out/loose) for a more intimate Sun+Earth focal point.
  // IMPORTANT for the orthographic camera in use here: on-screen scale
  // comes ENTIRELY from the frustum half-height, NOT camera distance
  // (moving an orthographic camera closer/further does nothing visually)
  // — so "zooming in" is animated by shrinking `camera.top/bottom/left/
  // right` toward `heroCloseHalf` in tick() below, not by moving the
  // camera. The camera position/angle/up stay FROZEN at `heroAngledPos`
  // through the whole zoom phase (no further rotation).
  const HERO_CLOSE_MARGIN = 1.2;
  const heroWideHalf = orthoHalfHeight(maxDistance, framingMargin, width / height);
  const heroCloseHalf = orthoHalfHeight(earthRefDistance, HERO_CLOSE_MARGIN, width / height);
  // Perspective fallback only (this engine also supports a plain
  // PerspectiveCamera for other screens) — dolly-in works normally there
  // since scale IS distance-driven for perspective, unlike orthographic.
  const heroClosePos = camera.isOrthographicCamera
    ? heroAngledPos
    : heroPosition(distanceToFit(width / height, earthRefDistance, HERO_CLOSE_MARGIN), HERO_ELEVATION_END_DEG);
  // A small, CONSTANT look-at offset sits the Sun slightly above
  // dead-center for a more considered mobile-portrait composition.
  const introLookTarget = new THREE.Vector3(0, -earthRefDistance * 0.045, 0);
  const INTRO_HOLD_SEC = 1.6;
  const INTRO_TRAVEL_SEC = 4.5;
  const INTRO_ZOOM_SEC = 4.5;
  let introPhase = cinematicIntro ? 'hold' : 'done';
  let introElapsed = 0;
  let introCompleteCb = null;

  let controls = null;
  function attachOrbitControls(target) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target ?? new THREE.Vector3(0, 0, 0));
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    // Zoom removed per request — the camera should stay at the same
    // settled establishing-shot distance rather than letting the user
    // scroll/pinch closer.
    controls.enableZoom = false;
    controls.enablePan = false;
    // Calm/settled after a scripted cinematic move — no lingering ambient
    // auto-orbit fighting the composition the intro just settled into.
    controls.autoRotate = !cinematicIntro;
    controls.autoRotateSpeed = 0.35;
  }

  if (cinematicIntro) {
    camera.up.copy(heroUp(HERO_ELEVATION_START_DEG));
    camera.position.copy(heroWidePos);
    camera.lookAt(introLookTarget);
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
    // Raised from 8000: RevealScreen.jsx now sizes `totalSimYears` to fully
    // CLOSE a pair's natural resonance pattern (see the note there) rather
    // than an arbitrary short span, which for slow outer-planet pairs can
    // need many more sampled chords than the old cap allowed — hitting it
    // silently truncated the shape partway through (the same "abrupt stop"
    // symptom, just from this cap instead of totalSimYears being too
    // short). 40000 comfortably covers even the slowest realistic pairs
    // (findResonance caps the orbit-count side at 20, so this is a very
    // generous margin) at negligible memory cost (~1MB of Float32Array).
    patternCapacity = Math.min(Math.ceil((totalSimYears * DAYS_PER_YEAR) / traceIntervalDays), 40000);
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
  let browseElapsedSec = 0;
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
    sunMat.uniforms.time.value += delta;
    starfield.children.forEach((layer) => {
      layer.rotation.y += delta * layer.userData.spin;
    });

    if (!completed) simDaysElapsed += delta * simDaysPerRealSecond;
    if (!completed) browseElapsedSec += delta;
    planets.forEach((planet) => {
      if (tracePattern) {
        // Pattern/reveal mode: real orbital period drives the angle
        // directly — accurate relative speeds (needed for the resonance
        // math) and a deterministic total reveal duration.
        planet.pivot.rotation.y = planet.startAngle + (simDaysElapsed / planet.data.orbitalPeriodDays) * Math.PI * 2;
      } else {
        // Browse mode: compressed, mobile-friendly ambient speed (see
        // browseAngularSpeed() above) instead of the real linear scale.
        planet.pivot.rotation.y = planet.startAngle + browseElapsedSec * planet.browseSpeed;
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
        const elevationDeg = THREE.MathUtils.lerp(HERO_ELEVATION_START_DEG, HERO_ELEVATION_END_DEG, eased);
        camera.position.lerpVectors(heroWidePos, heroAngledPos, eased);
        camera.up.copy(heroUp(elevationDeg));
        camera.lookAt(introLookTarget);
        if (t >= 1) {
          introPhase = 'zoom';
          introElapsed = 0;
        }
      } else if (introPhase === 'zoom') {
        // For the ORTHOGRAPHIC camera this screen actually uses, on-screen
        // scale comes entirely from the frustum half-height, not distance
        // — so the "zoom toward Sun+Earth" is animated by shrinking
        // camera.top/bottom/left/right, NOT by moving the camera (moving
        // an orthographic camera closer/further is a no-op visually).
        // Position/up/lookAt stay completely frozen at their final
        // `travel`-phase values, so there is zero further rotation.
        // (Perspective fallback: dolly the position in instead, since
        // scale IS distance-driven there.)
        const t = Math.min(introElapsed / INTRO_ZOOM_SEC, 1);
        const eased = easeInOutCubic(t);
        if (camera.isOrthographicCamera) {
          const half = THREE.MathUtils.lerp(heroWideHalf, heroCloseHalf, eased);
          camera.left = (-half * width) / height;
          camera.right = (half * width) / height;
          camera.top = half;
          camera.bottom = -half;
          camera.updateProjectionMatrix();
        } else {
          camera.position.lerpVectors(heroAngledPos, heroClosePos, eased);
          camera.lookAt(introLookTarget);
        }
        if (t >= 1) {
          introPhase = 'done';
          // Persist the zoomed-in framing as the new "rest" state so a
          // later resize() (orientation change, mobile chrome show/hide)
          // re-derives the frustum from THIS framing instead of snapping
          // back to the full-system view.
          if (camera.isOrthographicCamera) {
            restFrameRadius = earthRefDistance;
            restFrameMargin = HERO_CLOSE_MARGIN;
          }
          // Snap back to the default up vector before OrbitControls takes
          // over — it derives its own spherical coordinates from
          // camera.up and assumes the default (see the long comment above
          // distanceToFit about why only the non-interactive path may
          // ever change camera.up).
          camera.up.set(0, 1, 0);
          if (interactive) attachOrbitControls(introLookTarget);
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
    if (camera.isOrthographicCamera) {
      // No "distance" concept for framing here — just recompute the
      // frustum bounds from the new aspect (fixed vertical half-height,
      // adaptive horizontal half-width), same fit formula used at setup.
      // Uses `restFrameRadius`/`restFrameMargin` (NOT the raw
      // `maxDistance`/`framingMargin` constants) so a resize respects
      // whichever framing is CURRENTLY at rest — the full system before
      // the cinematic "zoom to Sun+Earth" intro phase completes, or the
      // Sun+Earth framing after it does (see that phase in tick()).
      const half = orthoHalfHeight(restFrameRadius, restFrameMargin, w / h);
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
