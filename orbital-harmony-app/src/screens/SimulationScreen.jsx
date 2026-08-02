import { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Pause, Play, RotateCcw } from 'lucide-react';
import SolarSystemCanvas from '../components/SolarSystemCanvas.jsx';
import { LiquidGlass } from '../components/ui/glasscn/liquid-glass.jsx';
import { PLANETS, PLANETS_BY_KEY } from '../data/planets.js';
import { computePatternPlan } from '../utils/resonance.js';
import { useAppStore, SPEED_PRESETS } from '../store/useAppStore.js';

// Rim tuning for the tuning-panel cards' LiquidGlass surface — matches the
// mode cards' MODE_RIM (SolarSystemScreen.jsx) so every glass surface in the
// app shares the same specular-edge look, just a touch subtler since these
// sit over an already-busy live pattern rather than a calm starfield.
const TUNE_RIM = {
  '--liquid-glass-rim-width': '0.8px',
  '--liquid-glass-rim-light': 'rgba(255, 255, 255, 0.4)',
};

const DEFAULT_SPEED_MULTIPLIER = 3;
const DETAIL_LEVEL_MIN = 0;
const DETAIL_LEVEL_MAX = 10;
const SIMULATION_PATTERN_OPACITY_MULTIPLIER = 0.78;

function detailMultiplier(level) {
  return 0.7 + (level / DETAIL_LEVEL_MAX) * 0.6;
}

