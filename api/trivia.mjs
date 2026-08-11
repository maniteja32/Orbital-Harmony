import { AiTriviaError, generateGroundedTrivia } from '../server/aiTriviaService.mjs';

const MAX_BODY_BYTES = 8 * 1024;

function header(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function applyResponseHeaders(response, origin) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
}

function sendJson(response, status, payload) {
  response.status(status).json(payload);
}

function parseBody(request) {
  const contentLength = Number(header(request, 'content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new AiTriviaError('INVALID_REQUEST', 'Request body is too large', 413);
  }
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    return request.body;
  }
  try {
    const text = Buffer.isBuffer(request.body) ? request.body.toString('utf8') : String(request.body ?? '');
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) {
      throw new AiTriviaError('INVALID_REQUEST', 'Request body is too large', 413);
    }
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof AiTriviaError) throw error;
    throw new AiTriviaError('INVALID_REQUEST', 'Request body must be valid JSON', 400);
  }
}

function validMonthDay(month, day) {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  const date = new Date(Date.UTC(2024, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateInput(body) {
  if (body?.kind === 'birthday') {
    const month = Number(body.month);
    const day = Number(body.day);
    if (!validMonthDay(month, day)) {
      throw new AiTriviaError('INVALID_REQUEST', 'A valid month and day are required', 400);
    }
    return { kind: 'birthday', month, day };
  }

  if (body?.kind === 'planets') {
    const allowedPlanets = new Set(['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
    const planetKeys = [...new Set(Array.isArray(body.planetKeys) ? body.planetKeys : [])]
      .filter((key) => allowedPlanets.has(key));
    if (planetKeys.length < 1 || planetKeys.length > 2) {
      throw new AiTriviaError('INVALID_REQUEST', 'One or two valid planet keys are required', 400);
    }
    return { kind: 'planets', planetKeys };
  }

  throw new AiTriviaError('INVALID_REQUEST', 'kind must be birthday or planets', 400);
}

export default async function handler(request, response) {
  const origin = String(header(request, 'origin') ?? '');
  applyResponseHeaders(response, origin);

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method === 'GET') {
    sendJson(response, 200, { status: 'ok', configured: true, provider: 'pollinations', model: 'text-free' });
    return;
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST, OPTIONS');
    sendJson(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } });
    return;
  }

  try {
    const input = validateInput(parseBody(request));
    const trivia = await generateGroundedTrivia(input);
    sendJson(response, 200, trivia);
  } catch (error) {
    const knownError = error instanceof AiTriviaError
      ? error
      : new AiTriviaError('INTERNAL_ERROR', 'Trivia generation failed', 500);
    if (knownError.status >= 500) {
      console.error('Trivia API error', { code: knownError.code, message: knownError.message });
    }
    sendJson(response, knownError.status, {
      error: { code: knownError.code, message: knownError.message },
    });
  }
}
