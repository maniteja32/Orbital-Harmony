import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createSolarSystemEngine } from '../engine/solarSystemEngine.js';

/**
 * Thin React wrapper around the framework-agnostic Three.js engine.
 * Exposes an imperative handle ({ getProgress, captureDataURL, setPaused,
 * setLineStyle, setSpeedMultiplier }) so parent screens (Simulation/Reveal/
 * Result) can poll progress, grab a snapshot, and drive play/pause, trace
 * line style, and a live playback-speed multiplier without re-rendering
 * the whole canvas subtree.
 */
const SolarSystemCanvas = forwardRef(function SolarSystemCanvas(
  {
    planetKeys,
    interactive = false,
    tracePattern = false,
    showOrbitRings = true,
    cinematicIntro = false,
    orthographic = false,
    speedDurationSec,
    totalSimYears,
    traceIntervalDays,
    startPaused,
    initialSpeedMultiplier,
    onComplete,
    onIntroComplete,
    className,
  },
  ref
) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  useEffect(() => {
    const engine = createSolarSystemEngine(canvasRef.current, {
      planetKeys,
      interactive,
      tracePattern,
      showOrbitRings,
      cinematicIntro,
      orthographic,
      speedDurationSec,
      totalSimYears,
      traceIntervalDays,
      startPaused,
      initialSpeedMultiplier,
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
  }));

  return (
    <div className={`solar-canvas-wrap ${className ?? ''}`}>
      <canvas ref={canvasRef} className="solar-canvas" />
    </div>
  );
});

export default SolarSystemCanvas;
