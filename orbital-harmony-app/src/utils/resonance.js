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

// ============================================================================
// Adaptive pattern plan — the core of the resonance-driven pattern generator.
//
// Given a pair's REAL sidereal periods, it derives EVERYTHING the tracer
// needs, with NO fixed simulation duration anywhere:
//   1. Detect the resonance cycle: the smallest whole-orbit window
//      (innerRevs : outerRevs) whose rev-ratio matches the real period
//      ratio — i.e. when both planets return (near-)simultaneously to their
//      start and the chord figure closes on itself.
//   2. Duration = exactly that window, per pair (Earth+Venus closes in 8
//      years / 13:8; Jupiter+Saturn in ~59 years / 5:2; wide pairs run as
//      many years as their own window needs — never an arbitrary 20/100/500).
//   3. Density = enough chords to reveal the full geometry as a smooth
//      envelope, but CLAMPED so a high-order pair never overdraws into a
//      solid white mesh.
//
// "Visual convergence over perfect closure": the OUTER (slower) planet's
// whole loops are the master closure clock, so the slow planet always sweeps
// a full 360° and the figure is ALWAYS radially symmetric — never a
// one-sided wedge. The window search prefers the LOWEST-ORDER cycle that
// closes within `CLOSE_TOLERANCE` and caps how many loops either planet may
// complete — so an extreme-ratio pair (e.g. Mercury:Neptune, which never
// truly closes at a readable density) still settles on its best bounded
// window: a complete, symmetric sunburst (outer completes one orbit while
// the inner loops many times), sampled/clamped to stay legible rather than
// an unreadable mesh, a moiré blur, or an endless run.
// ============================================================================

const DAYS_PER_YEAR = 365.25;

// SINGLE SOURCE OF TRUTH for the traced pattern's line thickness (in
// screen-space pixels), shared by BOTH the live engine
// (solarSystemEngine.js LineMaterial.linewidth) and the static Pattern
// Gallery (pattern-gallery.html canvas lineWidth), so every pair renders
// at the EXACT same stroke weight and the two surfaces never drift apart.
// Kept intentionally fine so dense resonances stay airy instead of reading
// like a filled white mesh on mobile.
export const PATTERN_LINE_WIDTH = 0.5;

const PLAN = {
  // Caps on each planet's whole-loop count within one window. The inner cap
  // bounds how intricate the resonance search may get; the outer cap keeps
  // the closure span from ballooning while chasing an ever-more-exact
  // high-order resonance.
  maxInnerRevs: 40,
  maxOuterRevs: 30,
  // A window "closes" when its rev-ratio is within this relative error of
  // the true period ratio. Tight enough to reject a loose near-miss (e.g.
  // Earth+Venus's 8:5 at ~1.6%, so the iconic 13:8 pentagram is chosen
  // instead), loose enough that genuine low-order resonances still qualify.
  closeTolerance: 0.015,
  // --- Density (chords over the whole window). Balances two competing
  // needs, chosen so EVERY pair reveals a complete figure without overdraw:
  //  * a smooth chord ENVELOPE for low-order roses (chordsPerPetal each),
  //    CAPPED (smoothCap) so a many-petal figure stays a discrete star
  //    instead of filling its centre into a solid white mesh;
  //  * an ANTI-ALIAS floor (chordsPerInnerLoop per inner-planet loop) so an
  //    extreme-ratio sunburst (e.g. Mercury:Neptune, ~684 inner loops) is
  //    sampled finely enough to render as clean rays rather than a stacking
  //    streak, without ballooning the total.
  // chordsPerInnerLoop/maxChords raised (1.3->4, 820->3000): at the old
  // values the most extreme pairs (267-684 loops) got barely ~1 chord per
  // petal — mathematically correct but visually a sparse, spoke-like
  // scribble rather than a dense sunburst. ~3 chords/petal reads as a
  // proper radiant flower; still comfortably under the 40000-chord GPU
  // buffer cap in solarSystemEngine.js.
  chordsPerPetal: 80,
  smoothCap: 420,
  chordsPerInnerLoop: 4,
  minChords: 300,
  maxChords: 3000,
  // --- PATTERN BEAUTY OPTIMIZATION layer -----------------------------------
  // Separates simulation accuracy (the full resonance closure above, always
  // computed) from RENDERING density: the most beautiful figure is not the
  // one with the most line segments. A figure's local density / loss of
  // negative space / solid-centre risk all scale with how many times the
  // inner planet loops within one closure (`innerLoops` = how much of the
  // relative-angle circle is sampled → how many chords cross the centre).
  // A single `crowding` measure (0 = airy rose, 1 = would be a solid mesh)
  // is derived from it and used to BACK OFF two levers together the moment
  // extra lines would stop revealing new structure and start filling
  // negative space:
  //   * fewer visible lines  (down to 1 - crowdDensityCut of the base), and
  //   * lower line opacity    (down to minOpacity), so the many overlapping
  //     chords ACCUMULATE into a legible density gradient instead of a flat
  //     white blob — revealing the geometry rather than the line count.
  // Airy pairs (innerLoops <= crowdOnset, e.g. Venus+Earth's pentagram, the
  // Jupiter+Saturn trefoil) are left completely untouched: full density,
  // full opacity, crisp. Only crowded sunbursts (Mercury × the giants) are
  // thinned. Calibrated against all 28 pairs so petals, resonance
  // structure, negative space and rotational symmetry are all preserved.
  crowdOnset: 45,        // innerLoops at which beauty relief begins
  crowdSpan: 170,        // innerLoops over which relief ramps to full
  // Re-tuned after auditing all 28 pairs in the Pattern Gallery: the
  // extreme, never-quite-closing pairs (Mercury/Venus/Earth × Uranus/
  // Neptune, innerLoops in the hundreds) were fading to a near-invisible
  // 12%-opacity whisper — the opposite of "beautiful", just empty black.
  // A gentler cut (fewer lines shed) + a much higher opacity floor keeps
  // even the densest sunburst reading as a bold, legible mandala instead
  // of vanishing.
  crowdDensityCut: 0.3,  // up to 30% fewer visible lines at full crowding
  minOpacity: 0.42,      // faintest the densest sunbursts fade to (lower = airier)
};

