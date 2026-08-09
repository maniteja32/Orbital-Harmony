import { useMemo } from 'react';
import { GlassButton } from '../components/ui/glasscn/glass-button.jsx';
import { TopNavigationBar } from '../components/TopNavigationBar.jsx';
import { PLANETS_BY_KEY } from '../data/planets.js';
import { findResonance } from '../utils/resonance.js';
import { computeSimulationPlan } from '../utils/simulationPlan.js';
import { useAppStore } from '../store/useAppStore.js';

/** Screen 7 — Pattern Details: a plain-language description of the
 *  pattern. The generation Parameters live here, one tap earlier than the
 *  result view, so the pattern summary and its tuning details stay together. */
export default function PatternDetailsScreen({ onBack, onRegenerate }) {
  const { planetA, planetB, patternMode, detailLevel } = useAppStore();
  const a = planetA ? PLANETS_BY_KEY[planetA] : null;
  const b = planetB ? PLANETS_BY_KEY[planetB] : null;
  const title = a && b ? `${a.name} × ${b.name}` : 'Cosmic Signature';
  const plan = useMemo(
    () => computeSimulationPlan({ isCosmic: patternMode === 'cosmic', planetA, planetB, detailLevel }),
    [patternMode, planetA, planetB, detailLevel],
  );
  const isCosmic = patternMode === 'cosmic';
  const params = patternMode === 'cosmic'
    ? [
        { label: 'Planets Connected', value: '8' },
        { label: 'Total Duration', value: `${plan.totalSimYears.toFixed(1)} years` },
      ]
    : [
        { label: 'Trace Interval', value: `${plan.traceIntervalDays.toFixed(1)} days` },
        { label: 'Total Duration', value: `${plan.totalSimYears.toFixed(1)} years` },
      ];

  const resonance = useMemo(() => {
    if (!a || !b) return null;
    return findResonance(a.orbitalPeriodDays, b.orbitalPeriodDays);
  }, [a, b]);

  const generationSummary = isCosmic
    ? 'This screen uses the full planetary set and samples the system across the chosen date window. Each pass through the simulation adds a new path segment, and repeated passes build the final layered shape.'
    : 'This pattern is produced by simulating the selected pair over a fixed time span. The app samples their orbital positions at regular intervals and draws a chord each time the geometry aligns.';

  const whyItLooksLikeThis = isCosmic
    ? 'Cosmic Signature patterns are denser because all eight planets are part of the same capture. That increases overlap, which makes the final image feel richer and more complex.'
    : resonance
      ? `The ${resonance.longer}:${resonance.shorter} resonance keeps the motion repeating in a stable rhythm, so the chord lines stack into a clear geometric form.`
      : 'When two planets do not lock into a simple resonance, the chord lines drift more slowly and the pattern becomes broader and more open.';

  return (
    <div className="screen screen--details">
      <TopNavigationBar title={title} onBack={onBack} />

      <div className="details-body">
        <section className="detail-card">
          <h2 className="detail-card__title">How it is built</h2>
          <p className="detail-card__text">{generationSummary}</p>
        </section>

        <section className="detail-card">
          <h2 className="detail-card__title">Why it looks this way</h2>
          <p className="detail-card__text">{whyItLooksLikeThis}</p>
        </section>

        <section className="detail-card">
          <h2 className="detail-card__title">Live parameters</h2>
          <p className="detail-card__text">
            These values come from the current selection and determine the final geometry of the pattern.
          </p>
          <dl className="param-list">
            {params.map((p) => (
              <div className="param-row" key={p.label}>
                <dt>{p.label}</dt>
                <dd>{p.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="screen__actions">
        <GlassButton tone="primary" className="w-full h-12 text-base font-medium" onClick={onRegenerate}>
          Regenerate
        </GlassButton>
      </div>
    </div>
  );
}
