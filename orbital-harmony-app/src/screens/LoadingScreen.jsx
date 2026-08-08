import { useEffect, useRef, useState } from 'react';
import { createStarfieldBackdrop } from '../engine/starfieldBackdrop.js';

/**
 * Premium cinematic loading sequence — a clean, top-down "orrery" view of
 * the Solar System: a small glowing Sun sits at the center while each
 * planet is a subtle dot gliding around it on a faint orbit ring, leaving
 * a soft trail that fades gracefully behind it.
 *
 * The trail effect needs NO per-point history bookkeeping: every orbit is
 * a perfect circle around a fixed center, so each frame we simply (1) fade
 * the whole canvas slightly toward transparent via a low-alpha
 * `destination-out` rectangle, THEN (2) redraw the orbit rings/Sun at full
 * strength, THEN (3) draw each planet's dot at its new position. The
 * un-redrawn "ghost" of a planet's previous positions is what reads as a
 * fading comet-like trail — the orbit rings/Sun never fade because step
 * (2) restores them to full opacity every single frame.
 *
 * Plain 2D canvas (no Three.js/WebGL) — deliberately lightweight since the
 * whole scene is flat circles and dots, so this is the very first thing
 * the user sees, rendering instantly with zero texture loads.
 */

// A reduced, decorative planet set — monochrome (no per-planet color),
// only 4 orbits for a cleaner/more minimal read. `distanceFrac` gaps are
// deliberately UNEVEN (tight near the Sun, wider further out) rather than
// evenly spaced rings, closer to how real orbital spacing looks — but the
// outermost orbit is kept fairly close in (was 0.98) so the whole pattern
// stays compact rather than sprawling to the edge of its box. `speed`
// values are deliberately fast (a real "loading spinner" pace, not a slow
// realistic drift) while still keeping closer planets quicker than
// farther ones, like real orbital mechanics. `dotRadius` is kept tiny
// (~1/4 of an earlier, chunkier pass) with only slight variation between
// planets so the dots read as fine points rather than bold circles.
const ORRERY_PLANETS = [
  { distanceFrac: 0.2, dotRadius: 0.65, speed: 1.6 },
  { distanceFrac: 0.34, dotRadius: 0.8, speed: 1.05 },
  { distanceFrac: 0.52, dotRadius: 0.7, speed: 0.72 },
  { distanceFrac: 0.72, dotRadius: 1.05, speed: 0.48 },
];

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}



