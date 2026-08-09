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
  screen: 'loading', // loading | system | mode | select | cosmic | settings | result | details | knowledge | collection | share | profile
  ...initialSelection,
  patternMode: 'explore', // 'explore' (pick two planets) | 'cosmic' (birth-date signature)
  cosmicDate: null, // Date the Cosmic Signature pattern is anchored to (null = Explore flow)
  snapshot: null, // captured PNG data URL of the final pattern
  lineStyle: 'solid', // 'solid' | 'dashed' | 'dots' — shared pattern line style, see LineStyleToggle.jsx
  // has the Solar System cinematic intro (top-down hold -> rotate -> zoom
  // in) played yet THIS SESSION? Deliberately NOT persisted to
  // localStorage — the cinematic intro should play in full every time the
  // page actually loads/reloads (continuing straight on from the loading
  // screen's top-down orrery), but should still be skipped if the user
  // simply navigates back to this screen from elsewhere in the same
  // session (e.g. Back from Planet Select) so it doesn't replay constantly
  // mid-session.
  systemIntroPlayed: false,

  goTo: (screen) => set({ screen }),

  setPlanetA: (planetA) => set({ planetA }),
  setPlanetB: (planetB) => set({ planetB }),
  setSpeed: (speed) => set({ speed }),
  setDensity: (density) => set({ density }),
  setDetailLevel: (detailLevel) => set({ detailLevel }),
  setSnapshot: (snapshot) => set({ snapshot }),
  setPatternMode: (patternMode) => set({ patternMode }),
  setCosmicDate: (cosmicDate) => set({ cosmicDate }),
  setLineStyle: (lineStyle) => set({ lineStyle }),
  markSystemIntroPlayed: () => set({ systemIntroPlayed: true }),

  resetForNewPattern: () =>
    set({
      screen: 'select',
      planetA: null,
      planetB: null,
      snapshot: null,
      cosmicDate: null,
      patternMode: 'explore',
      // Preload Celestial Complexity back to the default (5) every new
      // pattern — detailMultiplier(5) is a neutral 1.0x, the exact setting
      // the Pattern Gallery preview uses, so leaving this untouched always
      // reproduces that pair's gallery-tuned mandala. Without this reset,
      // a complexity tweak on one pair would silently carry over and
      // change the NEXT pair's default result too.
      detailLevel: initialSelection.detailLevel,
    }),
}));
