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
  const { planetA, planetB, patternMode, detailLevel, cosmicDate } = useAppStore();
  const a = planetA ? PLANETS_BY_KEY[planetA] : null;
  const b = planetB ? PLANETS_BY_KEY[planetB] : null;
  const title = patternMode === 'cosmic'
    ? 'Cosmic Signature'
    : a && b
      ? `${a.name} × ${b.name}`
      : 'Orbital Pattern';
  const intelligence = useMemo(
    () => createPatternIntelligence({ patternMode, planetA, planetB, detailLevel, cosmicDate }),
    [cosmicDate, detailLevel, patternMode, planetA, planetB],
  );

  return (
    <div className="screen screen--details">
      <TopNavigationBar title={title} onBack={onBack} />

      <div className="details-body">
        <section className="pattern-overview">
          <span className="pattern-overview__eyebrow">{intelligence.eyebrow}</span>
          <h2 className="pattern-overview__title">{intelligence.patternName}</h2>
          <p className="pattern-overview__summary">{intelligence.shortStory}</p>
        </section>

        <div className="pattern-stories">
          <section className="pattern-story-card">
            <span className="pattern-story-card__label">{intelligence.planetaryDance.label}</span>
            <p>{intelligence.planetaryDance.body}</p>
          </section>
          <section className="pattern-story-card">
            <span className="pattern-story-card__label">{intelligence.cosmicTimescale.label}</span>
            <p>{intelligence.cosmicTimescale.body}</p>
          </section>
        </div>

        <details className="pattern-curious">
          <summary>
            <span>For Curious Minds</span>
            <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
          </summary>

          <div className="pattern-curious__body">
            <div className="pattern-insights">
              {intelligence.curious.insights.map((insight) => (
                <details className="pattern-insight" key={insight.title}>
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
        </details>
      </div>

    </div>
  );
}
