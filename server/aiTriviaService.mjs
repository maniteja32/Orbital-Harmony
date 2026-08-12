const WIKIMEDIA_ON_THIS_DAY = 'https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday';
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const POLLINATIONS_TEXT = 'https://text.pollinations.ai/';

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

function toBirthdayCandidate(entry) {
  const page = firstPage(entry);
  const fallbackTitle = String(entry?.text ?? '').split(',')[0];
  const title = pageTitle(page, fallbackTitle);
  const extract = splitSentences(page?.extract)
    .filter((s) => s.length >= 30 && s.length <= 300)
    .slice(0, 1)
    .join(' ');
  
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
  const response = await fetchImpl(
    `${WIKIMEDIA_ON_THIS_DAY}/births/${monthPart}/${dayPart}`,
    { headers: { Accept: 'application/json', 'Api-User-Agent': 'OrbitalHarmony/1.0' } }
  );
  if (!response.ok) throw new AiTriviaError('SOURCE_UNAVAILABLE', `Wikimedia returned ${response.status}`, 502);
  const data = await response.json();
  const candidates = (data?.births ?? [])
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
