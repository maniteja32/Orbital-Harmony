import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Info, Share2 } from 'lucide-react';
import { GlassButton } from '../components/ui/glasscn/glass-button.jsx';
import { LiquidGlass } from '../components/ui/glasscn/liquid-glass.jsx';
import { TopNavigationBar } from '../components/TopNavigationBar.jsx';
import { LineStyleToggleButton } from '../components/LineStyleToggle.jsx';
import SolarSystemCanvas from '../components/SolarSystemCanvas.jsx';
import { PLANETS_BY_KEY } from '../data/planets.js';
import { formatCosmicSignatureDate } from '../utils/cosmicSignature.js';
import { createLocalDateStory } from '../utils/dateStory.js';
import { loadBirthdayTrivia, loadPlanetTrivia } from '../services/triviaService.js';
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

// The captured pattern snapshot isn't guaranteed to be square (the WebGL
// canvas is sized off its container, which can be taller than wide) — the
// on-screen card only LOOKS square because CSS crops it via `aspect-ratio:
// 1/1` + `object-fit: cover`. Stretching that source straight into a
// square destination (plain drawImage) squashes the circular pattern into
// an oval. This reproduces the same centered crop-not-stretch behavior.
function drawImageCover(ctx, image, dx, dy, dSize) {
  const sw = image.naturalWidth || image.width;
  const sh = image.naturalHeight || image.height;
  const cropSize = Math.min(sw, sh);
  const sx = (sw - cropSize) / 2;
  const sy = (sh - cropSize) / 2;
  ctx.drawImage(image, sx, sy, cropSize, cropSize, dx, dy, dSize, dSize);
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

// Reference dimensions the on-screen title + result-frame are styled at
// (see .topbar-title / .result-frame in index.css) — every exported
// size below is this same layout scaled up to the captured pattern's
// real width. The header itself is deliberately snug (not the full
// 44px topbar + 18px gap the on-screen layout uses) so the title sits
// close above the card instead of floating in empty space.
const REFERENCE_CARD_WIDTH = 350;
const REFERENCE_HEADER_TOP_PADDING = 20;
const REFERENCE_HEADER_BOTTOM_PADDING = 12;
const REFERENCE_TITLE_FONT_SIZE = 18;
const REFERENCE_CARD_RADIUS = 24;

/** Reproduces the on-screen top-bar title + rounded result card (same
 *  fonts and corner radius as index.css) as a single flat image for
 *  sharing/downloading — everything except the back button and border,
 *  and the pattern itself is drawn at its native captured resolution
 *  with no extra scaling. */
async function composeShareImageDataUrl(sourceDataUrl, title, subtitle = '') {
  const image = await loadImage(sourceDataUrl);
  // Match the on-screen square crop exactly: use the smaller of the two
  // captured dimensions so the export never stretches OR upscales past
  // what was actually captured.
  const width = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const scale = width / REFERENCE_CARD_WIDTH;

  const topPadding = Math.round(REFERENCE_HEADER_TOP_PADDING * scale);
  const bottomPadding = Math.round(REFERENCE_HEADER_BOTTOM_PADDING * scale);
  const titleFontSize = Math.round(REFERENCE_TITLE_FONT_SIZE * scale);
  const titleBlockHeight = Math.round(titleFontSize * 1.3);
  const cornerRadius = Math.round(REFERENCE_CARD_RADIUS * scale);

  const subtitleFontSize = Math.round(14 * scale);
  const subtitleBlockHeight = subtitle ? Math.round(24 * scale) : 0;
  const headerHeight = topPadding + titleBlockHeight + subtitleBlockHeight + bottomPadding;

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
  drawWrappedText(ctx, title, width / 2, topPadding + titleBlockHeight / 2, width * 0.88, titleFontSize * 1.3, 2);

  if (subtitle) {
    await ensureFontLoaded(`600 ${subtitleFontSize}px 'Funnel Display'`);
    ctx.fillStyle = '#f5f6fa';
    ctx.font = `600 ${subtitleFontSize}px 'Funnel Display', -apple-system, sans-serif`;
    ctx.fillText(subtitle, width / 2, topPadding + titleBlockHeight + subtitleBlockHeight / 2);
  }

  // Rounded card — same corner radius as the live .result-frame —
  // containing the pattern center-cropped to a square (never stretched)
  // at its full captured resolution. No border/rim on the export.
  const cardY = headerHeight;
  ctx.save();
  roundedRectPath(ctx, 0, cardY, width, width, cornerRadius);
  ctx.clip();
  drawImageCover(ctx, image, 0, cardY, width);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

function sanitizeFileName(input) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function DateStoryCard({ story }) {
  const insight = story?.insight;
  if (!insight) return null;

  return (
    <section
      className="knowledge-card knowledge-card--compact knowledge-card--date-story"
      key={story.id}
      aria-label={story.title}
    >
      <span className="sr-only" role="status" aria-live="polite">New date insight loaded.</span>
      <div className="date-story__panel">
        <span className="date-story__kicker">{insight.kicker}</span>
        <span className="date-story__headline">{insight.headline}</span>
        {insight.meta && <span className="date-story__meta">{insight.meta}</span>}
        <p className="knowledge-card__fact date-story__fact">{insight.fact}</p>
        {insight.href ? (
          <a
            className="date-story__source"
            href={insight.href}
            target="_blank"
            rel="noreferrer"
          >
            {insight.source}
            <ExternalLink size={11} strokeWidth={2} aria-hidden="true" />
          </a>
        ) : (
          <span className="date-story__source date-story__source--local">{insight.source}</span>
        )}
      </div>
    </section>
  );
}

/** Screen 6 — final pattern with selected planets. */
export default function ResultScreen({ onGenerateNew, onBack, onViewDetails }) {
  const {
    planetA, planetB, speed, detailLevel, snapshot, setSnapshot,
    resultFactoid, resetForNewPattern, patternMode, cosmicDate, lineStyle, setLineStyle,
  } = useAppStore();
  const isCosmic = patternMode === 'cosmic';
  const planetAData = PLANETS_BY_KEY[planetA];
  const planetBData = PLANETS_BY_KEY[planetB];
  const hasPair = Boolean(planetAData && planetBData);
  const title = isCosmic
    ? 'Cosmic Signature'
    : hasPair
      ? `${planetAData.name} × ${planetBData.name}`
      : 'Orbital Pattern';
  const cosmicDateLabel = formatCosmicSignatureDate(cosmicDate);
  const speedCfg = SPEED_PRESETS[speed];
  const localDateStory = useMemo(() => createLocalDateStory(cosmicDate), [cosmicDate]);
  const [dateStory, setDateStory] = useState(localDateStory);

  useEffect(() => {
    if (!isCosmic) return undefined;
    const controller = new AbortController();
    setDateStory(localDateStory);

    loadBirthdayTrivia(cosmicDate, { signal: controller.signal })
      .then(setDateStory)
      .catch(() => {
        // No card is shown when remote date history is unavailable.
      });

    return () => controller.abort();
  }, [cosmicDate, isCosmic, localDateStory]);

  const fallbackFactoid = useMemo(() => {
    return {
      title: 'Fun facts',
      entries: [planetAData, planetBData]
        .filter(Boolean)
        .map((planet) => ({ name: planet.name, emoji: '🪐', fact: planet.fact })),
    };
  }, [planetAData, planetBData]);
  const localExploreFactoid = resultFactoid ?? fallbackFactoid;
  const [exploreFactoid, setExploreFactoid] = useState(localExploreFactoid);

  useEffect(() => {
    if (isCosmic) return undefined;
    const controller = new AbortController();
    setExploreFactoid(localExploreFactoid);

    loadPlanetTrivia({
      planetKeys: [planetA, planetB],
      fallbackFactoid: localExploreFactoid,
      signal: controller.signal,
    })
      .then(setExploreFactoid)
      .catch(() => {
        // The local factoid is already visible and remains the offline fallback.
      });

    return () => controller.abort();
  }, [isCosmic, localExploreFactoid, planetA, planetB]);

  const displayedFactoid = isCosmic ? null : exploreFactoid;
  const factEntries = displayedFactoid?.entries ?? [];
  const factTitle = displayedFactoid?.title;

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
      downloadDataUrl(shareImage, imageFilename);
    } catch (error) {
      if (error?.name !== 'AbortError') downloadDataUrl(shareImage, imageFilename);
    }
  }, [snapshot, title, isCosmic, cosmicDateLabel, imageFilename, shareTitle]);

  return (
    <div className={`screen screen--result${isCosmic ? ' screen--result--cosmic' : ''}`}>
      <TopNavigationBar title={isCosmic ? 'Cosmic Signature' : title} onBack={onBack} />
      {isCosmic && (
        <p className="screen-intro">Planets aligned to your date of birth</p>
      )}

      <LiquidGlass className="result-frame rounded-[24px] w-full bg-white/[0.05]" style={RESULT_FRAME_RIM}>
        {isCosmic && (
          <p className="result-frame__date-overlay">{cosmicDateLabel || 'No date'}</p>
        )}
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

      {isCosmic ? (
        <DateStoryCard story={dateStory} />
      ) : factEntries.length > 0 && (
        <div className="knowledge-card knowledge-card--compact" key={displayedFactoid.id}>
          <span className="knowledge-card__title">
            {factTitle}
          </span>
          <div className="knowledge-card__body">
            {factEntries.map((entry) => (
              <div className="knowledge-card__entry" key={entry.name}>
                <p className="knowledge-card__fact">
                  <span className="knowledge-card__entry-title">
                    {entry.name}:
                  </span>{' '}
                  {entry.fact}
                </p>
              </div>
            ))}
          </div>
          {displayedFactoid.sources?.length > 0 && (
            <div className="knowledge-card__sources" aria-label="Fact sources">
              <span>{displayedFactoid.sourceLabel ?? 'Wikipedia · CC BY-SA'}</span>
              {displayedFactoid.sources.map((source) => (
                <a href={source.href} target="_blank" rel="noreferrer" key={source.name}>
                  {source.name}
                  <ExternalLink size={10} strokeWidth={2} aria-hidden="true" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {isCosmic ? (
        <div className="result-actions result-actions--cosmic">
          <div className="result-actions__primary-row">
            <GlassButton tone="primary" className="w-full h-12 text-base font-medium" onClick={handleGenerateNew}>
              Generate New Signature
            </GlassButton>
          </div>

          <div className="result-actions__compact-row" aria-label="Secondary actions">
            <button
              type="button"
              className="back-button back-button--icon result-actions__icon--cosmic-share"
              onClick={nativeShare}
              aria-label="Share signature"
            >
              <Share2 size={24} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <div className="result-actions">
          <div className="result-actions__primary-row">
            <LineStyleToggleButton lineStyle={lineStyle} onChange={handleLineStyleChange} className="result-actions__icon--secondary" />
            <button
              type="button"
              className="back-button back-button--icon result-actions__icon--primary"
              onClick={nativeShare}
              aria-label="Share this pattern"
            >
              <Share2 size={28} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="back-button back-button--icon result-actions__icon--secondary"
              onClick={onViewDetails}
              aria-label="View details"
            >
              <Info size={24} strokeWidth={2} aria-hidden="true" />
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
