import { useCallback, useEffect, useRef, useState } from 'react';
import { createPlanetPreviewRow } from '../engine/planetPreviewEngine.js';

// Normalized display sizes for the carousel ONLY — deliberately NOT real
// astronomical proportions (Jupiter isn't rendered ~11x Mercury's size
// here) and completely separate from `data.radius` used by the actual 3D
// solar-system engine. Tuned instead for usability/visual balance so the
// row reads as evenly weighted while still preserving a *sense* of
// relative size (gas giants a bit bigger, Mercury/Mars a bit smaller).
const DISPLAY_SCALE = {
  mercury: 0.85,
  venus: 0.95,
  earth: 1.0,
  mars: 0.9,
  jupiter: 1.15,
  saturn: 1.15,
  uranus: 1.0,
  neptune: 1.0,
};
const BASE_SPHERE_PX = 52;

/** A horizontally swipeable "coverflow" row of planets — native momentum
 * scroll + CSS scroll-snap (no hand-rolled drag physics needed) with the
 * centered item continuously scaled up/brightened based on its live
 * distance from the row's center, computed from real DOM rects on every
 * scroll frame. Tapping any planet smooth-scrolls it to center; whichever
 * planet ends up centered (by swipe OR tap) is reported via `onSelect`.
 * `excludeKey` (the OTHER slot's current pick) is rendered disabled/faded
 * and can never become this row's selection — if a swipe settles on/near
 * it, this row auto-corrects to the nearest still-available planet instead
 * of ever reporting a duplicate, so Planet A/B can never collide.
 *
 * The planets themselves are real lit 3D globes (see
 * engine/planetPreviewEngine.js), not flat CSS circles — a single shared
 * WebGL canvas overlays the whole track, its orthographic camera panned in
 * lockstep with the track's native `scrollLeft` every frame so the 3D
 * scene stays pixel-perfectly aligned with the (invisible, still fully
 * interactive) DOM buttons underneath, which continue to own scroll-snap,
 * tap-to-center, disabled state, and accessibility. */
