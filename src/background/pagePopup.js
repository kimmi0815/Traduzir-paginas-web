"use strict";

// UI transport only. All translation commands still use the existing page translator.
(() => {
  const prefersPage = () => !platformInfo.isMobile.any &&
    twpConfig.get('useOldPopup') === 'yes' &&
    twpConfig.get('popupPlacement') === 'page' &&
    twpConfig.get('translateClickingOnce') !== 'yes';
  const nativePopup = () => twpConfig.get('translateClickingOnce') === 'yes' ? '' :
    twpConfig.get('useOldPopup') === 'yes' ? 'popup/old-popup.html' : 'popup/popup.html';
  const queries = new Set(['getOriginalTabLanguage', 'getCurrentPageLanguage',
    'getCurrentPageLanguageState', 'getCurrentPageTranslatorService', 'getTranslationDisplayMode']);
  let assetsPromise;
  // A late reply must not overwrite a newer document's ready notification.
  const checks = new Map();
  function beginCheck(tabId) {
    clearTimeout(checks.get(tabId)?.timer);
    const check = {};
    checks.set(tabId, check);
    return check;
  }
  function retryCheck(tabId, check, retries) {
    if (retries > 0) check.timer = setTimeout(() => {
      if (checks.get(tabId) === check) syncTab(tabId, retries - 1);
    }, 500);
  }
  function assets() {
    if (!assetsPromise) {
      assetsPromise = Promise.all(['/popup/old-popup.html', '/lib/ui-theme.css', '/popup/old-popup.css']
        .map(async (path) => {
          const response = await fetch(chrome.runtime.getURL(path));
          if (!response.ok) throw new Error('Popup resource unavailable');
          return response.text();
        })).then(([html, theme, css]) => ({ html, css: theme + '\n' + css }))
        .catch((error) => { assetsPromise = null; throw error; });
    }
    return assetsPromise;
  }
  function setPopup(tabId, ready) {
    chrome.action.setPopup({ tabId, popup: ready && prefersPage() ? '' : nativePopup() }, checkedLastError);
  }
  function syncTab(tabId, retries = 2) {
    const check = beginCheck(tabId);
    chrome.tabs.sendMessage(tabId, { action: 'isCompactPagePopupAvailable' }, { frameId: 0 }, (ready) => {
      const failed = chrome.runtime.lastError;
      if (checks.get(tabId) !== check) return;
      const available = !failed && ready === true;
      setPopup(tabId, available);
      if (!available && prefersPage()) retryCheck(tabId, check, retries);
    });
  }
  function syncAll() {
    if (platformInfo.isMobile.any) return;
    chrome.tabs.query({}, (tabs) => tabs.forEach((tab) => syncTab(tab.id)));
  }
  chrome.runtime.onMessage.addListener((request, sender, respond) => {
    if (!sender.tab || sender.frameId !== 0 || sender.id !== chrome.runtime.id) return;
    const tabId = sender.tab.id; // Never accept a page-supplied destination tab.
    if (request.action === 'compactPagePopupReady') {
      twpConfig.onReady(() => {
        beginCheck(tabId);
        setPopup(tabId, true);
      });
    } else if (request.action === 'compactPagePopupQuery' && queries.has(request.query)) {
      chrome.tabs.sendMessage(tabId, { action: request.query }, { frameId: 0 }, (value) => {
        const failed = chrome.runtime.lastError;
        respond(failed ? undefined : value);
      });
      return true;
    } else if (request.action === 'compactPagePopupCommand') {
      let payload;
      const command = request.command;
      if (command?.action === 'translatePage' && typeof command.targetLanguage === 'string' &&
          command.targetLanguage.length < 32) {
        payload = { action: 'translatePage', targetLanguage: command.targetLanguage };
        if (['translation', 'bilingual'].includes(command.displayMode)) payload.displayMode = command.displayMode;
      } else if (command?.action === 'restorePage') payload = { action: 'restorePage' };
      else if (command?.action === 'swapTranslationService' && ['google', 'bing', 'yandex'].includes(command.newServiceName)) {
        payload = { action: 'swapTranslationService', newServiceName: command.newServiceName };
      }
      if (!payload) return;
      twpConfig.onReady(() => {
        if (payload.action === 'translatePage' && twpConfig.get('enableIframePageTranslation') !== 'yes') {
          chrome.tabs.sendMessage(tabId, payload, { frameId: 0 }, checkedLastError);
        } else chrome.tabs.sendMessage(tabId, payload, checkedLastError);
      });
    } else if (request.action === 'compactPagePopupOpen') {
      try {
        const url = new URL(request.url);
        const extensionBase = new URL(chrome.runtime.getURL('/'));
        const internal = url.protocol === extensionBase.protocol && url.host === extensionBase.host &&
          ['/options/options.html', '/popup/improve-translation.html', '/popup/popup.html'].includes(url.pathname);
        const external = url.protocol === 'https:' && !url.username && !url.password &&
          ['pdf.translatewebpages.org', 'translate.google.com', 'translate.yandex.com'].includes(url.hostname);
        if (internal || external) tabsCreate(url.href);
      } catch (_) { /* Ignore invalid destinations. */ }
    }
  });
  chrome.action.onClicked.addListener(async (tab) => {
    await twpConfig.onReady();
    if (!prefersPage()) return;
    const check = beginCheck(tab.id);
    try {
      const resources = await assets();
      if (checks.get(tab.id) !== check || !prefersPage()) return;
      const shown = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: 'toggleCompactPagePopup', resources }, { frameId: 0 }, (result) => {
          const failed = chrome.runtime.lastError;
          resolve(!failed && result === true);
        });
      });
      if (shown) return;
    } catch (error) { console.warn('Page popup unavailable:', error); }
    if (checks.get(tab.id) !== check || !prefersPage()) return;
    // Restricted pages and tabs that have not been reloaded keep the native popup.
    chrome.action.setPopup({ tabId: tab.id, popup: 'popup/old-popup.html' }, () => {
      checkedLastError();
      if (chrome.action.openPopup) chrome.action.openPopup({}, checkedLastError);
    });
    // Recover for the next click if this was only a transient transport failure.
    retryCheck(tab.id, check, 2);
  });
  chrome.tabs.onUpdated.addListener((tabId, change) => {
    if (change.status === 'loading') twpConfig.onReady(() => {
      if (!platformInfo.isMobile.any) {
        beginCheck(tabId);
        setPopup(tabId, false);
      }
    });
    if (change.status === 'complete') twpConfig.onReady(() => {
      if (!platformInfo.isMobile.any) syncTab(tabId);
    });
  });
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    twpConfig.onReady(() => {
      if (!platformInfo.isMobile.any) syncTab(tabId);
    });
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    clearTimeout(checks.get(tabId)?.timer);
    checks.delete(tabId);
  });
  twpConfig.onReady(() => {
    syncAll();
    twpConfig.onChanged((name) => {
      if (['popupPlacement', 'useOldPopup', 'translateClickingOnce'].includes(name)) syncAll();
    });
  });
})();
