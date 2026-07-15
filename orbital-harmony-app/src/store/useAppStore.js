import { create } from 'zustand';

export const SPEED_PRESETS = {
  slow: { label: 'Slow', durationSec: 16 },
  medium: { label: 'Medium', durationSec: 10 },
  fast: { label: 'Fast', durationSec: 6 },
};

export const DENSITY_PRESETS = {
  simple: { label: 'Simple', years: 4, traceIntervalDays: 6 },
  detailed: { label: 'Detailed', years: 8, traceIntervalDays: 3 },
  complex: { label: 'Complex', years: 16, traceIntervalDays: 1.25 },
};

const initialSelection = { planetA: null, planetB: null, speed: 'medium', density: 'detailed' };

export const useAppStore = create((set) => ({
  screen: 'loading', // loading | system | select | settings | reveal | result
  ...initialSelection,
  snapshot: null, // captured PNG data URL of the final pattern

  goTo: (screen) => set({ screen }),

  setPlanetA: (planetA) => set((s) => (s.planetB === planetA ? s : { planetA })),
  setPlanetB: (planetB) => set((s) => (s.planetA === planetB ? s : { planetB })),
  setSpeed: (speed) => set({ speed }),
  setDensity: (density) => set({ density }),
  setSnapshot: (snapshot) => set({ snapshot }),

  resetForNewPattern: () =>
    set({ screen: 'select', planetA: null, planetB: null, snapshot: null }),
}));
