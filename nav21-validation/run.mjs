import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {PAGE_ROUTES,parseAppRoute,isKnownAppRoutePath,playerPath,matchPreviewPath} from '../src/router.js';

const base='http://127.0.0.1:2000';

function routeModelGate(){
  const expected={
    dashboard:'/dashboard',calendar:'/calendar',inbox:'/inbox',club:'/club',squad:'/squad',
    tactics:'/tactics',training:'/training',youth:'/youth',league:'/league',world:'/world',
    advanced:'/advanced',market:'/market',finance:'/finance',board:'/board',manager:'/manager',
    settings:'/settings',careers:'/careers'
  };
  assert.deepEqual(PAGE_ROUTES,expected);
  for(const [page,path] of Object.entries(expected)){
    const route=parseAppRoute(path);
    assert.equal(route.kind,'page',path);
    assert.equal(route.page,page,path);
    assert.equal(isKnownAppRoutePath(path),true,path);
  }
  assert.equal(parseAppRoute('/').page,'home');
  assert.equal(parseAppRoute('/careers/new').kind,'new-career');
  assert.deepEqual(parseAppRoute('/player/42'),{kind:'player',playerId:42,path:'/player/42',requiresCareer:true});
  assert.equal(parseAppRoute('/match/season-1:round-2/preview').kind,'match-preview');
  assert.equal(playerPath(42),'/player/42');
  assert.equal(matchPreviewPath('season-1:round-2'),'/match/season-1%3Around-2/preview');
  assert.equal(parseAppRoute('/not-a-route').kind,'not-found');
}

async function httpGate(){
  const valid=['/',...Object.values(PAGE_ROUTES),'/careers/new','/player/1','/match/demo-1/preview'];
  for(const path of valid){
    const response=await fetch(base+path,{redirect:'manual'});
    assert.equal(response.status,200,'server route '+path);
  }
  const unknown=await fetch(base+'/definitely-not-a-route',{redirect:'manual'});
  assert.equal(unknown.status,404,'unknown app route must be HTTP 404');
  assert.match(await unknown.text(),/Football Architect/i,'unknown extensionless route should render the app 404 shell');
  const missingAsset=await fetch(base+'/missing-nav21.js',{redirect:'manual'});
  assert.equal(missingAsset.status,404,'missing asset must stay a plain 404');
}

