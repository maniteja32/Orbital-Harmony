// "Your Birthday Personality Archetype" — explicitly NOT astrology, NOT
// zodiac-based, and NOT predictive. The archetype is derived purely from
// recurring occupations/achievements among REAL notable people who share
// the user's calendar birthday (see birthdayArchetypeService below in
// dateStory.js, which supplies `people`), never from the date itself or
// any star sign. Every generated sentence is phrased as an observation
// about that specific group of people, never as a claim about the user.
const ARCHETYPES = [
  {
    key: 'explorer',
    name: 'The Explorer',
    theme: 'exploration and discovery',
    keywords: ['explor', 'adventur', 'astronaut', 'cosmonaut', 'aviat', 'pilot', 'mountaineer', 'navigat', 'expedition', 'voyage', 'cartograph', 'sail'],
  },
  {
    key: 'builder',
    name: 'The Builder',
    theme: 'building lasting things',
    keywords: ['engineer', 'architect', 'entrepreneur', 'founder', 'industrialist', 'contractor', 'construct', 'developer'],
  },
  {
    key: 'visionary',
    name: 'The Visionary',
    theme: 'envisioning what does not yet exist',
    keywords: ['invent', 'physicist', 'theorist', 'futurist', 'visionary'],
  },
  {
    key: 'storyteller',
    name: 'The Storyteller',
    theme: 'turning ideas into stories',
    keywords: ['writer', 'author', 'novelist', 'poet', 'playwright', 'screenwriter', 'filmmaker', 'director', 'journalist', 'storytel'],
  },
  {
    key: 'innovator',
    name: 'The Innovator',
    theme: 'inventing new ways to solve problems',
    keywords: ['invent', 'entrepreneur', 'technolog', 'innovat', 'startup'],
  },
  {
    key: 'teacher',
    name: 'The Teacher',
    theme: 'sharing knowledge and shaping minds',
    keywords: ['educat', 'professor', 'philosoph', 'teacher', 'scholar', 'academic', 'lectur'],
  },
  {
    key: 'pathfinder',
    name: 'The Pathfinder',
    theme: 'blazing a trail others could follow',
    keywords: ['activist', 'pioneer', 'first woman', 'first person', 'trailblaz', 'reform'],
  },
  {
    key: 'connector',
    name: 'The Connector',
    theme: 'bringing people and ideas together',
    keywords: ['diplomat', 'politician', 'humanitarian', 'organiz', 'negotiat', 'ambassador', 'statesman', 'stateswoman'],
  },
  {
    key: 'creator',
    name: 'The Creator',
    theme: 'turning imagination into something real',
    keywords: ['artist', 'musician', 'composer', 'singer', 'designer', 'painter', 'sculpt', 'choreograph'],
  },
  {
    key: 'observer',
    name: 'The Observer',
    theme: 'studying the world closely before acting',
    keywords: ['scientist', 'journalist', 'natural', 'philosoph', 'research', 'astronomer', 'biolog'],
  },
  {
    key: 'pioneer',
    name: 'The Pioneer',
    theme: 'being first where no one had gone before',
    keywords: ['first ', 'pioneer', 'breakthrough', 'groundbreaking'],
  },
  {
    key: 'dreamer',
    name: 'The Dreamer',
    theme: 'imagining bold possibilities',
    keywords: ['poet', 'visionary', 'idealist', 'dream'],
  },
  {
    key: 'synthesizer',
    name: 'The Synthesizer',
    theme: 'connecting ideas across different fields',
    keywords: ['polymath', 'interdisciplinary', 'generalist'],
  },
  {
    key: 'challenger',
    name: 'The Challenger',
    theme: 'questioning the status quo',
    keywords: ['activist', 'revolution', 'reform', 'dissident', 'campaign', 'rebel'],
  },
  {
    key: 'architect',
    name: 'The Architect',
    theme: 'designing systems and structures with intention',
    keywords: ['architect', 'engineer', 'system', 'designer', 'planner', 'structural'],
  },
];

// Safe, generic fallback for the rare case where none of the fetched
// people match any theme's keywords strongly enough — still an honest
// description ("bringing people and ideas together"), never an empty card.
const DEFAULT_ARCHETYPE = ARCHETYPES.find((archetype) => archetype.key === 'connector');

function normalizedText(person) {
  return `${person.occupation ?? ''} ${person.fact ?? ''}`.toLowerCase();
}

function scoreArchetype(archetype, people) {
  return people.reduce((total, person) => {
    const text = normalizedText(person);
    const matches = archetype.keywords.filter((keyword) => text.includes(keyword)).length;
    // Capped per person so one heavily-tagged bio can't single-handedly
    // decide the whole group's theme.
    return total + Math.min(matches, 3);
  }, 0);
}

function pickArchetype(people) {
  let best = DEFAULT_ARCHETYPE;
  let bestScore = 0;
  for (const archetype of ARCHETYPES) {
    const score = scoreArchetype(archetype, people);
    if (score > bestScore) {
      best = archetype;
      bestScore = score;
    }
  }
  return best;
}

function cleanOccupation(occupation) {
  return String(occupation ?? '')
    .replace(/\.$/, '')
    .replace(/^(a|an)\s+/i, '')
    .trim();
}

// A short (2-6 word) field label for the "from X, Y, Z" list in "The
// Pattern" — cleanOccupation()'s full phrase (e.g. "Canadian-American
// businessman and audio pioneer responsible for the first hi-fi stereo
// receiver.") reads as a run-on sentence once several are joined together,
// so this keeps only the lead noun phrase, dropping anything past the
// first comma/semicolon/"also"/"responsible"/"who" clause.
function shortOccupation(occupation) {
  const cleaned = cleanOccupation(occupation)
    .split(/,|;| also\b| responsible for\b| who\b/i)[0]
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.slice(0, 6).join(' ').replace(/\.$/, '').toLowerCase();
}

/** Builds the whole "Birthday Personality Archetype" card content from a
 *  list of real notable people born on the same calendar day (`{ name,
 *  occupation, fact, href }`) — every sentence is an observation about
 *  THAT group, never a claim about the viewer, and never zodiac/date-based. */
export function deriveBirthdayArchetype(people) {
  const validPeople = (people ?? []).filter((person) => person?.name);
  if (validPeople.length === 0) return null;

  const archetype = pickArchetype(validPeople);
  const occupationSamples = [...new Set(
    validPeople.map((person) => shortOccupation(person.occupation)).filter(Boolean),
  )].slice(0, 3);

  const summary = `"${archetype.name}" names a recurring theme among people born on this day: ${archetype.theme}. Many notable individuals sharing this birthday have shaped their lives around that same pull.`;

  const pattern = occupationSamples.length > 0
    ? `An interesting pattern that appears across this birthday tribe is a shared pull toward ${archetype.theme}. Their fields differ — from ${occupationSamples.join(', ')} — yet a common thread connects how they approached ideas, problems, and the people around them.`
    : `An interesting pattern that appears across this birthday tribe is a shared pull toward ${archetype.theme}, showing up again and again across very different fields and eras.`;

  const reflection = `People born on this day often seem drawn toward ${archetype.theme}. Their paths span very different fields and eras, yet a common thread emerges among the real people who share this birthday. This isn’t a prediction of who you are — it’s an invitation to notice a pattern, and maybe feel part of a small, real tribe.`;

  return {
    archetypeName: archetype.name,
    archetypeKey: archetype.key,
    summary,
    pattern,
    reflection,
    disclaimer: 'Based on real people who share this calendar birthday — not astrology, horoscopes, or predictions.',
  };
}
