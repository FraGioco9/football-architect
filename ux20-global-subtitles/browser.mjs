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

async function assertNo(selector,message){
  check(await page.locator(selector).count()===0,message);
}

try{
  // Main menu custom header.
  await page.goto(base+'/',{waitUntil:'networkidle'});
  await assertNo('.fa-menu-intro h1 + p','main menu subtitle must be removed');
  await page.locator('[data-action="menu-settings"]').click();
  await assertNo('.fa-menu-intro h1 + p','main menu Settings subtitle must be removed');
  await page.locator('[data-action="menu-home"]').click();

  // New career custom header.
  await page.locator('[data-action="menu-new"]').click();
  await page.waitForURL('**/careers/new');
  await assertNo('.onboard-header h1 + p','New Career subtitle must be removed');

  // Start a career to unlock routed pages.
  await page.locator('#manager-name').fill('Subtitle Test');
  await page.locator('[data-action="start-career"]').click();
  await page.waitForURL('**/dashboard');

  // Shared sectionHead page.
  await page.goto(base+'/settings',{waitUntil:'networkidle'});
  await assertNo('.page-head h1 + p','shared page subtitles must be removed');

  // World custom header.
  await page.goto(base+'/world',{waitUntil:'networkidle'});
  await assertNo('.world-career > .section-head h1 + p','World subtitle must be removed');

  // Advanced custom header.
  await page.goto(base+'/advanced',{waitUntil:'networkidle'});
  await assertNo('.fa-addon-page > header h1 + p','Advanced subtitle must be removed');

  check(runtimeErrors.length===0,'browser runtime errors before intentional 404: '+runtimeErrors.join(' | '));
  runtimeErrors.length=0;

  // 404 custom header. The HTTP 404 itself is intentional and not a runtime regression.
  await page.goto(base+'/route-that-does-not-exist',{waitUntil:'networkidle'});
  await assertNo('.fa-menu-intro h1 + p','404 subtitle must be removed');
  runtimeErrors.length=0;

  // English should not reintroduce subtitles and mobile should not overflow.
  await page.goto(base+'/',{waitUntil:'networkidle'});
  const combo=page.locator('[data-language-picker] [role="combobox"]').first();
  if(await combo.count()){
    await combo.click();
    const english=page.locator('[data-language-listbox] [data-value="en"]').first();
    if(await english.count())await english.click();
  }
  await assertNo('.fa-menu-intro h1 + p','English main menu must not render a subtitle');
  await page.setViewportSize({width:390,height:844});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
  check(!overflow,'subtitle removal must not introduce mobile horizontal overflow');

  check(runtimeErrors.length===0,'browser runtime errors: '+runtimeErrors.join(' | '));
}finally{
  await browser.close();
}

if(failures.length){
  console.error('UX20 GLOBAL SUBTITLE RED CONTRACT FAIL');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('UX20 GLOBAL SUBTITLE BROWSER PASS');
