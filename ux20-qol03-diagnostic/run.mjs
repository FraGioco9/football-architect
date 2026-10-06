import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
try{
  await page.goto('http://127.0.0.1:2000/',{waitUntil:'networkidle'});
  await page.locator('[data-action="menu-new"]').click();
  await page.waitForURL('**/careers/new');
  await page.locator('#manager-name').fill('QOL03 Diagnostic');
  await page.locator('[data-action="start-career"]').click();
  await page.waitForURL('**/dashboard');
  await page.waitForTimeout(300);
  const nodes=await page.locator('.qol03-shortcuts').evaluateAll(els=>els.map(el=>el.outerHTML));
  console.log('QOL03_SHORTCUT_COUNT',nodes.length);
  for(const html of nodes)console.log('QOL03_SHORTCUT_HTML',html);
}finally{await browser.close();}
