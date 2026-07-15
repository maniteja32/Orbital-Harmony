# Orbital Harmony

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

Just import the repo into Vercel (or run `vercel` from the repo root) — no
extra configuration needed. Alternatively, set the Vercel project's "Root
Directory" to `orbital-harmony-app` and use the default Vite build settings.
