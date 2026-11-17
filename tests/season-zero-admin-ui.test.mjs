import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createAdminController,canRunCommand}=require('../assets/admin-settings.js');
const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:0,seasonNumber:0,day:0,phase:'unstarted'};
const session={actor:{id:'operator',email:'operator@example.invalid'},csrfToken:'a'.repeat(64)};
const snap='b'.repeat(64);
const eventsFor=(w,done=[])=>({world:w,mode:'season-zero',snapshotHash:snap,
 events:['domestic','international'].map((scope,order)=>({
  id:scope+':entrants',scope,kind:'confirm-'+scope+'-entrants',day:0,order,
  status:done.includes(scope)?'completed':'scheduled',hasReceipt:done.includes(scope)
 }))});
test('only independent unconfirmed Season 0 scopes can be approved',()=>{
 const initial={mode:'season-zero',worldGeneration:world.generation,worldRevision:0,rows:eventsFor(world).events,snapshotHash:snap};
 assert.equal(canRunCommand('zeroDomestic',world,initial),true);
 assert.equal(canRunCommand('zeroInternational',world,initial),true);
 assert.equal(canRunCommand('confirm',world,initial),false);
 assert.equal(canRunCommand('initialize',world,initial),false);
 const later={...initial,rows:eventsFor(world,['domestic']).events,worldRevision:1};
 assert.equal(canRunCommand('zeroDomestic',{...world,revision:1},later),false);
 assert.equal(canRunCommand('zeroInternational',{...world,revision:1},later),true);
 assert.equal(canRunCommand('zeroInternational',{...world,revision:2},later),false);
 assert.equal(canRunCommand('zeroDomestic',world,{...initial,snapshotHash:null}),false);
});
test('controller passes trusted snapshot hash and CAS metadata, then refreshes only remaining scope',async()=>{
 let w=world,done=[],calls=[];
 const request=async(path,options)=>{
  if(path==='/api/admin/session')return session;
  if(path==='/api/player/permissions')return {permissions:['admin.access','admin.world.read','admin.world.write']};
  if(path==='/api/admin/world')return {world:w};
  if(path==='/api/admin/seasons/events')return eventsFor(w,done);
  if(path==='/api/admin/seasons/season-zero/confirm'){
   calls.push(options.body);
   assert.equal(options.headers['X-CSRF-Token'],session.csrfToken);
   assert.equal(options.body.expectedGeneration,w.generation);
   assert.equal(options.body.expectedRevision,w.revision);
   assert.equal(options.body.snapshotHash,snap);
   done.push(options.body.scope);w={...w,revision:w.revision+1};
   return {world:w,operationId:'op'};
  }
  throw Error('unexpected request '+path);
 };
 const c=createAdminController(request,()=>{});
 await c.refresh();await c.command('zeroDomestic');
 assert.deepEqual(calls.map(x=>x.scope),['domestic']);
 assert.equal(c.state().world.revision,1);
 assert.equal(canRunCommand('zeroDomestic',w,c.state().events),false);
 await c.command('zeroInternational');
 assert.deepEqual(calls.map(x=>x.scope),['domestic','international']);
 assert.equal(c.state().world.revision,2);
 await c.command('zeroInternational');assert.equal(calls.length,2);
});

test('canonical Admin template and published Calendar include both first-season controls',async()=>{
 const {renderAdminSettings}=await import('../tools/render-admin-settings.mjs');
 const {readFileSync}=await import('node:fs');
 for(const html of [renderAdminSettings(),readFileSync(new URL('../admin/calendar/index.html',import.meta.url),'utf8')]){
  assert.match(html,/data-admin-command="zeroDomestic"/);
  assert.match(html,/data-admin-command="zeroInternational"/);
 }
});

test('confirmed Season 0 entrants expose protected reset, but unconfirmed world cannot reset',async()=>{
 let w=world,done=[];
 const request=async(path,options)=>{
  if(path==='/api/admin/session')return session;
  if(path==='/api/player/permissions')return {permissions:['admin.access','admin.world.read','admin.world.write']};
  if(path==='/api/admin/world')return {world:w};
  if(path==='/api/admin/seasons/events')return eventsFor(w,done);
  if(path==='/api/admin/world/reset'){
   assert.equal(options.body.expectedRevision,1);
   assert.equal(options.body.confirmation,'RESET SEASON 0');
   w={...world,generation:'650e8400-e29b-41d4-a716-446655440000'};
   done=[];
   return {world:w,operationId:'op'};
  }
  throw Error(path);
 };
 const c=createAdminController(request,()=>{});
 await c.refresh();
 await c.reset('RESET SEASON 0');assert.equal(c.state().world.generation,world.generation);
 w={...world,revision:1};done=['domestic'];
 await c.refresh();
 await c.reset('RESET SEASON 0');
 assert.notEqual(c.state().world.generation,world.generation);
 assert.equal(c.state().world.revision,0);
});
