import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { createSolarSystemEngine } from '../engine/solarSystemEngine.js';

/**
 * Thin React wrapper around the framework-agnostic Three.js engine.
 * Exposes an imperative handle ({ getProgress, captureDataURL, setPaused,
 * setLineStyle, setSpeedMultiplier, reset, completeInstant }) so parent
 * screens (Simulation/Reveal/Result) can poll progress, grab a snapshot,
 * and drive play/pause, trace line style, a live playback-speed
 * multiplier, and an instant jump-to-finished state without re-rendering
 * the whole canvas subtree.
 */
const SolarSystemCanvas = forwardRef(function SolarSystemCanvas(
  {
    planetKeys,
    interactive = false,
    tracePattern = false,
    physicalPattern = false,
    connectAllPlanets = false,
    showOrbitRings = true,
    showMoon = true,
    cinematicIntro = false,
    startSettled = false,
    orthographic = false,
    speedDurationSec,
    totalSimYears,
    traceIntervalDays,
    patternOpacity,
    patternRates,
    startPaused,
    initialSpeedMultiplier,
    miniBodiesIntro = false,
    miniSunScale,
    miniPlanetScale,
    miniIntroDurationSec,
    miniMotionRampSec,
    initialSunScale,
    initialPlanetScale,
    patternStartDate,
    cosmicSnapshotDate,
    compositionOffsetY = 0,
    onComplete,
    onIntroComplete,
    className,
  },
  ref
) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  // useLayoutEffect (not useEffect) so engineRef.current is guaranteed set
  // before any PARENT layout effect runs in the same commit — Result
  // screen's instant line-style regenerate relies on this ordering to
  // call completeInstant()/captureDataURL() the moment this canvas mounts.
  useLayoutEffect(() => {
    const engine = createSolarSystemEngine(canvasRef.current, {
      planetKeys,
      interactive,
      tracePattern,
      physicalPattern,
      connectAllPlanets,
      showOrbitRings,
      showMoon,
      cinematicIntro,
      startSettled,
      orthographic,
      speedDurationSec,
      totalSimYears,
      traceIntervalDays,
      patternOpacity,
      patternRates,
      startPaused,
      initialSpeedMultiplier,
      miniBodiesIntro,
      miniSunScale,
      miniPlanetScale,
      miniIntroDurationSec,
      miniMotionRampSec,
      initialSunScale,
      initialPlanetScale,
      patternStartDate,
      cosmicSnapshotDate,
      compositionOffsetY,
    });
    engineRef.current = engine;
    if (onComplete) engine.onComplete(onComplete);
    if (onIntroComplete) engine.onIntroComplete(onIntroComplete);
    engine.start();
    return () => engine.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planetKeys.join(',')]);

  useImperativeHandle(ref, () => ({
    getProgress: () => engineRef.current?.getProgress() ?? 0,
    captureDataURL: () => engineRef.current?.captureDataURL(),
    setPaused: (v) => engineRef.current?.setPaused(v),
    setLineStyle: (style) => engineRef.current?.setLineStyle(style),
    setSpeedMultiplier: (value) => engineRef.current?.setSpeedMultiplier(value),
    reset: () => engineRef.current?.reset(),
    completeInstant: () => engineRef.current?.completeInstant(),
  }));

  return (
    <div className={`solar-canvas-wrap ${className ?? ''}`}>
      <canvas ref={canvasRef} className="solar-canvas" />
    </div>
  );
});

export default SolarSystemCanvas;
