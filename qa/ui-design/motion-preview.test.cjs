// NODE_PATH=<playwright packages> PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=<optional browser> node --test qa/ui-design/motion-preview.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {once} = require('node:events');

async function fixture(run) {
  const {createPreviewServer} = await import('./server.mjs');
  const server = createPreviewServer().listen(0,'127.0.0.1');
  await once(server,'listening');
  const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:1100}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/motion-preview.html`);
    await page.waitForFunction(()=>!document.querySelector('#playAll').disabled);
    await run(page);
    assert.deepEqual(errors,[]);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
const inspect = page => page.evaluate(()=>[...document.querySelectorAll('iframe')].map(frame=>frame.contentWindow.motionSample.inspect()));
async function complete(page) {
  await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].every(frame=>frame.contentWindow.motionSample.inspect().complete));
}
async function original(page) {
  assert.ok((await inspect(page)).every(state=>state.original && state.active===0 && state.pending===0));
}

test('same real translator output; source stays still; arrivals precede animation completion; final layouts match',()=>fixture(async page=>{
  await original(page);
  await page.selectOption('#speed','10');
  await page.click('#playAll');
  await complete(page);
  const states=await inspect(page);
  assert.ok(states.every(state=>state.unknown.length===0));
  assert.ok(states.every(state=>state.responses.every(response=>response.arrival===300)));
  assert.equal(states[0].played.length,0);
  assert.ok(states[1].played.length>0 && states[2].played.length>0);
  assert.ok(states[1].active>0 && states[2].active>0);
  assert.ok(states.every(state=>state.events.every(event=>!event.animated || state.eligible.includes(event.id))));
  // First translated write is visible before the 1.5/1.8 second diagnostic effect ends.
  assert.ok(states.every(state=>state.events[0].at<1000));
  const middle=await page.evaluate(()=>[...document.querySelectorAll('iframe')].map(frame=>{
    const win=frame.contentWindow,doc=frame.contentDocument;
    const animated=doc.querySelector('.revealing');
    return {minOpacity:animated?Number(win.getComputedStyle(animated).opacity):1,
      source:[...doc.querySelectorAll('[data-twp-bilingual-source]')].map(node=>({transform:win.getComputedStyle(node).transform,opacity:win.getComputedStyle(node).opacity}))};
  }));
  assert.ok(middle.every(state=>state.minOpacity>=.65));
  assert.ok(middle.every(state=>state.source.every(style=>style.transform==='none' && style.opacity==='1')));
  if(process.env.TWP_MOTION_SCREENSHOT) await page.screenshot({path:process.env.TWP_MOTION_SCREENSHOT});
  await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].every(frame=>frame.contentWindow.motionSample.inspect().active===0));
  const layouts=await page.evaluate(()=>[...document.querySelectorAll('iframe')].map(frame=>[...frame.contentDocument.querySelectorAll('[data-preview-translation]')].map(node=>{
    const rect=node.getBoundingClientRect(),style=frame.contentWindow.getComputedStyle(node);
    return [node.textContent,rect.x,rect.y,rect.width,rect.height,style.opacity,style.transform];
  })));
  assert.deepEqual(layouts[1],layouts[0]);assert.deepEqual(layouts[2],layouts[0]);
  await page.click('#restoreAll');await original(page);
  await page.click('[data-mode="translation"]');
  await page.selectOption('#speed','1');
  await page.click('#playAll');await complete(page);
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('iframe')].every(frame=>!frame.contentDocument.querySelector('[data-twp-bilingual-source]'))));
  const frame=page.frames().find(frame=>frame.url().includes('preset=rise'));
  await frame.getByRole('link').focus();await page.keyboard.press('Enter');
  assert.ok(frame.url().endsWith('#reading-notes'));
  assert.equal(await frame.evaluate(()=>{const node=document.querySelector('[data-preview-translation]');const range=document.createRange();range.selectNodeContents(node);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);return selection.toString().trim();}),'読む時間を、もっと自然に。');
}));

test('late batches, restore and rapid changes cancel old work; scrolling and reduced motion finish effects',()=>fixture(async page=>{
  await page.selectOption('#latency','delayed');await page.selectOption('#speed','10');
  await page.click('#playAll');
  await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(frame=>frame.contentWindow.motionSample.inspect().events.length));
  let states=await inspect(page);
  assert.ok(states.every(state=>state.pending>0));
  await page.evaluate(()=>window.scrollTo(0,180));
  await complete(page);
  states=await inspect(page);
  assert.ok(states.every(state=>state.responses.some(response=>response.arrival===300)&&state.responses.some(response=>response.arrival===900)));
  assert.ok(states.every(state=>state.active===0));
  assert.ok(states.every(state=>state.events.filter(event=>event.at>=850).every(event=>!event.animated)));
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.click('#playAll');await page.click('#restoreAll');await page.waitForTimeout(1000);await original(page);
  await page.click('#playAll');await page.click('[data-mode="translation"]');await page.waitForTimeout(1000);await original(page);
  await page.click('#playAll');await page.click('#playAll');await complete(page);
  assert.ok((await inspect(page)).every(state=>state.events.length===new Set(state.events.map(event=>event.id)).size));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('#reducedNotice').waitFor({state:'visible'});
  assert.ok((await inspect(page)).every(state=>state.active===0));
  await page.click('#playAll');await complete(page);
  assert.ok((await inspect(page)).every(state=>state.played.length===0 && state.active===0));
}));

test('individual replay, narrow layout and document visibility cancellation',()=>fixture(async page=>{
  await page.setViewportSize({width:390,height:844});
  await page.selectOption('#speed','10');
  await page.locator('[data-preset="rise"] .replay').click();
  await page.waitForFunction(()=>document.querySelector('[data-preset="rise"] iframe').contentWindow.motionSample.inspect().complete);
  const states=await inspect(page);
  assert.ok(states[0].original && states[1].original && states[2].complete);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  // Visibility event uses the same cancellation path as a backgrounded tab.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.ok((await inspect(page)).every(state=>state.active===0));
}));
