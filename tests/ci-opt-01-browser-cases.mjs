// Pairwise coverage, not a Cartesian matrix or physical Safari certification.
import assert from 'node:assert/strict';
export const areaRoutes=Object.freeze({calendar:'/calendar',clubs:'/clubs/it/1/overview',competitions:'/competitions/it-1/standings',guide:'/guide',admin:'/settings'});
export function browserCases(){
 return ['en','de','es','fr','it'].flatMap((language,i)=>[320,390,768,1440].map((width,j)=>{
  const theme=['dark','light'][(i+j)%2];
  return {language,theme,width,touch:width<768};
 }));
}
export async function verifyArea(page,area,{touch}){
 const activate=async locator=>touch?locator.tap():locator.click();
 if(area==='admin'){
  const login=page.locator('[data-admin-login]');
  await login.waitFor({state:'visible'});
  assert.equal(await page.locator('#admin-email').getAttribute('autocomplete'),'username');
  assert.equal(await page.locator('#admin-password').getAttribute('autocomplete'),'current-password');
  assert.equal(await page.locator('[data-admin-reset-section]').isVisible(),false);
  assert.equal(await page.locator('[data-admin-prepare]').isVisible(),false);
  assert.equal(await page.locator('[data-admin-reset]').isEnabled(),false);
  await page.locator('#admin-email').focus();
  assert.equal(await page.locator('#admin-email').evaluate(el=>el===document.activeElement),true);
 }else if(area==='calendar'){
  const picker=page.locator('#calendar-season-picker');
  await activate(picker);
  assert.equal(await page.locator('#calendar-season-menu [role=option]').count(),1);
  await activate(picker);
 }else if(area==='competitions'){
  const tab=page.locator('#competition-tab-fixtures');
  await activate(tab);
  assert.equal(await tab.getAttribute('aria-selected'),'true');
  await tab.focus();await page.keyboard.press('Home');
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
 assert.ok(['localhost','app.localhost'].includes(home.hostname)&&home.port==='2000'&&home.pathname==='/', 'Known loopback home destination');
 await nav.focus();await page.keyboard.press('Enter');
 await page.waitForURL(home.href);
}
