// NODE_PATH=<directory containing playwright> node --test qa/ui-design/bilingual.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');

test('real translator: bilingual order, live links, dynamic text, restore and stale replies', async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<main><h1>Heading</h1><p id="paragraph">Hello <a id="link" href="#read">world</a>.</p><ul><li>First item</li></ul><table><tbody><tr><td>Cell text</td></tr></tbody></table><div><p>Nested paragraph</p></div></main>');
    const original = await page.locator('main').innerHTML();
    await page.evaluate(() => {
      window.translationRequests = [];
      window.delayTranslations = false;
      window.pendingTranslations = [];
      window.clicks = 0;
      document.querySelector('#link').onclick = event => {event.preventDefault(); window.clicks++;};
      const config = {targetLanguage:'ja', targetLanguages:['ja'], pageTranslatorService:'google', customDictionary:[], dontSortResults:'no', alwaysTranslateSites:[], neverTranslateSites:[], alwaysTranslateLangs:[], translateDynamicallyCreatedContent:'yes'};
      window.twpConfig = {get:key=>config[key], set:(key,value)=>config[key]=value, onReady:()=>Promise.resolve(), onChanged:()=>{}};
      window.twpLang = {fixTLanguageCode:code=>code};
      window.platformInfo = {isMobile:{any:false}};
      window.checkedLastError = ()=>{};
      window.showOriginal = {isEnabled:false, enable(){}, disable(){}, enabledObserverSubscribe(){}};
      window.chrome = {extension:{inIncognitoContext:false}, runtime:{onMessage:{addListener(){}}, sendMessage(request, callback=()=>{}) {
        if(request.action==='getTabHostName') return callback('fixture.test');
        if(request.action==='detectTabLanguage') return callback('en');
        if(request.action==='translateHTML') {
          translationRequests.push(request.sourceArray2d);
          const reply = ()=>callback(request.sourceArray2d.map(row=>row.map(text=>'訳：'+text)));
          if(delayTranslations) pendingTranslations.push(reply); else reply();
        } else if(request.action==='translateText') callback(request.sourceArray.map(text=>'訳：'+text));
        else if(request.action==='translateSingleText') callback('訳：'+request.source);
        else callback();
      }}};
    });
    for (const file of ['bilingual.js','pageTranslator.js']) await page.addScriptTag({path:path.resolve('src/contentScript',file)});
    await page.waitForFunction(()=>typeof pageTranslator.translatePage==='function');
    await page.evaluate(()=>pageTranslator.translatePage('ja','bilingual'));
    await page.waitForFunction(()=>document.querySelectorAll('[data-twp-bilingual-source]').length===5);
    assert.equal(await page.locator('#paragraph > :first-child').textContent(), 'Hello world.');
    assert.equal(await page.locator('#link').count(),1);
    await page.locator('#link').click();
    assert.equal(await page.evaluate(()=>clicks),1);
    assert.match(await page.locator('#paragraph').textContent(), /^Hello world\.訳：/);
    assert.equal(await page.evaluate(()=>translationRequests.flat(2).some(text=>text.includes('訳：'))),false);
    await page.evaluate(()=>{const p=document.createElement('p');p.id='dynamic';p.textContent='New paragraph';document.querySelector('main').append(p);});
    await page.waitForFunction(()=>document.querySelector('#dynamic [data-twp-bilingual-source]'));
    assert.equal(await page.locator('#dynamic > :first-child').textContent(),'New paragraph');
    await page.evaluate(()=>document.querySelector('#paragraph').append(document.createTextNode(' Added text')));
    await page.waitForFunction(()=>document.querySelector('#paragraph').lastChild.textContent.includes('訳：'));
    assert.equal(await page.locator('#paragraph > :first-child').textContent(), 'Hello world. Added text');
    await page.evaluate(()=>document.querySelector('#paragraph').lastChild.remove());
    if (process.env.TWP_BILINGUAL_SCREENSHOT) await page.screenshot({path:process.env.TWP_BILINGUAL_SCREENSHOT});
    await page.evaluate(()=>pageTranslator.restorePage());
    assert.equal(await page.locator('[data-twp-bilingual-source]').count(),0);
    await page.locator('#dynamic').evaluate(node=>node.remove());
    assert.equal(await page.locator('main').innerHTML(),original);
    await page.evaluate(()=>pageTranslator.translatePage('ja','translation'));
    await page.waitForFunction(()=>document.querySelector('#paragraph').textContent.includes('訳：'));
    assert.equal(await page.locator('[data-twp-bilingual-source]').count(),0);
    await page.evaluate(()=>{pageTranslator.restorePage();delayTranslations=true;pageTranslator.translatePage('ja','bilingual');});
    await page.waitForFunction(()=>pendingTranslations.length>0);
    await page.evaluate(()=>{pageTranslator.restorePage();pendingTranslations.forEach(reply=>reply());});
    await page.waitForTimeout(100);
    assert.equal(await page.locator('main').innerHTML(),original);
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
});

test('compact popup menu toggles bilingual mode and remembers the preference', async () => {
  const {readFile} = require('node:fs/promises');
  const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
  try {
    const page = await browser.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('http://twp.test/**',async route=>{
      const pathname=new URL(route.request().url()).pathname;
      const root=pathname==='/fixture.js'?'qa/ui-design':'src';
      const file=path.resolve(root,'.'+pathname);
      try {
        let body=await readFile(file);
        if(file.endsWith('.html')) body=body.toString().replace('<head>','<head><script src="/fixture.js"></script>');
        const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css'};
        await route.fulfill({body,contentType:types[path.extname(file)]||'application/octet-stream'});
      } catch {await route.fulfill({status:404,body:''});}
    });
    await page.goto('http://twp.test/popup/old-popup.html');
    await page.locator('#btnTranslate').waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('#btnTranslate').disabled);
    await page.locator('#btnMenu').click();
    const toggle=page.getByRole('button',{name:/対訳モード/});
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'),'true');
    let trace=JSON.parse(await page.locator('#fixture-trace').textContent());
    assert.equal(trace.filter(item=>item.action==='translatePage').at(-1).displayMode,'bilingual');
    await page.reload();
    await page.waitForFunction(()=>!document.querySelector('#btnTranslate').disabled);
    await page.locator('#btnMenu').click();
    assert.equal(await toggle.getAttribute('aria-pressed'),'true');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'),'false');
    trace=JSON.parse(await page.locator('#fixture-trace').textContent());
    assert.equal(trace.filter(item=>item.action==='translatePage').at(-1).displayMode,'translation');
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});
