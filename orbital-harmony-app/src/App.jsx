import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import ScreenTransition from './components/ScreenTransition.jsx';
import LoadingScreen from './screens/LoadingScreen.jsx';
// Eagerly imported (not lazy) — it's the very first screen shown right after
// the loading screen's crossfade, so its JS must already be loaded/parsed by
// the time that handoff happens. Lazy-loading it left a window where the
// Suspense fallback (a bare unstyled div) rendered underneath the
// already-fading-out loading screen while its chunk was still being
// fetched/parsed on mobile — the cause of the visible black gap.
import SolarSystemScreen from './screens/SolarSystemScreen.jsx';

// Lazy load all screens except LoadingScreen/SolarSystemScreen to reduce
// initial bundle size.
const CosmicSignatureScreen = lazy(() => import('./screens/CosmicSignatureScreen.jsx'));
const PlanetSelectScreen = lazy(() => import('./screens/PlanetSelectScreen.jsx'));
const SimulationScreen = lazy(() => import('./screens/SimulationScreen.jsx'));
const ResultScreen = lazy(() => import('./screens/ResultScreen.jsx'));
const PatternDetailsScreen = lazy(() => import('./screens/PatternDetailsScreen.jsx'));

// Fallback component for lazy-loaded screens
function ScreenFallback() {
  return <div className="screen-fallback" />;
}

import { useAppStore } from './store/useAppStore.js';
import { createStarfieldBackdrop } from './engine/starfieldBackdrop.js';
import { preloadPlanetTextures } from './engine/planetFactory.js';

export default function App() {
  const screen = useAppStore((s) => s.screen);
  const goTo = useAppStore((s) => s.goTo);
  const patternMode = useAppStore((s) => s.patternMode);
  const setPatternMode = useAppStore((s) => s.setPatternMode);
  const setCosmicDate = useAppStore((s) => s.setCosmicDate);
  const setLineStyle = useAppStore((s) => s.setLineStyle);

  useEffect(() => {
    try {
      localStorage.removeItem('orbital-harmony');
      localStorage.removeItem('space-harmony:factoid-history:v1');
    } catch {
      /* storage can be unavailable in private browsing contexts */
    }
  }, []);

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
  // app column fills the whole screen, so this reads as the background for
  // screens with no dedicated full-bleed canvas of their own (Mode Select,
  // Planet Select, Cosmic Signature, etc.) instead of dead black; on a wider
  // (desktop/web) viewport it ALSO fills the side margins with the SAME
  // twinkling starfield, so the mobile-first column reads as "floating in
  // space". Screens that render their own opaque full-bleed starfield
  // (Loading, System/Landing) simply paint over this on top, so mounting it
  // unconditionally causes no visible change there.
  const ambientRef = useRef(null);
  useEffect(() => {
    const backdrop = ambientRef.current ? createStarfieldBackdrop(ambientRef.current) : null;
    return () => {
      backdrop?.dispose();
    };
  }, []);

  return (
    <div className={`app-shell${showLoading ? ' is-loading' : ''}`} data-screen={screen}>
      <canvas ref={ambientRef} className="ambient-stars" aria-hidden="true" />
      <ScreenTransition key={screen} screen={screen}>
        <Suspense fallback={<ScreenFallback />}>
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
          {screen === 'select' && <PlanetSelectScreen onNext={() => goTo('settings')} onBack={() => goTo('system')} />}
          {screen === 'cosmic' && <CosmicSignatureScreen onReveal={() => goTo('settings')} onBack={() => goTo('system')} />}
          {screen === 'settings' && (
            <SimulationScreen
              onComplete={() => goTo('result')}
              onBack={() => goTo(patternMode === 'cosmic' ? 'cosmic' : 'select')}
            />
          )}
          {screen === 'result' && (
            <ResultScreen
              onGenerateNew={() => goTo(patternMode === 'cosmic' ? 'cosmic' : 'select')}
              onBack={() => {
                // Back to the live Simulation screen should resume from its
                // own default (solid) line style, not whatever was tried
                // here on the result screen while comparing styles.
                if (patternMode !== 'cosmic') setLineStyle('solid');
                goTo(patternMode === 'cosmic' ? 'cosmic' : 'settings');
              }}
              onViewDetails={() => goTo('details')}
            />
          )}
          {screen === 'details' && (
            <PatternDetailsScreen
              onBack={() => goTo('result')}
            />
          )}
        </Suspense>
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
