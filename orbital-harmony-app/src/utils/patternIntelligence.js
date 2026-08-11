import { PLANETS, PLANETS_BY_KEY } from '../data/planets.js';
import {
  buildCelestialSnapshot,
  COSMIC_CONNECTION_COUNT,
  formatCosmicSignatureDate,
} from './cosmicSignature.js';
import { computePatternPlan } from './resonance.js';
import { computeSimulationPlan } from './simulationPlan.js';

const DAYS_PER_YEAR = 365.25;

function formatYears(years) {
  return years >= 100 ? `${Math.round(years)} yr` : `${years.toFixed(1)} yr`;
}

function formatLines(value) {
  return new Intl.NumberFormat('en').format(value);
}

function shapeName(lobes) {
  if (lobes === 1) return 'single-axis orbit weave';
  if (lobes <= 3) return `${lobes}-lobe orbital crown`;
  if (lobes <= 8) return `${lobes}-lobe resonance rose`;
  if (lobes <= 20) return `${lobes}-lobe orbital rosette`;
  return `${lobes}-lobe resonance mandala`;
}

function closestAngularPair(planets) {
  let closest = null;
  for (let firstIndex = 0; firstIndex < planets.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < planets.length; secondIndex += 1) {
      const first = planets[firstIndex];
      const second = planets[secondIndex];
      const rawDifference = Math.abs(first.angleRad - second.angleRad);
      const separationRad = Math.min(rawDifference, Math.PI * 2 - rawDifference);
      if (!closest || separationRad < closest.separationRad) {
        closest = { first, second, separationRad };
      }
    }
  }
  return closest;
}

function createCosmicIntelligence(cosmicDate) {
  const date = cosmicDate instanceof Date && !Number.isNaN(cosmicDate.getTime())
    ? cosmicDate
    : new Date(Date.UTC(2000, 0, 1, 12));
  const snapshot = buildCelestialSnapshot(date);
  const closest = closestAngularPair(snapshot.orderedPlanets);
  const separationDeg = closest ? (closest.separationRad * 180) / Math.PI : 0;

  return {
    eyebrow: 'Signature intelligence',
    headline: `${closest.first.name} + ${closest.second.name} form the nearest alignment`,
    summary: `Their heliocentric longitudes are ${separationDeg.toFixed(1)}° apart in the ${formatCosmicSignatureDate(date)} snapshot.`,
    metrics: [
      { label: 'DOB snapshot', value: formatCosmicSignatureDate(date) },
      { label: 'Planet anchors', value: `${PLANETS.length}` },
      { label: 'Connections', value: `${COSMIC_CONNECTION_COUNT}` },
    ],
    insights: [
      {
        title: 'Ephemeris basis',
        value: 'Heliocentric · 12:00 UTC',
        detail: 'Each anchor uses Astronomy Engine’s ecliptic longitude for the selected calendar date, measured from the Sun rather than from Earth.',
      },
      {
        title: 'Nearest angular pair',
        value: `${closest.first.name} + ${closest.second.name} · ${separationDeg.toFixed(1)}°`,
        detail: 'This is the smallest longitude gap among all eight planets in the DOB snapshot; it is a geometric observation, not an astrological claim.',
      },
      {
        title: 'Signature shape',
        value: `${COSMIC_CONNECTION_COUNT}-segment closed loop`,
        detail: 'A single straight-edged wireframe connects the Sun to each planet anchor in orbital order, then closes back to the start — the final signature shape.',
      },
    ],
  };
}

function createPairIntelligence({ planetA, planetB, detailLevel, lineStyle }) {
  const first = PLANETS_BY_KEY[planetA];
  const second = PLANETS_BY_KEY[planetB];
  if (!first || !second) {
    return {
      eyebrow: 'Pattern intelligence',
      headline: 'Pattern data unavailable',
      summary: 'Choose two planets to calculate resonance and rendering metrics.',
      metrics: [],
      insights: [],
    };
  }

  const pattern = computePatternPlan(
    first.orbitalPeriodDays,
    second.orbitalPeriodDays,
    first.orbitDirection ?? 1,
    second.orbitDirection ?? 1,
  );
  const simulation = computeSimulationPlan({ isCosmic: false, planetA, planetB, detailLevel });
  const lineCount = Math.round((simulation.totalSimYears * DAYS_PER_YEAR) / simulation.traceIntervalDays);
  const inner = first.orbitalPeriodDays <= second.orbitalPeriodDays ? first : second;
  const outer = inner === first ? second : first;
  const orbitScalePct = (inner.realDistanceAU / outer.realDistanceAU) * 100;
  const opacityPct = Math.round(simulation.patternOpacity * 100);

  return {
    eyebrow: 'Pattern intelligence',
    headline: shapeName(pattern.petals),
    summary: `${inner.name} completes ${pattern.innerRevs} turns while ${outer.name} completes ${pattern.outerRevs}; their relative motion repeats ${pattern.petals} times around the figure.`,
    metrics: [
      { label: 'Orbit window', value: `${pattern.innerRevs}:${pattern.outerRevs}` },
      { label: 'True lobes', value: `${pattern.petals}` },
      { label: 'Simulation span', value: formatYears(simulation.totalSimYears) },
      { label: 'Rendered lines', value: formatLines(lineCount) },
    ],
    insights: [
      {
        title: 'Closure behavior',
        value: pattern.closed ? 'Clean resonance closure' : 'Closest readable near-closure',
        detail: pattern.closed
          ? 'The real period ratio fits the engine’s closure tolerance, so the selected orbit window returns both markers near their starting alignment.'
          : 'No low-order resonance closes inside the readable loop cap, so the engine uses the closest bounded window while preserving a complete outer orbit.',
      },
      {
        title: 'Physical orbit scale',
        value: `${inner.name} radius · ${orbitScalePct.toFixed(1)}% of ${outer.name}`,
        detail: `${inner.name} is ${inner.realDistanceAU} AU from the Sun and ${outer.name} is ${outer.realDistanceAU} AU. The rendered orbit radii preserve that real distance ratio.`,
      },
      {
        title: 'Rendering balance',
        value: `${lineCount} ${lineStyle} lines · ${opacityPct}% opacity`,
        detail: `Complexity ${detailLevel}/10 sets the sampling density. Opacity adapts to resonance crowding so dense crossings retain negative space instead of becoming a solid disc.`,
      },
    ],
  };
}

export function createPatternIntelligence({ patternMode, planetA, planetB, detailLevel, lineStyle, cosmicDate }) {
  return patternMode === 'cosmic'
    ? createCosmicIntelligence(cosmicDate)
    : createPairIntelligence({ planetA, planetB, detailLevel, lineStyle });
}