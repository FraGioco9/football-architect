import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base='http://127.0.0.1:2000';

async function actionContract(page){
  const actions=page.locator('.fa-menu-actions > [data-action]');
  assert.equal(await actions.count(),4,'Home must expose exactly four main entries');
  assert.deepEqual(await actions.evaluateAll(nodes=>nodes.map(node=>node.dataset.action)),
    ['menu-continue','menu-new','menu-manage','menu-settings']);
  assert.equal(await page.locator('[data-action="menu-load"]').count(),0);
  assert.equal(await page.locator('[data-action="menu-import"]').count(),0);
  assert.equal(await page.locator('#home-import-file').count(),0);
  assert.equal(await page.locator('.fa-menu-recent,.fa-menu-overview').count(),0);
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push('pageerror: '+error.message));
page.on('console',message=>{if(message.type()==='error')errors.push('console: '+message.text());});

try{
  await page.goto(base+'/',{waitUntil:'networkidle'});
  await actionContract(page);
  assert.equal(await page.locator('[data-action="menu-continue"]').isDisabled(),true,'Continue stays visible but disabled without a career');
  assert.equal(await page.locator('.fa-menu-active-summary').count(),0,'No active summary without a valid career');

  await page.locator('[data-action="menu-new"]').click();
  await page.waitForURL('**/careers/new');
  await page.locator('#manager-name').fill('00A Test Manager');
  await page.locator('[data-action="start-career"]').click();
  await page.waitForURL('**/dashboard');
  await page.waitForTimeout(350);
  await page.goto(base+'/',{waitUntil:'networkidle'});

  await actionContract(page);
  assert.equal(await page.locator('.fa-menu-primary').count(),1,'exactly one primary action');
  assert.equal(await page.locator('.fa-menu-primary').getAttribute('data-action'),'menu-continue');
  assert.equal(await page.locator('[data-action="menu-continue"]').isDisabled(),false);
  const summary=page.locator('.fa-menu-active-summary');
  await summary.waitFor({state:'visible'});
  const summaryText=await summary.innerText();
  assert.match(summaryText,/00A Test Manager/);
  assert.match(summaryText,/Stagione|Season/i);
  assert.match(summaryText,/Data di gioco|Game date/i);
  assert.match(summaryText,/Ultimo salvataggio|Last save/i);

  const actions=page.locator('.fa-menu-actions > .fa-menu-option');
  await actions.first().focus();
  assert.equal(await page.locator(':focus').getAttribute('data-action'),'menu-continue');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').getAttribute('data-action'),'menu-new');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').getAttribute('data-action'),'menu-manage');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').getAttribute('data-action'),'menu-settings');

  const before=await page.locator('.fa-menu-stack').boundingBox();
  await page.locator('[data-language-picker="home"] [role="combobox"]').click();
  await page.locator('[data-language-listbox="home"] [data-value="en"]').click();
  await page.waitForFunction(()=>document.documentElement.lang==='en');
  const after=await page.locator('.fa-menu-stack').boundingBox();
  assert.ok(before&&after);
  assert.ok(Math.abs(before.width-after.width)<1,'IT/EN must not change main stack width');
  await actionContract(page);
  assert.match(await summary.innerText(),/Manager/i);
  assert.match(await summary.innerText(),/Game date/i);
  assert.match(await summary.innerText(),/Last save/i);

  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/',{waitUntil:'networkidle'});
  await actionContract(page);
  const metrics=await page.locator('.fa-main-menu').evaluate(el=>({clientWidth:el.clientWidth,scrollWidth:el.scrollWidth}));
  assert.equal(metrics.clientWidth,metrics.scrollWidth,'mobile Home must not overflow horizontally');
  const mobileOptions=await page.locator('.fa-menu-actions > .fa-menu-option').evaluateAll(nodes=>nodes.map(node=>{
    const r=node.getBoundingClientRect();return {x:r.x,width:r.width};
  }));
  assert.ok(mobileOptions.every(item=>Math.abs(item.x-mobileOptions[0].x)<1&&Math.abs(item.width-mobileOptions[0].width)<1),
    'mobile actions must share the same full-width geometry');
  assert.equal(await page.locator('.fa-menu-active-meta').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1,
    'mobile active-career summary must be single-column');

  assert.equal(errors.length,0,'browser errors: '+errors.join(' | '));
}finally{
  await browser.close();
}
console.log('UX20 00A BROWSER PASS');
