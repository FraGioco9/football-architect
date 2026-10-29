import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {renderAdminSettings} from '../tools/render-admin-settings.mjs';
const require=createRequire(import.meta.url);
const {createAdminController,canRunCommand}=require('../assets/admin-settings.js');
const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:0,seasonNumber:0,day:0,phase:'unstarted'};
const session={actor:{id:'operator',email:'operator@example.invalid'},csrfToken:'a'.repeat(64)};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
const error=(status,code)=>Object.assign(Error(code),{status,code});
test('Admin renderer preserves password-manager labels and public signed-out independence',()=>{
 const html=renderAdminSettings();assert.match(html,/autocomplete="username"/);assert.match(html,/autocomplete="current-password"/);
 assert.match(html,/<label[^>]*for="admin-email"/);assert.match(html,/<label[^>]*for="admin-password"/);
 assert.match(html,/aria-live="polite"/);assert.doesNotMatch(html,/signup|localStorage|sessionStorage/);
});
test('logout supersedes a pending login response and clears authority immediately',async()=>{
 const pending=deferred();const sent=[];
 const c=createAdminController(async(path,options)=>{sent.push(path);return path.endsWith('login')?pending.promise:{signedOut:true}},()=>{});
 const login=c.login('operator@example.invalid','synthetic-password-2026');await c.logout();pending.resolve(session);await login;
 assert.equal(c.state().actor,null);assert.equal(c.state().world,null);assert.deepEqual(sent,['/api/admin/login','/api/admin/logout','/api/admin/logout']);
});
test('delayed world reads after logout cannot restore controls',async()=>{
 const pending=deferred();
 const c=createAdminController(async path=>path.endsWith('session')?session:path.endsWith('world')?pending.promise:{signedOut:true},()=>{});
 const read=c.refresh();await new Promise(r=>setImmediate(r));await c.logout();pending.resolve({world});await read;
 assert.equal(c.state().actor,null);assert.equal(c.state().world,null);
});
test('newer request wins and lower world revisions cannot overwrite observed state',async()=>{
 const pending=deferred();let reads=0;
 const c=createAdminController(async path=>path.endsWith('session')?session:++reads===1?pending.promise:{world:{...world,revision:2,seasonNumber:1,phase:'preparing'}},()=>{});
 const first=c.refresh();await new Promise(r=>setImmediate(r));await c.refresh();pending.resolve({world});await first;
 assert.equal(c.state().world.revision,2);
});
test('changed generation requires an authenticated reread, never compares generation strings',async()=>{
 let reads=0;const changed={...world,generation:'650e8400-e29b-41d4-a716-446655440000'};
 const c=createAdminController(async path=>path.endsWith('session')?session:{world:++reads===1?world:changed},()=>{});
 await c.refresh();await c.refresh();assert.equal(c.state().world.generation,changed.generation);assert.equal(reads,3);
});
test('missing API and unauthorized responses clear privileged state honestly',async()=>{
 for(const failure of [error(404,'not_found'),error(401,'unauthorized'),error(503,'admin_unavailable')]){
  const c=createAdminController(async()=>{throw failure},()=>{});await c.refresh();assert.equal(c.state().actor,null);assert.equal(c.state().world,null);
  assert.equal(c.state().message,failure.status===401?'signedOut':'unavailable');
 }
});
test('prepare is single-flight, sends only concurrency metadata, preserves retry key and shows prerequisites',async()=>{
 const pending=deferred();let mutations=0,firstKey;
 const c=createAdminController(async(path,options)=>{
  if(path.endsWith('session'))return session;if(path.endsWith('world'))return {world};
  mutations++;assert.deepEqual(options.body,{expectedGeneration:world.generation,expectedRevision:0});
  assert.equal(options.headers['X-CSRF-Token'],session.csrfToken);
  if(!firstKey)firstKey=options.headers['Idempotency-Key'];else assert.equal(options.headers['Idempotency-Key'],firstKey);
  return pending.promise;
 },()=>{});
 await c.refresh();const first=c.prepare();await c.prepare();assert.equal(mutations,1);
 pending.resolve(Promise.reject(error(422,'catalogue_not_approved')));await first;assert.equal(c.state().message,'prerequisite');
 await c.prepare();assert.equal(mutations,2);
});

test('failed logout retains a retry action without restoring privileged controls',async()=>{
 let fail=false;const c=createAdminController(async path=>{if(fail)throw error(503,'admin_unavailable');return path.endsWith('session')?session:{world}},()=>{});
 await c.refresh();fail=true;await c.logout();assert.equal(c.state().actor,null);assert.equal(c.state().logoutNeeded,true);assert.equal(c.state().message,'logoutFailed');
});
test('a late login world response cannot hide retry after a failed logout',async()=>{
 const pending=deferred();
 const c=createAdminController(async path=>{
  if(path.endsWith('login'))return session;
  if(path.endsWith('world'))return pending.promise;
  throw error(503,'admin_unavailable');
 },()=>{});
 const signingIn=c.login('operator@example.invalid','synthetic-password-2026');await new Promise(r=>setImmediate(r));
 await c.logout();assert.equal(c.state().logoutNeeded,true);
 pending.resolve({world});await signingIn;
 assert.equal(c.state().actor,null);assert.equal(c.state().world,null);assert.equal(c.state().logoutNeeded,true);assert.equal(c.state().message,'logoutFailed');
});

