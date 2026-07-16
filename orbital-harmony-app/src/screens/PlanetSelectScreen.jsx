import { PLANETS } from '../data/planets.js';
import { PlanetSwipeRow } from '../components/PlanetSwipeRow.jsx';
import { useAppStore } from '../store/useAppStore.js';

/** Step 1 — pick Planet A then Planet B via two independent swipeable
 * "coverflow" rows (one planet centered/enlarged at a time per row),
 * instead of a tap-to-pick grid. Whichever planet is centered in each row
 * IS that slot's current pick — duplicates aren't blocked mid-swipe (the
 * user may pass through the other slot's planet while scrolling), only
 * Continue is disabled until the two rows land on different planets. */
export default function PlanetSelectScreen({ onNext }) {
  const { planetA, planetB, setPlanetA, setPlanetB } = useAppStore();

  const canContinue = Boolean(planetA && planetB && planetA !== planetB);

  return (
    <div className="screen screen--select">
      <div className="screen__header">
        <span className="eyebrow">Step 1 of 2</span>
        <h1>Choose two planets</h1>
        <p>Swipe each row to reveal their combined hidden geometry.</p>
      </div>

      <div className="swipe-select">
        <PlanetSwipeRow
          label="Planet A"
          planets={PLANETS}
          selectedKey={planetA}
          initialKey={PLANETS[0].key}
          onSelect={setPlanetA}
          duplicateWarning={Boolean(planetA) && planetA === planetB}
        />
        <PlanetSwipeRow
          label="Planet B"
          planets={PLANETS}
          selectedKey={planetB}
          initialKey={PLANETS[2]?.key ?? PLANETS[0].key}
          onSelect={setPlanetB}
          duplicateWarning={Boolean(planetB) && planetB === planetA}
        />
      </div>

      <button type="button" className="btn btn--primary btn--full" disabled={!canContinue} onClick={onNext}>
        Continue
      </button>
    </div>
  );
}

