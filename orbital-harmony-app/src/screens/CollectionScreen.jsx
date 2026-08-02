import { useState } from 'react';
import { BottomNav } from '../components/BottomNav.jsx';
import { PatternGlyph } from '../components/PatternGlyph.jsx';

/** Screen 9 — My Collection. Saved patterns and cosmic signatures in a
 *  two-column grid, with the persistent bottom tab bar. Data is mock for now
 *  (no persistence layer yet) — the cards are wired to open the result view
 *  so the flow reads end-to-end. */
const PATTERNS = [
  { id: 'p1', title: 'Earth · Venus', date: 'Today', seedA: 5, seedB: 3, d: 5 },
  { id: 'p2', title: 'Mars · Jupiter', date: '2 days ago', seedA: 7, seedB: 3, d: 4 },
  { id: 'p3', title: 'Mercury · Saturn', date: '5 days ago', seedA: 6, seedB: 5, d: 5 },
  { id: 'p4', title: 'Venus · Neptune', date: '1 week ago', seedA: 8, seedB: 3, d: 5 },
];

const SIGNATURES = [
  { id: 's1', title: 'My Signature', date: '05 Aug 1990', seedA: 9, seedB: 4, d: 5 },
  { id: 's2', title: 'A. Signature', date: '12 Jan 1988', seedA: 7, seedB: 4, d: 6 },
];

export default function CollectionScreen({ onOpen }) {
  const [tab, setTab] = useState('patterns');
  const items = tab === 'patterns' ? PATTERNS : SIGNATURES;

  return (
    <div className="screen screen--collection">
      <div className="screen__header screen__header--mode">
        <h1>My Collection</h1>
      </div>

      <div className="tabs" role="tablist" aria-label="Collection">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'patterns'}
          className={`tab${tab === 'patterns' ? ' is-active' : ''}`}
          onClick={() => setTab('patterns')}
        >
          Patterns
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'signatures'}
          className={`tab${tab === 'signatures' ? ' is-active' : ''}`}
          onClick={() => setTab('signatures')}
        >
          Signatures
        </button>
      </div>

      <div className="collection-scroll">
        <div className="collection-grid">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="collection-card"
              onClick={() => onOpen?.(item)}
            >
              <span className="collection-card__frame" aria-hidden="true">
                <PatternGlyph seedA={item.seedA} seedB={item.seedB} d={item.d} size={140} strokeWidth={0.5} />
              </span>
              <span className="collection-card__title">{item.title}</span>
              <span className="collection-card__date">{item.date}</span>
            </button>
          ))}
        </div>
      </div>

      <BottomNav active="collection" />
    </div>
  );
}
