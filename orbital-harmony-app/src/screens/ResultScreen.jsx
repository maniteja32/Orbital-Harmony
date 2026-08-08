import { Heart, Share2 } from 'lucide-react';
import { GlassButton } from '../components/ui/glasscn/glass-button.jsx';
import { TopNavigationBar } from '../components/TopNavigationBar.jsx';
import { LineStyleToggleButton } from '../components/LineStyleToggle.jsx';
import { PLANETS_BY_KEY } from '../data/planets.js';
import { formatCosmicSignatureDate } from '../utils/cosmicSignature.js';
import { useAppStore } from '../store/useAppStore.js';

/** Screen 6 — final pattern with selected planets.
 *  Save/Share live as top-bar icons; "View Details" opens the info/controls
 *  screen and "Generate New Pattern" restarts the flow. */
export default function ResultScreen({ onGenerateNew, onBack, onViewDetails, onShare, onSave }) {
  const { planetA, planetB, snapshot, resetForNewPattern, patternMode, cosmicDate, lineStyle, setLineStyle } = useAppStore();
  const isCosmic = patternMode === 'cosmic';
  const planetAData = PLANETS_BY_KEY[planetA];
  const planetBData = PLANETS_BY_KEY[planetB];
  const hasPair = Boolean(planetAData && planetBData);
  const title = hasPair ? `${planetAData.name} × ${planetBData.name}` : 'Cosmic Signature';
  const cosmicDateLabel = formatCosmicSignatureDate(cosmicDate);

  function handleGenerateNew() {
    resetForNewPattern();
    onGenerateNew();
  }

  return (
    <div className="screen screen--result">
      <TopNavigationBar title={isCosmic ? 'Cosmic Signature' : title} onBack={onBack} />

      {isCosmic && (
        <div className="screen__header screen__header--mode">
          <p className="result-date">{cosmicDateLabel || 'Date unavailable'}</p>
          <p className="result-description">Generated from the planetary arrangement on your birth date.</p>
        </div>
      )}

      <div className="result-frame">
        {snapshot ? <img src={snapshot} alt={title} /> : <div className="result-frame__placeholder" />}
      </div>

      {isCosmic ? (
        <div className="result-actions result-actions--cosmic">
          <div className="result-actions__compact-row" aria-label="Secondary actions">
            <div className="select-actions__button">
              <GlassButton
                tone="secondary"
                className="w-full h-11 text-base font-medium"
                onClick={onSave}
                aria-label="Save signature"
              >
                <Heart size={16} strokeWidth={2} aria-hidden="true" />
                Save
              </GlassButton>
            </div>
            <div className="select-actions__button">
              <GlassButton
                tone="secondary"
                className="w-full h-11 text-base font-medium"
                onClick={onShare}
                aria-label="Share signature"
              >
                <Share2 size={16} strokeWidth={2} aria-hidden="true" />
                Share
              </GlassButton>
            </div>
          </div>

          <div className="result-actions__primary-row">
            <GlassButton tone="primary" className="w-full h-11 text-base font-medium" onClick={handleGenerateNew}>
              Generate New Signature
            </GlassButton>
          </div>
        </div>
      ) : (
        <div className="result-actions">
          <div className="result-actions__primary-row">
            <GlassButton
              tone="primary"
              className="w-full h-11 text-base font-medium"
              onClick={onViewDetails}
            >
              View Details
            </GlassButton>
            <LineStyleToggleButton lineStyle={lineStyle} onChange={setLineStyle} />
            <button
              type="button"
              className="back-button back-button--icon"
              onClick={onShare}
              aria-label="Share this pattern"
            >
              <Share2 size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <button type="button" className="btn-frosted-pill" onClick={handleGenerateNew}>
            Generate New Pattern
          </button>
        </div>
      )}
    </div>
  );
}
