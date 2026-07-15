// ============================================================================
// Orbital Harmony — planet data.
// radius/distance/rotationSpeed/tilt/spinDirection mirror the values tuned
// in the original vanilla-JS prototype (js/main.js) — proportionally
// believable relative to each other and sized to fit comfortably in view.
// orbitalPeriodDays is the REAL sidereal period — it drives each planet's
// orbit angle directly in the engine (accurate relative speeds for free,
// e.g. Earth/Venus's real 8:13 resonance) and powers the Result screen's
// resonance-ratio calculation.
// ============================================================================

export const PLANETS = [
  {
    key: 'mercury',
    name: 'Mercury',
    color: '#b7b2ad',
    radius: 0.6,
    distance: 16,
    rotationSpeed: 0.004,
    tilt: 0.03,
    spinDirection: 1,
    texture: '/textures/mercury.jpg',
    orbitalPeriodDays: 87.969,
    fact: 'Smallest planet, closest to the Sun.',
  },
  {
    key: 'venus',
    name: 'Venus',
    color: '#e6c78c',
    radius: 1.1,
    distance: 21,
    rotationSpeed: 0.0045,
    tilt: 3,
    spinDirection: -1,
    texture: '/textures/venus.jpg',
    orbitalPeriodDays: 224.701,
    fact: 'Spins backwards; hottest planet in the solar system.',
  },
  {
    key: 'earth',
    name: 'Earth',
    color: '#4f86c6',
    radius: 1.2,
    distance: 25,
    rotationSpeed: 0.02,
    tilt: 23.4,
    spinDirection: 1,
    texture: '/textures/earth_daymap.jpg',
    cloudTexture: '/textures/earth_clouds.jpg',
    hasAtmosphere: true,
    hasClouds: true,
    hasMoon: true,
    orbitalPeriodDays: 365.256,
    fact: 'The only known planet with life.',
  },
  {
    key: 'mars',
    name: 'Mars',
    color: '#c1440e',
    radius: 0.8,
    distance: 31,
    rotationSpeed: 0.018,
    tilt: 25,
    spinDirection: 1,
    texture: '/textures/mars.jpg',
    orbitalPeriodDays: 686.98,
    fact: 'The Red Planet, home to the tallest volcano.',
  },
  {
    key: 'jupiter',
    name: 'Jupiter',
    color: '#d9a066',
    radius: 3.6,
    distance: 42,
    rotationSpeed: 0.045,
    tilt: 3,
    spinDirection: 1,
    texture: '/textures/jupiter.jpg',
    orbitalPeriodDays: 4332.59,
    fact: 'Largest planet; a Great Red Spot storm rages for centuries.',
  },
  {
    key: 'saturn',
    name: 'Saturn',
    color: '#e3c16f',
    radius: 3.0,
    distance: 55,
    rotationSpeed: 0.042,
    tilt: 27,
    spinDirection: 1,
    texture: '/textures/saturn.jpg',
    ringTexture: '/textures/saturn_ring.png',
    hasRings: true,
    orbitalPeriodDays: 10759.22,
    fact: 'Famous for its dazzling ring system.',
  },
  {
    key: 'uranus',
    name: 'Uranus',
    color: '#7de3e0',
    radius: 2.0,
    distance: 67,
    rotationSpeed: 0.03,
    tilt: 82,
    spinDirection: 1,
    texture: '/textures/uranus.jpg',
    orbitalPeriodDays: 30688.5,
    fact: 'Rotates on its side, almost rolling along its orbit.',
  },
  {
    key: 'neptune',
    name: 'Neptune',
    color: '#4166f5',
    radius: 1.9,
    distance: 78,
    rotationSpeed: 0.032,
    tilt: 28,
    spinDirection: 1,
    texture: '/textures/neptune.jpg',
    orbitalPeriodDays: 60182,
    fact: 'Windiest planet, with supersonic storms.',
  },
];

export const PLANETS_BY_KEY = Object.fromEntries(PLANETS.map((p) => [p.key, p]));

export const SUN_TEXTURE = '/textures/sun.jpg';
export const MOON_TEXTURE = '/textures/moon.jpg';
