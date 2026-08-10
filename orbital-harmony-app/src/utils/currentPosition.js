// ============================================================================
// Shared heliocentric planetary longitude. Astronomy Engine supplies the
// ephemeris for supported planets; the J2000 mean/circular calculation is a
// deterministic fallback for any future custom body.
// ============================================================================

import { Body, EclipticLongitude } from 'astronomy-engine';

const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0); // 2000-01-01 12:00 UTC
const ASTRONOMY_BODY_BY_KEY = {
  mercury: Body.Mercury,
  venus: Body.Venus,
  earth: Body.Earth,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
};

/**
 * @param {{ key?: string, orbitalPeriodDays: number, meanLongitudeDeg?: number }} data
 * @param {Date} [now] defaults to the real current time
 * @returns {number} current orbital angle in RADIANS, for direct use as
 *   `pivot.rotation.y`
 */
export function currentOrbitAngleRad(data, now = new Date()) {
  const astronomyBody = ASTRONOMY_BODY_BY_KEY[data.key];
  if (astronomyBody) {
    return (EclipticLongitude(astronomyBody, now) * Math.PI) / 180;
  }

  // Deterministic fallback when orbital elements are missing. We avoid a
  // random fallback so repeated renders stay reproducible.
  if (data.meanLongitudeDeg == null || !data.orbitalPeriodDays) {
    return 0;
  }
  const daysSinceEpoch = (now.getTime() - J2000_EPOCH_MS) / 86400000;
  const meanMotionDegPerDay = 360 / data.orbitalPeriodDays;
  const longitudeDeg = data.meanLongitudeDeg + meanMotionDegPerDay * daysSinceEpoch;
  const normalizedDeg = ((longitudeDeg % 360) + 360) % 360;
  return (normalizedDeg * Math.PI) / 180;
}
