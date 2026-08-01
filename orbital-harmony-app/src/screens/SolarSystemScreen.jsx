import { useCallback, useMemo, useRef, useState } from 'react';
import { Menu, Info } from 'lucide-react';
import SolarSystemCanvas from '../components/SolarSystemCanvas.jsx';
import { GlassButton } from '../components/ui/glasscn/glass-button.jsx';
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
    <div className={`screen screen--system${introDone ? ' is-ready' : ''}`}>
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

      <button type="button" className="system-menu" aria-label="Open menu">
        <Menu size={22} strokeWidth={2} aria-hidden="true" />
      </button>

      <button type="button" className="system-info" aria-label="About Orbital Harmony">
        <Info size={22} strokeWidth={2} aria-hidden="true" />
      </button>

      <div className="system-header">
        <h1>Orbital Harmony</h1>
        <p>Discover the hidden geometry created by planetary motion.</p>
      </div>

      <div className="system-cta">
        <GlassButton tone="primary" className="w-full h-12 text-base font-semibold" onClick={onNext}>
          Begin Exploring
        </GlassButton>
      </div>
    </div>
  );
}