/**
 * Find the whole-orbit window (innerRevs : outerRevs) that best represents
 * the pair's resonance within readable-density caps. `innerRevs/outerRevs`
 * approximates `outerPeriod/innerPeriod`, so innerRevs*innerPeriod ≈
 * outerRevs*outerPeriod = the closure span. Prefers the LOWEST-order window
 * that closes within `CLOSE_TOLERANCE`; for pairs that can't close within
 * the caps, returns the closest bounded approximation (a complete-looking,
 * gently-precessing rose).
 * @returns {{innerRevs: number, outerRevs: number, err: number}}
 */
function bestResonanceWindow(innerPeriod, outerPeriod) {
  const R = outerPeriod / innerPeriod; // >= 1 (inner = shorter period)
  let h0 = 1, h1 = 0, k0 = 0, k1 = 1; // continued-fraction convergent state
  let b = R;
  let best = null;

  const consider = (innerRevs, outerRevs) => {
    if (outerRevs < 1 || innerRevs <= outerRevs) return;
    if (innerRevs > PLAN.maxInnerRevs || outerRevs > PLAN.maxOuterRevs) return;
    const err = Math.abs(innerRevs / outerRevs - R) / R;
    if (!best) {
      best = { innerRevs, outerRevs, err };
      return;
    }
    const bestClosed = best.err <= PLAN.closeTolerance;
    const curClosed = err <= PLAN.closeTolerance;
    if (curClosed !== bestClosed) {
      // A window that actually closes always beats one that doesn't.
      if (curClosed) best = { innerRevs, outerRevs, err };
    } else if (curClosed) {
      // Both close: prefer the calmer, lower-order figure (fewer inner
      // loops), breaking exact ties toward the more precise window.
      if (innerRevs < best.innerRevs || (innerRevs === best.innerRevs && err < best.err)) {
        best = { innerRevs, outerRevs, err };
      }
    } else if (err < best.err) {
      // Neither closes (extreme-ratio pair): keep the CLOSEST bounded
      // approximation — the most complete, symmetric figure the caps allow.
      best = { innerRevs, outerRevs, err };
    }
  };

  for (let i = 0; i < 32; i++) {
    const a = Math.floor(b);
    // Convergents AND their semiconvergents (j = 1..a) — the latter fill in
    // the lower-order windows between full convergents, letting the calmest
    // qualifying cycle be found.
    for (let j = 1; j <= a; j++) consider(j * h0 + h1, j * k0 + k1);
    const h2 = a * h0 + h1;
    const k2 = a * k0 + k1;
    h1 = h0; h0 = h2; k1 = k0; k0 = k2;
    if (h0 > PLAN.maxInnerRevs * 4 && k0 > PLAN.maxOuterRevs * 4) break;
    const frac = b - a;
    if (frac < 1e-9) break; // exact rational ratio — done
    b = 1 / frac;
  }

  // Safety net (e.g. a ratio so close to 1 the loop found nothing in caps):
  // the densest allowed radially-symmetric rose.
  if (!best) {
    best = {
      innerRevs: PLAN.maxInnerRevs,
      outerRevs: Math.max(1, Math.round(PLAN.maxInnerRevs / R)),
      err: 1,
    };
  }
  return best;
}

/**
 * Derive the complete tracer plan for a planet pair from their REAL orbital
 * periods — the single source of truth that replaces every fixed
 * simulation-duration constant.
 * @param {number} periodA days (real sidereal period)
 * @param {number} periodB days
 * @param {number} [dirA] orbitDirection of planet A (+1 prograde, -1 retrograde)
 * @param {number} [dirB] orbitDirection of planet B
 * @returns {{
 *   totalSimYears: number,   // per-pair simulation span (one resonance window)
 *   traceIntervalDays: number, // sim-days between sampled chords
 *   chordCount: number,      // total chords over the window (bounded density)
 *   lineOpacity: number,     // 1 for calm figures, fading toward minOpacity
 *                            //   for overcrowded high-loop ones (see PLAN)
 *   petals: number,          // relative conjunctions = lobes in the figure
 *   innerRevs: number,
 *   outerRevs: number,
 *   closed: boolean,         // true when the window closes within tolerance
 * }}
 */
