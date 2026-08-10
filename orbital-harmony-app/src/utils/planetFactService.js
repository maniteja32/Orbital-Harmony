import { PLANETS_BY_KEY } from '../data/planets.js';

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const STORAGE_PREFIX = 'space-harmony:wikipedia-facts:';

const ARTICLE_BY_PLANET = {
  mercury: 'Mercury (planet)',
  venus: 'Venus',
  earth: 'Earth',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
};

const CARD_TITLES = ['Planet field notes', 'From the observatory', 'Worlds in focus', 'Cosmic discoveries'];
const articleCache = new Map();
const usedFactsByPlanet = new Map();

const UNSUITABLE_FACT = /(amateur telescope|astrolog|binocular|cultures|fiction|\bhuman(?:s|ity)?\b|mytholog|naked eye|named after|objective diameter|popular culture|red giant|religion|science fiction|societies|terraform|astronomical symbol|deity|god of)/i;
const INTERESTING_FACT = /(atmosphere|axis|cloud|core|crater|density|discovered|field|first|gravity|largest|magnetic|mantle|mission|moon|ocean|orbit|pressure|ring|rotation|smallest|spacecraft|surface|temperature|tilt|volcan|water|wind)/i;

function randomIndex(count) {
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    globalThis.crypto.getRandomValues(value);
    return value[0] % count;
  }
  return Math.floor(Math.random() * count);
}

function factId(fact) {
  let hash = 2166136261;
  for (const character of fact) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function getUsedFacts(planetKey) {
  if (usedFactsByPlanet.has(planetKey)) return usedFactsByPlanet.get(planetKey);

  let used = new Set();
  try {
    const stored = globalThis.sessionStorage?.getItem(`${STORAGE_PREFIX}${planetKey}`);
    if (stored) used = new Set(JSON.parse(stored));
  } catch {
    used = new Set();
  }
  usedFactsByPlanet.set(planetKey, used);
  return used;
}

function rememberFact(planetKey, id) {
  const used = getUsedFacts(planetKey);
  used.add(id);
  try {
    globalThis.sessionStorage?.setItem(`${STORAGE_PREFIX}${planetKey}`, JSON.stringify([...used]));
  } catch {
    // Session storage is a best-effort enhancement; in-memory rotation remains.
  }
}

function scoreFact(sentence, planetName) {
  let score = 0;
  if (sentence.startsWith(planetName) || sentence.startsWith(`${planetName}'s`)) score += 5;
  if (/\d/.test(sentence)) score += 3;
  if (/(only|first|largest|smallest|fastest|longest|strongest|more than|less than)/i.test(sentence)) score += 5;
  if (INTERESTING_FACT.test(sentence)) score += 4;
  if (sentence.length >= 80 && sentence.length <= 180) score += 2;
  if (/(may|might|possibly|probably|suggests?)/i.test(sentence)) score -= 2;
  return score;
}

export function extractPlanetFacts(extract, planetName) {
  const planetPattern = new RegExp(`\\b${planetName}(?:'s)?\\b`, 'i');
  const normalized = String(extract ?? '')
    .replace(/^=+.*=+$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return [...new Set(normalized
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 60 && sentence.length <= 220)
    .filter((sentence) => planetPattern.test(sentence))
    .filter((sentence) => !/^(it|this|these|they|there|however|therefore|consequently|although|because|while|such|the (?:former|latter)|a related|(?:both|one|either|neither) of (?:these|those)|after this|later that|(?:on|at) the (?:other|opposite)|\w+ years? later)\b/i.test(sentence))
    .filter((sentence) => !UNSUITABLE_FACT.test(sentence))
    .map((sentence) => ({ sentence, score: scoreFact(sentence, planetName) }))
    .filter(({ score }) => score >= 4)
    .sort((first, second) => second.score - first.score || first.sentence.localeCompare(second.sentence))
    .slice(0, 80)
    .map(({ sentence }) => sentence))];
}

async function loadArticle(planetKey, signal) {
  if (articleCache.has(planetKey)) return articleCache.get(planetKey);

  const articleTitle = ARTICLE_BY_PLANET[planetKey];
  const planet = PLANETS_BY_KEY[planetKey];
  if (!articleTitle || !planet) throw new Error(`Unsupported planet: ${planetKey}`);

  const url = new URL(WIKIPEDIA_API);
  url.search = new URLSearchParams({
    action: 'query',
    prop: 'extracts|info',
    explaintext: '1',
    inprop: 'url',
    redirects: '1',
    origin: '*',
    titles: articleTitle,
    format: 'json',
    formatversion: '2',
  });
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Wikipedia request failed: ${response.status}`);
  const page = (await response.json()).query?.pages?.[0];
  const facts = extractPlanetFacts(page?.extract, planet.name);
  if (facts.length === 0) throw new Error(`No suitable Wikipedia facts found for ${planet.name}`);

  const article = {
    facts,
    href: page?.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(articleTitle.replaceAll(' ', '_'))}`,
  };
  articleCache.set(planetKey, article);
  return article;
}

function takeUnusedFact(planetKey, facts) {
  const used = getUsedFacts(planetKey);
  let available = facts.filter((fact) => !used.has(factId(fact)));

  if (available.length === 0) {
    const lastUsed = [...used].at(-1);
    used.clear();
    if (lastUsed) used.add(lastUsed);
    available = facts.filter((fact) => !used.has(factId(fact)));
  }

  const fact = available[randomIndex(available.length)] ?? facts[0];
  rememberFact(planetKey, factId(fact));
  return fact;
}

export async function loadFreshPatternFactoid({ planetKeys, fallbackFactoid, signal }) {
  const uniquePlanetKeys = [...new Set(planetKeys)].filter((key) => PLANETS_BY_KEY[key]);
  const fallbackByName = new Map((fallbackFactoid?.entries ?? []).map((entry) => [entry.name, entry]));
  const results = await Promise.allSettled(uniquePlanetKeys.map((key) => loadArticle(key, signal)));
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  let sourcedCount = 0;
  const sources = [];
  const entries = uniquePlanetKeys.map((planetKey, index) => {
    const planet = PLANETS_BY_KEY[planetKey];
    const result = results[index];
    const fallback = fallbackByName.get(planet.name) ?? { name: planet.name, emoji: '🪐', fact: planet.fact };
    if (result.status !== 'fulfilled') return fallback;

    sourcedCount += 1;
    const fact = takeUnusedFact(planetKey, result.value.facts);
    sources.push({ name: planet.name, href: result.value.href });
    return { ...fallback, fact };
  });

  if (sourcedCount === 0) throw new Error('Wikipedia planet facts are unavailable');
  return {
    id: `wikipedia:${uniquePlanetKeys.join(':')}:${entries.map((entry) => factId(entry.fact)).join(':')}`,
    title: CARD_TITLES[randomIndex(CARD_TITLES.length)],
    entries,
    sources,
  };
}