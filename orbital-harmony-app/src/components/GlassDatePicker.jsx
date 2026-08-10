import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { LiquidGlass } from './ui/glasscn/liquid-glass.jsx';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MIN_YEAR = 1900;
const NAV_ICON_RIM = {
  '--liquid-glass-rim-width': '0.8px',
  '--liquid-glass-rim-light': 'rgba(255,255,255,0.52)',
};

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

/** A dependency-free, glass-styled date picker with month + year dropdowns
 * for fast navigation across decades. */
export function GlassDatePicker({ value, onChange, max, placeholder = 'Select date', id, minimal = false }) {
  const uid = useId().replace(/:/g, '');
  const dialogId = `gdp-dialog-${uid}`;
  const headingId = `gdp-heading-${uid}`;
  const selected = useMemo(() => parseYMD(value), [value]);
  const maxDate = useMemo(() => parseYMD(max), [max]);
  const maxYear = maxDate ? maxDate.getFullYear() : new Date().getFullYear();

  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const [view, setView] = useState(() => {
    const base = selected ?? maxDate ?? new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const popRef = useRef(null);

  // Keep the visible month aligned with externally changed selections.
  useEffect(() => {
    const base = selected ?? maxDate ?? new Date();
    setView({ year: base.getFullYear(), month: base.getMonth() });
  }, [selected, maxDate]);

  // Move focus into the calendar when opened (selected day first, otherwise
  // first available day) so keyboard users can interact immediately.
  useEffect(() => {
    if (!popRef.current) return;
    const target = popRef.current.querySelector('.gdp__cell.is-selected:not(:disabled), .gdp__cell:not(:disabled)');
    if (target) target.focus();
  }, [view.year, view.month]);

  const years = useMemo(() => {
    const arr = [];
    for (let y = maxYear; y >= MIN_YEAR; y -= 1) arr.push(y);
    return arr;
  }, [maxYear]);

  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const maxMonth = maxDate ? maxDate.getMonth() : 11;
  const isAtMaxMonth = Boolean(maxDate && view.year === maxYear && view.month >= maxMonth);
  const isAtMinMonth = view.year === MIN_YEAR && view.month === 0;
  const isAtMaxYear = view.year >= maxYear;
  const isAtMinYear = view.year <= MIN_YEAR;

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length < 42) cells.push(null);

  function shiftMonth(delta) {
    setView((v) => {
      let m = v.month + delta;
      let y = v.year;
      if (m < 0) {
        m = 11;
        y -= 1;
      }
      if (m > 11) {
        m = 0;
        y += 1;
      }

      if (y < MIN_YEAR) return { year: MIN_YEAR, month: 0 };
      if (y > maxYear) return { year: maxYear, month: maxMonth };
      if (maxDate && y === maxYear && m > maxMonth) {
        return { year: maxYear, month: maxMonth };
      }
      return { year: y, month: m };
    });
  }

  function shiftYear(delta) {
    setView((v) => {
      const year = Math.min(maxYear, Math.max(MIN_YEAR, v.year + delta));
      const month = maxDate && year === maxYear && v.month > maxMonth ? maxMonth : v.month;
      return { year, month };
    });
  }

  function pick(day) {
    onChange(toYMD(view.year, view.month, day));
    // Calendar stays open
  }

  const label = selected
    ? `${String(selected.getDate()).padStart(2, '0')} ${MONTHS_SHORT[selected.getMonth()]} ${selected.getFullYear()}`
    : placeholder;

  return (
    <div className="gdp is-open">
      {!minimal && (
        <LiquidGlass
          className="gdp__triggerGlass rounded-[18px] w-full bg-white/[0.03]"
          style={{
            '--liquid-glass-rim-width': '0.9px',
            '--liquid-glass-rim-light': 'rgba(255,255,255,0.28)',
          }}
        >
          <button
            type="button"
            id={id}
            className={`cosmic-input gdp__trigger${selected ? '' : ' gdp__trigger--empty'}`}
            disabled
            aria-haspopup="dialog"
            aria-expanded="true"
            aria-controls={dialogId}
          >
            <span>{label}</span>
            <Calendar size={18} strokeWidth={1.8} className="cosmic-field__icon" aria-hidden="true" />
          </button>
        </LiquidGlass>
      )}

      <LiquidGlass
        ref={popRef}
        id={dialogId}
        className={`gdp__pop rounded-[20px] bg-white/[0.06]${minimal ? ' gdp__pop--minimal' : ''}`}
        role="dialog"
        aria-modal="false"
        aria-labelledby={headingId}
        style={{
          '--liquid-glass-rim-width': '0.9px',
          '--liquid-glass-rim-light': 'rgba(255,255,255,0.22)',
        }}
      >
          <div className="gdp__nav">
            <h2 id={headingId} className="sr-only">Choose birth date</h2>
            <div className="gdp__navGroup">
              <LiquidGlass
                className={`gdp__navGlass rounded-full bg-white/[0.12]${isAtMinYear ? ' is-disabled' : ''}`}
                style={NAV_ICON_RIM}
              >
                <button
                  type="button"
                  className="gdp__navbtn"
                  onClick={() => shiftYear(-1)}
                  aria-label="Previous year"
                  disabled={isAtMinYear}
                >
                  <ChevronsLeft size={17} strokeWidth={2} aria-hidden="true" />
                </button>
              </LiquidGlass>
              <LiquidGlass
                className={`gdp__navGlass rounded-full bg-white/[0.12]${isAtMinMonth ? ' is-disabled' : ''}`}
                style={NAV_ICON_RIM}
              >
                <button
                  type="button"
                  className="gdp__navbtn"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Previous month"
                  disabled={isAtMinMonth}
                >
                  <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
                </button>
              </LiquidGlass>
            </div>

            <div className="gdp__period" aria-live="polite" aria-atomic="true">
              <div className={`gdp__monthPicker${monthMenuOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="gdp__monthBtn"
                  aria-haspopup="listbox"
                  aria-expanded={monthMenuOpen}
                  aria-controls={`${uid}-month-listbox`}
                  onClick={() => {
                    setMonthMenuOpen((v) => !v);
                    setYearMenuOpen(false);
                  }}
                >
                  <span>{MONTHS[view.month]}</span>
                  <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
                </button>

                {monthMenuOpen && (
                  <div className="gdp__monthMenu" role="listbox" id={`${uid}-month-listbox`} aria-label="Month">
                    {MONTHS.map((m, i) => {
                      const isSelected = i === view.month;
                      const isDisabled = Boolean(maxDate && view.year === maxYear && i > maxMonth);
                      return (
                        <button
                          key={m}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`gdp__monthOption${isSelected ? ' is-selected' : ''}`}
                          disabled={isDisabled}
                          onClick={() => {
                            if (isDisabled) return;
                            setView((v) => ({ ...v, month: i }));
                            setMonthMenuOpen(false);
                          }}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className={`gdp__yearPicker${yearMenuOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="gdp__yearBtn"
                  aria-haspopup="listbox"
                  aria-expanded={yearMenuOpen}
                  aria-controls={`${uid}-year-listbox`}
                  onClick={() => {
                    setYearMenuOpen((v) => !v);
                    setMonthMenuOpen(false);
                  }}
                >
                  <span>{view.year}</span>
                  <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
                </button>

                {yearMenuOpen && (
                  <div className="gdp__yearMenu" role="listbox" id={`${uid}-year-listbox`} aria-label="Year">
                    {years.map((y) => {
                      const isSelected = y === view.year;
                      return (
                        <button
                          key={y}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`gdp__yearOption${isSelected ? ' is-selected' : ''}`}
                          onClick={() => {
                            setView((v) => {
                              const nextMonth = maxDate && y === maxYear && v.month > maxMonth ? maxMonth : v.month;
                              return { year: y, month: nextMonth };
                            });
                            setYearMenuOpen(false);
                          }}
                        >
                          {y}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="gdp__navGroup">
              <LiquidGlass
                className={`gdp__navGlass rounded-full bg-white/[0.12]${isAtMaxMonth ? ' is-disabled' : ''}`}
                style={NAV_ICON_RIM}
              >
                <button
                  type="button"
                  className="gdp__navbtn"
                  onClick={() => shiftMonth(1)}
                  aria-label="Next month"
                  disabled={isAtMaxMonth}
                >
                  <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
                </button>
              </LiquidGlass>
              <LiquidGlass
                className={`gdp__navGlass rounded-full bg-white/[0.12]${isAtMaxYear ? ' is-disabled' : ''}`}
                style={NAV_ICON_RIM}
              >
                <button
                  type="button"
                  className="gdp__navbtn"
                  onClick={() => shiftYear(1)}
                  aria-label="Next year"
                  disabled={isAtMaxYear}
                >
                  <ChevronsRight size={17} strokeWidth={2} aria-hidden="true" />
                </button>
              </LiquidGlass>
            </div>
          </div>

          <div className="gdp__dow">
            {WEEKDAYS.map((w, i) => (
              <span key={i} className="gdp__dowcell">{w}</span>
            ))}
          </div>

          <div className="gdp__grid" role="grid" aria-label={`${MONTHS[view.month]} ${view.year}`}>
            {cells.map((day, i) => {
              if (day == null) return <span key={`b${i}`} className="gdp__cell gdp__cell--empty" />;
              const dayDate = new Date(view.year, view.month, day, 12, 0, 0);
              const disabled = maxDate ? dayDate > maxDate : false;
              const isSel = sameDay(dayDate, selected);
              const isToday = sameDay(dayDate, new Date());
              const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayDate.getDay()];
              return (
                <button
                  key={day}
                  type="button"
                  className={`gdp__cell${isToday ? ' is-today' : ''}${isSel ? ' is-selected' : ''}`}
                  onClick={() => pick(day)}
                  disabled={disabled}
                  role="gridcell"
                  aria-selected={isSel}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={`${weekday}, ${day} ${MONTHS[view.month]} ${view.year}`}
                  tabIndex={isSel ? 0 : -1}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </LiquidGlass>
      {minimal && (
        <div
          className={`gdp__selectedDate${selected ? '' : ' is-placeholder'}`}
          aria-live="polite"
          aria-hidden={selected ? undefined : 'true'}
        >
          <span className="gdp__selectedLabel">Selected:</span>
          <span className="gdp__selectedValue">{selected ? label : '00 Mon 0000'}</span>
        </div>
      )}
    </div>
  );
}
