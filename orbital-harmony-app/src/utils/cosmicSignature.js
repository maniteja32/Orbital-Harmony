// ============================================================================
// Cosmic Signature (Celestial Snapshot, v1)
//
// Deterministically builds a geometric signature from heliocentric planetary
// angles at a given birth date:
//   Mercury -> Venus -> Earth -> Mars -> Jupiter -> Saturn -> Uranus -> Neptune
// and closes Neptune -> Mercury.
// ============================================================================

import { PLANETS } from '../data/planets.js';
import { currentOrbitAngleRad } from './currentPosition.js';

export const COSMIC_CONNECTION_COUNT = PLANETS.length + 1;

const DISPLAY_DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Parse date input from the Cosmic Signature form.
 *
 * Uses canonical 12:00 UTC so the same date produces the same signature in
 * every browser time zone.
 *
 * @param {string} dateStr YYYY-MM-DD
 * @returns {Date | null}
 */
export function parseCosmicDateInput(dateStr) {
  if (!dateStr) return null;
  const [yearRaw, monthRaw, dayRaw] = dateStr.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * @param {Date | null | undefined} date
 * @returns {string}
 */
export function formatCosmicSignatureDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return DISPLAY_DATE_FORMATTER.format(date);
}

/**
 * Returns planets in orbital order with heliocentric angles and normalized
 * circle coordinates for the celestial snapshot.
 *
 * @param {Date} date
 * @returns {{
 *  orderedPlanets: Array<{key: string, name: string, angleRad: number, x: number, y: number}>
 * }}
 */
export function buildCelestialSnapshot(date) {
  const orderedPlanets = PLANETS.map((planet) => {
    const angleRad = currentOrbitAngleRad(planet, date);
    return {
      key: planet.key,
      name: planet.name,
      angleRad,
      x: Math.cos(angleRad - Math.PI / 2),
      y: Math.sin(angleRad - Math.PI / 2),
    };
  });

  return { orderedPlanets };
}

/**
 * Draw the v1 celestial snapshot signature onto a canvas context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Date} date
 */
export function drawCosmicSignature(ctx, date) {
  const size = Math.min(ctx.canvas.width, ctx.canvas.height);
  const center = size / 2;
  const orbitRadius = size * 0.38;
  const pointRadius = Math.max(2, size * 0.006);
  const lineWidth = Math.max(1, size * 0.0014);
  const guideWidth = Math.max(1, size * 0.0012);

  const { orderedPlanets } = buildCelestialSnapshot(date);

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Dark premium background with a subtle center lift.
  const bg = ctx.createRadialGradient(
    center,
    center,
    size * 0.05,
    center,
    center,
    size * 0.72,
  );
  bg.addColorStop(0, '#0b0d12');
  bg.addColorStop(0.5, '#07090d');
  bg.addColorStop(1, '#040507');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Subtle boundary ring to make the signature read as an artifact.
  ctx.beginPath();
  ctx.arc(center, center, size * 0.485, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = Math.max(1, size * 0.0018);
  ctx.stroke();

  // Circular orbit map around the Sun.
  ctx.beginPath();
  ctx.arc(center, center, orbitRadius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = guideWidth;
  ctx.stroke();

  const points = orderedPlanets.map((planet) => ({
    x: center + planet.x * orbitRadius,
    y: center + planet.y * orbitRadius,
  }));

  // Closed signature line in strict orbital order.
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = lineWidth * 2.1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.74)';
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Planet points.
  points.forEach((point) => {
    const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, pointRadius * 3.5);
    glow.addColorStop(0, 'rgba(255,255,255,0.36)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(point.x, point.y, pointRadius * 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });

  // Sun marker.
  const sunGlow = ctx.createRadialGradient(center, center, 0, center, center, pointRadius * 5);
  sunGlow.addColorStop(0, 'rgba(255,255,255,0.34)');
  sunGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(center, center, pointRadius * 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(center, center, pointRadius * 0.8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
}

/**
 * @param {Date} date
 * @param {{ size?: number }} [opts]
 * @returns {string | null} PNG data URL
 */
export function generateCosmicSignatureDataUrl(date, opts = {}) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  const size = opts.size ?? 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  drawCosmicSignature(ctx, date);
  return canvas.toDataURL('image/png');
}
