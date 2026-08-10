import { PLANETS_BY_KEY } from '../data/planets.js';

const FACTS_BY_PLANET = {
  mercury: [
    { emoji: '☀️', fact: 'One sunrise-to-sunrise day lasts 176 Earth days — twice as long as Mercury’s year.' },
    { emoji: '🧊', fact: 'Water ice survives inside permanently shadowed craters near Mercury’s poles.' },
    { emoji: '🌡️', fact: 'Mercury swings from about 430°C by day to −180°C at night.' },
    { emoji: '🧲', fact: 'Mercury has a global magnetic field, but it is only about 1% as strong as Earth’s.' },
    { emoji: '⛰️', fact: 'Mercury is slowly shrinking, leaving giant cliff-like scarps across its surface.' },
    { emoji: '🪨', fact: 'Mercury’s oversized metallic core fills roughly 85% of the planet’s radius.' },
    { emoji: '✨', fact: 'Mercury has almost no atmosphere, only an extremely thin exosphere.' },
    { emoji: '🌅', fact: 'Near parts of Mercury’s orbit, the Sun can appear to stop and briefly reverse in the sky.' },
  ],
  venus: [
    { emoji: '🕰️', fact: 'A day on Venus lasts 243 Earth days — longer than its 225-day year.' },
    { emoji: '🔄', fact: 'Venus spins backward, so the Sun would rise in the west.' },
    { emoji: '🔥', fact: 'Venus is hotter than Mercury because its carbon-dioxide atmosphere traps heat.' },
    { emoji: '💨', fact: 'Venus is nearly Earth-sized, but its surface pressure is about 92 times higher.' },
    { emoji: '🌋', fact: 'Venus has more volcanoes than any other planet in the solar system.' },
    { emoji: '☁️', fact: 'Venus is wrapped in clouds containing droplets of sulfuric acid.' },
    { emoji: '🌪️', fact: 'High-altitude winds race around Venus in only about four Earth days.' },
    { emoji: '🌙', fact: 'Venus has no moons and no rings.' },
  ],
  earth: [
    { emoji: '🌊', fact: 'Earth is the only known world with stable liquid oceans covering most of its surface.' },
    { emoji: '🔥', fact: 'Earth’s solid inner core is nearly as hot as the Sun’s surface.' },
    { emoji: '💨', fact: 'Earth’s atmosphere is about 78% nitrogen and 21% oxygen.' },
    { emoji: '🌙', fact: 'The Moon helps stabilize Earth’s axial tilt and long-term climate.' },
    { emoji: '🧩', fact: 'Earth’s moving tectonic plates recycle crust and continually reshape the continents.' },
    { emoji: '⚡', fact: 'Moonlight takes about 1.3 seconds to reach Earth.' },
    { emoji: '❄️', fact: 'Earth is closest to the Sun in early January, during northern winter.' },
    { emoji: '📅', fact: 'Earth circles the Sun in about 365.25 days, which is why leap years matter.' },
  ],
  mars: [
    { emoji: '🌋', fact: 'Olympus Mons rises about 22 km, making it the tallest volcano in the solar system.' },
    { emoji: '🕰️', fact: 'A Martian day is only about 40 minutes longer than an Earth day.' },
    { emoji: '🌅', fact: 'Fine dust in Mars’s atmosphere can turn its sunsets blue.' },
    { emoji: '🏜️', fact: 'Valles Marineris is a canyon system stretching more than 4,000 km.' },
    { emoji: '🧊', fact: 'Frozen water is locked inside Mars’s polar caps and beneath its surface.' },
    { emoji: '🌙', fact: 'Mars has two tiny, irregular moons named Phobos and Deimos.' },
    { emoji: '💨', fact: 'Mars’s atmosphere is mostly carbon dioxide and less than 1% as dense as Earth’s.' },
    { emoji: '🛰️', fact: 'Phobos is slowly falling toward Mars and may eventually break apart.' },
  ],
  jupiter: [
    { emoji: '⚡', fact: 'Jupiter finishes a day in under 10 hours, the fastest spin of any planet.' },
    { emoji: '🌪️', fact: 'Jupiter’s Great Red Spot is a centuries-old storm wider than Earth.' },
    { emoji: '💪', fact: 'Jupiter holds more than twice the mass of every other planet combined.' },
    { emoji: '🌙', fact: 'Jupiter’s moon Ganymede is larger than the planet Mercury.' },
    { emoji: '🧲', fact: 'Jupiter has the strongest magnetic field of any planet in the solar system.' },
    { emoji: '💍', fact: 'Jupiter has a faint ring system made mostly of dust.' },
    { emoji: '🌊', fact: 'Europa likely hides a salty global ocean beneath its icy shell.' },
    { emoji: '🔥', fact: 'Jupiter radiates more heat than it receives from the Sun.' },
  ],
  saturn: [
    { emoji: '🛟', fact: 'Saturn’s average density is lower than water — in a vast enough ocean, it would float.' },
    { emoji: '💍', fact: 'Saturn’s rings are mostly water ice, from dust-sized grains to giant chunks.' },
    { emoji: '⬡', fact: 'A six-sided jet stream circles Saturn’s north pole.' },
    { emoji: '🌊', fact: 'Titan has rivers, rain, and lakes made of liquid methane and ethane.' },
    { emoji: '⚡', fact: 'A day on Saturn lasts only about 10.7 hours.' },
    { emoji: '📏', fact: 'Saturn’s main rings span hundreds of thousands of kilometres but are remarkably thin.' },
    { emoji: '⛲', fact: 'Enceladus sprays water-rich plumes from an ocean beneath its icy crust.' },
    { emoji: '🌙', fact: 'Saturn is surrounded by hundreds of known moons.' },
  ],
  uranus: [
    { emoji: '🔄', fact: 'Uranus rotates on its side with an axial tilt of about 98°.' },
    { emoji: '🍂', fact: 'A single season on Uranus can last about 21 Earth years.' },
    { emoji: '🔭', fact: 'Uranus was the first planet discovered with a telescope.' },
    { emoji: '🩵', fact: 'Atmospheric methane absorbs red light and helps give Uranus its cyan colour.' },
    { emoji: '💍', fact: 'Uranus has 13 known rings, most of them narrow and dark.' },
    { emoji: '🕰️', fact: 'A day on Uranus lasts a little over 17 hours.' },
    { emoji: '🧊', fact: 'Uranus is an ice giant rich in water, ammonia, and methane beneath its atmosphere.' },
    { emoji: '🧲', fact: 'Uranus’s magnetic field is sharply tilted and offset from the planet’s centre.' },
  ],
  neptune: [
    { emoji: '💨', fact: 'Neptune’s winds can race past 2,000 km/h, the fastest measured in the solar system.' },
    { emoji: '🗓️', fact: 'Neptune takes about 165 Earth years to complete one orbit.' },
    { emoji: '🧮', fact: 'Neptune was predicted with mathematics before it was seen through a telescope.' },
    { emoji: '🔄', fact: 'Triton orbits Neptune backward and was probably captured from the Kuiper Belt.' },
    { emoji: '⛲', fact: 'Neptune’s moon Triton has geysers that spray nitrogen into space.' },
    { emoji: '🕰️', fact: 'A day on Neptune lasts only about 16 hours.' },
    { emoji: '🔥', fact: 'Neptune radiates more than twice the energy it receives from the Sun.' },
    { emoji: '☀️', fact: 'Sunlight takes roughly four hours to reach Neptune.' },
  ],
};

