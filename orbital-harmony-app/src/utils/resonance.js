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
 * @param {{maxDenominator?: number, tolerance?: number, maxOrbitCount?: number, fallbackTolerance?: number}} [opts]
 * @returns {{longer: number, shorter: number, errorPct: number} | null}
 *   `longer` = orbit count of whichever planet has the LONGER period,
 *   `shorter` = orbit count of whichever planet has the SHORTER period,
 *   over the same span of time (e.g. longer=8, shorter=13 for Earth:Venus).
 */
export function findResonance(periodA, periodB, opts = {}) {
  const {
    maxDenominator = 20,
    tolerance = 0.02,
    // Caps how many orbits the FASTER planet completes — a proxy for how
    // many "petals" the resulting chord pattern ends up with. Some real
    // pairs (e.g. Mercury:Earth ≈ 25:6) DO have a clean sub-2%-error
    // resonance, but at a petal count so high the traced pattern reads as
    // a dense, muddy scribble rather than a calm, legible rosette —
    // exactly the "too crowded" complaint. When that happens, fall
    // through to the semiconvergent search below instead of using the
    // overly-complex convergent outright.
    maxOrbitCount = 16,
    // Semiconvergents (see below) are inherently less precise than a full
    // convergent, so they get a looser acceptance threshold — still tight
    // enough to read as a genuine "these orbits nearly line up" moment,
    // not so loose it claims a resonance for two unrelated periods.
    fallbackTolerance = 0.06,
  } = opts;
  if (!periodA || !periodB || periodA === periodB) return null;

  const ratio = Math.max(periodA, periodB) / Math.min(periodA, periodB);

  // Continued-fraction convergents of `ratio`.
  let h0 = 1, h1 = 0, k0 = 0, k1 = 1;
  let b = ratio;

  for (let i = 0; i < 24; i++) {
    const a = Math.floor(b);
    const h2 = a * h0 + h1;
    const k2 = a * k0 + k1;
    if (k2 > maxDenominator) break;
    const approx = h2 / k2;
    const errorPct = Math.abs(approx - ratio) / ratio;

    if (errorPct < tolerance) {
      if (h2 <= maxOrbitCount) return { longer: k2, shorter: h2, errorPct };

      // The true best-fit convergent is too petal-dense to look calm —
      // search its SEMICONVERGENTS instead: intermediate ratios
      // `(j*h0 + h1) / (j*k0 + k1)` for j = 1..a-1, each still a genuine
      // (if slightly less exact) approximation of the same ratio, but
      // with a smaller numerator/denominator than the full convergent —
      // e.g. Mercury:Earth's true 25:6 convergent has a 13:3
      // semiconvergent along the way, same "family" of resonance at
      // roughly half the petal count.
      let bestSemi = null;
      for (let j = 1; j <= a; j++) {
        const h = j * h0 + h1;
        const k = j * k0 + k1;
        if (h > maxOrbitCount || k > maxDenominator) break;
        const semiErrorPct = Math.abs(h / k - ratio) / ratio;
        if (!bestSemi || semiErrorPct < bestSemi.errorPct) {
          bestSemi = { longer: k, shorter: h, errorPct: semiErrorPct };
        }
      }
      return bestSemi && bestSemi.errorPct < fallbackTolerance ? bestSemi : null;
    }

    h1 = h0; h0 = h2;
    k1 = k0; k0 = k2;
    const frac = b - a;
    if (frac < 1e-9) break;
    b = 1 / frac;
  }

  return null;
}

export function formatResonance(periodA, periodB) {
  const r = findResonance(periodA, periodB);
  if (!r) return null;
  return `${r.longer} : ${r.shorter}`;
}

// ============================================================================
// Pattern timeframe — turns a pair's REAL orbital periods into the "optimal"
// simulation span (in Earth years) that closes their characteristic chord
// pattern, plus the expected petal/lobe count. This is the physics behind
// the "Summary of Optimal Timeframes" table: e.g. Earth+Venus's 8:13
// resonance closes in 8 Earth years and traces a clean 5-petaled rose
// (13 − 8 = 5 relative conjunctions), while wide pairs (e.g. Saturn+Uranus)
// need many more years and trace a far denser mandala.
//
// Run the sim for exactly `longer` orbits of the LONGER-period (outer)
// planet — that's the full closed cycle. `petals` = |shorter − longer|,
// the number of relative conjunctions and therefore lobes the rosette
// forms. When no clean low-order resonance exists, fall back to ~6 relative
// laps over the pair's synodic period so the shape still reads as a full,
// balanced rosette rather than an arbitrary wedge.
//
// CURATED OVERRIDES: the six pairs called out in the "Summary of Optimal
// Timeframes" reference use the exact hand-picked spans/ratios from that
// table (some are intentionally looser or higher-order than the first
// continued-fraction convergent — e.g. Saturn+Uranus's 57:20 mandala — so
// they can't all be derived generically). Keyed by the two planet `key`s,
// order-independent. Every other pair falls through to the generic
// resonance math below.
const OPTIMAL_TIMEFRAMES = {
  'earth|venus': { years: 8, petals: 5 }, //  8:13 → clean 5-petaled rose
  'mercury|venus': { years: 2, petals: 5 }, //  3:8 → ornate 5-sided crown
  'earth|mars': { years: 15, petals: 7 }, // 15:8 → dense asymmetrical shield
  'jupiter|mars': { years: 12, petals: 7 }, //  6:1 → crisp 7-lobed rosette
  'jupiter|saturn': { years: 60, petals: 3 }, //  5:2 → triangular crown
  'saturn|uranus': { years: 1680, petals: 37 }, // 57:20 → ultra-dense mandala
};

/**
 * @param {number} periodA days
 * @param {number} periodB days
 * @param {string} [keyA] planet key (for curated-timeframe lookup)
 * @param {string} [keyB] planet key
 * @returns {{years: number, petals: number, resonance: object | null}}
 */
export function patternTimeframe(periodA, periodB, keyA, keyB) {
  if (keyA && keyB) {
    const curated = OPTIMAL_TIMEFRAMES[[keyA, keyB].sort().join('|')];
    if (curated) return { ...curated, resonance: null };
  }

  const outerPeriod = Math.max(periodA, periodB);
  // Tight tolerance so the search reaches the TRUE best convergent
  // (e.g. Earth+Venus's 13:8, not the looser 5:3 that stops it early),
  // with wide orbit-count caps so genuinely dense pairs are still allowed.
  const resonance = findResonance(periodA, periodB, {
    maxDenominator: 40,
    maxOrbitCount: 60,
    tolerance: 0.008,
    fallbackTolerance: 0.05,
  });

  if (resonance) {
    const years = (resonance.longer * outerPeriod) / 365.25;
    const petals = Math.max(Math.abs(resonance.shorter - resonance.longer), 1);
    return { years, petals, resonance };
  }

  // No clean resonance — aim for ~6 relative conjunctions over the synodic
  // period (clamped so near-equal or very wide pairs stay renderable).
  const synodicDays = 1 / Math.abs(1 / periodA - 1 / periodB);
  const years = Math.min(Math.max((synodicDays * 6) / 365.25, 4), 60);
  return { years, petals: 6, resonance: null };
}

