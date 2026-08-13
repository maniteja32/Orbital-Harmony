import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createSolarSystemEngine } from '../engine/solarSystemEngine.js';

const WEBGL_RELOAD_KEY = 'space-harmony:webgl-reload';

function requestSingleReload() {
  try {
    const lastReload = Number(sessionStorage.getItem(WEBGL_RELOAD_KEY) || 0);
    if (Date.now() - lastReload > 15000) {
      sessionStorage.setItem(WEBGL_RELOAD_KEY, String(Date.now()));
      window.location.reload();
    }
  } catch {
    window.location.reload();
  }
}

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
  const [engineVersion, setEngineVersion] = useState(0);
  const [fatalError, setFatalError] = useState(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const handleContextLost = (event) => {
      event.preventDefault();
      setFatalError('Graphics context lost. Reload to recover.');
      requestSingleReload();
    };

    canvas.addEventListener('webglcontextlost', handleContextLost, { passive: false });
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
    };
  }, []);

  // useLayoutEffect (not useEffect) so engineRef.current is guaranteed set
  // before any PARENT layout effect runs in the same commit — Result
  // screen's instant line-style regenerate relies on this ordering to
  // call completeInstant()/captureDataURL() the moment this canvas mounts.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let engine;
    try {
      engine = createSolarSystemEngine(canvas, {
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
      setFatalError(null);
    } catch (error) {
      console.error('Failed to initialize solar system engine:', error);
      setFatalError('Unable to start graphics engine.');
      engineRef.current = null;
      return undefined;
    }

    return () => {
      try {
        engine?.destroy();
      } catch (error) {
        console.error('Failed to destroy solar system engine cleanly:', error);
      }
      if (engineRef.current === engine) engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planetKeys.join(','), engineVersion]);

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
      {fatalError && (
        <div className="canvas-fatal" role="alert">
          <p>{fatalError}</p>
          <button
            type="button"
            onClick={() => {
              setFatalError(null);
              setEngineVersion((v) => v + 1);
            }}
          >
            Retry Graphics
          </button>
        </div>
      )}
    </div>
  );
});

export default SolarSystemCanvas;
