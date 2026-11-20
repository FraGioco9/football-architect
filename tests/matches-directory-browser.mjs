import assert from 'node:assert/strict';

export async function verifyMatchesDirectory(browser){
 const context=await browser.newContext({locale:'en'});
 try{
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:15,seasonNumber:1,day:13,phase:'active'};
  let requests=0;
  await page.route('**/api/world',route=>route.fulfill({json:{world}}));
  await page.route('**/api/matches?*',route=>{
   const day=Number(new URL(route.request().url()).searchParams.get('day'));requests++;
   return route.fulfill({json:{schemaVersion:1,providerId:'authoritative-world',world,selectedSeason:1,day,publication:'published',fixtures:day===13?[
    {matchId:'17',competitionId:'IT-1',phaseId:'league',round:1,homeClubId:'IT-1',awayClubId:'IT-2',result:{homeGoals:2,awayGoals:1},status:'completed'}
   ]:[]}});
  });
  await page.goto('http://app.localhost:2000/matches');
  const match=page.locator('#md-list .md-score');
  await match.waitFor();
  assert.equal(new URL(await match.getAttribute('href'),page.url()).pathname,'/matches/17');
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:800});
   assert(await page.locator('.matches-directory').evaluate(n=>n.clientWidth>0&&n.scrollWidth<=n.clientWidth+1),'directory overflow '+width);
  }
  await page.locator('#md-country').selectOption('ENG');
  assert.equal(await match.count(),0);
  await page.goBack();await match.waitFor();
  assert.equal(requests,1,'filter and Back reuse the same day');
  await page.locator('#md-next').click();
  await page.getByText('No matches on this day.').waitFor();
  await page.locator('#md-current').click();await match.waitFor();
  await page.locator('#md-q').fill('xxxx');
  await page.getByText('No matching fixtures.').waitFor();
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
}
