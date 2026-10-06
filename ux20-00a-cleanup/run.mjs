import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base='http://127.0.0.1:2000';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});

try{
  await page.goto(base+'/',{waitUntil:'networkidle'});
  const picker=page.locator('[data-language-picker="home"]');
  await picker.waitFor({state:'visible'});
  const visibleText=(await picker.innerText()).trim();
  assert.doesNotMatch(visibleText,/^Lingua\b|\bLingua\b/,'Home language control must not show the Lingua label');
  assert.match(await picker.locator('[role="combobox"]').getAttribute('aria-label'),/^Lingua:/,'Italian accessible language label must remain');

  await picker.locator('[role="combobox"]').click();
  await page.locator('[data-language-listbox="home"] [data-value="en"]').click();
  await page.waitForFunction(()=>document.documentElement.lang==='en');
  const englishText=(await page.locator('[data-language-picker="home"]').innerText()).trim();
  assert.doesNotMatch(englishText,/\bLanguage\b/,'Home language control must not show the Language label');
  assert.match(await page.locator('[data-language-picker="home"] [role="combobox"]').getAttribute('aria-label'),/^Language:/,'English accessible language label must remain');

  await page.locator('[data-action="menu-new"]').click();
  await page.waitForURL('**/careers/new');
  await page.locator('#manager-name').fill('Shortcut Test');
  await page.locator('[data-action="start-career"]').click();
  await page.waitForURL('**/dashboard');
  assert.equal(await page.locator('.nav-quick,.nav-quick-link,.nav-quick-heading').count(),0,'Quick-link shortcuts must be absent from main navigation');
  assert.equal(await page.getByText('Quick links',{exact:true}).count(),0);
  assert.equal(await page.getByText('Accessi rapidi',{exact:true}).count(),0);

  const firstGroup=page.locator('.nav-group-toggle').first();
  await firstGroup.focus();
  assert.equal(await page.locator(':focus').evaluate(el=>el.classList.contains('nav-group-toggle')),true,'Navigation group remains keyboard focusable');
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-action="toggle-sidebar"]').click();
  const minHeight=await page.locator('.nav-group-toggle').first().evaluate(el=>el.getBoundingClientRect().height);
  assert.ok(minHeight>=44,'Mobile navigation group touch target must stay >=44px');

  assert.equal(errors.length,0,'browser errors: '+errors.join(' | '));
}finally{
  await browser.close();
}
console.log('UX20 00A CLEANUP PASS');
