"use strict";

// The compact popup uses the same configuration and tab-message contract as TWP.
const twpCompactPopup = async (environment = {}) => {
  const root = environment.root || document;
  const surface = environment.surface || document.body;
  const themeRoot = environment.surface || document.documentElement;
  const closePopup = environment.close || (() => window.close());
  const openUrl = environment.openUrl || ((url) => tabsCreate(url));
  const navigate = environment.navigate || ((path) => { window.location = path; });
  await twpConfig.onReady();
  await twpI18n.updateUiMessages();
  twpI18n.translateDocument(root);
  const $ = (selector) => root.querySelector(selector);
  const message = (key, value) => twpI18n.getMessage(key, value);
  root.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    element.setAttribute('aria-label', message(element.dataset.i18nAriaLabel));
  });
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  function updateTheme() {
    themeRoot.dataset.theme =
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
  let displayMode = twpConfig.get('translationDisplayMode') || 'translation';
  let available = false;
  let loaded = false;
  let service = twpConfig.get('pageTranslatorService');
  let activeTab;
  let hostname = '';
  let revision = 0;
  let pollTimer;
  let closed = false;
  let opening = 0;
  const languageTabs = $('.language-tabs');
  const tabIndicator = $('.tab-indicator');
  let indicatorInitialized = false;

  function setTabMotion(event) {
    languageTabs.dataset.keyboard = String(event?.detail === 0);
  }

  function query(action) {
    if (environment.query) return environment.query(action);
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
    if (environment.command) return environment.command(payload);
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
    surface.dataset.state = state;
    const translated = state === 'translated' || state === 'translating';
    $('#btnRestore').textContent = sourceLanguage === 'und'
      ? message('nativeDetectedLanguage') : (languages[sourceLanguage] || sourceLanguage);
    $('#btnTranslate').textContent = languages[targetLanguage] || targetLanguage;
    $('#btnRestore').setAttribute('aria-selected', String(!translated));
    $('#btnTranslate').setAttribute('aria-selected', String(translated));
    tabIndicator.style.transform = translated ? 'translateX(100%)' : 'translateX(0)';
    // Opening on an already translated page should not slide in from the original tab.
    if (loaded && !indicatorInitialized) {
      indicatorInitialized = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        languageTabs.dataset.ready = 'true';
      }));
    }
    $('#btnRestore').tabIndex = translated ? -1 : 0;
    $('#btnTranslate').tabIndex = translated ? 0 : -1;
    $('#btnTranslate').disabled = !available;
    $('#btnRestore').disabled = !available;
    $('#btnApplyLanguage').disabled = !available;
    $('#statusRegion').hidden = !loaded || (available && state !== 'error');
    $('#popupStatus').textContent = !available ? message('nativeUnavailable')
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
  const bilingualButton = document.createElement('button');
  bilingualButton.type = 'button';
  bilingualButton.addEventListener('click', () => {
    displayMode = displayMode === 'bilingual' ? 'translation' : 'bilingual';
    twpConfig.set('translationDisplayMode', displayMode);
    state = 'original';
    translate();
    renderMenu();
  });
  $('#menuActions').appendChild(bilingualButton);
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
    const bilingual = displayMode === 'bilingual';
    bilingualButton.textContent = (bilingual ? '✓  ' : '') + message('nativeBilingualMode');
    bilingualButton.setAttribute('aria-pressed', String(bilingual));
    bilingualButton.disabled = !available;
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
  function translate(event) {
    if (!available) return;
    // Keep the selected tab focusable while ignoring duplicate translation requests.
    if (state === 'translating' && targetSelect.value === targetLanguage) return;
    setTabMotion(event);
    revision++;
    targetLanguage = targetSelect.value;
    twpConfig.setTargetLanguage(targetLanguage, twpConfig.get('targetLanguage') !== targetLanguage);
    state = 'translating';
    $('#languagePicker').hidden = true;
    command('translatePage', { targetLanguage, displayMode });
    render();
    clearTimeout(pollTimer);
    pollTimer = setTimeout(refresh, 150);
  }
  function restore(event) {
    if (!available) return;
    setTabMotion(event);
    revision++;
    clearTimeout(pollTimer);
    command('restorePage');
    state = 'original';
    render();
  }
  function openOptions(hash = '') {
    openUrl(chrome.runtime.getURL('/options/options.html' + hash));
    closePopup();
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
    else if (action === 'translatePDF') openUrl('https://pdf.translatewebpages.org/');
    else if (action === 'translateInExternalSite' && available) {
      const url = encodeURIComponent(activeTab.url);
      const language = encodeURIComponent(targetLanguage);
      openUrl(service === 'yandex'
        ? `https://translate.yandex.com/translate?view=compact&url=${url}&lang=${language.split('-')[0]}`
        : `https://translate.google.com/translate?tl=${language}&u=${url}`);
    }
  }
  $('#btnMenu').onclick = () => setMenu($('#popupMenu').hidden);
  $('#btnClose').onclick = closePopup;
  $('#btnTranslate').onclick = translate;
  $('#btnRestore').onclick = restore;
  $('#btnTryAgain').onclick = translate;
  $('#btnApplyLanguage').onclick = translate;
  $('#btnReset').onclick = () => {
    targetSelect.value = targetLanguage;
    $('#languagePicker').hidden = true;
    $('#btnMenu').focus();
  };
  $('#btnImproveTranslation').onclick = () => navigate('improve-translation.html');
  $('#btnSwitchInterfaces').onclick = () => {
    twpConfig.set('useOldPopup', 'no');
    navigate('popup.html');
  };
  $('#btnPopupPlacement').textContent = message(environment.root ? 'nativeUseToolbarPopup' : 'nativeUsePagePopup');
  $('#btnPopupPlacement').onclick = () => {
    twpConfig.set('popupPlacement', environment.root ? 'toolbar' : 'page');
    closePopup();
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
      : root.activeElement === $('#btnRestore') ? $('#btnTranslate') : $('#btnRestore');
    if (!next.disabled) next.focus();
  };
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    if (!$('#popupMenu').hidden) setMenu(false);
    else if (!$('#languagePicker').hidden) $('#btnReset').click();
    else closePopup();
  });
  window.addEventListener('unload', () => { closed = true; clearTimeout(pollTimer); systemTheme.removeListener(updateTheme); });
  // Paint the saved target immediately; determine availability from the actual content script.
  $('#btnTranslate').textContent = languages[targetLanguage] || targetLanguage;
  $('#btnTranslate').disabled = true;
  $('#btnRestore').disabled = true;
  if (environment.tab) activeTab = environment.tab;
  else [activeTab] = await new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
  if (activeTab && activeTab.url) {
    try { hostname = new URL(activeTab.url).hostname; } catch (_) { /* Non-web tabs have no site rules. */ }
  }
  async function show() {
    closed = false;
    revision++;
    loaded = false;
    indicatorInitialized = false;
    delete languageTabs.dataset.ready;
    languageTabs.dataset.keyboard = 'false';
    setMenu(false, false);
    $('#languagePicker').hidden = true;
    targetLanguage = twpConfig.get('targetLanguage');
    try { hostname = new URL(activeTab.url).hostname; } catch (_) { hostname = ''; }
    const snapshot = revision;
    // Source-language detection may be slow; never delay opening the panel for it.
    const currentOpening = ++opening;
    query('getOriginalTabLanguage').then((source) => {
      if (closed || currentOpening !== opening) return;
      sourceLanguage = source ? twpLang.fixTLanguageCode(source) || 'und' : 'und';
      render();
    });
    const [pageLanguage, pageService, initialState, pageDisplayMode] = await Promise.all([query('getCurrentPageLanguage'), query('getCurrentPageTranslatorService'), query('getCurrentPageLanguageState'), query('getTranslationDisplayMode')]);
    if (closed || snapshot !== revision) return;
    if ((initialState === 'translated' || initialState === 'translating') && pageLanguage && pageLanguage !== 'und' && pageLanguage !== 'original') targetLanguage = pageLanguage;
    targetSelect.value = targetLanguage;
    displayMode = initialState === 'translated' && pageDisplayMode ? pageDisplayMode : twpConfig.get('translationDisplayMode') || 'translation';
    if (pageService) service = pageService;
    updateTheme();
    await refresh();
  }
  await show();
  return {
    show,
    hide() { closed = true; revision++; clearTimeout(pollTimer); },
  };
};