export function PlanetSwipeRow({ label, planets, selectedKey, initialKey, onSelect, excludeKey }) {
  const trackRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const itemRefs = useRef({});
  const [distances, setDistances] = useState({});
  const hasCenteredInitially = useRef(false);
  const settleTimerRef = useRef(null);
  const excludeKeyRef = useRef(excludeKey);
  excludeKeyRef.current = excludeKey;

  const applyPlanetStates = useCallback(
    (distancesMap) => {
      const engine = engineRef.current;
      if (!engine) return;
      planets.forEach((planet) => {
        const dist = distancesMap[planet.key] ?? 2;
        const isDisabled = planet.key === excludeKeyRef.current;
        const radiusPx = (BASE_SPHERE_PX / 2) * (DISPLAY_SCALE[planet.key] ?? 1);
        // Dynamic depth scale: the centered planet is boosted ~18% (a
        // clear but not exaggerated "selected" pop), falling off for
        // neighbours and shrinking further for distant planets — this is
        // ON TOP OF the static per-planet radius above, so relative planet
        // sizing is preserved at every carousel position.
        const scale = Math.max(1.18 - dist * 0.42, 0.5);
        // Distant planets fade out (lower opacity) for a clear depth cue.
        const opacity = Math.max(1 - dist * 0.6, 0.22);
        // The selected planet stands out through SCALE and full-brightness
        // material color alone — no emissive/glow boost. Distant/unselected
        // planets dim toward gray via a real material-color multiply
        // (three.js has no CSS brightness()/contrast() equivalent, so this
        // stands in for that same "selected reads clear, distant fades
        // flat" contrast) — deliberately no artificial bloom/glow anywhere.
        const dim = Math.max(1 - dist * 0.4, 0.45);
        engine.setPlanetState(planet.key, { radiusPx, scale, opacity, dim, disabled: isDisabled });
      });
    },
    [planets],
  );

  const recompute = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const trackRect = track.getBoundingClientRect();
    const centerX = trackRect.left + trackRect.width / 2;
    let nearestKey = null;
    let nearestDist = Infinity;
    let nearestAvailableKey = null;
    let nearestAvailableDist = Infinity;
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
      if (planet.key !== excludeKey && pxDist < nearestAvailableDist) {
        nearestAvailableDist = pxDist;
        nearestAvailableKey = planet.key;
      }
    });
    setDistances(next);
    applyPlanetStates(next);
    engineRef.current?.setViewport(track.scrollLeft, track.clientWidth, track.clientHeight, window.devicePixelRatio);
    if (nearestKey && nearestKey !== excludeKey && nearestKey !== selectedKey) {
      onSelect(nearestKey);
    }
    return nearestAvailableKey;
  }, [planets, selectedKey, onSelect, excludeKey, applyPlanetStates]);

  // Mount the shared 3D preview engine once, lay out each planet at its
  // exact scroll-content pixel position, and keep that layout in sync with
  // resizes (font loading, orientation change, viewport width changes).
  useEffect(() => {
    const track = trackRef.current;
    const canvas = canvasRef.current;
    if (!track || !canvas) return undefined;
    const engine = createPlanetPreviewRow(canvas, planets);
    engineRef.current = engine;
    engine.start();

    function layout() {
      const trackRect = track.getBoundingClientRect();
      const positions = {};
      planets.forEach((planet) => {
        const el = itemRefs.current[planet.key];
        if (!el) return;
        const r = el.getBoundingClientRect();
        positions[planet.key] = r.left - trackRect.left + track.scrollLeft + r.width / 2;
      });
      engine.setLayout(positions);
      engine.setViewport(track.scrollLeft, track.clientWidth, track.clientHeight, window.devicePixelRatio);
      // Use recompute() here, NOT applyPlanetStates(distances) — `distances`
      // is a stale closure over this effect's mount-time state (always {}),
      // and under React StrictMode's dev-only double-effect-invocation the
      // SECOND (real) engine instance would otherwise never receive a
      // correct initial sync at all (the separate "center on mount" effect
      // below only runs its recompute() once, guarded by a ref that
      // survives the strict-mode remount) — leaving every planet stuck at
      // default/unselected visuals until the user's first real scroll.
      // recompute() always re-measures the live DOM, so it's correct no
      // matter how many times this effect (re)runs.
      recompute();
    }
    layout();

    const resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(track);
    return () => {
      resizeObserver.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planets]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    let raf = null;
    const handleScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        recompute();
        // Debounce a "settled" check: once scrolling has paused for a
        // moment, if the row is resting on/near the disabled (other slot's)
        // planet, smooth-scroll past it to the nearest available one — an
        // automatic "skip" instead of ever letting the user land there.
        if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
        settleTimerRef.current = setTimeout(() => {
          const nearestAvailableKey = recompute();
          const trackNow = trackRef.current;
          if (!trackNow || !excludeKey) return;
          const excludedEl = itemRefs.current[excludeKey];
          if (!excludedEl) return;
          const trackRect = trackNow.getBoundingClientRect();
          const centerX = trackRect.left + trackRect.width / 2;
          const r = excludedEl.getBoundingClientRect();
          const restingOnExcluded = Math.abs(r.left + r.width / 2 - centerX) < r.width / 2;
          if (restingOnExcluded && nearestAvailableKey) {
            itemRefs.current[nearestAvailableKey]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          }
        }, 160);
      });
    };
    track.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      track.removeEventListener('scroll', handleScroll);
      if (raf) cancelAnimationFrame(raf);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, [recompute, excludeKey]);

  // Re-apply planet visual states (opacity/emissive/disabled) whenever the
  // excluded key changes, even without a new scroll event.
  useEffect(() => {
    applyPlanetStates(distances);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excludeKey]);

  // Center on the initial/current selection exactly once on mount (no
  // smooth-scroll animation — should already be centered when the screen
  // appears, not visibly slide into place). Falls back to the first
  // available (non-excluded) planet if the intended key is unavailable.
  useEffect(() => {
    if (hasCenteredInitially.current) return;
    let key = selectedKey ?? initialKey;
    if (key === excludeKey) {
      key = planets.find((p) => p.key !== excludeKey)?.key;
    }
    const el = key && itemRefs.current[key];
    if (el) {
      el.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
      hasCenteredInitially.current = true;
      recompute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTap(key) {
    if (key === excludeKey) return;
    itemRefs.current[key]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  const centered = planets.find((p) => p.key === selectedKey) ?? planets.find((p) => p.key === initialKey);

  return (
    <div className="swipe-row">
      <span className="swipe-row__label">{label}</span>
      <div className="swipe-row__viewport">
        <canvas className="swipe-row__canvas" ref={canvasRef} aria-hidden="true" />
        <div className="swipe-row__track" ref={trackRef}>
          <div className="swipe-row__pad" aria-hidden="true" />
          {planets.map((planet) => {
            const dist = distances[planet.key] ?? 2;
            const isDisabled = planet.key === excludeKey;
            const glow = Math.max(1 - dist * 1.8, 0);
            const isCenter = dist < 0.12 && !isDisabled;
            return (
              <button
                key={planet.key}
                type="button"
                ref={(el) => {
                  itemRefs.current[planet.key] = el;
                }}
                className={`swipe-planet${isCenter ? ' is-center' : ''}${isDisabled ? ' is-disabled' : ''}`}
                style={{ '--planet-color': planet.color, '--glow': glow }}
                onClick={() => handleTap(planet.key)}
                disabled={isDisabled}
                aria-label={isDisabled ? `${planet.name}, already picked as the other planet` : planet.name}
                aria-current={isCenter}
                aria-disabled={isDisabled}
              >
                <span className="swipe-planet__glow" />
              </button>
            );
          })}
          <div className="swipe-row__pad" aria-hidden="true" />
        </div>
      </div>
      <div className="swipe-row__info">
        <span className="swipe-row__name">{centered?.name ?? '\u2014'}</span>
        <span className="swipe-row__fact">{centered?.fact}</span>
      </div>
    </div>
  );
}

