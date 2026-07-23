import { useCallback, useMemo, useRef, useState } from 'react';
import SolarSystemCanvas from '../components/SolarSystemCanvas.jsx';
import { PLANETS_BY_KEY } from '../data/planets.js';
import { findResonance } from '../utils/resonance.js';
import { useAppStore, SPEED_PRESETS, DENSITY_PRESETS } from '../store/useAppStore.js';

// Tap-cycled live playback-rate multiplier steps for the rocket button
// (see setSpeedMultiplier in solarSystemEngine.js) — each tap advances to
// the next step, wrapping back to the default. 5x is the DEFAULT (first
// value, matching the original vanilla-JS build's own "Simulation Speed"
// slider default of 5.0x), not 1x.
const SPEED_STEPS = [5, 1, 2];
const DEFAULT_SPEED_MULTIPLIER = SPEED_STEPS[0];

// Fixed sampling interval (days of simulated time between sampled chords)
// — ported directly from the original vanilla-JS build's "Trace Interval"
// concept/value (its slider defaults/maxes out around this figure) rather
// than deriving one from a target chord count. A pair whose resonance
// needs more simulated years to close will end up with proportionally
// more chords (denser pattern) than one that closes quickly — matching
// how the original build behaves — while the earlier float32-precision
// fix (see the local per-chord distance buffer in solarSystemEngine.js)
// means even a dense pattern still renders as clean lines, not static.
const FIXED_TRACE_INTERVAL_DAYS = 10;

/** Replaces the old segmented-control-only "Simulation settings" screen —
 * merges a LIVE pattern-tracer preview (previously only shown on the
 * separate Reveal screen) with four playback controls (line/dots trace
 * style, play/pause, reset, and a tap-cycled rocket speed boost) into one
 * screen. The simulation starts paused so the user can review their pick
 * before starting it; once it completes, behaves exactly like the old
 * Reveal screen (captures a PNG snapshot, then hands off to Result).
 * Planet re-picking was removed from this screen per explicit request —
 * planetA/planetB are still read from the store (set on the Planet Select
 * screen), just no longer editable here. */
