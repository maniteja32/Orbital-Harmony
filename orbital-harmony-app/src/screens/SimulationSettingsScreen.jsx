import { useAppStore, SPEED_PRESETS, DENSITY_PRESETS } from '../store/useAppStore.js';

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="segmented">
      {options.map(([key, opt]) => (
        <button
          key={key}
          type="button"
          className={`segmented__option${value === key ? ' is-active' : ''}`}
          onClick={() => onChange(key)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Step 4 — Simulation Speed + Trace Density, both premium pill segmented
 * controls. These map directly onto the pattern engine's reveal duration
 * and chord sample resolution. */
export default function SimulationSettingsScreen({ onNext }) {
  const { speed, density, setSpeed, setDensity } = useAppStore();

  return (
    <div className="screen screen--settings">
      <div className="screen__header">
        <span className="eyebrow">Step 2 of 2</span>
        <h1>Simulation settings</h1>
        <p>Tune how the pattern unfolds.</p>
      </div>

      <div className="settings-card">
        <span className="settings-card__label">Simulation Speed</span>
        <SegmentedControl options={Object.entries(SPEED_PRESETS)} value={speed} onChange={setSpeed} />
      </div>

      <div className="settings-card">
        <span className="settings-card__label">Trace Density</span>
        <SegmentedControl options={Object.entries(DENSITY_PRESETS)} value={density} onChange={setDensity} />
      </div>

      <button type="button" className="btn btn--primary btn--full" onClick={onNext}>
        Generate Pattern
      </button>
    </div>
  );
}
