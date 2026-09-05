"use strict";

// The compact popup uses the same configuration and tab-message contract as TWP.
(async () => {
  await twpConfig.onReady();
  await twpI18n.updateUiMessages();
  twpI18n.translateDocument();
  const $ = (selector) => document.querySelector(selector);
  const message = (key, value) => twpI18n.getMessage(key, value);
  document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    element.setAttribute('aria-label', message(element.dataset.i18nAriaLabel));
  });
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  function updateTheme() {
    document.documentElement.dataset.theme =
      twpConfig.get('darkMode') === 'yes' ||
      (twpConfig.get('darkMode') === 'auto' && systemTheme.matches) ? 'dark' : 'light';
  }
  updateTheme();
  systemTheme.addListener(updateTheme);
  twpConfig.onChanged((key) => { if (key === 'darkMode') updateTheme(); });

  const languages = twpLang.getLanguageList();
  const targetSelect = $('#selectTargetLanguage');
  for (const [group, codes] of [
    ['recents', twpConfig.get('targetLanguages')],
    ['all', Object.keys(languages).sort((a, b) => languages[a].localeCompare(languages[b]))],
  ]) {
    for (const code of codes) {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = languages[code] || code;
      targetSelect.querySelector(`[name="${group}"]`).appendChild(option);
    }
  }
  let targetLanguage = twpConfig.get('targetLanguage');
  targetSelect.value = targetLanguage;
  let sourceLanguage = 'und';
  let state = 'original';
  let available = false;
  let loaded = false;
  let service = twpConfig.get('pageTranslatorService');
  let activeTab;
  let hostname = '';
  let revision = 0;
  let pollTimer;
  let closed = false;

  function query(action) {
    return new Promise((resolve) => {
      if (!activeTab) return resolve(undefined);
      chrome.tabs.sendMessage(activeTab.id, { action }, { frameId: 0 }, (value) => {
        const error = chrome.runtime.lastError;
        resolve(error ? undefined : value);
      });
    });
  }
  function command(action, values = {}) {
    if (!available || !activeTab) return;
    const payload = { action, ...values };
    if (action === 'translatePage' && twpConfig.get('enableIframePageTranslation') !== 'yes') {
      chrome.tabs.sendMessage(activeTab.id, payload, { frameId: 0 }, checkedLastError);
    } else {
      chrome.tabs.sendMessage(activeTab.id, payload, checkedLastError);
    }
  }
  function setMenu(open, focus = true) {
    $('#popupMenu').hidden = !open;
    $('#btnMenu').setAttribute('aria-expanded', String(open));
    $('#btnService').hidden = !open;
    if (open) {
      $('#languagePicker').hidden = true;
      renderMenu();
      if (focus) $('#popupMenu button:not(:disabled)').focus();
    } else if (focus) $('#btnMenu').focus();
  }
  function render() {
    document.body.dataset.state = state;
    const translated = state === 'translated';
    $('#btnRestore').textContent = sourceLanguage === 'und'
      ? message('nativeDetectedLanguage') : (languages[sourceLanguage] || sourceLanguage);
    $('#btnTranslate').textContent = languages[targetLanguage] || targetLanguage;
    $('#btnRestore').setAttribute('aria-selected', String(!translated));
    $('#btnTranslate').setAttribute('aria-selected', String(translated));
    $('#btnRestore').tabIndex = translated ? -1 : 0;
    $('#btnTranslate').tabIndex = translated ? 0 : -1;
    $('#btnTranslate').disabled = !available || state === 'translating';
    $('#btnRestore').disabled = !available;
    $('#btnApplyLanguage').disabled = !available;
    $('#statusRegion').hidden = !loaded || (available && state !== 'translating' && state !== 'error');
    $('#popupStatus').textContent = !available ? message('nativeUnavailable')
      : state === 'translating' ? message('lblTranslating')
      : state === 'error' ? message('lblError') : '';
    $('#btnTryAgain').hidden = !available || state !== 'error';
    $('#serviceName').textContent = { google: 'Google Translate', bing: 'Microsoft Translator', yandex: 'Yandex Translate' }[service] || service;
    $('#btnService').disabled = !available;
    if (!$('#popupMenu').hidden) renderMenu();
  }
  // Reuse the existing localized action catalogue, including all less-used options.
  const listActions = {
    alwaysTranslateThisSite: ['alwaysTranslateSites', () => hostname, 'addSiteToAlwaysTranslate', 'removeSiteFromAlwaysTranslate', 'translate'],
    neverTranslateThisSite: ['neverTranslateSites', () => hostname, 'addSiteToNeverTranslate', 'removeSiteFromNeverTranslate', 'restore'],
    neverTranslateThisLanguage: ['neverTranslateLangs', () => sourceLanguage, 'addLangToNeverTranslate', 'removeLangFromNeverTranslate', 'restore'],
    showTranslatedWhenHoveringThisSite: ['sitesToTranslateWhenHovering', () => hostname, 'addSiteToTranslateWhenHovering', 'removeSiteFromTranslateWhenHovering'],
    showTranslatedWhenHoveringThisLang: ['langsToTranslateWhenHovering', () => sourceLanguage, 'addLangToTranslateWhenHovering', 'removeLangFromTranslateWhenHovering'],
  };
  const flagActions = {
    showTranslateSelectedButton: 'showTranslateSelectedButton',
    showOriginalTextWhenHovering: 'showOriginalTextWhenHovering',
  };
  function isChecked(action) {
    if (listActions[action]) {
      const [key, value] = listActions[action];
      return twpConfig.get(key).includes(value());
    }
    return flagActions[action] && twpConfig.get(flagActions[action]) === 'yes';
  }
  const menuButtons = [];
  for (const option of $('#btnOptions').options) {
    if (option.value === 'options') continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = option.value;
    button.addEventListener('click', () => runAction(option.value));
    $('#menuActions').appendChild(button);
    menuButtons.push([button, option]);
  }
  function renderMenu() {
    $('#divAlwaysTranslateThisLang').hidden = !available || sourceLanguage === 'und' || sourceLanguage === targetLanguage;
    $('#lblAlwaysTranslateThisLang').textContent = message('lblAlwaysTranslate', languages[sourceLanguage] || sourceLanguage);
    $('#cbAlwaysTranslateThisLang').checked = twpConfig.get('alwaysTranslateLangs').includes(sourceLanguage);
    for (const [button, option] of menuButtons) {
      const action = option.value;
      const needsLanguage = action === 'neverTranslateThisLanguage' || action === 'showTranslatedWhenHoveringThisLang';
      button.hidden = needsLanguage && sourceLanguage === 'und';
      button.disabled = !available && (Boolean(listActions[action]) || action === 'translateInExternalSite');
      const label = action === 'translateInExternalSite' && service === 'yandex'
        ? message('msgOpenOnYandexTranslator')
        : message(option.dataset.i18n, languages[sourceLanguage] || sourceLanguage) || option.textContent;
      const checked = Boolean(isChecked(action));
      button.textContent = (checked ? '✓  ' : '') + label;
      if (listActions[action] || flagActions[action]) button.setAttribute('aria-pressed', String(checked));
    }
  }
  async function refresh() {
    const snapshot = revision;
    const result = await query('getCurrentPageLanguageState');
    if (snapshot !== revision || closed) return;
    loaded = true;
    available = ['original', 'translating', 'translated', 'error'].includes(result);
    if (available) state = result;
    render();
    clearTimeout(pollTimer);
    if (state === 'translating' && available) pollTimer = setTimeout(refresh, 350);
  }
  function translate() {
    if (!available) return;
    revision++;
    targetLanguage = targetSelect.value;
    twpConfig.setTargetLanguage(targetLanguage, twpConfig.get('targetLanguage') !== targetLanguage);
    state = 'translating';
    $('#languagePicker').hidden = true;
    command('translatePage', { targetLanguage });
    render();
    clearTimeout(pollTimer);
    pollTimer = setTimeout(refresh, 150);
  }
  function restore() {
    if (!available) return;
    revision++;
    clearTimeout(pollTimer);
    command('restorePage');
    state = 'original';
    render();
  }
  function openOptions(hash = '') {
    tabsCreate(chrome.runtime.getURL('/options/options.html' + hash));
    window.close();
  }
  function runAction(action) {
    if (listActions[action]) {
      const [key, getValue, add, remove, effect] = listActions[action];
      const value = getValue();
      if (!available || !value || value === 'und') return;
      const enabling = !twpConfig.get(key).includes(value);
      twpConfig[enabling ? add : remove](value, hostname);
      if (enabling && effect === 'translate') translate();
      if (enabling && effect === 'restore') restore();
      renderMenu();
    } else if (flagActions[action]) {
      const key = flagActions[action];
      twpConfig.set(key, twpConfig.get(key) === 'yes' ? 'no' : 'yes');
      renderMenu();
    } else if (action === 'changeLanguage') {
      setMenu(false, false);
      targetSelect.value = targetLanguage;
      $('#languagePicker').hidden = false;
      targetSelect.focus();
    } else if (action === 'moreOptions') openOptions();
    else if (action === 'donate') openOptions('#donation');
    else if (action === 'translatePDF') tabsCreate('https://pdf.translatewebpages.org/');
    else if (action === 'translateInExternalSite' && available) {
      const url = encodeURIComponent(activeTab.url);
      const language = encodeURIComponent(targetLanguage);
      tabsCreate(service === 'yandex'
        ? `https://translate.yandex.com/translate?view=compact&url=${url}&lang=${language.split('-')[0]}`
        : `https://translate.google.com/translate?tl=${language}&u=${url}`);
    }
  }
  $('#btnMenu').onclick = () => setMenu($('#popupMenu').hidden);
  $('#btnClose').onclick = () => window.close();
  $('#btnTranslate').onclick = translate;
  $('#btnRestore').onclick = restore;
  $('#btnTryAgain').onclick = translate;
  $('#btnApplyLanguage').onclick = translate;
  $('#btnReset').onclick = () => {
    targetSelect.value = targetLanguage;
    $('#languagePicker').hidden = true;
    $('#btnMenu').focus();
  };
  $('#btnImproveTranslation').onclick = () => { window.location = 'improve-translation.html'; };
  $('#btnSwitchInterfaces').onclick = () => {
    twpConfig.set('useOldPopup', 'no');
    window.location = 'popup.html';
  };
  $('#cbAlwaysTranslateThisLang').onchange = (event) => {
    if (sourceLanguage === 'und' || !available) return;
    if (event.target.checked) twpConfig.addLangToAlwaysTranslate(sourceLanguage, hostname);
    else twpConfig.removeLangFromAlwaysTranslate(sourceLanguage);
    renderMenu();
  };
  $('#btnService').onclick = () => {
    const enabled = twpConfig.get('enabledServices').filter((name) => ['google', 'bing', 'yandex'].includes(name));
    if (!available || !enabled.length) return;
    service = enabled[(enabled.indexOf(service) + 1) % enabled.length];
    twpConfig.set('pageTranslatorService', service);
    command('swapTranslationService', { newServiceName: service });
    revision++;
    clearTimeout(pollTimer);
    pollTimer = setTimeout(refresh, 150);
    render();
  };
  $('.language-tabs').onkeydown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? $('#btnRestore') : event.key === 'End' ? $('#btnTranslate')
      : document.activeElement === $('#btnRestore') ? $('#btnTranslate') : $('#btnRestore');
    if (!next.disabled) next.focus();
  };
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!$('#popupMenu').hidden) setMenu(false);
    else if (!$('#languagePicker').hidden) $('#btnReset').click();
    else window.close();
  });
  window.addEventListener('unload', () => { closed = true; clearTimeout(pollTimer); systemTheme.removeListener(updateTheme); });
  // Paint the saved target immediately; determine availability from the actual content script.
  $('#btnTranslate').textContent = languages[targetLanguage] || targetLanguage;
  $('#btnTranslate').disabled = true;
  $('#btnRestore').disabled = true;
  [activeTab] = await new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
  if (activeTab && activeTab.url) {
    try { hostname = new URL(activeTab.url).hostname; } catch (_) { /* Non-web tabs have no site rules. */ }
  }
  // Source-language detection may be slow; never hold the popup open waiting for it.
  query('getOriginalTabLanguage').then((source) => {
    sourceLanguage = source ? twpLang.fixTLanguageCode(source) || 'und' : 'und';
    render();
  });
  const [pageLanguage, pageService, initialState] = await Promise.all([query('getCurrentPageLanguage'), query('getCurrentPageTranslatorService'), query('getCurrentPageLanguageState')]);
  if (initialState === 'translated' && pageLanguage && pageLanguage !== 'und' && pageLanguage !== 'original') {
    targetLanguage = pageLanguage;
    targetSelect.value = targetLanguage;
  }
  if (pageService) service = pageService;
  await refresh();
})();
