import { deriveBirthdayArchetype } from './birthdayArchetype.js';

const WIKIMEDIA_ON_THIS_DAY = 'https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday';

const archetypeCache = new Map();

const ACHIEVEMENT_WEIGHTS = [
  [/(nobel prize laureate|nobel laureate|pulitzer prize winner|booker prize winner|olympic gold|medal of freedom)/i, 32],
  [/(invented|discover(?:ed|y|ies)|pioneer|breakthrough|first (?:person|woman|man|author|artist|scientist)|second woman)/i, 28],
  [/(civil rights|human rights|independence movement|philanthrop)/i, 24],
  [/(found(?:ed|er)|co-founded|designed|created|developed|established)/i, 20],
  [/(hall of fame|world record|best-selling)/i, 18],
  [/(astronaut|cosmonaut|scientist|mathematician|physicist|chemist|engineer|physician|zoologist)/i, 16],
  [/(author|writer|artist|architect|composer|filmmaker|musician|journalist|educator|explorer)/i, 10],
  [/(\bwon\b|awarded|recipient|champion|influential|acclaimed|renowned|regarded)/i, 8],
];

const HARMFUL_PERSON = /(dictator|serial killer|murderer|nazi|warlord|slave trader|terrorist|sexual (?:assault|abuse|misconduct)|convicted|supremacist|fraudster|cult leader|extremist)/i;

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function dateParts(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

// Calendar day only (no year) — the archetype is about people born on this
// MONTH/DAY across any year, so two different birth years sharing the
// same calendar day should hit the same cache entry instead of each
// re-fetching/re-deriving the same underlying data.
function dateKey(date) {
  const { month, day } = dateParts(date);
  return `${pad2(month)}-${pad2(day)}`;
}

function normalizeUrl(url) {
  return typeof url === 'string' ? url.replace(/^http:/, 'https:') : null;
}

function firstPage(entry) {
  return entry?.pages?.find((page) => page?.titles?.normalized || page?.normalizedtitle) ?? null;
}

function weightedScore(text, weights) {
  return weights.reduce((score, [pattern, weight]) => score + (pattern.test(text) ? weight : 0), 0);
}

function splitSentences(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
}

function shorten(text, maxLength = 150) {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const clipped = normalized.slice(0, maxLength - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, Math.max(lastSpace, maxLength * 0.72))}…`;
}

function triviaSentence(text, maxLength = 110) {
  const [firstSentence = ''] = splitSentences(text);
  const simplified = firstSentence
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/,\s+(?:who|which|where|while|whereas)\b.*$/i, '')
    .replace(/\s+(?:while|whereas)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!simplified) return '';
  const punctuated = /[.!?…]$/.test(simplified) ? simplified : `${simplified}.`;
  return shorten(punctuated, maxLength);
}

function triviaComplexity(text) {
  const punctuationCount = (text.match(/[,;:()]/g) ?? []).length;
  const clauseCount = (text.match(/\b(?:although|however|which|while|whereas|who)\b/gi) ?? []).length;
  return Math.max(0, text.length - 90) * 0.4 + punctuationCount * 3 + clauseCount * 8;
}

function achievementSentence(page, fallback) {
  const ranked = [...splitSentences(page?.extract), fallback]
    .filter(Boolean)
    .map((sentence, index) => ({
      sentence,
      score: weightedScore(sentence, ACHIEVEMENT_WEIGHTS)
        - triviaComplexity(sentence)
        - index * 0.25,
    }))
    .sort((first, second) => second.score - first.score);
  return triviaSentence(ranked[0]?.sentence ?? fallback);
}

function occupationSentence(occupation) {
  if (!occupation) return '';
  const phrase = occupation.replace(/\s*\((?:born|died)[^)]*\)\s*$/i, '').trim();
  const credential = phrase.match(/,\s*(Nobel Prize laureate)$/i);
  const description = credential ? phrase.slice(0, credential.index) : phrase;
  const article = /^[aeiou]/i.test(phrase) ? 'An' : 'A';
  return credential
    ? `${article} ${description}. Also a ${credential[1]}.`
    : `${article} ${description}.`;
}

function birthScore(entry, referenceYear) {
  const page = firstPage(entry);
  const text = `${entry?.text ?? ''} ${page?.description ?? ''} ${page?.extract ?? ''}`;
  if (HARMFUL_PERSON.test(text)) return Number.NEGATIVE_INFINITY;
  const existedByReference = Number(entry?.year) <= referenceYear;
  return weightedScore(text, ACHIEVEMENT_WEIGHTS)
    + (page?.thumbnail ? 3 : 0)
    + (existedByReference ? 5 : 0);
}

function selectTop(entries, scorer, limit = 12) {
  return (entries ?? [])
    .map((entry) => ({ entry, score: scorer(entry), key: `${entry?.year ?? ''}:${entry?.text ?? ''}` }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((first, second) => second.score - first.score || first.key.localeCompare(second.key))
    .slice(0, limit)
    .map(({ entry }) => entry);
}

function toArchetypePerson(entry) {
  if (!entry) return null;
  const page = firstPage(entry);
  const name = page?.titles?.normalized ?? page?.normalizedtitle ?? String(entry.text).split(',')[0];
  const rawOccupation = String(entry.text ?? '').split(',').slice(1).join(',').trim();
  const occupation = occupationSentence(rawOccupation);

  return {
    name,
    occupation,
    fact: achievementSentence(page, occupation || entry.text),
    href: normalizeUrl(page?.content_urls?.desktop?.page),
  };
}

// The instant, offline placeholder shown the moment a Cosmic Signature
// pattern completes, before `loadBirthdayArchetype` below has resolved —
// `archetypeName: null` tells BirthdayArchetypeCard to render nothing
// rather than a half-built card.
export function createLocalBirthdayArchetype(date) {
  if (!isValidDate(date)) {
    return { id: 'birthday-archetype:unavailable', kind: 'birthday-archetype', title: 'Birthday Personality Archetype', archetypeName: null };
  }
  return {
    id: `birthday-archetype:${dateKey(date)}`,
    kind: 'birthday-archetype',
    title: 'Birthday Personality Archetype',
    archetypeName: null,
  };
}

async function fetchCategory(category, date, signal) {
  const { month, day } = dateParts(date);
  const response = await fetch(`${WIKIMEDIA_ON_THIS_DAY}/${category}/${pad2(month)}/${pad2(day)}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Wikimedia ${category} request failed: ${response.status}`);
  const payload = await response.json();
  return payload[category] ?? [];
}

// Second, independent "on this day" source (Muffin Labs' History API,
// itself Wikipedia-derived but a different curated dataset/selection than
// Wikimedia's on-this-day feed — see MUFFIN_LABS_HISTORY). Its entries
// don't carry a `pages`/`extract` payload like Wikimedia's, so they're
// adapted into the SAME shape `firstPage()`/birthScore/toArchetypePerson
// already expect (a `pages` array with a `titles`/`content_urls`/
// `extract`), letting them fold into the existing scoring/selection
// pipeline with no changes there.
const MUFFIN_LABS_HISTORY = 'https://history.muffinlabs.com/date';

function toWikimediaLikeEntry(muffinEntry) {
  const primaryLink = muffinEntry?.links?.[0];
  return {
    year: muffinEntry?.year,
    text: muffinEntry?.text,
    pages: primaryLink
      ? [{
          titles: { normalized: primaryLink.title },
          normalizedtitle: primaryLink.title,
          content_urls: { desktop: { page: primaryLink.link } },
        }]
      : [],
  };
}

async function fetchMuffinLabsCategory(category, date, signal) {
  const { month, day } = dateParts(date);
  const response = await fetch(`${MUFFIN_LABS_HISTORY}/${month}/${day}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Muffin Labs ${category} request failed: ${response.status}`);
  const payload = await response.json();
  return (payload?.data?.[category] ?? []).map(toWikimediaLikeEntry);
}

// Builds the whole "Your Birthday Personality Archetype" card for a given
// calendar day — unlike the old single-insight rotation, this result is
// STABLE per date (the tribe/theme doesn't change on repeat visits), so
// it's cached indefinitely per day rather than rotated.
export async function loadBirthdayArchetype(date, { signal } = {}) {
  if (!isValidDate(date)) return createLocalBirthdayArchetype(date);
  const key = dateKey(date);
  if (archetypeCache.has(key)) return archetypeCache.get(key);

  const [wikimediaBirths, muffinBirths] = await Promise.allSettled([
    fetchCategory('births', date, signal),
    fetchMuffinLabsCategory('Births', date, signal),
  ]);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if ([wikimediaBirths, muffinBirths].every((r) => r.status === 'rejected')) {
    throw new Error('Birthday archetype data is unavailable');
  }

  const births = [
    ...(wikimediaBirths.status === 'fulfilled' ? wikimediaBirths.value : []),
    ...(muffinBirths.status === 'fulfilled' ? muffinBirths.value : []),
  ];

  // Reference year only breaks scoring ties (existedByReference) — the
  // whole point of this feature is people born on the same calendar day
  // across ANY year, not just before/after the viewer's own birth year.
  const referenceYear = date.getUTCFullYear();
  const people = selectTop(births, (entry) => birthScore(entry, referenceYear), 10)
    .map((entry) => toArchetypePerson(entry))
    .filter((person) => person?.name);
  // Wikimedia and Muffin Labs sometimes both surface the same person.
  const uniquePeople = [...new Map(people.map((person) => [person.name, person])).values()].slice(0, 6);
  if (uniquePeople.length < 3) throw new Error('Not enough notable people to build a birthday archetype');

  const archetype = deriveBirthdayArchetype(uniquePeople);
  const result = {
    id: `birthday-archetype:${key}`,
    kind: 'birthday-archetype',
    title: 'Birthday Personality Archetype',
    ...archetype,
  };
  archetypeCache.set(key, result);
  return result;
}