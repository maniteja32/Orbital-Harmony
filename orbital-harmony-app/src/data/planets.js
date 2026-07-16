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
    // Orbital distances were widened (16/21/25/31/42/55/67/78 ->
    // 16/23/31/40/55/72/90/108, progressively larger gaps) after users
    // reported planets visually crowding/merging — especially Earth's
    // Moon appearing to touch Mars — once the inner planets' RADII were
    // bumped up for visibility. Distances are otherwise purely a visual
    // layout choice (not physically to-scale in this app to begin with),
    // and every camera-framing calculation in solarSystemEngine.js derives
    // entirely from these values dynamically, so widening them needs no
    // other constant changes.
    distance: 16,
    rotationSpeed: 0.004,
    tilt: 0.03,
    spinDirection: 1,
    texture: '/textures/mercury.jpg',
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
    distance: 23,
    rotationSpeed: 0.0045,
    tilt: 3,
    spinDirection: -1,
    texture: '/textures/venus.jpg',
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
    distance: 31,
    rotationSpeed: 0.02,
    tilt: 23.4,
    spinDirection: 1,
    texture: '/textures/earth_daymap.jpg',
    cloudTexture: '/textures/earth_clouds.jpg',
    hasAtmosphere: true,
    // Clouds disabled for this iteration per explicit request ("remove the
    // clouds completely") — cloudTexture/rendering support is left intact
    // in the engine, just gated off here; flip back to true to restore.
    hasClouds: false,
    // Moon disabled for now per explicit request ("remove the moon") —
    // moon-rendering support in the engine is left intact, just gated off
    // here; flip back to true to restore.
    hasMoon: false,
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
    distance: 40,
    rotationSpeed: 0.018,
    tilt: 25,
    spinDirection: 1,
    texture: '/textures/mars.jpg',
    orbitalPeriodDays: 686.98,
    meanLongitudeDeg: 355.44657,
    fact: 'The Red Planet, home to the tallest volcano.',
  },
  {
    key: 'jupiter',
    name: 'Jupiter',
    color: '#d9a066',
    radius: 3.6,
    distance: 55,
    rotationSpeed: 0.045,
    tilt: 3,
    spinDirection: 1,
    texture: '/textures/jupiter.jpg',
    orbitalPeriodDays: 4332.59,
    meanLongitudeDeg: 34.39644,
    fact: 'Largest planet; a Great Red Spot storm rages for centuries.',
  },
  {
    key: 'saturn',
    name: 'Saturn',
    color: '#e3c16f',
    radius: 3.0,
    distance: 72,
    rotationSpeed: 0.042,
    tilt: 27,
    spinDirection: 1,
    texture: '/textures/saturn.jpg',
    ringTexture: '/textures/saturn_ring.png',
    hasRings: true,
    orbitalPeriodDays: 10759.22,
    meanLongitudeDeg: 49.95424,
    fact: 'Famous for its dazzling ring system.',
  },
  {
    key: 'uranus',
    name: 'Uranus',
    color: '#7de3e0',
    radius: 2.0,
    distance: 90,
    rotationSpeed: 0.03,
    tilt: 82,
    // Retrograde: Uranus's axial tilt exceeds 90° (its pole points almost
    // directly at the Sun at times), which by the IAU convention counts as
    // a retrograde rotator, same category as Venus (just for a different
    // physical reason — extreme tilt vs. a fully flipped-over spin).
    spinDirection: -1,
    texture: '/textures/uranus.jpg',
    orbitalPeriodDays: 30688.5,
    meanLongitudeDeg: 313.23810,
    fact: 'Rotates on its side, almost rolling along its orbit.',
  },
  {
    key: 'neptune',
    name: 'Neptune',
    color: '#4166f5',
    radius: 1.9,
    distance: 108,
    rotationSpeed: 0.032,
    tilt: 28,
    spinDirection: 1,
    texture: '/textures/neptune.jpg',
    orbitalPeriodDays: 60182,
    meanLongitudeDeg: 304.87997,
    fact: 'Windiest planet, with supersonic storms.',
  },
];

export const PLANETS_BY_KEY = Object.fromEntries(PLANETS.map((p) => [p.key, p]));

export const SUN_TEXTURE = '/textures/sun.jpg';
export const MOON_TEXTURE = '/textures/moon.jpg';