test('reset UI requires typed confirmation, is single-flight and rotates world generation',async()=>{
 const active={...world,phase:'preparing',seasonNumber:1,revision:2},next={...world,generation:'650e8400-e29b-41d4-a716-446655440000'};
 const pending=deferred();let resets=0;
 const c=createAdminController(async(path,options)=>{
  if(path.endsWith('session'))return session;
  if(path.endsWith('world'))return {world:active};
  if(path.endsWith('/reset')){resets++;assert.deepEqual(options.body,{expectedGeneration:active.generation,expectedRevision:2,confirmation:'RESET SEASON 0'});assert.equal(options.headers['X-CSRF-Token'],session.csrfToken);return pending.promise}
  throw Error(path);
 },()=>{});
 await c.refresh();await c.reset('WRONG');assert.equal(resets,0);
 const first=c.reset('RESET SEASON 0');await c.reset('RESET SEASON 0');assert.equal(resets,1);
 pending.resolve({world:next,operationId:'reset-123'});await first;
 assert.deepEqual(c.state().world,next);assert.equal(c.state().message,'resetDone');
 await c.reset('RESET SEASON 0');assert.equal(resets,1);
});
test('reset controls are rendered with explicit irreversible summary and confirmation',()=>{
 const html=renderAdminSettings();assert.match(html,/data-admin-reset-section/);assert.match(html,/data-admin-reset-confirm/);assert.match(html,/data-admin-reset/);assert.match(html,/Delete all seasons/);
});

test('operator status reports pending action, backend prerequisite and clears it after logout',async()=>{
 const prepared={...world,phase:'preparing',seasonNumber:1,revision:1};
 const pending=deferred();
 const c=createAdminController(async(path)=>{
  if(path.endsWith('session'))return session;
  if(path.endsWith('world'))return {world};
  if(path.endsWith('prepare'))return pending.promise;
  return {signedOut:true};
 },()=>{});
 await c.refresh();
 const operation=c.prepare();
 assert.equal(c.state().operation,'prepare');
 pending.resolve(Promise.reject(error(422,'catalogue_not_approved')));
 await operation;
 assert.equal(c.state().operation,'blocked');
 assert.equal(c.state().errorCode,'catalogue_not_approved');
 await c.logout();
 assert.equal(c.state().actor,null);
 assert.equal(c.state().operation,'idle');
 assert.equal(c.state().errorCode,null);
});
test('settings markup includes accessible authoritative operation and backend error fields',()=>{
 const html=renderAdminSettings();
 assert.match(html,/data-admin-operation/);
 assert.match(html,/data-admin-error-code/);
 assert.match(html,/aria-live="polite"/);
});

test('operational command is single-flight, revision-bound and cannot run signed out',async()=>{
 const preparing={...world,phase:'preparing',seasonNumber:1,revision:1};
 const result={...preparing,revision:2};
 const pending=deferred();let calls=0;
 const c=createAdminController(async(path,opts)=>{
  if(path.endsWith('/session'))return session;
  if(path.endsWith('/world'))return {world:preparing};
  if(path.endsWith('/events/initialize')){calls++;assert.deepEqual(opts.body,{expectedGeneration:preparing.generation,expectedRevision:1});assert.equal(opts.headers['X-CSRF-Token'],session.csrfToken);return pending.promise}
  throw Error(path);
 },()=>{});
 await c.command('initialize');assert.equal(calls,0);
 await c.refresh();
 const run=c.command('initialize');await c.command('initialize');assert.equal(calls,1);
 assert.equal(c.state().operation,'initialize');
 pending.resolve({world:result,operationId:'unit-operation'});
 await run;
 assert.equal(c.state().world.revision,2);
 assert.equal(c.state().operation,'completed');
});
test('operational command refuses stale generation response and reports an error',async()=>{
 const preparing={...world,phase:'preparing',seasonNumber:1,revision:1};
 const c=createAdminController(async(path)=>path.endsWith('/session')?session:path.endsWith('/world')?{world:preparing}:{world:{...preparing,generation:'650e8400-e29b-41d4-a716-446655440000',revision:2}},()=>{});
 await c.refresh();await c.command('initialize');
 assert.equal(c.state().message,'unavailable');
});

