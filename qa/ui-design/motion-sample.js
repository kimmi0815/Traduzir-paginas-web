'use strict';
(() => {
  // Authored English/Japanese pairs. The translator still discovers, schedules,
  // writes and restores real text nodes; only extension services are mocked.
  const rows = [
    ['h1', [['A quieter way to read', '読む時間を、もっと自然に。']]],
    ['p', [['A good reading tool lets the story stay in focus. You open a page, find an interesting sentence, and keep going. Translation should feel like a small part of that familiar rhythm, with the meaning ready when you need it.', '良い読書の道具は、物語への集中を妨げません。ページを開き、気になる一文を見つけ、その先へ読み進める。翻訳もその自然な流れの一部として、必要なときに意味を届けてほしいものです。']]],
    ['p', [['The important thing is ', '大切なのは、'], ['keeping your place', '読んでいた場所を見失わないこと', 'strong'], ['. A subtle transition can help your eyes follow a change without asking for attention. The original sentence stays above the translated one, so you can look back whenever a word or expression makes you curious.', 'です。控えめな動きなら、注意を奪わずに変化を目で追えます。対訳では原文が訳文の上に残るので、気になる単語や表現にいつでも戻れます。']]],
    ['p', [['Try following ', 'この'], ['this small link', '小さなリンク', 'a'], [' to the next section. Links, emphasis, and the structure of a paragraph should remain familiar after translation. An animation has done its job when the page still feels like the same page, only a little easier to understand.', 'から次の節へ進んでみてください。翻訳後もリンクや強調、段落の構成はそのままです。同じページを、少しだけ理解しやすく感じられる。そのくらいが演出の役割です。']]],
    ['h2', [['Room for the words', '言葉を読むための余白']]],
    ['li', [['Keep the original close enough to compare at a glance.', '原文と訳文を、一目で比べられる距離に。']]],
    ['li', [['Let a sentence appear as a whole, instead of one character at a time.', '文字を一つずつ出さず、文のまとまりで表示する。']]],
    ['li', [['Stop the motion when the reader starts scrolling.', '読み手がスクロールを始めたら、動きは止める。']]],
    ['p', [['Some pages arrive in pieces. A headline might be ready before a longer paragraph, while another part of the article takes a little more time. Each result should become readable as soon as it arrives. Waiting for an elegant sequence would make the tool feel slower, even if the animation itself looked pleasant.', 'ページの内容は、一度に届くとは限りません。見出しが先に準備でき、長い段落や記事の別の部分には少し時間がかかることもあります。結果は届いたらすぐに読めることが大切です。美しい順番で見せるために待たせてしまえば、動きが心地よくても道具は遅く感じられます。']]],
    ['p', [['This is why the movement here is deliberately small. A few pixels can suggest that something has changed, without shifting the surrounding layout. The words do not shrink, bounce, or become blurred. Their final position is the same in every example, so the comparison is about how they arrive rather than where they end up.', 'ここで動きを小さく抑えているのは、そのためです。数ピクセルの移動でも、周りのレイアウトを動かさずに変化を伝えられます。文字を縮めたり、弾ませたり、ぼかしたりはしません。どの案でも最後の位置は同じ。比べたいのは配置ではなく、現れ方です。']]],
    ['h2', [['Read at your own pace', '自分のペースで読む']]],
    ['p', [['On a long article, attention moves naturally between headings, paragraphs, and notes. A reader may pause over a single phrase or move quickly through a familiar section. The interface should leave those decisions to the reader. Repeating an entrance effect every time new content comes into view would turn a useful detail into an interruption.', '長い記事では、見出しや段落、注釈へと自然に注意が移ります。一つの表現で立ち止まることも、知っている節を素早く読み進めることもあるでしょう。その判断は読み手に委ねたいものです。新しい内容が視界に入るたびに演出を繰り返すと、便利な工夫も読書の妨げになってしまいます。']]],
    ['p', [['There is also a difference between reading a translation and studying a language. Sometimes you only want to know what happened. At other times, you want to compare the wording and notice how an idea changes shape in another language. Both modes can share the same calm visual language, while making different amounts of information available.', '翻訳を読むことと、言葉を学ぶことにも違いがあります。何が起きたかだけを知りたいときもあれば、表現を比べ、別の言語で考えがどう形を変えるかを観察したいときもあります。表示する情報量を変えても、二つのモードは同じ落ち着いた見た目を共有できます。']]],
    ['p', [['Small interactions matter most when they happen often. A button should respond immediately. Restoring the source text should not require waiting for an animation to finish. If you change your mind halfway through, the old result should stay cancelled. The best motion supports a decision that has already been made instead of slowing that decision down.', '小さな操作ほど、繰り返し使うときに違いが出ます。ボタンはすぐに反応し、原文への復元も動きの終了を待たせない。途中で気が変わったら、以前の結果は取り消されたままにする。良い動きは判断を遅らせず、読み手が決めたことを支えます。']]],
    ['p', [['The examples use the same sentences and fixed translations. That keeps the comparison fair: differences in network conditions or the wording returned by a translation service cannot change the impression. Once the movement feels right in this small study, it can be tested with a wider range of layouts and real pages in the browser.', 'この比較では、同じ英文と固定の訳文を使っています。通信の状態や翻訳サービスの言い回しによって印象が変わらないようにするためです。この小さな試作で動きの感触を確かめたら、さまざまなレイアウトや実際のブラウザのページへ検証を広げられます。']]],
    ['p', [['For now, take a moment to try the three versions again. The first is immediate, the second gently changes its opacity, and the third adds a short upward movement. There is no need for the most noticeable version to win. Choose the one that lets you return to the article with the least effort, and that still feels comfortable after several replays.', 'まずは三つの案をもう一度試してみてください。一つ目は即時表示、二つ目は濃さの変化、三つ目は短い浮き上がりを加えています。最も目立つ案が優れているとは限りません。何度再生しても心地よく、自然に記事へ意識を戻せる案を選んでください。']]],
  ];
  const article = document.querySelector('#sample');
  const translations = new Map();
  let list;
  for (const [index, [tag, parts]] of rows.entries()) {
    const block = document.createElement(tag);
    if (tag === 'h2' && !article.querySelector('#reading-notes')) block.id = 'reading-notes';
    const text = document.createElement('span');
    text.dataset.previewTranslation = String(index);
    for (const [en, ja, inline] of parts) {
      translations.set(en.trim(), ja);
      const child = inline ? document.createElement(inline) : document.createTextNode(en);
      if (inline) child.textContent = en;
      if (inline === 'a') child.href = '#reading-notes';
      text.append(child);
    }
    block.append(text);
    if (tag === 'li') { if (!list) { list = document.createElement('ul'); article.append(list); } list.append(block); }
    else { list = null; article.append(block); }
  }
  const targets = [...article.querySelectorAll('[data-preview-translation]')];
  const originalText = new Map(targets.map(target => [target, target.textContent]));
  const expectedText = new Map(targets.map((target, index) => [target, rows[index][1].map(part => part[1].trim()).join(' ')]));
  const preset = new URLSearchParams(location.search).get('preset');
  document.body.dataset.preset = ['instant','fade','rise'].includes(preset) ? preset : 'instant';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const now = () => performance.timeOrigin + performance.now();
  const pending = new Map();
  let epoch = 0, startedAt = 0, delayed = false, requests = 0;
  let running = false, motionEnabled = false, eligible = new Set(), played = new Set(), changed = new Set();
  let events = [], responses = [], unknown = [];
  function report(text) { parent.motionStudy?.state(frameElement, text); }
  function cancelRequests() {
    epoch++;
    for (const [timer, callback] of pending) { clearTimeout(timer); callback([]); }
    pending.clear();
  }
  function finishMotion() {
    motionEnabled = false;
    for (const target of targets) target.classList.remove('revealing');
  }
  function translated(target) { return target.textContent !== originalText.get(target); }
  const observer = new MutationObserver(records => {
    if (!running) return;
    const touched = new Set();
    for (const record of records) {
      const element = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
      const target = element.closest('[data-preview-translation]');
      if (target && translated(target)) touched.add(target);
    }
    for (const target of touched) {
      if (changed.has(target)) continue;
      changed.add(target);
      const animate = motionEnabled && !reduced.matches && eligible.has(target) && document.body.dataset.preset !== 'instant';
      if (animate) { played.add(target); target.classList.add('revealing'); }
      events.push({id:target.dataset.previewTranslation, at:now()-startedAt, animated:animate});
    }
    if (changed.size === targets.length) report('翻訳済み');
  });
  for (const target of targets) target.addEventListener('animationend', () => target.classList.remove('revealing'));
  reduced.addEventListener('change', () => { if (reduced.matches) finishMotion(); });
  window.addEventListener('scroll', finishMotion, {passive:true});
  document.addEventListener('visibilitychange', () => { if (document.hidden) finishMotion(); });
  const config = {targetLanguage:'ja', targetLanguages:['ja'], pageTranslatorService:'google', customDictionary:[],
    dontSortResults:'no', alwaysTranslateSites:[], neverTranslateSites:[], alwaysTranslateLangs:[],
    showOriginalTextWhenHovering:'no', darkMode:'auto', translateDynamicallyCreatedContent:'yes'};
  window.twpConfig = {get:key=>config[key], set:(key,value)=>{config[key]=value;},
    onReady:callback=>{callback?.();return Promise.resolve();}, onChanged:()=>{}};
  window.twpLang = {fixTLanguageCode:code=>code};
  window.platformInfo = {isMobile:{any:false}};
  window.checkedLastError = ()=>{};
  function translate(text) {
    if (!text.trim()) return text;
    if (!translations.has(text.trim())) { unknown.push(text); return text; }
    return translations.get(text.trim());
  }
  window.chrome = {extension:{inIncognitoContext:false}, runtime:{getURL:path=>new URL(path,location.origin).href,
    onMessage:{addListener(){}}, sendMessage(request, callback=()=>{}) {
      if (request.action === 'getTabHostName') return callback('motion.test');
      if (request.action === 'getMainFrameTabLanguage' || request.action === 'detectTabLanguage') return callback('en');
      if (request.action === 'getMainFramePageLanguageState') return callback('original');
      if (request.action === 'translateHTML') {
        const requestEpoch = epoch;
        const arrival = delayed && requests++ > 0 ? 900 : 300;
        const result = request.sourceArray2d.map(row=>row.map(translate));
        const timer = setTimeout(() => {
          pending.delete(timer);
          if (requestEpoch !== epoch) return callback([]);
          responses.push({arrival, at:now()-startedAt});
          callback(result);
        }, Math.max(0, startedAt+arrival-now()));
        pending.set(timer,callback);
      } else if (request.action === 'translateText') callback(request.sourceArray.map(translate));
      else if (request.action === 'translateSingleText') callback(request.source);
      else callback();
    }}};
  function restore() {
    running = false;
    observer.disconnect();
    finishMotion();
    cancelRequests();
    window.pageTranslator?.restorePage?.();
    changed = new Set(); played = new Set(); events = []; responses = []; unknown = [];
    report('原文');
  }
  window.motionSample = {
    restore, finishMotion,
    play(options) {
      restore();
      startedAt = options.startAt; delayed = options.delayed; requests = 0;
      const frameRect = frameElement.getBoundingClientRect();
      eligible = new Set(targets.filter(target => {
        const rect = target.getBoundingClientRect();
        return rect.height > 0 && frameRect.top+rect.bottom > 0 && frameRect.top+rect.top < parent.innerHeight &&
          frameRect.left+rect.right > 0 && frameRect.left+rect.left < parent.innerWidth;
      }));
      const duration = (document.body.dataset.preset === 'fade' ? 150 : 180) * options.speed;
      article.style.setProperty('--duration', `${duration}ms`);
      motionEnabled = !document.hidden && !parent.document.hidden && !reduced.matches;
      running = true;
      observer.observe(article, {childList:true, characterData:true, subtree:true});
      pageTranslator.translatePage('ja', options.mode);
      report('翻訳中…');
    },
    inspect() { return {original:targets.every(target=>target.textContent===originalText.get(target)),
      complete:targets.every(target=>target.textContent.trim()===expectedText.get(target)),
      eligible:[...eligible].map(target=>target.dataset.previewTranslation), played:[...played].map(target=>target.dataset.previewTranslation),
      events, responses, unknown, pending:pending.size, active:article.querySelectorAll('.revealing').length}; },
  };
  new ResizeObserver(() => { if (frameElement) frameElement.style.height = `${Math.ceil(article.getBoundingClientRect().height)}px`; }).observe(article);
})();
