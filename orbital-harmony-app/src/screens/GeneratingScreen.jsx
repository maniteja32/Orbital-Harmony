import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { PLANETS_BY_KEY } from '../data/planets.js';
import { useAppStore } from '../store/useAppStore.js';

/** Screen 5 — "Generating". A short transitional step shown right after the
 * user commits their pick (Generate Pattern / Generate Signature): a small
 * orbit preview animates while a progress bar fills 0 → 100 %, then hands
 * off (`onDone`) to the live pattern reveal. Purely presentational — no
 * heavy WebGL; the real simulation runs on the next screen. */
export default function GeneratingScreen({ onDone, onBack }) {
  const { planetA, planetB, patternMode } = useAppStore();
  const isCosmic = patternMode === 'cosmic';
  const planetAData = PLANETS_BY_KEY[planetA];
  const planetBData = PLANETS_BY_KEY[planetB];
  const hasPair = Boolean(planetAData && planetBData);
  const pairTitle = hasPair ? `${planetAData.name} × ${planetBData.name}` : '';
  const colorA = PLANETS_BY_KEY[planetA]?.color ?? '#ffb07a';
  const colorB = PLANETS_BY_KEY[planetB]?.color ?? '#8fb7ff';

  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 600 : 2600;
    const start = performance.now();
    let raf;

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      // Ease so the number ramps up quickly then settles into 100%.
      const eased = 1 - Math.pow(1 - t, 2);
      setProgress(Math.round(eased * 100));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else if (!doneRef.current) {
        doneRef.current = true;
        setTimeout(() => onDoneRef.current?.(), 350);
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isCosmic]);

  return (
    <div className="screen screen--generating">
      <div className="mode-topbar">
        {onBack && (
          <button type="button" className="back-button" onClick={onBack} aria-label="Cancel and go back">
            <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
            Back
          </button>
        )}
      </div>

      <div className="screen__header">
        <h1 className="screen__title">Orbital Harmony</h1>
        <p className="screen__subtitle">Discover the hidden patterns of planetary motion.</p>
      </div>

      <div className="gen-body">
        <h1 className="gen-title">{isCosmic ? 'Creating your cosmic signature…' : 'Creating your pattern…'}</h1>
        {!isCosmic && hasPair && <p className="gen-pair-title">{pairTitle}</p>}

        <div className="gen-orbit" aria-hidden="true">
          <span className="gen-orbit__ring gen-orbit__ring--outer" />
          <span className="gen-orbit__ring gen-orbit__ring--inner" />
          <span className="gen-orbit__core" />
          <span className="gen-orbit__planet gen-orbit__planet--a">
            <i style={{ background: colorA, boxShadow: `0 0 10px 1px ${colorA}` }} />
          </span>
          <span className="gen-orbit__planet gen-orbit__planet--b">
            <i style={{ background: colorB, boxShadow: `0 0 10px 1px ${colorB}` }} />
          </span>
        </div>

        <p className="gen-hint">
          {isCosmic
            ? 'Please wait while we calculate the planetary arrangement for your birth moment.'
            : 'Please wait while we simulate planetary motion.'}
        </p>

        <div className="gen-progress">
          <div className="progress-bar">
            <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="gen-progress__pct">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
