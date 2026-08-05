// ============================================================================
// Orbital Harmony — planet data.
// radius/distance/rotationSpeed/tilt/spinDirection mirror the values tuned
// in the original vanilla-JS prototype (js/main.js) — proportionally
// believable relative to each other and sized to fit comfortably in view.
// orbitalPeriodDays is the REAL sidereal period — it drives each planet's
// orbit angle directly in the engine (accurate relative speeds for free,
// e.g. Earth/Venus's real 8:13 resonance) and powers the Result screen's
// resonance-ratio calculation.
// meanLongitudeDeg is each planet's REAL mean ecliptic longitude (degrees)
// at the J2000.0 epoch (2000-01-01 12:00 TT) — combined with
// orbitalPeriodDays this lets the engine compute each planet's actual
// current real-world orbital position (see utils/currentPosition.js),
// rather than starting every planet at a random angle. Low-precision
// values (mean/circular orbit approximation, ignores eccentricity and
// perturbations) from the standard "Keplerian elements for approximate
// positions of the major planets" reference — plenty accurate for this
// visualization, not intended for precision ephemeris use.
// ============================================================================

export const PLANETS = [
  {
    key: 'mercury',
    name: 'Mercury',
    color: '#b7b2ad',
    // Bumped up from the real-proportion 0.6 — Mercury is by far the
    // smallest/hardest-to-see planet; a bit of artistic exaggeration here
    // just makes it legible without touching its orbit distance or any of
    // the larger planets.
    radius: 0.95,
    // Hand-tuned visual orbit distance for the Browse/Cosmic views (widened
    // 16/23/31/40/55/72/90/108 spacing so inner planets' bumped-up radii
    // don't crowd/merge visually) — NOT physically to-scale, purely layout.
    distance: 16,
    // Real heliocentric distance in AU (Astronomical Units). Used only for
    // the 2-planet pattern's scientifically-accurate AU-ratio geometry.
    realDistanceAU: 0.39,
    rotationSpeed: 0.004,
    tilt: 0.03,
    spinDirection: 1,
    texture: '/textures/mercury.jpg',
    // Pattern-tracer angular speed, Earth-relative (Earth = 1.0), ported
    // from the original vanilla-JS build's hand-tuned `speed` values
    // (js/main.js, divided by Earth's 0.5). The pattern tracer drives orbit
    // angle by THIS, not orbitalPeriodDays: real periods give Mercury:Earth
    // a ~4.15:1 angular-speed ratio that traces a dense, chaotic web, while
    // these compressed speeds keep every pair's ratio low (~1-2:1) so every
    // planet combination forms a clean, elegant rosette (like the legacy).
    traceSpeed: 1.58,
    orbitalPeriodDays: 87.969,
    meanLongitudeDeg: 252.25032,
    fact: 'Smallest planet, closest to the Sun.',
  },
  {
    key: 'venus',
    name: 'Venus',
    color: '#e6c78c',
    // Bumped up from 1.1 — same "small inner planet, easier to see" bump as
    // Mercury/Earth/Mars, orbit distance untouched.
    radius: 1.5,
    // Hand-tuned visual orbit distance for Browse/Cosmic (see Mercury note).
    distance: 23,
    // Real heliocentric distance in AU — used only for pattern geometry.
    realDistanceAU: 0.72,
    rotationSpeed: 0.0045,
    tilt: 3,
    spinDirection: -1,
    // Retrograde orbital direction for this visualization pass: moves
    // opposite to the default prograde path used by most planets.
    orbitDirection: -1,
    texture: '/textures/venus.jpg',
    traceSpeed: 1.6254,
    orbitalPeriodDays: 224.701,
    meanLongitudeDeg: 181.97910,
    fact: 'Spins backwards; hottest planet in the solar system.',
  },
  {
    key: 'earth',
    name: 'Earth',
    color: '#4f86c6',
    // Bumped up from 1.2 — same "small inner planet, easier to see" bump as
    // the other terrestrials, orbit distance untouched.
    radius: 1.6,
    // Hand-tuned visual orbit distance for Browse/Cosmic (see Mercury note).
    distance: 31,
    // Real heliocentric distance in AU (1 AU = Earth-Sun distance) — used
    // only for pattern geometry.
    realDistanceAU: 1.0,
    rotationSpeed: 0.02,
    tilt: 23.4,
    spinDirection: 1,
    texture: '/textures/earth_daymap.jpg',
    cloudTexture: '/textures/earth_clouds.jpg',
    // Atmosphere halo disabled to match the other planets (none of them have
    // a glow shell) — atmosphere-rendering support in the engine is left
    // intact, just gated off here; flip back to true to restore.
    hasAtmosphere: false,
    // Clouds disabled for this iteration per explicit request ("remove the
    // clouds completely") — cloudTexture/rendering support is left intact
    // in the engine, just gated off here; flip back to true to restore.
    hasClouds: false,
    // Moon re-enabled per explicit request ("add moon back").
    hasMoon: true,
    traceSpeed: 1.0,
    orbitalPeriodDays: 365.256,
    meanLongitudeDeg: 100.46457,
    fact: 'The only known planet with life.',
  },
  {
    key: 'mars',
    name: 'Mars',
    color: '#c1440e',
    // Bumped up from 0.8 — same "small inner planet, easier to see" bump as
    // the other terrestrials, orbit distance untouched.
    radius: 1.1,
    // Hand-tuned visual orbit distance for Browse/Cosmic (see Mercury note).
    distance: 40,
    // Real heliocentric distance in AU — used only for pattern geometry.
    realDistanceAU: 1.52,
    rotationSpeed: 0.018,
    tilt: 25,
    spinDirection: 1,
    texture: '/textures/mars.jpg',
    traceSpeed: 0.8,
    orbitalPeriodDays: 686.98,
    meanLongitudeDeg: 355.44657,
    fact: 'The Red Planet, home to the tallest volcano.',
  },
  {
    key: 'jupiter',
    name: 'Jupiter',
    color: '#d9a066',
    radius: 3.6,
    // Hand-tuned visual orbit distance for Browse/Cosmic (see Mercury note).
    distance: 55,
    // Real heliocentric distance in AU — used only for pattern geometry.
    realDistanceAU: 5.2,
    rotationSpeed: 0.045,
    tilt: 3,
    spinDirection: 1,
    texture: '/textures/jupiter.jpg',
    traceSpeed: 0.44,
    orbitalPeriodDays: 4332.59,
    meanLongitudeDeg: 34.39644,
    fact: 'Largest planet; a Great Red Spot storm rages for centuries.',
  },
  {
    key: 'saturn',
    name: 'Saturn',
    color: '#e3c16f',
    radius: 3.0,
    // Hand-tuned visual orbit distance for Browse/Cosmic (see Mercury note).
    distance: 72,
    // Real heliocentric distance in AU — used only for pattern geometry.
    realDistanceAU: 9.54,
    rotationSpeed: 0.042,
    // Precise real obliquity (26.73°, was rounded to 27) — this is the
    // angle between Saturn's spin axis and its orbital-plane normal; the
    // ring (added below with hasRings) shares this EXACT same value since
    // it's parented under the same `axialTilt` group as the planet body
    // (see buildPlanet()), so the rings always sit flush on Saturn's real
    // equatorial plane, never independently offset.
    tilt: 26.73,
    spinDirection: 1,
    texture: '/textures/saturn.jpg',
    ringTexture: '/textures/saturn_ring.png',
    hasRings: true,
    traceSpeed: 0.32,
    orbitalPeriodDays: 10759.22,
    meanLongitudeDeg: 49.95424,
    fact: 'Famous for its dazzling ring system.',
  },
  {
    key: 'uranus',
    name: 'Uranus',
    color: '#7de3e0',
    radius: 2.0,
    // Hand-tuned visual orbit distance for Browse/Cosmic (see Mercury note).
    distance: 90,
    // Real heliocentric distance in AU — used only for pattern geometry.
    realDistanceAU: 19.19,
    rotationSpeed: 0.03,
    tilt: 82,
    // Retrograde: Uranus's axial tilt exceeds 90° (its pole points almost
    // directly at the Sun at times), which by the IAU convention counts as
    // a retrograde rotator, same category as Venus (just for a different
    // physical reason — extreme tilt vs. a fully flipped-over spin).
    spinDirection: -1,
    // Retrograde orbital direction for this visualization pass.
    orbitDirection: -1,
    texture: '/textures/uranus.jpg',
    traceSpeed: 0.22,
    orbitalPeriodDays: 30688.5,
    meanLongitudeDeg: 313.23810,
    fact: 'Rotates on its side, almost rolling along its orbit.',
  },
  {
    key: 'neptune',
    name: 'Neptune',
    color: '#4166f5',
    radius: 1.9,
    // Hand-tuned visual orbit distance for Browse/Cosmic (see Mercury note).
    distance: 108,
    // Real heliocentric distance in AU — used only for pattern geometry.
    realDistanceAU: 30.07,
    rotationSpeed: 0.032,
    tilt: 28,
    spinDirection: 1,
    texture: '/textures/neptune.jpg',
    traceSpeed: 0.18,
    orbitalPeriodDays: 60182,
    meanLongitudeDeg: 304.87997,
    fact: 'Windiest planet, with supersonic storms.',
  },
];

export const PLANETS_BY_KEY = Object.fromEntries(PLANETS.map((p) => [p.key, p]));

export const SUN_TEXTURE = '/textures/sun.jpg';
export const MOON_TEXTURE = '/textures/moon.jpg';
