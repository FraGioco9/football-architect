import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
import {planPublicFiles} from '../tools/publication-guard.mjs';
import * as provider from '../assets/provider-contract.mjs';

const require=createRequire(import.meta.url);
const clockModel=require('../assets/world-calendar-model.js');
globalThis.faWorldCalendarModel=clockModel;
const clock=require('../assets/world-clock-adapter.js');
const definitions=loadCompetitionCatalogue();
const lookup=id=>definitions.find(item=>item.id===id)||null;
const request={competitionId:'IT-1',selectedSeason:1,scope:'season',requestId:'a06-05',contextRevision:1};
const empty={...request,schemaVersion:1,providerId:'static',status:'empty',data:null,provenance:{kind:'none',sourceRef:null,approved:false,coverage:'none'},reason:'no-results'};

test('A06-05 malformed identities and mismatched response envelopes fail closed',()=>{
  for(const competitionId of ['IT-99','it-1','__proto__'])assert.throws(()=>provider.validateRequest({...request,competitionId},lookup),TypeError);
  for(const patch of [{competitionId:'ENG-1'},{selectedSeason:2},{contextRevision:2},{requestId:'stale'},{providerId:'dev-fictional'},{status:'loading'},{data:{results:[]}}])
    assert.equal(provider.validateResponse({...empty,...patch},request,{providerId:'static'}),null);
});

test('A06-05 stale, disabled and disposed leases never authorize commit',()=>{
  const current={...request,providerId:'static',owner:'competition-page',slot:'fixtures',generation:1,enabled:true,progressGeneration:1,debugSeason:1,matchdays:0};
  const lease=provider.captureLease(current);
  assert.equal(provider.isCurrentLease(lease,current),true);
  // Static leases intentionally ignore DEV-only progress fields; only identity,\n  // generation, ownership, disposal and revision invalidate static publication.\n  for(const patch of [{generation:2},{owner:'new-page'},{slot:'history'},{disposed:true},{contextRevision:2}])
    assert.equal(provider.isCurrentLease(lease,{...current,...patch}),false);
  const dev={...current,providerId:'dev-fictional'};\n  const devLease=provider.captureLease(dev);\n  for(const patch of [{enabled:false},{progressGeneration:2},{debugSeason:0},{matchdays:1}])\n    assert.equal(provider.isCurrentLease(devLease,{...dev,...patch}),false);\n});

test('A06-05 untrusted clock lifecycle cannot become verified results',()=>{
  for(const value of [
    {source:{kind:'dev',reference:'test'},current:{season:1,day:0}},
    {source:{kind:'dev',reference:'test'},current:{season:1,day:57}},
    {source:{kind:'dev',reference:'test'},current:{season:1,day:1},eventStates:[{status:'completed'}]}
  ])assert.throws(()=>clock.normalize(value));
  const projection=clock.project(1,clock.normalize({source:{kind:'dev',reference:'test'},current:{season:1,day:56}}));
  assert.equal(projection.days[55].relative,'current');
  for(const day of projection.days)for(const event of day.events)for(const competition of event.competitions)
    assert.equal(competition.status,null);
});

test('A06-05 protected provider and DEV modules remain excluded from public staging',()=>{
  const published=new Set(planPublicFiles());
  for(const path of ['assets/provider-contract.mjs','tools/dev-standings-preview-client.mjs','tools/dev-world-clock.mjs'])
    assert.equal(published.has(path),false,path);
});