test('authenticated event snapshot is retained only when tied to current generation and revision',async()=>{
 const active={...world,phase:'active',seasonNumber:1,day:3,revision:7};
 const good={world:active,mode:'administrative',events:[{id:'international:draw',kind:'draw-international',status:'scheduled',day:3,order:1}]};
 const c=createAdminController(async path=>path.endsWith('/session')?session:path.endsWith('/world')?{world:active}:good,()=>{});
 await c.refresh();assert.equal(c.state().events.mode,'administrative');
 assert.equal(c.state().events.rows[0].id,'international:draw');
 const stale=createAdminController(async path=>path.endsWith('/session')?session:path.endsWith('/world')?{world:active}:{...good,world:{...active,revision:6}},()=>{});
 await stale.refresh();assert.equal(stale.state().events,null);
});

test('action availability is derived exclusively from matching authenticated world evidence',()=>{
 const preparing={...world,phase:'preparing',seasonNumber:1,revision:2};
 const events={mode:'administrative',worldGeneration:preparing.generation,worldRevision:2,rows:[]};
 assert.equal(canRunCommand('eventStart',preparing,events),true);
 assert.equal(canRunCommand('start',preparing,events),false);
 assert.equal(canRunCommand('initialize',preparing,events),false);
 assert.equal(canRunCommand('eventStart',preparing,{...events,worldRevision:1}),false);
 const active={...preparing,phase:'active',day:3};
 const drawn={...events,rows:[{id:'international:draw',kind:'draw-international',day:3,status:'scheduled'}]};
 assert.equal(canRunCommand('draw',active,drawn),true);
 assert.equal(canRunCommand('publish',active,drawn),false);
 assert.equal(canRunCommand('confirm',active,drawn),false);
 assert.equal(canRunCommand('draw',active,{...drawn,worldGeneration:'650e8400-e29b-41d4-a716-446655440000'}),false);
 assert.equal(canRunCommand('advance',active,{...drawn,mode:'legacy'}),true);
 assert.equal(canRunCommand('eventAdvance',active,drawn),true);
 const last={...active,day:56};
 assert.equal(canRunCommand('close',last,{...drawn,mode:'legacy'}),true);
 assert.equal(canRunCommand('advance',last,{...drawn,mode:'legacy'}),false);
});

test('event rescheduling rejects past and out-of-range values and sends a guarded revision',async()=>{
 const preparing={...world,seasonNumber:1,phase:'preparing',revision:3,day:0};
 const events={world:preparing,mode:'administrative',events:[{id:'international:draw',kind:'draw-international',status:'scheduled',day:3,order:1}]};
 let writes=0;
 const c=createAdminController(async(path,opts)=>{
  if(path.endsWith('/session'))return session;
  if(path.endsWith('/world'))return {world:preparing};
  if(path.endsWith('/events'))return events;
  if(path.endsWith('/reschedule')){writes++;assert.deepEqual(opts.body,{expectedGeneration:preparing.generation,expectedRevision:3,eventId:'international:draw',day:4,order:2});return {world:{...preparing,revision:4}}}
  throw Error(path);
 },()=>{});
 await c.refresh();
 await c.reschedule('international:draw',0,2);
 await c.reschedule('international:draw',13,2);
 await c.reschedule('unknown',4,2);
 assert.equal(writes,0);
 await c.reschedule('international:draw',4,2);
 assert.equal(writes,1);
});

test('only the first outstanding due milestone can be selected for execution',()=>{
 const active={...world,seasonNumber:1,phase:'active',day:3,revision:4};
 const projection={mode:'administrative',worldGeneration:active.generation,worldRevision:active.revision,rows:[
  {id:'international:calendar',kind:'generate-international-calendar',day:3,order:2,status:'scheduled'},
  {id:'international:draw',kind:'draw-international',day:3,order:1,status:'scheduled'}
 ]};
 assert.equal(canRunCommand('draw',active,projection),true);
 assert.equal(canRunCommand('publish',active,projection),false);
 const completed={...projection,rows:[{...projection.rows[0]},{...projection.rows[1],status:'completed'}]};
 assert.equal(canRunCommand('publish',active,completed),true);
 const overdue={...projection,rows:[{...projection.rows[1],day:2},projection.rows[0]]};
 assert.equal(canRunCommand('publish',active,overdue),false);
 assert.equal(canRunCommand('draw',active,overdue),false);
});

test('sporting day advancement becomes available only after administrative calendar publication',()=>{
 const active={...world,seasonNumber:1,phase:'active',day:3,revision:9};
 const events={mode:'sporting',worldGeneration:active.generation,worldRevision:active.revision,rows:[
  {id:'international:calendar',day:3,kind:'generate-international-calendar',status:'completed'}
 ]};
 assert.equal(canRunCommand('advance',active,events),true);
 assert.equal(canRunCommand('eventAdvance',active,events),false);
 assert.equal(canRunCommand('advance',active,{...events,mode:'administrative'}),false);
 assert.equal(canRunCommand('advance',active,{...events,worldRevision:8}),false);
});
