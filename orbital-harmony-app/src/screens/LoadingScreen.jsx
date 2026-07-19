import { useEffect, useRef, useState } from 'react';

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

    let width = 0;
    let height = 0;
    let centerX = 0;
    let centerY = 0;
    let maxOrbitPx = 0;
    let stars = [];

    // A fixed, static field of tiny glowing points scattered across the
    // whole canvas (not just around the orrery) — regenerated on resize.
    // These never fade like the planet trails do (redrawn fresh each frame
    // in step 2 below), so they always read as crisp, dramatic pinpricks
    // of light against the pure black background.
    function buildStars() {
      const count = Math.round((width * height) / 5500);
      const next = [];
      for (let i = 0; i < count; i++) {
        next.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 1.1 + 0.3,
          baseAlpha: 0.25 + Math.random() * 0.55,
          twinkleSpeed: 0.4 + Math.random() * 1.2,
          twinklePhase: Math.random() * Math.PI * 2,
        });
      }
      stars = next;
    }

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
      centerY = height / 2;
      // Keep the outermost orbit comfortably inside the shorter viewport
      // dimension so it's never cropped on narrow mobile screens. Kept
      // deliberately compact (was 0.42) so the whole loading pattern reads
      // as a small, minimal accent rather than a dominant centerpiece.
      maxOrbitPx = Math.min(width, height) * 0.3;
      buildStars();
    }
    handleResize();
    window.addEventListener('resize', handleResize);

    const planets = ORRERY_PLANETS.map((p) => ({ ...p, angle: Math.random() * Math.PI * 2 }));

    const HOLD_MS = reducedMotion ? 900 : 3400;
    const TRANSITION_MS = reducedMotion ? 500 : 1700;
    // Kept in exact lockstep with the `.loading-screen` CSS opacity
    // transition duration (0.85s normally, 0.3s under reduced motion — see
    // index.css) — this timer is what actually swaps to the next screen,
    // so if it fired even slightly before the CSS fade-out visually
    // finished, the old screen would pop away mid-fade instead of the
    // handoff reading as one smooth fade-to-black.
    const FADE_MS = reducedMotion ? 300 : 850;
    const SPEED_MULT = reducedMotion ? 0.15 : 1;

    let phase = 'hold'; // 'hold' -> 'transition' -> 'done'
    let transitionStart = null;
    let holdTimer, transitionTimer, doneTimer;

    function beginTransition() {
      phase = 'transition';
      transitionStart = performance.now();
      setTransitioning(true);
      transitionTimer = setTimeout(() => {
        phase = 'done';
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

    // No textures to load for a flat 2D scene — reveal on the very next
    // frame (a hair after mount, so the CSS opacity transitions on the
    // canvas/title still have a "from" state to animate out of).
    const readyRaf = requestAnimationFrame(() => {
      setReady(true);
      holdTimer = setTimeout(beginTransition, HOLD_MS);
    });

    let rafId = null;
    let lastTime = performance.now();
    let sunPulseT = 0;

    function draw(now) {
      rafId = requestAnimationFrame(draw);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      let accel = 0;
      if (phase === 'transition' && transitionStart != null) {
        accel = Math.min(1, (now - transitionStart) / TRANSITION_MS);
      } else if (phase === 'done') {
        accel = 1;
      }
      const eased = easeInOutCubic(accel);
      // Planets gently speed up during the completion transition — a
      // satisfying "energizing" cue standing in for a progress indicator.
      const speedScale = SPEED_MULT * (1 + eased * 2.4);

      // ---- Step 1: fade the previous frame toward transparent ----
      // This single low-alpha rect is the entire trail mechanism — see the
      // file header comment for why no point-history buffer is needed.
      // Slightly slower fade than earlier (was 0.085) so the now much
      // faster orbital speed still reads as a smooth, continuous arc
      // rather than choppy, disconnected dots.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0, 0, 0, ${0.06 + eased * 0.04})`;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';

      // ---- Step 2: redraw the faint orbit rings at full strength ----
      // Hairline-thin and dimmed to a neutral, desaturated grey — kept
      // deliberately near-invisible (opacity was 0.05, then 0.02) so the
      // rings sit almost flush with the black background, just enough of
      // a hint to imply orbital paths without ever reading as a drawn line.
      ctx.lineWidth = 0.3;
      ctx.strokeStyle = 'rgba(150, 150, 150, 0.02)';
      for (const p of planets) {
        const r = p.distanceFrac * maxOrbitPx;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ---- Dramatic glowing starfield — static positions, redrawn fresh
      // every frame (so they never fade like the trails) with a gentle
      // per-star twinkle via a phase-offset sine wave on their alpha. The
      // twinkle previously only swung the alpha multiplier between 0.7-1.0
      // (a 30% dip) on a physically tiny (~0.3-1.4px) dot — technically
      // animating every frame, but so subtle it read as a static field.
      // Widened to a near-full 0.15-1.0 swing (dimming almost to nothing
      // at the trough) AND paired with a matching radius pulse so each
      // star visibly grows/shrinks as it brightens/dims — much closer to a
      // real naked-eye "twinkle" instead of a barely-perceptible shimmer. ----
      for (const s of stars) {
        const twinkle = 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(now * 0.001 * s.twinkleSpeed + s.twinklePhase));
        ctx.fillStyle = `rgba(255, 255, 255, ${s.baseAlpha * twinkle})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * (0.7 + 0.3 * twinkle), 0, Math.PI * 2);
        ctx.fill();
      }

      // ---- Sun: small white core with a gentle, slow pulse (no glow —
      // a plain crisp dot, kept minimal per the brief) ----
      sunPulseT += dt;
      const pulseScale = 1 + Math.sin(sunPulseT * 1.4) * 0.04;
      const sunRadius = Math.max(7, maxOrbitPx * 0.035) * pulseScale;

      const core = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, sunRadius);
      core.addColorStop(0, '#ffffff');
      core.addColorStop(0.6, '#f0f0f0');
      core.addColorStop(1, '#d8d8d8');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(centerX, centerY, sunRadius, 0, Math.PI * 2);
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
    }
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(readyRaf);
      clearTimeout(holdTimer);
      clearTimeout(transitionTimer);
      clearTimeout(doneTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`loading-screen${leaving ? ' is-leaving' : ''}`}>
      <canvas ref={canvasRef} className={`loading-canvas${ready ? ' is-ready' : ''}`} />
      <div className="loading-vignette" />
      <div className="loading-ui">
        <div className={`loading-title-wrap${ready ? ' is-visible' : ''}${transitioning ? ' is-transitioning' : ''}`}>
          <h1 className="loading-title">Orbital Harmony</h1>
        </div>
      </div>
    </div>
  );
}
