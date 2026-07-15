// ============================================================================
// Orbital Harmony — custom "combobox" dropdown.
//
// Native <select> option popups are rendered by the OS/browser and can't be
// restyled (hence the jarring native blue-highlight list clashing with the
// app's dark neumorphic theme). This module visually replaces a <select>
// with a fully custom, themeable trigger button + listbox, while the real
// <select> stays in the DOM (visually hidden) as the single source of
// truth — this component only ever reads its <option>s and writes its
// `.value` + dispatches a real 'change' event, so any existing code that
// reads/writes the select (see js/ui.js) keeps working completely
// unmodified.
//
// Usage:
//   const combo = enhanceSelect(selectEl);
//   // ...later, after something else mutates the <select>'s options
//   // (e.g. toggling `option.disabled`), call combo.refresh() to keep the
//   // custom listbox in sync.
// ============================================================================

export function enhanceSelect(selectEl) {
  const wrapper = document.createElement('div');
  wrapper.className = 'combobox';
  selectEl.parentNode.insertBefore(wrapper, selectEl);
  wrapper.appendChild(selectEl);
  selectEl.setAttribute('tabindex', '-1');
  selectEl.setAttribute('aria-hidden', 'true');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'combobox__trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = `
    <span class="combobox__value"></span>
    <svg class="combobox__chevron" viewBox="0 0 10 6" fill="none" aria-hidden="true">
      <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  wrapper.appendChild(trigger);

  const listbox = document.createElement('ul');
  listbox.className = 'combobox__listbox';
  listbox.setAttribute('role', 'listbox');
  wrapper.appendChild(listbox);

  const valueEl = trigger.querySelector('.combobox__value');
  let activeIndex = -1;

  function render() {
    const options = [...selectEl.options];
    valueEl.textContent = selectEl.options[selectEl.selectedIndex]?.textContent ?? '';
    listbox.innerHTML = '';
    activeIndex = -1;

    options.forEach((opt, i) => {
      const li = document.createElement('li');
      li.className = 'combobox__option';
      li.setAttribute('role', 'option');
      li.textContent = opt.textContent;
      li.dataset.value = opt.value;

      if (opt.disabled) {
        li.classList.add('is-disabled');
        li.setAttribute('aria-disabled', 'true');
      }
      if (opt.value === selectEl.value) {
        li.classList.add('is-selected');
        li.setAttribute('aria-selected', 'true');
        activeIndex = i;
      }

      li.addEventListener('click', () => {
        if (opt.disabled) return;
        selectEl.value = opt.value;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        render();
        close();
        trigger.focus();
      });

      listbox.appendChild(li);
    });
  }

  function open() {
    wrapper.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onKeydown);
  }

  function close() {
    wrapper.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('keydown', onKeydown);
  }

  function onDocClick(event) {
    if (!wrapper.contains(event.target)) close();
  }

  function moveActive(options, direction) {
    if (!options.length) return;
    let i = activeIndex;
    for (let step = 0; step < options.length; step++) {
      i = (i + direction + options.length) % options.length;
      if (!options[i].classList.contains('is-disabled')) break;
    }
    options.forEach((li) => li.classList.remove('is-active'));
    options[i]?.classList.add('is-active');
    options[i]?.scrollIntoView({ block: 'nearest' });
    activeIndex = i;
  }

  function onKeydown(event) {
    const options = [...listbox.children];
    if (event.key === 'Escape') {
      close();
      trigger.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(options, 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(options, -1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      options[activeIndex]?.click();
    }
  }

  trigger.addEventListener('click', () => {
    if (wrapper.classList.contains('is-open')) {
      close();
    } else {
      render();
      open();
    }
  });

  render();

  return { refresh: render };
}
