import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MIN_YEAR = 1900;

/** Parse a 'YYYY-MM-DD' string into a local Date (noon, so the calendar day
 * is timezone-stable). Returns null for empty/invalid input. */
function parseYMD(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toYMD(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** A dependency-free, glass-styled date picker. Renders a read-only trigger
 * field; tapping it opens a popover calendar with month + year dropdowns for
 * fast navigation across decades (ideal for birth dates). `value` / `onChange`
 * use 'YYYY-MM-DD' strings; `max` optionally caps the latest selectable day. */
export function GlassDatePicker({ value, onChange, max, placeholder = 'Select date', id }) {
  const selected = useMemo(() => parseYMD(value), [value]);
  const maxDate = useMemo(() => parseYMD(max), [max]);
  const maxYear = maxDate ? maxDate.getFullYear() : new Date().getFullYear();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const base = selected ?? maxDate ?? new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const rootRef = useRef(null);

  // When (re)opening, jump the view to the selected date (or max/today).
  useEffect(() => {
    if (!open) return;
    const base = selected ?? maxDate ?? new Date();
    setView({ year: base.getFullYear(), month: base.getMonth() });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const years = useMemo(() => {
    const arr = [];
    for (let y = maxYear; y >= MIN_YEAR; y -= 1) arr.push(y);
    return arr;
  }, [maxYear]);

  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  const today = new Date();

  function shiftMonth(delta) {
    setView((v) => {
      let m = v.month + delta;
      let y = v.year;
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      return { year: Math.min(Math.max(y, MIN_YEAR), maxYear), month: m };
    });
  }

  function pick(day) {
    onChange(toYMD(view.year, view.month, day));
    setOpen(false);
  }

  const label = selected
    ? `${String(selected.getDate()).padStart(2, '0')} ${MONTHS_SHORT[selected.getMonth()]} ${selected.getFullYear()}`
    : placeholder;

  return (
    <div className="gdp" ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`cosmic-input gdp__trigger${selected ? '' : ' gdp__trigger--empty'}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{label}</span>
        <Calendar size={18} strokeWidth={1.8} className="cosmic-field__icon" aria-hidden="true" />
      </button>

      {open && (
        <div className="gdp__pop" role="dialog" aria-label="Choose date">
          <div className="gdp__nav">
            <button type="button" className="gdp__navbtn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
            </button>

            <div className="gdp__selects">
              <select
                className="gdp__select"
                value={view.month}
                onChange={(e) => setView((v) => ({ ...v, month: Number(e.target.value) }))}
                aria-label="Month"
              >
                {MONTHS.map((name, i) => (
                  <option key={name} value={i}>{name}</option>
                ))}
              </select>
              <select
                className="gdp__select"
                value={view.year}
                onChange={(e) => setView((v) => ({ ...v, year: Number(e.target.value) }))}
                aria-label="Year"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button type="button" className="gdp__navbtn" onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          <div className="gdp__dow">
            {WEEKDAYS.map((w, i) => (
              <span key={i} className="gdp__dowcell">{w}</span>
            ))}
          </div>

          <div className="gdp__grid">
            {cells.map((day, i) => {
              if (day == null) return <span key={`b${i}`} className="gdp__cell gdp__cell--empty" />;
              const dayDate = new Date(view.year, view.month, day, 12, 0, 0);
              const disabled = maxDate ? dayDate > maxDate : false;
              const isSel = sameDay(dayDate, selected);
              const isToday = sameDay(dayDate, today);
              return (
                <button
                  key={day}
                  type="button"
                  className={`gdp__cell${isSel ? ' is-selected' : ''}${isToday && !isSel ? ' is-today' : ''}`}
                  onClick={() => pick(day)}
                  disabled={disabled}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
