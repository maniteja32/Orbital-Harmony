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

  return (
    <div className="app-shell">
      <ScreenTransition key={screen}>
        {screen === 'loading' && <LoadingScreen onDone={() => goTo('system')} />}
        {screen === 'system' && <SolarSystemScreen onNext={() => goTo('select')} />}
        {screen === 'select' && <PlanetSelectScreen onNext={() => goTo('settings')} />}
        {screen === 'settings' && <SimulationSettingsScreen onNext={() => goTo('reveal')} />}
        {screen === 'reveal' && <RevealScreen onComplete={() => goTo('result')} />}
        {screen === 'result' && <ResultScreen onGenerateNew={() => goTo('select')} />}
      </ScreenTransition>
    </div>
  );
}
