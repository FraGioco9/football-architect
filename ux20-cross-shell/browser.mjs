import {chromium} from 'playwright';

const base='http://127.0.0.1:2000';
const failures=[];
const check=(condition,message)=>{if(!condition)failures.push(message);};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
const page=await context.newPage();
const runtimeErrors=[];
page.on('pageerror',e=>runtimeErrors.push(e.message));
page.on('console',m=>{if(m.type()==='error')runtimeErrors.push(m.text());});

try{
  await page.goto(base+'/',{waitUntil:'networkidle'});
  await page.locator('[data-action="menu-new"]').click();
  await page.waitForURL('**/careers/new');
  await page.locator('#manager-name').fill('Shell Browser');
  await page.locator('[data-action="start-career"]').click();
  await page.waitForURL('**/dashboard');

  check(await page.locator('.sidebar .club-side-link').count()===1,'sidebar must keep one compact club identity');
  check(await page.locator('.sidebar .nav-group-count').count()===0,'sidebar group counts must be removed');
  check(await page.locator('.sidebar .foot-network').count()===0,'sidebar technical save status must be removed');
  check(await page.locator('.sidebar .foot-caption').count()===0,'sidebar slogan must be removed');
  check(await page.locator('.topbar .breadcrumb').count()===0,'topbar breadcrumb must be removed');
  check(await page.locator('.topbar .fa-home-top').count()===0,'topbar Main menu must be removed');
  check(await page.locator('.topbar .continue-top').count()===0,'Dashboard topbar must not duplicate Continue');

  const advancedGroup=await page.locator('[data-nav-group="system"] [data-page="advanced"]').count();
  check(advancedGroup===1,'Advanced analysis must appear in System');

  await page.locator('[data-action="nav"][data-page="calendar"]').click();
  await page.waitForURL('**/calendar');
  check(await page.locator('.topbar .continue-top').count()===1,'Calendar topbar must expose global Continue');

  await page.setViewportSize({width:390,height:844});
  const topbar=page.locator('.topbar');
  const box=await topbar.boundingBox();
  check(Boolean(box&&box.height<=64),'mobile topbar must stay on one compact row');
  check(await page.locator('.topbar [data-language-picker="top"]').isHidden(),'mobile topbar language picker must be hidden');
  await page.locator('[data-action="toggle-sidebar"]').click();
  check(await page.locator('#club-sidebar [data-language-picker="sidebar"]').isVisible(),'mobile drawer must expose language picker');
  check(await page.locator('#club-sidebar [data-action="menu-home"]').isVisible(),'mobile drawer must keep Main menu');
  check(await page.locator('#club-sidebar .nav-item.active').getAttribute('aria-current')==='page','active drawer item must retain aria-current');

  const sidebarLanguage=page.locator('#club-sidebar [data-language-picker="sidebar"] [role="combobox"]');
  await sidebarLanguage.click();
  await page.locator('#club-sidebar [data-language-listbox="sidebar"] [data-value="en"]').click();
  check((await page.locator('[data-nav-group="system"] summary').innerText()).includes('System'),'mobile drawer navigation must localize to English');
  const localizedTopbarBox=await topbar.boundingBox();
  check(Boolean(localizedTopbarBox&&localizedTopbarBox.height<=64),'English mobile topbar must remain one compact row');

  await page.keyboard.press('Escape');
  const menuFocused=await page.locator('[data-action="toggle-sidebar"]').evaluate(element=>document.activeElement===element);
  check(menuFocused,'Escape must close drawer and restore focus to its trigger');

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
  check(!overflow,'shell must not overflow horizontally at 390px');
  check(runtimeErrors.length===0,'runtime errors: '+runtimeErrors.join(' | '));
}finally{
  await browser.close();
}

if(failures.length){
  console.error('UX20 CROSS SHELL RED CONTRACT FAIL');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('UX20 CROSS SHELL BROWSER PASS');
