const DEFAULT_ORBIT_GAP_SHARE = 0.42;
const DEFAULT_SUN_ORBIT_SHARE = 0.22;

export function visualBodyRadius(planet, showMoon = false) {
  const ringRadius = planet.hasRings ? planet.radius * 2.3 : 0;
  const moonRadius = planet.hasMoon && showMoon ? planet.radius * 2.17 : 0;
  return Math.max(planet.radius, ringRadius, moonRadius);
}

export function computeBodyScaleLimits(
  planetDatas,
  {
    sunRadius,
    showMoon = false,
    orbitGapShare = DEFAULT_ORBIT_GAP_SHARE,
    sunOrbitShare = DEFAULT_SUN_ORBIT_SHARE,
  },
) {
  if (planetDatas.length === 0) {
    return { maxSunScale: 1, maxPlanetScaleByKey: {} };
  }

  const sorted = [...planetDatas].sort((a, b) => a.distance - b.distance);
  const maxPlanetScaleByKey = {};

  sorted.forEach((planet, index) => {
    const previousDistance = index === 0 ? 0 : sorted[index - 1].distance;
    const nextDistance = sorted[index + 1]?.distance ?? Number.POSITIVE_INFINITY;
    const inwardGap = planet.distance - previousDistance;
    const outwardGap = nextDistance - planet.distance;
    const availableRadius = Math.min(inwardGap, outwardGap) * orbitGapShare;
    maxPlanetScaleByKey[planet.key] = Math.max(0, availableRadius / visualBodyRadius(planet, showMoon));
  });

  return {
    maxSunScale: Math.max(0, (sorted[0].distance * sunOrbitShare) / sunRadius),
    maxPlanetScaleByKey,
  };
}