const PAIR_TITLES = ['Cosmic curiosity', 'Orbit surprise', 'Space spark', 'Planet plot twist'];
const COSMIC_TITLES = ['Your cosmic note', 'A little starlight', 'Your bright reminder', 'A note from your orbit'];
const COSMIC_NOTES = [
  {
    emoji: '✨',
    name: 'Quiet confidence',
    message: (year) => `Your story began in ${year}, and every season since has added perspective. Trust the strength that grew quietly.`,
  },
  {
    emoji: '🌱',
    name: 'Gentle momentum',
    message: (year) => `You have been becoming since ${year}. Small, repeated choices can carry you farther than one perfect leap.`,
  },
  {
    emoji: '🌟',
    name: 'Resilient glow',
    message: (year) => `The world of ${year} could not predict who you would become. Leave room for your next chapter to surprise you too.`,
  },
  {
    emoji: '🧭',
    name: 'Your own compass',
    message: (year) => `Your path started in ${year}, but it never had to match anyone else's pace. Keep choosing what feels honest and alive.`,
  },
  {
    emoji: '🌅',
    name: 'Brave beginnings',
    message: (year) => `${year} was your first page, not your definition. You are allowed to begin again whenever growth asks you to.`,
  },
  {
    emoji: '💫',
    name: 'Creative gravity',
    message: (year) => `Since ${year}, your ideas have gathered a perspective only you could build. Give the unusual ones room to orbit.`,
  },
  {
    emoji: '☀️',
    name: 'Warm courage',
    message: (year) => `A life unfolding since ${year} has already crossed many skies. Let experience become confidence, not weight.`,
  },
  {
    emoji: '🎈',
    name: 'Playful spark',
    message: (year) => `Your timeline began in ${year}, and joy belongs in it too. Make room for something delightfully unnecessary.`,
  },
];

