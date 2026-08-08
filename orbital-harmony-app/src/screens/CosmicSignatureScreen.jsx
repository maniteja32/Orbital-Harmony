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
      <div className="mode-topbar">
        <button
          type="button"
          className="back-button back-button--icon"
          onClick={onBack}
          aria-label="Back"
        >
          <Home size={18} strokeWidth={2} aria-hidden="true" />
        </button>
        <h1 className="topbar-title">Cosmic Signature</h1>
        <span />
      </div>

      <div className="screen__header screen__header--mode screen__header--compact">
        <p>Enter your birth details</p>
      </div>

      <div className="cosmic-form">
        <GlassDatePicker
          value={dateStr}
          max={maxDate}
          onChange={setDateStr}
          placeholder="Select your birth date"
          minimal={true}
        />

        <p className="cosmic-hint">
          Same birth date always generates the same signature.
        </p>
      </div>

      <div className="screen__actions">
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
