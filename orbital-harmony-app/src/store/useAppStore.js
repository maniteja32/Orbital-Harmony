import { create } from 'zustand';

export const SPEED_PRESETS = {
  // `durationSec` = real seconds for the FULL pattern reveal at 1× (the
  // rocket multiplier scales from there). Kept deliberately long/calm — the
  // default rocket speed is 3× (see SimulationScreen SPEED_STEPS), so the
  // default reveal lands around a graceful ~15s rather than the old rushed
  // few-second sprint that read as a "mess" on mobile.
  slow: { label: 'Slow', durationSec: 150 },
  medium: { label: 'Medium', durationSec: 120 },
  fast: { label: 'Fast', durationSec: 90 },
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

const initialSelection = { planetA: null, planetB: null, speed: 'medium', density: 'detailed', detailLevel: 5 };

export const useAppStore = create((set) => ({
  screen: 'loading', // loading | system | select | cosmic | settings | result | details
  ...initialSelection,
  patternMode: 'explore',
  cosmicDate: null,
  snapshot: null,
  resultFactoid: null,
  lineStyle: 'solid',
  backgroundMusicEnabled: true,
  systemIntroPlayed: false,

  goTo: (screen) => set({ screen }),
  setPlanetA: (planetA) => set({ planetA }),
  setPlanetB: (planetB) => set({ planetB }),
  setSpeed: (speed) => set({ speed }),
  setDensity: (density) => set({ density }),
  setDetailLevel: (detailLevel) => set({ detailLevel }),
  setSnapshot: (snapshot) => set({ snapshot }),
  setResultFactoid: (resultFactoid) => set({ resultFactoid }),
  setPatternMode: (patternMode) => set({ patternMode }),
  setCosmicDate: (cosmicDate) => set({ cosmicDate }),
  setLineStyle: (lineStyle) => set({ lineStyle }),
  setBackgroundMusicEnabled: (backgroundMusicEnabled) => set({ backgroundMusicEnabled }),
  markSystemIntroPlayed: () => set({ systemIntroPlayed: true }),

  resetForNewPattern: () => set({
    screen: 'select',
    planetA: null,
    planetB: null,
    snapshot: null,
    resultFactoid: null,
    cosmicDate: null,
    patternMode: 'explore',
    detailLevel: initialSelection.detailLevel,
  }),
}));
