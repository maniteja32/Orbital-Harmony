import assert from 'node:assert/strict';
import test from 'node:test';
import { generateGroundedTrivia } from './aiTriviaService.mjs';

function birthdayFetchWithRephrasing() {
  return async (url) => {
    const target = String(url);
    if (target.includes('/births/02/21')) {
      return new Response(JSON.stringify({
        births: [{
          year: 1903,
          text: 'Raymond Queneau, French poet and author',
          pages: [{
            pageid: 123,
            titles: { normalized: 'Raymond Queneau' },
            extract: 'Raymond Queneau was a French poet and author known for playful experimental fiction and innovative narrative techniques.',
            content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Raymond_Queneau' } },
          }],
        }],
      }), { status: 200 });
    }
    if (target.includes('text.pollinations.ai')) {
      return new Response(JSON.stringify({
        text: 'A French wordsmith who turned narrative inside out with delightful ingenuity.'
      }), { status: 200 });
    }
    throw new Error(`Unexpected URL: ${target}`);
  };
}

function planetsFetchWithRephrasing() {
  return async (url) => {
    const target = String(url);
    if (target.startsWith('https://en.wikipedia.org/w/api.php')) {
      const title = new URL(target).searchParams.get('titles');
      return new Response(JSON.stringify({
        query: {
          pages: [{
            pageid: 10,
            fullurl: `https://en.wikipedia.org/wiki/${title}`,
            extract: `${title} is the third planet from the Sun in the Solar System. ${title} orbits at an average distance of 149.6 million kilometers from the Sun. ${title} has one natural satellite, the Moon.`,
          }],
        },
      }), { status: 200 });
    }
    if (target.includes('text.pollinations.ai')) {
      return new Response(JSON.stringify({
        text: 'Our blue marble spins at a perfect distance from the Sun, cradled by its faithful Moon.'
      }), { status: 200 });
    }
    throw new Error(`Unexpected URL: ${target}`);
  };
}

test('rephrases and elevates birthday trivia while keeping facts intact', async () => {
  const result = await generateGroundedTrivia(
    { kind: 'birthday', month: 2, day: 21 },
    { fetchImpl: birthdayFetchWithRephrasing() }
  );
  assert.equal(result.kind, 'birthday');
  assert.equal(result.year, 1903);
  assert.ok(result.fact.length > 20);
  assert.equal(result.href, 'https://en.wikipedia.org/wiki/Raymond_Queneau');
  assert.equal(result.source, 'Wikipedia · CC BY-SA');
});

test('rephrases and elevates planet trivia while keeping facts intact', async () => {
  const result = await generateGroundedTrivia(
    { kind: 'planets', planetKeys: ['earth'] },
    { fetchImpl: planetsFetchWithRephrasing() }
  );
  assert.equal(result.kind, 'planets');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].planetKey, 'earth');
  assert.ok(result.items[0].fact.length > 20);
  assert.equal(result.items[0].source, 'Wikipedia · CC BY-SA');
});

test('falls back to sourced fact if rephrasing fails', async () => {
  const fallbackFetch = async (url) => {
    const target = String(url);
    if (target.includes('/births/02/21')) {
      return new Response(JSON.stringify({
        births: [{
          year: 1903,
          text: 'Raymond Queneau, French poet and author',
          pages: [{
            pageid: 123,
            titles: { normalized: 'Raymond Queneau' },
            extract: 'Raymond Queneau was a French poet and author known for playful experimental fiction.',
            content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Raymond_Queneau' } },
          }],
        }],
      }), { status: 200 });
    }
    if (target.includes('text.pollinations.ai')) {
      throw new Error('Pollinations unavailable');
    }
    throw new Error(`Unexpected URL: ${target}`);
  };

  const result = await generateGroundedTrivia(
    { kind: 'birthday', month: 2, day: 21 },
    { fetchImpl: fallbackFetch }
  );
  assert.equal(result.generatedBy, 'wikimedia');
  assert.ok(result.fact.includes('French') || result.fact.includes('poet'));
});
