// G10-PUBLIC-02: actual staged Debug bytes served from loopback only, never Vercel.
import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {spawn,spawnSync} from "node:child_process";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,extname} from "node:path";
import {setTimeout as delay} from "node:timers/promises";
import {stageProtectedDebugArtifact} from "../tools/dev-preview-artifact.mjs";
import {createPreviewStandings,createPreviewPostseason} from "../tools/dev-standings-preview-data.mjs";
import {aggregatePreviewStats} from "../tools/dev-competition-stats-data.mjs";
import {repositoryRoot,publicRequestFile} from "../tools/publication-guard.mjs";

const mime={".html":"text/html",".mjs":"text/javascript",".js":"text/javascript",
 ".css":"text/css",".json":"application/json",".svg":"image/svg+xml",
 ".png":"image/png",".webp":"image/webp",".ico":"image/x-icon"};
const chrome=()=>{
 const windows=process.platform==="win32"?[
  process.env.ProgramFiles&&join(process.env.ProgramFiles,"Google","Chrome","Application","chrome.exe"),
  process.env["PROGRAMFILES(X86)"]&&join(process.env["PROGRAMFILES(X86)"],"Google","Chrome","Application","chrome.exe"),
  process.env.LOCALAPPDATA&&join(process.env.LOCALAPPDATA,"Google","Chrome","Application","chrome.exe")]:[];
 for(const bin of [process.env.CHROME_BIN,...windows,"google-chrome","google-chrome-stable","chromium","chromium-browser"].filter(Boolean))
  if(spawnSync(bin,["--version"],{timeout:4000,stdio:"ignore"}).status===0)return bin;
 throw Error("Chrome required for isolated G10-PUBLIC-02 browser audit");
};
const stopServer=server=>new Promise(resolve=>server.close(resolve));

