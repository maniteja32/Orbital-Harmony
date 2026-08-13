// "Your Birthday Personality Archetype" — explicitly NOT astrology, NOT
// zodiac-based, and NOT predictive. The archetype is derived purely from
// recurring occupations/achievements among REAL notable people who share
// the user's calendar birthday (see loadBirthdayArchetype in dateStory.js,
// which supplies `people`), never from the date itself or any star sign.
// Every generated sentence is phrased as an observation about that
// specific group of people, never as a claim about the user.
//
// Card structure is intentionally minimal and non-repetitive: Archetype
// Name, a tailored one-sentence Summary (what the theme IS), "The
// Pattern" (a DIFFERENT observation — how the group's real, varied fields
// still share a common thread), and a short "Birthday Tribe" bullet list
// (name + one-word/short role) as concrete evidence. No section restates
// another's wording.
const ARCHETYPES = [
  {
    key: 'explorer',
    name: 'The Explorer',
    summary: 'People born on this day often stand out for seeking the unknown — new places, new questions, new ground to cover.',
    keywords: ['explor', 'adventur', 'astronaut', 'cosmonaut', 'aviat', 'pilot', 'mountaineer', 'navigat', 'expedition', 'voyage', 'cartograph', 'sail'],
  },
  {
    key: 'builder',
    name: 'The Builder',
    summary: 'People born on this day often stand out for turning ideas into lasting, tangible things that outlast them.',
    keywords: ['engineer', 'architect', 'entrepreneur', 'founder', 'industrialist', 'contractor', 'construct', 'developer'],
  },
  {
    key: 'visionary',
    name: 'The Visionary',
    summary: 'People born on this day often stand out for imagining what doesn’t exist yet, then working to make it real.',
    keywords: ['invent', 'physicist', 'theorist', 'futurist', 'visionary'],
  },
  {
    key: 'storyteller',
    name: 'The Storyteller',
    summary: 'People born on this day often stand out for shaping ideas into stories, through writing, film, or the spoken word.',
    keywords: ['writer', 'author', 'novelist', 'poet', 'playwright', 'screenwriter', 'filmmaker', 'director', 'journalist', 'storytel'],
  },
  {
    key: 'innovator',
    name: 'The Innovator',
    summary: 'People born on this day often stand out for inventing new ways to solve old problems.',
    keywords: ['invent', 'entrepreneur', 'technolog', 'innovat', 'startup'],
  },
  {
    key: 'teacher',
    name: 'The Teacher',
    summary: 'People born on this day often stand out for passing knowledge on — teaching, mentoring, and shaping how others think.',
    keywords: ['educat', 'professor', 'philosoph', 'teacher', 'scholar', 'academic', 'lectur'],
  },
  {
    key: 'pathfinder',
    name: 'The Pathfinder',
    summary: 'People born on this day often stand out for going first, blazing a trail that others later followed.',
    keywords: ['activist', 'pioneer', 'first woman', 'first person', 'trailblaz', 'reform'],
  },
  {
    key: 'connector',
    name: 'The Connector',
    summary: 'People born on this day often stand out for bringing people and ideas together across divides.',
    keywords: ['diplomat', 'politician', 'humanitarian', 'organiz', 'negotiat', 'ambassador', 'statesman', 'stateswoman'],
  },
  {
    key: 'creator',
    name: 'The Creator',
    summary: 'People born on this day often stand out for turning imagination into something real, in art, music, or design.',
    keywords: ['artist', 'musician', 'composer', 'singer', 'designer', 'painter', 'sculpt', 'choreograph'],
  },
  {
    key: 'observer',
    name: 'The Observer',
    summary: 'People born on this day often stand out for studying the world closely, favoring careful attention over quick judgment.',
    keywords: ['scientist', 'journalist', 'natural', 'philosoph', 'research', 'astronomer', 'biolog'],
  },
  {
    key: 'pioneer',
    name: 'The Pioneer',
    summary: 'People born on this day often stand out for exploring new territory, introducing new ideas, or challenging established norms.',
    keywords: ['first ', 'pioneer', 'breakthrough', 'groundbreaking'],
  },
  {
    key: 'dreamer',
    name: 'The Dreamer',
    summary: 'People born on this day often stand out for imagining bold possibilities others hadn’t yet considered.',
    keywords: ['poet', 'visionary', 'idealist', 'dream'],
  },
  {
    key: 'synthesizer',
    name: 'The Synthesizer',
    summary: 'People born on this day often stand out for connecting ideas across very different fields.',
    keywords: ['polymath', 'interdisciplinary', 'generalist'],
  },
  {
    key: 'challenger',
    name: 'The Challenger',
    summary: 'People born on this day often stand out for questioning the status quo and pushing for change.',
    keywords: ['activist', 'revolution', 'reform', 'dissident', 'campaign', 'rebel'],
  },
  {
    key: 'architect',
    name: 'The Architect',
    summary: 'People born on this day often stand out for designing systems and structures with clear intention.',
    keywords: ['architect', 'engineer', 'system', 'designer', 'planner', 'structural'],
  },
];

