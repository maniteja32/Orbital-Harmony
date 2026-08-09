import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RefreshCcw } from 'lucide-react';
import SolarSystemCanvas from '../components/SolarSystemCanvas.jsx';
import { TopNavigationBar } from '../components/TopNavigationBar.jsx';
import { LineStyleToggleButton } from '../components/LineStyleToggle.jsx';
import { LiquidGlass } from '../components/ui/glasscn/liquid-glass.jsx';
import { PLANETS_BY_KEY } from '../data/planets.js';
import { computeSimulationPlan, DETAIL_LEVEL_MIN, DETAIL_LEVEL_MAX } from '../utils/simulationPlan.js';
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

// A naive `${percent}%` fill width overshoots/undershoots the native range
// thumb's actual center at any value other than 0/100 — the browser insets
// the thumb's travel by its own diameter (18px here) so it never overflows
// the track edges, but a plain percentage doesn't account for that inset.
// Mirroring the same inset math (thumbRadius + percent * (100% - thumbSize))
// keeps the orange fill's right edge exactly under the thumb's center at
// every value, on any track width.
const SLIDER_THUMB_SIZE = 18;
function sliderFillWidth(percent) {
  const half = SLIDER_THUMB_SIZE / 2;
  return `calc(${half}px + ${percent / 100} * (100% - ${SLIDER_THUMB_SIZE}px))`;
}



/** Live simulation preview screen for Explore/Cosmic flows.
 * Runs the tracer and captures the generated image when complete.
 */
export default function SimulationScreen({ onComplete, onBack }) {
  const { planetA, planetB, speed, detailLevel, setDetailLevel, setSnapshot, cosmicDate, patternMode, lineStyle, setLineStyle } = useAppStore();
  const canvasRef = useRef(null);
  const doneRef = useRef(false);
  const [isPaused, setIsPaused] = useState(true);
  const [speedFactor, setSpeedFactor] = useState(1);
  const isCosmic = patternMode === 'cosmic';

  // A detail change remounts SolarSystemCanvas (see its `key` prop below),
  // which always mounts paused (`startPaused`) — resume it once the fresh
  // instance is attached so playback actually matches the "Pause" button
  // handleDetailLevelChange already switches to, instead of staying frozen.
  // The fresh instance also always renders `solid` (the material's default),
  // so re-apply the current Line/Dots choice too.
  const isFirstDetailRender = useRef(true);
  useEffect(() => {
    if (isFirstDetailRender.current) {
      isFirstDetailRender.current = false;
      return;
    }
    canvasRef.current?.setPaused(false);
    canvasRef.current?.setLineStyle(lineStyle);
  }, [detailLevel]);
  const planetAData = PLANETS_BY_KEY[planetA];
  const planetBData = PLANETS_BY_KEY[planetB];
  const hasPair = Boolean(planetAData && planetBData);
  const pairTitle = isCosmic ? 'Cosmic Signature' : hasPair ? `${planetAData.name} × ${planetBData.name}` : '';

  // Run length + chord density + real/artistic tracing mode — SINGLE
  // SOURCE OF TRUTH shared with ResultScreen (see computeSimulationPlan)
  // so a later on-demand regenerate there reproduces this EXACT pattern.
  const { planetKeys, physicalPattern, totalSimYears, traceIntervalDays, patternOpacity, patternRates } = useMemo(
    () => computeSimulationPlan({ isCosmic, planetA, planetB, detailLevel }),
    [isCosmic, planetA, planetB, detailLevel],
  );

  // Applies the persisted line-style choice (see useAppStore) to a freshly
  // mounted canvas — the material always initializes as `solid` otherwise.
  useEffect(() => {
    canvasRef.current?.setLineStyle(lineStyle);
  }, [planetKeys]);
  const speedCfg = SPEED_PRESETS[speed];

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
    // Changing detail remounts the canvas at a fresh detail level (see the
    // `key` prop below), restarting the whole pattern from scratch — it
    // should resume playing immediately, so the transport correctly shows
    // "Pause" (in progress) rather than "Play" (idle).
    setIsPaused(false);
  }, [detailLevel, setDetailLevel]);

  const resetPattern = useCallback(() => {
    // Reset rewinds to the beginning and pauses (ready to play again).
    doneRef.current = false;
    canvasRef.current?.reset();
    canvasRef.current?.setSpeedMultiplier(DEFAULT_SPEED_MULTIPLIER * speedFactor);
    canvasRef.current?.setPaused(true);
    setIsPaused(true);
  }, [speedFactor]);

  const handleLineStyleChange = useCallback((nextStyle) => {
    setLineStyle(nextStyle);
    canvasRef.current?.setLineStyle(nextStyle);
  }, [setLineStyle]);

  return (
    <div className="screen screen--simulation">
      <TopNavigationBar title={pairTitle} onBack={onBack} />
      <div className="sim-canvas-wrap">
        <SolarSystemCanvas
          key={`${planetKeys.join(',')}:${detailLevel}`}
          ref={canvasRef}
          planetKeys={planetKeys}
          tracePattern={!isCosmic}
          physicalPattern={physicalPattern}
          connectAllPlanets={false}
          showMoon={false}
          cosmicSnapshotDate={isCosmic ? (cosmicDate ?? undefined) : undefined}
          startPaused={true}
          miniBodiesIntro
          miniSunScale={0.5}
          miniPlanetScale={0.8}
          miniIntroDurationSec={1}
          miniMotionRampSec={2.6}
          initialSunScale={0.5}
          initialPlanetScale={1.5}
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
            <span className="sim-speed-slider__fill" style={{ width: sliderFillWidth(((speedFactor - 0.6) / 1.4) * 100) }} />
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
              <span className="sim-speed-slider__fill" style={{ width: sliderFillWidth(((detailLevel - DETAIL_LEVEL_MIN) / (DETAIL_LEVEL_MAX - DETAIL_LEVEL_MIN)) * 100) }} />
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
        <button
          type="button"
          className="back-button back-button--icon"
          onClick={resetPattern}
          aria-label="Reset pattern"
        >
          <RefreshCcw size={24} strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`back-button back-button--icon sim-controls__toggle sim-controls__play${!isPaused ? ' is-active' : ''}`}
          onClick={togglePaused}
          aria-label={isPaused ? 'Play' : 'Pause'}
          aria-pressed={!isPaused}
        >
          {isPaused ? (
            <Play size={24} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Pause size={24} strokeWidth={2} aria-hidden="true" />
          )}
        </button>
        <LineStyleToggleButton lineStyle={lineStyle} onChange={handleLineStyleChange} className="sim-controls__toggle" />
      </div>
    </div>
  );
}

