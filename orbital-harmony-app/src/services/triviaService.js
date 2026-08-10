import { PLANETS_BY_KEY } from '../data/planets.js';
import { loadDateStory } from '../utils/dateStory.js';
import { loadFreshPatternFactoid } from '../utils/planetFactService.js';

const usedAiIdsByScope = new Map();

function configuredEndpoint() {
  const value = String(import.meta.env?.VITE_TRIVIA_API_URL ?? '').trim();
  if (value) return value;
  const protocol = globalThis.location?.protocol;
  if (protocol === 'http:' || protocol === 'https:') return '/api/trivia';
  throw new Error('AI trivia endpoint is not configured for this app origin');
}

function usedIds(scope) {
  if (!usedAiIdsByScope.has(scope)) usedAiIdsByScope.set(scope, new Set());
  return usedAiIdsByScope.get(scope);
}

function rememberId(scope, id) {
  if (!id) return;
  const used = usedIds(scope);
  used.add(id);
  if (used.size > 40) used.delete(used.values().next().value);
}

async function postTrivia(body, { signal, fetchImpl = globalThis.fetch, endpoint } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable');
  const response = await fetchImpl(endpoint ?? configuredEndpoint(), {
    method: 'POST',
    signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`AI trivia service returned ${response.status}`);
  const payload = await response.json();
  if (payload?.version !== 1 || typeof payload?.generatedBy !== 'string') {
    throw new Error('AI trivia service returned an invalid response');
  }
  return payload;
}

function dateScope(date) {
  return `birthday:${date.getUTCMonth() + 1}:${date.getUTCDate()}`;
}

function yearRelation(date, year, noun) {
  const selectedYear = date.getUTCFullYear();
  const gap = Math.abs(selectedYear - year);
  if (gap === 0) return noun === 'Born' ? 'Born in the same year as you' : 'On the day you were born';
  const direction = year < selectedYear ? 'before' : 'after';
  return `${gap} year${gap === 1 ? '' : 's'} ${direction} ${noun === 'Born' ? 'you' : 'your birth'}`;
}

function toDateStory(payload, date) {
  if (payload.kind !== 'birthday'
    || !['birth', 'event'].includes(payload.category)
    || !Number.isInteger(payload.year)
    || typeof payload.id !== 'string'
    || typeof payload.fact !== 'string'
    || typeof payload.headline !== 'string'
    || typeof payload.href !== 'string') {
    throw new Error('AI birthday trivia is incomplete');
  }
  const isBirth = payload.category === 'birth';
  return {
    id: `ai:${payload.id}`,
    kind: 'date-story',
    title: 'Birthday trivia',
    generatedBy: payload.generatedBy,
    insight: {
      id: payload.id,
      kicker: isBirth ? 'Birthday twin trivia' : 'On this date',
      headline: isBirth ? payload.headline : `${payload.year} · ${payload.headline}`,
      meta: isBirth
        ? `Born ${payload.year} · ${yearRelation(date, payload.year, 'Born')}`
        : yearRelation(date, payload.year, 'Happened'),
      fact: payload.fact,
      href: payload.href,
      source: payload.source || 'Wikipedia · CC BY-SA',
    },
  };
}

export async function loadBirthdayTrivia(date, options = {}) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return loadDateStory(date, options);
  const scope = dateScope(date);
  try {
    const payload = await postTrivia({
      kind: 'birthday',
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      excludeIds: [...usedIds(scope)],
    }, options);
    const story = toDateStory(payload, date);
    rememberId(scope, story.insight.id);
    return story;
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return loadDateStory(date, options);
  }
}

function toPlanetFactoid(payload, planetKeys, fallbackFactoid) {
  if (payload.kind !== 'planets' || !Array.isArray(payload.items)) {
    throw new Error('AI planet trivia is incomplete');
  }
  const fallbackByName = new Map((fallbackFactoid?.entries ?? []).map((entry) => [entry.name, entry]));
  const entries = planetKeys.map((planetKey) => {
    const planet = PLANETS_BY_KEY[planetKey];
    const item = payload.items.find((candidate) => candidate?.planetKey === planetKey);
    if (!planet || typeof item?.id !== 'string' || typeof item?.fact !== 'string' || typeof item?.href !== 'string') {
      throw new Error(`AI trivia is missing ${planetKey}`);
    }
    const fallback = fallbackByName.get(planet.name);
    return { name: planet.name, emoji: fallback?.emoji ?? '✦', fact: item.fact, id: item.id, href: item.href };
  });
  return {
    id: `ai:${entries.map(({ id }) => id).join(':')}`,
    title: 'Planet trivia',
    generatedBy: payload.generatedBy,
    sourceLabel: 'AI-curated · Wikipedia CC BY-SA',
    entries: entries.map(({ name, emoji, fact }) => ({ name, emoji, fact })),
    sources: entries.map(({ name, href }) => ({ name, href })),
    sourceIds: entries.map(({ id }) => id),
  };
}

export async function loadPlanetTrivia({ planetKeys, fallbackFactoid, signal, fetchImpl, endpoint }) {
  const uniquePlanetKeys = [...new Set(planetKeys)].filter((key) => PLANETS_BY_KEY[key]);
  const scope = `planets:${[...uniquePlanetKeys].sort().join(':')}`;
  try {
    const payload = await postTrivia({
      kind: 'planets',
      planetKeys: uniquePlanetKeys,
      excludeIds: [...usedIds(scope)],
    }, { signal, fetchImpl, endpoint });
    const factoid = toPlanetFactoid(payload, uniquePlanetKeys, fallbackFactoid);
    factoid.sourceIds.forEach((id) => rememberId(scope, id));
    return factoid;
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return loadFreshPatternFactoid({ planetKeys: uniquePlanetKeys, fallbackFactoid, signal });
  }
}