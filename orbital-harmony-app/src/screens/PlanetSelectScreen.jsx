import { useState } from 'react';
import { PLANETS } from '../data/planets.js';
import { PlanetCard } from '../components/PlanetCard.jsx';
import { useAppStore } from '../store/useAppStore.js';

/** Step 3 — pick Planet A then Planet B. Tapping a card assigns it to
 * whichever slot is currently "active"; tapping a filled slot chip makes
 * that slot active again so it can be changed. Duplicate selection is
 * prevented by disabling whichever planet is already taken by the other
 * slot. */
export default function PlanetSelectScreen({ onNext }) {
  const { planetA, planetB, setPlanetA, setPlanetB } = useAppStore();
  const [activeSlot, setActiveSlot] = useState('A');

  function handlePick(key) {
    if (activeSlot === 'A') {
      setPlanetA(key);
      if (!planetB) setActiveSlot('B');
    } else {
      setPlanetB(key);
      if (!planetA) setActiveSlot('A');
    }
  }

  const canContinue = Boolean(planetA && planetB && planetA !== planetB);

  return (
    <div className="screen screen--select">
      <div className="screen__header">
        <span className="eyebrow">Step 1 of 2</span>
        <h1>Choose two planets</h1>
        <p>Their combined motion will reveal a hidden geometry.</p>
      </div>

      <div className="slot-row">
        <button
          type="button"
          className={`slot-chip${activeSlot === 'A' ? ' is-active' : ''}`}
          onClick={() => setActiveSlot('A')}
        >
          <span className="slot-chip__label">Planet A</span>
          <span className="slot-chip__value">{planetA ? PLANETS.find((p) => p.key === planetA).name : 'Select'}</span>
        </button>
        <button
          type="button"
          className={`slot-chip${activeSlot === 'B' ? ' is-active' : ''}`}
          onClick={() => setActiveSlot('B')}
        >
          <span className="slot-chip__label">Planet B</span>
          <span className="slot-chip__value">{planetB ? PLANETS.find((p) => p.key === planetB).name : 'Select'}</span>
        </button>
      </div>

      <div className="planet-grid">
        {PLANETS.map((planet) => {
          const isA = planetA === planet.key;
          const isB = planetB === planet.key;
          const takenByOther = (activeSlot === 'A' && isB) || (activeSlot === 'B' && isA);
          return (
            <PlanetCard
              key={planet.key}
              planet={planet}
              selected={isA || isB}
              disabled={takenByOther}
              slotLabel={isA ? 'A' : 'B'}
              onClick={() => handlePick(planet.key)}
            />
          );
        })}
      </div>

      <button type="button" className="btn btn--primary btn--full" disabled={!canContinue} onClick={onNext}>
        Continue
      </button>
    </div>
  );
}
