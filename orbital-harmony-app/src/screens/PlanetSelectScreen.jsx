import { PLANETS } from '../data/planets.js';
import { PlanetSwipeRow } from '../components/PlanetSwipeRow.jsx';
import { MeteorField } from '../components/MeteorField.jsx';
import { TopNavigationBar } from '../components/TopNavigationBar.jsx';
import { useAppStore } from '../store/useAppStore.js';

/** Step 1 — pick Planet A then Planet B via two independent swipeable
 * "coverflow" rows (one planet centered/enlarged at a time per row),
 * instead of a tap-to-pick grid. Whichever planet is centered in each row
 * IS that slot's current pick. Duplicate selection is prevented ENTIRELY
 * (not just blocked-with-a-warning at Continue): each row is told the
 * OTHER row's current pick via `excludeKey`, renders it disabled/faded,
 * and auto-skips past it if a swipe ever settles nearby — so Planet A and
 * Planet B can never end up the same planet. */
export default function PlanetSelectScreen({ onNext, onBack }) {
  const { planetA, planetB, setPlanetA, setPlanetB } = useAppStore();

  const canContinue = Boolean(planetA && planetB && planetA !== planetB);

  return (
    <div className="screen screen--select">
      <TopNavigationBar title="Orbitograph" onBack={onBack} />

      <div className="planet-picker">
        <p className="screen-intro">Choose two planets</p>

        <div className="swipe-select">
          <MeteorField />
          <PlanetSwipeRow
            label="Planet A"
            planets={PLANETS}
            selectedKey={planetA}
            initialKey={PLANETS[0].key}
            onSelect={setPlanetA}
            excludeKey={planetB}
            hideInfo
          />
          <PlanetSwipeRow
            label="Planet B"
            planets={PLANETS}
            selectedKey={planetB}
            initialKey={PLANETS[2]?.key ?? PLANETS[0].key}
            onSelect={setPlanetB}
            excludeKey={planetA}
            hideInfo
          />
        </div>
      </div>

      <div className="screen__actions">
        <div className="select-actions__button">
          <button type="button" className="btn-frosted-pill" disabled={!canContinue} onClick={onNext}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

