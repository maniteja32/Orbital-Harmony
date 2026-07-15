import { useCallback, useMemo, useRef, useState } from 'react';
import SolarSystemCanvas from '../components/SolarSystemCanvas.jsx';
import { PLANETS } from '../data/planets.js';

/** Step 2 — cinematic NASA-inspired opening: a distant establishing shot of
 * the whole system holds briefly, then the camera eases inward to a
 * Sun-dominant hero framing near Earth's orbit (see the engine's
 * `cinematicIntro` camera path). Title/subtitle/CTA stay hidden until the
 * camera settles, then fade in with a staggered delay. Gently interactive
 * (drag/zoom) once settled. */
export default function SolarSystemScreen({ onNext }) {
  const canvasRef = useRef(null);
  const planetKeys = useMemo(() => PLANETS.map((p) => p.key), []);
  const [introDone, setIntroDone] = useState(false);
  const handleIntroComplete = useCallback(() => setIntroDone(true), []);

  return (
    <div className="screen screen--system">
      <SolarSystemCanvas
        ref={canvasRef}
        planetKeys={planetKeys}
        interactive
        cinematicIntro
        orthographic
        showOrbitRings
        onIntroComplete={handleIntroComplete}
        className="screen__canvas"
      />
      <div className={`system-overlay${introDone ? ' is-visible' : ''}`}>
        <div className="system-overlay__top">
          <span className="eyebrow">Orbital Harmony</span>
          <h1>The Solar System</h1>
          <p>Discover the hidden geometry created by planetary motion.</p>
        </div>
        <button type="button" className="btn btn--primary btn--full" onClick={onNext}>
          Discover a Pattern
        </button>
      </div>
    </div>
  );
}
