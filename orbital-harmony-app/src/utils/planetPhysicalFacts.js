// Local, non-Wikipedia fact source: a small hand-curated table of real
// physical constants (mean radius, surface gravity, day length, moon
// count, one standout trait) per planet, turned into short template
// sentences. Deliberately independent of any external API/network call —
// this is a second, differently-sourced pool of facts (numeric/physical
// instead of Wikipedia prose extracts) mixed into the same candidate list
// in planetFactService.js and the server's aiTriviaService.mjs.
//
// Moon counts use "at least N" phrasing so the sentence stays true even as
// new moons are discovered over time (counts only ever go up).
const PLANET_PHYSICAL_DATA = {
  mercury: { meanRadiusKm: 2440, gravityG: 0.38, dayHours: 4222.6, moons: 0, trait: 'has no rings and no known moons' },
  venus: { meanRadiusKm: 6052, gravityG: 0.9, dayHours: 2802, moons: 0, trait: 'has a surface hot enough to melt lead' },
  earth: { meanRadiusKm: 6371, gravityG: 1, dayHours: 24, moons: 1, trait: 'is the only known planet with liquid-water oceans on its surface' },
  mars: { meanRadiusKm: 3390, gravityG: 0.38, dayHours: 24.7, moons: 2, trait: 'hosts Olympus Mons, the tallest known volcano in the solar system' },
  jupiter: { meanRadiusKm: 71492, gravityG: 2.53, dayHours: 9.9, moons: 95, trait: 'spins faster than any other planet' },
  saturn: { meanRadiusKm: 60268, gravityG: 1.06, dayHours: 10.7, moons: 146, trait: 'is the only planet less dense than water' },
  uranus: { meanRadiusKm: 25559, gravityG: 0.89, dayHours: 17.2, moons: 27, trait: 'rotates on its side with a roughly 98° axial tilt' },
  neptune: { meanRadiusKm: 24622, gravityG: 1.14, dayHours: 16.1, moons: 14, trait: 'has the fastest winds of any planet, over 2,000 km/h' },
};

function formatDayLength(hours) {
  if (hours >= 48) return `${(hours / 24).toFixed(1)} Earth days`;
  return `${hours.toFixed(1)} hours`;
}

function moonPhrase(moons) {
  if (moons === 0) return 'no known moons';
  if (moons === 1) return 'one known moon';
  if (moons === 2) return 'two known moons';
  return `at least ${moons} known moons`;
}

/** Returns a handful of short (<=140 char) physical-fact sentences for a
 * planet, generated from local numeric data rather than fetched text. */
export function generatePhysicalFacts(planetKey, planetName) {
  const data = PLANET_PHYSICAL_DATA[planetKey];
  if (!data || !planetName) return [];
  return [
    `${planetName}'s surface gravity is about ${data.gravityG.toFixed(2)}× Earth's.`,
    `A day on ${planetName} lasts about ${formatDayLength(data.dayHours)}.`,
    `${planetName} has ${moonPhrase(data.moons)}.`,
    `${planetName}'s mean radius is about ${Math.round(data.meanRadiusKm).toLocaleString()} km.`,
    `${planetName} ${data.trait}.`,
  ];
}
