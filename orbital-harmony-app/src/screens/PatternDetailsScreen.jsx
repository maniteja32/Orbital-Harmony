import { useMemo, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { GlassButton } from '../components/ui/glasscn/glass-button.jsx';
import { TopNavigationBar } from '../components/TopNavigationBar.jsx';
import { PatternGlyph } from '../components/PatternGlyph.jsx';
import { PLANETS, PLANETS_BY_KEY } from '../data/planets.js';
import { findResonance } from '../utils/resonance.js';
import { computeSimulationPlan } from '../utils/simulationPlan.js';
import { useAppStore } from '../store/useAppStore.js';

/** Screen 7 — Pattern Details: a plain-language description + the
 *  pattern's real generation parameters. Parameters are derived from
 *  computeSimulationPlan (the SAME function that actually generates the
 *  displayed pattern on the Simulation/Result screens, factoring in
 *  detailLevel) rather than the raw resonance math alone — otherwise the
 *  numbers shown here could drift from what was really used whenever the
 *  Celestial Complexity slider wasn't at its default value. (The old
 *  Settings tab — Speed/Density presets — was removed for the same
 *  reason: it edited store fields the live Simulation screen no longer
 *  reads.) The "Did you know?" fact card expands inline below, instead
 *  of navigating to a separate screen. */
export default function PatternDetailsScreen({ onBack, onRegenerate }) {
  const { planetA, planetB, patternMode, detailLevel } = useAppStore();
  const isCosmic = patternMode === 'cosmic';
  const [showKnowledge, setShowKnowledge] = useState(false);
  const facts = useMemo(
    () => PLANETS.map((p) => ({ key: p.key, name: p.name, color: p.color, fact: p.fact })),
    []
  );
  const startIndex = useMemo(() => {
    const i = facts.findIndex((f) => f.key === planetA);
    return i >= 0 ? i : 0;
  }, [facts, planetA]);
  const [factIndex] = useState(startIndex);
  const currentFact = facts[factIndex % facts.length];
  const factPlanet = PLANETS_BY_KEY[currentFact.key];

  const a = planetA ? PLANETS_BY_KEY[planetA] : null;
  const b = planetB ? PLANETS_BY_KEY[planetB] : null;
  const title = a && b ? `${a.name} × ${b.name}` : 'Cosmic Signature';

  const resonance = useMemo(() => {
    if (!a || !b) return null;
    return findResonance(a.orbitalPeriodDays, b.orbitalPeriodDays);
  }, [a, b]);

  const simPlan = useMemo(
    () => computeSimulationPlan({ isCosmic, planetA, planetB, detailLevel }),
    [isCosmic, planetA, planetB, detailLevel]
  );
  const pointsGenerated = Math.round((simPlan.totalSimYears * 365.25) / simPlan.traceIntervalDays);

  const about = a && b
    ? `${a.name} and ${b.name} trace this pattern as they orbit${
        resonance ? ` in a ${resonance.longer}:${resonance.shorter} resonance` : ''
      } — each alignment draws a new chord.`
    : 'This Cosmic Signature connects every planet at your chosen moment into one closed figure.';

  const params = isCosmic
    ? [
        { label: 'Planets Connected', value: '8' },
        { label: 'Total Duration', value: `${simPlan.totalSimYears.toFixed(1)} years` },
        { label: 'Points Generated', value: pointsGenerated.toLocaleString() },
      ]
    : [
        { label: 'Trace Interval', value: `${simPlan.traceIntervalDays.toFixed(1)} days` },
        { label: 'Total Duration', value: `${simPlan.totalSimYears.toFixed(1)} years` },
        { label: 'Points Generated', value: pointsGenerated.toLocaleString() },
      ];

  return (
    <div className="screen screen--details">
      <TopNavigationBar title={title} onBack={onBack} />

      <div className="details-body">
        <section className="detail-card">
          <h2 className="detail-card__title">About this Pattern</h2>
          <p className="detail-card__text">{about}</p>
        </section>

        <section className="detail-card">
          <h2 className="detail-card__title">Parameters</h2>
          <dl className="param-list">
            {params.map((p) => (
              <div className="param-row" key={p.label}>
                <dt>{p.label}</dt>
                <dd>{p.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {!showKnowledge && (
          <button type="button" className="knowledge-link" onClick={() => setShowKnowledge(true)}>
            <Sparkles size={16} strokeWidth={1.8} aria-hidden="true" />
            Did you know?
          </button>
        )}

        {showKnowledge && (
          <div className="knowledge-card">
            <div className="knowledge-card__top">
              <span className="knowledge-card__eyebrow">Did you know?</span>
              <button
                type="button"
                className="knowledge-card__close"
                onClick={() => setShowKnowledge(false)}
                aria-label="Close"
              >
                <X size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div className="knowledge-card__planet">
              <span
                className="knowledge-card__orb"
                style={{ '--planet-color': factPlanet?.color ?? '#8c96ff' }}
                aria-hidden="true"
              >
                <PatternGlyph seedA={5} seedB={factIndex + 2} d={5} size={96} strokeWidth={0.6} />
              </span>
              <span className="knowledge-card__name">{currentFact.name}</span>
            </div>

            <p className="knowledge-card__fact">{currentFact.fact}</p>
          </div>
        )}
      </div>

      <div className="screen__actions">
        <GlassButton tone="primary" className="w-full h-11 text-base font-medium" onClick={onRegenerate}>
          Regenerate
        </GlassButton>
      </div>
    </div>
  );
}
