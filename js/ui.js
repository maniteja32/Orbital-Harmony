// ============================================================================
// Orbital Harmony — settings panel wiring.
// Pure DOM/event-handling glue: reads/writes the panel's inputs and calls
// into the 3D engine's exported `api` (see js/main.js). No Three.js code
// lives here, and main.js never touches the DOM — the two stay decoupled.
// The panel is permanently docked; there is no open/close state to manage.
// ============================================================================

import { api, PLANET_NAMES, DEFAULT_PLANET_A, DEFAULT_PLANET_B } from './main.js';
import { enhanceSelect } from './combobox.js';

const planetASelect = document.getElementById('planetA');
const planetBSelect = document.getElementById('planetB');

const simulationSpeedInput = document.getElementById('simulationSpeed');
const traceIntervalInput = document.getElementById('traceInterval');

const lineStyleSelect = document.getElementById('lineStyle');

const generateBtn = document.getElementById('actionGenerate');
const clearBtn = document.getElementById('actionClear');
const pauseResumeBtn = document.getElementById('actionPauseResume');

// ----------------------------------------------------------------------------
// Celestial bodies — populate both dropdowns with all 8 planets, and keep
// them from both pointing at the same planet (disable whichever option is
// currently selected in the *other* dropdown).
// ----------------------------------------------------------------------------
function populatePlanetSelect(selectEl, defaultValue) {
  selectEl.innerHTML = '';
  PLANET_NAMES.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    if (name === defaultValue) option.selected = true;
    selectEl.appendChild(option);
  });
}

function syncPlanetOptionAvailability() {
  [...planetASelect.options].forEach((opt) => {
    opt.disabled = opt.value === planetBSelect.value;
  });
  [...planetBSelect.options].forEach((opt) => {
    opt.disabled = opt.value === planetASelect.value;
  });
  planetACombo.refresh();
  planetBCombo.refresh();
}

populatePlanetSelect(planetASelect, DEFAULT_PLANET_A);
populatePlanetSelect(planetBSelect, DEFAULT_PLANET_B);
// Visually replace both native <select> elements with a custom dark
// neumorphic dropdown — native OS option popups can't be restyled, so this
// keeps Planet A/B consistent with the rest of the panel's look.
const planetACombo = enhanceSelect(planetASelect);
const planetBCombo = enhanceSelect(planetBSelect);
syncPlanetOptionAvailability();

planetASelect.addEventListener('change', () => {
  api.setPlanetA(planetASelect.value);
  syncPlanetOptionAvailability();
});
planetBSelect.addEventListener('change', () => {
  api.setPlanetB(planetBSelect.value);
  syncPlanetOptionAvailability();
});

// ----------------------------------------------------------------------------
// Sliders — each one updates its live value label, paints its own filled
// track (via the --fill custom property consumed in style.css), and calls
// the matching engine API method.
// ----------------------------------------------------------------------------
function paintSliderFill(inputEl) {
  const min = Number(inputEl.min);
  const max = Number(inputEl.max);
  const value = Number(inputEl.value);
  const percent = ((value - min) / (max - min)) * 100;
  inputEl.style.setProperty('--fill', `${percent}%`);
}

function bindSlider(inputEl, labelEl, { format, onInput }) {
  const update = () => {
    paintSliderFill(inputEl);
    labelEl.textContent = format(Number(inputEl.value));
    onInput(Number(inputEl.value));
  };
  inputEl.addEventListener('input', update);
  update(); // paint initial state
}

bindSlider(simulationSpeedInput, document.getElementById('simulationSpeedValue'), {
  format: (v) => `${v.toFixed(1)}×`,
  onInput: (v) => api.setSimulationSpeed(v),
});

bindSlider(traceIntervalInput, document.getElementById('traceIntervalValue'), {
  format: (v) => `${v.toFixed(1)} d`,
  onInput: (v) => api.setTraceInterval(v),
});

// Visually replace the native Line Style <select> with the same custom
// dropdown used for Planet A/B, for a consistent look.
enhanceSelect(lineStyleSelect);
lineStyleSelect.addEventListener('change', () => {
  api.setLineStyle(lineStyleSelect.value);
});

// ----------------------------------------------------------------------------
// Actions
// ----------------------------------------------------------------------------
generateBtn.addEventListener('click', () => {
  api.generatePattern();
  setPauseResumeButtonState(false);
});

clearBtn.addEventListener('click', () => {
  api.clearPattern();
});

function setPauseResumeButtonState(paused) {
  // The two icons (play/pause) both live in the DOM permanently — only
  // [data-state] changes, and CSS shows/hides the matching one. The label
  // span is updated separately so we never clobber the icon markup by
  // overwriting the button's textContent.
  pauseResumeBtn.dataset.state = paused ? 'paused' : 'playing';
  pauseResumeBtn.title = paused ? 'Resume' : 'Pause';
  pauseResumeBtn.querySelector('.btn__label').textContent = paused ? 'Resume' : 'Pause';
  pauseResumeBtn.classList.toggle('is-active', paused);
}

pauseResumeBtn.addEventListener('click', () => {
  const nowPaused = !api.isPaused();
  if (nowPaused) api.pauseSimulation();
  else api.resumeSimulation();
  setPauseResumeButtonState(nowPaused);
});
setPauseResumeButtonState(api.isPaused());