export default function LoadingScreen({ onDone, onExited }) {
  const canvasRef = useRef(null);
  const starCanvasRef = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  const [ready, setReady] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // The starfield is the EXACT same Three.js skybox the Solar System screen
    // uses (see engine/starfieldBackdrop.js) rendered on its own WebGL canvas
    // BEHIND this 2D orrery canvas — so the loading -> system transition shows
    // literally identical stars. The orrery (Sun + planet dots + trails) is
    // still drawn on the transparent 2D canvas on top.
    const backdrop = starCanvasRef.current ? createStarfieldBackdrop(starCanvasRef.current) : null;

    // The moon is now a plain static <img> (see JSX below) anchored to the
    // bottom of the screen — replaced the earlier procedural Three.js
    // sphere/lighting rig entirely, so there's no WebGL setup needed here.

    let width = 0;
    let height = 0;
    let centerX = 0;
    let centerY = 0;
    let maxOrbitPx = 0;

    // The starfield now lives on a separate WebGL canvas behind this one
    // (see createStarfieldBackdrop above) — it is the SAME star field the
    // Solar System screen renders, so the transition is seamless. This 2D
    // canvas only draws the orrery (Sun + planet dots + trails) on top.

    function handleResize() {
      const parent = canvas.parentElement;
      width = parent ? parent.clientWidth : window.innerWidth;
      height = parent ? parent.clientHeight : window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      centerX = width / 2;
      // Keep loading and landing centers driven by the same theme variable.
      const cssCenter = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--system-center-y')
      );
      const centerRatio = Number.isFinite(cssCenter) ? cssCenter / 100 : 0.46;
      centerY = height * centerRatio;
      // Keep the outermost orbit comfortably inside the shorter viewport
      // dimension so it's never cropped on narrow mobile screens. Kept
      // deliberately compact (was 0.42) so the whole loading pattern reads
      // as a small, minimal accent rather than a dominant centerpiece.
      maxOrbitPx = Math.min(width, height) * 0.3;
    }
    handleResize();
    window.addEventListener('resize', handleResize);

    const planets = ORRERY_PLANETS.map((p) => ({ ...p, angle: Math.random() * Math.PI * 2 }));

    const HOLD_MS = reducedMotion ? 900 : 3400;
    const TRANSITION_MS = reducedMotion ? 500 : 1700;
    // Kept in exact lockstep with the `.loading-screen` CSS opacity
    // transition duration (1.2s normally, 0.3s under reduced motion — see
    // index.css) — this timer is what actually swaps to the next screen,
    // so if it fired even slightly before the CSS fade-out visually
    // finished, the old screen would pop away mid-fade instead of the
    // handoff reading as one smooth fade-to-black. Lengthened from 0.85s so
    // the loading <-> landing crossfade overlaps longer and reads as a
    // slower, gentler dissolve rather than a quick swap.
    const FADE_MS = reducedMotion ? 300 : 1200;
    const SPEED_MULT = reducedMotion ? 0.15 : 1;
    // The orrery spins fast at the start of loading and eases down to a slow,
    // calm pace (close to the real planets') by the hand-off — see the draw
    // loop. FAST_SPIN is the initial multiplier, SLOW_SPIN the settled one.
    const FAST_SPIN = 2.6;
    const SLOW_SPIN = 0.72;

    let sequenceStart = null;
    let holdTimer, transitionTimer, doneTimer;
    let unmounted = false;

    function beginTransition() {
      setTransitioning(true);
      transitionTimer = setTimeout(() => {
        setLeaving(true);
        // Fire `onDone` IMMEDIATELY (not after the fade finishes) so the
        // parent can swap to the next screen and start ITS fade-in right
        // now — the two animations then genuinely overlap (a real
        // crossfade) instead of running one after the other with a gap.
        // This component keeps rendering itself on top, fading out, for
        // `FADE_MS` more, then tells the parent it's safe to unmount it
        // via `onExited`.
        onDoneRef.current();
        doneTimer = setTimeout(() => onExitedRef.current?.(), FADE_MS);
      }, TRANSITION_MS);
    }

    // Google Fonts loads with `display: swap` (see index.html), so on a slow
    // connection (common on a cold WKWebView launch, see ios/README.md) the
    // "Orbital Harmony" title can still be showing its fallback system font
    // when the crossfade begins, then SWAP to Syncopate mid-transition —
    // visually reading as a stray flash of differently-styled text right as
    // the landing screen appears. `document.fonts.ready` resolves once every
    // requested @font-face has finished loading (or failed); racing it
    // against a short cap means the common case (fonts already loaded well
    // within HOLD_MS) fires `beginTransition` at the exact same time as
    // before, while a slow-network case waits a little longer for fonts
    // instead of ever swapping mid-crossfade.
    const FONT_WAIT_CAP_MS = 2000;
    const fontsReady = typeof document !== 'undefined' && document.fonts?.ready
      ? document.fonts.ready.catch(() => {})
      : Promise.resolve();
    let fontsSettled = false;
    fontsReady.then(() => {
      fontsSettled = true;
    });

    // No textures to load for a flat 2D scene — reveal on the very next
    // frame (a hair after mount, so the CSS opacity transitions on the
    // canvas still have a "from" state to animate out of).
    const readyRaf = requestAnimationFrame(() => {
      setReady(true);
      sequenceStart = performance.now();
      holdTimer = setTimeout(() => {
        if (fontsSettled) {
          beginTransition();
        } else {
          Promise.race([fontsReady, new Promise((resolve) => setTimeout(resolve, FONT_WAIT_CAP_MS))]).then(() => {
            if (!unmounted) beginTransition();
          });
        }
      }, HOLD_MS);
    });

    let rafId = null;
    let lastTime = performance.now();
    let sunPulseT = 0;

    function draw(now) {
      rafId = requestAnimationFrame(draw);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // The orrery starts spinning fast and SMOOTHLY DECELERATES over the
      // whole loading sequence (hold + transition), easing down to a slow,
      // calm pace close to the real planets' orbital speed by the time the
      // crossfade hands off to the landing — so the motion settles INTO the
      // real system instead of stopping and restarting. `progress` runs 0->1
      // across HOLD_MS + TRANSITION_MS; easeInOutCubic holds the fast speed
      // briefly, then bleeds it off and gently settles at SLOW_SPIN.
      const spinDuration = HOLD_MS + TRANSITION_MS;
      const progress = sequenceStart == null
        ? 0
        : Math.min(1, (now - sequenceStart) / spinDuration);
      const decel = easeInOutCubic(progress);
      const speedScale = SPEED_MULT * (FAST_SPIN + (SLOW_SPIN - FAST_SPIN) * decel);

      // ---- Step 1: fade the previous frame toward transparent ----
      // This single low-alpha rect is the entire trail mechanism — see the
      // file header comment for why no point-history buffer is needed.
      // A low-alpha fade so the trail reads as a smooth continuous arc: the
      // trail is naturally longest while the orrery spins fast at the start
      // and shortens on its own as the spin decelerates.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';

      // ---- Step 2: redraw the faint orbit rings at full strength ----
      // Hairline-thin and dimmed to a neutral, desaturated grey — kept
      // deliberately near-invisible (opacity was 0.05, then 0.02) so the
      // rings sit almost flush with the black background, just enough of
      // a hint to imply orbital paths without ever reading as a drawn line.
      // Keep spinner visuals in the sky area so they don't paint over the
      // lunar foreground texture.
      const skyMaskY = height * 0.7;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, skyMaskY);
      ctx.clip();

      ctx.lineWidth = 0.3;
      ctx.strokeStyle = 'rgba(150, 150, 150, 0.02)';
      for (const p of planets) {
        const r = p.distanceFrac * maxOrbitPx;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // (The starfield is rendered on the separate WebGL canvas behind this
      // one — see createStarfieldBackdrop — so there's no 2D star drawing
      // here anymore.)

      sunPulseT += dt;

      // ---- Sun: a plain solid orange dot, no glow/gradient — kept simple
      // on purpose (a soft radial glow here previously read as an oversized
      // blur instead of a small sun).
      ctx.fillStyle = '#ff9c4a';
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxOrbitPx * 0.02, 0, Math.PI * 2);
      ctx.fill();

      // ---- Step 3: advance + draw each planet as a small glowing dot ----
      // Angle DECREASES (rather than increases) so the dots sweep
      // COUNTERCLOCKWISE on screen — canvas Y grows downward, so a plain
      // `+= speed` with `sin(angle)` for y actually reads as CLOCKWISE
      // motion, the opposite of the standard "viewed from the north"
      // convention every real solar-system diagram uses.
      for (const p of planets) {
        p.angle -= p.speed * speedScale * dt;
        const r = p.distanceFrac * maxOrbitPx;
        const x = centerX + Math.cos(p.angle) * r;
        const y = centerY + Math.sin(p.angle) * r;

        // Minimal halo — small and low-opacity, just enough to soften the
        // dot's edge rather than reading as an artificial glow blob. Kept
        // tight (was 1.7x) so the trailing arc reads thin, matching the
        // now much smaller dot size.
        const dotHaloR = p.dotRadius * 1.3;
        const dotHalo = ctx.createRadialGradient(x, y, 0, x, y, dotHaloR);
        dotHalo.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
        dotHalo.addColorStop(0.6, 'rgba(255, 255, 255, 0.06)');
        dotHalo.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = dotHalo;
        ctx.beginPath();
        ctx.arc(x, y, dotHaloR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, p.dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
    rafId = requestAnimationFrame(draw);

    return () => {
      unmounted = true;
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(readyRaf);
      clearTimeout(holdTimer);
      clearTimeout(transitionTimer);
      clearTimeout(doneTimer);
      window.removeEventListener('resize', handleResize);
      backdrop?.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`loading-screen${leaving ? ' is-leaving' : ''}`}>
      <canvas ref={starCanvasRef} className={`loading-stars${ready ? ' is-ready' : ''}`} />
      <img
        src="/textures/loading-moon-photo.jpg"
        alt=""
        className={`loading-moon${ready ? ' is-ready' : ''}`}
      />
      <canvas
        ref={canvasRef}
        className={`loading-canvas${ready ? ' is-ready' : ''}`}
      />
      <div className="loading-header">
        <h1 className="loading-title">Orbital Harmony</h1>
        <p className="loading-subtitle">Discover the hidden patterns of planetary motion.</p>
      </div>
      <div className={`loading-message${ready ? ' is-visible' : ''}`}>
        <p>The cosmos is aligning<span className="loading-ellipsis">.</span><span className="loading-ellipsis">.</span><span className="loading-ellipsis">.</span></p>
      </div>
      <div className={`loading-vignette${transitioning ? ' is-dimming' : ''}`} />
    </div>
  );
}
