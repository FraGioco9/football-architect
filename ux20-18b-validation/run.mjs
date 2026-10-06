import {chromium} from 'playwright';

const base='http://127.0.0.1:2000';
const failures=[];
const check=(condition,message)=>{if(!condition)failures.push(message);};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
const page=await context.newPage();
const runtimeErrors=[];
page.on('pageerror',error=>runtimeErrors.push('pageerror: '+error.message));
page.on('console',message=>{if(message.type()==='error')runtimeErrors.push('console: '+message.text());});

async function home(){
  await page.goto(base+'/',{waitUntil:'networkidle'});
}
async function createCareer(name){
  await page.locator('[data-action="menu-new"]').click();
  await page.waitForURL('**/careers/new');
  await page.locator('#manager-name').fill(name);
  await page.locator('[data-action="start-career"]').click();
  await page.waitForURL('**/dashboard');
  await home();
}

try{
  await home();
  await createCareer('Manager Alpha');
  await createCareer('Manager Beta');

  await page.locator('[data-action="menu-manage"]').click();
  await page.waitForURL('**/careers');

  // Make the older Alpha career active, then revisit Careers.
  const alpha=page.locator('.career-card',{hasText:'Manager Alpha'});
  check(await alpha.count()===1,'fixture must expose the Alpha career');
  await alpha.locator('[data-action="career-load"]').click();
  await page.waitForURL('**/dashboard');
  await home();
  await page.locator('[data-action="menu-manage"]').click();
  await page.waitForURL('**/careers');

  const cards=page.locator('.career-card');
  check(await cards.count()===2,'fixture must expose two career cards');

  const cardTexts=await cards.allInnerTexts();
  console.log('CAREER_CARD_ORDER',JSON.stringify(cardTexts));
  const firstText=(await cards.first().innerText()).trim();
  check(firstText.includes('Manager Alpha'),'the active career must be sorted first');
  check(firstText.includes('Attiva'),'the first card must visibly identify the active career');

  for(let i=0;i<await cards.count();i++){
    const card=cards.nth(i);
    const text=await card.innerText();
    check(/Data di gioco/i.test(text),'each career card must show the current game date');
    check(!/Schema\s*:|Schema\s+v/i.test(text),'career cards must not show save schema/version in the primary hierarchy');

    const actions=card.locator('.career-actions > button');
    check(await actions.count()<=4,'each career card must show at most 3 direct actions plus More');
    check(await card.locator('[data-action="career-export"]').count()===1,'each healthy card must keep Export visible');
    check(await card.locator('[data-action="career-delete"]').count()===1,'each healthy card must keep Delete visible');
    check(await card.locator('[data-action="career-more"]').count()===1,'secondary slot tools must be grouped under More');
  }

  check(await page.locator('[data-action="career-new"].btn-primary').count()===1,'New career must be the single page-level primary action');
  check(await page.locator('[data-action="career-import"]').count()===1,'Import must remain directly reachable as a secondary action');

  const security=page.locator('.career-security');
  check(await security.count()===1,'storage/recovery tools must be grouped in a Security and recovery section');
  if(await security.count()){
    check(!(await security.evaluate(el=>el.hasAttribute('open'))),'healthy storage security section must be collapsed by default');
    check(await security.locator('[data-action="career-export-all"]').count()===1,'Export all must remain available in Security and recovery');
    check(await security.locator('[data-action="export-emergency"]').count()===1,'Emergency export must remain available in Security and recovery');
    check(await security.locator('[data-action="request-storage-persistence"]').count()===1,'storage protection must remain available in Security and recovery');
  }
  check(await page.locator('.career-transfer-toolbar').count()===0,'the old technical transfer toolbar must not remain in the primary hierarchy');

  check(runtimeErrors.length===0,'browser runtime errors: '+runtimeErrors.join(' | '));
}finally{
  await browser.close();
}

if(failures.length){
  console.error('UX20 18B RED CONTRACT FAIL');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('UX20 18B BROWSER PASS');
