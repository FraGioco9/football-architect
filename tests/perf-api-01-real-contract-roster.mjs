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

  await operator.goto(origin+'/admin/contracts');
  await operator.locator('[data-contracts-player="1"]').waitFor();
  await operator.locator('[data-contracts-next]').click();
  await operator.locator('[data-contracts-player="51"]').waitFor();
  await operator.locator('[data-contracts-next]').click();
  await operator.locator('[data-contracts-player="150"]').waitFor();
  const read=await operator.evaluate(async()=>{
   const response=await fetch('/api/admin/contracts?playerId=150',{cache:'no-store'});
   return {status:response.status,body:await response.json()};
  });
  assert.equal(read.status,200);
  assert.equal(read.body.players.length,1);
  assert.ok(Object.hasOwn(read.body.players[0],'contract'));
  const retired=await operator.evaluate(async()=>{const r=await fetch('/api/admin/contracts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerId:150,clubKey:'IT-1'})});return r.status});
  assert.equal(retired,405,'Legacy assignment route is retired');
  assert.equal(await operator.locator('[data-contracts-save],[data-contracts-check]').count(),0);
  const publicRoster=await context.newPage();
  const rosterRequests=[];
  publicRoster.on('request',request=>{const u=new URL(request.url());if(u.origin===origin&&u.pathname==='/api/clubs/IT-1/roster'&&request.method()==='GET')rosterRequests.push(u.pathname)});
  await publicRoster.goto(origin+'/clubs/it/1/roster');
  await publicRoster.locator('.club-roster[aria-busy="false"]').waitFor();
  assert.equal(rosterRequests.length,1);
  await publicRoster.locator('[data-club-roster-view="attributes"]').click();
  await publicRoster.waitForURL(u=>u.searchParams.get('view')==='attributes'&&u.searchParams.get('group')==='technical');
  assert.equal(rosterRequests.length,1,'Roster subview adds no extra GET');
  console.log('PERF-API-01 REAL WORKER/D1 CONTRACT INSPECTION PASS: '+JSON.stringify({legacyAssignmentRetired:true,publicRosterGets:rosterRequests.length,extraRosterSubviewGets:0}));
  return true;
 }finally{await context.close()}
}
