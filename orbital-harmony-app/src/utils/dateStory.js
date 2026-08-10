const WIKIMEDIA_ON_THIS_DAY = 'https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday';

const storyCache = new Map();
const usedInsightsByDate = new Map();

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

const EVENT_WEIGHTS = [
  [/(spacecraft|space shuttle|satellite|spaceflight|moon|nasa)/i, 32],
  [/(discovered|invented|first |opened|launched|completed)/i, 26],
  [/(science|scientific|medical|technology|engineering)/i, 20],
  [/(published|premiered|released|founded|established)/i, 16],
  [/(rights|independence|peace|treaty|record|championship)/i, 12],
];

const HARMFUL_PERSON = /(dictator|serial killer|murderer|nazi|warlord|slave trader|terrorist|sexual (?:assault|abuse|misconduct)|convicted|supremacist|fraudster|cult leader|extremist)/i;
const TRAGIC_EVENT = /(annex|armed|army|assassinat|attack|battle|bomb|casualt|collision|conquest|coup|crash|death|defeat|derail|disaster|earthquake|executed|explosion|fire kills|flood|forces led|genocide|hostage|hurricane|injured|invasion|kidnap|killed|massacre|military|murdered|occupation|rebel|revolt|riot|shooting|siege|sank|sinking|tornado|troops|typhoon|uprising|war begins|war:|wounded)/i;

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

function dateKey(date) {
  const { year, month, day } = dateParts(date);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function randomIndex(count) {
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    globalThis.crypto.getRandomValues(value);
    return value[0] % count;
  }
  return Math.floor(Math.random() * count);
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

function birthScore(entry, birthYear) {
  const page = firstPage(entry);
  const text = `${entry?.text ?? ''} ${page?.description ?? ''} ${page?.extract ?? ''}`;
  if (HARMFUL_PERSON.test(text)) return Number.NEGATIVE_INFINITY;
  const existedByBirth = Number(entry?.year) <= birthYear;
  return weightedScore(text, ACHIEVEMENT_WEIGHTS)
    + (page?.thumbnail ? 3 : 0)
    + (existedByBirth ? 5 : 0);
}

function eventScore(entry, birthYear) {
  const page = firstPage(entry);
  const fullText = `${entry?.text ?? ''} ${page?.description ?? ''} ${page?.extract ?? ''}`;
  if (TRAGIC_EVENT.test(fullText)) return Number.NEGATIVE_INFINITY;
  const relevance = weightedScore(`${entry?.text ?? ''} ${page?.description ?? ''}`, EVENT_WEIGHTS);
  if (relevance < 8) return Number.NEGATIVE_INFINITY;
  const happenedByBirth = Number(entry?.year) <= birthYear;
  const yearDistance = Math.abs(birthYear - Number(entry?.year));
  const exactYearBonus = Number(entry?.year) === birthYear && relevance >= 8 ? 40 : 0;
  return relevance
    + (page?.thumbnail ? 2 : 0)
    + (happenedByBirth ? 5 : 0)
    + Math.max(0, 5 - Math.log10(Math.max(1, yearDistance)))
    + exactYearBonus;
}

function selectTop(entries, scorer, limit = 12) {
  return (entries ?? [])
    .map((entry) => ({ entry, score: scorer(entry), key: `${entry?.year ?? ''}:${entry?.text ?? ''}` }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((first, second) => second.score - first.score || first.key.localeCompare(second.key))
    .slice(0, limit)
    .map(({ entry }) => entry);
}

function takeUnusedInsight(key, insights) {
  const used = usedInsightsByDate.get(key) ?? new Set();
  let available = insights.filter((insight) => !used.has(insight.id));

  if (available.length === 0) {
    const lastUsed = [...used].at(-1);
    used.clear();
    if (lastUsed) used.add(lastUsed);
    available = insights.filter((insight) => !used.has(insight.id));
  }

  const insight = available[randomIndex(available.length)] ?? insights[0];
  used.add(insight.id);
  usedInsightsByDate.set(key, used);
  return insight;
}

function toPersonSection(entry, birthDate) {
  if (!entry) return null;
  const page = firstPage(entry);
  const name = page?.titles?.normalized ?? page?.normalizedtitle ?? String(entry.text).split(',')[0];
  const occupation = String(entry.text ?? '').split(',').slice(1).join(',').trim();
  const yearGap = Math.abs(birthDate.getUTCFullYear() - Number(entry.year));
  const relation = yearGap === 0
    ? 'Born in the same year as you'
    : `${yearGap} year${yearGap === 1 ? '' : 's'} ${Number(entry.year) < birthDate.getUTCFullYear() ? 'before' : 'after'} you`;

  return {
    id: `person:${entry.year}:${page?.pageid ?? name}`,
    kicker: 'Birthday twin trivia',
    headline: name,
    meta: `Born ${entry.year} · ${relation}`,
    fact: achievementSentence(page, occupationSentence(occupation) || entry.text),
    href: normalizeUrl(page?.content_urls?.desktop?.page),
    source: 'Wikipedia · CC BY-SA',
  };
}

function toHistorySection(entry, birthDate) {
  if (!entry) return null;
  const page = firstPage(entry);
  const yearGap = Math.abs(birthDate.getUTCFullYear() - Number(entry.year));
  const relation = yearGap === 0
    ? 'On the day you were born'
    : `${yearGap} year${yearGap === 1 ? '' : 's'} ${Number(entry.year) < birthDate.getUTCFullYear() ? 'before' : 'after'} your birth`;

  return {
    id: `history:${entry.year}:${page?.pageid ?? entry.text}`,
    kicker: 'On this date',
    headline: `${entry.year} · ${page?.titles?.normalized ?? page?.normalizedtitle ?? 'On this day'}`,
    meta: relation,
    fact: triviaSentence(entry.text),
    href: normalizeUrl(page?.content_urls?.desktop?.page),
    source: 'Wikipedia · CC BY-SA',
  };
}

export function createLocalDateStory(date) {
  if (!isValidDate(date)) {
    return { id: 'date-story:unavailable', title: 'Birthday trivia', insight: null };
  }
  return {
    id: `date-story:${dateKey(date)}`,
    kind: 'date-story',
    title: 'Birthday trivia',
    insight: null,
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

export async function loadDateStory(date, { signal } = {}) {
  if (!isValidDate(date)) return createLocalDateStory(date);
  const key = dateKey(date);
  let insights = storyCache.get(key);

  if (!insights) {
    const [birthsResult, eventsResult] = await Promise.allSettled([
      fetchCategory('births', date, signal),
      fetchCategory('events', date, signal),
    ]);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (birthsResult.status === 'rejected' && eventsResult.status === 'rejected') {
      throw new Error('Date history is unavailable');
    }

    const birthYear = date.getUTCFullYear();
    const people = birthsResult.status === 'fulfilled'
      ? selectTop(birthsResult.value, (entry) => birthScore(entry, birthYear))
        .map((entry) => toPersonSection(entry, date))
      : [];
    const history = eventsResult.status === 'fulfilled'
      ? selectTop(eventsResult.value, (entry) => eventScore(entry, birthYear))
        .map((entry) => toHistorySection(entry, date))
      : [];
    insights = [...people, ...history].filter(Boolean);
    if (insights.length === 0) throw new Error('No suitable date insights are available');
    storyCache.set(key, insights);
  }

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const insight = takeUnusedInsight(key, insights);
  return {
    id: `date-story:${key}:${insight.id}`,
    kind: 'date-story',
    title: 'Birthday trivia',
    insight,
  };
}