// Shared pattern line-style control (solid / dashed / dots), used by both
// the Simulation screen's live transport row and the Result screen's
// action row — a single source of truth so the icon/cycle logic and the
// user's chosen style stay consistent wherever this button appears.
const LINE_STYLE_ORDER = ['solid', 'dashed', 'dots'];
const LINE_STYLE_LABEL = { solid: 'Line', dashed: 'Dashed', dots: 'Dots' };

// The original four-petal "flower" swatch (the app's own pattern figures
// read as flower-like rosettes) restored per feedback, now with the SAME
// evenly-divided dash math used elsewhere: dash/gap is derived from each
// shape's OWN measured length divided into a WHOLE number of repeats, so
// the pattern starts and ends symmetrically with no odd cut-off segment
// (the previous raw '4.5 3' / '0.1 3' dasharrays didn't evenly divide
// either shape's true length, which is what read as uneven/asymmetric).
const FLOWER_PATH_D = 'M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5';
// Measured via path.getTotalLength() in-browser (4 arcs of radius 4.5).
const FLOWER_PATH_LENGTH = 84.835;
const FLOWER_CIRCLE_RADIUS = 2.75;
const FLOWER_CIRCLE_CIRCUMFERENCE = 2 * Math.PI * FLOWER_CIRCLE_RADIUS;

// Counts are multiples of 4 to align with the flower's own 4-fold
// symmetry (one quarter-turn always looks identical to the next).
function evenDash(totalLength, count, dashRatio = 0.62) {
  const period = totalLength / count;
  const dash = dashRatio == null ? 0.1 : period * dashRatio;
  return `${dash} ${period - dash}`;
}
const LINE_STYLE_PATH_DASH = {
  solid: undefined,
  dashed: evenDash(FLOWER_PATH_LENGTH, 8),
  dots: evenDash(FLOWER_PATH_LENGTH, 16, null),
};
const LINE_STYLE_CIRCLE_DASH = {
  solid: undefined,
  dashed: evenDash(FLOWER_CIRCLE_CIRCUMFERENCE, 4),
  dots: evenDash(FLOWER_CIRCLE_CIRCUMFERENCE, 8, null),
};
const LINE_STYLE_CAP = { solid: 'round', dashed: 'butt', dots: 'round' };

function LineStyleIcon({ style }) {
  const cap = LINE_STYLE_CAP[style];
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={FLOWER_PATH_D}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap={cap}
        strokeLinejoin="round"
        strokeDasharray={LINE_STYLE_PATH_DASH[style]}
      />
      <circle
        cx="12"
        cy="12"
        r={FLOWER_CIRCLE_RADIUS}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap={cap}
        strokeDasharray={LINE_STYLE_CIRCLE_DASH[style]}
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
