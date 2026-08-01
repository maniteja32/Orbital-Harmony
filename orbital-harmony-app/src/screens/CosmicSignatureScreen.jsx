import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { GlassButton } from '../components/ui/glasscn/glass-button.jsx';
import { cosmicSignatureFromDate } from '../utils/cosmicSignature.js';
import { useAppStore } from '../store/useAppStore.js';

/** Screen 3b — "Cosmic Signature". The user enters a birth date; a pair of
 * planets is deterministically derived from it (see utils/cosmicSignature.js)
 * and the engine anchors each planet's starting phase to its real position on
 * that date, so the traced pattern is personal. Hands off to the shared
 * Simulation screen (patternMode = 'cosmic') to render + capture it. */
export default function CosmicSignatureScreen({ onReveal, onBack }) {
  const setPlanetA = useAppStore((s) => s.setPlanetA);
  const setPlanetB = useAppStore((s) => s.setPlanetB);
  const setCosmicDate = useAppStore((s) => s.setCosmicDate);
  const setPatternMode = useAppStore((s) => s.setPatternMode);

  const [dateStr, setDateStr] = useState('');

  // Today, as YYYY-MM-DD, to cap the date input (no future birth dates).
  const maxDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Parse at local noon so the calendar day is stable regardless of timezone.
  const parsed = dateStr ? new Date(`${dateStr}T12:00:00`) : null;
  const valid = parsed != null && !Number.isNaN(parsed.getTime());

  const signature = useMemo(
    () => (valid ? cosmicSignatureFromDate(parsed) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateStr]
  );

  function handleReveal() {
    if (!signature || !parsed) return;
    setPlanetA(signature.planetA.key);
    setPlanetB(signature.planetB.key);
    setCosmicDate(parsed);
    setPatternMode('cosmic');
    onReveal();
  }

  return (
    <div className="screen screen--cosmic">
      <div className="mode-topbar">
        <button type="button" className="back-button" onClick={onBack} aria-label="Back to Choose an Experience">
          <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
          Back
        </button>
      </div>

      <div className="screen__header screen__header--mode">
        <span className="eyebrow">Cosmic Signature</span>
        <h1>Your birth date</h1>
        <p>Enter the day you were born to reveal the pattern the planets traced for you.</p>
      </div>

      <div className="cosmic-form">
        <label className="cosmic-field">
          <span className="cosmic-field__label">Birth date</span>
          <input
            type="date"
            className="cosmic-input"
            value={dateStr}
            max={maxDate}
            onChange={(e) => setDateStr(e.target.value)}
          />
        </label>

        {signature && (
          <div className="cosmic-preview">
            <span className="cosmic-preview__label">Your signature planets</span>
            <span className="cosmic-preview__pair">
              <span
                className="cosmic-preview__dot"
                style={{ background: signature.planetA.color }}
              />
              {signature.planetA.name}
              <span className="cosmic-preview__times">×</span>
              <span
                className="cosmic-preview__dot"
                style={{ background: signature.planetB.color }}
              />
              {signature.planetB.name}
            </span>
          </div>
        )}
      </div>

      <div className="screen__actions">
        <GlassButton
          tone="primary"
          className="w-full h-12 text-base font-semibold"
          disabled={!valid}
          onClick={handleReveal}
        >
          Reveal My Signature
        </GlassButton>
      </div>
    </div>
  );
}
