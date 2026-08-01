import { useState } from 'react';
import ScreenTransition from './components/ScreenTransition.jsx';
import LoadingScreen from './screens/LoadingScreen.jsx';
import SolarSystemScreen from './screens/SolarSystemScreen.jsx';
import PlanetSelectScreen from './screens/PlanetSelectScreen.jsx';
import SimulationScreen from './screens/SimulationScreen.jsx';
import ResultScreen from './screens/ResultScreen.jsx';
import { useAppStore } from './store/useAppStore.js';

export default function App() {
  const screen = useAppStore((s) => s.screen);
  const goTo = useAppStore((s) => s.goTo);
  // Kept mounted independently of `screen` (not one of the ScreenTransition
  // branches below) so it can sit on top of the Solar System screen and
  // fade out WHILE that screen fades in underneath — a real overlapping
  // crossfade rather than a sequential fade-out-then-fade-in. `onDone`
  // (fired the instant the fade-out starts, see LoadingScreen.jsx) flips
  // `screen` to 'system' right away so that fade-in can begin immediately;
  // `onExited` (fired once the fade-out visually finishes) is what
  // actually removes this from the tree.
  const [showLoading, setShowLoading] = useState(true);

  return (
    <div className="app-shell">
      <ScreenTransition key={screen}>
        {screen === 'system' && <SolarSystemScreen onNext={() => goTo('select')} />}
        {screen === 'select' && <PlanetSelectScreen onNext={() => goTo('settings')} onBack={() => goTo('system')} />}
        {screen === 'settings' && <SimulationScreen onComplete={() => goTo('result')} onBack={() => goTo('select')} />}
        {screen === 'result' && <ResultScreen onGenerateNew={() => goTo('select')} onBack={() => goTo('settings')} />}
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
