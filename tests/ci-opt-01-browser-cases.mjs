// Pairwise coverage, not a Cartesian matrix or physical Safari certification.
import assert from 'node:assert/strict';
export const areaRoutes=Object.freeze({calendar:'/calendar',clubs:'/clubs/it/1/overview',competitions:'/competitions/it-1/standings',guide:'/guide',admin:'/admin'});
export function browserCases(){
 return ['en','de','es','fr','it'].flatMap((language,i)=>[320,390,768,1440].map((width,j)=>{
  const theme=['dark','light'][(i+j)%2];
  return {language,theme,width,touch:width<768};
 }));
}
export async function verifyArea(page,area,{touch}){
 const activate=async locator=>touch?locator.tap():locator.click();
 if(area==='admin'){
  await page.locator('#app-admin[data-admin-access="denied"]').waitFor({state:'attached'});
  assert.equal(await page.locator('#main-content').innerText(),'');
  assert.equal(await page.locator('[data-admin-signin-link] a').isVisible(),false);
  assert.equal(await page.locator('[data-admin-reset]').count(),0);
  await activate(page.locator('#app-nav-profile'));await page.waitForURL(url=>url.pathname==='/account/login');
  assert.equal(new URL(page.url()).searchParams.has('next'),false);
  await page.goBack({waitUntil:'domcontentloaded'});
  await page.locator('#app-admin[data-admin-access="denied"]').waitFor({state:'attached'});
  assert.equal(await page.locator('#main-content').innerText(),'');
 }else if(area==='calendar'){
  const picker=page.locator('#calendar-season-picker');
  await activate(picker);
  await page.locator('#calendar-season-menu [role=option]').first().waitFor({state:'attached'});
  assert.equal(await page.locator('#calendar-season-menu [role=option]').count(),1);
  await activate(picker);
 }else if(area==='competitions'){
  // DOM-first navigation can precede async competition route activation.
  // Wait for the real interaction controller rather than a network-idle heuristic.
  await page.waitForFunction(()=>typeof window.faCompetitionRoute?.set==='function');
  const tab=page.locator('#competition-tab-fixtures');
  await activate(tab);
  await page.waitForFunction(()=>document.querySelector('#competition-tab-fixtures')?.getAttribute('aria-selected')==='true');
  assert.equal(await tab.getAttribute('aria-selected'),'true');
  await tab.focus();await page.keyboard.press('Home');
  await page.waitForFunction(()=>document.querySelector('#competition-tab-standings')?.getAttribute('aria-selected')==='true');
  assert.equal(await page.locator('#competition-tab-standings').getAttribute('aria-selected'),'true');
 }else if(area==='clubs'){
  const tab=page.locator('.club-tabs a[href$="/history"]');
  await activate(tab);
  await page.waitForURL('**/history');
  assert.equal(await tab.getAttribute('aria-current'),'page');
  await tab.focus();await page.keyboard.press('Home');await page.keyboard.press('Enter');
  await page.waitForURL('**/overview');
 }else if(area==='guide'){
  const link=page.locator('a[data-guide-section="clubs"]').filter({visible:true}).first();
  await activate(link);
  assert.equal(await link.getAttribute('aria-current'),'location');
  const first=page.locator('a[data-guide-section="divisions"]').filter({visible:true}).first();
  await first.focus();await page.keyboard.press('Enter');
  assert.equal(await first.getAttribute('aria-current'),'location');
 }else throw Error('Unknown browser area: '+area);
 // Follow a real visible local navigation link with the keyboard.
 const nav=page.locator('a.brand-mark,a.app-brand').filter({visible:true}).first();
 const home=new URL(await nav.getAttribute('href'),page.url());
 assert.ok(['localhost','app.localhost'].includes(home.hostname)&&home.port==='2000'&&['/','/dashboard','/dashboard/'].includes(home.pathname), 'Known loopback home destination');
 await nav.focus();await page.keyboard.press('Enter');
 await page.waitForURL(home.href);
}
