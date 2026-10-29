// ARCH-CLEAN-02 A04-01: pinned baseline evidence. No runtime provider changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,posix,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {runInNewContext} from 'node:vm';
import {planPublicFiles,stagePublicArtifact,repositoryRoot,publicRequestFile} from '../tools/publication-guard.mjs';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
import {aggregatePreviewStats} from '../tools/dev-competition-stats-data.mjs';
import model from '../assets/competition-model.js';
import rules from '../assets/competition-rules.js';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
import {createPreviewStandings,createPreviewHistory,createPreviewPostseason,previewSeasonProgress,previewSeasonMatchdays,previewCurrentMatchday} from '../tools/dev-standings-preview-data.mjs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const manifest=JSON.parse(read('../competitions/_shared/manifest.json'));
const catalogue=loadCompetitionCatalogue();
const copy=value=>JSON.parse(JSON.stringify(value));
test('A04-E1: 18 public identities and canonical source cardinality',()=>{
 assert.equal(catalogue.length,18);
 assert.equal(manifest.divisions.length,16);
 assert.equal(new Set(catalogue.map(x=>x.id)).size,18);
 for(const entry of catalogue){
  assert.equal(entry.rules.schemaVersion,1,entry.id);
  assert.ok(entry.rules.phases.length>0,entry.id);
  assert.ok(rules.validateCompetition(entry).valid,entry.id);
 }
 assert.deepEqual(catalogue.filter(x=>x.category==='international').map(x=>x.id).sort(),['int-1','int-2']);
});
test('A04-E2: deterministic fictional DEV fixtures with no future-score leakage',()=>{
 for(const id of ['IT-1','IT-2','ENG-1']){
  const division=manifest.divisions.find(x=>x.id===id);
  assert.ok(division,id);
  for(const md of [0,15,30]){
   const a=createPreviewStandings(division,md,1),b=createPreviewStandings(division,md,1);
   assert.deepEqual(a,b,id+' MD'+md);
   assert.equal(a.rows.length,16,id);
   assert.equal(new Set(a.rows.map(x=>x.club.clubId)).size,16,id);
   assert.equal(a.fixtures.length,md*8,id+' played fixtures');
   assert.ok(a.fixtures.every(x=>x.round>=1&&x.round<=md&&Number.isSafeInteger(x.homeGoals)&&Number.isSafeInteger(x.awayGoals)),id);
   for(let round=1;round<=md;round++)assert.equal(a.fixtures.filter(x=>x.round===round).length,8,id+' round '+round);
  }
 }
});
test('A04-E3: approved historical snapshot wins and corrupt / year-zero input fails closed',()=>{
 const source=catalogue.find(x=>x.id==='IT-1');
 const record={season:1,competitionId:source.id,rulesVersion:source.rules.version,rulesSnapshot:copy(source.rules)};
 assert.deepEqual(model.resolveSeasonRules(source,record),source.rules);
 assert.equal(model.resolveSeasonRules(source,{...record,season:0}),null);
 assert.equal(model.resolveSeasonRules(source,{...record,competitionId:'ENG-1'}),null);
 assert.equal(model.resolveSeasonRules(source,{...record,rulesVersion:'invalid'}),null);
 const corrupt=copy(record);corrupt.rulesSnapshot.phases[0].points.win=-2;
 assert.equal(model.resolveSeasonRules(source,corrupt),null);
});
test('A04-E4: actual context revision lease rejects late historical responses',()=>{
 const source=read('../assets/competition-page.js');
 const start=source.indexOf('  const freeze=value=>'),end=source.indexOf('  async function start()',start);
 assert.ok(start>=0&&end>start);
 const input=catalogue.find(x=>x.id==='IT-1'),projection=manifest.divisions.find(x=>x.id==='IT-1');
 const window={dispatchEvent(){}};
 const api=runInNewContext(source.slice(start,end)+';definition=input;division=projection;activeDebugSeason=1;({replaceSeasonData,clearSeasonData,createContext})',{
  model,window,input,projection,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail}}
 });
 window.faCompetitionContext=api.createContext(input,1,null,1);
 const data={season:1,rulesVersion:input.rules.version,rulesSnapshot:copy(input.rules),participants:projection.clubs,fixtures:[],results:[],statistics:null,status:'partial'};
 assert.equal(api.replaceSeasonData(data,1),true);
 const staleRevision=window.faCompetitionContext.revision;
 api.clearSeasonData();
 assert.equal(api.replaceSeasonData(data,staleRevision),false);
 assert.equal(window.faCompetitionContext.seasonData,null);
 assert.equal(api.replaceSeasonData({...data,season:0},window.faCompetitionContext.revision),false);
 assert.equal(window.faCompetitionContext.seasonData,null);
});
test('A04-E5: no-data stats differ from actual completed-match aggregates',()=>{
 const division=manifest.divisions.find(x=>x.id==='IT-1');
 const zero=aggregatePreviewStats(division,0);
 const played=aggregatePreviewStats(division,15);
 assert.equal(zero.overview.matchesPlayed,0);
 assert.equal(played.overview.matchesPlayed,120);
 assert.equal(played.teams.length,16);
 assert.equal(zero.teams.length,16);
 assert.equal(zero.overview.totalGoals,0);
 assert.deepEqual(zero.players,[]);
 assert.equal(played.playerStatsAvailable,false,'fictional match aggregates never invent player events');
});
test('A04-E6: actual public artifact manifest excludes all protected DEV files',()=>{
 const files=planPublicFiles();
 assert.ok(files.includes('assets/competition-model.js'));
 assert.ok(files.includes('assets/competition-history.js'));
 assert.equal(files.filter(path=>path.startsWith('tools/dev-')).length,0);
 assert.equal(files.filter(path=>path.startsWith('tests/')).length,0);
 assert.ok(files.includes('data/divisions.json'));
 assert.ok(!files.includes('data/international-competitions.json'),'protected international source must not be published');
 const root=mkdtempSync(join(tmpdir(),'fa-a04-artifact-'));
 try{
  const staged=join(root,'public');
  assert.deepEqual(stagePublicArtifact(repositoryRoot,staged),files);
  for(const file of files){
   const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
   assert.equal(hash(join(staged,file)),hash(join(repositoryRoot,file)),file);
  }
  const allowed=new Set(files);
  // Walk local executable dependencies from every HTML/JS root. Both static
  // and dynamic imports must resolve inside the staged public artifact.
  function dependencies(path,source){
   const references=path.endsWith('.html')?[...source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(m=>m[1]):
    path.endsWith('.js')?[...source.matchAll(/\b(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)].map(m=>m[1]||m[2]):[];
   return references.filter(x=>!/^https?:/.test(x)).map(ref=>posix.normalize(ref.startsWith('/')?ref.slice(1):posix.join(posix.dirname(path),ref.split(/[?#]/)[0])));
  }
  const visit=(path,seen=new Set())=>{
   assert.ok(allowed.has(path),'dependency outside public manifest: '+path);
   if(seen.has(path))return;seen.add(path);
   for(const dependency of dependencies(path,readFileSync(join(staged,path),'utf8')))visit(dependency,seen);
  };
  for(const file of files.filter(x=>/\.(html|js)$/.test(x)))visit(file);
  for(const source of ['import x from "/__fa_dev__/stats.mjs";','import("../tools/dev-standings-preview-client.mjs")']){
   const dependency=dependencies('assets/injected.js',source)[0];
   assert.ok(dependency);assert.throws(()=>visit(dependency),/outside public manifest/,'negative control must reject protected transitive dependencies');
  }
 }finally{rmSync(root,{recursive:true,force:true})}
});

// A positive render control prevents missing dependencies in the VM harness from
// masquerading as stale-response rejection. Execute the actual DEV History code.
test('A04-E4-History: pending manifest renders only the latest route and never after Debug OFF',async()=>{
 const client=read('../tools/dev-standings-preview-client.mjs');
 const start=client.indexOf('let historyRenderVersion=0;'),end=client.indexOf('\nlet transition=',start);
 assert.ok(start>=0&&end>start);
 for(const mode of ['latest','off','route','progress']){
  let release,appends=0,created=0;
  function element(tag='div'){
   const node={tag,children:[],dataset:{},attrs:{},className:'',textContent:'',hidden:false,
    append(...items){for(const item of items){item.parent=this;this.children.push(item)}},
    setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]},addEventListener(){},
    cloneNode(){return element(tag)},remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this)}};
   return node;
  }
  const status=element(),error=element(),controls=element(),players=element(),roots=[];
  const panel={dataset:{},querySelector(selector){return {'[data-history-empty]':status,'[data-history-error]':error,'[data-history-record-controls]':controls,'[data-history-player-records]':players,'.app-history-dev':roots.at(-1)}[selector]},append(root){roots.push(root);appends++}};
  const route={view:'history',season:'1'},errors=[];
  const context={enabled:true,debugSeason:1,matchdays:15,validPath:['','it-1'],competitionModel:model,createPreviewHistory,
   isPreviewEnabled:()=>context.enabled,
   window:{faCompetitionRoute:{get:()=>({...route})},faAppRenderLanguage(){}},
   document:{documentElement:{dataset:{}},getElementById:()=>panel,createElement(tag){created++;return element(tag)},createTextNode(text){return {...element('#text'),textContent:text}}},
   fetch:()=>new Promise(resolve=>release=resolve),console:{error(...args){errors.push(args.map(String).join(' '))}}};
  const api=runInNewContext(client.slice(start,end)+';({renderHistoryPreview,clearHistoryPreview})',context);
  const a=api.renderHistoryPreview();assert.equal(status.hidden,true,'loading suppresses the empty message');
  let b;
  if(mode==='latest'){route.season='2';context.debugSeason=2;b=api.renderHistoryPreview()}
  if(mode==='off'){context.enabled=false;api.clearHistoryPreview();assert.equal(status.hidden,false)}
  if(mode==='route')route.view='stats';
  if(mode==='progress')context.matchdays=30;
  release({ok:true,json:async()=>manifest});await Promise.all([a,b]);
  assert.deepEqual(errors,[],mode+' must not pass because of a missing VM dependency');
  if(mode==='latest'){
   assert.equal(appends,1,'A and B share a delayed response; only B commits');assert.ok(created>0);
   const archive=roots[0].children.find(n=>n.id==='app-history-archive');
   const descendants=n=>[n,...n.children.flatMap(descendants)];
   const list=descendants(archive).find(n=>n.className==='app-history-dev-archive');
   assert.ok(list);assert.equal(list.children.length,1,'Season 2 MD15 archives exactly the completed Season 1');
  }else{assert.equal(appends,0,mode);assert.equal(created,0,mode+' must abort before constructing stale DOM')}
 }
});

// Delay the real boot() at its async readiness boundary. The DOM adapters are
// observed commit boundaries; model, generation, season/rules and guards are real.
test('A04-E4-boot: superseded DEV preparation cannot commit fixtures, postseason or context',async()=>{
 const client=read('../tools/dev-standings-preview-client.mjs');
 const start=client.indexOf('async function boot('),end=client.indexOf('/* CAL-SIMPLE-01:',start);
 const page=read('../assets/competition-page.js'),cs=page.indexOf('  const freeze=value=>'),ce=page.indexOf('  async function start()',cs);
 assert.ok(start>=0&&end>start&&cs>=0&&ce>cs);
 for(const mode of ['season','off','superseded']){
  const input=catalogue.find(d=>d.id==='IT-1'),projection=manifest.divisions.find(d=>d.id==='IT-1');
  const gates=[],commits=[],errors=[],visible={fixtures:null,postseason:null,rows:null},window={dispatchEvent(){}};
  const api=runInNewContext(page.slice(cs,ce)+';definition=input;division=projection;activeDebugSeason=2;({replaceSeasonData,selectSeason,setDebugSeason,createContext})',{
   model,window,input,projection,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail}}
  });
  window.faCompetitionContext=api.createContext(input,1,null,1);window.faCompetitionContextApi=api;
  window.faCompetitionRules=rules;
  window.faPostseason={snapshot:()=>null,prepare(rows,results){return ()=>{commits.push('postseason');visible.postseason=copy(results)}}};
  const fixtures={snapshot:()=>null,prepare(data){return ()=>{commits.push('fixtures');visible.fixtures=copy(data)}}};
  let viewed=1,current=true;
  const context={window,competitionModel:model,createPreviewStandings,createPreviewPostseason,previewSeasonProgress,previewSeasonMatchdays,previewCurrentMatchday,
   selectedSeason:()=>viewed,debugSeason:2,matchdays:15,
   fetch:async()=>({ok:true,json:async()=>manifest}),
   waitForRows:async()=>({}),waitForFixturesApi:()=>new Promise(resolve=>gates.push(()=>resolve(fixtures))),
   document:{scrollingElement:null,activeElement:null,querySelector:()=>null},console:{error(...args){errors.push(args.map(String).join(' '))}}};
  const boot=runInNewContext(client.slice(start,end)+';boot',context);
  const previous={refresh(rows,commitFixtures,commitPostseason){
   commits.push('rows');visible.rows=copy(rows);commitFixtures();commitPostseason();return true;
  }};
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  const a=boot('IT-1',previous,()=>current);await flush();assert.equal(gates.length,1,'A is held after real manifest/rules preparation');
  let b;
  if(mode==='season'){
   viewed=2;api.selectSeason(2);b=boot('IT-1',previous);await flush();assert.equal(gates.length,2);
   gates[1]();assert.equal(await b,previous);
   assert.deepEqual(commits,['rows','fixtures','postseason'],'positive B must actually commit every adapter');
   assert.equal(window.faCompetitionContext.seasonData.season,2);
   assert.equal(window.faCompetitionContext.seasonData.results.length,120);
   assert.equal(visible.fixtures.length,240);
   assert.ok(visible.fixtures.every(game=>game.round<=15?Number.isSafeInteger(game.homeGoals):game.homeGoals===null&&game.awayGoals===null));
  }else if(mode==='off'){context.debugSeason=0;api.setDebugSeason(0)}
  else current=false;
  const before=JSON.stringify({visible,context:window.faCompetitionContext,commits});
  gates[0]();assert.equal(await a,undefined,'obsolete A returns without a cleanup/commit handle');
  assert.equal(JSON.stringify({visible,context:window.faCompetitionContext,commits}),before,mode+' must not mutate a consumer before context publication');
  assert.deepEqual(errors,[],mode+' must reject stale work without an unrelated exception');
 }
});

function chromeBinary(){
 const windows=process.platform==='win32'?[process.env.ProgramFiles,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean).map(p=>join(p,'Google','Chrome','Application','chrome.exe')):[];
 for(const bin of [process.env.CHROME_BIN,...windows,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean))
  if(spawnSync(bin,['--version'],{stdio:'ignore',timeout:4000}).status===0)return bin;
 throw Error('Chrome required for A04 baseline; set CHROME_BIN');
}
// Exercise the shipped consumers through their public context API. Only network
// responses and publication timing are controlled; DOM/renderers remain real.
test('A04 browser baseline: public routes, provider states, delayed publications and locales',{timeout:240000},async t=>{
 const binary=chromeBinary(),dir=mkdtempSync(join(tmpdir(),'fa-a04-browser-'));
 const staged=join(dir,'public'),allowed=new Set(stagePublicArtifact(repositoryRoot,staged));
 const delayedSources=new Map();
 const requests=[],mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
 const server=createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;requests.push(path);
  if(delayedSources.has(path)){delayedSources.get(path)(res);return}
  const file=publicRequestFile(path);
  if(!allowed.has(file)){res.writeHead(404);res.end();return}
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(join(staged,file)));
 });
 const router=createPreviewServer(),devServer=createServer((req,res)=>{req.headers.host='127.0.0.1:2000';router.emit('request',req,res)});
 server.listen(0,'127.0.0.1');devServer.listen(0,'127.0.0.1');
 await Promise.all([once(server,'listening'),once(devServer,'listening')]);
 const origin='http://127.0.0.1:'+server.address().port,devOrigin='http://127.0.0.1:'+devServer.address().port;
 const proc=spawn(binary,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-proxy-server','--disable-background-networking','--disable-extensions','--no-first-run','--remote-debugging-port=0','--user-data-dir='+join(dir,'profile'),'about:blank'],{stdio:['ignore','ignore','pipe']});
 let stderr='',socket;proc.stderr.on('data',data=>stderr+=data.toString());
 try{
  let endpoint;
  for(let i=0;i<300&&!endpoint;i++){endpoint=stderr.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];if(proc.exitCode!==null)throw Error('A04 Chrome exited: '+stderr.slice(-1000));if(!endpoint)await delay(100)}
  assert.ok(endpoint,'A04 Chrome DevTools must start: '+stderr.slice(-1000));
  const tabs=await (await fetch('http://'+new URL(endpoint).host+'/json/list')).json();
  socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
  let seq=0;const pending=new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data),entry=pending.get(message.id);if(!entry)return;clearTimeout(entry.timer);pending.delete(message.id);message.error?entry.reject(Error(message.error.message)):entry.resolve(message.result)});
  const cmd=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('A04 CDP timeout '+method))},20000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}))});
  const run=async expression=>{const result=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value};
  const wait=async expression=>{for(let i=0;i<150;i++){if(await run(expression))return;await delay(50)}throw Error('A04 wait: '+expression+'; '+JSON.stringify(await run('({url:location.href,context:window.faCompetitionContext,errors:window.__a04Errors})')))};
  await cmd('Page.enable');await cmd('Runtime.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument',{source:"window.__a04DocumentToken=String(Date.now())+Math.random();window.__a04Errors=[];addEventListener('error',e=>window.__a04Errors.push(e.message));addEventListener('unhandledrejection',e=>window.__a04Errors.push(String(e.reason)));"});
  async function visit(base,id,view='stats',season=1){
   const previous=await run('window.__a04DocumentToken'),path='/competitions/'+id.toLowerCase()+'/'+view+'?season='+season;
   await cmd('Page.navigate',{url:base+path});
   await wait("window.__a04DocumentToken!=="+JSON.stringify(previous??null)+"&&location.origin==="+JSON.stringify(base)+"&&location.pathname==="+JSON.stringify(path.split('?')[0])+"&&window.faCompetitionContext?.selectedSeason==="+season+"&&document.readyState==='complete'&&window.faCompetitionContext?.definition.id==="+JSON.stringify(id)+"&&!!window.faFixtures&&!!window.faCompetitionStats&&!!window.faHistoryPlayerRecords");
  }
  const snapshot=()=>run(`(()=>{const c=window.faCompetitionContext;return {id:c.definition.id,season:c.selectedSeason,data:c.seasonData,stats:[...document.querySelectorAll('#competition-panel-stats .app-competition-stat-value')].map(n=>n.textContent),fixtures:[...document.querySelectorAll('[data-fixture-match]')].map(n=>[n.dataset.fixtureMatch,n.querySelector('.app-fixture-score')?.textContent]),qualified:document.getElementById('app-postseason-bracket')?.dataset.postseasonQualified||null,history:[...document.querySelectorAll('[data-history-filled="true"]')].map(n=>n.dataset.historyPlayerRecord)}})()`);
  await t.test('E1: all 18 Static contexts expose empty Stats/Fixtures/History without protected requests',async()=>{
   for(const entry of catalogue){
    await visit(origin,entry.id);
    assert.deepEqual(await snapshot(),{id:entry.id,season:1,data:null,stats:[],fixtures:[],qualified:entry.category==='domestic'?'false':null,history:[]});
    for(const view of ['fixtures','history']){
     await run('window.faCompetitionRoute.set({view:'+JSON.stringify(view)+'})');
     assert.equal(await run('window.faCompetitionRoute.get().view'),view);
     const observed=await snapshot();assert.equal(observed.data,null);assert.deepEqual(observed.fixtures,[]);assert.deepEqual(observed.history,[]);
    }
   }
   assert.ok(requests.length>18);
   assert.deepEqual(requests.filter(path=>path.startsWith('/__fa_dev__/')||path.startsWith('/tools/')||path.startsWith('/tests/')),[]);
   assert.ok(requests.every(path=>allowed.has(publicRequestFile(path))),'every actual request resolves inside the staged public manifest');
  });
  const division=manifest.divisions.find(d=>d.id==='IT-1'),definition=catalogue.find(d=>d.id==='IT-1');
  function seasonData(season,days=30){
   const preview=createPreviewStandings(division,30,season),stats=aggregatePreviewStats(division,days,season);
   return {season,rulesVersion:definition.rules.version,rulesSnapshot:copy(definition.rules),participants:division.clubs,
    fixtures:preview.fixtures.map(game=>({...game,kickoff:null,homeGoals:game.round<=days?game.homeGoals:null,awayGoals:game.round<=days?game.awayGoals:null})),
    results:createPreviewStandings(division,days,season).fixtures,statistics:{...stats,teams:stats.teams.map(team=>({...team,clubKey:'IT-'+team.clubId})),standings:createPreviewStandings(division,days,season).rows},status:'partial'};
  }
  const put=async data=>run('window.faCompetitionContextApi.replaceSeasonData('+JSON.stringify(data)+',window.faCompetitionContext.revision)');
  await t.test('E2/E3: real DEV MD0/15/30, Season 0 persistence and historical snapshot output',async()=>{
   await visit(devOrigin,'IT-1');
   for(const days of [0,15,30]){
    await run("sessionStorage.setItem('football-architect:standings-dev-preview','on');sessionStorage.setItem('football-architect:standings-dev-season','2');sessionStorage.setItem('football-architect:standings-dev-matchdays',"+JSON.stringify(String(days))+");sessionStorage.removeItem('football-architect:calendar-dev-world-day')");
    await visit(devOrigin,'IT-1','fixtures',2);
    await wait('!!window.faCompetitionContext.seasonData&&!document.documentElement.dataset.faDevStandingsPending');
    const data=(await snapshot()).data;
    assert.equal(data.season,2);assert.equal(data.fixtures.length,240);assert.equal(data.results.length,days*8);
    assert.ok(data.fixtures.every(game=>game.round<=days?Number.isSafeInteger(game.homeGoals)&&Number.isSafeInteger(game.awayGoals):game.homeGoals===null&&game.awayGoals===null));
    assert.equal(data.rulesSnapshot.phases[0].points.win,3);
   }
   await visit(devOrigin,'IT-1','fixtures',1);
   await wait('window.faCompetitionContext.seasonData?.season===1&&!document.documentElement.dataset.faDevStandingsPending');
   assert.equal((await snapshot()).data.results.length,240,'previous season is completed independently of viewed season');
   await run("sessionStorage.setItem('football-architect:standings-dev-season','0')");
   await visit(devOrigin,'IT-1','stats',1);
   await wait("document.documentElement.dataset.faDevCurrentSeason==='0'&&!document.documentElement.dataset.faDevStandingsPending");
   assert.equal((await snapshot()).data,null);assert.deepEqual((await snapshot()).stats,[]);
   assert.equal(await run("sessionStorage.getItem('football-architect:standings-dev-preview')"),null);
   const previous=await run('window.__a04DocumentToken');await cmd('Page.reload');await wait("window.__a04DocumentToken!=="+JSON.stringify(previous)+"&&window.faCompetitionContext?.selectedSeason===1&&document.documentElement.dataset.faDevCurrentSeason==='0'&&!document.documentElement.dataset.faDevStandingsPending");
   assert.equal((await snapshot()).data,null,'Season 0 survives reload without inventing season zero records');
  });
  await t.test('E4: controlled A/B promises cannot restore Fixtures/Stats/Postseason after newer season or Debug OFF',async()=>{
   await visit(devOrigin,'IT-1');
   await run("sessionStorage.setItem('football-architect:standings-dev-season','2');sessionStorage.setItem('football-architect:standings-dev-matchdays','15');sessionStorage.removeItem('football-architect:calendar-dev-world-day')");
   await visit(devOrigin,'IT-1','fixtures',1);
   await wait('window.faCompetitionContext.seasonData?.season===1&&window.faCompetitionContext.seasonData?.statistics?.overview?.matchesPlayed===240&&!document.documentElement.dataset.faDevStandingsPending');
   const a=(await snapshot()).data;
   assert.equal((await snapshot()).fixtures.length,8);
   assert.equal((await snapshot()).qualified,'true','completed prior season actually populated Postseason');
   const bracket=()=>run("document.getElementById('app-postseason-bracket').innerHTML");
   assert.ok(await run("document.querySelectorAll('#app-postseason-bracket [data-club-crest]').length>0"));
   await run(`window.__a04Publications=0;addEventListener('fa:competition-context-change',e=>{if(e.detail.seasonData)window.__a04Publications++});window.__a04Lease=window.faCompetitionContext.revision;window.__a04Pending=new Promise(resolve=>window.__a04Release=resolve).then(data=>window.faCompetitionContextApi.replaceSeasonData(data,window.__a04Lease));window.faCompetitionRoute.set({season:'2'});`);
   await wait('window.faCompetitionContext.seasonData?.season===2&&window.faCompetitionContext.seasonData?.statistics?.overview?.matchesPlayed===120');
   const before=await snapshot(),beforeBracket=await bracket(),publications=await run('window.__a04Publications'),b=before.data;
   assert.equal(before.fixtures.length,8);assert.equal(before.stats[0],'120');assert.equal(before.qualified,'false');
   await run('window.__a04Release('+JSON.stringify(a)+')');assert.equal(await run('window.__a04Pending'),false);
   assert.deepEqual(await snapshot(),before);assert.equal(await bracket(),beforeBracket);assert.equal(await run('window.__a04Publications'),publications);
   await run(`window.__a04Lease=window.faCompetitionContext.revision;window.__a04Pending=new Promise(resolve=>window.__a04Release=resolve).then(data=>window.faCompetitionContextApi.replaceSeasonData(data,window.__a04Lease));const control=document.querySelector('[data-dev-control="season-number"]');control.value='0';control.dispatchEvent(new Event('change',{bubbles:true}));`);
   await wait("document.documentElement.dataset.faDevCurrentSeason==='0'&&window.faCompetitionContext.seasonData===null");
   const empty=await snapshot(),emptyBracket=await bracket();assert.equal(empty.data,null);assert.deepEqual(empty.fixtures,[]);assert.deepEqual(empty.stats,[]);assert.equal(empty.qualified,'false');
   await run('window.__a04Release('+JSON.stringify(b)+')');assert.equal(await run('window.__a04Pending'),false);
   assert.deepEqual(await snapshot(),empty);assert.equal(await bracket(),emptyBracket);assert.equal(await run('window.__a04Publications'),publications);
  });
  // Catches a removed revision guard or a clock/navigation update that replaces historical records.
  await t.test('A06-12 X07/X09: historical navigation and clock advance reject obsolete provider publications',async()=>{
   const records=()=>run("[...document.querySelectorAll('[data-history-filled=\"true\"]')].map(n=>[n.dataset.historyPlayerRecord,n.textContent])");
   const history={source:'canonical',competitionId:'IT-1',coverage:'complete',provenance:{approved:true},seasons:[{
    seasonId:1,status:'completed',dataStatus:'approved',playerStatsComplete:true,rulesVersion:definition.rules.version,rulesSnapshot:definition.rules,
    playerStats:[{playerId:'a06-player',playerName:'A06 Historical Player',countryId:'IT',clubId:1,goals:3,assists:1,appearances:2,cleanSheets:0}]}]};
   for(const sourceFailure of [false,true]){
    await visit(devOrigin,'IT-1','fixtures',1);
    const previous=await run('window.__a04DocumentToken');await cmd('Page.reload');
    await wait('window.__a04DocumentToken!=='+JSON.stringify(previous)+"&&window.faCompetitionContext?.selectedSeason===1&&!!window.faHistoryPlayerRecords&&document.readyState==='complete'");
    const initial=seasonData(1,15);assert.equal(await put(initial),true);
    await run('window.faHistoryPlayerRecords.applyCanonicalHistory('+JSON.stringify(history)+')');
    const approved=await records();assert.ok(approved.length>0);assert.ok(JSON.stringify(approved).includes('A06 Historical Player'));
    const historicalUrl=await run('location.href');
    assert.equal(new URL(historicalUrl).searchParams.get('season'),'1');
    await run(`window.__a06Lease=window.faCompetitionContext.revision;window.__a06Publications=0;
     addEventListener('fa:competition-context-change',()=>window.__a06Publications++);
     window.__a06Pending=new Promise(resolve=>window.__a06Release=resolve).then(data=>window.faCompetitionContextApi.replaceSeasonData(data,window.__a06Lease));true`);
    const beforeClock=await snapshot(),revision=await run('window.faCompetitionContext.revision');
    for(const day of [31,32])await run(`window.faWorldClockSnapshot={source:{kind:'dev',reference:'A06-12'},current:{season:3,day:${day}}};dispatchEvent(new CustomEvent('fa:world-clock-snapshot',{detail:window.faWorldClockSnapshot}))`);
    assert.deepEqual(await snapshot(),beforeClock,'world time cannot change historical season data');
    assert.deepEqual(await records(),approved,'world time cannot rewrite canonical History');
    assert.equal(await run('location.href'),historicalUrl);assert.equal(await run('window.faCompetitionContext.revision'),revision);
    // Same-document browser history plus an actual provider revision change creates an ABA lease.
    await run("window.faCompetitionRoute.set({view:'stats'});window.faCompetitionContextApi.clearSeasonData()");
    assert.equal(await put(seasonData(1,30)),true);
    await run('history.back()');await wait("window.faCompetitionRoute.get().view==='fixtures'");
    assert.equal(await run('location.href'),historicalUrl);
    await run('history.forward()');await wait("window.faCompetitionRoute.get().view==='stats'");
    await run('history.back()');await wait("window.faCompetitionRoute.get().view==='fixtures'");
    assert.ok(await run('window.faCompetitionContext.revision>window.__a06Lease'));
    const current=await snapshot(),currentRecords=await records(),publications=await run('window.__a06Publications');
    assert.equal(current.data.statistics.overview.matchesPlayed,240,'newer provider data actually committed');
    const obsolete=sourceFailure?{...initial,status:'unavailable',fixtures:null,results:null,statistics:null}:initial;
    await run('window.__a06Release('+JSON.stringify(obsolete)+')');assert.equal(await run('window.__a06Pending'),false,'obsolete success/unavailable publication must be rejected');
    assert.deepEqual(await snapshot(),current);assert.deepEqual(await records(),currentRecords);assert.deepEqual(currentRecords,approved);
    assert.equal(await run('window.__a06Publications'),publications);assert.equal(await run('location.href'),historicalUrl);
    // Keep a real source response pending while navigating into a different competition/document.
    const path='/a06-12-delayed-'+Number(sourceFailure)+'.json';let release;
    const requested=new Promise(resolve=>delayedSources.set(path,res=>{
     const settled=new Promise(done=>res.once('close',()=>done(res.writableFinished?'delivered':'aborted')));
     release=async()=>{if(!res.destroyed){res.writeHead(sourceFailure?503:200,{'Content-Type':'application/json'});res.end(JSON.stringify(obsolete))}return settled};resolve();
    }));
    await run(`window.__a06OldRevision=window.faCompetitionContext.revision;
     fetch(${JSON.stringify(path)}).then(async response=>response.ok?response.json():${JSON.stringify(obsolete)})
      .then(data=>window.faCompetitionContextApi.replaceSeasonData(data,window.__a06OldRevision)).catch(()=>{});true`);
    await Promise.race([requested,delay(5000).then(()=>{throw Error('A06-12 delayed source was not requested')})]);
    await visit(origin,'ENG-1','fixtures',1);
    const next=await snapshot();assert.equal(next.id,'ENG-1');assert.equal(next.data,null);
    const settled=await Promise.race([release(),delay(5000).then(()=>{throw Error('A06-12 old source did not settle')})]);
    assert.ok(['delivered','aborted'].includes(settled));delayedSources.delete(path);
    assert.deepEqual(await snapshot(),next,'old-document source settlement/abort leaves the new competition isolated');
    assert.deepEqual(await records(),[]);assert.deepEqual(await run('window.__a04Errors'),[]);
   }
  });
  await t.test('E5: absent/zero/partial/invalid/recovered Stats in five locales, ARIA and mobile widths',async()=>{
   await visit(devOrigin,'IT-1');
   const locales=[['en','No statistics yet.','Statistics are unavailable.','Stats','Close'],['de','Noch keine Statistiken.','Statistiken sind nicht verfügbar.','Statistiken','Schließen'],['es','Aún sin estadísticas.','Las estadísticas no están disponibles.','Estadísticas','Cerrar'],['fr','Aucune statistique.','Les statistiques sont indisponibles.','Statistiques','Fermer'],['it','Nessuna statistica.','Le statistiche non sono disponibili.','Statistiche','Chiudi']];
   for(const [lang,empty,error,nav,close] of locales){
    await run('document.documentElement.lang='+JSON.stringify(lang)+';window.faAppRenderLanguage()');
    for(const width of [320,390,1440]){
     await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
     await run('window.faCompetitionContextApi.clearSeasonData()');
     for(const data of [null,seasonData(1,0),seasonData(1,15),{...seasonData(1,15),statistics:{...seasonData(1,15).statistics,teams:[{clubKey:'IT-99'}]}},seasonData(1,30)]){
      if(data===null)await run('window.faCompetitionContextApi.clearSeasonData()');else assert.equal(await put(data),true);
      await run("document.querySelector('[data-stats-view=overview]').click()");
      const state=await run(`(()=>{const p=document.getElementById('competition-panel-stats');return {values:[...p.querySelectorAll('.app-competition-stat-value')].map(n=>n.textContent),empty:[...p.querySelectorAll('.fa-dev-stats-empty')].map(n=>n.textContent),nav:p.querySelector('[role=group]').getAttribute('aria-label'),pressed:[...p.querySelectorAll('[data-stats-view]')].map(n=>n.getAttribute('aria-pressed')),fits:document.documentElement.scrollWidth<=innerWidth+1}})()`);
      const invalid=data?.statistics.teams[0]?.clubKey==='IT-99',played=data?.statistics.overview.matchesPlayed>0;
      assert.equal(state.nav,nav);assert.deepEqual(state.pressed,['true','false','false']);assert.equal(state.fits,true,lang+' '+width);
      if(!played||invalid){assert.deepEqual(state.values,[]);assert.deepEqual(state.empty,[invalid?error:empty,invalid?error:empty,invalid?error:empty])}
      else{
       assert.equal(state.values[0],String(data.statistics.overview.matchesPlayed));
       await run("document.querySelector('[data-stats-view=teams]').click();document.querySelector('.fa-dev-stats-expand').click()");
       assert.equal(await run("document.querySelector('.fa-dev-stats-dialog-close').getAttribute('aria-label')"),close);
       assert.equal(await run("document.querySelector('.fa-dev-stats-dialog').getAttribute('aria-labelledby')"),'fa-dev-stats-dialog-title');
       await run("document.querySelector('.fa-dev-stats-dialog').close()");
      }
     }
    }
   }
   assert.deepEqual(await run('window.__a04Errors'),[]);
  });
  await t.test('E3/E5 History: approved domestic/cup records reject missing provenance, partial and corrupt snapshots',async()=>{
   for(const id of ['IT-1','int-1','int-2']){
    await visit(origin,id,'history');
    const entry=catalogue.find(d=>d.id===id),payload={source:'canonical',competitionId:id,coverage:'complete',provenance:{approved:true},seasons:[{seasonId:1,status:'completed',dataStatus:'approved',playerStatsComplete:true,rulesVersion:entry.rules.version,rulesSnapshot:entry.rules,playerStats:[{playerId:'p1',playerName:'Approved Player',countryId:'IT',clubId:1,goals:3,assists:1,appearances:2,cleanSheets:0}]}]};
    const apply=payload=>run('(()=>{try{window.faHistoryPlayerRecords.applyCanonicalHistory('+JSON.stringify(payload)+');return true}catch{return false}})()');
    for(const change of [p=>delete p.provenance,p=>p.provenance.approved=false,p=>p.coverage='partial',p=>p.seasons[0].rulesVersion='invalid',p=>p.seasons[0].rulesSnapshot.phases[0].points.win=-1,p=>p.seasons[0].seasonId=0]){
     const invalid=copy(payload);change(invalid);assert.equal(await apply(invalid),false);assert.deepEqual((await snapshot()).history,[]);
    }
    assert.equal(await apply(payload),true);assert.ok((await snapshot()).history.length>0);
    assert.ok(await run("document.getElementById('competition-panel-history').textContent.includes('Approved Player')"));
    await run('window.faHistoryPlayerRecords.clear()');assert.deepEqual((await snapshot()).history,[]);
   }
  });
 }finally{
  try{socket?.close()}catch{}
  if(proc.exitCode===null&&proc.signalCode===null)proc.kill('SIGTERM');
  for(let i=0;i<30&&proc.exitCode===null&&proc.signalCode===null;i++)await delay(100);
  if(proc.exitCode===null&&proc.signalCode===null)proc.kill('SIGKILL');
  for(let i=0;i<30&&proc.exitCode===null&&proc.signalCode===null;i++)await delay(100);
  server.closeAllConnections();devServer.closeAllConnections();server.close();devServer.close();
  // Chromium can create one last file during profile teardown even after its signal.
  // Retry only the ephemeral profile deletion; preserve a persistent failure.
  for(let attempt=0;;attempt++){
   try{rmSync(dir,{recursive:true,force:true,maxRetries:8,retryDelay:150});break}
   catch(error){if(attempt>=8||!['ENOTEMPTY','EBUSY','EPERM'].includes(error?.code))throw error;await delay(200*(attempt+1))}
  }
 }
});
