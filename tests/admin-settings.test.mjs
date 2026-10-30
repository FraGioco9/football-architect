import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {renderAdminSettings} from '../tools/render-admin-settings.mjs';
const require=createRequire(import.meta.url);
const {createAdminController:rawCreateAdminController,canRunCommand}=require('../assets/admin-settings.js');
// Legacy world-command fixtures use the new unified-permission endpoint.
const createAdminController=(request,changed)=>rawCreateAdminController(
 (path,options)=>path==='/api/player/permissions'
  ?Promise.resolve({permissions:['admin.access','admin.world.read','admin.world.write']})
  :request(path,options),changed);
const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:0,seasonNumber:0,day:0,phase:'unstarted'};
const session={actor:{id:'operator',email:'operator@example.invalid'},csrfToken:'a'.repeat(64)};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
const error=(status,code)=>Object.assign(Error(code),{status,code});
test('Admin renderer delegates sign-in to unified account with no password form',()=>{
 const html=renderAdminSettings();
 assert.match(html,/data-admin-signin-link/);
 assert.ok(html.includes('/account/login/?next=%2Fsettings%2F'));
 assert.match(html,/data-admin-no-permission/);
 assert.doesNotMatch(html,/data-admin-login|admin-password|autocomplete="current-password"/);
 assert.doesNotMatch(html,/localStorage|sessionStorage/);
});
test('late world read cannot restore authority after a revoked session',async()=>{
 const pending=deferred(),started=deferred();let revoked=false,writes=0;
 const c=rawCreateAdminController(async(path,options)=>{
  if(options?.body){writes++;throw Error('unexpected mutation');}
  if(revoked)throw error(401,'unauthorized');
  if(path.endsWith('/session'))return session;
  if(path==='/api/player/permissions')return {permissions:['admin.access','admin.world.read','admin.world.write']};
  if(path.endsWith('/world')){started.resolve();return pending.promise;}
  return {world,mode:'uninitialized',events:[]};
 },()=>{});
 const read=c.refresh();await started.promise;
 revoked=true;await c.refresh();
 pending.resolve({world});await read;
 assert.equal(c.state().actor,null);
 assert.equal(c.state().world,null);
 assert.equal(c.state().events,null);
 assert.deepEqual(c.state().permissions,[]);
 assert.equal(c.state().message,'signedOut');
 assert.equal(c.state().busy,false);
 await c.prepare();await c.reset('RESET SEASON 0');await c.command('advance');
 assert.equal(writes,0);
});
test('newer request wins and lower world revisions cannot overwrite observed state',async()=>{
 const pending=deferred();let reads=0;
 const c=createAdminController(async path=>path.endsWith('session')?session:++reads===1?pending.promise:{world:{...world,revision:2,seasonNumber:1,phase:'preparing'}},()=>{});
 const first=c.refresh();await new Promise(r=>setImmediate(r));await c.refresh();pending.resolve({world});await first;
 assert.equal(c.state().world.revision,2);
});
test('changed generation requires an authenticated reread, never compares generation strings',async()=>{
 let reads=0;const changed={...world,generation:'650e8400-e29b-41d4-a716-446655440000'};
 const c=createAdminController(async path=>{if(path.endsWith('/session'))return session;if(path.endsWith('/world'))return {world:++reads===1?world:changed};return {world:reads===1?world:changed,mode:'uninitialized',events:[]}},()=>{});
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
  if(path.endsWith('/events'))return {world,mode:'uninitialized',events:[]};
  assert.equal(path,'/api/admin/seasons/prepare');mutations++;assert.deepEqual(options.body,{expectedGeneration:world.generation,expectedRevision:0});
  assert.equal(options.headers['X-CSRF-Token'],session.csrfToken);
  if(!firstKey)firstKey=options.headers['Idempotency-Key'];else assert.equal(options.headers['Idempotency-Key'],firstKey);
  return pending.promise;
 },()=>{});
 await c.refresh();const first=c.prepare();await c.prepare();assert.equal(mutations,1);
 pending.resolve(Promise.reject(error(422,'catalogue_not_approved')));await first;assert.equal(c.state().message,'prerequisite');
 await c.prepare();assert.equal(mutations,2);
});

