import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
const modelUrl=new URL('../assets/competition-model.js',import.meta.url);
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const manifest=()=>JSON.parse(read('competitions/_shared/manifest.json'));
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
 assert.equal(data.schemaVersion,2);
 assert.equal(data.competitions.length,18);
 assert.equal(model.competitionById(data,"int-1")?.capacity,24);
 assert.equal(model.competitionById(data,"unknown"),null);
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
 assert.deepEqual(model.views.map(v=>v.id),['standings','postseason','fixtures','stats','history','rules','awards','rewards']);
 for(const d of manifest().divisions){
  const html=read('competitions/'+d.id.toLowerCase()+'/index.html');
  assert.ok(html.indexOf('/assets/competition-model.js')<html.indexOf('/assets/competition-page.js'));
  for(const view of model.views)assert.ok(html.includes('id="competition-panel-'+view.id+'"'));
  assert.equal((html.match(/data-fixture-round-choice="\d+"/g)||[]).length,30);
  assert.ok(html.includes('data-fixture-round-choice="'+(d.tier===1?'playout':'playoffs')+'"'));
 }
});

test('PERF-API-657 canonical competition catalogue reconstructed from 4 complete reusable rule templates',()=>{
 const model=getModel(),full=manifest(),compactFile=read('competitions/_shared/compact.json');
 const compact=JSON.parse(compactFile);
 assert.equal(compact.catalogFormat,'competition-catalog-dedup-v1');
 assert.equal(compact.templates.length,4);
 assert.equal(compact.competitions.length,18);
 assert.deepEqual(compact,model.packCompactManifest(full),'generated asset matches canonical generator');
 assert.deepEqual(model.expandCompactManifest(compact),full,'all participants, domestic and INT24 phases remain identical');
 assert.equal(model.validManifest(model.expandCompactManifest(compact)),true);
 assert.ok(compactFile.length<read('competitions/_shared/manifest.json').length*.4,'at least 60% fewer raw bytes');
});
test('PERF-API-657 tampered compact rules, templates, IDs and approvals fail closed',()=>{
 const model=getModel(),source=JSON.parse(read('competitions/_shared/compact.json'));
 const mutations=[
  d=>d.catalogFormat='unknown', d=>d.templates[0].rules.phases[0].points.win=-1,
  d=>d.competitions[0].templateIndex=999, d=>d.competitions[0].templateIndex=-1,
  d=>d.competitions[0].templateIndex='0', d=>d.competitions[0].rules={schemaVersion:1},
  d=>d.templates[0].metrics.phases.league.matches=1,d=>d.competitions.pop(),
  d=>d.approved=true,d=>delete d.clubCrests,d=>d.templates[0].unexpected=true,
  d=>d.competitions[0].constructor={unsafe:true}
 ];
 for(const change of mutations){
  const data=JSON.parse(JSON.stringify(source));change(data);
  assert.throws(()=>model.expandCompactManifest(data),/compact|reconstructed/i,String(change));
 }
 for(const data of [null,[],{},'json'])assert.throws(()=>model.expandCompactManifest(data));
 const browser={};runInNewContext(read('assets/competition-model.js'),{window:browser});
 assert.deepEqual(JSON.parse(JSON.stringify(browser.faCompetitionModel.expandCompactManifest(source))),manifest());
 const controller=read('assets/competition-page.js');
 assert.match(controller,/new URL\("compact\.json",root\)/);
 assert.doesNotMatch(controller,/new URL\("manifest\.json",root\)/);
 assert.match(controller,/model\.expandCompactManifest\(await dataResponse\.json\(\)\)/);
});

test('PERF-API-657: deduplicated transport never aliases mutable rules across distinct competitions',()=>{
 const model=getModel(),raw=JSON.parse(read('competitions/_shared/compact.json'));
 const full=model.expandCompactManifest(raw);
 const italy=full.competitions.find(x=>x.id==='IT-1');
 const england=full.competitions.find(x=>x.id==='ENG-1');
 const second=full.competitions.find(x=>x.id==='IT-2');
 const otherSecond=full.competitions.find(x=>x.id==='ENG-2');
 assert.notStrictEqual(italy.rules,england.rules);
 assert.notStrictEqual(italy.metrics,england.metrics);
 assert.notStrictEqual(italy.capabilities,england.capabilities);
 assert.notStrictEqual(second.rules,otherSecond.rules);
 assert.notStrictEqual(italy.rules,raw.templates[italy.templateIndex||0]?.rules);
 italy.rules.phases[0].points.win=2;
 italy.metrics.phases.league.matches=1;
 assert.equal(england.rules.phases[0].points.win,3,'other domestic competition unaffected');
 assert.equal(england.metrics.phases.league.matches,240,'other domestic metrics unaffected');
 assert.equal(raw.templates[0].rules.phases[0].points.win,3,'raw compact template remains unchanged');
});
