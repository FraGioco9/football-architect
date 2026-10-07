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

  check(await page.locator('.sidebar details.nav-group').count()===0,'sidebar groups must not be collapsible');
  check(await page.locator('.sidebar .nav-group-title').count()===5,'sidebar must render all five permanent sections');
  check(await page.locator('.sidebar [data-action="menu-home"]').count()===0,'sidebar Main menu must be removed');
  check(await page.locator('.menu-toggle,[data-action="toggle-sidebar"]').count()===0,'menu toggle must be removed');
  check(await page.locator('.sidebar .sidebar-career,.sidebar .club-side-link').count()===0,'managed club must not remain in sidebar');
  check(await page.locator('.topbar .topbar-club').isVisible(),'managed club must be visible in topbar');
  check(await page.locator('#nav-group-system + .nav-group-items [data-page="advanced"]').count()===1,'Advanced analysis must appear in System');
  check(await page.locator('.topbar [data-language-picker="top"]').isVisible(),'topbar language picker must be visible');
  check(await page.locator('.topbar [data-action="advance"]').count()===1,'Dashboard must expose one top-right Continue');
  check(await page.locator('.dashboard-now [data-action="advance"]').count()===0,'Dashboard body must not duplicate Continue');

  const langButton=page.locator('.topbar [data-language-picker="top"] [role="combobox"]');
  const langBox=await langButton.boundingBox();
  const topBox=await page.locator('.topbar').boundingBox();
  check(Boolean(langBox&&topBox&&langBox.x>=topBox.x&&langBox.x+langBox.width<=topBox.x+topBox.width+1),'language button must not be clipped by the topbar');

  await page.locator('[data-action="nav"][data-page="calendar"]').click();
  await page.waitForURL('**/calendar');
  check(await page.locator('.topbar [data-action="advance"]').count()===1,'operational pages must keep the contextual top-right control');

  await page.setViewportSize({width:390,height:844});
  const sidebarBox=await page.locator('#club-sidebar').boundingBox();
  check(Boolean(sidebarBox&&sidebarBox.x===0&&sidebarBox.width<=60),'mobile sidebar must remain permanently visible as a compact rail');
  check(await page.locator('.menu-toggle,[data-action="toggle-sidebar"]').count()===0,'mobile must not recreate a menu toggle');
  check(await page.locator('.topbar [data-language-picker="top"]').isVisible(),'mobile topbar must keep language control');
  check(await page.locator('.topbar .topbar-primary').isVisible(),'mobile topbar must keep contextual simulation action');

  const mobileLang=page.locator('.topbar [data-language-picker="top"] [role="combobox"]');
  await mobileLang.click();
  await page.locator('.topbar [data-language-listbox="top"] [data-value="en"]').click();
  check((await page.locator('#nav-group-system').innerText()).toLowerCase().includes('system'),'permanent navigation must localize to English');
  check(await page.locator('.topbar .topbar-primary').isVisible(),'English topbar action must remain visible');

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