test('unified account without both Admin read grants never reads or mutates the world',async()=>{
 for(const permissions of [[],['admin.access'],['admin.world.read']]){
  const calls=[];
  const c=rawCreateAdminController(async path=>{
   calls.push(path);
   if(path==='/api/admin/session')return session;
   if(path==='/api/player/permissions')return {permissions};
   throw Error('unexpected privileged request');
  },()=>{});
  await c.refresh();await c.prepare();await c.command('advance');
  assert.equal(c.state().message,'forbidden');
  assert.equal(c.state().actor,null);
  assert.equal(c.state().world,null);
  assert.deepEqual(c.state().permissions,[]);
  assert.deepEqual(calls,['/api/admin/session','/api/player/permissions']);
 }
});
test('permission lookup failure clears a previously authorized Admin snapshot',async()=>{
 let denied=false,writes=0;
 const c=rawCreateAdminController(async(path,options)=>{
  if(options?.body){writes++;throw Error('unexpected mutation');}
  if(path==='/api/admin/session')return session;
  if(path==='/api/player/permissions'){
   if(denied)throw error(503,'permissions_unavailable');
   return {permissions:['admin.access','admin.world.read','admin.world.write']};
  }
  if(path==='/api/admin/world')return {world};
  return {world,mode:'uninitialized',events:[]};
 },()=>{});
 await c.refresh();assert.equal(c.state().actor.id,'operator');assert.deepEqual(c.state().world,world);
 denied=true;await c.refresh();
 assert.equal(c.state().actor,null);assert.equal(c.state().world,null);
 assert.equal(c.state().events,null);assert.deepEqual(c.state().permissions,[]);
 assert.equal(c.state().message,'unavailable');
 await c.prepare();assert.equal(writes,0);
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

test('operator status reports backend prerequisite and clears authority on revoked refresh',async()=>{
 const pending=deferred();
 let revoked=false;
 const c=createAdminController(async path=>{
  if(revoked)throw error(401,'unauthorized');
  if(path.endsWith('session'))return session;
  if(path.endsWith('world'))return {world};
  if(path.endsWith('prepare'))return pending.promise;
  return {world,mode:'uninitialized',events:[]};
 },()=>{});
 await c.refresh();
 const operation=c.prepare();assert.equal(c.state().operation,'prepare');
 pending.resolve(Promise.reject(error(422,'catalogue_not_approved')));await operation;
 assert.equal(c.state().operation,'blocked');
 revoked=true;await c.refresh();
 assert.equal(c.state().actor,null);assert.equal(c.state().operation,'idle');
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
  if(path.endsWith('/events'))return {world:preparing,mode:'legacy',events:[],calendarReady:false};
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
 const c=createAdminController(async(path)=>path.endsWith('/session')?session:path.endsWith('/world')?{world:preparing}:path.endsWith('/events')?{world:preparing,mode:'legacy',events:[],calendarReady:false}:{world:{...preparing,generation:'650e8400-e29b-41d4-a716-446655440000',revision:2}},()=>{});
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
 assert.equal(canRunCommand('close',last,{...drawn,mode:'legacy'}),false);
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

test('terminal controls require the sealed archive receipt and ordered next event',()=>{
 const ended={...world,seasonNumber:1,phase:'active',day:56,revision:67};
 const archive={id:'season:archive',kind:'archive-season',status:'scheduled',day:56,order:9000};
 const close={id:'season:close',kind:'close-season',status:'scheduled',day:56,order:9100};
 const next={id:'season:next-prepare',kind:'prepare-next-season',status:'scheduled',day:56,order:9200};
 const projection={mode:'sporting',worldGeneration:ended.generation,worldRevision:ended.revision,rows:[archive,close,next],closure:{days:56,ties:54,archived:false,ready:true}};
 assert.equal(canRunCommand('archive',ended,projection),true);
 assert.equal(canRunCommand('close',ended,projection),false);
 const sealed={...projection,rows:[{...archive,status:'completed'},close,next],closure:{...projection.closure,archived:true,ready:false}};
 assert.equal(canRunCommand('close',ended,sealed),true);
 assert.equal(canRunCommand('advance',ended,sealed),false);
 assert.equal(canRunCommand('close',ended,{...sealed,rows:[archive,close,next]}),false);
 assert.equal(canRunCommand('close',ended,{...sealed,worldRevision:66}),false);
 assert.equal(canRunCommand('close',{...ended,day:55},sealed),false);
});

test('closed Season 1 exposes review-only candidate and never invents activation authority',async()=>{
 const closed={...world,seasonNumber:1,phase:'closed',day:56,revision:82};
 const candidate={world:closed,candidate:{status:'provisional-results-derived',bindings:[{competitionId:'int-1',clubIds:[]}]},review:{status:'requires-owner-approval',readyForActivation:false,blockingReasons:['season-two-snapshot-not-approved']},holderReview:[]};
 const c=createAdminController(async path=>path.endsWith('/session')?session:path.endsWith('/world')?{world:closed}:path.endsWith('/next-candidate')?candidate:{world:closed,events:[],mode:'legacy'},()=>{});
 await c.refresh();
 assert.equal(c.state().seasonTwo.review.readyForActivation,false);
 assert.equal(c.state().seasonTwo.review.blockingReasons[0],'season-two-snapshot-not-approved');
 assert.equal(canRunCommand('nextPrepare',closed,c.state().events,c.state().seasonTwo),false);
});

test('explicit Season 2 approval is bound to reviewed snapshot and expected revision',async()=>{
 const closed={...world,seasonNumber:1,phase:'closed',day:56,revision:23};
 const hash='a'.repeat(64);
 const proposal={world:closed,candidate:{status:'provisional-results-derived',bindings:[]},
  snapshot:{status:'awaiting-season-snapshot-approval',readyForActivation:false,snapshotHash:hash},
  review:{status:'requires-owner-approval',readyForActivation:false,blockingReasons:['season-two-snapshot-not-approved']},holderReview:[],approval:null};
 let called=0;
 const controller=createAdminController(async(path,options)=>{
  if(path.endsWith('/session'))return session;
  if(path.endsWith('/world'))return {world:closed};
  if(path.endsWith('/next-candidate'))return proposal;
  if(path.endsWith('/events'))return {world:closed,mode:'legacy',events:[]};
  if(path.endsWith('/next-approve')){called++;assert.deepEqual(options.body,{expectedGeneration:closed.generation,expectedRevision:23,snapshotHash:hash});return {world:{...closed,revision:24}}}
  throw Error(path);
 },()=>{});
 await controller.refresh();
 await controller.approveSeasonTwo('b'.repeat(64));
 assert.equal(called,0);
 await controller.approveSeasonTwo(hash);
 assert.equal(called,1);
});

test('Admin event read retains generation, revision and due-event authority',async()=>{
 const active={...world,seasonNumber:1,phase:'active',day:3,revision:11};
 const projection={world:active,mode:'administrative',events:[
  {id:'international:draw',kind:'draw-international',status:'scheduled',day:3,order:1},
  {id:'international:calendar',kind:'generate-international-calendar',status:'scheduled',day:3,order:2}
 ],nextEvent:{id:'international:draw',day:3,ready:true},remaining:2,blocked:false};
 const c=createAdminController(async path=>path.endsWith('/session')?session:path.endsWith('/world')?{world:active}:projection,()=>{});
 await c.refresh();
 const events=c.state().events;
 assert.equal(events.worldGeneration,active.generation);
 assert.equal(events.worldRevision,active.revision);
 assert.equal(events.nextEvent.id,'international:draw');
 assert.equal(canRunCommand('draw',active,events),true);
 assert.equal(canRunCommand('publish',active,events),false);
});
test('controller fails closed on stale event reads and never submits an unavailable command',async()=>{
 const active={...world,seasonNumber:1,phase:'active',day:3,revision:11};
 let writes=0;
 const c=createAdminController(async(path)=>{
  if(path.endsWith('/session'))return session;
  if(path.endsWith('/world'))return {world:active};
  if(path.endsWith('/events'))return {world:{...active,revision:10},mode:'sporting',events:[]};
  writes++;return {world:active};
 },()=>{});
 await c.refresh();
 assert.equal(c.state().events,null);
 await c.command('advance');
 assert.equal(writes,0);
});
test('sporting closure readiness survives the authenticated calendar projection',async()=>{
 const closedDay={...world,seasonNumber:1,phase:'active',day:56,revision:60};
 const closure={days:56,ties:54,archived:false,ready:true};
 const events=[{id:'season:archive',kind:'archive-season',status:'scheduled',day:56,order:9000}];
 const c=createAdminController(async path=>path.endsWith('/session')?session:path.endsWith('/world')?{world:closedDay}:{world:closedDay,mode:'sporting',events,closure},()=>{});
 await c.refresh();
 assert.deepEqual(c.state().events.closure,closure);
 assert.equal(canRunCommand('archive',closedDay,c.state().events),true);
 assert.equal(canRunCommand('close',closedDay,c.state().events),false);
});
