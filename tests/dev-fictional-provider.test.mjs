import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
import {createDevFictionalProvider} from '../tools/dev-fictional-provider.mjs';
import {planPublicFiles} from '../tools/publication-guard.mjs';

const require=createRequire(import.meta.url);
const model=require('../assets/competition-model.js');
const definition=loadCompetitionCatalogue().find(x=>x.id==='IT-1');
const lookup=id=>id==='IT-1'?definition:null;
const request=(changes={})=>({competitionId:'IT-1',selectedSeason:1,scope:'season',requestId:'dev-a',contextRevision:1,...changes});
const record=()=>({season:1,status:'partial',rulesVersion:definition.rules.version,rulesSnapshot:structuredClone(definition.rules),results:[],statistics:null});
function setup(overrides={}){
 const progress={enabled:true,debugSeason:2,matchdays:15};
 let calls=0;
 const cfg={getCompetition:lookup,readProgress:()=>progress,
  loadSeason:async()=>{calls++;return record()},
  resolveSeasonRules:model.resolveSeasonRules,
  validateSeasonData:d=>Array.isArray(d.results)&&d.statistics===null,
  ...overrides};
 return {provider:createDevFictionalProvider(cfg),progress,calls:()=>calls};
}
test('A04-08: DEV season preserves fictional provenance and actual historical rules',async()=>{
 const {provider}=setup(),out=await provider.read(request());
 assert.equal(out.status,'partial');assert.equal(out.data.results.length,0);
 assert.deepEqual(out.provenance,{kind:'fictional',sourceRef:'dev-fictional-preview',approved:false,coverage:'partial'});
 assert.equal(out.data.rulesSnapshot.phases[0].points.win,3);
 assert.ok(Object.isFrozen(out.data));
});
test('A04-08: disabled, Season 0, future season, and history never invoke simulator',async()=>{
 for(const overrides of [{enabled:false},{debugSeason:0}]){
  const {provider,progress,calls}=setup();Object.assign(progress,overrides);
  const out=await provider.read(request());assert.equal(out.status,'empty');assert.equal(out.reason,'disabled');assert.equal(calls(),0);
 }
 const {provider,calls}=setup();
 assert.equal((await provider.read(request({selectedSeason:3}))).reason,'no-results');
 assert.equal((await provider.read(request({scope:'history'}))).reason,'unsupported');
 assert.equal(calls(),0);
 await assert.rejects(provider.read(request({competitionId:'int-1'})),TypeError);
});
test('A04-08: corrupt historical rules cannot be relabeled as plausible DEV data',async()=>{
 const {provider}=setup({loadSeason:async()=>{const data=record();data.rulesSnapshot.phases[0].points.win=-1;return data}});
 const out=await provider.read(request());
 assert.equal(out.status,'unavailable');assert.equal(out.reason,'invalid-data');assert.equal(out.data,null);
});
test('A04-08: unexpected producer failures propagate without masquerading as absence',async()=>{
 const failure=new Error('bad simulator');
 const {provider}=setup({loadSeason:async()=>{throw failure}});
 await assert.rejects(provider.read(request()),error=>error===failure);
});
test('A04-08: DEV module not published or imported by public browser runtime',()=>{
 assert.equal(planPublicFiles().includes('tools/dev-fictional-provider.mjs'),false);
 const s=readFileSync(new URL('../tools/dev-fictional-provider.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(s,/\b(?:fetch|document|sessionStorage|localStorage)\s*[.(]/);
});
