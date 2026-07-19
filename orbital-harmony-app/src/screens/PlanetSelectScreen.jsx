import { PLANETS } from '../data/planets.js';
import { PlanetSwipeRow } from '../components/PlanetSwipeRow.jsx';
import { useAppStore } from '../store/useAppStore.js';

/** Step 1 — pick Planet A then Planet B via two independent swipeable
 * "coverflow" rows (one planet centered/enlarged at a time per row),
 * instead of a tap-to-pick grid. Whichever planet is centered in each row
 * IS that slot's current pick. Duplicate selection is prevented ENTIRELY
 * (not just blocked-with-a-warning at Continue): each row is told the
 * OTHER row's current pick via `excludeKey`, renders it disabled/faded,
 * and auto-skips past it if a swipe ever settles nearby — so Planet A and
 * Planet B can never end up the same planet. */
export default function PlanetSelectScreen({ onNext }) {
  const { planetA, planetB, setPlanetA, setPlanetB } = useAppStore();

  const canContinue = Boolean(planetA && planetB && planetA !== planetB);

  return (
    <div className="screen screen--select">
      <div className="screen__header">
        <span className="eyebrow">Step 1 of 2</span>
        <h1>Choose two planets</h1>
      </div>

      <div className="swipe-select">
        <PlanetSwipeRow
          label="Planet A"
          planets={PLANETS}
          selectedKey={planetA}
          initialKey={PLANETS[0].key}
          onSelect={setPlanetA}
          excludeKey={planetB}
        />
        <PlanetSwipeRow
          label="Planet B"
          planets={PLANETS}
          selectedKey={planetB}
          initialKey={PLANETS[2]?.key ?? PLANETS[0].key}
          onSelect={setPlanetB}
          excludeKey={planetA}
        />
      </div>

      <button type="button" className="btn btn--primary btn--full" disabled={!canContinue} onClick={onNext}>
        Continue
      </button>
    </div>
  );
}