test("G10-PUBLIC-02 browser: Debug controls operate without outgoing mutations",{timeout:120000},async()=>{
 const binary=chrome();
 const temp=mkdtempSync(join(tmpdir(),"fa-g10-browser-"));
 const artifact=join(temp,"artifact");
 const allow=new Set(stageProtectedDebugArtifact(repositoryRoot,artifact));
 const refused=[];
 const server=createServer((req,res)=>{
  try{
   if(!["GET","HEAD"].includes(req.method))throw Error("non-read method");
   const pathname=new URL(req.url,"http://127.0.0.1").pathname;
   if(pathname.includes("%")||pathname.includes("\\")||pathname.includes("\0"))throw Error("encoded path");
   const route=pathname.startsWith("/competitions/_shared/")?"/app"+pathname:pathname;
   const file=publicRequestFile(route);
   if(!allow.has(file))throw Error("path not in artifact");
   const type=mime[extname(file)];
   if(!type)throw Error("mime not allowed");
   res.writeHead(200,{"Content-Type":type,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
   res.end(req.method==="HEAD"?undefined:readFileSync(join(artifact,file)));
  }catch(error){
   refused.push({path:(req.url||"").split("?")[0],method:req.method});
   res.writeHead(404);res.end();
  }
 });
 let proc,socket,chromeClosed;
 try{
  await new Promise((ok,fail)=>{server.once("error",fail);server.listen(0,"127.0.0.1",ok)});
  const origin="http://127.0.0.1:"+server.address().port;
  proc=spawn(binary,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
   "--no-proxy-server","--disable-background-networking","--disable-extensions","--disable-sync",
   "--no-first-run","--no-default-browser-check","--remote-debugging-port=0",
   "--user-data-dir="+join(temp,"chrome"),"about:blank"],{stdio:["ignore","ignore","pipe"]});
  chromeClosed=new Promise(resolve=>proc.once("close",resolve));
  let stderr="";proc.stderr.on("data",x=>stderr+=x.toString());
  let endpoint;
  for(let i=0;i<150&&!endpoint;i++){
   endpoint=stderr.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];
   if(proc.exitCode!==null)throw Error("Chrome exited before CDP startup");
   if(!endpoint)await delay(100);
  }
  assert.ok(endpoint,"Chrome DevTools socket should start");
  const host=new URL(endpoint).host;
  let tab;
  for(let i=0;i<50&&!tab;i++){
   try{tab=(await (await fetch("http://"+host+"/json/list")).json()).find(x=>x.type==="page")}catch{}
   if(!tab)await delay(100);
  }
  assert.ok(tab?.webSocketDebuggerUrl);
  socket=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{socket.addEventListener("open",ok,{once:true});socket.addEventListener("error",fail,{once:true})});
  const pending=new Map(),requests=[],sockets=[],streams=[],errors=[];let seq=0;
  socket.addEventListener("message",event=>{
   const m=JSON.parse(event.data);
   // Keep errors in the Node process: page globals are discarded on navigation.
   if(m.method==="Runtime.exceptionThrown")
    errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
   if(m.method==="Runtime.consoleAPICalled"&&m.params.type==="error")
    errors.push(m.params.args.map(arg=>arg.value??arg.description??arg.type).join(" "));
   if(m.method==="Network.requestWillBeSent"&&m.params?.request)
    requests.push({method:m.params.request.method,url:m.params.request.url});
   if(m.method==="Network.webSocketCreated"||m.method==="Network.webTransportCreated")
    sockets.push({kind:m.method,url:m.params?.url||""});
   if(m.method==="Network.eventSourceMessageReceived")
    streams.push(m.params?.requestId||"unknown");
   const p=pending.get(m.id);
   if(!p)return;
   clearTimeout(p.timer);pending.delete(m.id);
   m.error?p.fail(Error(m.error.message)):p.ok(m.result);
  });
  const cmd=(method,params={})=>new Promise((ok,fail)=>{
   const id=++seq,timer=setTimeout(()=>{pending.delete(id);fail(Error("CDP timeout: "+method))},15000);
   pending.set(id,{ok,fail,timer});
   socket.send(JSON.stringify({id,method,params}));
  });
  const run=async expression=>{
   const result=await cmd("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
   if(result.exceptionDetails)throw Error(result.exceptionDetails.text);
   return result.result.value;
  };
  const until=async expression=>{
   for(let i=0;i<100;i++){
    if(await run(expression))return;
    await delay(100);
   }
   throw Error("Browser state timeout: "+expression);
  };
  await cmd("Page.enable");
  await cmd("Network.enable");
  await cmd("Runtime.enable");
  // Headless CDP can update activeElement without dispatching focus while the
  // document's window is inactive. Keyboard assertions need an active document.
  await cmd("Emulation.setFocusEmulationEnabled",{enabled:true});
  const divisions=JSON.parse(readFileSync(join(artifact,"app/competitions/_shared/manifest.json"),"utf8")).divisions;
  const standingsSnapshot="[...document.querySelectorAll('#app-standings-body tr')].map(row=>[row.dataset.worldClub,row.cells[9]?.textContent])";
  const verifySeason=async(season,matchdays=10)=>{
   const division=divisions.find(item=>item.id==="IT-1");
   const expected=createPreviewStandings(division,matchdays,season).rows.map(row=>[row.club.countryId+"-"+row.club.clubId,String(row.pts)]);
   await until("JSON.stringify("+standingsSnapshot+")==="+JSON.stringify(JSON.stringify(expected)));
   await run("document.getElementById('competition-tab-stats').click()");
   const overview=aggregatePreviewStats(division,matchdays,season).overview;
   const expectedStats=[String(overview.matchesPlayed),String(overview.totalGoals),overview.goalsPerMatch.toFixed(2)];
   if(matchdays)await until("JSON.stringify([...document.querySelectorAll('#fa-dev-stats .fa-dev-stats-grid strong')].map(node=>node.textContent))==="+JSON.stringify(JSON.stringify(expectedStats)));
   else await until("document.querySelectorAll('#fa-dev-stats .fa-dev-stats-grid .fa-dev-stats-empty').length===3");
  };
  await cmd("Page.navigate",{url:origin+"/competitions/it-1?season=1&view=standings"});
  await until("document.readyState==='complete'&&!!document.querySelector('.fa-dev-widget-button')&&document.querySelectorAll('#app-standings-body tr').length===16");
  await run("document.querySelector('.fa-dev-widget-button').click()");
  await until("sessionStorage.getItem('football-architect:standings-dev-preview')==='on' && !document.querySelector('[data-dev-control=matchdays-number]').disabled");
  assert.equal(await run("document.querySelector('[data-dev-control=season]').value"),"1");
  assert.equal(await run("(()=>{const season=document.querySelector('[data-dev-control=season]'),days=document.querySelector('[data-dev-control=matchdays]');return season.type==='range'&&season.min==='1'&&season.max==='4'&&season.step==='1'&&season.getBoundingClientRect().width===days.getBoundingClientRect().width&&document.querySelector('[data-dev-control=season-number]').value==='1'&&document.querySelectorAll('.fa-dev-number-arrow').length===4})()"),true,'Season shares the Matchdays slider and number-stepper layout');
  assert.equal(await run("document.querySelector('[data-dev-control=matchdays-number]').value"),"0");
  assert.equal(await run("!!document.querySelector('[data-dev-control=fictional-standings]')"),false);
  // Progress examples must reconcile current-season Stats and cumulative History.
  for(const [season,days] of [[1,0],[1,15],[2,13],[2,0],[2,30],[1,0]]){
   await run("document.querySelector('[data-dev-control=season]').value='"+season+"';document.querySelector('[data-dev-control=season]').dispatchEvent(new Event('change',{bubbles:true}))");
   await until("!document.querySelector('[data-dev-control=season]').disabled");
   await run("window.faCompetitionRoute.set({season:'"+season+"'})");
   await run("document.querySelector('[data-dev-control=matchdays-number]').value='"+days+"';document.querySelector('[data-dev-control=matchdays-number]').dispatchEvent(new Event('change',{bubbles:true}))");
   await until("!document.querySelector('[data-dev-control=matchdays-number]').disabled");
   await run("document.getElementById('competition-tab-stats').click()");
   if(days)await until("document.querySelector('#fa-dev-stats .fa-dev-stats-grid strong')?.textContent==='"+(days*8)+"'");
   else await until("document.querySelectorAll('#fa-dev-stats .fa-dev-stats-grid .fa-dev-stats-empty').length===3");
   await run("document.getElementById('competition-tab-history').click()");
   const completed=season-1+(days===30?1:0);
   if(season===1&&days===0){
    await until("!document.querySelector('.app-history-dev')&&!document.querySelector('[data-history-empty]').hidden");
    assert.equal(await run("document.querySelectorAll('#competition-panel-history strong').length"),0);
   }else{
    await until("!!document.querySelector('.app-history-dev')&&document.querySelectorAll('[data-history-season]').length==="+completed);
    const models=Array.from({length:season},(_,index)=>createPreviewStandings(divisions.find(d=>d.id==='IT-1'),index+1<season?30:days,index+1));
    const totals=new Map();
    for(const model of models)for(const row of model.rows)totals.set(row.club.clubId,(totals.get(row.club.clubId)||0)+row.won);
    assert.equal(await run("Number(document.querySelector('[data-history-record=totalWins] strong').textContent)"),Math.max(...totals.values()),'History includes exactly the matches played through '+season+'/'+days);
    assert.equal(await run("!!document.querySelector('[data-history-record=titles] strong')"),completed>0);
    assert.equal(await run("!!document.querySelector('[data-history-record=attack] strong')"),completed>0);
   }
  }
  await run("document.getElementById('competition-tab-standings').click()");
  await run("document.querySelector('[data-dev-control=matchdays-number]').value='15';document.querySelector('[data-dev-control=matchdays-number]').dispatchEvent(new Event('change',{bubbles:true}))");
  await until("document.querySelectorAll('#app-standings-body .app-world-form-dot').length===80 && !document.querySelector('[data-dev-control=matchdays-number]').disabled");
  assert.equal(await run("document.querySelectorAll('#app-standings-body tr').length"),16);

  // Verify the injected standings also supply a functioning fixtures calendar.
  await run("document.getElementById('competition-tab-fixtures').click()");
  await until("new URL(location.href).searchParams.get('view')==='fixtures' && document.querySelectorAll('#app-fixtures-list .app-fixture-match').length===8 && !document.getElementById('app-fixtures-toolbar').hidden");
  await run("document.getElementById('app-fixtures-current').click()");
  await until("new URL(location.href).searchParams.get('matchday')==='16'");
  await run("document.getElementById('app-fixtures-previous').click()");
  await until("new URL(location.href).searchParams.get('matchday')==='15' && document.querySelectorAll('#app-fixtures-list .app-fixture-goals').length===16");

  // Exercise every Stats subview, then change the Debug matchday number.
  await run("document.getElementById('competition-tab-stats').click()");
  await until("new URL(location.href).searchParams.get('view')==='stats' && document.querySelectorAll('#fa-dev-stats .fa-dev-stats-nav button').length===3 && document.querySelectorAll('#fa-dev-stats .fa-dev-stats-grid').length===1");
  await run("document.querySelectorAll('#fa-dev-stats .fa-dev-stats-nav button')[1].click()");
  await until("document.querySelectorAll('#fa-dev-stats .fa-dev-stats-leader-card').length===7");
  await run("document.querySelectorAll('#fa-dev-stats .fa-dev-stats-nav button')[2].click()");
  await until("document.querySelectorAll('#fa-dev-stats .fa-dev-stats-leader-card .fa-dev-stats-empty').length===4");
  await run("document.querySelector('[data-dev-control=\"matchdays-number\"]').value='10';document.querySelector('[data-dev-control=\"matchdays-number\"]').dispatchEvent(new Event('change',{bubbles:true}))");
  await until("sessionStorage.getItem('football-architect:standings-dev-matchdays')==='10' && !document.querySelector('[data-dev-control=\"matchdays-number\"]').disabled");
  await run("document.querySelectorAll('#fa-dev-stats .fa-dev-stats-nav button')[0].click()");
  await until("document.querySelector('#fa-dev-stats .fa-dev-stats-grid strong')?.textContent==='80'");

  // Exercise slider, both number steppers and page reset, including rejected input.
  await run("document.querySelector('[data-dev-control=matchdays]').value='12';document.querySelector('[data-dev-control=matchdays]').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-dev-control=matchdays]').dispatchEvent(new Event('change',{bubbles:true}))");
  await until("sessionStorage.getItem('football-architect:standings-dev-matchdays')==='12' && !document.querySelector('[data-dev-control=matchdays]').disabled");
  for(const [step,value] of [[1,13],[-1,12]]){
   await run("document.querySelector('[data-dev-control-row=matchdays] .fa-dev-number-arrow[data-step=\""+step+"\"]').click()");
   await until("sessionStorage.getItem('football-architect:standings-dev-matchdays')==='"+value+"' && !document.querySelector('[data-dev-control=matchdays-number]').disabled");
  }
  await run("document.querySelector('[data-dev-control=matchdays-number]').value='34';document.querySelector('[data-dev-control=matchdays-number]').dispatchEvent(new Event('change',{bubbles:true}))");
  assert.equal(await run("document.querySelector('[data-dev-control=matchdays-number]').value"),"12");
  assert.equal(await run("sessionStorage.getItem('football-architect:standings-dev-matchdays')"),"12");
  // Post-season progress affects the bracket, while league Stats stop at day 30.
  for(const divisionId of ['IT-1','IT-2']){
   await cmd("Page.navigate",{url:origin+"/competitions/"+divisionId.toLowerCase()+"?season=1&view=postseason"});
   await until("document.readyState==='complete' && !!window.faPostseason && !!document.querySelector('[data-dev-control=matchdays-number]')");
   assert.equal(await run("document.querySelector('[data-dev-control=matchdays]').max"),'33');
   const division=divisions.find(d=>d.id===divisionId);
   for(const day of [30,31,32,33,31,29]){
    await run("document.querySelector('[data-dev-control=matchdays-number]').value='"+day+"';document.querySelector('[data-dev-control=matchdays-number]').dispatchEvent(new Event('change',{bubbles:true}))");
    await until("!document.querySelector('[data-dev-control=matchdays-number]').disabled && sessionStorage.getItem('football-architect:standings-dev-matchdays')==='"+day+"'");
    const results=createPreviewPostseason(division,day,1);
    const expectedScores=results.ties.reduce((n,t)=>n+t.legs.filter(Boolean).length*2+(t.aggregate?2:0),0)+(day===33&&division.tier===2?2:0);
    await until("[...document.querySelectorAll('[data-postseason-score]')].filter(n=>n.textContent!=='—').length==="+expectedScores);
    assert.equal(await run("document.querySelector('#app-postseason-winner [data-club-crest]')?.dataset.clubCrest||null"),results.winnerId?division.countryId+'-'+results.winnerId:null);
    if(day===30){
     for(const width of [1440,390,320]){
      await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      const heights=await run("(()=>{const table=document.querySelector('#app-postseason-bracket [role=table]'),rows=[...table.querySelectorAll('[data-postseason-row]')];return rows.map(row=>row.getBoundingClientRect().height)})()");
      assert.ok(Math.abs(heights[0]-heights[1])<1,divisionId+' equally sized rows at '+width);
      const size=await run("(()=>{const row=document.querySelector('[data-postseason-row]'),host=row.querySelector('[data-club-crest]'),before=row.getBoundingClientRect().height,original=host.dataset.clubCrestLoaded;host.dataset.clubCrestLoaded='true';const loaded=row.getBoundingClientRect().height;if(original===undefined)delete host.dataset.clubCrestLoaded;else host.dataset.clubCrestLoaded=original;return {before,loaded}})()");
      assert.equal(size.before,size.loaded,'Loaded crests and missing-logo fallback preserve row height');
     }
     await cmd('Emulation.clearDeviceMetricsOverride');
    }
    await run("document.getElementById('competition-tab-fixtures').click()");
    const stage=division.tier===1?'playout':'playoffs';
    assert.equal(await run("!document.querySelector('[data-fixture-round-choice="+stage+"]').hidden"),true);
    if(day>=30){
     await run("document.getElementById('app-fixtures-round').click();document.querySelector('[data-fixture-round-choice="+stage+"]').click()");
     const count=division.tier===1?2:day<32?4:5;
     await until("new URL(location.href).searchParams.get('matchday')==='"+stage+"' && document.querySelectorAll('#app-fixtures-list .app-fixture-match').length==="+count);
     const played=day<31?0:division.tier===1?Math.min(day-30,2):day===31?2:day===32?4:5;
     assert.equal(await run("document.querySelectorAll('#app-fixtures-list .app-fixture-goals').length"),played*2);
     if(results.final?.penalties)assert.equal(await run("[...document.querySelectorAll('#app-fixtures-list .app-fixture-match')].find(n=>n.dataset.fixtureRound==='33').querySelector('.app-fixture-status strong')?.textContent.trim()"),results.final.penalties.homeGoals+'–'+results.final.penalties.awayGoals,'Shootout score survives translation');
     assert.equal(await run("document.getElementById('app-fixtures-round-label').hidden"),true);
     if(day===33){
      await cmd('Page.reload',{ignoreCache:true});
      await until("!!window.faFixtures && !document.querySelector('[data-dev-control=matchdays-number]')?.disabled && document.querySelectorAll('#app-fixtures-list .app-fixture-match').length==="+count);
      assert.equal(await run("window.faCompetitionRoute.get().matchday"),stage,'Named round survives refresh');
     }
    }else assert.equal(await run("window.faCompetitionRoute.get().matchday"),30,'Rollback removes the post-season URL');
    await run("document.getElementById('competition-tab-stats').click()");
    await until("document.querySelector('#fa-dev-stats .fa-dev-stats-grid strong')?.textContent==='"+(Math.min(day,30)*8)+"'");
    await run("document.getElementById('competition-tab-postseason').click()");
   }
   assert.equal(await run('document.hasFocus()'),true,'Keyboard audit has an active document');
   const focusState=await run("(()=>{const b=document.querySelector('[data-postseason-help]');document.getElementById('competition-tab-postseason').focus({preventScroll:true});b.focus();return {focused:document.activeElement===b,hidden:document.getElementById(b.getAttribute('aria-describedby')).hidden}})()");
   assert.equal(focusState.focused,true,'Keyboard focus reaches score-column help');
   assert.equal(focusState.hidden,false,divisionId+' header help opens when keyboard focus enters: '+JSON.stringify(focusState));
   assert.equal(await run("document.getElementById(document.querySelector('[data-postseason-help]').getAttribute('aria-describedby')).hidden"),false,divisionId+' focused help remains visible');
   const tipStyle=await run("(()=>{const b=document.querySelector('[data-postseason-help]'),t=document.getElementById(b.getAttribute('aria-describedby'));return {border:getComputedStyle(b).borderBottomWidth,animation:getComputedStyle(t).animationName}})()");
   assert.equal(tipStyle.border,'0px','Score headers have no underline');
   assert.equal(tipStyle.animation,'knockout-tip-in','Score help animates on opening');
   await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
   assert.equal(await run("getComputedStyle(document.getElementById(document.querySelector('[data-postseason-help]').getAttribute('aria-describedby'))).animationName"),'none');
   await cmd('Emulation.setEmulatedMedia',{features:[]});
   await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   assert.equal(await run("document.getElementById(document.querySelector('[data-postseason-help]').getAttribute('aria-describedby')).hidden"),true);
  }
  await run("document.querySelector('[data-dev-control=reset-page]').click()");
  await until("sessionStorage.getItem('football-architect:standings-dev-preview')==='on' && sessionStorage.getItem('football-architect:standings-dev-matchdays')===null && !document.querySelector('[data-dev-control=reset-page]').disabled");
  assert.equal(await run("document.querySelector('[data-dev-control=matchdays-number]').value"),"0");
  assert.equal(await run("document.querySelector('[data-dev-control=season]').value"),"1");
  await run("document.querySelector('[data-dev-control=matchdays-number]').value='10';document.querySelector('[data-dev-control=matchdays-number]').dispatchEvent(new Event('change',{bubbles:true}))");
  await until("sessionStorage.getItem('football-architect:standings-dev-matchdays')==='10' && !document.querySelector('[data-dev-control=matchdays-number]').disabled");

  await run("document.querySelector('[data-dev-control=season]').value='4';document.querySelector('[data-dev-control=season]').dispatchEvent(new Event('change',{bubbles:true}))");
  await until("!document.querySelector('[data-dev-control=season]').disabled");
  // Browsing completed seasons must not change the independent Debug boundary.
  for(const season of [1,2,3,4]){
   await cmd("Page.navigate",{url:origin+"/competitions/it-1?season="+season+"&view=standings"});
   await until("document.readyState==='complete' && !!document.querySelector('.fa-dev-widget-button')");
   await verifySeason(season,season<4?30:10);
  }
  for(const season of [1,2,3,4]){
   const control=season%2?'season-number':'season';
   await run("document.querySelector('[data-dev-control="+control+"]').value='"+season+"';document.querySelector('[data-dev-control="+control+"]').dispatchEvent(new Event('change',{bubbles:true}))");
   await verifySeason(1,season===1?10:30);
   assert.equal(await run("window.faCompetitionRoute.get().season"),'1','Raising Debug preserves a valid viewed season');
  }
  await run("document.getElementById('app-competition-season').click()");
  await run("document.querySelector('#app-competition-season-menu [data-menu-value=\"2\"]').click()");
  await until("new URL(location.href).searchParams.get('season')==='2'");
  await verifySeason(2,30);
  await run("document.getElementById('app-competition-season').click()");
  await run("document.querySelector('#app-competition-season-menu [data-menu-value=\"4\"]').click()");
  await until("new URL(location.href).searchParams.get('season')==='4'");
  await verifySeason(4,10);

  // A direct navigation/refresh must preserve the fictional state on the same origin.
  await cmd("Page.navigate",{url:origin+"/competitions/it-1?season=1&view=fixtures&matchday=5"});
  await until("document.readyState==='complete' && sessionStorage.getItem('football-architect:standings-dev-preview')==='on' && document.querySelectorAll('#app-fixtures-list .app-fixture-match').length===8");
  assert.equal(await run("document.querySelectorAll('#app-fixtures-list .app-fixture-goals').length"),16);

  // Responsive widget acceptance is exercised at both agreed mobile widths.
  for(const width of [390,320]){
   await cmd("Emulation.setDeviceMetricsOverride",{width,height:844,deviceScaleFactor:2,mobile:true});
   await until("window.innerWidth==="+width+" && !!document.querySelector('.fa-dev-widget-button')");
   await run("document.querySelector('.fa-dev-widget-button').click()");
   await until("!document.querySelector('.fa-dev-widget-panel').hidden");
   const bounds=await run("({left:document.querySelector('.fa-dev-widget-panel').getBoundingClientRect().left,right:document.querySelector('.fa-dev-widget-panel').getBoundingClientRect().right,width:document.querySelector('.fa-dev-widget-panel').getBoundingClientRect().width,viewport:window.innerWidth,mobile:matchMedia('(max-width:600px)').matches})");
   assert.equal(bounds.mobile,true,"Mobile breakpoint at "+width);
   assert.ok(bounds.width>0&&bounds.left>=-1&&bounds.right<=bounds.viewport+1,"Debug panel fits "+width+"px");
   await run("document.querySelector('.fa-dev-widget-close').click()");
   await until("document.querySelector('.fa-dev-widget-panel').hidden");
  }
  await cmd("Emulation.clearDeviceMetricsOverride");

  // The competitions index exposes the same persistent progress controls.
  await cmd("Page.navigate",{url:origin+"/competitions"});
  await until("!!document.querySelector('[data-dev-control=season]')");
  assert.equal(await run("document.querySelector('[data-dev-control=season]').value"),'4');
  await run("document.querySelector('[data-dev-control=season]').value='2';document.querySelector('[data-dev-control=season]').dispatchEvent(new Event('change',{bubbles:true}))");
  await until("!document.querySelector('[data-dev-control=season]').disabled");
  await run("document.querySelector('[data-dev-control=matchdays-number]').value='13';document.querySelector('[data-dev-control=matchdays-number]').dispatchEvent(new Event('change',{bubbles:true}))");
  await until("!document.querySelector('[data-dev-control=matchdays-number]').disabled");
  assert.equal(await run("location.pathname"),'/competitions');
  assert.equal(await run("[...document.querySelectorAll('a.app-division-card')].length===16 && [...document.querySelectorAll('a.app-division-card')].every(a=>new URL(a.href).searchParams.get('season')==='2')"),true,'All competition cards follow Debug progress');
  await run("document.querySelector('a.app-division-card').click()");
  await until("!!document.querySelector('[data-dev-control=season]') && window.faCompetitionRoute?.get().season==='2'");
  await verifySeason(2,13);

  await cmd("Page.navigate",{url:origin+"/competitions/it-1?season=1&view=standings"});
  await until("!!document.querySelector('[data-dev-control=season]')");
  for(const [season,days] of [[1,30],[2,13],[1,30]]){
   await run("document.getElementById('app-competition-season').click();document.querySelector('#app-competition-season-menu [data-menu-value=\""+season+"\"]').click()");
   await verifySeason(season,days);
   assert.equal(await run("document.querySelector('[data-dev-control=season]').value"),'2');
   assert.equal(await run("document.querySelector('[data-dev-control=matchdays-number]').value"),'13');
  }
  await run("document.querySelector('[data-dev-control=season]').value='4';document.querySelector('[data-dev-control=season]').dispatchEvent(new Event('change',{bubbles:true}))");
  await until("!document.querySelector('[data-dev-control=season]').disabled");
  await run("window.faCompetitionRoute.set({season:'3',view:'stats'})");
  await run("document.querySelector('[data-dev-control=season]').value='3';document.querySelector('[data-dev-control=season]').dispatchEvent(new Event('change',{bubbles:true}))");
  await until("!document.querySelector('[data-dev-control=season]').disabled");
  assert.deepEqual(await run("[...document.querySelectorAll('#app-competition-season-menu [data-menu-value]')].map(n=>n.dataset.menuValue)"),['3','2','1']);
  await run("document.querySelector('[data-dev-control=season]').value='2';document.querySelector('[data-dev-control=season]').dispatchEvent(new Event('change',{bubbles:true}))");
  await until("!document.querySelector('[data-dev-control=season]').disabled && window.faCompetitionRoute.get().season==='2'");
  assert.equal(await run("window.faCompetitionRoute.get().view"),'stats');
  assert.deepEqual(await run("[...document.querySelectorAll('#app-competition-season-menu [data-menu-value]')].map(n=>n.dataset.menuValue)"),['2','1']);
  await cmd("Page.reload",{ignoreCache:true});
  await until("!!document.querySelector('[data-dev-control=season]') && window.faCompetitionRoute.get().season==='2'");
  assert.deepEqual(await run("[...document.querySelectorAll('#app-competition-season-menu [data-menu-value]')].map(n=>n.dataset.menuValue)"),['2','1']);
  await run("document.querySelector('[data-dev-control=season]').value='4';document.querySelector('[data-dev-control=season]').dispatchEvent(new Event('change',{bubbles:true}))");
  await until("!document.querySelector('[data-dev-control=season]').disabled");
  // The DEV state should also survive changing to another public division.
  await cmd("Page.navigate",{url:origin+"/competitions/nl-1?season=4&view=standings"});
  await until("document.readyState==='complete' && sessionStorage.getItem('football-architect:standings-dev-preview')==='on' && document.querySelectorAll('#app-standings-body .app-world-form-dot').length===80");
  assert.equal(await run("document.querySelectorAll('#app-standings-body tr').length"),16);
  await run("document.querySelector('[data-dev-control=\"reset-global\"]').click()");
  await until("sessionStorage.getItem('football-architect:standings-dev-preview')==='on' && sessionStorage.getItem('football-architect:standings-dev-matchdays')===null && document.querySelector('[data-dev-control=season]').value==='1' && new URL(location.href).searchParams.get('season')==='1'");
  await run("document.getElementById('competition-tab-fixtures').click()");
  await until("!document.getElementById('app-fixtures-toolbar').hidden && document.querySelectorAll('#app-fixtures-list .app-fixture-match').length===8 && document.querySelectorAll('#app-fixtures-list .app-fixture-goals').length===0");

  const status=await run("({scriptCount:performance.getEntriesByType('resource').filter(x=>x.name.includes('/__fa_dev__/')).length})");
  assert.ok(status.scriptCount>=5,"Debug module assets should load on the second division");
  assert.deepEqual(errors,[],"Browser errors across every document and navigation");
  assert.deepEqual(refused,[],"No missing/unapproved artifact requests");
  assert.deepEqual(sockets,[],"No WebSocket or WebTransport connections");
  assert.deepEqual(streams,[],"No EventSource messages");
  assert.ok(requests.length>0,"CDP should observe browser network traffic");
  for(const req of requests){
   if(/^https?:/.test(req.url)){
    assert.equal(new URL(req.url).origin,origin,"No third-party traffic");
    assert.equal(req.method,"GET","No browser network writes");
   }else{
    assert.ok(req.url.startsWith("data:")||req.url==="about:blank","Unexpected request scheme");
   }
  }
 }finally{
  try{socket?.close()}catch{}
  if(proc){
   // Await process/pipe closure instead of racing profile writes with a fixed delay.
   const forceKill=setTimeout(()=>proc.kill("SIGKILL"),5000);
   try{proc.kill();await chromeClosed}finally{clearTimeout(forceKill)}
  }
  if(server.listening)await stopServer(server);
  rmSync(temp,{recursive:true,force:true,maxRetries:5,retryDelay:100});
 }
});
