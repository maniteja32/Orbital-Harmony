import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Heart, Share2 } from 'lucide-react';
import { GlassButton } from '../components/ui/glasscn/glass-button.jsx';
import { LiquidGlass } from '../components/ui/glasscn/liquid-glass.jsx';
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

// Same specular-rim look as every other glass card in the app (see
// SimulationScreen's TUNE_RIM / SolarSystemScreen's MODE_RIM) so the
// pattern frame's border reads as part of the same design system instead
// of a plain flat border.
const RESULT_FRAME_RIM = {
  '--liquid-glass-rim-width': '0.8px',
  '--liquid-glass-rim-light': 'rgba(255, 255, 255, 0.4)',
};

function downloadDataUrl(dataUrl, filename) {
  if (!dataUrl) return;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function dataUrlToFile(dataUrl, filename) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/png' });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function drawWrappedText(ctx, text, centerX, startY, maxWidth, lineHeight, maxLines = 2) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(nextLine).width <= maxWidth || !currentLine) {
      currentLine = nextLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }

    if (lines.length === maxLines - 1) break;
  }

  if (currentLine) lines.push(currentLine);
  const clampedLines = lines.slice(0, maxLines);

  if (lines.length > maxLines) {
    const lastIndex = clampedLines.length - 1;
    let clipped = clampedLines[lastIndex];
    while (clipped && ctx.measureText(`${clipped}…`).width > maxWidth) {
      clipped = clipped.slice(0, -1).trimEnd();
    }
    clampedLines[lastIndex] = `${clipped}…`;
  }

  const firstLineY = startY - ((clampedLines.length - 1) * lineHeight) / 2;
  clampedLines.forEach((line, index) => {
    ctx.fillText(line, centerX, firstLineY + index * lineHeight);
  });
}

