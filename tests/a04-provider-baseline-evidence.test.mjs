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
import {createPreviewStandings} from '../tools/dev-standings-preview-data.mjs';
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
 const api=runInNewContext(source.slice(start,end)+';definition=input;division=projection;activeDebugSeason=null;({replaceSeasonData,clearSeasonData,createContext})',{
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
 const requests=[],mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
 const server=createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;requests.push(path);
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
  await cmd('Page.addScriptToEvaluateOnNewDocument',{source:"window.__a04Errors=[];addEventListener('error',e=>window.__a04Errors.push(e.message));addEventListener('unhandledrejection',e=>window.__a04Errors.push(String(e.reason)));"});
  async function visit(base,id,view='stats',season=1){
   await cmd('Page.navigate',{url:base+'/competitions/'+id.toLowerCase()+'/'+view+'?season='+season});
   await wait("document.readyState==='complete'&&window.faCompetitionContext?.definition.id==="+JSON.stringify(id)+"&&!!window.faFixtures&&!!window.faCompetitionStats&&!!window.faHistoryPlayerRecords");
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
   await cmd('Page.reload');await wait("window.faCompetitionContext?.selectedSeason===1&&document.documentElement.dataset.faDevCurrentSeason==='0'&&!document.documentElement.dataset.faDevStandingsPending");
   assert.equal((await snapshot()).data,null,'Season 0 survives reload without inventing season zero records');
  });
  await t.test('E4: controlled A/B promises cannot restore Fixtures/Stats/Postseason after newer season or Debug OFF',async()=>{
   await visit(origin,'IT-1','fixtures');
   const a=seasonData(1),b=seasonData(2,15);
   await run(`window.__a04Publications=0;addEventListener('fa:competition-context-change',e=>{if(e.detail.seasonData)window.__a04Publications++});`);
   // Capture the lease BEFORE the async boundary, just as a provider must.
   await run(`window.__a04Lease=window.faCompetitionContext.revision;window.__a04Pending=new Promise(resolve=>window.__a04Release=resolve).then(data=>window.faCompetitionContextApi.replaceSeasonData(data,window.__a04Lease));window.faCompetitionContextApi.selectSeason(2);`);
   assert.equal(await put(b),true);
   const before=await snapshot(),publications=await run('window.__a04Publications');
   assert.equal(before.data.season,2);assert.equal(before.fixtures.length,8);assert.equal(before.stats[0],'120');
   await run('window.__a04Release('+JSON.stringify(a)+')');assert.equal(await run('window.__a04Pending'),false);
   assert.deepEqual(await snapshot(),before);assert.equal(await run('window.__a04Publications'),publications);
   await run(`window.__a04Lease=window.faCompetitionContext.revision;window.__a04Pending=new Promise(resolve=>window.__a04Release=resolve).then(data=>window.faCompetitionContextApi.replaceSeasonData(data,window.__a04Lease));window.faCompetitionContextApi.setDebugSeason(0)`);
   const empty=await snapshot();assert.equal(empty.data,null);assert.deepEqual(empty.fixtures,[]);assert.deepEqual(empty.stats,[]);assert.equal(empty.qualified,'false');
   await run('window.__a04Release('+JSON.stringify(b)+')');assert.equal(await run('window.__a04Pending'),false);
   assert.deepEqual(await snapshot(),empty);assert.equal(await run('window.__a04Publications'),publications);
  });
  await t.test('E5: absent/zero/partial/invalid/recovered Stats in five locales, ARIA and mobile widths',async()=>{
   await visit(origin,'IT-1');
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
       assert.equal(await run("document.querySelector('dialog').getAttribute('aria-labelledby')"),'fa-dev-stats-dialog-title');
       await run("document.querySelector('dialog').close()");
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
  console.log('A04_BASELINE_BROWSER_PASS|18 Static; DEV 0/15/30; Season0 reload; A/B context; 5 locales x 3 widths; History provenance');
 }finally{
  try{socket?.close()}catch{}
  proc.kill('SIGTERM');for(let i=0;i<30&&proc.exitCode===null;i++)await delay(100);if(proc.exitCode===null)proc.kill('SIGKILL');
  server.closeAllConnections();devServer.closeAllConnections();server.close();devServer.close();
  rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});
 }
});
