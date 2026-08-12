import { PLANETS_BY_KEY } from '../data/planets.js';
import {
  buildCelestialSnapshot,
  COSMIC_CONNECTION_COUNT,
  formatCosmicSignatureDate,
} from './cosmicSignature.js';
import { computePatternPlan } from './resonance.js';
import { computeSimulationPlan } from './simulationPlan.js';

function formatYears(years) {
  return years >= 100 ? `${Math.round(years)} yr` : `${years.toFixed(1)} yr`;
}

// Maps a pattern's petal count + whether it truly closes into one of the
// visual-metaphor words the redesigned Pattern Details experience is built
// around (flower/bloom, mandala, star, web, rosette, spiral, lattice) —
// this is the single place that decides which metaphor a given pair "is",
// so the title, short story, and card copy all agree with each other.
function pickMetaphor(petals, closed) {
  if (!closed) return petals > 12 ? 'web' : 'spiral';
  if (petals <= 2) return 'star';
  if (petals <= 5) return 'bloom';
  if (petals <= 9) return 'rosette';
  if (petals <= 20) return 'mandala';
  return 'lattice';
}

function patternName(innerName, outerName, petals, metaphor) {
  switch (metaphor) {
    case 'star': return `${innerName} & ${outerName}: A Twin Star`;
    case 'spiral': return `${innerName} & ${outerName}: An Endless Spiral`;
    case 'web': return `${innerName} & ${outerName}: A Cosmic Web`;
    case 'bloom': return `${innerName} & ${outerName}: A ${petals}-Petal Bloom`;
    case 'rosette': return `${innerName} & ${outerName}: A ${petals}-Petal Rosette`;
    case 'mandala': return `${innerName} & ${outerName}: A ${petals}-Fold Mandala`;
    default: return `${innerName} & ${outerName}: A ${petals}-Point Lattice`;
  }
}

const METAPHOR_SHAPE_WORDS = {
  star: 'a simple, radiant star',
  bloom: 'a flower in full bloom',
  rosette: 'an intricate rosette',
  mandala: 'a swirling mandala',
  lattice: 'a shimmering lattice',
  spiral: 'a gently unwinding spiral',
  web: 'a delicate, criss-crossing web',
};

function shortStory({ innerName, outerName, closed, metaphor }) {
  const shapeWord = METAPHOR_SHAPE_WORDS[metaphor];
  const closingLine = closed
    ? 'Every so often their paths swing back into the exact same alignment, closing the loop perfectly.'
    : "Their rhythm never quite lines up exactly, so instead of closing cleanly, the pattern keeps drifting into new curves.";
  return `Picture a single thread stretched between ${innerName} and ${outerName} as they circle the Sun, each at its own pace. As that thread sweeps around again and again, it draws ${shapeWord} — ${closingLine}`;
}

function planetaryDanceBody({ innerName, outerName, innerRevs, outerRevs, petals }) {
  const outerLapWord = outerRevs === 1 ? 'lap' : 'laps';
  return `${innerName} is the quicker dancer here — it laps the Sun ${innerRevs} times for every ${outerRevs} ${outerLapWord} ${outerName} completes. That gentle mismatch in speed is exactly what folds the thread into ${petals} repeating arms instead of one plain circle.`;
}

function cosmicTimescaleBody(years) {
  const span = formatYears(years);
  const relatable = years < 1
    ? 'well under a year'
    : years < 3
      ? 'just a few years'
      : years < 12
        ? 'about a decade'
        : years < 40
          ? 'a few decades — a good chunk of a lifetime'
          : years < 150
            ? 'longer than most human lifetimes'
            : 'many centuries — far longer than anyone alive today will see';
  return `This whole pattern represents about ${span} of real orbital motion, condensed into one continuous animation — ${relatable}.`;
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
  const dateLabel = formatCosmicSignatureDate(date);

  return {
    eyebrow: 'Your pattern, decoded',
    patternName: `Your Sky on ${dateLabel}`,
    shortStory: 'On the day you were born, every planet in the solar system sat at its own angle around the Sun. Drawing a line from the Sun out to each one, in order, and back again traced this one-of-a-kind shape — a personal constellation that belongs only to your birth date.',
    planetaryDance: {
      label: 'Planetary Dance',
      body: `${closest.first.name} and ${closest.second.name} were the closest pair in the sky that day, only ${separationDeg.toFixed(1)}° apart — practically standing shoulder to shoulder while the rest of the planets spread out around them.`,
    },
    cosmicTimescale: {
      label: 'Cosmic Timescale',
      body: `This exact arrangement happens only once. It's a single frozen instant from ${dateLabel}, not a repeating cycle like the two-planet patterns.`,
    },
    curious: {
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
    },
  };
}

function createPairIntelligence({ planetA, planetB, detailLevel }) {
  const first = PLANETS_BY_KEY[planetA];
  const second = PLANETS_BY_KEY[planetB];
  if (!first || !second) {
    return {
      eyebrow: 'Your pattern, decoded',
      patternName: 'Pattern data unavailable',
      shortStory: 'Choose two planets to reveal the story behind their shape.',
      planetaryDance: { label: 'Planetary Dance', body: '' },
      cosmicTimescale: { label: 'Cosmic Timescale', body: '' },
      curious: { insights: [] },
    };
  }

  const pattern = computePatternPlan(
    first.orbitalPeriodDays,
    second.orbitalPeriodDays,
    first.orbitDirection ?? 1,
    second.orbitDirection ?? 1,
  );
  const simulation = computeSimulationPlan({ isCosmic: false, planetA, planetB, detailLevel });
  const inner = first.orbitalPeriodDays <= second.orbitalPeriodDays ? first : second;
  const outer = inner === first ? second : first;
  const orbitScalePct = (inner.realDistanceAU / outer.realDistanceAU) * 100;
  const metaphor = pickMetaphor(pattern.petals, pattern.closed);

  return {
    eyebrow: 'Your pattern, decoded',
    patternName: patternName(inner.name, outer.name, pattern.petals, metaphor),
    shortStory: shortStory({ innerName: inner.name, outerName: outer.name, closed: pattern.closed, metaphor }),
    planetaryDance: {
      label: 'Planetary Dance',
      body: planetaryDanceBody({
        innerName: inner.name,
        outerName: outer.name,
        innerRevs: pattern.innerRevs,
        outerRevs: pattern.outerRevs,
        petals: pattern.petals,
      }),
    },
    cosmicTimescale: {
      label: 'Cosmic Timescale',
      body: cosmicTimescaleBody(simulation.totalSimYears),
    },
    curious: {
      insights: [
        {
          title: 'Physical orbit scale',
          value: `${inner.name} radius · ${orbitScalePct.toFixed(1)}% of ${outer.name}`,
          detail: `${inner.name} is ${inner.realDistanceAU} AU from the Sun and ${outer.name} is ${outer.realDistanceAU} AU. The rendered orbit radii preserve that real distance ratio.`,
        },
      ],
    },
  };
}

export function createPatternIntelligence({ patternMode, planetA, planetB, detailLevel, cosmicDate }) {
  return patternMode === 'cosmic'
    ? createCosmicIntelligence(cosmicDate)
    : createPairIntelligence({ planetA, planetB, detailLevel });
}