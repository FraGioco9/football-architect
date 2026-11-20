import assert from 'node:assert/strict';

export async function verifyMatchesDirectory(browser){
 const context=await browser.newContext({locale:'en'});
 try{
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:15,seasonNumber:1,day:13,phase:'active'};
  let requests=0;
  let releaseLogo;
  const pendingLogo=new Promise(resolve=>{releaseLogo=resolve});
  await page.route('**/assets/divisions/**/*.svg',async route=>{await pendingLogo;await route.abort()});
  await page.route('**/assets/clubs/**/*.svg',route=>route.abort());
  let releaseWorld;
  const initialWorld=new Promise(resolve=>{releaseWorld=resolve});
  await page.route('**/api/world',async route=>{await initialWorld;await route.fulfill({json:{world}})});
  await page.route('**/api/matches?*',route=>{
   const day=Number(new URL(route.request().url()).searchParams.get('day'));requests++;
   return route.fulfill({json:{schemaVersion:1,providerId:'authoritative-world',world,selectedSeason:1,day,publication:'published',fixtures:day===13?[
    {matchId:'17',competitionId:'BR-2',phaseId:'league',round:1,homeClubId:'BR-34',awayClubId:'BR-29',venue:'Estádio das Charqueadas',result:{homeGoals:2,awayGoals:1},status:'completed'}
   ]:day===15?[{matchId:'18',competitionId:'IT-1',phaseId:'league',round:2,homeClubId:'IT-1',awayClubId:'IT-2',result:null,status:'scheduled'}]:[]}});
  });
  await page.goto('http://app.localhost:2000/matches',{waitUntil:'domcontentloaded'});
  const match=page.locator('#md-list .md-score');
  assert.equal(await page.locator('#md-season-value').textContent(),'');
  assert.equal(await page.locator('#md-day-value').textContent(),'');
  const widths=[320,375,390,540,541,768,1440],loading=new Map();
  for(const width of widths){
   await page.setViewportSize({width,height:800});
   const name=await page.locator('#md-list .md-name-bar').boundingBox();
   assert(name.width>0);
   loading.set(width,{nameX:name.x,height:(await page.locator('.md-skeleton').first().boundingBox()).height});
  }
  releaseWorld();
  await match.waitFor();
  assert.equal(new URL(await match.getAttribute('href'),page.url()).pathname,'/matches/17');
  assert.equal(await page.locator('#md-list h2 a .md-logo').count(),0);
  assert(await page.locator('#md-current').isDisabled());
  assert.equal(await page.locator('#md-list h2 > .md-logo').textContent(),'');
  assert.equal(await page.locator('#md-list h2 > .app-competition-logo-placeholder').count(),0);
  releaseLogo();
  await page.locator('#md-list h2 > .app-competition-logo-placeholder').waitFor();
  assert.equal(await page.locator('#md-list h2 small').innerText(),'Round 1');
  assert.equal(await page.locator('.md-row').getByText('Round 1').count(),0);
  assert.equal(await page.locator('.md-row .md-team:first-child > a + .md-logo').count(),1);
  assert.equal(await page.locator('.md-row .md-team:last-of-type > .md-logo + a').count(),1);
  assert.equal(await page.locator('#md-list img').count(),0,'failed images keep the placeholders');
  await match.hover();
  assert.equal(await match.evaluate(a=>getComputedStyle(a).textDecorationLine),'none');
  await page.evaluate(()=>document.querySelector('.fa-shell-content-scroll').dispatchEvent(new Event('scroll')));
  assert.equal(await page.locator('.matches-directory[data-scrolling]').count(),1);
  await page.mouse.move(1,1);
  await page.waitForFunction(()=>!document.querySelector('.matches-directory[data-scrolling]'));
  const divisionLogo=await page.locator('#md-list h2 > .md-logo').elementHandle();
  for(const width of widths){
   await page.setViewportSize({width,height:800});
   assert.equal((await page.locator('.md-row').boundingBox()).height,loading.get(width).height);
   assert.equal((await page.locator('#md-list h2 a').boundingBox()).x,loading.get(width).nameX);
   const searchBox=await page.locator('#md-q').boundingBox(),filterBox=await page.locator('#md-country').boundingBox();
   const [prev,day,next]=await Promise.all(['prev','day','next'].map(id=>page.locator('#md-'+id).boundingBox()));
   for(const arrow of [prev,next]){
    assert.equal(arrow.width,day.height);
    assert.equal(arrow.height,day.height);
    assert.equal(arrow.y,day.y);
   }
   for(const id of ['prev','next']){
    const button=page.locator('#md-'+id),box=await button.boundingBox(),icon=await button.locator('path').boundingBox();
    assert(Math.abs(box.x+box.width/2-icon.x-icon.width/2)<1);
    assert(Math.abs(box.y+box.height/2-icon.y-icon.height/2)<1);
   }
   assert(prev.x+prev.width<=day.x&&day.x+day.width<=next.x);
   assert.equal(searchBox.height,filterBox.height,'search and filter heights match');
   assert(await page.locator('.matches-directory').evaluate(n=>n.clientWidth>0&&n.scrollWidth<=n.clientWidth+1),'directory overflow '+width);
  }
  for(const key of ['season','day','country','competition','search']){
   const caption=page.locator('.md-field > [data-word="'+key+'"]');
   await caption.hover();
   assert.equal(await page.locator('.md-controls :is(button,input):hover').count(),0);
   await caption.click();
   assert.equal(await page.locator('.md-controls :is(input:focus,button:focus,[aria-expanded="true"])').count(),0);
  }
  await page.getByRole('searchbox',{name:'Search team'}).click();
  assert(await page.locator('#md-q').evaluate(input=>input===document.activeElement));
  const searchBefore=await page.locator('#md-q').boundingBox();
  await page.locator('#md-country').click();
  await page.locator('#md-country-menu [data-menu-value="ENG"]').click();
  assert.deepEqual(await page.locator('#md-q').boundingBox(),searchBefore);
  assert.equal(await match.count(),0);
  await page.goBack();await match.waitFor();
  assert(await divisionLogo.evaluate(slot=>slot===document.querySelector('#md-list h2 > .md-logo')),'reuse the resolved logo on return');
  assert.equal(requests,1,'filter and Back reuse the same day');
  await page.locator('#md-next').click();
  await page.getByText('No matches on this day.').waitFor();
  assert(await page.locator('#md-current').isEnabled());
  await page.locator('#md-next').click();await match.waitFor();
  assert.equal(await page.locator('#md-list h2 small').innerText(),'Round 2');
  const href=new URL(await page.locator('#md-list h2 a').getAttribute('href'),page.url());
  assert.equal(href.pathname,'/competitions/it-1/fixtures');
  assert.equal(href.searchParams.get('matchday'),'2');
  assert.equal(href.searchParams.get('season'),'1');
  await page.goBack();await page.getByText('No matches on this day.').waitFor();
  await page.goForward();await match.waitFor();
  await page.locator('#md-current').click();await match.waitFor();
  assert.equal(requests,3,'Back, Forward and Current day reuse all visited days, including empty ones');
  world.revision++;
  await page.evaluate(()=>dispatchEvent(new Event('fa:world-invalidated')));
  await match.waitFor();
  assert.equal(requests,4,'refresh after world invalidation');
  await page.locator('#md-q').fill('xxxx');
  await page.getByText('No matching fixtures.').waitFor();
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
}