async function cleanBrowserGate(browser){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push('pageerror: '+error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push('console: '+message.text());});
  let response=await page.goto(base+'/dashboard',{waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  assert.equal(new URL(page.url()).pathname,'/careers');
  assert.equal(new URL(page.url()).searchParams.get('next'),'/dashboard');
  assert.match(await page.locator('body').innerText(),/Carriere|Careers/i);

  response=await page.goto(base+'/settings',{waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  assert.equal(new URL(page.url()).pathname,'/settings');
  assert.match(await page.locator('body').innerText(),/Impostazioni|Settings/i);

  response=await page.goto(base+'/definitely-not-a-route',{waitUntil:'networkidle'});
  assert.equal(response.status(),404);
  assert.equal(new URL(page.url()).pathname,'/definitely-not-a-route');
  assert.match(await page.locator('h1').innerText(),/Pagina non trovata|Page not found/i);
  assert.equal(errors.length,0,'clean browser errors: '+errors.join(' | '));
  await context.close();
}

async function activeCareerGate(browser){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push('pageerror: '+error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push('console: '+message.text());});

  await page.goto(base+'/',{waitUntil:'networkidle'});
  await page.locator('[data-action="menu-new"]').click();
  await page.waitForURL('**/careers/new');
  await page.locator('#manager-name').fill('NAV21 Test');
  await page.locator('[data-action="start-career"]').click();
  await page.waitForURL('**/dashboard');
  await page.waitForTimeout(400);

  const routePaths=Object.entries(PAGE_ROUTES).filter(([page])=>page!=='careers');
  for(const [pageId,path] of routePaths){
    const response=await page.goto(base+path,{waitUntil:'networkidle'});
    assert.equal(response.status(),200,'browser route '+path);
    assert.equal(new URL(page.url()).pathname,path,'path after refresh '+path);
    assert.equal(await page.locator('#main-content').count(),1,'main content '+pageId);
  }

  await page.goto(base+'/dashboard',{waitUntil:'networkidle'});
  await page.locator('[data-action="nav"][data-page="calendar"]').first().click();
  await page.waitForURL('**/calendar');
  await page.locator('[data-action="nav"][data-page="squad"]').first().click();
  await page.waitForURL('**/squad');
  await page.goBack({waitUntil:'networkidle'});
  assert.equal(new URL(page.url()).pathname,'/calendar','Back should restore calendar');
  await page.goBack({waitUntil:'networkidle'});
  assert.equal(new URL(page.url()).pathname,'/dashboard','Back should restore dashboard');
  await page.goForward({waitUntil:'networkidle'});
  assert.equal(new URL(page.url()).pathname,'/calendar','Forward should restore calendar');

  await page.goto(base+'/calendar',{waitUntil:'networkidle'});
  await page.locator('[data-language-switch]').first().selectOption('en');
  assert.equal(new URL(page.url()).pathname,'/calendar','language switch must preserve route');
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  await page.locator('[data-language-switch]').first().selectOption('it');
  assert.equal(new URL(page.url()).pathname,'/calendar');
  assert.equal(await page.locator('html').getAttribute('lang'),'it');

  await page.goto(base+'/squad',{waitUntil:'networkidle'});
  const player=page.locator('[data-action="player"][data-id]').first();
  const playerId=await player.getAttribute('data-id');
  assert.ok(playerId,'player id');
  await player.click();
  await page.waitForURL(new RegExp('/player/'+playerId+'$'));
  assert.equal(new URL(page.url()).pathname,'/player/'+playerId);
  await page.goBack({waitUntil:'networkidle'});
  assert.equal(new URL(page.url()).pathname,'/squad','player Back');
  await page.goForward({waitUntil:'networkidle'});
  assert.equal(new URL(page.url()).pathname,'/player/'+playerId,'player Forward');
  const directPlayer=await page.goto(base+'/player/'+playerId,{waitUntil:'networkidle'});
  assert.equal(directPlayer.status(),200);
  assert.equal(new URL(page.url()).pathname,'/player/'+playerId);

  await page.goto(base+'/dashboard',{waitUntil:'networkidle'});
  const preview=page.locator('[data-action="preview-match"][data-id]').first();
  const matchId=await preview.getAttribute('data-id');
  assert.ok(matchId,'match id');
  await preview.click();
  const matchPath=matchPreviewPath(matchId);
  assert.equal(new URL(page.url()).pathname,matchPath);
  await page.goBack({waitUntil:'networkidle'});
  assert.equal(new URL(page.url()).pathname,'/dashboard','match Back');
  const directMatch=await page.goto(base+matchPath,{waitUntil:'networkidle'});
  assert.equal(directMatch.status(),200);
  assert.equal(new URL(page.url()).pathname,matchPath,'match refresh/direct route');

  await page.setViewportSize({width:390,height:844});
  for(const path of ['/dashboard','/calendar','/squad','/market','/settings']){
    const response=await page.goto(base+path,{waitUntil:'networkidle'});
    assert.equal(response.status(),200,'mobile '+path);
    assert.equal(new URL(page.url()).pathname,path,'mobile path '+path);
  }

  assert.equal(errors.length,0,'active browser errors: '+errors.join(' | '));
  await context.close();
}

routeModelGate();
await httpGate();
const browser=await chromium.launch({headless:true});
try{
  await cleanBrowserGate(browser);
  await activeCareerGate(browser);
}finally{
  await browser.close();
}
console.log('NAV21 VALIDATION PASS');
