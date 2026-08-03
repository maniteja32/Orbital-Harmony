import { useState } from 'react';
import { RotateCw, Home } from 'lucide-react';
import { PLANETS, PLANETS_BY_KEY } from '../data/planets.js';
import { PlanetSwipeRow } from '../components/PlanetSwipeRow.jsx';
import { MeteorField } from '../components/MeteorField.jsx';
import { GlassButton } from '../components/ui/glasscn/glass-button.jsx';
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

  // Which of the two picks the "Planet Fact" card is currently showing; the
  // reroll button flips between them.
  const [factSlot, setFactSlot] = useState('a');
  const factKey = factSlot === 'a' ? planetA : planetB;
  const factPlanet = factKey ? PLANETS_BY_KEY[factKey] : null;

  return (
    <div className="screen screen--select">
      <div className="screen__actions screen__actions--top">
        <button type="button" className="back-button back-button--icon" onClick={onBack} aria-label="Home">
          <Home size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="screen__header screen__header--mode">
        <h1>Orbitograph</h1>
        <p>Choose any two planets</p>
      </div>

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

      {/* Planet Fact card hidden for now — flip this back to `factPlanet &&`
          (and it uses factSlot / reroll below) to bring it back. */}
      {false && factPlanet && (
        <div className="planet-fact-card">
          <span className="planet-fact-card__icon" style={{ '--planet-color': factPlanet.color }} aria-hidden="true" />
          <div className="planet-fact-card__body">
            <span className="planet-fact-card__label">Planet Fact</span>
            <span className="planet-fact-card__name">{factPlanet.name}</span>
            <span className="planet-fact-card__text">{factPlanet.fact}</span>
          </div>
          <button
            type="button"
            className="planet-fact-card__reroll"
            onClick={() => setFactSlot((s) => (s === 'a' ? 'b' : 'a'))}
            aria-label="Show the other planet's fact"
          >
            <RotateCw size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="screen__actions">
        <div className="select-actions__button">
          <GlassButton tone="primary" className="w-full h-12 text-base font-medium" disabled={!canContinue} onClick={onNext}>
            Generate Pattern
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

