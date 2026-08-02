import { useCallback, useMemo, useRef } from 'react';
import SolarSystemCanvas from '../components/SolarSystemCanvas.jsx';
import { PLANETS, PLANETS_BY_KEY } from '../data/planets.js';
import { computePatternPlan } from '../utils/resonance.js';
import { useAppStore, SPEED_PRESETS } from '../store/useAppStore.js';

const DEFAULT_SPEED_MULTIPLIER = 3;

// Fallback only — used if a selected planet can't be resolved (shouldn't
// happen in the normal flow). The Explore pattern's real span/density are
// computed PER PAIR from the two planets' actual orbital periods (see
// computePatternPlan) so every pair traces its own complete resonance
// figure, rather than an arbitrary fixed number of years.
const FALLBACK_SIM_YEARS = 8;
const FALLBACK_TRACE_INTERVAL_DAYS = 3;

// Cosmic Signature — connects ALL planets (positioned at their real birth
// date/time locations) in a closed loop and sweeps the wired figure over a
// fixed span. ~1 Jupiter orbit lets the inner planets loop many times (rich
// web) while the slow outer planets act as drifting anchors.
const SIGNATURE_YEARS = 12;
const SIGNATURE_SAMPLES = 260;

/** Live simulation preview screen for Explore/Cosmic flows.
 * Runs the tracer and captures the generated image when complete.
 */
export default function SimulationScreen({ onComplete }) {
  const { planetA, planetB, speed, setSnapshot, cosmicDate, patternMode } = useAppStore();
  const canvasRef = useRef(null);
  const doneRef = useRef(false);
  const isCosmic = patternMode === 'cosmic';

  const planetKeys = useMemo(
    () => (isCosmic ? PLANETS.map((p) => p.key) : [planetA, planetB]),
    [isCosmic, planetA, planetB],
  );
  const speedCfg = SPEED_PRESETS[speed];

  // Run length + chord density. Cosmic mode sweeps the all-planets figure
  // over a fixed span; Explore derives its span + sampling PER PAIR from the
  // two planets' REAL orbital periods (computePatternPlan) — detecting the
  // resonance cycle and running exactly long enough for the geometry to
  // return to its initial configuration, with a chord count + adaptive line
  // opacity bounded so the figure is fully revealed but never overdraws into
  // a solid white mesh. No fixed/arbitrary duration is used.
  const { totalSimYears, traceIntervalDays, patternOpacity, patternRates } = useMemo(() => {
    if (isCosmic) {
      return {
        totalSimYears: SIGNATURE_YEARS,
        traceIntervalDays: (SIGNATURE_YEARS * 365.25) / SIGNATURE_SAMPLES,
        patternOpacity: 1,
        patternRates: undefined,
      };
    }
    const a = PLANETS_BY_KEY[planetA];
    const b = PLANETS_BY_KEY[planetB];
    if (!a || !b) {
      return { totalSimYears: FALLBACK_SIM_YEARS, traceIntervalDays: FALLBACK_TRACE_INTERVAL_DAYS, patternOpacity: 1, patternRates: undefined };
    }
    const plan = computePatternPlan(a.orbitalPeriodDays, b.orbitalPeriodDays);
    // Idealized whole-loop rates (see computePatternPlan) keyed by planet, so
    // the engine drives each of the two planets at the rate that shuts the
    // figure exactly — a clean, gap-free, rotationally-symmetric pattern.
    const aInner = a.orbitalPeriodDays <= b.orbitalPeriodDays;
    return {
      totalSimYears: plan.totalSimYears,
      traceIntervalDays: plan.traceIntervalDays,
      patternOpacity: plan.lineOpacity,
      patternRates: {
        [aInner ? planetA : planetB]: plan.innerRatePerYear,
        [aInner ? planetB : planetA]: plan.outerRatePerYear,
      },
    };
  }, [isCosmic, planetA, planetB]);

  // Explore now traces the pair's TRUE resonance geometry (real orbital
  // periods), matching the per-pair span computed above; Cosmic already
  // uses real positions/periods. `physicalPattern` switches the engine's
  // tracer from the old compressed artistic rates to real orbital motion.
  const physicalPattern = isCosmic || (!!PLANETS_BY_KEY[planetA] && !!PLANETS_BY_KEY[planetB]);

  const handleEngineComplete = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setTimeout(() => {
      const dataUrl = canvasRef.current?.captureDataURL();
      if (dataUrl) setSnapshot(dataUrl);
      onComplete();
    }, 900);
  }, [onComplete, setSnapshot]);

  return (
    <div className="screen screen--simulation">
      <div className="screen__topbar">
        <div className="screen__header">
          {isCosmic && <span className="eyebrow">Cosmic Signature</span>}
          <h1>{isCosmic ? 'Your Signature' : 'Your Pattern'}</h1>
        </div>
      </div>

      <div className="sim-canvas-wrap">
        <SolarSystemCanvas
          ref={canvasRef}
          planetKeys={planetKeys}
          tracePattern={!isCosmic}
          physicalPattern={physicalPattern}
          connectAllPlanets={false}
          cosmicSnapshotDate={isCosmic ? (cosmicDate ?? undefined) : undefined}
          startPaused={false}
          speedDurationSec={speedCfg.durationSec}
          totalSimYears={totalSimYears}
          traceIntervalDays={traceIntervalDays}
          patternOpacity={patternOpacity}
          patternRates={patternRates}
          initialSpeedMultiplier={DEFAULT_SPEED_MULTIPLIER}
          patternStartDate={isCosmic ? undefined : (cosmicDate ?? undefined)}
          onComplete={handleEngineComplete}
          className="screen__canvas"
        />
      </div>
    </div>
  );
}

