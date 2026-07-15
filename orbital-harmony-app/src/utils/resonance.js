// ============================================================================
// Orbital resonance ratio — finds the simplest small-integer ratio (a:b)
// between two orbital periods using a continued-fraction rational
// approximation, e.g. Earth:Venus ≈ 8:13. Returns null when no low-order
// ratio approximates the real period ratio closely enough (most planet
// pairs don't have a clean resonance, and that's fine — the pattern is
// still beautiful, it just won't repeat exactly).
// ============================================================================

/**
 * @param {number} periodA days
 * @param {number} periodB days
 * @param {{maxDenominator?: number, tolerance?: number}} [opts]
 * @returns {{longer: number, shorter: number, errorPct: number} | null}
 *   `longer` = orbit count of whichever planet has the LONGER period,
 *   `shorter` = orbit count of whichever planet has the SHORTER period,
 *   over the same span of time (e.g. longer=8, shorter=13 for Earth:Venus).
 */
export function findResonance(periodA, periodB, opts = {}) {
  const { maxDenominator = 20, tolerance = 0.02 } = opts;
  if (!periodA || !periodB || periodA === periodB) return null;

  const ratio = Math.max(periodA, periodB) / Math.min(periodA, periodB);

  // Continued-fraction convergents of `ratio`.
  let h0 = 1, h1 = 0, k0 = 0, k1 = 1;
  let b = ratio;
  let best = null;

  for (let i = 0; i < 24; i++) {
    const a = Math.floor(b);
    const h2 = a * h0 + h1;
    const k2 = a * k0 + k1;
    if (k2 > maxDenominator) break;
    h1 = h0; h0 = h2;
    k1 = k0; k0 = k2;
    const approx = h0 / k0;
    const errorPct = Math.abs(approx - ratio) / ratio;
    if (errorPct < tolerance) {
      best = { longer: k0, shorter: h0, errorPct };
      break;
    }
    const frac = b - a;
    if (frac < 1e-9) break;
    b = 1 / frac;
  }

  return best;
}

export function formatResonance(periodA, periodB) {
  const r = findResonance(periodA, periodB);
  if (!r) return null;
  return `${r.longer} : ${r.shorter}`;
}
