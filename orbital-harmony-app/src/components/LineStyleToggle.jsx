// Shared pattern line-style control (solid / dashed / dots), used by both
// the Simulation screen's live transport row and the Result screen's
// action row — a single source of truth so the icon/cycle logic and the
// user's chosen style stay consistent wherever this button appears.
export const LINE_STYLE_ORDER = ['solid', 'dashed', 'dots'];
export const LINE_STYLE_LABEL = { solid: 'Line', dashed: 'Dashed', dots: 'Dots' };

// A circular "orbit ring" swatch — draws the actual stroke sample AS the
// ring itself (solid ring / dashed ring / dotted ring) instead of a
// straight line in a box. Ties directly into the app's own orbit-ring
// visuals and reads clearly at a glance: a full circle, a ring of bold
// petal-like dashes, or a ring of varied-size dots (echoing a halftone
// dot-swirl reference) — a distinct SHAPE per style rather than three
// subtly different dasharray values on the same thin stroke.
// 12 dots so the 4-size alternation (12 / 4 = 3 exact cycles) repeats
// evenly all the way around with no seam — 14 didn't divide evenly by 4,
// leaving one mismatched dot where the pattern wrapped.
const DOTS_RING_COUNT = 12;
const DOTS_RING_RADIUS = 8;
// Alternating big/small radii around the ring — the varied dot size (not
// just evenly repeating dots) is what reads as a rich "dot swirl" rather
// than a plain perforated line.
const DOTS_RING_SIZES = [1.55, 0.85, 1.15, 0.7];

function DotsRing() {
  return Array.from({ length: DOTS_RING_COUNT }, (_, i) => {
    const angle = (i / DOTS_RING_COUNT) * Math.PI * 2 - Math.PI / 2;
    const cx = 12 + DOTS_RING_RADIUS * Math.cos(angle);
    const cy = 12 + DOTS_RING_RADIUS * Math.sin(angle);
    const r = DOTS_RING_SIZES[i % DOTS_RING_SIZES.length];
    return <circle key={i} cx={cx} cy={cy} r={r} fill="currentColor" />;
  });
}

// A raw dasharray like '5.5 3.5' rarely tiles evenly around a circle's
// circumference, leaving one visibly shorter/longer "seam" dash where the
// path closes — exactly what made the dashed ring look asymmetric. Instead
// derive dash+gap from the circumference divided into a WHOLE number of
// repeats, guaranteeing every dash is identical with no seam.
const DASHED_RING_RADIUS = 8;
const DASHED_RING_COUNT = 8;
const DASHED_RING_PERIOD = (2 * Math.PI * DASHED_RING_RADIUS) / DASHED_RING_COUNT;
const DASHED_RING_DASH = DASHED_RING_PERIOD * 0.62;
const DASHED_RING_GAP = DASHED_RING_PERIOD - DASHED_RING_DASH;

export function LineStyleIcon({ style }) {
  if (style === 'dots') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <DotsRing />
      </svg>
    );
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r={style === 'dashed' ? DASHED_RING_RADIUS : 8}
        stroke="currentColor"
        strokeWidth={style === 'dashed' ? 3.2 : 2.4}
        strokeLinecap={style === 'dashed' ? 'butt' : 'round'}
        strokeDasharray={style === 'dashed' ? `${DASHED_RING_DASH} ${DASHED_RING_GAP}` : undefined}
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
