import {chromium} from 'playwright';

const base='http://127.0.0.1:2000';
const failures=[];
const check=(condition,message)=>{if(!condition)failures.push(message);};

async function withFreshPage(fn){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const page=await context.newPage();
  try{
    await page.goto(base+'/',{waitUntil:'networkidle'});
    await fn(page);
  }finally{
    await browser.close();
  }
}

await withFreshPage(async page=>{
  await page.locator('[data-action="menu-manage"]').click();
  await page.waitForURL('**/careers');
  const before=await page.locator('[data-action="career-load"]').count();
  await page.locator('[data-action="career-back"]').click();
  await page.waitForURL(base+'/');
  await page.locator('[data-action="menu-new"]').click();
  await page.waitForURL('**/careers/new');
  const countries=page.locator('[data-action="choose-country"]');
  if(await countries.count()>1)await countries.nth(1).click();
  await page.locator('[data-action="new-career-cancel"]').click();
  await page.waitForURL(base+'/');
  await page.locator('[data-action="menu-manage"]').click();
  await page.waitForURL('**/careers');
  const after=await page.locator('[data-action="career-load"]').count();
  check(after===before,'opening, editing and cancelling /careers/new must not create a career slot');
});

await withFreshPage(async page=>{
  await page.locator('[data-action="menu-new"]').click();
  await page.waitForURL('**/careers/new');
  const field=page.locator('#manager-name');
  await field.fill('   ');
  await page.locator('[data-action="start-career"]').click();
  await page.waitForTimeout(200);
  check(new URL(page.url()).pathname==='/careers/new','blank manager name must keep the user on /careers/new');
  const fieldStillPresent=await page.locator('#manager-name').count()===1;
  check(fieldStillPresent,'blank manager name must keep the manager field visible');
  if(fieldStillPresent)check((await page.locator('#manager-name').getAttribute('aria-invalid'))==='true','blank manager name must mark the field aria-invalid');
  check(await page.locator('#manager-name-error:not([hidden])').count()===1,'blank manager name must show an inline validation message');
});

if(failures.length){
  console.error('UX20 18A RED CONTRACT FAIL');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
await withFreshPage(async page=>{
  await page.locator('[data-action="menu-manage"]').click();
  await page.waitForURL('**/careers');
  const before=await page.locator('[data-action="career-load"]').count();
  await page.locator('[data-action="career-back"]').click();
  await page.waitForURL(base+'/');
  await page.locator('[data-action="menu-new"]').click();
  await page.waitForURL('**/careers/new');
  await page.locator('#manager-name').fill('18A Test Manager');
  await page.locator('[data-action="start-career"]').click();
  await page.waitForURL('**/dashboard');
  await page.goto(base+'/',{waitUntil:'networkidle'});
  await page.locator('[data-action="menu-manage"]').click();
  await page.waitForURL('**/careers');
  const after=await page.locator('[data-action="career-load"]').count();
  check(after===before+1,'a valid Start career action must create exactly one career slot');
});

await withFreshPage(async page=>{
  await page.locator('[data-action="menu-new"]').click();
  await page.waitForURL('**/careers/new');
  const combo=page.locator('[data-language-picker="onboard"] [role="combobox"]');
  await combo.click();
  await page.locator('[data-language-listbox="onboard"] [data-value="en"]').click();
  check((await page.locator('h1').first().innerText()).trim()==='Build your career','new career title must switch to English');
  await page.setViewportSize({width:390,height:844});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
  check(!overflow,'new career page must not overflow horizontally on mobile');
});

if(failures.length){
  console.error('UX20 18A EXTENDED GATE FAIL');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('UX20 18A BROWSER PASS');