function quantizeChordCount(rawChordCount, petals) {
  const step = Math.max(1, petals || 1);
  return Math.max(step, Math.round(rawChordCount / step) * step);
}

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
export default function SimulationScreen({ onComplete, onBack }) {
  const { planetA, planetB, speed, detailLevel, setDetailLevel, setSnapshot, cosmicDate, patternMode } = useAppStore();
  const canvasRef = useRef(null);
  const doneRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speedFactor, setSpeedFactor] = useState(1);
  const isCosmic = patternMode === 'cosmic';
  const planetAData = PLANETS_BY_KEY[planetA];
  const planetBData = PLANETS_BY_KEY[planetB];
  const hasPair = Boolean(planetAData && planetBData);
  const pairTitle = isCosmic ? 'Cosmic Signature' : hasPair ? `${planetAData.name} × ${planetBData.name}` : '';

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
    const adjustedChordCount = Math.max(
      120,
      quantizeChordCount(plan.chordCount * detailMultiplier(detailLevel), plan.petals),
    );
    // Idealized whole-loop rates (see computePatternPlan) keyed by planet, so
    // the engine drives each of the two planets at the rate that shuts the
    // figure exactly — a clean, gap-free, rotationally-symmetric pattern.
    const aInner = a.orbitalPeriodDays <= b.orbitalPeriodDays;
    return {
      totalSimYears: plan.totalSimYears,
      traceIntervalDays: (plan.totalSimYears * 365.25) / adjustedChordCount,
      patternOpacity: plan.lineOpacity * SIMULATION_PATTERN_OPACITY_MULTIPLIER,
      patternRates: {
        [aInner ? planetA : planetB]: plan.innerRatePerYear,
        [aInner ? planetB : planetA]: plan.outerRatePerYear,
      },
    };
  }, [detailLevel, isCosmic, planetA, planetB]);

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

  const setPaused = useCallback((value) => {
    canvasRef.current?.setPaused(value);
    setIsPaused(value);
  }, []);

  const togglePaused = useCallback(() => {
    setPaused(!isPaused);
  }, [isPaused, setPaused]);

  const handleSpeedFactorChange = useCallback((event) => {
    const nextFactor = Number(event.target.value);
    setSpeedFactor(nextFactor);
    canvasRef.current?.setSpeedMultiplier(DEFAULT_SPEED_MULTIPLIER * nextFactor);
  }, []);

  const handleDetailLevelChange = useCallback((event) => {
    const nextLevel = Number(event.target.value);
    if (nextLevel === detailLevel) return;
    doneRef.current = false;
    setDetailLevel(nextLevel);
    setIsPaused(false);
  }, [detailLevel, setDetailLevel]);

  const resetPattern = useCallback(() => {
    // Reset rewinds to the beginning and resumes immediately.
    doneRef.current = false;
    canvasRef.current?.reset();
    canvasRef.current?.setSpeedMultiplier(DEFAULT_SPEED_MULTIPLIER * speedFactor);
    canvasRef.current?.setPaused(false);
    setIsPaused(false);
  }, [speedFactor]);

  return (
    <div className="screen screen--simulation">
      {pairTitle && <p className="sim-pair-title">{pairTitle}</p>}
      <div className="sim-canvas-wrap">
        <SolarSystemCanvas
          key={`${planetKeys.join(',')}:${detailLevel}`}
          ref={canvasRef}
          planetKeys={planetKeys}
          tracePattern={!isCosmic}
          physicalPattern={physicalPattern}
          connectAllPlanets={false}
          cosmicSnapshotDate={isCosmic ? (cosmicDate ?? undefined) : undefined}
          startPaused={false}
          miniBodiesIntro
          miniSunScale={0.26}
          miniPlanetScale={0.58}
          miniIntroDurationSec={1.15}
          miniMotionRampSec={2.6}
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

      <div className="sim-tune-panel" aria-label="Simulation tuning controls">
        <LiquidGlass className="sim-tune-glass rounded-[18px] w-full bg-white/[0.05]" style={TUNE_RIM}>
        <div className="sim-tune-panel__section sim-tune-panel__section--liquid">
          <div className="sim-tune-panel__row">
            <span className="sim-tune-panel__label">Simulation Speed</span>
            <span className="sim-tune-panel__value">{speedFactor.toFixed(1)}×</span>
          </div>
          <label className="sim-speed-slider" aria-label="Simulation speed">
            <span className="sim-speed-slider__track" />
            <span className="sim-speed-slider__fill" style={{ width: `${((speedFactor - 0.6) / 1.4) * 100}%` }} />
            <input
              type="range"
              min="0.6"
              max="2.0"
              step="0.1"
              value={speedFactor}
              onChange={handleSpeedFactorChange}
            />
          </label>
        </div>
        </LiquidGlass>

        {!isCosmic && (
          <LiquidGlass className="sim-tune-glass rounded-[18px] w-full bg-white/[0.05]" style={TUNE_RIM}>
          <div className="sim-tune-panel__section sim-tune-panel__section--liquid">
            <div className="sim-tune-panel__row">
              <span className="sim-tune-panel__label">Pattern Detail</span>
              <span className="sim-tune-panel__value">{detailLevel}</span>
            </div>
            <label className="sim-speed-slider sim-speed-slider--detail" aria-label="Pattern detail">
              <span className="sim-speed-slider__track" />
              <span className="sim-speed-slider__fill" style={{ width: `${((detailLevel - DETAIL_LEVEL_MIN) / (DETAIL_LEVEL_MAX - DETAIL_LEVEL_MIN)) * 100}%` }} />
              <input
                type="range"
                min={String(DETAIL_LEVEL_MIN)}
                max={String(DETAIL_LEVEL_MAX)}
                step="1"
                value={detailLevel}
                onChange={handleDetailLevelChange}
              />
            </label>
            <div className="sim-slider-labels" aria-hidden="true">
              {Array.from({ length: DETAIL_LEVEL_MAX - DETAIL_LEVEL_MIN + 1 }, (_, index) => DETAIL_LEVEL_MIN + index).map((value) => (
                <span
                  key={value}
                  className={`sim-slider-labels__item${detailLevel === value ? ' is-active' : ''}`}
                  style={{ left: `${((value - DETAIL_LEVEL_MIN) / (DETAIL_LEVEL_MAX - DETAIL_LEVEL_MIN)) * 100}%` }}
                >
                  {value}
                </span>
              ))}
            </div>
          </div>
          </LiquidGlass>
        )}
      </div>

      <div className="sim-controls sim-controls--transport" aria-label="Pattern playback controls">
        {onBack && (
          <button
            type="button"
            className="back-button back-button--icon"
            onClick={onBack}
            aria-label="Back"
          >
            <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className={`back-button back-button--icon sim-controls__toggle${!isPaused ? ' is-active' : ''}`}
          onClick={togglePaused}
          aria-label={isPaused ? 'Play' : 'Pause'}
          aria-pressed={!isPaused}
        >
          {isPaused ? (
            <Play size={18} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Pause size={18} strokeWidth={2} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="back-button back-button--icon"
          onClick={resetPattern}
          aria-label="Reset pattern"
        >
          <RotateCcw size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

