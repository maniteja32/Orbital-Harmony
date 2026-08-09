import { PLANETS, PLANETS_BY_KEY } from '../data/planets.js';
import { computePatternPlan } from './resonance.js';

// Single source of truth for how a saved selection (planetA/planetB or
// Cosmic Signature + detailLevel) maps to an actual simulation run — used
// by BOTH SimulationScreen (the live first reveal) and ResultScreen (to
// regenerate the exact same pattern on demand, e.g. when switching line
// style after the fact) so the two screens can never drift apart.
export const DETAIL_LEVEL_MIN = 1;
export const DETAIL_LEVEL_MAX = 10;
export const SIMULATION_PATTERN_OPACITY_MULTIPLIER = 0.8;

// Fallback only — used if a selected planet can't be resolved (shouldn't
// happen in the normal flow).
const FALLBACK_SIM_YEARS = 8;
const FALLBACK_TRACE_INTERVAL_DAYS = 3;

// Cosmic Signature — connects ALL planets (positioned at their real birth
// date/time locations) in a closed loop and sweeps the wired figure over a
// fixed span. ~1 Jupiter orbit lets the inner planets loop many times (rich
// web) while the slow outer planets act as drifting anchors.
const SIGNATURE_YEARS = 12;
const SIGNATURE_SAMPLES = 260;

function detailMultiplier(level) {
  return 0.7 + (level / DETAIL_LEVEL_MAX) * 0.6;
}

// Minimum average chords-per-lobe required before snapping to the FULL
// true petal count — below this, snapping there would starve the total
// chord budget (severe undersampling), so a smaller step is used instead.
const MIN_CHORDS_PER_PETAL = 6;

function quantizeChordCount(rawChordCount, petals) {
  const p = Math.max(1, petals || 1);
  // Snapping to a whole multiple of the TRUE petal count is what keeps
  // every lobe's chord coverage perfectly even — any mismatch (e.g. the
  // old flat 24-cap rounding a 25-petal figure to a multiple of 24)
  // leaves a visible seam, most noticeable at moderate petal counts where
  // each lobe is a large, distinct chunk of the image. Only fall back to
  // the smaller capped step for extreme, hundreds-of-lobes pairs where the
  // full count would crush the total below a readable density (there the
  // mismatch is invisible anyway, buried in the sheer overlap).
  const step = rawChordCount / p >= MIN_CHORDS_PER_PETAL ? p : Math.max(1, Math.min(p, 24));
  return Math.max(step, Math.round(rawChordCount / step) * step);
}

/** Derives everything SolarSystemCanvas needs to reproduce ONE specific
 * pattern (planet keys, real/artistic tracing mode, run length + chord
 * density, opacity, per-planet rates) from the saved selection. */
export function computeSimulationPlan({ isCosmic, planetA, planetB, detailLevel }) {
  const planetKeys = isCosmic ? PLANETS.map((p) => p.key) : [planetA, planetB];
  const physicalPattern = isCosmic || (!!PLANETS_BY_KEY[planetA] && !!PLANETS_BY_KEY[planetB]);

  if (isCosmic) {
    return {
      planetKeys,
      physicalPattern,
      totalSimYears: SIGNATURE_YEARS,
      traceIntervalDays: (SIGNATURE_YEARS * 365.25) / SIGNATURE_SAMPLES,
      patternOpacity: SIMULATION_PATTERN_OPACITY_MULTIPLIER,
      patternRates: undefined,
    };
  }

  const a = PLANETS_BY_KEY[planetA];
  const b = PLANETS_BY_KEY[planetB];
  if (!a || !b) {
    return {
      planetKeys,
      physicalPattern,
      totalSimYears: FALLBACK_SIM_YEARS,
      traceIntervalDays: FALLBACK_TRACE_INTERVAL_DAYS,
      patternOpacity: SIMULATION_PATTERN_OPACITY_MULTIPLIER,
      patternRates: undefined,
    };
  }

  const plan = computePatternPlan(
    a.orbitalPeriodDays,
    b.orbitalPeriodDays,
    a.orbitDirection ?? 1,
    b.orbitDirection ?? 1,
  );
  const adjustedChordCount = Math.max(
    120,
    quantizeChordCount(plan.chordCount * detailMultiplier(detailLevel), plan.petals),
  );
  // Idealized whole-loop rates (see computePatternPlan) keyed by planet, so
  // the engine drives each of the two planets at the rate that shuts the
  // figure exactly — a clean, gap-free, rotationally-symmetric pattern.
  const aInner = a.orbitalPeriodDays <= b.orbitalPeriodDays;
  return {
    planetKeys,
    physicalPattern,
    totalSimYears: plan.totalSimYears,
    traceIntervalDays: (plan.totalSimYears * 365.25) / adjustedChordCount,
    patternOpacity: plan.lineOpacity * SIMULATION_PATTERN_OPACITY_MULTIPLIER,
    patternRates: {
      [aInner ? planetA : planetB]: plan.innerRatePerYear,
      [aInner ? planetB : planetA]: plan.outerRatePerYear,
    },
  };
}
