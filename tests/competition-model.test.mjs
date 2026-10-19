import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
const modelUrl=new URL('../assets/competition-model.js',import.meta.url);
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const manifest=()=>JSON.parse(read('app/competitions/_shared/manifest.json'));
const getModel=()=>{
 assert.ok(existsSync(modelUrl),'Shared competition model must exist');
 return createRequire(import.meta.url)(modelUrl.pathname);
};

test('browser and Node entry points expose the same immutable competition contract',()=>{
 const nodeModel=getModel(),browser={};
 runInNewContext(read('assets/competition-model.js'),{window:browser});
 const browserModel=browser.faCompetitionModel;
 assert.ok(browserModel);
 assert.deepEqual(JSON.parse(JSON.stringify(browserModel)),JSON.parse(JSON.stringify(nodeModel)));
 assert.equal(browserModel.validManifest(manifest()),true);
 assert.equal(browserModel.validRound(30),true);
 assert.equal(browserModel.validRound(31),false);
 assert.equal(browserModel.validRound('1'),false);
 assert.equal(Object.isFrozen(browserModel.profile.format.phases),true);
});

test('all sixteen divisions share one immutable participant, capacity, format, phase and rules contract',()=>{
 const model=getModel(),data=manifest();
 assert.deepEqual(data.profile,model.profile);
 assert.equal(model.validManifest(data),true);
 assert.equal(model.profile.capacity,16);
 assert.equal(model.profile.participants.status,'provisional');
 assert.equal(model.profile.participants.approved,false);
 assert.equal(model.profile.format.type,'double-round-robin');
 assert.equal(model.profile.format.status,'preview');
 assert.deepEqual(model.profile.format.phases,[{id:'league',type:'round-robin'}]);
 assert.deepEqual(model.schedule,{legs:2,roundsPerLeg:15,rounds:30,matchesPerRound:8,matches:240,pairings:120});
 assert.deepEqual(model.profile.rules,{status:'undefined',points:null,tiebreakers:null,promotion:null,relegation:null});
 assert.throws(()=>{model.profile.capacity=20},TypeError);
 assert.throws(()=>{model.profile.format.phases.push({id:'playoff'})},TypeError);
 assert.equal(new Set(data.divisions.flatMap(d=>d.clubs.map(c=>c.countryId+':'+c.clubId))).size,256);
 for(const d of data.divisions){
  assert.equal(d.capacity,model.profile.capacity);
  assert.deepEqual(d.clubs.map(c=>c.clubId),Array.from({length:16},(_,i)=>model.firstClubId(d.tier)+i));
 }
});

test('shared validation rejects altered rules, format, capacity, phases and participant allocation',()=>{
 const model=getModel();
 const mutations=[
  d=>delete d.profile,
  d=>d.profile.rules.promotion=3,
  d=>d.profile.rules.points={win:3,draw:1,loss:0},
  d=>d.profile.format.type='knockout',
  d=>d.profile.format.phases.push({id:'final',type:'knockout'}),
  d=>d.profile.capacity=20,
  d=>d.profile.participants.approved=true,
  d=>d.divisions[0].capacity=20,
  d=>d.divisions[0].clubs.pop(),
  d=>d.divisions[0].clubs[0].clubId=33,
  d=>d.divisions[1].clubs[0]=d.divisions[0].clubs[0],
  d=>d.divisions[0].tier=2,
  d=>d.divisions[1].id=d.divisions[0].id,
  d=>d.approved=true
 ];
 for(const mutate of mutations){const data=manifest();mutate(data);assert.equal(model.validManifest(data),false,String(mutate));}
 for(const data of [null,{},[],{...manifest(),divisions:[null]}])assert.equal(model.validManifest(data),false);
});

test('one view catalogue drives all generated detail documents and their first paint',()=>{
 const model=getModel();
 assert.deepEqual(model.views.map(v=>v.id),['standings','postseason','fixtures','stats','history','rules','awards']);
 for(const d of manifest().divisions){
  const html=read('app/competitions/'+d.id.toLowerCase()+'/index.html');
  assert.ok(html.indexOf('/assets/competition-model.js')<html.indexOf('/assets/competition-page.js'));
  for(const view of model.views)assert.ok(html.includes('id="competition-panel-'+view.id+'"'));
  assert.equal((html.match(/data-fixture-round-choice=/g)||[]).length,model.schedule.rounds);
 }
});