const historyByScope = new Map();

function randomIndex(count) {
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    globalThis.crypto.getRandomValues(value);
    return value[0] % count;
  }
  return Math.floor(Math.random() * count);
}

function takeUnusedIndex(scope, count) {
  const previous = historyByScope.get(scope) ?? new Set();
  const used = new Set([...previous].filter((index) => index >= 0 && index < count));

  if (used.size >= count) {
    const lastIndex = [...used].at(-1);
    used.clear();
    if (count > 1 && lastIndex !== undefined) used.add(lastIndex);
  }

  let index = randomIndex(count);
  while (used.has(index)) index = (index + 1) % count;
  used.add(index);

  historyByScope.delete(scope);
  historyByScope.set(scope, used);
  return index;
}

function toEntry(planet, factIndex) {
  const facts = FACTS_BY_PLANET[planet.key];
  const selected = facts?.[factIndex] ?? { emoji: '🪐', fact: planet.fact };
  return { name: planet.name, ...selected };
}

function cosmicDateSeed(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 0;
  return date.getUTCFullYear() * 372 + (date.getUTCMonth() + 1) * 31 + date.getUTCDate();
}

export function createCosmicDateMessage(date) {
  const hasDate = date instanceof Date && !Number.isNaN(date.getTime());
  const year = hasDate ? date.getUTCFullYear() : new Date().getUTCFullYear();
  const seed = cosmicDateSeed(date);
  const note = COSMIC_NOTES[seed % COSMIC_NOTES.length];
  const dateKey = hasDate ? date.toISOString().slice(0, 10) : 'timeless';

  return {
    id: `cosmic-note:${dateKey}`,
    title: COSMIC_TITLES[Math.floor(seed / COSMIC_NOTES.length) % COSMIC_TITLES.length],
    titleEmoji: '✨',
    entries: [{ name: note.name, emoji: note.emoji, fact: note.message(year) }],
  };
}

export function createPatternFactoid({ planetA, planetB, isCosmic = false, cosmicDate = null }) {
  if (isCosmic) return createCosmicDateMessage(cosmicDate);

  const selectedPlanets = [...new Set([planetA, planetB])]
    .map((key) => PLANETS_BY_KEY[key])
    .filter(Boolean);

  if (selectedPlanets.length === 0) return null;

  if (selectedPlanets.length === 1) {
    const [planet] = selectedPlanets;
    const count = FACTS_BY_PLANET[planet.key].length;
    const scope = `planet:${planet.key}`;
    const index = takeUnusedIndex(scope, count);
    return {
      id: `${scope}:${index}`,
      title: PAIR_TITLES[index % PAIR_TITLES.length],
      titleEmoji: '✨',
      entries: [toEntry(planet, index)],
    };
  }

  const [firstPlanet, secondPlanet] = [...selectedPlanets]
    .sort((first, second) => first.key.localeCompare(second.key));
  const firstFacts = FACTS_BY_PLANET[firstPlanet.key];
  const secondFacts = FACTS_BY_PLANET[secondPlanet.key];
  const scope = `pair:${firstPlanet.key}:${secondPlanet.key}`;
  const index = takeUnusedIndex(scope, firstFacts.length * secondFacts.length);
  const firstFactIndex = Math.floor(index / secondFacts.length);
  const secondFactIndex = index % secondFacts.length;
  const entriesByPlanet = new Map([
    [firstPlanet.key, toEntry(firstPlanet, firstFactIndex)],
    [secondPlanet.key, toEntry(secondPlanet, secondFactIndex)],
  ]);

  return {
    id: `${scope}:${index}`,
    title: PAIR_TITLES[index % PAIR_TITLES.length],
    titleEmoji: '✨',
    entries: selectedPlanets.map((planet) => entriesByPlanet.get(planet.key)),
  };
}