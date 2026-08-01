/** Screen 3 — "Choose an Experience". Sits between the landing screen and the
 * pattern flow. Two large tappable cards:
 *   - Explore          -> pick any two planets (existing flow)
 *   - Cosmic Signature -> generate a pattern from a birth date
 * A back arrow (to the landing screen) and a placeholder info button sit in
 * the top bar. */
export default function ModeSelectScreen({ onExplore, onCosmic, onBack }) {
  return (
    <div className="screen screen--mode">
      <div className="mode-topbar">
        <button type="button" className="back-button" onClick={onBack} aria-label="Back to the Solar System">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <button type="button" className="icon-button" aria-label="About Orbital Harmony">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="7.6" r="1.1" fill="currentColor" />
          </svg>
        </button>
      </div>

      <div className="screen__header screen__header--mode">
        <h1>Choose an Experience</h1>
      </div>

      <div className="mode-cards">
        <button type="button" className="mode-card" onClick={onExplore}>
          <span className="mode-card__icon" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="5.1" />
              <ellipse cx="12" cy="12" rx="10" ry="3.4" transform="rotate(-22 12 12)" />
            </svg>
          </span>
          <span className="mode-card__text">
            <span className="mode-card__title">Explore</span>
            <span className="mode-card__desc">Choose any two planets to create patterns</span>
          </span>
        </button>

        <button type="button" className="mode-card" onClick={onCosmic}>
          <span className="mode-card__icon" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
              <path d="M12 3c.5 4.6 2.8 6.9 7.4 7.4-4.6.5-6.9 2.8-7.4 7.4-.5-4.6-2.8-6.9-7.4-7.4C9.2 9.9 11.5 7.6 12 3Z" />
              <circle cx="18.4" cy="5.6" r="0.9" fill="currentColor" stroke="none" />
              <circle cx="5.4" cy="18.4" r="0.7" fill="currentColor" stroke="none" />
            </svg>
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