function roundedRectPath(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function ensureFontLoaded(fontShorthand) {
  if (!document.fonts) return;
  try {
    await document.fonts.load(fontShorthand);
    await document.fonts.ready;
  } catch {
    /* best effort — falls back to whatever the browser has ready */
  }
}

// Reference dimensions the on-screen topbar title + result-frame are
// styled at (see .topbar-title / .result-frame / .screen's 18px gap in
// index.css) — every exported size below is this same layout scaled up
// to the captured pattern's real width, so the export is a faithful
// reproduction of the on-screen card instead of an invented one.
const REFERENCE_CARD_WIDTH = 350;
const REFERENCE_TOPBAR_HEIGHT = 44;
const REFERENCE_SCREEN_GAP = 18;
const REFERENCE_TITLE_FONT_SIZE = 18;
const REFERENCE_CARD_RADIUS = 24;
const REFERENCE_RIM_WIDTH = 0.8;

/** Reproduces the on-screen top-bar title + rounded/bordered result card
 *  (same fonts, proportions and corner radius as index.css) as a single
 *  flat image for sharing/downloading — everything except the back
 *  button, and the pattern itself is drawn at its native captured
 *  resolution with no extra scaling. */
async function composeShareImageDataUrl(sourceDataUrl, title, subtitle = '') {
  const image = await loadImage(sourceDataUrl);
  const width = image.naturalWidth || image.width;
  const scale = width / REFERENCE_CARD_WIDTH;

  const topbarHeight = Math.round(REFERENCE_TOPBAR_HEIGHT * scale);
  const gap = Math.round(REFERENCE_SCREEN_GAP * scale);
  const titleFontSize = Math.round(REFERENCE_TITLE_FONT_SIZE * scale);
  const cornerRadius = Math.round(REFERENCE_CARD_RADIUS * scale);
  const rimWidth = Math.max(1, REFERENCE_RIM_WIDTH * scale);

  const subtitleFontSize = Math.round(14 * scale);
  const subtitleBlockHeight = subtitle ? Math.round(30 * scale) : 0;
  const headerHeight = topbarHeight + subtitleBlockHeight + gap;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = headerHeight + width;

  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceDataUrl;

  // Same near-black page background the app is styled on (--bg), so the
  // header reads as part of one continuous scene, not a bar stuck on top.
  ctx.fillStyle = '#030308';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await ensureFontLoaded(`400 ${titleFontSize}px Syncopate`);
  ctx.fillStyle = '#f5f6fa';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `400 ${titleFontSize}px Syncopate, 'Funnel Display', -apple-system, sans-serif`;
  drawWrappedText(ctx, title, width / 2, topbarHeight / 2, width * 0.88, titleFontSize * 1.3, 2);

  if (subtitle) {
    await ensureFontLoaded(`600 ${subtitleFontSize}px 'Funnel Display'`);
    ctx.fillStyle = '#f5f6fa';
    ctx.font = `600 ${subtitleFontSize}px 'Funnel Display', -apple-system, sans-serif`;
    ctx.fillText(subtitle, width / 2, topbarHeight + subtitleBlockHeight / 2);
  }

  // Rounded, bordered card — same corner radius and specular rim as the
  // live .result-frame — containing the pattern at its full captured
  // resolution (drawImage source/destination sizes match exactly, so
  // nothing is rescaled or resampled).
  const cardY = headerHeight;
  ctx.save();
  roundedRectPath(ctx, 0, cardY, width, width, cornerRadius);
  ctx.clip();
  ctx.drawImage(image, 0, cardY, width, width);
  ctx.restore();

  ctx.save();
  roundedRectPath(ctx, rimWidth / 2, cardY + rimWidth / 2, width - rimWidth, width - rimWidth, cornerRadius);
  ctx.lineWidth = rimWidth;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.stroke();
  ctx.restore();

  return canvas.toDataURL('image/png');
}

function sanitizeFileName(input) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

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
  const factEntries = useMemo(() => {
    return [planetAData, planetBData]
      .filter(Boolean)
      .map((planet) => ({ name: planet.name, fact: planet.fact }));
  }, [planetAData, planetBData]);

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

  const shareTitle = isCosmic
    ? `Space Harmony — Cosmic Signature${cosmicDateLabel ? ` · ${cosmicDateLabel}` : ''}`
    : `Space Harmony — ${title}`;

  const imageFilename = `${sanitizeFileName(title || 'cosmic-signature')}.png`;

  const nativeShare = useCallback(async () => {
    if (!snapshot) return;
    let shareImage = snapshot;
    try {
      shareImage = await composeShareImageDataUrl(snapshot, title, isCosmic ? cosmicDateLabel : '');
    } catch {
      shareImage = snapshot;
    }
    if (!navigator.share) {
      // Fallback for environments without Web Share support.
      downloadDataUrl(shareImage, imageFilename);
      return;
    }
    try {
      const file = await dataUrlToFile(shareImage, imageFilename);
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: shareTitle, text: shareTitle, files: [file] });
        return;
      }
      await navigator.share({ title: shareTitle, text: shareTitle });
    } catch {
      /* dismissed / unsupported */
    }
  }, [snapshot, title, isCosmic, cosmicDateLabel, imageFilename, shareTitle]);

  return (
    <div className="screen screen--result">
      <TopNavigationBar title={isCosmic ? 'Cosmic Signature' : title} onBack={onBack} />

      {isCosmic && (
        <div className="screen__header screen__header--mode">
          <p className="result-date">{cosmicDateLabel || 'Date unavailable'}</p>
          <p className="result-description">Generated from the planetary arrangement on your birth date.</p>
        </div>
      )}

      <LiquidGlass className="result-frame rounded-[24px] w-full bg-white/[0.05]" style={RESULT_FRAME_RIM}>
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
            miniPlanetScale={1.5}
            miniIntroDurationSec={1}
            miniMotionRampSec={2.6}
            initialSunScale={0.5}
            initialPlanetScale={1.5}
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
      </LiquidGlass>

      {!isCosmic && (
        <div className="knowledge-card knowledge-card--compact">
          <span className="knowledge-card__title">Fun fact</span>
          <div className="knowledge-card__body">
            {factEntries.map((entry) => (
              <div className="knowledge-card__entry" key={entry.name}>
                <span className="knowledge-card__entry-title">{entry.name}</span>
                <p className="knowledge-card__fact">{entry.fact}</p>
              </div>
            ))}
          </div>
        </div>
      )}

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
                onClick={nativeShare}
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
              onClick={nativeShare}
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
