import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AiTriviaError,
  describeAiConfiguration,
  generateGroundedTrivia,
  getAiConfiguration,
} from './aiTriviaService.mjs';

function birthdayFetch(modelFact = 'Raymond Queneau was a French poet and author.') {
  return async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/births/08/03')) {
      return new Response(JSON.stringify({
        births: [{
          year: 1903,
          text: 'Raymond Queneau, French poet and author',
          pages: [{
            pageid: 123,
            titles: { normalized: 'Raymond Queneau' },
            extract: 'Raymond Queneau was a French poet and author.',
            content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Raymond_Queneau' } },
          }],
        }],
      }), { status: 200 });
    }
    if (target.includes('/events/08/03')) {
      return new Response(JSON.stringify({ events: [] }), { status: 200 });
    }
    if (target === 'https://api.openai.com/v1/chat/completions') {
      assert.equal(options.headers.Authorization, 'Bearer test-secret');
      assert.equal(options.body.includes('test-secret'), false);
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({ candidateId: 'birth:1903:123', fact: modelFact }),
          },
        }],
      }), { status: 200 });
    }
    throw new Error(`Unexpected URL: ${target}`);
  };
}

test('reports an unconfigured provider without exposing environment details', () => {
  assert.deepEqual(describeAiConfiguration({}), {
    configured: false,
    provider: null,
    model: null,
  });
});

test('builds Azure OpenAI deployment URLs from server-only configuration', () => {
  const config = getAiConfiguration({
    AI_PROVIDER: 'azure-openai',
    AZURE_OPENAI_API_KEY: 'azure-secret',
    AZURE_OPENAI_ENDPOINT: 'https://orbital-harmony.openai.azure.com/',
    AZURE_OPENAI_DEPLOYMENT: 'trivia-mini',
    AZURE_OPENAI_API_VERSION: '2024-10-21',
  });
  assert.equal(config.provider, 'azure-openai');
  assert.equal(config.headers['api-key'], 'azure-secret');
  assert.equal(
    config.url,
    'https://orbital-harmony.openai.azure.com/openai/deployments/trivia-mini/chat/completions?api-version=2024-10-21',
  );
});

test('binds AI birthday trivia to a retrieved source candidate', async () => {
  const result = await generateGroundedTrivia(
    { kind: 'birthday', month: 8, day: 3, excludeIds: [] },
    {
      env: { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test-secret' },
      fetchImpl: birthdayFetch(),
    },
  );
  assert.equal(result.id, 'birth:1903:123');
  assert.equal(result.generatedBy, 'openai');
  assert.equal(result.href, 'https://en.wikipedia.org/wiki/Raymond_Queneau');
});

test('rejects numbers that are absent from the selected source', async () => {
  await assert.rejects(
    generateGroundedTrivia(
      { kind: 'birthday', month: 8, day: 3, excludeIds: [] },
      {
        env: { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test-secret' },
        fetchImpl: birthdayFetch('He published 42 playful novels.'),
      },
    ),
    (error) => error instanceof AiTriviaError && error.code === 'AI_INVALID_RESPONSE',
  );
});

test('returns one grounded item for each requested planet', async () => {
  const fetchImpl = async (url) => {
    const target = String(url);
    if (target.startsWith('https://en.wikipedia.org/w/api.php')) {
      const title = new URL(target).searchParams.get('titles');
      const isEarth = title === 'Earth';
      const planetName = isEarth ? 'Earth' : 'Venus';
      return new Response(JSON.stringify({
        query: {
          pages: [{
            pageid: isEarth ? 10 : 20,
            fullurl: `https://en.wikipedia.org/wiki/${planetName}`,
            extract: `${planetName} is a planet in the Solar System. ${planetName} has a distinctive atmosphere and orbit.`,
          }],
        },
      }), { status: 200 });
    }
    if (target === 'https://api.openai.com/v1/chat/completions') {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              items: [
                { planetKey: 'earth', candidateId: 'planet:earth:10:0', fact: 'Earth has a distinctive atmosphere and orbit.' },
                { planetKey: 'venus', candidateId: 'planet:venus:20:0', fact: 'Venus has a distinctive atmosphere and orbit.' },
              ],
            }),
          },
        }],
      }), { status: 200 });
    }
    throw new Error(`Unexpected URL: ${target}`);
  };

  const result = await generateGroundedTrivia(
    { kind: 'planets', planetKeys: ['earth', 'venus'], excludeIds: [] },
    {
      env: { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test-secret' },
      fetchImpl,
    },
  );
  assert.deepEqual(result.items.map(({ planetKey }) => planetKey), ['earth', 'venus']);
  assert.equal(result.items[0].href, 'https://en.wikipedia.org/wiki/Earth');
  assert.equal(result.items[1].source, 'AI-curated · Wikipedia CC BY-SA');
});