export function computePatternPlan(periodA, periodB, dirA = 1, dirB = 1) {
  if (!periodA || !periodB || periodA === periodB) {
    // Degenerate/identical orbits: nothing to resonate — fall back to a
    // calm default so the caller never receives NaN/Infinity.
    return {
      totalSimYears: 8,
      traceIntervalDays: 3,
      chordCount: 600,
      lineOpacity: 1,
      petals: 1,
      innerRevs: 1,
      outerRevs: 1,
      closed: false,
    };
  }

  const innerPeriod = Math.min(periodA, periodB);
  const outerPeriod = Math.max(periodA, periodB);
  // Direction of whichever planet actually has the shorter/longer period —
  // periodA/periodB may have been swapped above, so their dir flags must
  // follow the same swap.
  const dirInner = periodA <= periodB ? dirA : dirB;
  const dirOuter = periodA <= periodB ? dirB : dirA;
  const { innerRevs, outerRevs, err } = bestResonanceWindow(innerPeriod, outerPeriod);

  // Close on whole OUTER-planet loops: the SLOWER planet sweeps a full 360°
  // (× outerRevs), so the traced figure is always radially symmetric —
  // never a one-sided wedge, even for an extreme-ratio pair whose window
  // never exactly closes (there the inner planet simply loops many times
  // while the outer completes its whole orbit → a symmetric sunburst).
  const closureDays = outerRevs * outerPeriod;
  const innerLoops = closureDays / innerPeriod;

  // CLEAN CLOSURE / SYMMETRY: with the REAL periods the inner planet ends a
  // FRACTION of a loop short of a whole number over the closure, leaving a
  // visible gap / lopsidedness (the figure doesn't quite shut and its p-fold
  // symmetry is broken). Snap BOTH planets to a WHOLE number of loops over
  // the closure — an imperceptible (<~1%) rate nudge — so the traced figure
  // closes EXACTLY and is perfectly rotationally symmetric. These idealized
  // per-planet rates (revs per Earth-year) drive both the planet markers and
  // the traced chords in the engine, keeping them locked together.
  const targetInnerLoops = Math.max(1, Math.round(innerLoops));
  const targetOuterLoops = Math.max(1, Math.round(closureDays / outerPeriod));
  const innerRatePerYear = (targetInnerLoops * DAYS_PER_YEAR) / closureDays;
  const outerRatePerYear = (targetOuterLoops * DAYS_PER_YEAR) / closureDays;

  // TRUE rotational symmetry order of the traced chord figure. A chord
  // connects a point sweeping at dirInner*targetInnerLoops whole turns to
  // one sweeping at dirOuter*targetOuterLoops turns over the same closure;
  // the figure repeats every 1/|dirInner*targetInnerLoops -
  // dirOuter*targetOuterLoops| of the cycle. When both planets sweep the
  // SAME direction this is the familiar DIFFERENCE of loop counts, but for
  // a retrograde/prograde pair (e.g. Venus or Uranus paired with anything
  // prograde) the two sweeps work AGAINST each other and the true order is
  // their SUM — using the unsigned difference here (as if every planet
  // sweeps prograde) undercounts the lobes and starves the chord density
  // below, which reads as an uneven, lopsided figure even though the raw
  // angle math itself is already correctly signed.
  const petals = Math.max(1, Math.round(Math.abs(dirInner * targetInnerLoops - dirOuter * targetOuterLoops)));

  // Base (smoothness-optimal) density: smooth envelope for few-petal roses
  // (capped so many petals stay discrete) OR an anti-alias floor for
  // high-loop sunbursts, whichever is greater, clamped to a readable band.
  const smooth = Math.min(petals * PLAN.chordsPerPetal, PLAN.smoothCap);
  const antiAlias = innerLoops * PLAN.chordsPerInnerLoop;
  const baseChords = Math.min(Math.max(smooth, antiAlias, PLAN.minChords), PLAN.maxChords);

  // Beauty optimization (see PLAN): measure crowding from the resonance
  // structure, then shed lines + opacity together so a crowded figure
  // reveals its geometry as a gradient rather than a solid white mass.
  // Airy pairs get crowding = 0 → untouched.
  const crowding = Math.max(0, Math.min(1, (innerLoops - PLAN.crowdOnset) / PLAN.crowdSpan));
  const chordCount = Math.max(1, Math.round(baseChords * (1 - crowding * PLAN.crowdDensityCut)));
  const lineOpacity = 1 - crowding * (1 - PLAN.minOpacity);

  return {
    totalSimYears: closureDays / DAYS_PER_YEAR,
    traceIntervalDays: closureDays / chordCount,
    chordCount,
    lineOpacity,
    innerRatePerYear,
    outerRatePerYear,
    petals,
    innerRevs,
    outerRevs,
    closed: err <= PLAN.closeTolerance,
  };
}

