const WIKIMEDIA_ON_THIS_DAY = 'https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday';
// Second, independently-curated "on this day" source, mixed in alongside
// Wikimedia so birthday trivia isn't drawn from a single feed. No API key
// required.
const MUFFIN_LABS_HISTORY = 'https://history.muffinlabs.com/date';
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const POLLINATIONS_TEXT = 'https://text.pollinations.ai/';

// Local, non-Wikipedia numeric fact source (see the matching client copy in
// src/utils/planetPhysicalFacts.js): hand-curated real physical constants
// turned into short template sentences, mixed into the Wikipedia-sentence
// candidate pool below so grounded planet trivia draws from two
// differently-sourced pools instead of Wikipedia extraction alone. Moon
// counts use "at least N" phrasing so they stay true as new moons are found.
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

function generatePhysicalFacts(planetKey, planetName) {
  const data = PLANET_PHYSICAL_DATA[planetKey];
  if (!data) return [];
  return [
    `${planetName}'s surface gravity is about ${data.gravityG.toFixed(2)}× Earth's.`,
    `A day on ${planetName} lasts about ${formatDayLength(data.dayHours)}.`,
    `${planetName} has ${moonPhrase(data.moons)}.`,
    `${planetName}'s mean radius is about ${Math.round(data.meanRadiusKm).toLocaleString()} km.`,
    `${planetName} ${data.trait}.`,
  ];
}

// Live physical data from api.le-systeme-solaire.net, used when
// SOLAR_SYSTEM_API_KEY is configured (server-only env var — never exposed
// to the client bundle). Falls back to the static PLANET_PHYSICAL_DATA
// table above whenever the key is missing or the request fails, so this is
// purely an upgrade over the static table, never a hard dependency.
const SOLAR_SYSTEM_API = 'https://api.le-systeme-solaire.net/rest/bodies';
const SOLAR_SYSTEM_BODY_IDS = {
  mercury: 'mercure',
  venus: 'venus',
  earth: 'terre',
  mars: 'mars',
  jupiter: 'jupiter',
  saturn: 'saturne',
  uranus: 'uranus',
  neptune: 'neptune',
};
const EARTH_SURFACE_GRAVITY = 9.80665;

async function fetchLiveSolarSystemFacts(planetKey, planetName, fetchImpl) {
  const apiKey = process.env.SOLAR_SYSTEM_API_KEY;
  const bodyId = SOLAR_SYSTEM_BODY_IDS[planetKey];
  if (!apiKey || !bodyId) return null;
  try {
    const response = await fetchImpl(`${SOLAR_SYSTEM_API}/${bodyId}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return null;
    const body = await response.json();

    const sentences = [];
    if (typeof body?.gravity === 'number') {
      sentences.push(`${planetName}'s surface gravity is about ${(body.gravity / EARTH_SURFACE_GRAVITY).toFixed(2)}× Earth's.`);
    }
    if (typeof body?.sideralRotation === 'number') {
      sentences.push(`A day on ${planetName} lasts about ${formatDayLength(Math.abs(body.sideralRotation))}.`);
    }
    if (Array.isArray(body?.moons)) {
      sentences.push(`${planetName} has ${moonPhrase(body.moons.length)}.`);
    }
    if (typeof body?.meanRadius === 'number') {
      sentences.push(`${planetName}'s mean radius is about ${Math.round(body.meanRadius).toLocaleString()} km.`);
    }
    if (typeof body?.avgTemp === 'number' && body.avgTemp > 0) {
      sentences.push(`${planetName}'s average temperature is about ${Math.round(body.avgTemp - 273.15)}°C.`);
    }
    if (body?.discoveredBy) {
      sentences.push(`${planetName} was discovered by ${body.discoveredBy}${body.discoveryDate ? ` in ${body.discoveryDate}` : ''}.`);
    }
    return sentences.length > 0 ? sentences : null;
  } catch {
    return null;
  }
}

const PLANET_ARTICLES = {
  mercury: 'Mercury (planet)',
  venus: 'Venus',
  earth: 'Earth',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
};

const UNSUITABLE_PLANET_FACT = /(astrolog|fiction|mytholog|named after|popular culture|religion|science fiction|societies|terraform|deity|god of)/i;

export class AiTriviaError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = 'AiTriviaError';
    this.code = code;
    this.status = status;
  }
}

