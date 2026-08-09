import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Heart, Share2 } from 'lucide-react';
import { GlassButton } from '../components/ui/glasscn/glass-button.jsx';
import { TopNavigationBar } from '../components/TopNavigationBar.jsx';
import { LineStyleToggleButton } from '../components/LineStyleToggle.jsx';
import SolarSystemCanvas from '../components/SolarSystemCanvas.jsx';
import { PLANETS_BY_KEY } from '../data/planets.js';
import { formatCosmicSignatureDate } from '../utils/cosmicSignature.js';
import { computeSimulationPlan } from '../utils/simulationPlan.js';
import { useAppStore, SPEED_PRESETS } from '../store/useAppStore.js';

// Fast enough that regenerating the ALREADY-KNOWN pattern (just to bake in
// a newly picked line style) finishes in well under the original reveal's
// duration, instead of replaying the full multi-second first reveal.
const REGENERATE_SPEED_MULTIPLIER = 60;

/** Screen 6 — final pattern with selected planets.
 *  Save/Share live as top-bar icons; "View Details" opens the info/controls
 *  screen and "Generate New Pattern" restarts the flow. */
export default function ResultScreen({ onGenerateNew, onBack, onViewDetails, onShare, onSave }) {
  const {
    planetA, planetB, speed, detailLevel, snapshot, setSnapshot,
    resetForNewPattern, patternMode, cosmicDate, lineStyle, setLineStyle,
  } = useAppStore();
  const isCosmic = patternMode === 'cosmic';
  const planetAData = PLANETS_BY_KEY[planetA];
  const planetBData = PLANETS_BY_KEY[planetB];
  const hasPair = Boolean(planetAData && planetBData);
  const title = hasPair ? `${planetAData.name} × ${planetBData.name}` : 'Cosmic Signature';
  const cosmicDateLabel = formatCosmicSignatureDate(cosmicDate);
  const speedCfg = SPEED_PRESETS[speed];

  // Same plan the original SimulationScreen reveal used (see
  // computeSimulationPlan) — reproducing it here lets the line-style
  // toggle below actually redraw the displayed pattern instead of just
  // setting a preference for the NEXT pattern.
  const plan = useMemo(
    () => computeSimulationPlan({ isCosmic, planetA, planetB, detailLevel }),
    [isCosmic, planetA, planetB, detailLevel],
  );

  const canvasRef = useRef(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenKey, setRegenKey] = useState(0);
  // Explore's non-cosmic chord trace is the only path this can quickly
  // regenerate (Cosmic Signature's intro hold/settle timers run in real
  // seconds regardless of speed multiplier, so it wouldn't actually be
  // quick) — for cosmic, the toggle still updates the shared preference
  // for the next pattern, it just can't repaint this already-captured one.
  const canRegenerate = !isCosmic && hasPair;

  const handleLineStyleChange = useCallback((nextStyle) => {
    setLineStyle(nextStyle);
    if (!canRegenerate) return;
    setRegenKey((k) => k + 1);
    setRegenerating(true);
  }, [setLineStyle, canRegenerate]);

  useEffect(() => {
    if (regenerating) canvasRef.current?.setLineStyle(lineStyle);
  }, [regenerating, regenKey, lineStyle]);

  const handleRegenerateComplete = useCallback(() => {
    const dataUrl = canvasRef.current?.captureDataURL();
    if (dataUrl) setSnapshot(dataUrl);
    setRegenerating(false);
  }, [setSnapshot]);

  function handleGenerateNew() {
    resetForNewPattern();
    onGenerateNew();
  }

  return (
    <div className="screen screen--result">
      <TopNavigationBar title={isCosmic ? 'Cosmic Signature' : title} onBack={onBack} />

      {isCosmic && (
        <div className="screen__header screen__header--mode">
          <p className="result-date">{cosmicDateLabel || 'Date unavailable'}</p>
          <p className="result-description">Generated from the planetary arrangement on your birth date.</p>
        </div>
      )}

      <div className="result-frame">
        {regenerating ? (
          <SolarSystemCanvas
            key={regenKey}
            ref={canvasRef}
            planetKeys={plan.planetKeys}
            tracePattern
            physicalPattern={plan.physicalPattern}
            connectAllPlanets={false}
            startPaused={false}
            miniBodiesIntro
            miniSunScale={0.5}
            miniPlanetScale={0.8}
            miniIntroDurationSec={1}
            miniMotionRampSec={2.6}
            speedDurationSec={speedCfg.durationSec}
            totalSimYears={plan.totalSimYears}
            traceIntervalDays={plan.traceIntervalDays}
            patternOpacity={plan.patternOpacity}
            patternRates={plan.patternRates}
            initialSpeedMultiplier={REGENERATE_SPEED_MULTIPLIER}
            patternStartDate={cosmicDate ?? undefined}
            onComplete={handleRegenerateComplete}
            className="screen__canvas"
          />
        ) : snapshot ? (
          <img src={snapshot} alt={title} />
        ) : (
          <div className="result-frame__placeholder" />
        )}
      </div>

      {isCosmic ? (
        <div className="result-actions result-actions--cosmic">
          <div className="result-actions__compact-row" aria-label="Secondary actions">
            <div className="select-actions__button">
              <GlassButton
                tone="secondary"
                className="w-full h-11 text-base font-medium"
                onClick={onSave}
                aria-label="Save signature"
              >
                <Heart size={16} strokeWidth={2} aria-hidden="true" />
                Save
              </GlassButton>
            </div>
            <div className="select-actions__button">
              <GlassButton
                tone="secondary"
                className="w-full h-11 text-base font-medium"
                onClick={onShare}
                aria-label="Share signature"
              >
                <Share2 size={16} strokeWidth={2} aria-hidden="true" />
                Share
              </GlassButton>
            </div>
          </div>

          <div className="result-actions__primary-row">
            <GlassButton tone="primary" className="w-full h-11 text-base font-medium" onClick={handleGenerateNew}>
              Generate New Signature
            </GlassButton>
          </div>
        </div>
      ) : (
        <div className="result-actions">
          <div className="result-actions__primary-row">
            <GlassButton
              tone="primary"
              className="w-full h-11 text-base font-medium"
              onClick={onViewDetails}
            >
              View Details
            </GlassButton>
            <LineStyleToggleButton lineStyle={lineStyle} onChange={handleLineStyleChange} />
            <button
              type="button"
              className="back-button back-button--icon"
              onClick={onShare}
              aria-label="Share this pattern"
            >
              <Share2 size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <button type="button" className="btn-frosted-pill" onClick={handleGenerateNew}>
            Generate New Pattern
          </button>
        </div>
      )}
    </div>
  );
}
