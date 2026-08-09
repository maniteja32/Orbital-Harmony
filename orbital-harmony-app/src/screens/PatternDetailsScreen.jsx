import { useMemo } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { GlassButton } from '../components/ui/glasscn/glass-button.jsx';
import { PLANETS_BY_KEY } from '../data/planets.js';
import { computePatternPlan, findResonance } from '../utils/resonance.js';
import { useAppStore } from '../store/useAppStore.js';

/** Screen 7 — Pattern Details: a plain-language description + the
 *  pattern's real generation parameters. (The old Settings tab — Speed/
 *  Density presets — was removed: it edited store fields the live
 *  Simulation screen no longer reads, so it had zero effect on the
 *  actual regenerated pattern.) */
export default function PatternDetailsScreen({ onBack, onRegenerate, onKnowledge }) {
  const { planetA, planetB } = useAppStore();

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
        { label: 'Simulation Speed', value: '1.0×' },
        { label: 'Trace Interval', value: `${plan.traceIntervalDays.toFixed(1)} days` },
        { label: 'Total Duration', value: `${plan.totalSimYears.toFixed(1)} years` },
        { label: 'Points Generated', value: plan.chordCount.toLocaleString() },
      ]
    : [
        { label: 'Simulation Speed', value: '1.0×' },
        { label: 'Planets Connected', value: '8' },
        { label: 'Total Duration', value: '12.0 years' },
      ];

  return (
    <div className="screen screen--details">
      <div className="mode-topbar">
        <button
          type="button"
          className="back-button back-button--icon"
          onClick={onBack}
          aria-label="Back to your pattern"
        >
          <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="screen__header screen__header--mode">
        <h1>{title}</h1>
      </div>

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

        <button type="button" className="knowledge-link" onClick={onKnowledge}>
          <Sparkles size={16} strokeWidth={1.8} aria-hidden="true" />
          Did you know?
        </button>
      </div>

      <div className="screen__actions">
        <GlassButton tone="primary" className="w-full h-11 text-base font-medium" onClick={onRegenerate}>
          Regenerate
        </GlassButton>
      </div>
    </div>
  );
}
