import { useState, useRef, useEffect } from 'react';
import ScreenTransition from './components/ScreenTransition.jsx';
import LoadingScreen from './screens/LoadingScreen.jsx';
import SolarSystemScreen from './screens/SolarSystemScreen.jsx';
import ModeSelectScreen from './screens/ModeSelectScreen.jsx';
import CosmicSignatureScreen from './screens/CosmicSignatureScreen.jsx';
import PlanetSelectScreen from './screens/PlanetSelectScreen.jsx';
import GeneratingScreen from './screens/GeneratingScreen.jsx';
import SimulationScreen from './screens/SimulationScreen.jsx';
import ResultScreen from './screens/ResultScreen.jsx';
import { useAppStore } from './store/useAppStore.js';
import { createStarfieldBackdrop } from './engine/starfieldBackdrop.js';
import { preloadPlanetTextures } from './engine/planetFactory.js';

export default function App() {
  const screen = useAppStore((s) => s.screen);
  const goTo = useAppStore((s) => s.goTo);
  const patternMode = useAppStore((s) => s.patternMode);
  const setPatternMode = useAppStore((s) => s.setPatternMode);
  const setCosmicDate = useAppStore((s) => s.setCosmicDate);

  // Warm the shared planet-texture cache the moment the app mounts, while the
  // ~5s loading sequence is on screen. The Solar System engine is only built
  // at the loading -> landing handoff, so without this every planet texture
  // would fetch + decode + run its per-pixel saturation boost on the main
  // thread right as the crossfade plays — the cause of the "start/stop" lag
  // and planets popping in untextured on mobile/iPad. Doing it here means the
  // landing appears already fully textured and the handoff stays smooth.
  useEffect(() => {
    preloadPlanetTextures();
  }, []);
  // Kept mounted independently of `screen` (not one of the ScreenTransition
  // branches below) so it can sit on top of the Solar System screen and
  // fade out WHILE that screen fades in underneath — a real overlapping
  // crossfade rather than a sequential fade-out-then-fade-in. `onDone`
  // (fired the instant the fade-out starts, see LoadingScreen.jsx) flips
  // `screen` to 'system' right away so that fade-in can begin immediately;
  // `onExited` (fired once the fade-out visually finishes) is what
  // actually removes this from the tree.
  const [showLoading, setShowLoading] = useState(true);

  // Ambient full-viewport starfield behind the app. On a phone the centered
  // app column fills the whole screen so this is never seen; on a wider
  // (desktop/web) viewport it fills the side margins with the SAME twinkling
  // starfield the app uses, so the mobile-first column reads as "floating in
  // space" instead of a narrow strip cropped in dead black. Mounted ONLY when
  // there are actually margins (>= 561px, the column's 560px cap) so phones
  // don't spin up an extra WebGL context for something they'd never show.
  const ambientRef = useRef(null);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 561px)');
    let backdrop = null;
    const sync = () => {
      if (mq.matches && !backdrop && ambientRef.current) {
        backdrop = createStarfieldBackdrop(ambientRef.current);
      } else if (!mq.matches && backdrop) {
        backdrop.dispose();
        backdrop = null;
      }
    };
    sync();
    mq.addEventListener('change', sync);
    return () => {
      mq.removeEventListener('change', sync);
      backdrop?.dispose();
    };
  }, []);

  return (
    <div className="app-shell" data-screen={screen}>
      <canvas ref={ambientRef} className="ambient-stars" aria-hidden="true" />
      <ScreenTransition key={screen}>
        {screen === 'system' && (
          <SolarSystemScreen
            onExplore={() => {
              setPatternMode('explore');
              setCosmicDate(null);
              goTo('select');
            }}
            onCosmic={() => goTo('cosmic')}
          />
        )}
        {screen === 'mode' && (
          <ModeSelectScreen
            onExplore={() => {
              setPatternMode('explore');
              setCosmicDate(null);
              goTo('select');
            }}
            onCosmic={() => goTo('cosmic')}
            onBack={() => goTo('system')}
          />
        )}
        {screen === 'select' && <PlanetSelectScreen onNext={() => goTo('generating')} onBack={() => goTo('system')} />}
        {screen === 'cosmic' && <CosmicSignatureScreen onReveal={() => goTo('generating')} onBack={() => goTo('system')} />}
        {screen === 'generating' && (
          <GeneratingScreen
            onDone={() => goTo('settings')}
            onBack={() => goTo(patternMode === 'cosmic' ? 'cosmic' : 'select')}
          />
        )}
        {screen === 'settings' && (
          <SimulationScreen
            onComplete={() => goTo('result')}
            onBack={() => goTo(patternMode === 'cosmic' ? 'cosmic' : 'select')}
          />
        )}
        {screen === 'result' && <ResultScreen onGenerateNew={() => goTo('system')} onBack={() => goTo('settings')} />}
      </ScreenTransition>
      {showLoading && (
        <div className="loading-screen-slot">
          <LoadingScreen onDone={() => goTo('system')} onExited={() => setShowLoading(false)} />
        </div>
      )}
      {/* Referenced by `.glass-btn`'s `backdrop-filter: url(#glass-distortion)`
          (see index.css) — a subtle feTurbulence + feDisplacementMap filter
          that bends/refracts whatever sits behind each Liquid Glass button,
          the actual "background refraction through the glass" effect (a
          gradient alone can only fake a highlight, never real distortion).
          Rendered once, globally, completely invisible (0×0, no fill/
          stroke) — SVG filters just need to exist somewhere in the
          document to be referenced by id from CSS anywhere else. Browsers
          that don't support referencing an SVG filter from
          `backdrop-filter` simply ignore that one (invalid) value and fall
          back to the plain blur declared earlier in the same rule — see
          the CSS comment above `.glass-btn` for why that's safe. */}
      <svg aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <filter id="glass-distortion" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="7" result="glassNoise" />
          <feGaussianBlur in="glassNoise" stdDeviation="3" result="glassNoiseBlurred" />
          <feDisplacementMap in="SourceGraphic" in2="glassNoiseBlurred" scale="14" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
    </div>
  );
}
