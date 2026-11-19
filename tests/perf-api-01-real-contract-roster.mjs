// PERF-API-01: authentic Player sign-in, authorized Contracts UI and public
// Club Roster in two tabs against the *same disposable local Worker/D1*.
// Runs only with the opt-in 250-player synthetic seed, after world lifecycle.
import assert from 'node:assert/strict';

export async function verifyRealContractRoster(browser,{origin,email,password}){
 const context=await browser.newContext();
 try{
  const operator=await context.newPage();
  await operator.goto(origin+'/account/login');
  await operator.locator('#account-login input[name="email"]').fill(email);
  await operator.locator('#account-login input[name="password"]').fill(password);
  const login=operator.waitForResponse(r=>new URL(r.url()).pathname==='/api/player/login'&&
   r.request().method()==='POST');
  await operator.locator('#account-login button[type="submit"]').click();
  assert.equal((await login).status(),200,'Disposable operator login must succeed');
  // Direct /account/login intentionally lands on the Profile after success;
  // only a login initiated from a protected Admin route returns to /admin.
  await operator.waitForURL(u=>u.pathname==='/account');
  await operator.locator('#protected[aria-busy="false"]').waitFor({state:'visible'});

  const publicRoster=await context.newPage();
  const rosterRequests=[];
  publicRoster.on('request',request=>{
   const url=new URL(request.url());
   if(url.origin===origin&&url.pathname==='/api/clubs/IT-1/roster'&&request.method()==='GET')
    rosterRequests.push(url.pathname);
  });
  await publicRoster.goto(origin+'/clubs/it/1/roster');
  await publicRoster.waitForFunction(()=>document.querySelector('.club-roster[aria-busy="false"]')&&
   document.querySelectorAll('.club-roster-player-link').length===73);
  assert.equal(rosterRequests.length,1,'Initial 73-player IT-1 Roster is one real public GET');

  await operator.bringToFront();
  await operator.goto(origin+'/admin/contracts');
  await operator.locator('[data-contracts-check="1"]').waitFor();
  await operator.locator('[data-contracts-next]').click();
  await operator.locator('[data-contracts-check="51"]').waitFor();
  await operator.locator('[data-contracts-next]').click();
  await operator.locator('[data-contracts-check="150"]').waitFor();
  const readContract=async()=>{
   const result=await operator.evaluate(async()=>{
    const response=await fetch('/api/admin/contracts?playerId=150',{cache:'no-store'});
    return {status:response.status,body:await response.json()};
   });
   assert.equal(result.status,200,'Real D1 Contracts inspection must stay authorized');
   assert.equal(result.body.players.length,1);
   return {clubKey:result.body.players[0].clubKey,worldGeneration:result.body.worldGeneration,
    worldRevision:result.body.worldRevision};
  };
  const initial=await readContract();
  assert.equal(initial.clubKey,null,'Synthetic player 150 is initially unassigned');
  await operator.locator('[data-contracts-check="150"]').check();
  await operator.locator('[data-contracts-trigger]').click();
  await operator.locator('.admin-contracts-club-menu [data-value="IT-1"]').click();
  const assignedPost=operator.waitForResponse(res=>new URL(res.url()).pathname==='/api/admin/contracts'&&
   res.request().method()==='POST');
  await operator.locator('[data-contracts-save]').click();
  assert.equal((await assignedPost).status(),200,'Protected D1 assignment succeeds');
  const assigned=await readContract();
  assert.equal(assigned.clubKey,'IT-1','Assignment actually persisted in local D1');
  assert.equal(assigned.worldGeneration,initial.worldGeneration);
  assert.equal(assigned.worldRevision,initial.worldRevision,
   'Affiliation write does not change the sporting-world revision');

  await publicRoster.bringToFront();
  await publicRoster.waitForFunction(()=>document.querySelector('.club-roster[aria-busy="false"]')&&
   document.querySelectorAll('.club-roster-player-link').length===74&&
   !!document.querySelector('.club-roster-player-link[href="/players/150"]'));
  assert.equal(rosterRequests.length,2,
   'Accepted D1 assignment makes the other tab issue exactly one new roster GET');
  await publicRoster.locator('[data-club-roster-view="attributes"]').click();
  await publicRoster.waitForURL(u=>u.searchParams.get('view')==='attributes'&&u.searchParams.get('group')==='technical');
  assert.equal(rosterRequests.length,2,'In-page Roster view change adds zero network GETs');

  await operator.bringToFront();
  await operator.locator('[data-contracts-rows][aria-busy="false"]').waitFor();
  await operator.locator('[data-contracts-check="150"]').waitFor();
  await operator.locator('[data-contracts-check="150"]').check();
  await operator.locator('[data-contracts-trigger]').click();
  await operator.locator('.admin-contracts-club-menu [data-value="__unassigned__"]').click();
  const removedPost=operator.waitForResponse(res=>new URL(res.url()).pathname==='/api/admin/contracts'&&
   res.request().method()==='POST');
  await operator.locator('[data-contracts-save]').click();
  assert.equal((await removedPost).status(),200,'Protected D1 unassignment succeeds');
  const removed=await readContract();
  assert.equal(removed.clubKey,null,'Unassignment actually persisted in local D1');
  assert.equal(removed.worldGeneration,initial.worldGeneration);
  assert.equal(removed.worldRevision,initial.worldRevision);

  await publicRoster.bringToFront();
  await publicRoster.waitForFunction(()=>document.querySelector('.club-roster[aria-busy="false"]')&&
   document.querySelectorAll('.club-roster-player-link').length===73&&
   !document.querySelector('.club-roster-player-link[href="/players/150"]'));
  assert.equal(rosterRequests.length,3,
   'Accepted D1 unassignment triggers exactly one more roster GET');
  console.log('PERF-API-01 REAL WORKER/D1 CONTRACT-TO-ROSTER PASS: '+JSON.stringify({
   temporarySyntheticPlayers:250,initialClubCount:73,afterAssignCount:74,afterRemoveCount:73,
   guardedContractPosts:2,publicRosterGets:rosterRequests.length,
   extraRosterSubviewGets:0,unchangedSportingWorldRevision:true,restoredSeed:true
  }));
  return true;
 }finally{await context.close()}
}
