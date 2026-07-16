import { useState } from 'react';
import ScreenTransition from './components/ScreenTransition.jsx';
import LoadingScreen from './screens/LoadingScreen.jsx';
import SolarSystemScreen from './screens/SolarSystemScreen.jsx';
import PlanetSelectScreen from './screens/PlanetSelectScreen.jsx';
import SimulationSettingsScreen from './screens/SimulationSettingsScreen.jsx';
import RevealScreen from './screens/RevealScreen.jsx';
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
        {screen === 'select' && <PlanetSelectScreen onNext={() => goTo('settings')} />}
        {screen === 'settings' && <SimulationSettingsScreen onNext={() => goTo('reveal')} />}
        {screen === 'reveal' && <RevealScreen onComplete={() => goTo('result')} />}
        {screen === 'result' && <ResultScreen onGenerateNew={() => goTo('select')} />}
      </ScreenTransition>
      {showLoading && (
        <div className="loading-screen-slot">
          <LoadingScreen onDone={() => goTo('system')} onExited={() => setShowLoading(false)} />
        </div>
      )}
    </div>
  );
}
