import { useCallback, useMemo, useRef, useState } from 'react';
import SolarSystemCanvas from '../components/SolarSystemCanvas.jsx';
import { PLANETS } from '../data/planets.js';
import { useAppStore } from '../store/useAppStore.js';

/** Step 2 — cinematic NASA-inspired opening: a distant establishing shot of
 * the whole system holds briefly, then the camera eases inward to a
 * Sun-dominant hero framing near Earth's orbit (see the engine's
 * `cinematicIntro` camera path). Title/subtitle/mode cards stay hidden until
 * the camera settles, then fade in with a staggered delay. Gently interactive
 * (drag/zoom) once settled.
 *
 * The two mode cards (Explore / Cosmic Signature) live directly on this
 * landing screen — picking one jumps straight into that flow, so there's no
 * separate intermediate "Choose an Experience" screen to tap through.
 *
 * The zoom-in intro only plays the FIRST time the screen is shown; on
 * return visits (e.g. Back from a pattern flow) it jumps straight to the
 * settled zoomed framing so the animation never replays. */
export default function SolarSystemScreen({ onExplore, onCosmic }) {
  const canvasRef = useRef(null);
  const planetKeys = useMemo(() => PLANETS.map((p) => p.key), []);
  const systemIntroPlayed = useAppStore((s) => s.systemIntroPlayed);
  const markSystemIntroPlayed = useAppStore((s) => s.markSystemIntroPlayed);
  const playIntro = !systemIntroPlayed;
  // When skipping the intro the camera is already settled, so treat the
  // screen as ready immediately (title/cards/chrome shown from the first frame).
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

      <div className="system-header">
        <h1>Orbital Harmony</h1>
        <p>Discover the hidden patterns of planetary motion.</p>
      </div>

      <div className="system-cta">
        <div className="system-modes">
          <button type="button" className="mode-card" onClick={onExplore}>
            <span className="mode-card__text">
              <span className="mode-card__title">Explore</span>
              <span className="mode-card__desc">Create patterns using any two planets.</span>
            </span>
          </button>

          <button type="button" className="mode-card" onClick={onCosmic}>
            <span className="mode-card__text">
              <span className="mode-card__title">Cosmic Signature</span>
              <span className="mode-card__desc">Generate a unique pattern using your birthdate.</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
