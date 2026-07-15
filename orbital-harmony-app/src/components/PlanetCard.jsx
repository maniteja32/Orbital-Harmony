export function PlanetCard({ planet, selected, disabled, slotLabel, onClick }) {
  return (
    <button
      type="button"
      className={`planet-card${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}
      style={{ '--planet-color': planet.color }}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="planet-card__swatch" />
      <span className="planet-card__name">{planet.name}</span>
      <span className="planet-card__fact">{planet.fact}</span>
      {selected && <span className="planet-card__badge">{slotLabel}</span>}
    </button>
  );
}

export function PlanetChip({ planet }) {
  return (
    <span className="planet-chip" style={{ '--planet-color': planet.color }}>
      <span className="planet-chip__dot" />
      {planet.name}
    </span>
  );
}
