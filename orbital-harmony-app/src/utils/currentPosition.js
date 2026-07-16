// ============================================================================
// Real-time planetary position — computes each planet's approximate REAL
// current orbital angle from its J2000.0 mean longitude (data/planets.js)
// plus its real sidereal orbital period, instead of starting every planet
// at a random angle. This is a mean/circular-orbit approximation (ignores
// eccentricity and perturbations) — plenty accurate for this
// visualization's purpose (planets read as being roughly where they
// actually are today, relative to each other), not intended for precision
// ephemeris use.
// ============================================================================

const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0); // 2000-01-01 12:00 UTC

/**
 * @param {{ orbitalPeriodDays: number, meanLongitudeDeg?: number }} data
 * @param {Date} [now] defaults to the real current time
 * @returns {number} current orbital angle in RADIANS, for direct use as
 *   `pivot.rotation.y`
 */
export function currentOrbitAngleRad(data, now = new Date()) {
  // Falls back to a random angle for any planet missing real orbital
  // elements, rather than throwing — keeps this usable even if new planet
  // data is ever added without `meanLongitudeDeg` filled in yet.
  if (data.meanLongitudeDeg == null || !data.orbitalPeriodDays) {
    return Math.random() * Math.PI * 2;
  }
  const daysSinceEpoch = (now.getTime() - J2000_EPOCH_MS) / 86400000;
  const meanMotionDegPerDay = 360 / data.orbitalPeriodDays;
  const longitudeDeg = data.meanLongitudeDeg + meanMotionDegPerDay * daysSinceEpoch;
  const normalizedDeg = ((longitudeDeg % 360) + 360) % 360;
  return (normalizedDeg * Math.PI) / 180;
}
