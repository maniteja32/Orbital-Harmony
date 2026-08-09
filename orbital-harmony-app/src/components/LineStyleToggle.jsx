// Shared pattern line-style control (solid / dashed / dots), used by both
// the Simulation screen's live transport row and the Result screen's
// action row — a single source of truth so the icon/cycle logic and the
// user's chosen style stay consistent wherever this button appears.
export const LINE_STYLE_ORDER = ['solid', 'dashed', 'dots'];
export const LINE_STYLE_LABEL = { solid: 'Line', dashed: 'Dashed', dots: 'Dots' };

// A plain horizontal stroke-preview (the same convention used by any
// vector app's line-style picker) — instantly reads as "line style" and
// makes the three options unambiguous at a glance, unlike the previous
// abstract flower shape. Butt (square) caps on the dash so short segments
// read as clean rectangular dashes instead of rounding into dot-like
// pills, which is what made "dashed" and "dots" look nearly identical.
const LINE_STYLE_DASH = { solid: undefined, dashed: '4 3', dots: '0.1 4' };
const LINE_STYLE_CAP = { solid: 'round', dashed: 'butt', dots: 'round' };

export function LineStyleIcon({ style }) {
  const dash = LINE_STYLE_DASH[style];
  const cap = LINE_STYLE_CAP[style];
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 12h18"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap={cap}
        strokeDasharray={dash}
      />
    </svg>
  );
}

/** Cycles solid -> dashed -> dots -> solid on each tap. `onChange` receives
 * the new style; callers that also drive a live canvas (Simulation screen)
 * pass an `onChange` that both persists the choice and calls the canvas's
 * imperative `setLineStyle`. */
export function LineStyleToggleButton({ lineStyle, onChange, className = '' }) {
  function handleClick() {
    const next = LINE_STYLE_ORDER[(LINE_STYLE_ORDER.indexOf(lineStyle) + 1) % LINE_STYLE_ORDER.length];
    onChange(next);
  }

  return (
    <button
      type="button"
      className={`back-button back-button--icon${lineStyle !== 'solid' ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      onClick={handleClick}
      aria-label={LINE_STYLE_LABEL[lineStyle]}
    >
      <LineStyleIcon style={lineStyle} />
    </button>
  );
}
