import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../../src/background/pagePopup.js', import.meta.url), 'utf8');
function background(overrides = {}) {
  const config = { useOldPopup: 'yes', popupPlacement: 'page', translateClickingOnce: 'no', enableIframePageTranslation: 'yes', ...overrides };
  const sent = [], popups = [], opened = [];
  let listener, onClick, onChange, onUpdated, onActivated, onRemoved;
  const timers = new Map();
  let nextTimer = 0;
  const chrome = {
    runtime: { id: 'test-extension', getURL: (path) => 'chrome-extension://test-extension' + path,
      onMessage: { addListener: (fn) => { listener = fn; } } },
    action: { setPopup: (args, cb) => { popups.push(args); cb?.(); },
      onClicked: { addListener: (fn) => { onClick = fn; } } },
    tabs: { query: (_, cb) => cb([]), onUpdated: { addListener: fn => { onUpdated = fn; } },
      onActivated: { addListener: fn => { onActivated = fn; } },
      onRemoved: { addListener: fn => { onRemoved = fn; } },
      sendMessage: (tabId, payload, options, callback) => {
        if (typeof options === 'function') { callback = options; options = undefined; }
        sent.push({ tabId, payload, options });
        callback?.(['toggleCompactPagePopup', 'isCompactPagePopupAvailable'].includes(payload.action) ? true : 'original');
      } },
  };
  vm.runInNewContext(code, { chrome, URL, console,
    setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout: id => timers.delete(id),
    platformInfo: { isMobile: { any: false } },
    twpConfig: { get: (key) => config[key], onReady: (fn) => { fn?.(); return Promise.resolve(); },
      onChanged: (fn) => { onChange = fn; } },
    checkedLastError: () => {}, tabsCreate: (url) => opened.push(url),
    fetch: async () => ({ ok: true, text: async () => 'fixture' }),
  });
  const sender = { id: 'test-extension', frameId: 0, tab: { id: 42 } };
  return { config, sent, popups, opened, chrome, onClick, onChange, onUpdated, onActivated, onRemoved, sender, timers,
    runTimers: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    message: (message, from = sender, respond = () => {}) => listener(message, from, respond) };
}

test('commands stay in the sender tab and retain the existing iframe preference', () => {
  const bg = background({ enableIframePageTranslation: 'no' });
  bg.message({ action: 'compactPagePopupCommand', tabId: 99, command: { action: 'translatePage', targetLanguage: 'ja' } });
  assert.equal(bg.sent[0].tabId, 42);
  assert.equal(bg.sent[0].options.frameId, 0);
  bg.config.enableIframePageTranslation = 'yes';
  bg.message({ action: 'compactPagePopupCommand', command: { action: 'translatePage', targetLanguage: 'en' } });
  assert.equal(bg.sent[1].options, undefined);
  bg.message({ action: 'compactPagePopupCommand', command: { action: 'restorePage' } });
  assert.equal(bg.sent[2].options, undefined);
});

test('rejects other senders, subframes, unknown commands, and arbitrary URLs', () => {
  const bg = background();
  const command = { action: 'compactPagePopupCommand', command: { action: 'restorePage' } };
  bg.message(command, { ...bg.sender, id: 'other-extension' });
  bg.message(command, { ...bg.sender, frameId: 1 });
  bg.message(command, { id: bg.sender.id });
  bg.message({ action: 'compactPagePopupCommand', command: { action: 'cleanUp' } });
  bg.message({ action: 'compactPagePopupOpen', url: 'javascript:alert(1)' });
  bg.message({ action: 'compactPagePopupOpen', url: 'https://unrelated.example/' });
  assert.equal(bg.sent.length, 0);
  assert.equal(bg.opened.length, 0);
  bg.message({ action: 'compactPagePopupOpen', url: 'chrome-extension://test-extension/options/options.html#style' });
  assert.equal(bg.opened.length, 1);
});

test('queries are restricted to the main frame and return the original response', () => {
  const bg = background();
  let result;
  assert.equal(bg.message({ action: 'compactPagePopupQuery', query: 'getCurrentPageLanguageState' }, bg.sender, value => { result = value; }), true);
  assert.equal(result, 'original');
  assert.equal(bg.sent[0].options.frameId, 0);
  bg.message({ action: 'compactPagePopupQuery', query: 'restorePage' });
  assert.equal(bg.sent.length, 1);
});

test('only ready compact page panels take over the toolbar; rollback restores native popup', () => {
  const bg = background();
  bg.message({ action: 'compactPagePopupReady' });
  assert.equal(bg.popups.at(-1).popup, '');
  bg.config.popupPlacement = 'toolbar';
  bg.message({ action: 'compactPagePopupReady' });
  assert.equal(bg.popups.at(-1).popup, 'popup/old-popup.html');
  bg.config.useOldPopup = 'no';
  bg.message({ action: 'compactPagePopupReady' });
  assert.equal(bg.popups.at(-1).popup, 'popup/popup.html');
});

test('toolbar click opens the page panel without translating the page', async () => {
  const bg = background();
  await bg.onClick({ id: 42 });
  assert.equal(bg.sent.length, 1);
  assert.equal(bg.sent[0].payload.action, 'toggleCompactPagePopup');
  assert.equal(bg.sent[0].options.frameId, 0);
});

test('failed panel opening falls back to the native popup', async () => {
  const bg = background();
  bg.chrome.tabs.sendMessage = (_id, _payload, _options, callback) => callback(false);
  await bg.onClick({ id: 42 });
  assert.equal(bg.popups.at(-1).popup, 'popup/old-popup.html');
});

