import { useCallback, useEffect, useRef, useState } from 'react';

/** A horizontally swipeable "coverflow" row of planets — native momentum
 * scroll + CSS scroll-snap (no hand-rolled drag physics needed) with the
 * centered item continuously scaled up/brightened based on its live
 * distance from the row's center, computed from real DOM rects on every
 * scroll frame. Tapping any planet smooth-scrolls it to center; whichever
 * planet ends up centered (by swipe OR tap) is reported via `onSelect`. */
export function PlanetSwipeRow({ label, planets, selectedKey, initialKey, onSelect, duplicateWarning }) {
  const trackRef = useRef(null);
  const itemRefs = useRef({});
  const [distances, setDistances] = useState({});
  const hasCenteredInitially = useRef(false);

  const recompute = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const trackRect = track.getBoundingClientRect();
    const centerX = trackRect.left + trackRect.width / 2;
    let nearestKey = null;
    let nearestDist = Infinity;
    const next = {};
    planets.forEach((planet) => {
      const el = itemRefs.current[planet.key];
      if (!el) return;
      const r = el.getBoundingClientRect();
      const itemCenter = r.left + r.width / 2;
      const pxDist = Math.abs(itemCenter - centerX);
      const unitDist = pxDist / (r.width + 26); // distance in "item spacing" units
      next[planet.key] = unitDist;
      if (pxDist < nearestDist) {
        nearestDist = pxDist;
        nearestKey = planet.key;
      }
    });
    setDistances(next);
    if (nearestKey && nearestKey !== selectedKey) onSelect(nearestKey);
  }, [planets, selectedKey, onSelect]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    let raf = null;
    const handleScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        recompute();
      });
    };
    track.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      track.removeEventListener('scroll', handleScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [recompute]);

  // Center on the initial/current selection exactly once on mount (no
  // smooth-scroll animation — should already be centered when the screen
  // appears, not visibly slide into place).
  useEffect(() => {
    if (hasCenteredInitially.current) return;
    const key = selectedKey ?? initialKey;
    const el = key && itemRefs.current[key];
    if (el) {
      el.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
      hasCenteredInitially.current = true;
      recompute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTap(key) {
    itemRefs.current[key]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  const centered = planets.find((p) => p.key === selectedKey) ?? planets.find((p) => p.key === initialKey);

  return (
    <div className="swipe-row">
      <span className="swipe-row__label">{label}</span>
      <div className="swipe-row__track" ref={trackRef}>
        <div className="swipe-row__pad" aria-hidden="true" />
        {planets.map((planet) => {
          const dist = distances[planet.key] ?? 2;
          const scale = Math.max(1 - dist * 0.34, 0.5);
          const opacity = Math.max(1 - dist * 0.6, 0.25);
          // Active planet reads brighter/more saturated (real texture at
          // full punch); inactive ones fade toward dim/washed-out, on top
          // of the scale+opacity shrink, for a clearer "faded" read.
          const brightness = Math.max(1.25 - dist * 0.45, 0.55);
          const saturate = Math.max(1.1 - dist * 0.55, 0.35);
          const isCenter = dist < 0.12;
          return (
            <button
              key={planet.key}
              type="button"
              ref={(el) => {
                itemRefs.current[planet.key] = el;
              }}
              className={`swipe-planet${isCenter ? ' is-center' : ''}`}
              style={{
                '--planet-color': planet.color,
                '--planet-texture': `url(${planet.texture})`,
                '--scale': scale,
                '--opacity': opacity,
                '--brightness': brightness,
                '--saturate': saturate,
              }}
              onClick={() => handleTap(planet.key)}
              aria-label={planet.name}
              aria-current={isCenter}
            >
              <span className="swipe-planet__sphere" />
            </button>
          );
        })}
        <div className="swipe-row__pad" aria-hidden="true" />
      </div>
      <div className="swipe-row__info">
        <span className="swipe-row__name">{centered?.name ?? '\u2014'}</span>
        <span className="swipe-row__fact">{centered?.fact}</span>
        {duplicateWarning && <span className="swipe-row__warning">Already picked as the other planet — keep swiping</span>}
      </div>
    </div>
  );
}
