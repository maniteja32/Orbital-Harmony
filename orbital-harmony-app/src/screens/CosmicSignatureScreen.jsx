import { useMemo, useState } from 'react';
import { GlassDatePicker } from '../components/GlassDatePicker.jsx';
import { TopNavigationBar } from '../components/TopNavigationBar.jsx';
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
      <TopNavigationBar title="Cosmic Signature" onBack={onBack} />

      <div className="cosmic-picker">
        <p className="screen-intro">Enter your birth details</p>

        <div className="cosmic-form">
          <GlassDatePicker
            value={dateStr}
            max={maxDate}
            onChange={setDateStr}
            placeholder="Select your birth date"
            minimal={true}
          />
        </div>
      </div>

      <div className="screen__actions">
        <div className="select-actions__button">
          <button type="button" className="btn-frosted-pill" disabled={!valid} onClick={handleReveal}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
