import { useCallback, useMemo, useRef, useState } from 'react';
import { Menu, Info } from 'lucide-react';
import SolarSystemCanvas from '../components/SolarSystemCanvas.jsx';
import { GlassButton } from '../components/ui/glasscn/glass-button.jsx';
import { PLANETS } from '../data/planets.js';
import { useAppStore } from '../store/useAppStore.js';

/** Step 2 — cinematic NASA-inspired opening: a distant establishing shot of
 * the whole system holds briefly, then the camera eases inward to a
 * Sun-dominant hero framing near Earth's orbit (see the engine's
 * `cinematicIntro` camera path). Title/subtitle/CTA stay hidden until the
 * camera settles, then fade in with a staggered delay. Gently interactive
 * (drag/zoom) once settled.
 *
 * The zoom-in intro only plays the FIRST time the screen is shown; on
 * return visits (e.g. Back from Mode select) it jumps straight to the
 * settled zoomed framing so the animation never replays. */
export default function SolarSystemScreen({ onNext }) {
  const canvasRef = useRef(null);
  const planetKeys = useMemo(() => PLANETS.map((p) => p.key), []);
  const systemIntroPlayed = useAppStore((s) => s.systemIntroPlayed);
  const markSystemIntroPlayed = useAppStore((s) => s.markSystemIntroPlayed);
  const playIntro = !systemIntroPlayed;
  // When skipping the intro the camera is already settled, so treat the
  // screen as ready immediately (title/CTA/chrome shown from the first frame).
  const [introDone, setIntroDone] = useState(!playIntro);
  const handleIntroComplete = useCallback(() => {
    setIntroDone(true);
    markSystemIntroPlayed();
  }, [markSystemIntroPlayed]);

  return (
    <div className={`screen screen--system${introDone ? ' is-ready' : ''}`}>
      <SolarSystemCanvas
        ref={canvasRef}
        planetKeys={planetKeys}
        interactive
        cinematicIntro={playIntro}
        startSettled={!playIntro}
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
