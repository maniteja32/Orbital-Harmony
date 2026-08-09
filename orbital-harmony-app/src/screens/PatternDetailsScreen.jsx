import { useMemo, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { GlassButton } from '../components/ui/glasscn/glass-button.jsx';
import { TopNavigationBar } from '../components/TopNavigationBar.jsx';
import { PatternGlyph } from '../components/PatternGlyph.jsx';
import { PLANETS, PLANETS_BY_KEY } from '../data/planets.js';
import { computePatternPlan, findResonance } from '../utils/resonance.js';
import { useAppStore } from '../store/useAppStore.js';

/** Screen 7 — Pattern Details: a plain-language description + the
 *  pattern's real generation parameters. (The old Settings tab — Speed/
 *  Density presets — was removed: it edited store fields the live
 *  Simulation screen no longer reads, so it had zero effect on the
 *  actual regenerated pattern.) The "Did you know?" fact card now
 *  expands inline below, instead of navigating to a separate screen. */
export default function PatternDetailsScreen({ onBack, onRegenerate }) {
  const { planetA, planetB } = useAppStore();
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

  const { plan, resonance } = useMemo(() => {
    if (!a || !b) return { plan: null, resonance: null };
    return {
      plan: computePatternPlan(a.orbitalPeriodDays, b.orbitalPeriodDays),
      resonance: findResonance(a.orbitalPeriodDays, b.orbitalPeriodDays),
    };
  }, [a, b]);

  const about = a && b
    ? `This pattern is traced by the orbital motion of ${a.name} and ${b.name}. The ratio between their orbital periods${
        resonance ? ` — a ${resonance.longer}:${resonance.shorter} resonance —` : ''
      } is what shapes this geometry: every time the two planets line up, a new chord is drawn, and those chords weave into the figure you see.`
    : 'This Cosmic Signature is drawn from the positions of all the planets at your chosen moment, connecting them into a single closed figure unique to that date.';

  const params = plan
    ? [
        { label: 'Trace Interval', value: `${plan.traceIntervalDays.toFixed(1)} days` },
        { label: 'Total Duration', value: `${plan.totalSimYears.toFixed(1)} years` },
        { label: 'Points Generated', value: plan.chordCount.toLocaleString() },
      ]
    : [
        { label: 'Planets Connected', value: '8' },
        { label: 'Total Duration', value: '12.0 years' },
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
