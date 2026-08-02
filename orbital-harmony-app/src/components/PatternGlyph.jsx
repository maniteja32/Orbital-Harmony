import { useMemo } from 'react';

function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

/**
 * A deterministic hypotrochoid ("spirograph") rosette rendered as a single
 * SVG path — a lightweight stand-in for a real traced pattern thumbnail that
 * needs NO WebGL context (so a whole grid of them in the Collection screen
 * stays cheap and safe on mobile, unlike spinning up one Three.js canvas per
 * card). Different `seedA`/`seedB`/`d` combinations yield visibly different
 * rosettes, so each saved pattern reads as its own distinct figure.
 */
export function PatternGlyph({
  seedA = 5,
  seedB = 3,
  d = 5,
  size = 120,
  strokeWidth = 0.5,
  className,
}) {
  const path = useMemo(() => {
    const R = seedA;
    const r = seedB || 1;
    const turns = r / gcd(R, r); // full 2π turns needed for the curve to close
    const steps = Math.max(300, Math.round(turns * 220));
    const cx = size / 2;
    const cy = size / 2;
    const extent = Math.abs(R - r) + Math.abs(d);
    const scale = (size / 2 - strokeWidth * 3) / (extent || 1);
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2 * turns;
      const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
      const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
      pts.push(`${(cx + x * scale).toFixed(2)},${(cy + y * scale).toFixed(2)}`);
    }
    return `M${pts.join(' L')}`;
  }, [seedA, seedB, d, size, strokeWidth]);

  return (
    <svg
      className={`pattern-glyph ${className ?? ''}`}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default PatternGlyph;
