# Space Harmony

A mobile-first React app: pick two planets and discover the hidden
geometric pattern traced by the line connecting them as they orbit the Sun.

## Flow
1. **Loading** — animated sun, self-drawing orbit rings.
2. **Solar System** — full, gently interactive top-down view of all 8 planets.
3. **Planet Selection** — choose Planet A and Planet B (no duplicates).
4. **Simulation Settings** — Simulation Speed (Slow/Medium/Fast) and Trace
   Density (Simple/Detailed/Complex).
5. **Reveal** — the chord pattern animates in, with a progress bar.
6. **Result** — the final pattern, the two planets, an orbital-resonance
   ratio (e.g. Earth : Venus ~= 8:13) when one exists, and export actions:
   Download PNG, Share, Generate New Pattern.

## Stack
- React + Vite (`src/`)
- Three.js for the solar system / pattern engine (`src/engine/solarSystemEngine.js`),
  wrapped by `src/components/SolarSystemCanvas.jsx`
- Zustand for the tiny app-flow store (`src/store/useAppStore.js`)
- Plain CSS (frosted-glass, dark theme) — no UI framework dependency
- A Vercel Function at the repository root for grounded OpenAI/Azure OpenAI trivia

## AI trivia

Result trivia is AI-first when the server provider is configured. The backend
retrieves Wikimedia/Wikipedia evidence, asks OpenAI or Azure OpenAI for a short
rewrite, validates the selected source, and returns its citation. Existing
sourced and local generators remain the fallback chain.

Provider keys are server-only. See [AI_TRIVIA_SETUP.md](../AI_TRIVIA_SETUP.md)
for environment variables, local development, native builds, and security
details.

## Develop

    npm install
    npm run dev

## Build

    npm run build   # outputs to dist/

## Deploy to Vercel

This app lives in a subfolder of the repo. A `vercel.json` at the repo root
already points Vercel at it:

    {
      "buildCommand": "cd orbital-harmony-app && npm install && npm run build",
      "outputDirectory": "orbital-harmony-app/dist"
    }

Import or deploy the repository root so Vercel also discovers `api/trivia.mjs`.
Set the AI provider variables described in `AI_TRIVIA_SETUP.md`; without them,
the app remains functional through its existing Wikimedia/Wikipedia fallbacks.

## Validate

    npm run test:ai
    npm run lint
    npm run build
