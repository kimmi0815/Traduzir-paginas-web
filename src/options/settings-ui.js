"use strict";

function removeSettingsRule(row) {
  const nextControl = row.nextElementSibling?.querySelector('button') ||
    row.previousElementSibling?.querySelector('button') ||
    row.closest('.rule-card')?.querySelector('select.add, button.add:not([aria-hidden])');
  const restoreFocus = row.contains(document.activeElement);
  row.remove();
  if (restoreFocus) nextControl?.focus();
}

// Enhance existing controls after their values and event handlers are initialized.
// The upstream selects remain the source of truth for configuration changes.
function initializeSettingsUI() {
  document.querySelectorAll('.setting-control > select').forEach((select) => {
    const values = Array.from(select.options, (option) => option.value).sort();
    if (values.length !== 2 || values[0] !== 'no' || values[1] !== 'yes') return;
    // Some yes/no storage values represent named choices, such as popup style.
    if (!Array.from(select.options).every((option) =>
      ['msgYes', 'msgNo'].includes(option.getAttribute('data-i18n')))) return;
    const row = select.closest('.setting-row');
    const label = row.querySelector('label');
    const button = document.createElement('button');
    button.type = 'button';
    button.id = select.id + '-switch';
    button.className = 'settings-switch';
    button.setAttribute('role', 'switch');
    label.id = label.id || select.id + '-label';
    label.htmlFor = button.id;
    button.setAttribute('aria-labelledby', label.id);
    button.innerHTML = '<span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>';
    function sync() {
      button.setAttribute('aria-checked', String(select.value === 'yes'));
      button.disabled = select.disabled;
    }
    button.addEventListener('click', () => {
      select.value = select.value === 'yes' ? 'no' : 'yes';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
    });
    select.addEventListener('change', sync);
    select.hidden = true;
    row.classList.add('toggle-row');
    select.after(button);
    sync();
  });

  document.querySelectorAll('.list').forEach((list) => {
    const header = list.previousElementSibling;
    if (!header || !header.classList.contains('w3-display-container')) return;
    const card = document.createElement('section');
    card.className = 'rule-card';
    header.before(card);
    card.append(header, list);
    const empty = document.createElement('p');
    empty.className = 'empty-rules';
    empty.textContent = twpI18n.getMessage('settingsNone');
    card.append(empty);
    // The transparent select overlays a visual Add button. Name the real control
    // and remove the inert visual button from keyboard/accessibility navigation.
    const select = header.querySelector('select.add');
    if (select) {
      const title = header.querySelector('b');
      title.id = select.id + '-label';
      select.setAttribute('aria-labelledby', title.id);
      const displayButton = header.querySelector('button.add');
      displayButton.tabIndex = -1;
      displayButton.setAttribute('aria-hidden', 'true');
    }
  });
  const firstRule = document.querySelector('#languages .rule-card');
  if (firstRule) {
    const heading = document.createElement('h2');
    heading.className = 'settings-section-title';
    heading.textContent = twpI18n.getMessage('settingsRules');
    firstRule.before(heading);
  }
  document.querySelector('#selectServiceContainer').classList.add('preference-group');

  document.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    const label = input.nextElementSibling;
    if (!label || label.tagName !== 'LABEL' || label.htmlFor !== input.id) return;
    const next = label.nextElementSibling;
    const row = document.createElement('div');
    row.className = 'checkbox-row';
    input.before(row);
    row.append(input, label);
    if (next && next.tagName === 'BR') next.remove();
  });
  const menuButton = document.getElementById('btnOpenMenu');
  menuButton.setAttribute('aria-label', twpI18n.getMessage('btnOptions'));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      menuButton.click();
      menuButton.focus();
    }
  });
}