test('loading completion restores a ready page panel without a new ready notification', () => {
  const bg = background();
  bg.message({ action: 'compactPagePopupReady' });
  bg.onUpdated(42, { status: 'loading' });
  assert.equal(bg.popups.at(-1).popup, 'popup/old-popup.html');
  bg.onUpdated(42, { status: 'complete' });
  assert.equal(bg.popups.at(-1).popup, '');
});

test('returning to a tab rechecks its panel availability', () => {
  const bg = background();
  bg.onUpdated(42, { status: 'loading' });
  bg.onActivated({ tabId: 42 });
  assert.equal(bg.popups.at(-1).popup, '');
  assert.equal(bg.sent.at(-1).payload.action, 'isCompactPagePopupAvailable');
});

test('late unavailable replies cannot overwrite a newer ready notification', () => {
  const bg = background();
  let reply;
  bg.chrome.tabs.sendMessage = (_id, _payload, _options, cb) => { reply = cb; };
  bg.onUpdated(42, { status: 'complete' });
  bg.message({ action: 'compactPagePopupReady' });
  reply(false);
  assert.equal(bg.popups.at(-1).popup, '');
  assert.equal(bg.timers.size, 0);
});

test('old readiness replies cannot override a newer navigation', () => {
  const bg = background();
  let reply;
  bg.chrome.tabs.sendMessage = (_id, _payload, _options, cb) => { reply = cb; };
  bg.onActivated({ tabId: 42 });
  bg.onUpdated(42, { status: 'loading' });
  reply(true);
  assert.equal(bg.popups.at(-1).popup, 'popup/old-popup.html');
});

test('a stale opening failure cannot overwrite a newer ready document', async () => {
  const bg = background();
  let reply, sent;
  const requested = new Promise(resolve => { sent = resolve; });
  bg.chrome.tabs.sendMessage = (_id, _payload, _options, cb) => { reply = cb; sent(); };
  const opening = bg.onClick({ id: 42 });
  await requested;
  bg.message({ action: 'compactPagePopupReady' });
  reply(false);
  await opening;
  assert.equal(bg.popups.at(-1).popup, '');
  assert.equal(bg.timers.size, 0);
});

test('transient opening failure recovers without replaying a toggle or translation', async () => {
  const bg = background();
  const send = bg.chrome.tabs.sendMessage;
  bg.chrome.tabs.sendMessage = (_id, _payload, _options, callback) => callback(false);
  await bg.onClick({ id: 42 });
  assert.equal(bg.popups.at(-1).popup, 'popup/old-popup.html');
  bg.chrome.tabs.sendMessage = send;
  bg.runTimers();
  assert.equal(bg.popups.at(-1).popup, '');
  assert.equal(bg.timers.size, 0);
  assert.deepEqual(bg.sent.map(item => item.payload.action), ['isCompactPagePopupAvailable']);
});

test('unavailable pages use bounded retries and keep the native popup', () => {
  const bg = background();
  let probes = 0;
  bg.chrome.tabs.sendMessage = (_id, _payload, _options, callback) => {
    probes++;
    bg.chrome.runtime.lastError = { message: 'No receiver' };
    callback(undefined);
    delete bg.chrome.runtime.lastError;
  };
  bg.onUpdated(42, { status: 'complete' });
  bg.runTimers();
  bg.runTimers();
  bg.runTimers();
  assert.equal(probes, 3);
  assert.equal(bg.timers.size, 0);
  assert.equal(bg.popups.at(-1).popup, 'popup/old-popup.html');
});

test('pending recovery respects toolbar preference changes', async () => {
  const bg = background();
  bg.chrome.tabs.sendMessage = (_id, _payload, _options, callback) => callback(false);
  await bg.onClick({ id: 42 });
  bg.config.popupPlacement = 'toolbar';
  bg.runTimers();
  assert.equal(bg.timers.size, 0);
  assert.equal(bg.popups.at(-1).popup, 'popup/old-popup.html');
});

test('closing a tab cancels recovery and ignores outstanding replies', () => {
  const bg = background();
  bg.chrome.tabs.sendMessage = (_id, _payload, _options, callback) => callback(false);
  bg.onUpdated(42, { status: 'complete' });
  assert.equal(bg.timers.size, 1);
  bg.onRemoved(42);
  assert.equal(bg.timers.size, 0);
  let reply;
  bg.chrome.tabs.sendMessage = (_id, _payload, _options, cb) => { reply = cb; };
  bg.onActivated({ tabId: 43 });
  bg.onRemoved(43);
  const count = bg.popups.length;
  reply(true);
  assert.equal(bg.popups.length, count);
});

test('bilingual mode passes through only validated display modes to the sender tab', () => {
  const bg = background({enableIframePageTranslation:'no'});
  bg.message({action:'compactPagePopupCommand', command:{action:'translatePage',targetLanguage:'ja',displayMode:'bilingual'}});
  assert.deepEqual(JSON.parse(JSON.stringify(bg.sent[0].payload)), {action:'translatePage',targetLanguage:'ja',displayMode:'bilingual'});
  assert.equal(bg.sent[0].options.frameId,0);
  bg.message({action:'compactPagePopupCommand', command:{action:'translatePage',targetLanguage:'ja',displayMode:'invalid'}});
  assert.equal(bg.sent[1].payload.displayMode,undefined);
  bg.message({action:'compactPagePopupQuery',query:'getTranslationDisplayMode'});
  assert.equal(bg.sent[2].payload.action,'getTranslationDisplayMode');
});