export default function SimulationScreen({ onComplete, onBack }) {
  const { planetA, planetB, speed, density, setSnapshot } = useAppStore();
  const canvasRef = useRef(null);
  const doneRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [lineStyle, setLineStyleState] = useState('solid');
  const [speedMultiplier, setSpeedMultiplierState] = useState(DEFAULT_SPEED_MULTIPLIER);

  const planetKeys = useMemo(() => [planetA, planetB], [planetA, planetB]);
  const speedCfg = SPEED_PRESETS[speed];
  const densityCfg = DENSITY_PRESETS[density];
  const planetAData = PLANETS_BY_KEY[planetA];
  const planetBData = PLANETS_BY_KEY[planetB];

  // Same resonance-aware duration logic as the old Reveal screen — run the
  // simulation for exactly the span needed to CLOSE the pair's natural
  // resonance pattern, not an arbitrary fixed span (see that screen's
  // longer note for why this matters for slow outer-planet pairs).
  const totalSimYears = useMemo(() => {
    if (!planetAData || !planetBData) return densityCfg.years;
    const resonance = findResonance(planetAData.orbitalPeriodDays, planetBData.orbitalPeriodDays);
    if (!resonance) return densityCfg.years;
    const longerPeriodDays = Math.max(planetAData.orbitalPeriodDays, planetBData.orbitalPeriodDays);
    return (resonance.longer * longerPeriodDays) / 365.25;
  }, [planetAData, planetBData, densityCfg.years]);

  const handleEngineComplete = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setIsPlaying(false);
    setTimeout(() => {
      const dataUrl = canvasRef.current?.captureDataURL();
      if (dataUrl) setSnapshot(dataUrl);
      onComplete();
    }, 900);
  }, [onComplete, setSnapshot]);

  function togglePlay() {
    const next = !isPlaying;
    setIsPlaying(next);
    canvasRef.current?.setPaused(!next);
  }

  function toggleLineStyle() {
    const next = lineStyle === 'solid' ? 'dots' : 'solid';
    setLineStyleState(next);
    canvasRef.current?.setLineStyle(next);
  }

  // Rewinds the pattern reveal to the very start and pauses it again, so
  // the user can re-review the pick before pressing play — mirrors the
  // screen's initial `startPaused` state.
  function handleReset() {
    canvasRef.current?.reset();
    canvasRef.current?.setPaused(true);
    canvasRef.current?.setSpeedMultiplier(DEFAULT_SPEED_MULTIPLIER);
    setIsPlaying(false);
    setSpeedMultiplierState(DEFAULT_SPEED_MULTIPLIER);
    doneRef.current = false;
  }

  // Tap-cycles the live speed multiplier through SPEED_STEPS on the
  // ALREADY-RUNNING simulation in real time via setSpeedMultiplier (see
  // solarSystemEngine.js), no restart needed.
  function cycleSpeed() {
    const currentIndex = SPEED_STEPS.indexOf(speedMultiplier);
    const next = SPEED_STEPS[(currentIndex + 1) % SPEED_STEPS.length];
    setSpeedMultiplierState(next);
    canvasRef.current?.setSpeedMultiplier(next);
  }

  return (
    <div className="screen screen--simulation">
      {onBack && (
        <button type="button" className="back-button" onClick={onBack} aria-label="Back to planet selection">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
      )}
      <div className="screen__header">
        <span className="eyebrow">Step 2 of 2</span>
        <h1>Simulation</h1>
      </div>

      <div className="sim-canvas-wrap">
        <SolarSystemCanvas
          ref={canvasRef}
          planetKeys={planetKeys}
          tracePattern
          startPaused
          speedDurationSec={speedCfg.durationSec}
          totalSimYears={totalSimYears}
          traceIntervalDays={FIXED_TRACE_INTERVAL_DAYS}
          initialSpeedMultiplier={DEFAULT_SPEED_MULTIPLIER}
          onComplete={handleEngineComplete}
          className="screen__canvas"
        />
      </div>

      <div className="sim-controls">
        <button
          type="button"
          className="sim-control"
          onClick={toggleLineStyle}
          aria-label={lineStyle === 'solid' ? 'Switch trace to dotted line' : 'Switch trace to solid line'}
          aria-pressed={lineStyle === 'dots'}
        >
          {lineStyle === 'solid' ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 17c2-5 4 3 6-2s4 3 6-2 2 3 4-2" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="6" cy="17" r="1.6" />
              <circle cx="9.5" cy="12.5" r="1.6" />
              <circle cx="8.5" cy="8" r="1.6" />
              <circle cx="12" cy="4.5" r="1.6" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="sim-control"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
          aria-pressed={isPlaying}
        >
          {isPlaying ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4.5" height="14" rx="1.2" />
              <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5-11-6.5z" />
            </svg>
          )}
        </button>

        <button type="button" className="sim-control" onClick={handleReset} aria-label="Reset simulation">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12a8 8 0 1 1 2.5 5.8" />
            <path d="M4 17v-5h5" />
          </svg>
        </button>

        <button
          type="button"
          className="sim-control"
          onClick={cycleSpeed}
          aria-label={`Simulation speed ${speedMultiplier}x, tap to change`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2c2.8 2.3 4.2 5.6 4.2 9.4 0 2-.4 3.8-1.1 5.4l-1.9-1.1c.5-1.3.8-2.7.8-4.3 0-2.9-1-5.4-2-7-1 1.6-2 4.1-2 7 0 1.6.3 3 .8 4.3l-1.9 1.1c-.7-1.6-1.1-3.4-1.1-5.4C7.8 7.6 9.2 4.3 12 2z" />
            <circle cx="12" cy="9.5" r="1.4" fill="#0b0b12" />
            <path d="M9 16.2l-2.4 1.4.6-2.8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15 16.2l2.4 1.4-.6-2.8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {speedMultiplier !== DEFAULT_SPEED_MULTIPLIER && <span className="sim-control__badge">{speedMultiplier}×</span>}
        </button>
      </div>
    </div>
  );
}

