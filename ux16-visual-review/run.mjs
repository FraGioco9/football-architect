import {chromium} from 'playwright';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:2000';
await fs.mkdir('screenshots',{recursive:true});

async function snap(channel,name){
  const browser=await chromium.launch({headless:true,channel});
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const page=await context.newPage();
  await page.addInitScript(()=>localStorage.setItem('football-architect:language','it'));
  try{
    await page.goto(base+'/',{waitUntil:'networkidle'});
    const home=page.locator('[data-language-picker="home"] [role="combobox"]');
    await home.click();
    await page.screenshot({path:`screenshots/${name}-01-home-it-open.png`,fullPage:false});
    await page.locator('[data-language-listbox="home"] [data-value="en"]').click();
    await page.waitForFunction(()=>document.documentElement.lang==='en');
    await page.locator('[data-language-picker="home"] [role="combobox"]').click();
    await page.screenshot({path:`screenshots/${name}-02-home-en-open.png`,fullPage:false});
    await page.keyboard.press('Escape');

    await page.locator('[data-action="menu-manage"]').click();
    await page.waitForURL('**/careers');
    await page.locator('[data-language-picker="careers"] [role="combobox"]').click();
    await page.screenshot({path:`screenshots/${name}-03-careers-en-open.png`,fullPage:false});
    await page.locator('[data-language-listbox="careers"] [data-value="it"]').click();

    await page.locator('[data-action="career-new"]').click();
    await page.waitForURL('**/careers/new');
    await page.locator('[data-language-picker="onboard"] [role="combobox"]').click();
    await page.screenshot({path:`screenshots/${name}-04-onboarding-it-open.png`,fullPage:false});
    await page.keyboard.press('Escape');
    await page.locator('#manager-name').fill('UX16 Visual');
    await page.locator('[data-action="start-career"]').click();
    await page.waitForURL('**/dashboard');
    await page.waitForTimeout(350);

    await page.locator('[data-language-picker="top"] [role="combobox"]').click();
    await page.screenshot({path:`screenshots/${name}-05-dashboard-it-open.png`,fullPage:false});
    await page.locator('[data-language-listbox="top"] [data-value="en"]').click();
    await page.waitForFunction(()=>document.documentElement.lang==='en');
    console.log(name,'language after dashboard switch',await page.evaluate(()=>({lang:document.documentElement.lang,stored:localStorage.getItem('football-architect:language')})));
    await page.locator('[data-language-picker="top"] [role="combobox"]').click();
    await page.screenshot({path:`screenshots/${name}-06-dashboard-en-open.png`,fullPage:false});
    await page.keyboard.press('Escape');

    await page.goto(base+'/settings',{waitUntil:'networkidle'});
    console.log(name,'language after settings reload',await page.evaluate(()=>({lang:document.documentElement.lang,stored:localStorage.getItem('football-architect:language')})));
    await page.locator('[data-language-picker="settings"] [role="combobox"]').click();
    await page.screenshot({path:`screenshots/${name}-07-settings-en-open.png`,fullPage:false});
    await page.keyboard.press('Escape');

    await page.setViewportSize({width:390,height:844});
    await page.goto(base+'/dashboard',{waitUntil:'networkidle'});
    await page.locator('[data-language-picker="top"] [role="combobox"]').click();
    await page.screenshot({path:`screenshots/${name}-08-mobile-dashboard-en-open.png`,fullPage:false});
  }finally{
    await browser.close();
  }
}

await snap('chrome','chrome');
await snap('msedge','edge');
console.log('UX16 VISUAL CAPTURE PASS');
