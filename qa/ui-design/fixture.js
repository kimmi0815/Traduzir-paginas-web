/* Browser-only mock. Never included in extension builds. */
(() => {
  const params = new URLSearchParams(location.search);
  const locale = params.get('locale') || 'ja';
  const listeners = [];
  const messageListeners = [];
  const saved = JSON.parse(sessionStorage.getItem('twp-ui-fixture') || '{}');
  const config = { uiLanguage: locale, targetLanguage: 'ja', targetLanguageTextTranslation: 'ja', targetLanguages: ['ja','en','es'], darkMode: 'no', ...saved };
  if (params.has('locale')) config.uiLanguage = locale;
  if (params.has('iframes')) config.enableIframePageTranslation = params.get('iframes');
  if (params.has('target')) config.targetLanguage = params.get('target');
  if (params.has('service')) config.pageTranslatorService = params.get('service');
  if (params.has('theme')) config.darkMode = params.get('theme') === 'dark' ? 'yes' : 'no';
  let state = params.get('state') || 'original';
  let pageLanguage = state === 'translated' ? config.targetLanguage : 'en';
  let service = config.pageTranslatorService || 'google';
  let version = 0;
  const trace = [];
  const manifestPromise = fetch('/manifest.json').then(r=>r.json());
  let manifest = {name:'TWP',version:'10.2.5.0',commands:{}};
  manifestPromise.then(value => manifest=value);
  let english = {};
  const englishReady = fetch('/_locales/en/messages.json').then(r=>r.json()).then(v=>english=v);
  const fakeTab = { id:1, url:'https://en.wikipedia.org/wiki/Translation' };
  function log(entry) {
    trace.push(entry);
    let output = document.getElementById('fixture-trace');
    if (!output) { output=document.createElement('script'); output.id='fixture-trace'; output.type='application/json'; document.body.appendChild(output); }
    output.textContent=JSON.stringify(trace);
  }
  window.chrome = {
    i18n:{ getUILanguage:()=>locale, getMessage:(key)=>Object.entries(english).find(([name])=>name.toLowerCase()===key.toLowerCase())?.[1].message || '', getAcceptLanguages: callback=>englishReady.then(()=>callback(['ja','en'])) },
    runtime:{
      id: 'twp-ui-fixture',
      onMessage: {addListener:fn=>messageListeners.push(fn)},
      getURL:path=>new URL(path,location.origin).href, getManifest:()=>manifest,
      sendMessage:(payload,callback)=>{
        if (payload.action === 'compactPagePopupQuery') return chrome.tabs.sendMessage(1,{action:payload.query},{frameId:0},callback);
        if (payload.action === 'compactPagePopupCommand') {
          const scope = payload.command.action === 'translatePage' && config.enableIframePageTranslation !== 'yes' ? {frameId:0} : undefined;
          return chrome.tabs.sendMessage(1,payload.command,scope,callback);
        }
        if (payload.action === 'compactPagePopupOpen') log({opened:payload.url});
        if(callback)callback(payload.action==='getTabMimeType'?'text/html':undefined);
      }, reload:()=>location.reload(),
    },
    storage:{
      onChanged:{addListener:fn=>listeners.push(fn)},
      local:{get:(_,callback)=>queueMicrotask(()=>callback(config)),set:values=>{
        const changes={};for(const [name,newValue] of Object.entries(values)){changes[name]={newValue,oldValue:config[name]};config[name]=newValue;}
        sessionStorage.setItem('twp-ui-fixture',JSON.stringify(config));
        for(const listener of listeners)listener(changes,'local');
      }},
    },
    tabs:{
      query:(_,callback)=>queueMicrotask(()=>callback([fakeTab])),
      create:({url},callback)=>{log({opened:url});if(callback)callback(fakeTab)},
      sendMessage:(id,payload,options,callback)=>{
        if(typeof options==='function') {callback=options; options=undefined;}
        const responses={getOriginalTabLanguage:params.get('source')||'en',getCurrentPageLanguage:pageLanguage,getCurrentPageLanguageState:state,getCurrentPageTranslatorService:service};
        if(payload.action.startsWith('get')) {
          const delay=payload.action==='getOriginalTabLanguage'?Number(params.get('sourceDelay')||0):0;
          setTimeout(()=>callback?.(state==='unavailable'?undefined:responses[payload.action]),delay);return;
        }
        log({action:payload.action,...payload,frameId:options?.frameId??'all'});
        if(payload.action==='translatePage'){
          state='translating';pageLanguage=payload.targetLanguage;const current=++version;
          setTimeout(()=>{if(current===version)state=params.get('fail')==='yes'?'error':'translated'},800);
        }
        if(payload.action==='restorePage'){version++;state='original';pageLanguage='en';}
        if(payload.action==='swapTranslationService')service=payload.newServiceName;
        callback?.();
      },
    },
    commands:{getAll:callback=>manifestPromise.then(value=>callback(Object.entries(value.commands).map(([name,v])=>({name,description:v.description,shortcut:v.suggested_key?.default||''}))))},
    permissions:{request:(_,callback)=>callback?.(false),remove:()=>{}},
  };
  window.twpFixture = {
    async togglePagePopup() {
      const [html, theme, css] = await Promise.all(['/popup/old-popup.html','/lib/ui-theme.css','/popup/old-popup.css'].map(path=>fetch(path).then(r=>r.text())));
      return new Promise(resolve => {
        for (const listener of messageListeners) listener({action:'toggleCompactPagePopup',resources:{html,css:theme+'\n'+css}}, {id:'twp-ui-fixture'}, resolve);
      });
    },
  };
})();
