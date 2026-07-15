import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SolarSystemCanvas from '../components/SolarSystemCanvas.jsx';
import { PlanetChip } from '../components/PlanetCard.jsx';
import { PLANETS_BY_KEY } from '../data/planets.js';
import { useAppStore, SPEED_PRESETS, DENSITY_PRESETS } from '../store/useAppStore.js';

/** Step 5 — animated pattern reveal. Runs the engine in "duo" mode with the
 * chord tracer enabled; polls progress via rAF to drive a thin progress
 * bar, then captures a PNG snapshot and hands off to the Result screen the
 * moment the simulated span completes. */
export default function RevealScreen({ onComplete }) {
  const { planetA, planetB, speed, density, setSnapshot } = useAppStore();
  const canvasRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);

  const planetKeys = useMemo(() => [planetA, planetB], [planetA, planetB]);
  const speedCfg = SPEED_PRESETS[speed];
  const densityCfg = DENSITY_PRESETS[density];

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

  const planetAData = PLANETS_BY_KEY[planetA];
  const planetBData = PLANETS_BY_KEY[planetB];

  return (
    <div className="screen screen--reveal">
      <SolarSystemCanvas
        ref={canvasRef}
        planetKeys={planetKeys}
        tracePattern
        speedDurationSec={speedCfg.durationSec}
        totalSimYears={densityCfg.years}
        traceIntervalDays={densityCfg.traceIntervalDays}
        onComplete={handleEngineComplete}
        className="screen__canvas"
      />
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