// Safe, generic fallback for the rare case where none of the fetched
// people match any archetype's keywords strongly enough — still an
// honest description, never an empty card.
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

// Common demonyms Wikipedia occupation strings are prefixed with (e.g.
// "Canadian-American businessman", "German zoologist") — stripped so the
// short field/role labels below read as a PROFESSION, not a nationality.
const DEMONYMS = new Set([
  'american', 'british', 'english', 'scottish', 'welsh', 'irish', 'german', 'french', 'italian',
  'spanish', 'portuguese', 'dutch', 'belgian', 'swiss', 'austrian', 'russian', 'ukrainian', 'polish',
  'czech', 'slovak', 'hungarian', 'romanian', 'bulgarian', 'greek', 'turkish', 'norwegian', 'swedish',
  'danish', 'finnish', 'icelandic', 'canadian', 'mexican', 'brazilian', 'argentine', 'chilean',
  'colombian', 'peruvian', 'venezuelan', 'cuban', 'jamaican', 'chinese', 'japanese', 'korean',
  'indian', 'pakistani', 'bangladeshi', 'indonesian', 'filipino', 'vietnamese', 'thai', 'malaysian',
  'singaporean', 'australian', 'egyptian', 'moroccan', 'algerian', 'tunisian', 'nigerian', 'kenyan',
  'ethiopian', 'ghanaian', 'israeli', 'iranian', 'iraqi', 'saudi', 'emirati',
]);

function dropLeadingDemonym(words) {
  const [first] = words;
  if (!first) return words;
  if (first.includes('-') || DEMONYMS.has(first.toLowerCase())) return words.slice(1);
  return words;
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
  const words = dropLeadingDemonym(cleaned.split(/\s+/).filter(Boolean));
  return words.slice(0, 6).join(' ').replace(/\.$/, '').toLowerCase();
}

// A ONE-TO-THREE-WORD role label for a "Birthday Tribe" bullet (e.g.
// "Businessman", "Computer Scientist") — shorter and Title Cased, unlike
// shortOccupation()'s longer lowercase phrase used in "The Pattern".
function shortRole(occupation) {
  const cleaned = cleanOccupation(occupation)
    .split(/,|;| also\b| responsible for\b| who\b/i)[0]
    .trim();
  const afterDemonym = dropLeadingDemonym(cleaned.split(/\s+/).filter(Boolean));
  const andIndex = afterDemonym.findIndex((word) => word.toLowerCase() === 'and');
  const roleWords = (andIndex === -1 ? afterDemonym : afterDemonym.slice(0, andIndex)).slice(0, 3);
  if (roleWords.length === 0) return 'Notable figure';
  return roleWords
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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

  const pattern = occupationSamples.length > 0
    ? `Their work spans very different fields — ${occupationSamples.join(', ')} — but each one pushed past what already existed instead of just following it.`
    : 'Their work spans very different fields and eras, but each one pushed past what already existed instead of just following it.';

  const tribe = validPeople.map((person) => ({
    name: person.name,
    role: shortRole(person.occupation),
    href: person.href ?? null,
  }));

  return {
    archetypeName: archetype.name,
    archetypeKey: archetype.key,
    summary: archetype.summary,
    pattern,
    tribe,
    disclaimer: 'Based on real people who share this calendar birthday — not astrology, horoscopes, or predictions.',
  };
}
