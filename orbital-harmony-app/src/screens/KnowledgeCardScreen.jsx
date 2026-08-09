import { useMemo, useState } from 'react';
import { X, RotateCw } from 'lucide-react';
import { PLANETS, PLANETS_BY_KEY } from '../data/planets.js';
import { PatternGlyph } from '../components/PatternGlyph.jsx';
import { useAppStore } from '../store/useAppStore.js';

/** Screen 8 — Knowledge Card. A dismissible "Did you know?" card that cycles
 *  through a fun fact for each planet. Opens focused on whichever planet the
 *  user was last exploring, then steps through the rest on "Next fact". */
export default function KnowledgeCardScreen({ onClose }) {
  const planetA = useAppStore((s) => s.planetA);

  const facts = useMemo(
    () => PLANETS.map((p) => ({ key: p.key, name: p.name, color: p.color, fact: p.fact })),
    []
  );

  const startIndex = useMemo(() => {
    const i = facts.findIndex((f) => f.key === planetA);
    return i >= 0 ? i : 0;
  }, [facts, planetA]);

  const [index, setIndex] = useState(startIndex);
  const current = facts[index % facts.length];
  const planet = PLANETS_BY_KEY[current.key];

  const next = () => setIndex((i) => (i + 1) % facts.length);

  return (
    <div className="screen screen--knowledge">
      <div className="knowledge-card">
        <div className="knowledge-card__top">
          <span className="knowledge-card__eyebrow">Did you know?</span>
          <button
            type="button"
            className="knowledge-card__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={24} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div className="knowledge-card__planet">
          <span
            className="knowledge-card__orb"
            style={{ '--planet-color': planet?.color ?? '#8c96ff' }}
            aria-hidden="true"
          >
            <PatternGlyph seedA={5} seedB={index + 2} d={5} size={96} strokeWidth={0.6} />
          </span>
          <span className="knowledge-card__name">{current.name}</span>
        </div>

        <p className="knowledge-card__fact">{current.fact}</p>

        <button type="button" className="knowledge-card__next" onClick={next}>
          <span>Next fact</span>
          <RotateCw size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
