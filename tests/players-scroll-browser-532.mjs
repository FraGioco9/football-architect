// #532: deterministic browser-only progress, keyboard and DOM/network cost audit.
// This uses a synthetic intercepted API and never touches D1 or user data.
import assert from 'node:assert/strict';

export async function verifyPlayersScrollBrowser(browser){
 const total=1000,pageSize=50,requests=[],bytes=[];
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 try{
  // Ensure auto-loading is unavailable, so the native keyboard fallback is
  // exercised deterministically rather than racing IntersectionObserver.
  await context.addInitScript(()=>{
   window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  });
  await context.route('**/api/players?*',route=>{
   const url=new URL(route.request().url());
   const offset=Number(url.searchParams.get('offset'));
   assert.ok(Number.isSafeInteger(offset)&&offset>=0&&offset<total&&offset%pageSize===0);
   const players=Array.from({length:Math.min(pageSize,total-offset)},(_,i)=>{
    const id=total-offset-i;
    return {id,display_name:'Player '+id,nationality:'ITA',primary_position:'CM',
     secondary_positions:[],age:24,height_cm:180,preferred_foot:'right',
     attributes:{},clubKey:null,clubName:null};
   });
   const payload=JSON.stringify({players,count:total,page:offset/pageSize+1,
    pageSize,totalPages:Math.ceil(total/pageSize)});
   requests.push(offset);bytes.push(Buffer.byteLength(payload));
   return route.fulfill({status:200,contentType:'application/json',body:payload});
  });
  const page=await context.newPage();
  const start=Date.now();
  const response=await page.goto('http://app.localhost:2000/players?view=overview',
   {waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(response?.status(),200,'Players public route');
  await page.waitForFunction(()=>document.querySelectorAll('.app-players-table tbody tr').length===50&&
   !document.querySelector('.app-players-loading-row'),null,{timeout:15000});
  const firstDataMs=Date.now()-start;
  const status=page.locator('[data-players-append-status]');
  await status.waitFor({state:'attached'});
  assert.equal(await status.getAttribute('role'),'status');
  assert.equal(await status.getAttribute('aria-live'),'polite');
  assert.equal(await status.getAttribute('aria-atomic'),'true');
  const button=page.locator('[data-players-load-more]');
  await button.waitFor({state:'attached'});
  const rows=()=>page.locator('.app-players-table tbody tr').count();
  assert.equal(await rows(),50);

  // One genuine keyboard activation; disabling the button hands focus to the
  // existing focusable scroll region rather than removing keyboard focus.
  await button.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelectorAll('.app-players-table tbody tr').length===100);
  assert.equal(await page.evaluate(()=>
   document.activeElement===document.querySelector('.app-players-table-scroll')),true,
   'keyboard focus persists when Load more becomes disabled');
  assert.match(await status.textContent(),/New players: 50.*Shown: 100 of 1,000/);
  await page.waitForFunction(()=>!document.querySelector('[data-players-load-more]')?.disabled);

  const snapshots=[],durations=[];
  async function snapshot(count){
   const data=await page.evaluate(()=>({
    rows:document.querySelectorAll('.app-players-table tbody tr').length,
    domNodes:document.querySelectorAll('*').length,
    heapBytes:Number.isFinite(performance.memory?.usedJSHeapSize)
     ?performance.memory.usedJSHeapSize:null
   }));
   assert.equal(data.rows,count);
   snapshots.push(data);
  }
  await snapshot(100);
  for(let loaded=150;loaded<=total;loaded+=50){
   const before=Date.now();
   // Keep the UX unchanged: invoke the native fallback programmatically
   // after the initial real keyboard activation, without scrolling the page
   // into an auto-append trigger.
   await button.evaluate(node=>node.click());
   await page.waitForFunction(n=>document.querySelectorAll('.app-players-table tbody tr').length===n,
    loaded,{timeout:15000});
   durations.push(Date.now()-before);
   if(loaded<total)await page.waitForFunction(()=>!document.querySelector('[data-players-load-more]')?.disabled);
   if(loaded===250||loaded===total)await snapshot(loaded);
  }
  assert.equal(await rows(),total,'current implementation retains all appended DOM rows');
  assert.equal(await page.locator('[data-players-progress]').evaluate(n=>n.hidden),true,
   'no visible fallback after EOF');
  assert.equal(await status.count(),1,'live region persists when pager hides');
  assert.match(await status.textContent(),/All players loaded/);
  assert.deepEqual(requests,Array.from({length:total/pageSize},(_,i)=>i*pageSize),
   'one synthetic request per offset');
  const ordered=[...durations].sort((a,b)=>a-b);
  const p95=ordered[Math.ceil(ordered.length*0.95)-1];
  const diagnostics={mode:'synthetic intercepted API, Chromium; NOT hosted D1',
   rows:total,firstDataMs,requests:requests.length,
   responseBytes:bytes.reduce((sum,n)=>sum+n,0),
   appendMedianMs:ordered[Math.floor(ordered.length/2)],appendP95Ms:p95,snapshots};
  console.log('#532 browser-only Players diagnostic: '+JSON.stringify(diagnostics));
  return 1;
 }finally{await context.close()}
}
