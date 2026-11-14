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
 assert.ok(html.includes('/account/login'));
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
test('Admin exposes accessible operation feedback without technical diagnostics',()=>{
 const html=renderAdminSettings();
 assert.match(html,/data-admin-status/);
 assert.doesNotMatch(html,/data-admin-operation(?:\s|=|>)|data-admin-error-code/);
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
 assert.equal(canRunCommand('advance',active,{...drawn,mode:'legacy'}),false);
 assert.equal(canRunCommand('eventAdvance',active,drawn),false);
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

test('successful preparation hydrates event authority so initialization is enabled without manual refresh',async()=>{
 let current=world;
 const c=createAdminController(async(path,options)=>{
  if(path.endsWith('/session'))return session;
  if(path==='/api/admin/world')return {world:current};
  if(path.endsWith('/events'))return {world:current,mode:current.seasonNumber===0?'uninitialized':'legacy',events:[],calendarReady:false};
  assert.equal(path,'/api/admin/seasons/prepare');
  assert.deepEqual(options.body,{expectedGeneration:world.generation,expectedRevision:0});
  current={...world,revision:1,seasonNumber:1,phase:'preparing'};
  return {world:current};
 },()=>{});
 await c.refresh();await c.prepare();
 assert.deepEqual(c.state().world,current);
 assert.equal(canRunCommand('initialize',c.state().world,c.state().events),true);
 assert.equal(c.state().message,'prepared');
});

test('revocation while prepared events load cannot restore authority or prepared success',async()=>{
 const pending=deferred(),started=deferred();let current=world,revoked=false;
 const c=createAdminController(async(path)=>{
  if(revoked)throw error(401,'unauthorized');
  if(path.endsWith('/session'))return session;
  if(path==='/api/admin/world')return {world:current};
  if(path.endsWith('/events')){
   if(current.seasonNumber===1){started.resolve();return pending.promise;}
   return {world:current,mode:'uninitialized',events:[]};
  }
  assert.equal(path,'/api/admin/seasons/prepare');
  current={...world,revision:1,seasonNumber:1,phase:'preparing'};return {world:current};
 },()=>{});
 await c.refresh();const preparing=c.prepare();await started.promise;
 revoked=true;await c.refresh();
 pending.resolve({world:current,mode:'legacy',events:[],calendarReady:false});await preparing;
 assert.equal(c.state().actor,null);assert.equal(c.state().world,null);assert.equal(c.state().events,null);
 assert.deepEqual(c.state().permissions,[]);assert.equal(c.state().message,'signedOut');
});

test('permission-denied mutations clear access and cannot be retried with cached grants',async()=>{
 let writes=0;
 const c=createAdminController(async(path,options)=>{
  if(path.endsWith('/session'))return session;
  if(path.endsWith('/world'))return {world};
  if(path.endsWith('/events'))return {world,mode:'uninitialized',events:[]};
  writes++;throw error(403,'permission_denied');
 },()=>{});
 await c.refresh();assert.equal(c.state().actor.id,'operator');
 await c.prepare();
 assert.equal(c.state().actor,null);assert.equal(c.state().world,null);
 assert.deepEqual(c.state().permissions,[]);assert.equal(c.state().message,'forbidden');
 await c.prepare();assert.equal(writes,1);
});

test('permission loss on event reads clears the authenticated world instead of retaining controls',async()=>{
 const c=createAdminController(async path=>{
  if(path.endsWith('/session'))return session;
  if(path.endsWith('/world'))return {world};
  throw error(403,'permission_denied');
 },()=>{});
 await c.refresh();
 assert.equal(c.state().actor,null);assert.equal(c.state().world,null);
 assert.deepEqual(c.state().permissions,[]);assert.equal(c.state().message,'forbidden');
});

const calendarModel=require('../assets/world-calendar-model.js');
test('next-day simulation preview uses the destination day and shared sporting calendar',()=>{
 const {nextDaySimulation}=require('../assets/admin-settings.js');
 assert.equal(typeof nextDaySimulation,'function');
 const active={...world,seasonNumber:1,phase:'active',revision:12,day:15};
 const events={mode:'sporting',worldGeneration:active.generation,worldRevision:12,calendarReady:true,rows:[]};
 assert.deepEqual(nextDaySimulation(active,events,calendarModel),{day:16,rounds:['I-1','D-4']});
 for(const [day,rounds] of [[16,['D-5']],[31,[]],[52,['I-13','D-32']],[53,['I-13','D-33']],[55,[]]])assert.deepEqual(nextDaySimulation({...active,day},events,calendarModel),{day:day+1,rounds});
 assert.equal(nextDaySimulation({...active,day:56},events,calendarModel),null);
 assert.equal(nextDaySimulation(active,{...events,worldRevision:11},calendarModel),null);
 assert.equal(nextDaySimulation(active,{...events,calendarReady:false},calendarModel),null);
 assert.equal(nextDaySimulation(active,events,null),null);
 assert.equal(nextDaySimulation({...active,phase:'closed'},events,calendarModel),null);
 const administrative={...events,mode:'administrative',calendarReady:false};
 assert.deepEqual(nextDaySimulation({...active,day:4},administrative,calendarModel),{day:5,rounds:[]});
 assert.equal(nextDaySimulation({...active,day:12},administrative,calendarModel),null);
});

test('Advance day is unavailable until all actions due today or earlier are completed',()=>{
 const active={...world,seasonNumber:1,phase:'active',day:3};
 for(const mode of ['administrative','sporting','legacy']){
  const action=mode==='administrative'?'eventAdvance':'advance';
  const events={worldGeneration:active.generation,worldRevision:0,mode,calendarReady:true,rows:[
   {id:'draw',kind:'draw-international',status:'scheduled',day:3,order:1},
   {id:'publish',kind:'generate-international-calendar',status:'scheduled',day:3,order:2}
  ]};
  assert.equal(canRunCommand(action,active,events),false);
  events.rows[0].status='completed';assert.equal(canRunCommand(action,active,events),false);
  events.rows[1].status='completed';assert.equal(canRunCommand(action,active,events),true);
  events.rows.push({id:'later',kind:'later',status:'scheduled',day:4,order:1});
  assert.equal(canRunCommand(action,active,events),true);
  events.rows.push({id:'overdue',kind:'overdue',status:'scheduled',day:2,order:1});
  assert.equal(canRunCommand(action,active,events),false);
 }
});

test('Players local trial command uses bounded inputs and never calls world mutations',()=>{
 const {playersTrialCommand}=require('../assets/admin-settings.js');
 const command=playersTrialCommand({count:'100',seed:'fa-official-trial-01',suitability:'auto'});
 assert.equal(command,'node tools/players-generation-trial.mjs --count 100 --seed fa-official-trial-01 --primary-suitability auto --out .\\players-trial.json');
 assert.match(playersTrialCommand({count:'1000',seed:'seed_2',suitability:'65:80'}),/--count 1000.*--primary-suitability 65:80/);
 for(const invalid of [{count:'0',seed:'ok',suitability:'auto'},{count:'1001',seed:'ok',suitability:'auto'},{count:'1.5',seed:'ok',suitability:'auto'},{count:'10',seed:'bad;Remove-Item',suitability:'auto'},{count:'10',seed:'ok',suitability:'999'}])assert.equal(playersTrialCommand(invalid),null);
});

test('Admin Players encodes all stable generator controls without PowerShell interpolation',()=>{
 const playerForm=require('../assets/admin-players.js');
 // An untouched form emits no overrides. The CLI's generator uses its own defaults.
 assert.deepEqual(playerForm.makeOptions({}),{});
 assert.deepEqual(playerForm.makeOptions({count:'',seed:'',primarySuitability:'',secondaryMode:'automatic'}),{});
 assert.deepEqual(playerForm.makeOptions({count:'auto',seed:'AUTO',age:'Auto'}),{});
 assert.match(playerForm.commandFromRaw({}),/--options-base64 e30 --out/);
 const raw={
  count:'2',seed:'seed with spaces; $env:SECRET',primarySuitabilityMin:'65',primarySuitabilityMax:'80',
  primaryNationality:'ITA',secondaryMode:'exact',secondaryCountry:'FRA',
  firstName:'Émile',lastName:'De Luca',primaryPosition:'ST',preferredFoot:'right',
  secondaryPositions:'AM',age:'18',height:'175:185',developmentAptitude:'50',
  'attribute.shooting':'64:83','attribute.vision':'70'
 };
 const opts=playerForm.makeOptions(raw);
 assert.equal(opts.seed,raw.seed);
 assert.deepEqual(opts.primarySuitability,[65,80]);
 assert.deepEqual(opts.attributes,{shooting:[64,83],vision:70});
 assert.deepEqual(opts.secondaryPositions,['AM']);
 assert.deepEqual(opts.height,[175,185]);
 const command=playerForm.commandFromRaw(raw);
 assert.match(command,/^node tools\/players-generation-trial\.mjs --options-base64 [A-Za-z0-9_-]+ --out \.\\players-trial\.json$/);
 assert.doesNotMatch(command,/\$env:SECRET/);
 const encoded=command.match(/--options-base64 ([A-Za-z0-9_-]+)/)[1];
 assert.deepEqual(JSON.parse(Buffer.from(encoded,'base64url').toString('utf8')),opts);
 const {execFileSync}=require('node:child_process');
 const {fileURLToPath}=require('node:url');
 const runtime=JSON.parse(execFileSync(process.execPath,[fileURLToPath(new URL('../tools/players-generation-trial.mjs',import.meta.url)),'--options-base64',
  playerForm.commandFromRaw({count:'1',seed:'admin-test',primaryNationality:'ITA',primaryPosition:'ST',secondaryMode:'none',firstName:'Luca',age:'18'}).match(/--options-base64 ([A-Za-z0-9_-]+)/)[1]],{encoding:'utf8'}));
 assert.equal(runtime.summary.count,1);
 assert.equal(runtime.sample[0].first_name,'Luca');
 assert.equal(runtime.sample[0].nationality,'ITA');
 assert.equal(runtime.sample[0].secondary_nationality,null);
 assert.equal(runtime.sample[0].initial_age,18);
 const invalid=[
  {count:'0',seed:'ok'},{count:'1001',seed:'ok'},{count:'3',seed:'bad\nseed'},
  {count:'3',seed:'ok',age:'20'},
  {count:'3',seed:'ok',primaryNationality:'NOT'},
  {count:'3',seed:'ok',primaryNationality:'ITA',secondaryMode:'exact',secondaryCountry:'ITA'},
  {count:'3',seed:'ok',secondaryMode:'allowed',secondaryAllowed:'ITA,ITA'},
  {count:'3',seed:'ok',primaryPosition:'GK',secondaryPositions:'RB'},
  {count:'3',seed:'ok','attribute.shooting':'100'},
  {count:'3',seed:'ok','attribute.speed':'90:20'},
  {count:'3',seed:'ok',secondaryPositions:'RB,RB'}
 ];
 for(const obj of invalid)assert.throws(()=>playerForm.makeOptions(obj),undefined,JSON.stringify(obj));
 const bad=Buffer.from(JSON.stringify({count:1,seed:'x',experimentalLegacySecondaryModel:true})).toString('base64url');
 assert.throws(()=>execFileSync(process.execPath,[fileURLToPath(new URL('../tools/players-generation-trial.mjs',import.meta.url)),'--options-base64',bad],{stdio:'pipe'}));
});


test('successful Admin write reuses its verified world instead of repeating authenticated world GET',async()=>{
 const next={...world,revision:1,seasonNumber:1,phase:'preparing'};
 let current=world;const paths=[];
 const c=createAdminController(async(path,options)=>{
  paths.push(path);
  if(path==='/api/admin/session')return session;
  if(path==='/api/admin/world')return {world:current};
  if(path==='/api/admin/seasons/events')return {world:current,mode:current.seasonNumber===0?'uninitialized':'legacy',events:[]};
  if(path==='/api/admin/seasons/prepare'){assert.deepEqual(options.body,{expectedGeneration:world.generation,expectedRevision:0});current=next;return {world:next};}
  throw Error(path);
 },()=>{});
 await c.refresh();assert.equal(paths.filter(p=>p==='/api/admin/world').length,1);
 paths.length=0;
 await c.prepare();
 assert.deepEqual(paths,['/api/admin/seasons/prepare','/api/admin/seasons/events']);
 assert.equal(c.state().world.revision,1);
 assert.equal(c.state().events.worldRevision,1);
 assert.equal(canRunCommand('initialize',c.state().world,c.state().events),true);
});
test('raced post-write events revision triggers the original authenticated world check',async()=>{
 const afterWrite={...world,revision:1,seasonNumber:1,phase:'preparing'};
 const concurrent={...afterWrite,revision:2};let current=world,staleEventOnce=false;
 const paths=[];
 const c=createAdminController(async path=>{
  paths.push(path);
  if(path==='/api/admin/session')return session;
  if(path==='/api/admin/world')return {world:current};
  if(path==='/api/admin/seasons/events'){
   if(staleEventOnce){staleEventOnce=false;return {world:concurrent,mode:'legacy',events:[]};}
   return {world:current,mode:'legacy',events:[]};
  }
  if(path==='/api/admin/seasons/prepare'){current=concurrent;staleEventOnce=true;return {world:afterWrite};}
  throw Error(path);
 },()=>{});
 await c.refresh();paths.length=0;
 await c.prepare();
 assert.deepEqual(paths,['/api/admin/seasons/prepare','/api/admin/seasons/events','/api/admin/world','/api/admin/seasons/events']);
 assert.equal(c.state().world.revision,2);
 assert.equal(c.state().events.worldRevision,2);
});
test('revoked post-write events authority clears Admin permissions and data',async()=>{
 const next={...world,revision:1,seasonNumber:1,phase:'preparing'};
 let current=world,revoked=false;const paths=[];
 const c=createAdminController(async path=>{
  paths.push(path);
  if(path==='/api/admin/session')return session;
  if(path==='/api/admin/world')return {world:current};
  if(path==='/api/admin/seasons/events'){if(revoked)throw error(401,'unauthorized');return {world:current,mode:'uninitialized',events:[]};}
  if(path==='/api/admin/seasons/prepare'){revoked=true;current=next;return {world:next};}
  throw Error(path);
 },()=>{});
 await c.refresh();paths.length=0;await c.prepare();
 assert.equal(c.state().actor,null);
 assert.equal(c.state().world,null);
 assert.deepEqual(c.state().permissions,[]);
 assert.equal(c.state().message,'signedOut');
 assert.deepEqual(paths,['/api/admin/seasons/prepare','/api/admin/seasons/events']);
});
