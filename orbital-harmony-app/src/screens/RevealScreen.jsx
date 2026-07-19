import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SolarSystemCanvas from '../components/SolarSystemCanvas.jsx';
import { PlanetChip } from '../components/PlanetCard.jsx';
import { PLANETS_BY_KEY } from '../data/planets.js';
import { findResonance } from '../utils/resonance.js';
import { useAppStore, SPEED_PRESETS, DENSITY_PRESETS } from '../store/useAppStore.js';

/** Step 5 — animated pattern reveal. Runs the engine in "duo" mode with the
 * chord tracer enabled; polls progress via rAF to drive a thin progress
 * bar, then captures a PNG snapshot and hands off to the Result screen the
 * moment the simulated span completes. */
export default function RevealScreen({ onComplete, onBack }) {
  const { planetA, planetB, speed, density, setSnapshot } = useAppStore();
  const canvasRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);

  const planetKeys = useMemo(() => [planetA, planetB], [planetA, planetB]);
  const speedCfg = SPEED_PRESETS[speed];
  const densityCfg = DENSITY_PRESETS[density];
  const planetAData = PLANETS_BY_KEY[planetA];
  const planetBData = PLANETS_BY_KEY[planetB];

  // BUG FIX: this used to be a flat `densityCfg.years` (4/8/16) regardless
  // of which two planets were picked — fine for close/fast pairs, but for
  // anything involving a slow outer planet (e.g. Saturn's ~29.5-year
  // period) that's nowhere near enough simulated time to complete even ONE
  // full resonance cycle, so the chord tracer visibly stopped partway
  // through the shape (a narrow wedge instead of the full closed rosette)
  // — exactly the "abrupt stop" bug reported. Fix: when the pair has a
  // clean low-order resonance (see utils/resonance.js), run the simulation
  // for EXACTLY the number of years needed to complete that resonance's
  // full closed pattern (`longer` orbits of whichever planet has the
  // LONGER period) instead of the density preset's arbitrary fixed span.
  // Only falls back to the preset's fixed years when no clean resonance
  // exists at all (nothing to "close", so an arbitrary span is fine).
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
    setTimeout(() => {
      const dataUrl = canvasRef.current?.captureDataURL();
      if (dataUrl) setSnapshot(dataUrl);
      onComplete();
    }, 900);
  }, [onComplete, setSnapshot]);

  useEffect(() => {
    let raf;
    const poll = () => {
      setProgress(canvasRef.current?.getProgress() ?? 0);
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="screen screen--reveal">
      <SolarSystemCanvas
        ref={canvasRef}
        planetKeys={planetKeys}
        tracePattern
        speedDurationSec={speedCfg.durationSec}
        totalSimYears={totalSimYears}
        traceIntervalDays={densityCfg.traceIntervalDays}
        onComplete={handleEngineComplete}
        className="screen__canvas"
      />
      {onBack && (
        <button type="button" className="back-button back-button--floating" onClick={onBack} aria-label="Back to simulation settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
      )}
      <div className="reveal-overlay">
        <div className="reveal-overlay__top">
          <span className="eyebrow">Revealing geometry</span>
          <div className="reveal-chips">
            <PlanetChip planet={planetAData} />
            <span className="reveal-chips__and">&amp;</span>
            <PlanetChip planet={planetBData} />
          </div>
        </div>
        <div className="progress-bar">
          <div className="progress-bar__fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
