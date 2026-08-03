import { useMemo, useState } from 'react';
import { Home } from 'lucide-react';
import { GlassButton } from '../components/ui/glasscn/glass-button.jsx';
import { GlassDatePicker } from '../components/GlassDatePicker.jsx';
import { parseCosmicDateInput } from '../utils/cosmicSignature.js';
import { useAppStore } from '../store/useAppStore.js';

/** Screen 3b — "Cosmic Signature". The user enters a birth date.
 * We deterministically compute each planet's heliocentric angle for
 * that date and generate the v1 Celestial Snapshot signature from those
 * positions. */
export default function CosmicSignatureScreen({ onReveal, onBack }) {
  const setCosmicDate = useAppStore((s) => s.setCosmicDate);
  const setPatternMode = useAppStore((s) => s.setPatternMode);
  const setSnapshot = useAppStore((s) => s.setSnapshot);

  const [dateStr, setDateStr] = useState('');

  // Today, as YYYY-MM-DD, to cap the date input (no future birth dates).
  const maxDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const parsed = useMemo(() => parseCosmicDateInput(dateStr), [dateStr]);
  const valid = parsed != null && !Number.isNaN(parsed.getTime());

  function handleReveal() {
    if (!parsed) return;
    setCosmicDate(parsed);
    setPatternMode('cosmic');
    setSnapshot(null);
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
          Same birth date always generates the same signature.
        </p>
      </div>

      <div className="screen__actions">
        <button
          type="button"
          className="back-button back-button--icon"
          onClick={onBack}
          aria-label="Home"
        >
          <Home size={18} strokeWidth={2} aria-hidden="true" />
        </button>
        <div className="select-actions__button">
          <GlassButton
            tone="primary"
            className="w-full h-12 text-base font-medium"
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
