/** Screen 3 — "Choose an Experience". Sits between the landing screen and the
 * pattern flow. Two large tappable cards:
 *   - Explore          -> pick any two planets (existing flow)
 *   - Cosmic Signature -> generate a pattern from a birth date
 * A back arrow (to the landing screen) and a placeholder info button sit in
 * the top bar. */
import { ArrowLeft, Info, Orbit, Sparkles } from 'lucide-react';

export default function ModeSelectScreen({ onExplore, onCosmic, onBack }) {
  return (
    <div className="screen screen--mode">
      <div className="mode-topbar">
        <button type="button" className="back-button" onClick={onBack} aria-label="Back to the Solar System">
          <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
          Back
        </button>
        <button type="button" className="icon-button" aria-label="About Space Harmony">
          <Info size={22} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="screen__header screen__header--mode">
        <h1>Choose an Experience</h1>
      </div>

      <div className="mode-cards">
        <button type="button" className="mode-card" onClick={onExplore}>
          <span className="mode-card__icon" aria-hidden="true">
            <Orbit size={30} strokeWidth={1.6} />
          </span>
          <span className="mode-card__text">
            <span className="mode-card__title">Explore</span>
            <span className="mode-card__desc">Choose any two planets to create patterns</span>
          </span>
        </button>

        <button type="button" className="mode-card" onClick={onCosmic}>
          <span className="mode-card__icon" aria-hidden="true">
            <Sparkles size={30} strokeWidth={1.6} />
          </span>
          <span className="mode-card__text">
            <span className="mode-card__title">Cosmic Signature</span>
            <span className="mode-card__desc">Generate a unique pattern from your birth date</span>
          </span>
        </button>
      </div>
    </div>
  );
}
