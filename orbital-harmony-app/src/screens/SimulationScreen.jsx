import { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import SolarSystemCanvas from '../components/SolarSystemCanvas.jsx';
import LiquidGlassIconButton from '../components/LiquidGlassIconButton.jsx';
import { PLANETS, PLANETS_BY_KEY } from '../data/planets.js';
import { patternTimeframe } from '../utils/resonance.js';
import { useAppStore, SPEED_PRESETS } from '../store/useAppStore.js';

// Tap-cycled live playback-rate multiplier steps for the rocket button
// (see setSpeedMultiplier in solarSystemEngine.js) — each tap advances to
// the next step, wrapping back to the default. 1x is the DEFAULT (first
// value) for a slow, graceful pattern reveal; taps speed it up for anyone
// impatient. (Was 5x, but the pattern creation looked rushed on mobile.)
const SPEED_STEPS = [1, 2, 5];
const DEFAULT_SPEED_MULTIPLIER = SPEED_STEPS[0];

// Chord sampling: how many chords to draw PER petal/lobe of the pattern.
// Scaling with the petal count keeps every pattern's line density roughly
// consistent — a 5-petal rose and a 37-petal mandala both read cleanly
// rather than one sparse and one an overdrawn scribble. Kept deliberately
// LOW: the chord "string art" resolves into distinct, legible petals at a
// modest line count (e.g. Earth+Venus's clean 5-rose), whereas a high
// count fills every pair into an indistinct dense mandala. Min/max clamp
// keeps degenerate or very-high-petal pairs bounded (engine also caps
// total chords at 40k).
const CHORDS_PER_PETAL = 13;
const MIN_CHORDS = 70;
const MAX_CHORDS = 1600;

// Cosmic Signature — connects ALL planets (positioned at their real birth
// date/time locations) in a closed loop and sweeps the wired figure over a
// fixed span. ~1 Jupiter orbit lets the inner planets loop many times (rich
// web) while the slow outer planets act as drifting anchors.
const SIGNATURE_YEARS = 12;
const SIGNATURE_SAMPLES = 260;

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
  const { planetA, planetB, speed, setSnapshot, cosmicDate, patternMode } = useAppStore();
  const canvasRef = useRef(null);
  const doneRef = useRef(false);
  const isCosmic = patternMode === 'cosmic';

  const [isPlaying, setIsPlaying] = useState(false);
  const [lineStyle, setLineStyleState] = useState('solid');
  const [speedMultiplier, setSpeedMultiplierState] = useState(DEFAULT_SPEED_MULTIPLIER);

  const planetKeys = useMemo(
    () => (isCosmic ? PLANETS.map((p) => p.key) : [planetA, planetB]),
    [isCosmic, planetA, planetB],
  );
  const speedCfg = SPEED_PRESETS[speed];
  const planetAData = PLANETS_BY_KEY[planetA];
  const planetBData = PLANETS_BY_KEY[planetB];

  // Resonance-driven run length + chord density (see utils/resonance.js
  // `patternTimeframe`): run for exactly the pair's real orbital-resonance
  // closure so each combination traces its TRUE characteristic pattern
  // (e.g. Earth+Venus's 8:13 => a clean 5-petaled rose), with chord count
  // scaled to the petal count for consistent line density. In Cosmic mode a
  // fixed span sweeps the all-planets figure instead.
  const { totalSimYears, traceIntervalDays } = useMemo(() => {
    if (isCosmic) {
      return { totalSimYears: SIGNATURE_YEARS, traceIntervalDays: (SIGNATURE_YEARS * 365.25) / SIGNATURE_SAMPLES };
    }
    if (!planetAData || !planetBData) return { totalSimYears: 8, traceIntervalDays: 3 };
    const { years, petals } = patternTimeframe(
      planetAData.orbitalPeriodDays,
      planetBData.orbitalPeriodDays,
      planetAData.key,
      planetBData.key,
    );
    const chords = Math.min(Math.max((petals ?? 6) * CHORDS_PER_PETAL, MIN_CHORDS), MAX_CHORDS);
    return { totalSimYears: years, traceIntervalDays: (years * 365.25) / chords };
  }, [isCosmic, planetAData, planetBData]);

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
      <div className="screen__topbar">
        {onBack && (
          <button type="button" className="back-button" onClick={onBack} aria-label="Back to planet selection">
            <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
            Back
          </button>
        )}
        <div className="screen__header">
          {isCosmic && <span className="eyebrow">Cosmic Signature</span>}
          <h1>{isCosmic ? 'Your Signature' : 'Your Pattern'}</h1>
        </div>
      </div>

      <div className="sim-canvas-wrap">
        <SolarSystemCanvas
          ref={canvasRef}
          planetKeys={planetKeys}
          tracePattern
          physicalPattern
          connectAllPlanets={isCosmic}
          startPaused
          speedDurationSec={speedCfg.durationSec}
          totalSimYears={totalSimYears}
          traceIntervalDays={traceIntervalDays}
          initialSpeedMultiplier={DEFAULT_SPEED_MULTIPLIER}
          patternStartDate={cosmicDate ?? undefined}
          onComplete={handleEngineComplete}
          className="screen__canvas"
        />
      </div>

      <div className="sim-controls">
        {/* Trace line-style toggle — solid-line glyph is the exact path
            from the Figma "Frame 392" export (assets/Icons/Frame 392.svg);
            the dotted-line alternate state has no matching Figma asset so
            it keeps its original glyph. */}
        <LiquidGlassIconButton
          label={lineStyle === 'solid' ? 'Switch trace to dotted line' : 'Switch trace to solid line'}
          pressed={lineStyle === 'dots'}
          isActive={lineStyle === 'dots'}
          onClick={toggleLineStyle}
          icon={
            lineStyle === 'solid' ? (
              <svg width="24" height="24" viewBox="0 0 60 60" fill="currentColor" aria-hidden="true">
                <path d="M23.5397 37.901L19.793 39.7843C18.1537 40.6083 17.7394 42.7614 18.9557 44.135C19.5521 44.8085 20.4395 45.16 21.3318 45.0464C24.7788 44.6075 26.7583 43.9196 29.2707 41.8819C31.9606 39.7002 33.0136 36.1245 32.6015 32.6857L32.1905 29.2565C31.8068 26.0551 33.6513 23.0035 36.664 21.8549L40.8671 20.2527C42.4829 19.6367 43.218 17.7638 42.4527 16.2132C41.8055 14.9019 40.2876 14.2596 38.9156 14.7654C35.8657 15.8896 33.4571 17.0412 30.8823 18.506C27.3647 20.5071 25.6207 24.581 26.2841 28.5733L26.7759 31.5331C27.2083 34.1354 25.8967 36.7163 23.5397 37.901Z" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="6" cy="17" r="1.6" />
                <circle cx="9.5" cy="12.5" r="1.6" />
                <circle cx="8.5" cy="8" r="1.6" />
                <circle cx="12" cy="4.5" r="1.6" />
              </svg>
            )
          }
        />

        {/* Play/Pause — sized up as the row's primary action (matches the
            Figma "Frame 392-1" play triangle, exported at 81px vs. the
            other controls' 60px, a bigger canvas than the icon glyphs
            below). Play glyph path is the exact Figma export
            (assets/Icons/Frame 392-1.svg); Pause has no matching asset so
            it keeps its original bars glyph. */}
        <LiquidGlassIconButton
          label={isPlaying ? 'Pause simulation' : 'Play simulation'}
          pressed={isPlaying}
          isActive={isPlaying}
          size={80}
          className="glass-btn--primary"
          onClick={togglePlay}
          icon={
            isPlaying ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="5" width="4.5" height="14" rx="1.2" />
                <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" />
              </svg>
            ) : (
              <svg width="30" height="30" viewBox="0 0 81 81" fill="currentColor" aria-hidden="true">
                <path d="M26.3058 55.1792V25.5238C26.3058 23.415 28.5599 22.0725 30.4141 23.0768L57.7883 37.9046C59.7316 38.9571 59.7316 41.7459 57.7883 42.7985L30.4141 57.6262C28.5599 58.6305 26.3058 57.288 26.3058 55.1792Z" />
              </svg>
            )
          }
        />

        {/* Reset — exact path from the Figma "Frame 395" export
            (assets/Icons/Frame 395.svg). */}
        <LiquidGlassIconButton
          label="Reset simulation"
          onClick={handleReset}
          icon={
            <svg width="24" height="24" viewBox="0 0 60 60" fill="currentColor" aria-hidden="true">
              <path d="M18.02 12.8034L17.595 13.0488L17.5847 13.0652C17.4671 13.2491 17.2832 13.4357 17.2159 13.657C17.039 14.237 16.8832 14.8434 16.7244 15.4283L15.7953 18.8405L14.7546 22.6601C14.5779 23.3079 14.3915 23.958 14.2312 24.6072C14.1085 25.1041 14.378 25.7021 14.8121 25.9588C15.1144 26.1375 15.5655 26.2263 15.9095 26.3167L17.0424 26.6144L20.3448 27.484L24.0487 28.4601C24.6895 28.6289 25.34 28.8059 25.9841 28.9626C26.1946 29.0137 26.4418 29.0208 26.6546 28.97C26.9873 28.8873 27.2744 28.6768 27.4529 28.3847C27.6183 28.1168 27.7062 27.7673 27.6338 27.4558C27.5224 26.977 26.6664 25.618 26.3697 25.1045C26.0889 24.6191 25.824 24.1094 25.5156 23.6422C25.8724 23.4635 26.3903 23.1859 26.7428 23.0422C28.8801 22.1478 31.2475 21.9728 33.4833 22.5441C33.5824 22.5688 33.6769 22.6018 33.7745 22.6302C37.0626 23.5887 39.5487 25.9569 40.7278 29.1744C41.5378 31.3724 41.5627 33.7865 40.7983 36.0122C38.9434 41.4796 32.974 44.4837 27.4762 42.7285C25.4917 42.0949 23.7031 40.8704 22.4303 39.2291C21.4195 37.9256 20.6973 38.5323 19.5422 39.1996L17.7691 40.224L16.5643 40.9201C16.0543 41.2143 15.5039 41.4577 15.3064 42.0596C15.1535 42.5253 15.2803 42.9025 15.5462 43.2882C15.8816 43.7749 16.2386 44.243 16.6237 44.692C18.8569 47.2897 21.7721 49.2172 25.0474 50.2616C28.6398 51.387 32.4971 51.4068 36.1173 50.3186C36.6489 50.1552 37.1189 49.9864 37.6327 49.7828C37.897 49.678 38.8094 49.2199 39.0116 49.1813L40.9139 48.0831C41.1245 47.8468 41.7293 47.4744 42.018 47.2498C45.2349 44.7458 47.3784 41.3455 48.4985 37.4548C49.8014 32.8327 49.2464 27.8999 46.9515 23.705C44.5677 19.4229 40.5556 16.2812 35.8095 14.9802C31.6775 13.8342 27.2625 14.166 23.3289 15.9181C22.6952 16.1989 22.1847 16.4734 21.5811 16.8121C21.5073 16.66 21.3625 16.4322 21.2735 16.2785L20.6492 15.1981L20.0009 14.0743C19.6251 13.4225 19.2709 12.6651 18.3647 12.7612C18.265 12.7718 18.154 12.7971 18.0567 12.8019L18.02 12.8034Z" />
            </svg>
          }
        />

        <LiquidGlassIconButton
          label={`Simulation speed ${speedMultiplier}x, tap to change`}
          isActive={speedMultiplier !== DEFAULT_SPEED_MULTIPLIER}
          onClick={cycleSpeed}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2c2.8 2.3 4.2 5.6 4.2 9.4 0 2-.4 3.8-1.1 5.4l-1.9-1.1c.5-1.3.8-2.7.8-4.3 0-2.9-1-5.4-2-7-1 1.6-2 4.1-2 7 0 1.6.3 3 .8 4.3l-1.9 1.1c-.7-1.6-1.1-3.4-1.1-5.4C7.8 7.6 9.2 4.3 12 2z" />
              <circle cx="12" cy="9.5" r="1.4" fill="#0b0b12" />
              <path d="M9 16.2l-2.4 1.4.6-2.8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 16.2l2.4 1.4-.6-2.8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          badge={speedMultiplier !== DEFAULT_SPEED_MULTIPLIER && <span className="glass-btn__badge">{speedMultiplier}×</span>}
        />
      </div>
    </div>
  );
}

