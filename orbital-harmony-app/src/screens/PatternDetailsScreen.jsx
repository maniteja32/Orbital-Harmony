import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { TopNavigationBar } from '../components/TopNavigationBar.jsx';
import { PLANETS_BY_KEY } from '../data/planets.js';
import { createPatternIntelligence } from '../utils/patternIntelligence.js';
import { useAppStore } from '../store/useAppStore.js';

/** Screen 7 — Pattern Details: a plain-language description of the
 *  pattern. The generation Parameters live here, one tap earlier than the
 *  result view, so the pattern summary and its tuning details stay together. */
export default function PatternDetailsScreen({ onBack }) {
  const { planetA, planetB, patternMode, detailLevel, lineStyle, cosmicDate } = useAppStore();
  const a = planetA ? PLANETS_BY_KEY[planetA] : null;
  const b = planetB ? PLANETS_BY_KEY[planetB] : null;
  const title = patternMode === 'cosmic'
    ? 'Cosmic Signature'
    : a && b
      ? `${a.name} × ${b.name}`
      : 'Orbital Pattern';
  const intelligence = useMemo(
    () => createPatternIntelligence({ patternMode, planetA, planetB, detailLevel, lineStyle, cosmicDate }),
    [cosmicDate, detailLevel, lineStyle, patternMode, planetA, planetB],
  );

  return (
    <div className="screen screen--details">
      <TopNavigationBar title={title} onBack={onBack} />

      <div className="details-body">
        <section className="pattern-overview">
          <span className="pattern-overview__eyebrow">{intelligence.eyebrow}</span>
          <h2 className="pattern-overview__title">{intelligence.headline}</h2>
          <p className="pattern-overview__summary">{intelligence.summary}</p>
        </section>

        <dl className="pattern-metrics" aria-label="Pattern fingerprint">
          {intelligence.metrics.map((metric) => (
            <div className="pattern-metric" key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
            </div>
          ))}
        </dl>

        <div className="pattern-insights">
          {intelligence.insights.map((insight, index) => (
            <details className="pattern-insight" key={insight.title} open={index === 0}>
              <summary>
                <span className="pattern-insight__heading">
                  <strong>{insight.title}</strong>
                  <small>{insight.value}</small>
                </span>
                <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
              </summary>
              <p>{insight.detail}</p>
            </details>
          ))}
        </div>
      </div>

    </div>
  );
}
