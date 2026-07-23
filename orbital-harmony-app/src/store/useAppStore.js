import { create } from 'zustand';

export const SPEED_PRESETS = {
  slow: { label: 'Slow', durationSec: 16 },
  medium: { label: 'Medium', durationSec: 10 },
  fast: { label: 'Fast', durationSec: 6 },
};

// `targetChords` = roughly how many chords the FULL pattern should end up
// with, no matter how many simulated years a pair's resonance needs to
// close (see SimulationScreen.jsx, which derives the actual sampling
// `traceIntervalDays` from `totalSimYears / targetChords`). A FIXED
// traceIntervalDays (the old approach) meant fast/high-ratio pairs like
// Mercury+Earth (a 6:25 resonance) sampled thousands of chords and
// rendered as a dense, muddy blob, while slow pairs sampled far fewer —
// targeting a constant chord COUNT instead keeps every pattern's visual
// density (and "read" as an elegant, uncluttered rosette) roughly
// consistent regardless of which two planets were picked.
export const DENSITY_PRESETS = {
  simple: { label: 'Simple', years: 4, targetChords: 160 },
  detailed: { label: 'Detailed', years: 8, targetChords: 260 },
  complex: { label: 'Complex', years: 16, targetChords: 420 },
};

const initialSelection = { planetA: null, planetB: null, speed: 'medium', density: 'detailed' };

export const useAppStore = create((set) => ({
  screen: 'loading', // loading | system | select | settings | result
  ...initialSelection,
  snapshot: null, // captured PNG data URL of the final pattern

  goTo: (screen) => set({ screen }),

  setPlanetA: (planetA) => set({ planetA }),
  setPlanetB: (planetB) => set({ planetB }),
  setSpeed: (speed) => set({ speed }),
  setDensity: (density) => set({ density }),
  setSnapshot: (snapshot) => set({ snapshot }),

  resetForNewPattern: () =>
    set({ screen: 'select', planetA: null, planetB: null, snapshot: null }),
}));
