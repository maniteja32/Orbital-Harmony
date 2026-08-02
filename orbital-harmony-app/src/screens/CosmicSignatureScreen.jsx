import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { GlassButton } from '../components/ui/glasscn/glass-button.jsx';
import { GlassDatePicker } from '../components/GlassDatePicker.jsx';
import { cosmicSignatureFromDate } from '../utils/cosmicSignature.js';
import { useAppStore } from '../store/useAppStore.js';

/** Screen 3b — "Cosmic Signature". The user enters a birth date (and an
 * optional time); a pair of planets is deterministically derived from it
 * (see utils/cosmicSignature.js) and the engine anchors each planet's
 * starting phase to its real position at that moment, so the traced pattern
 * is personal. Hands off to the shared Simulation screen
 * (patternMode = 'cosmic') to render + capture it. */
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
      <div className="screen__header screen__header--mode">
        <h1>Cosmic Signature</h1>
        <p>Enter your birth details</p>
      </div>

      <div className="cosmic-form">
        <label className="cosmic-field">
          <span className="cosmic-field__label">Date of Birth</span>
          <GlassDatePicker
            value={dateStr}
            max={maxDate}
            onChange={setDateStr}
            placeholder="Select your birth date"
          />
        </label>

        <p className="cosmic-hint">
          Your Signature will be based on the planetary positions at that moment.
        </p>
      </div>

      <div className="screen__actions">
        <div className="select-actions__button">
          <GlassButton tone="secondary" className="w-full h-12 text-base font-semibold" onClick={onBack}>
            <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
            Back
          </GlassButton>
        </div>
        <div className="select-actions__button">
          <GlassButton
            tone="primary"
            className="w-full h-12 text-base font-semibold"
            disabled={!valid}
            onClick={handleReveal}
          >
            Generate Signature
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
