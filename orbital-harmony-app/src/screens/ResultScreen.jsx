import { PlanetChip } from '../components/PlanetCard.jsx';
import { PLANETS_BY_KEY } from '../data/planets.js';
import { findResonance } from '../utils/resonance.js';
import { useAppStore } from '../store/useAppStore.js';

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function shareSnapshot(dataUrl, title) {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], 'orbital-harmony.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title, text: title });
      return;
    }
  } catch {
    // fall through to download
  }
  downloadDataUrl(dataUrl, 'orbital-harmony.png');
}

/** Step 6/7 — final pattern, selected planets, resonance ratio, and export
 * actions (Download PNG / Share / Generate New Pattern). */
export default function ResultScreen({ onGenerateNew }) {
  const { planetA, planetB, snapshot, resetForNewPattern } = useAppStore();
  const planetAData = PLANETS_BY_KEY[planetA];
  const planetBData = PLANETS_BY_KEY[planetB];
  const resonance = findResonance(planetAData.orbitalPeriodDays, planetBData.orbitalPeriodDays);
  const title = `${planetAData.name} × ${planetBData.name} — Orbital Harmony`;

  function handleGenerateNew() {
    resetForNewPattern();
    onGenerateNew();
  }

  return (
    <div className="screen screen--result">
      <div className="screen__header">
        <span className="eyebrow">Your pattern</span>
        <h1>{title}</h1>
      </div>

      <div className="result-frame">
        {snapshot ? <img src={snapshot} alt={title} /> : <div className="result-frame__placeholder" />}
      </div>

      <div className="result-meta">
        <div className="reveal-chips">
          <PlanetChip planet={planetAData} />
          <span className="reveal-chips__and">&amp;</span>
          <PlanetChip planet={planetBData} />
        </div>
        {resonance ? (
          <span className="resonance-badge">
            {resonance.longer} : {resonance.shorter} orbital resonance
          </span>
        ) : (
          <span className="resonance-badge resonance-badge--muted">No simple resonance</span>
        )}
      </div>

      <div className="result-actions">
        <button type="button" className="btn btn--full" onClick={() => downloadDataUrl(snapshot, 'orbital-harmony.png')}>
          Download PNG
        </button>
        <button type="button" className="btn btn--full" onClick={() => shareSnapshot(snapshot, title)}>
          Share
        </button>
        <button type="button" className="btn btn--primary btn--full" onClick={handleGenerateNew}>
          Generate New Pattern
        </button>
      </div>
    </div>
  );
}
