"use strict";

// A closed shadow root isolates the popup's CSS and IDs from the translated page.
// No extension HTML, scripts, or privileged iframe are exposed as web-accessible resources.
(async () => {
  await twpConfig.onReady();
  if (window !== window.top || platformInfo.isMobile.any || !/^https?:$|^file:$/.test(location.protocol)) return;
  let host;
  let root;
  let controller;
  let initializing;
  let previousFocus;
  let visible = false;
  let toggleQueue = Promise.resolve();
  const tab = { id: 0, url: location.href };

  function request(payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(payload, (result) => {
        const failed = chrome.runtime.lastError;
        resolve(failed ? undefined : result);
      });
    });
  }
  function close(restoreFocus = true) {
    if (!visible) return;
    visible = false;
    controller?.hide();
    host.hidden = true;
    if (typeof host.hidePopover === 'function' && host.matches(':popover-open')) host.hidePopover();
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('visibilitychange', visibilityChanged);
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  function outside(event) {
    if (!event.composedPath().includes(host)) close(false);
  }
  function visibilityChanged() {
    if (document.hidden) close(false);
  }
  async function create(resources) {
    const template = new DOMParser().parseFromString(resources.html, 'text/html');
    host = document.createElement('div');
    host.className = 'notranslate';
    host.setAttribute('translate', 'no');
    host.setAttribute('data-twp-page-popup', '');
    host.hidden = true;
    // Inline important declarations also protect the host against broad page styles.
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:12px 16px auto auto!important;' +
      'width:280px!important;max-width:calc(100vw - 32px)!important;height:auto!important;' +
      'max-height:calc(100vh - 24px)!important;margin:0!important;padding:0!important;border:0!important;' +
      'background:transparent!important;border-radius:12px!important;overflow:visible!important;' +
      'box-shadow:0 0 0 1px #20212433,0 4px 8px #20212426,0 12px 24px #20212426!important;' +
      'z-index:2147483647!important;opacity:1!important;visibility:visible!important;transform:none!important;' +
      'zoom:1!important;pointer-events:auto!important;';
    root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = resources.css.replace(/:root\b|\bhtml(?=\s*\{)|\bbody\b/g, '.popup-surface') + `
      :host([hidden]) { display: none !important; }
      :host::backdrop { background: transparent; pointer-events: none; }
      .popup-surface { width: 100%; max-height: calc(100vh - 24px); overflow: auto; overscroll-behavior: contain; }
      /* The dialog receives initial focus for Escape/Tab, but is not a control.
         Keep focus-visible outlines on its interactive children. */
      .popup-surface:focus { outline: none; }
      main { width: 100%; }
    `;
    const surface = document.createElement('div');
    surface.className = 'popup-surface';
    surface.setAttribute('role', 'dialog');
    surface.setAttribute('aria-label', 'TWP');
    surface.tabIndex = -1;
    surface.append(template.querySelector('main'), template.querySelector('#btnOptions'));
    root.append(style, surface);
    // Prefer the browser's top layer without a modal backdrop or a focus trap.
    if (typeof host.showPopover === 'function') host.setAttribute('popover', 'manual');
    document.documentElement.append(host);
    controller = await twpCompactPopup({
      root, surface, tab,
      close: () => close(),
      query: (query) => request({ action: 'compactPagePopupQuery', query }),
      command: (command) => request({ action: 'compactPagePopupCommand', command }),
      openUrl: (url) => request({ action: 'compactPagePopupOpen', url }),
      navigate: (path) => {
        request({ action: 'compactPagePopupOpen', url: chrome.runtime.getURL('/popup/' + path) });
        close();
      },
    });
    // Do not let page-level keyboard handlers react to interactions with the popup.
    root.addEventListener('keydown', (event) => event.stopPropagation());
    root.addEventListener('keyup', (event) => event.stopPropagation());
  }
  async function toggle(resources) {
    if (visible) { close(); return; }
    const firstOpen = !initializing;
    if (!initializing) initializing = create(resources).catch((error) => {
      host?.remove();
      host = null;
      initializing = null;
      throw error;
    });
    await initializing;
    if (document.hidden) return;
    previousFocus = document.activeElement;
    tab.url = location.href;
    if (!firstOpen) await controller.show();
    if (document.hidden) { controller.hide(); return; }
    host.hidden = false;
    visible = true;
    if (typeof host.showPopover === 'function') host.showPopover();
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('visibilitychange', visibilityChanged);
    root.querySelector('[role="dialog"]')?.focus({ preventScroll: true });
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message.action === 'isCompactPagePopupAvailable') respond(true);
    else if (message.action === 'toggleCompactPagePopup') {
      toggleQueue = toggleQueue.catch(() => {}).then(() => toggle(message.resources));
      toggleQueue.then(() => respond(true), (error) => {
        console.warn('Unable to show TWP page popup:', error);
        respond(false);
      });
      return true;
    }
  });
  twpConfig.onReady(() => {
    request({ action: 'compactPagePopupReady' });
    twpConfig.onChanged((name) => {
      if (name === 'popupPlacement' || name === 'useOldPopup') close();
    });
  });
})();
