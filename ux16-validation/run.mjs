import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base='http://127.0.0.1:2000';

function approxEqual(a,b,tolerance=0.75,message='geometry mismatch'){
  assert.ok(Math.abs(a-b)<=tolerance,`${message}: ${a} vs ${b}`);
}
async function box(locator){
  const value=await locator.boundingBox();assert.ok(value,'missing box');return value;
}
async function assertPickerGeometryStable(page,context){
  const combo=page.locator(`[data-language-picker="${context}"] [role="combobox"]`);
  await combo.waitFor({state:'visible'});
  assert.equal(await page.locator(`[data-language-picker="${context}"] select`).count(),0,'language picker must not expose a native select');
  assert.equal(await combo.count(),1,'exactly one visible combobox per language picker');
  const before=await box(combo);
  await combo.click();
  const list=page.locator(`[data-language-listbox="${context}"]`);
  await list.waitFor({state:'visible'});
  assert.equal(await list.getAttribute('role'),'listbox');
  assert.equal(await list.locator('[role="option"]').count(),2);
  await list.locator('[data-value="en"]').click();
  await page.waitForFunction(()=>document.documentElement.lang==='en');
  const english=await box(page.locator(`[data-language-picker="${context}"] [role="combobox"]`));
  approxEqual(before.width,english.width,0.75,context+' width IT→EN');
  approxEqual(before.height,english.height,0.75,context+' height IT→EN');

  const comboEn=page.locator(`[data-language-picker="${context}"] [role="combobox"]`);
  await comboEn.click();
  await page.locator(`[data-language-listbox="${context}"] [data-value="it"]`).click();
  await page.waitForFunction(()=>document.documentElement.lang==='it');
  const after=await box(page.locator(`[data-language-picker="${context}"] [role="combobox"]`));
  approxEqual(before.width,after.width,0.75,context+' width EN→IT');
  approxEqual(before.height,after.height,0.75,context+' height EN→IT');
}
async function keyboardGate(page,context){
  let combo=page.locator(`[data-language-picker="${context}"] [role="combobox"]`);
  await combo.focus();
  await page.keyboard.press('ArrowDown');
  const list=page.locator(`[data-language-listbox="${context}"]`);
  await list.waitFor({state:'visible'});
  assert.equal(await combo.getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator(':focus').getAttribute('role'),'option','ArrowDown must focus an option');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator(':focus').getAttribute('data-value'),'en');
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.documentElement.lang==='en');

  combo=page.locator(`[data-language-picker="${context}"] [role="combobox"]`);
  await combo.focus();
  await page.keyboard.press('ArrowUp');
  await page.locator(`[data-language-listbox="${context}"]`).waitFor({state:'visible'});
  assert.equal(await page.locator(':focus').getAttribute('data-value'),'it');
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>document.documentElement.lang==='it');

  combo=page.locator(`[data-language-picker="${context}"] [role="combobox"]`);
  await combo.focus();
  await page.keyboard.press('Space');
  await page.locator(`[data-language-listbox="${context}"]`).waitFor({state:'visible'});
  await page.keyboard.press('Escape');
  assert.equal(await page.locator(`[data-language-listbox="${context}"]`).count(),0,'Escape must close listbox');
  assert.equal(await page.locator(':focus').getAttribute('role'),'combobox','Escape must restore combobox focus');

  combo=page.locator(`[data-language-picker="${context}"] [role="combobox"]`);
  await combo.focus();
  await page.keyboard.press('ArrowDown');
  await page.locator(`[data-language-listbox="${context}"]`).waitFor({state:'visible'});
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(`[data-language-listbox="${context}"]`).count(),0,'Tab must close listbox');
  assert.notEqual(await page.locator(':focus').getAttribute('role'),'option','Tab must leave option focus');
}
async function runBrowser(channel,name){
  const browser=await chromium.launch({headless:true,channel});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push('pageerror: '+error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push('console: '+message.text());});
  await page.addInitScript(()=>localStorage.setItem('football-architect:language','it'));
  try{
    await page.goto(base+'/',{waitUntil:'networkidle'});
    await assertPickerGeometryStable(page,'home');
    await keyboardGate(page,'home');

    await page.locator('[data-action="menu-manage"]').click();
    await page.waitForURL('**/careers');
    await assertPickerGeometryStable(page,'careers');

    await page.locator('[data-action="career-new"]').click();
    await page.waitForURL('**/careers/new');
    await assertPickerGeometryStable(page,'onboard');
    await page.locator('#manager-name').fill('UX16 Test');
    await page.locator('[data-action="start-career"]').click();
    await page.waitForURL('**/dashboard');
    await page.waitForTimeout(350);

    let topbar=page.locator('.topbar');
    const topbarBefore=await box(topbar);
    const topMetricsBefore=await topbar.evaluate(el=>({clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth}));
    await assertPickerGeometryStable(page,'top');
    const topbarAfter=await box(page.locator('.topbar'));
    const topMetricsAfter=await page.locator('.topbar').evaluate(el=>({clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth}));
    approxEqual(topbarBefore.height,topbarAfter.height,0.75,name+' topbar height');
    assert.deepEqual(topMetricsAfter,topMetricsBefore,name+' topbar geometry/overflow must remain unchanged by IT↔EN');

    await page.goto(base+'/settings',{waitUntil:'networkidle'});
    await assertPickerGeometryStable(page,'settings');

    await page.setViewportSize({width:390,height:844});
    await page.goto(base+'/dashboard',{waitUntil:'networkidle'});
    const mobileBefore=await box(page.locator('[data-language-picker="top"] [role="combobox"]'));
    await keyboardGate(page,'top');
    const mobileAfter=await box(page.locator('[data-language-picker="top"] [role="combobox"]'));
    approxEqual(mobileBefore.width,mobileAfter.width,0.75,name+' mobile width');
    approxEqual(mobileBefore.height,mobileAfter.height,0.75,name+' mobile height');
    const viewport=page.viewportSize();
    await page.locator('[data-language-picker="top"] [role="combobox"]').click();
    const popup=await box(page.locator('[data-language-listbox="top"]'));
    assert.ok(popup.x>=0&&popup.x+popup.width<=viewport.width+0.75,name+' mobile popup clipped');
    await page.keyboard.press('Escape');

    assert.equal(errors.length,0,name+' browser errors: '+errors.join(' | '));
  }finally{
    await browser.close();
  }
}

for(const [channel,name] of [['chrome','Chrome'],['msedge','Edge']]){
  await runBrowser(channel,name);
}
console.log('UX16 VALIDATION PASS');
