# AI Trivia Integration

## What existed before

No AI model was active. Content came from three deterministic paths:

| Path | Source | Entry point |
| --- | --- | --- |
| Cosmic birthday trivia | Wikimedia On This Day plus regex ranking and sentence trimming | `orbital-harmony-app/src/utils/dateStory.js` |
| Explore planet facts | Wikipedia article extraction plus scoring and session rotation | `orbital-harmony-app/src/utils/planetFactService.js` |
| Offline fallback | Hardcoded planet facts | `orbital-harmony-app/src/utils/factoidGenerator.js` |

`orbital-harmony-app/src/screens/ResultScreen.jsx` called those modules directly. There was no API route, provider SDK/request, provider environment variable, or server runtime. Pollinations was evaluated earlier, but its anonymous endpoints required Turnstile or authentication. A provider key could not be placed in Vite because every `VITE_*` value is embedded in the browser and iOS JavaScript bundle.

## New request flow

```text
ResultScreen
  -> src/services/triviaService.js
     -> POST /api/trivia
        -> api/trivia.mjs
           -> server/aiTriviaService.mjs
              -> Wikimedia/Wikipedia source retrieval
              -> OpenAI or Azure OpenAI grounded rewrite
              -> candidate and number validation
     -> existing Wikimedia/Wikipedia fallback
     -> existing local fallback
```

The birthday request sends only month and day. The birth year stays on-device and is used locally to format “years before/after your birth.” Provider keys and provider URLs are read only by the Vercel Function.

## Files

### Added

- `api/trivia.mjs`: Vercel Function, CORS, validation, health response, and rate limit.
- `server/aiTriviaService.mjs`: source retrieval, OpenAI/Azure adapters, prompt, and output validation.
- `server/aiTriviaService.test.mjs`: mocked provider and grounding tests.
- `orbital-harmony-app/src/services/triviaService.js`: AI-first frontend service and fallback coordination.
- `.env.example`: server-only provider configuration.
- `orbital-harmony-app/.env.example`: optional public endpoint URL for native builds.

### Modified

- `orbital-harmony-app/src/screens/ResultScreen.jsx`: uses the AI-first service for Cosmic and Explore.
- `orbital-harmony-app/package.json`: adds `npm run test:ai`.
- `vercel.json`: configures the API function duration.
- `orbital-harmony-app/README.md`: deployment and verification instructions.
- `ios/README.md`: native API endpoint instructions.

The old rule-based modules remain intentionally as network/provider fallbacks.

## Configure OpenAI

### One-command setup

Create an OpenAI API key with active billing, then run this from any directory:

```sh
bash "/Users/maniteja.lingala/Documents/Github Experiments/Orbital Harmony/scripts/activate-ai.sh"
```

The script logs into and links Vercel when needed, prompts for the key with
hidden input, configures production, deploys, verifies a real model response,
writes only the public endpoint to the ignored app `.env.local`, rebuilds, and
synchronizes the iOS web bundle. The OpenAI key is never written to disk or
placed in shell history.

### Manual setup

Set these server-side in Vercel Project Settings -> Environment Variables:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=<secret>
OPENAI_MODEL=gpt-4.1-mini
TRIVIA_ALLOWED_ORIGINS=https://your-production-domain.example,orbital://app
```

`OPENAI_BASE_URL` is optional and defaults to `https://api.openai.com/v1`.

## Configure Azure OpenAI

Use these instead of the OpenAI variables:

```dotenv
AI_PROVIDER=azure-openai
AZURE_OPENAI_API_KEY=<secret>
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=your-deployment-name
AZURE_OPENAI_API_VERSION=2024-10-21
TRIVIA_ALLOWED_ORIGINS=https://your-production-domain.example,orbital://app
```

Never create `VITE_OPENAI_API_KEY` or `VITE_AZURE_OPENAI_API_KEY`. Vite variables are public by design.

## Web deployment

Deploy from the repository root so Vercel discovers both `vercel.json` and `api/trivia.mjs`. The web client uses same-origin `/api/trivia` automatically.

After adding environment variables, redeploy and verify:

```sh
curl https://your-production-domain.example/api/trivia
```

Expected configured response:

```json
{"status":"ok","configured":true,"provider":"openai","model":"gpt-4.1-mini"}
```

The health response never includes a key.

For local end-to-end API development, put secrets in a root `.env.local` and run the Vercel development server from the repository root:

```sh
npx vercel dev
```

Running only `npm run dev` starts Vite without the serverless function, so the UI will correctly use its existing fallback chain.

## iOS build

The native app loads from `orbital://app`, so a relative `/api/trivia` URL would point at a nonexistent bundled file. Set the public deployed endpoint while building the web bundle:

```sh
export VITE_TRIVIA_API_URL=https://your-production-domain.example/api/trivia
./ios/scripts/rebuild-web.sh
```

Also include `orbital://app` in `TRIVIA_ALLOWED_ORIGINS`. `VITE_TRIVIA_API_URL` is not secret; it is expected to appear in the iOS JavaScript bundle.

## Security behavior

- Provider keys exist only in the Vercel Function environment.
- The browser sends planet keys or birthday month/day, never a provider key or full DOB.
- The backend retrieves its own source candidates instead of trusting arbitrary client-provided facts.
- The model must select an exact candidate ID.
- Generated numbers are rejected unless present in that candidate’s evidence.
- Responses are `no-store` and request bodies are size-limited.
- Origins are checked and requests receive a per-instance rate limit. Configure platform-level rate limiting for high-traffic production use.
- If retrieval, AI, validation, CORS, or configuration fails, the frontend falls back to the existing sourced/local path.

## Verification

```sh
cd orbital-harmony-app
npm run test:ai
npm run lint
npm run build
```

No real provider key is needed for the test suite; model and source calls are mocked.