function normalizeText(value, maxLength = 420) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function splitSentences(value) {
  return normalizeText(value, 4000)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function firstPage(entry) {
  return entry?.pages?.find((page) => page?.titles?.normalized || page?.normalizedtitle) ?? null;
}

function pageTitle(page, fallback) {
  return page?.titles?.normalized ?? page?.normalizedtitle ?? fallback;
}

function pageUrl(page) {
  const value = page?.content_urls?.desktop?.page ?? page?.fullurl;
  return typeof value === 'string' ? value.replace(/^http:/, 'https:') : null;
}

function rankBirthdayEntry(entry) {
  const page = firstPage(entry);
  const text = `${entry?.text ?? ''} ${page?.description ?? ''} ${page?.extract ?? ''}`;
  let score = page?.thumbnail ? 3 : 0;
  if (/(first|invent|discover|record|nobel|olympic|space|science|author|artist|composer|engineer|actor|director)/i.test(text)) score += 8;
  return score;
}

function toWikimediaLikeEntry(muffinEntry) {
  const primaryLink = muffinEntry?.links?.[0];
  return {
    year: muffinEntry?.year,
    text: muffinEntry?.text,
    pages: primaryLink
      ? [{ titles: { normalized: primaryLink.title }, content_urls: { desktop: { page: primaryLink.link } } }]
      : [],
  };
}

async function fetchMuffinLabsBirthdayEntries({ month, day }, fetchImpl) {
  const response = await fetchImpl(`${MUFFIN_LABS_HISTORY}/${month}/${day}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) return [];
  const data = await response.json();
  return (data?.data?.Births ?? []).map(toWikimediaLikeEntry);
}

function toBirthdayCandidate(entry) {
  const page = firstPage(entry);
  const fallbackTitle = String(entry?.text ?? '').split(',')[0];
  const title = pageTitle(page, fallbackTitle);
  // Muffin Labs entries carry no `page.extract`, so fall back to their own
  // (already concise) one-line `text` description instead of an empty string.
  const extract = splitSentences(page?.extract)
    .filter((s) => s.length >= 30 && s.length <= 300)
    .slice(0, 1)
    .join(' ') || normalizeText(entry?.text, 300);
  
  return {
    id: `${entry?.year}:${pageTitle(page, title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    year: Number(entry?.year),
    headline: normalizeText(title, 100),
    fact: normalizeText(extract, 280),
    href: pageUrl(page),
  };
}

function scorePlanetSentence(sentence, planetName) {
  let score = sentence.includes(planetName) ? 5 : 0;
  if (/\d/.test(sentence)) score += 2;
  if (/(only|first|largest|smallest|fastest|longest|strongest|atmosphere|moon|orbit|ring|rotation|surface|temperature|water|wind|system|gas|rock|ice)/i.test(sentence)) score += 6;
  return score - Math.max(0, sentence.length - 120) * 0.1;
}

async function fetchBirthdayCandidates({ month, day }, fetchImpl) {
  const monthPart = String(month).padStart(2, '0');
  const dayPart = String(day).padStart(2, '0');
  const [wikimediaResult, muffinResult] = await Promise.allSettled([
    (async () => {
      const response = await fetchImpl(
        `${WIKIMEDIA_ON_THIS_DAY}/births/${monthPart}/${dayPart}`,
        { headers: { Accept: 'application/json', 'Api-User-Agent': 'OrbitalHarmony/1.0' } }
      );
      if (!response.ok) throw new Error(`Wikimedia returned ${response.status}`);
      return ((await response.json())?.births ?? []);
    })(),
    fetchMuffinLabsBirthdayEntries({ month, day }, fetchImpl),
  ]);
  if (wikimediaResult.status === 'rejected' && (muffinResult.status === 'rejected' || muffinResult.value.length === 0)) {
    throw new AiTriviaError('SOURCE_UNAVAILABLE', 'Wikimedia and Muffin Labs both returned no births', 502);
  }
  const entries = [
    ...(wikimediaResult.status === 'fulfilled' ? wikimediaResult.value : []),
    ...(muffinResult.status === 'fulfilled' ? muffinResult.value : []),
  ];
  const candidates = entries
    .map((entry) => ({ entry, score: rankBirthdayEntry(entry) }))
    .filter(({ score }) => Number.isFinite(score) && score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, 12)
    .map(({ entry }) => toBirthdayCandidate(entry))
    .filter((candidate) => candidate.href && candidate.fact.length >= 30);
  
  if (candidates.length === 0) {
    throw new AiTriviaError('SOURCE_UNAVAILABLE', 'No suitable birthday trivia sources were found', 502);
  }
  return candidates.slice(0, 8);
}

async function fetchPlanetCandidates({ planetKeys }, fetchImpl) {
  const groups = await Promise.all(planetKeys.map(async (planetKey) => {
    const articleTitle = PLANET_ARTICLES[planetKey];
    const planetName = planetKey[0].toUpperCase() + planetKey.slice(1);
    const url = new URL(WIKIPEDIA_API);
    url.search = new URLSearchParams({
      action: 'query',
      prop: 'extracts|info',
      explaintext: '1',
      inprop: 'url',
      redirects: '1',
      titles: articleTitle,
      format: 'json',
      formatversion: '2',
    });
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new AiTriviaError('SOURCE_UNAVAILABLE', `Wikipedia returned ${response.status}`, 502);
    const page = (await response.json())?.query?.pages?.[0];
    const href = pageUrl(page) ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(articleTitle.replaceAll(' ', '_'))}`;
    // Kept short (<=140 chars) so the Result screen's knowledge card never
    // grows tall enough to push the action buttons below the fold.
    const candidates = splitSentences(page?.extract)
      .filter((sentence) => sentence.length >= 40 && sentence.length <= 140)
      .filter((sentence) => new RegExp(`\\b${planetName}(?:'s)?\\b`, 'i').test(sentence))
      .filter((sentence) => !UNSUITABLE_PLANET_FACT.test(sentence))
      .map((sentence, index) => ({
        id: `${planetKey}:${index}`,
        planetKey,
        headline: planetName,
        fact: normalizeText(sentence, 140),
        href,
        score: scorePlanetSentence(sentence, planetName),
      }))
      .sort((first, second) => second.score - first.score)
      .slice(0, 8);
    // Mix in physical-fact sentences (live api.le-systeme-solaire.net data
    // when SOLAR_SYSTEM_API_KEY is configured, otherwise the static
    // PLANET_PHYSICAL_DATA table) so the pool draws from two differently-
    // sourced pools instead of Wikipedia extraction alone.
    const physicalSentences = (await fetchLiveSolarSystemFacts(planetKey, planetName, fetchImpl))
      ?? generatePhysicalFacts(planetKey, planetName);
    const physicalCandidates = physicalSentences.map((sentence, index) => ({
      id: `${planetKey}:physical:${index}`,
      planetKey,
      headline: planetName,
      fact: sentence,
      href,
    }));
    candidates.push(...physicalCandidates);
    
    if (candidates.length === 0) {
      throw new AiTriviaError('SOURCE_UNAVAILABLE', `No suitable facts were found for ${planetName}`, 502);
    }
    return candidates;
  }));
  return groups.flat();
}

async function rephraseFact(sourceFact, fetchImpl, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(POLLINATIONS_TEXT, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Rephrase this fact in a delightful, whimsical, but factually accurate way:\n\n"${sourceFact}"\n\nKeep it under 120 characters. Do not add new information, only rephrase elegantly.`,
        temperature: 0.7,
        max_length: 150,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const text = typeof data === 'string' ? data : data?.text || '';
    return normalizeText(text, 140).length > 15 ? normalizeText(text, 140) : null;
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateGroundedTrivia(input, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new AiTriviaError('SOURCE_UNAVAILABLE', 'Fetch is unavailable', 500);

  if (input.kind === 'birthday') {
    const candidates = await fetchBirthdayCandidates(input, fetchImpl);
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    const rephrased = await rephraseFact(selected.fact, fetchImpl);
    return {
      version: 1,
      kind: 'birthday',
      generatedBy: rephrased ? 'pollinations' : 'wikimedia',
      model: rephrased ? 'text' : 'sourced',
      id: selected.id,
      category: 'birth',
      year: selected.year,
      headline: selected.headline,
      fact: rephrased || selected.fact,
      href: selected.href,
      source: 'Wikipedia · CC BY-SA',
    };
  }

  if (input.kind === 'planets') {
    const candidates = await fetchPlanetCandidates(input, fetchImpl);
    const items = input.planetKeys.map((planetKey) => {
      const available = candidates.filter((c) => c.planetKey === planetKey);
      const selected = available[Math.floor(Math.random() * available.length)];
      if (!selected) throw new AiTriviaError('SOURCE_UNAVAILABLE', `No facts for ${planetKey}`, 502);
      return selected;
    });

    const rephrased = await Promise.all(
      items.map((item) => rephraseFact(item.fact, fetchImpl))
    );

    return {
      version: 1,
      kind: 'planets',
      generatedBy: rephrased.some((r) => r) ? 'pollinations' : 'wikipedia',
      model: rephrased.some((r) => r) ? 'text' : 'sourced',
      items: items.map((item, index) => ({
        planetKey: item.planetKey,
        id: item.id,
        headline: item.headline,
        fact: rephrased[index] || item.fact,
        href: item.href,
        source: 'Wikipedia · CC BY-SA',
      })),
    };
  }

  throw new AiTriviaError('INVALID_REQUEST', 'Unsupported trivia kind', 400);
}
