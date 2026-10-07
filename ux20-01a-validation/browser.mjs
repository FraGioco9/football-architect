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
  await page.locator('#manager-name').fill('Dashboard Test');
  await page.locator('[data-action="start-career"]').click();
  await page.waitForURL('**/dashboard');

  const main=page.locator('#main-content');
  check(await main.count()===1,'dashboard main content must exist');
  check(await main.locator('.page-head h1 + p').count()===0,'Dashboard must preserve the global no-page-subtitle rule');

  const primary=main.locator('.btn-primary');
  check(await primary.count()===1,'dashboard must expose exactly one primary CTA');

  check(await page.locator('.qol03-toolbar').count()===0,'dashboard widget customization toolbar must be removed');
  check(!(await main.innerText()).includes('BUDGET MERCATO'),'transfer budget must not appear on the dashboard');
  check(await main.locator('.mini-standing').count()===0,'extended standings must be removed from the dashboard');
  check(await main.locator('.fixture-list').count()===0,'extended fixture list must be removed from the dashboard');
  check(await main.locator('.dashboard-two-bottom').count()===0,'extended results/training row must be removed from the dashboard');

  const now=main.locator('.dashboard-now');
  check(await now.count()===1,'dashboard must have one operational Now block');

  const summary=main.locator('.dashboard-summary');
  check(await summary.count()===1,'dashboard must have one compact squad summary');
  if(await summary.count()){
    const text=await summary.innerText();
    for(const label of ['POSIZIONE','FORMA','OVR','DISPONIBILITÀ'])check(text.includes(label),'summary must include '+label);
  }

  const date=main.locator('.current-season');
  check(await date.count()===1,'game date must be visible in the dashboard header');

  const languageCombo=page.locator('[data-language-picker] [role="combobox"]').first();
  await languageCombo.click();
  await page.locator('[data-language-listbox] [data-value="en"]').first().click();
  check((await main.locator('.dashboard-now h2').innerText()).includes('Next match'),'Now block must translate to English');
  check((await summary.innerText()).includes('AVAILABILITY'),'summary must translate to English');

  await page.locator('[data-action="nav"][data-page="calendar"]').first().click();
  await page.waitForURL('**/calendar');
  await page.goBack();
  await page.waitForURL('**/dashboard');
  check(await page.locator('.dashboard-now').count()===1,'browser Back must restore the Dashboard');
  await page.goForward();
  await page.waitForURL('**/calendar');
  await page.goBack();
  await page.waitForURL('**/dashboard');

  await page.setViewportSize({width:390,height:844});
  check(await date.isVisible(),'game date must remain visible on mobile');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
  check(!overflow,'dashboard must not overflow horizontally at 390px');
  check(runtimeErrors.length===0,'browser runtime errors: '+runtimeErrors.join(' | '));
}finally{
  await browser.close();
}

if(failures.length){
  console.error('UX20 01A RED CONTRACT FAIL');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('UX20 01A BROWSER PASS');
