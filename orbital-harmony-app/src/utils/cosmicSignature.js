// ============================================================================
// Cosmic Signature — deterministically maps a birth date to a pair of planets
// whose orbital motion traces that person's "signature" pattern. Same date
// always yields the same pair (so a signature is reproducible/shareable),
// while the engine additionally anchors each planet's STARTING phase to its
// real position on that exact date (see utils/currentPosition.js +
// solarSystemEngine's `patternStartDate`), so the rosette's orientation is
// personal too — not just one of a handful of shapes.
// ============================================================================

import { PLANETS } from '../data/planets.js';

/**
 * @param {Date} date a birth date
 * @returns {{ planetA: object, planetB: object }} two DISTINCT planet records
 */
export function cosmicSignatureFromDate(date) {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-11
  const d = date.getDate(); // 1-31
  const n = PLANETS.length; // 8

  // Mix year/month/day so nearby dates don't collapse onto the same pair.
  const aIdx = mod(m * 13 + d * 7, n);
  let bIdx = mod((y % 100) * 3 + d * 5 + m, n);
  // Guarantee the two planets are always different.
  if (bIdx === aIdx) bIdx = mod(aIdx + 1 + (d % (n - 1)), n);
  if (bIdx === aIdx) bIdx = mod(aIdx + 3, n);

  return { planetA: PLANETS[aIdx], planetB: PLANETS[bIdx] };
}

function mod(a, n) {
  return ((a % n) + n) % n;
}
