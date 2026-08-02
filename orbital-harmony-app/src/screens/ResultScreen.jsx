import { ArrowLeft, Heart, Share2 } from 'lucide-react';
import { PlanetChip } from '../components/PlanetCard.jsx';
import { GlassButton } from '../components/ui/glasscn/glass-button.jsx';
import { PLANETS_BY_KEY } from '../data/planets.js';
import { findResonance } from '../utils/resonance.js';
import { useAppStore } from '../store/useAppStore.js';

/** Screen 6 — final pattern with its selected planets and resonance ratio.
 *  Save/Share live as top-bar icons; "View Details" opens the info/controls
 *  screen and "Generate New Pattern" restarts the flow. */
export default function ResultScreen({ onGenerateNew, onBack, onViewDetails, onShare, onSave }) {
  const { planetA, planetB, snapshot, resetForNewPattern } = useAppStore();
  const planetAData = PLANETS_BY_KEY[planetA];
  const planetBData = PLANETS_BY_KEY[planetB];
  const hasPair = Boolean(planetAData && planetBData);
  const resonance = hasPair
    ? findResonance(planetAData.orbitalPeriodDays, planetBData.orbitalPeriodDays)
    : null;
  const title = hasPair ? `${planetAData.name} × ${planetBData.name}` : 'Cosmic Signature';

  function handleGenerateNew() {
    resetForNewPattern();
    onGenerateNew();
  }

  return (
    <div className="screen screen--result">
      <div className="mode-topbar">
        {onBack ? (
          <button
            type="button"
            className="back-button back-button--icon"
            onClick={onBack}
            aria-label="Back"
          >
            <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          <span />
        )}
        <div className="result-topbar__actions">
          <button
            type="button"
            className="back-button back-button--icon"
            onClick={onSave}
            aria-label="Save to collection"
          >
            <Heart size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="back-button back-button--icon"
            onClick={onShare}
            aria-label="Share this pattern"
          >
            <Share2 size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="screen__header screen__header--mode">
        <span className="eyebrow">Your pattern</span>
        <h1>{title}</h1>
      </div>

      <div className="result-frame">
        {snapshot ? <img src={snapshot} alt={title} /> : <div className="result-frame__placeholder" />}
      </div>

      <div className="result-meta">
        {hasPair && (
          <div className="reveal-chips">
            <PlanetChip planet={planetAData} />
            <span className="reveal-chips__and">&amp;</span>
            <PlanetChip planet={planetBData} />
          </div>
        )}
        {resonance ? (
          <span className="resonance-badge">
            {resonance.longer} : {resonance.shorter} orbital resonance
          </span>
        ) : (
          <span className="resonance-badge resonance-badge--muted">
            {hasPair ? 'No simple resonance' : 'Unique signature'}
          </span>
        )}
      </div>

      <div className="result-actions">
        <GlassButton
          tone="primary"
          className="w-full h-12 text-base font-semibold"
          onClick={onViewDetails}
        >
          View Details
        </GlassButton>
        <GlassButton tone="secondary" className="w-full h-12" onClick={handleGenerateNew}>
          Generate New Pattern
        </GlassButton>
      </div>
    </div>
  );
}
