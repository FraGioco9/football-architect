import { publicRequestFile } from "../tools/publication-guard.mjs";
// UI-THEME #96: true headless Chrome render QA, isolated loopback server; no npm.
import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdtemp,rm} from "node:fs/promises";
import {spawn,spawnSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join,resolve,extname,sep} from "node:path";
import {fileURLToPath} from "node:url";
import {once} from "node:events";
import {createPreviewStandings} from "../tools/dev-standings-preview-data.mjs";
import {createPreviewServer} from "../tools/dev-standings-preview.mjs";
import {setTimeout as delay} from "node:timers/promises";
const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const mime={".html":"text/html",".css":"text/css",".js":"application/javascript",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".webp":"image/webp",".ico":"image/x-icon"};
const server=createServer(async(req,res)=>{
  try{
    const route=new URL(req.url,"http://localhost").pathname;
    let file=resolve(root,publicRequestFile(decodeURIComponent(route)));
    if(file!==root&&!file.startsWith(root+sep))throw Error("outside root");
    if(!extname(file))file=join(file,"index.html");
    res.writeHead(200,{"Content-Type":mime[extname(file)]||"application/octet-stream","Cache-Control":"no-store"});
    res.end(await readFile(file));
  }catch{res.writeHead(404);res.end("Not found");}
});
const devRouter=createPreviewServer();
let devManifestDelay=0,devFixturesDelay=0,devLegacyGuard=false;
const devServer=createServer((req,res)=>{
 req.headers.host="127.0.0.1:2000";
 if(devLegacyGuard){
  const end=res.end.bind(res);
  res.end=(body,...args)=>{
   if(body&&body.toString().slice(0,200).toLowerCase().includes('<!doctype html'))body=Buffer.from(body.toString().replace(/<style>html\[data-fa-(?:dev-standings|debug)-pending[\s\S]*?<\/style>/g,''));
   return end(body,...args);
  };
 }
 const pause=req.url.includes("manifest.json")?devManifestDelay:req.url.startsWith("/assets/competition-fixtures.js")?devFixturesDelay:0;
 if(pause)setTimeout(()=>devRouter.emit("request",req,res),pause);
 else devRouter.emit("request",req,res);
});
const chrome=()=>{
  const windows=process.platform==="win32"?[
    process.env.ProgramFiles&&join(process.env.ProgramFiles,"Google","Chrome","Application","chrome.exe"),
    process.env["PROGRAMFILES(X86)"]&&join(process.env["PROGRAMFILES(X86)"],"Google","Chrome","Application","chrome.exe"),
    process.env.LOCALAPPDATA&&join(process.env.LOCALAPPDATA,"Google","Chrome","Application","chrome.exe")
  ]:[];
  for(const binary of [process.env.CHROME_BIN,...windows,"google-chrome","google-chrome-stable","chromium","chromium-browser"].filter(Boolean))
    if(spawnSync(binary,["--version"],{timeout:4000,stdio:"ignore"}).status===0)return binary;
  throw Error("Chrome is required for visual QA; set CHROME_BIN to its executable path");
};
const ratio=(a,b)=>{
  const parse=x=>{
    const m=x.match(/rgba?\((\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/);
    if(m)return m.slice(1,4).map(Number);
    const h=x.match(/^#([0-9a-f]{6})$/i)?.[1];
    if(h)return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
    throw Error("Unexpected color "+x);
  };
  const light=x=>parse(x).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const x=light(a),y=light(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
};
test("UI-THEME Chrome render matrix 1440/390/320 Dark/Light (no deploy)",{timeout:180000},async()=>{
  // Detect Chrome before opening the server, so missing Chrome cannot leave Node hanging.
  const browser=chrome();
  server.listen(0,"127.0.0.1");await once(server,"listening");
  const origin="http://127.0.0.1:"+server.address().port;
  devServer.listen(0,"127.0.0.1");await once(devServer,"listening");
  const devOrigin="http://127.0.0.1:"+devServer.address().port;
  const dir=await mkdtemp(join(tmpdir(),"fa-theme-browser-"));
  const proc=spawn(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
    "--no-proxy-server","--disable-background-networking","--disable-extensions","--disable-sync",
    "--no-first-run","--no-default-browser-check","--remote-debugging-port=0",
    "--user-data-dir="+dir,"about:blank"],{stdio:["ignore","ignore","pipe"]});
  let stderr="";proc.stderr.on("data",x=>stderr+=x.toString());
  let socket;let screenshots=0;
  try{
    let endpoint;
    for(let i=0;i<120&&!endpoint;i++){
      endpoint=stderr.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];
      if(proc.exitCode!==null)throw Error("Chrome exited: "+stderr.slice(-900));
      if(!endpoint)await delay(100);
    }
    assert.ok(endpoint,"Chrome DevTools must start: "+stderr.slice(-900));
    const host=new URL(endpoint).host;let tab;
    for(let i=0;i<40&&!tab;i++){
      try{tab=(await (await fetch("http://"+host+"/json/list")).json()).find(x=>x.type==="page");}catch{}
      if(!tab)await delay(100);
    }
    assert.ok(tab?.webSocketDebuggerUrl);
    socket=new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((ok,fail)=>{socket.addEventListener("open",ok,{once:true});socket.addEventListener("error",fail,{once:true});});
    let seq=0;const pending=new Map();
    socket.addEventListener("message",e=>{
      const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;
      clearTimeout(p.timer);pending.delete(m.id);m.error?p.fail(Error(m.error.message)):p.ok(m.result);
    });
    const cmd=(method,params={})=>new Promise((ok,fail)=>{
      const id=++seq,timer=setTimeout(()=>{pending.delete(id);fail(Error("CDP timeout "+method));},15000);
      pending.set(id,{ok,fail,timer});socket.send(JSON.stringify({id,method,params}));
    });
    await cmd("Page.addScriptToEvaluateOnNewDocument",{source:`window.__faRuntimeErrors=[];window.addEventListener('error',e=>window.__faRuntimeErrors.push(String(e.message||e.error||'window error')));window.addEventListener('unhandledrejection',e=>window.__faRuntimeErrors.push(String(e.reason?.stack||e.reason||'unhandled rejection')));`});
    const run=async expression=>{
      const out=await cmd("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
      if(out.exceptionDetails)throw Error(out.exceptionDetails.exception?.description||out.exceptionDetails.text);
      return out.result.value;
    };
    const wait=async expr=>{
      for(let i=0;i<100;i++){try{if(await run(expr))return;}catch{}await delay(100);}
      let diagnostic="unavailable";
      try{diagnostic=JSON.stringify(await run(`(()=>({url:location.href,readyState:document.readyState,route:window.faCompetitionRoute?.get?.()||null,preview:sessionStorage.getItem('football-architect:standings-dev-preview'),pending:document.documentElement.dataset.faDevStandingsPending||null,fixturesApi:typeof window.faFixtures,prepare:typeof window.faFixtures?.prepare,fixtureRows:[...document.querySelectorAll('[data-fixture-match]')].map(n=>({id:n.dataset.fixtureMatch,score:n.querySelector('.app-fixture-score')?.textContent||null})),empty:(()=>{const e=document.getElementById('app-fixtures-empty');return e?{hidden:e.hidden,display:getComputedStyle(e).display,visibility:getComputedStyle(e).visibility,text:e.textContent}:null})(),errors:window.__faRuntimeErrors||[]}))()`));}catch(error){diagnostic=String(error)}
      throw Error("Timed out: "+expr+"; browser state: "+diagnostic);
    };
    const visit=async(route,condition="true")=>{
      const url=origin+route;await cmd("Page.navigate",{url});
      await wait("location.pathname.replace(/\\/$/,\"\")==="+JSON.stringify(new URL(url).pathname.replace(/\/$/, ""))+"&&document.readyState==='complete'&&("+condition+")");
    };
    const snap=async(label,w,h)=>{
      const out=await cmd("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
      const png=Buffer.from(out.data,"base64");
      assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a",label);
      assert.equal(png.readUInt32BE(16),w,label+" width");
      assert.equal(png.readUInt32BE(20),h,label+" height");
      assert.ok(png.length>1200,label+" nonempty screenshot");
      // CI renders selected public-only screenshots for human review through job logs.
      if(["desktop dark settings","desktop light settings","iPhone dark settings","iPhone light standings","mobile light settings",
          "mobile dark search","mobile light tooltip fixture"].includes(label)||label.startsWith("UX-01A ")||label.startsWith("FIXTURES-MOBILE ")||label.startsWith("STANDINGS-MOBILE ")||label.startsWith("TABS-MOBILE ")||label.startsWith("FIXTURES-DESKTOP ")){
        const preview=await cmd("Page.captureScreenshot",{format:"jpeg",quality:35,captureBeyondViewport:false});
        const chunks=preview.data.match(/.{1,4096}/g)||[];
        chunks.forEach((part,i)=>console.log("FA_VISUAL_FRAME|"+label+"|"+i+"|"+chunks.length+"|"+part));
      }
      screenshots++;
    };
    await cmd("Page.enable");await cmd("Runtime.enable");
    const checks=[];
    for(const [name,w,h,mobile] of [["desktop",1440,900,false],["iPhone",390,844,true],["mobile",320,700,true]]){
      await cmd("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile,screenWidth:w,screenHeight:h});
      for(const theme of ["dark","light"]){
        await visit("/app/settings/","!!document.getElementById('theme-"+theme+"')");
        const state=await run("(()=>{document.getElementById('theme-"+theme+"').click();const root=getComputedStyle(document.documentElement),b=document.getElementById('theme-"+theme+"').getBoundingClientRect();return {theme:document.documentElement.dataset.theme,stored:localStorage.getItem('football-architect:theme'),pressed:document.getElementById('theme-"+theme+"').getAttribute('aria-pressed'),fg:root.getPropertyValue('--text').trim(),bg:root.getPropertyValue('--background').trim(),right:b.right,width:innerWidth,scroll:document.documentElement.scrollWidth}})()");
        assert.equal(state.theme,theme);assert.equal(state.stored,theme);assert.equal(state.pressed,"true");
        assert.ok(ratio(state.fg,state.bg)>=4.5,name+" "+theme+" text contrast");
        assert.ok(state.right<=w+1&&state.scroll<=w+1,name+" settings fit");
        await snap(name+" "+theme+" settings",w,h);
        for(const route of ["/","/guide/","/app/dashboard/","/app/competitions/"]){
          await visit(route,"document.documentElement.dataset.theme==='"+theme+"'");
          const page=await run("(()=>{const css=getComputedStyle(document.documentElement);return {theme:document.documentElement.dataset.theme,stored:localStorage.getItem('football-architect:theme'),fg:css.getPropertyValue('--text').trim(),bg:css.getPropertyValue('--background').trim(),scroll:document.documentElement.scrollWidth,logo:document.querySelector('.brand-image-wide, .app-brand-symbol')?.getAttribute('src')}})()");
          assert.equal(page.theme,theme,name+" "+route);assert.equal(page.stored,theme,name+" "+route);
          assert.ok(ratio(page.fg,page.bg)>=4.5,name+" "+route+" contrast");
          assert.ok(page.scroll<=w+1,name+" "+route+" viewport fit");
          assert.ok(page.logo?.endsWith("-"+theme+".svg"),name+" "+route+" logo");
          await snap(name+" "+theme+" "+route,w,h);
        }
        await visit("/app/dashboard/","!!document.getElementById('app-search-trigger')");
        const search=await run("(()=>{document.getElementById('app-search-trigger').click();const d=document.getElementById('app-search-dialog');return {open:d.open,bg:getComputedStyle(d.querySelector('.app-search-panel')).backgroundColor,rect:(()=>{const b=d.getBoundingClientRect();return [b.left,b.right]})()}})()");
        assert.equal(search.open,true,name+" search opens");
        assert.equal(search.bg,theme==="light"?"rgb(255, 255, 255)":"rgb(20, 43, 46)",name+" search colors");
        assert.ok(search.rect[0]>=-1&&search.rect[1]<=w+1,name+" search fits");
        await snap(name+" "+theme+" search",w,h);
        await visit("/app/competitions/it-1/","document.querySelectorAll('#app-standings-body tr').length===16");
        const table=await run("(()=>{const t=document.querySelector('.app-world-standing-table');return {rows:document.querySelectorAll('#app-standings-body tr').length,sticky:getComputedStyle(t.querySelector('tbody tr>*:first-child')).position,head:getComputedStyle(t.querySelector('thead th')).backgroundColor,logo:document.querySelector('.app-brand-symbol')?.getAttribute('src')}})()");
        assert.equal(table.rows,16);assert.equal(table.sticky,"sticky");
        assert.equal(table.head,theme==="light"?"rgb(232, 241, 235)":"rgb(23, 45, 48)");
        assert.ok(table.logo?.endsWith("-"+theme+".svg"),name+" async logo");
        await snap(name+" "+theme+" standings",w,h);
        await wait("!!window.faFixtures");
        await run("document.getElementById('competition-tab-fixtures').click()");
        assert.equal(await run("['round','previous','next'].every(id=>document.getElementById('app-fixtures-'+id).getClientRects().length===0)"),true,"no matchday controls without a schedule");
        const fixtureDivision=JSON.parse(await readFile(join(root,"app/competitions/_shared/manifest.json"),"utf8")).divisions.find(d=>d.id==="IT-1");
        const fixtureModel=createPreviewStandings(fixtureDivision,30).fixtures.map(game=>({...game,kickoff:null,homeGoals:null,awayGoals:null}));
        await run("window.faFixtures.prepare("+JSON.stringify(fixtureModel)+")()");
        assert.equal(await run("['round','previous','next'].every(id=>document.getElementById('app-fixtures-'+id).getClientRects().length>0)"),true,"scheduled rounds restore controls even before matches are played");
        let scoreColumns;
        for(const [homeGoals,awayGoals] of [[0,0],[1,11],[10,2]]){
          const scored=fixtureModel.map(game=>({...game,homeGoals,awayGoals}));
          await run("window.faFixtures.prepare("+JSON.stringify(scored)+")()");
          const columns=await run("(()=>{const s=document.querySelector('.app-fixture-score');return [...s.children].map(e=>{const r=e.getBoundingClientRect();return {center:(r.left+r.right)/2,width:r.width}})})()");
          assert.equal(columns.length,3);
          if(scoreColumns)columns.forEach((c,i)=>{assert.ok(Math.abs(c.center-scoreColumns[i].center)<0.1,"goal and separator centers stay fixed across score values");assert.equal(c.width,scoreColumns[i].width)});
          scoreColumns=columns;
        }
        if(name==='desktop'){
          const stadiumNames=JSON.parse(await readFile(join(root,"app/competitions/_shared/manifest.json"),"utf8")).divisions.flatMap(d=>d.clubs.map(c=>c.stadiumName));
          for(const viewport of [621,1024,1440]){
            await cmd("Emulation.setDeviceMetricsOverride",{width:viewport,height:h,deviceScaleFactor:1,mobile:false,screenWidth:viewport,screenHeight:h});
            const stadiumFit=await run("(()=>{const s=document.querySelector('.app-fixture-stadium'),original=s.textContent;const fit="+JSON.stringify(stadiumNames)+".every(name=>{s.textContent=name;const r=s.getBoundingClientRect(),style=getComputedStyle(s);return s.scrollWidth<=s.clientWidth+1&&r.height<=parseFloat(style.lineHeight)+1});s.textContent=original;return fit})()");
            assert.equal(stadiumFit,true,"all canonical stadium names fit one full desktop line at "+viewport);
          }
          await snap("FIXTURES-DESKTOP "+theme+" stadium width",1440,h);
          await cmd("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile,screenWidth:w,screenHeight:h});
        }
        await run("window.faFixtures.prepare(null)()");
        assert.equal(await run("document.getElementById('app-fixtures-round').getClientRects().length"),0,"removing schedule hides controls again");
        await run("document.getElementById('competition-tab-standings').click()");
        // UX-01B: desktop-only styling, sticky geometry and both themes.
        if(name==="desktop"){
          for(const width of [621,1024,1159,1160,1440]){
            await cmd("Emulation.setDeviceMetricsOverride",
              {width,height:h,deviceScaleFactor:1,mobile:false,screenWidth:width,screenHeight:h});
            await wait("innerWidth==="+width);
            const desktop=await run("(()=>{const t=document.querySelector('.app-world-standing-table'),r=t.tBodies[0].rows[0],c=r.cells,style=e=>getComputedStyle(e),head=style(t.tHead.rows[0].cells[0]),club=style(r.querySelector('.app-world-club-name')),crest=style(r.querySelector('.app-world-club-crest-placeholder')),pts=style(c[9]);const input=document.createElement('button');input.type='button';input.textContent='Focus QA';input.setAttribute('aria-label','Focus QA');c[10].append(input);const before=style(c[0]).backgroundColor,ptsBefore=pts.backgroundColor;input.focus();const focus=style(c[0]).backgroundColor,ptsAfter=style(c[9]).backgroundColor;const focused=document.activeElement===input;input.remove();return {rows:t.tBodies[0].rows.length,cells:c.length,minWidth:style(t).minWidth,headHeight:head.height,cellHeight:style(c[0]).height,pos:style(c[0]).width,clubLeft:style(c[1]).left,sticky:style(c[1]).position,clubMin:style(c[1]).minWidth,clubFont:club.fontSize,clubWeight:club.fontWeight,crestWidth:crest.width,crestHeight:crest.height,numeric:style(c[2]).textAlign,pointsAlign:pts.textAlign,pointsSize:pts.fontSize,pointsWeight:pts.fontWeight,pointsText:c[9].textContent,pointsBg:pts.backgroundColor,formAlign:style(c[10]).textAlign,focusChanged:before!==focus,focusColor:focus,pointsStable:ptsBefore===ptsAfter,focused}})()");
            const wide=width>=1160;
            assert.equal(desktop.rows,16,"UX-01B rows "+width);
            assert.equal(desktop.cells,11,"UX-01B canonical columns "+width);
            assert.equal(desktop.minWidth,wide?"852px":"766px","UX-01B minimum width "+width);
            assert.ok(parseFloat(desktop.headHeight)>=40,"UX-01B heading height "+width);
            assert.ok(parseFloat(desktop.cellHeight)>= (wide?46:44),"UX-01B row height "+width);
            assert.equal(desktop.pos,wide?"44px":"38px","UX-01B position width "+width);
            assert.equal(desktop.clubLeft,wide?"44px":"38px","UX-01B sticky offset "+width);
            assert.equal(desktop.sticky,"sticky","UX-01B club sticky "+width);
            if(wide)assert.equal(desktop.clubMin,"210px","UX-01B club minimum "+width);
            assert.equal(desktop.clubFont,"13px");assert.equal(desktop.clubWeight,"700");
            assert.equal(desktop.crestWidth,"28px");assert.equal(desktop.crestHeight,"30px");
            assert.equal(desktop.numeric,"center");assert.equal(desktop.pointsAlign,"center");
            assert.equal(desktop.pointsSize,"14px");assert.equal(desktop.pointsWeight,"800");
            assert.equal(desktop.formAlign,"center");assert.equal(desktop.pointsText,"—");
            assert.equal(desktop.pointsBg,theme==="light"?"rgb(212, 235, 221)":"rgb(38, 71, 62)");
            assert.ok(desktop.focused&&desktop.focusChanged&&desktop.pointsStable,"UX-01B focus "+width);
          }
          await cmd("Emulation.setDeviceMetricsOverride",
            {width:w,height:h,deviceScaleFactor:1,mobile:false,screenWidth:w,screenHeight:h});
        }
        // UX-01A focused real-Chrome responsive acceptance (theme + native disclosure).
        // Do not confuse the public unknown-statistics state with DEV-only fictional results.
        const qaWidths = name==="iPhone" ? [320,360,390,620,621] : [w];
        for(const width of qaWidths){
          await cmd("Emulation.setDeviceMetricsOverride",
            {width,height:h,deviceScaleFactor:1,mobile,screenWidth:width,screenHeight:h});
          const compactExpected=width<=620;
          await wait("(()=>{if(innerWidth!=="+width+")return false;const c=document.getElementById('app-standings-compact'),f=document.getElementById('app-standings-full');return !!c&&!!f&&c.hidden==="+(!compactExpected)+"&&f.hidden==="+compactExpected+"})()");
          const state=await run("(()=>{const full=document.getElementById('app-standings-full'),compact=document.getElementById('app-standings-compact'),items=[...document.querySelectorAll('#app-standings-compact-list > li')],table=document.querySelector('.app-world-standing-table'),first=items[0]?.querySelector('details'),summary=first?.querySelector('summary'),points=summary?.querySelector('.app-world-mobile-points'),fg=points?getComputedStyle(points):null;return {inner:innerWidth,scroll:document.documentElement.scrollWidth,compact:compact.hidden,full:full.hidden,compactDisplay:getComputedStyle(compact).display,fullDisplay:getComputedStyle(full).display,rows:document.querySelectorAll('#app-standings-body tr').length,clubs:items.length,idsMatch:items.every((li,i)=>li.dataset.worldClub===document.querySelectorAll('#app-standings-body tr')[i]?.dataset.worldClub),cells:table.querySelector('tbody tr').children.length,stats:first?.querySelectorAll('.app-world-mobile-stat').length,form:summary?.querySelectorAll('.app-world-form-dot').length,points:points?.firstChild?.textContent,color:fg?.color,background:fg?.backgroundColor,summaryTag:summary?.tagName,logo:!!document.querySelector('#app-competition-badge')?.shadowRoot?.querySelector('svg')}})()");
          assert.equal(state.inner,width,"responsive viewport "+width);
          assert.ok(state.scroll<=width+1,"no page-wide overflow at "+width+"px "+theme);
          assert.equal(state.rows,16,"canonical public rows "+width);
          assert.equal(state.clubs,16,"compact public rows "+width);
          assert.ok(state.idsMatch,"canonical identity equality "+width);
          assert.equal(state.cells,11,"full table keeps all 11 columns");
          assert.equal(state.stats,8,"eight statistics retained under disclosure");
          assert.equal(state.form,0,"ordinary public standings have no invented recent form");
          assert.equal(state.points,"—","public points remain unknown");
          assert.equal(state.logo,true,"approved IT-1 badge survives shared hydration");
          assert.equal(state.summaryTag,"SUMMARY","native keyboard/touch disclosure");
          assert.equal(state.compact,!compactExpected,"compact visibility at "+width);
          assert.equal(state.full,compactExpected,"full visibility at "+width);
          assert.equal(state.compactDisplay==="none",!compactExpected,"compact computed CSS at "+width);
          assert.equal(state.fullDisplay==="none",compactExpected,"full computed CSS at "+width);
          assert.ok(ratio(state.color,state.background)>=4.5,theme+" compact points contrast "+width);
          if(compactExpected){
            const disclosure=await run("(()=>{const d=document.querySelector('#app-standings-compact-list details'),s=d.querySelector('summary');s.click();const expanded=d.open,shown=getComputedStyle(d.querySelector('.app-world-mobile-panel')).display,stats=d.querySelectorAll('dt, dd').length;s.focus();const focused=document.activeElement===s;s.click();return {expanded,shown,stats,focused,closed:!d.open}})()");
            assert.equal(disclosure.expanded,true,"summary opens at "+width);
            assert.notEqual(disclosure.shown,"none","stats shown at "+width);
            assert.equal(disclosure.stats,16,"eight definition terms and descriptions");
            assert.ok(disclosure.focused,"native summary focus at "+width);
            assert.equal(disclosure.closed,true,"summary closes at "+width);
          }
          if(name==="iPhone"){
            await snap("UX-01A "+theme+" "+width+" standings",width,h);
            console.log("UX01A_BROWSER_QA|"+JSON.stringify({width,theme,rows:state.rows,clubs:state.clubs,cells:state.cells,stats:state.stats,compact:compactExpected,contrast:ratio(state.color,state.background).toFixed(2)}));
          }
        }
        if(name==="iPhone"){
          await cmd("Emulation.setDeviceMetricsOverride",
            {width:w,height:h,deviceScaleFactor:1,mobile,screenWidth:w,screenHeight:h});
          if(w===390){
            for(const [lang,recent,details] of [
              ["en","Recent form","Club statistics"],
              ["de","Letzte Ergebnisse","Vereinsstatistik"],
              ["es","Forma reciente","Estadísticas del club"],
              ["fr","Forme récente","Statistiques du club"],
              ["it","Forma recente","Statistiche del club"]]){
              await run("document.documentElement.lang="+JSON.stringify(lang));
              const selector="'#app-standings-compact-list [data-app-i18n=\"standingsMobileDetails\"]'";
              await wait("document.querySelector("+selector+")?.textContent==="+JSON.stringify(details));
              const local=await run("(()=>{const q=key=>document.querySelector('#app-standings-compact-list [data-app-i18n=\"'+key+'\"]')?.textContent;return {recent:q('standingsMobileRecent'),details:q('standingsMobileDetails')}})()");
              assert.deepEqual(local,{recent,details},"dynamic compact localization "+lang+" "+theme);
            }
            await run("document.documentElement.lang='en'");
          }
        }
        // Normal public standings contain no actual match form: CSS-only diagnostic tooltip fixture.
        const tooltip=await run("(()=>{const t=document.createElement('div');t.className='app-world-form-tooltip';t.style.left=Math.max(12,Math.round((innerWidth-Math.min(350,innerWidth*.8))/2))+'px';t.style.top=Math.round(innerHeight*.38)+'px';t.innerHTML='<div class=\"app-world-form-tooltip-meta\">Matchday 19</div><div class=\"app-world-form-tooltip-scoreline\"><span class=\"app-world-form-tooltip-team\">Sample FC</span><strong class=\"app-world-form-tooltip-score\">2–1</strong><span class=\"app-world-form-tooltip-team\">Example FC</span></div><div class=\"app-world-form-tooltip-context\">Diagnostic match result</div>';document.body.appendChild(t);const s=getComputedStyle(t);return {fg:s.color,bg:s.backgroundColor,width:t.getBoundingClientRect().width}})()");
        assert.ok(tooltip.width>0);assert.ok(ratio(tooltip.fg,tooltip.bg)>=4.5);
        assert.equal(tooltip.bg,theme==="light"?"rgb(255, 255, 255)":"rgb(20, 43, 46)");
        await delay(240); // Wait for the documented 170ms entrance animation before capturing.
        await snap(name+" "+theme+" tooltip fixture",w,h);
        // SCROLLBAR-GUTTER-01: stable reservation on the actual vertical scroll container.
        const standardRoutes=["/","/guide/","/app/dashboard/","/app/calendar/",
          "/app/settings/","/app/competitions/","/app/competitions/it-1/"];
        const allDivisionRoutes=JSON.parse(await readFile(join(root,"app/competitions/_shared/manifest.json"),"utf8"))
          .divisions.map(d=>"/app/competitions/"+d.id.toLowerCase()+"/");
        const gutterRoutes=name==="desktop"&&theme==="dark"
          ? [...standardRoutes,...allDivisionRoutes.filter(route=>!standardRoutes.includes(route))]
          : standardRoutes;
        for(const route of gutterRoutes){
          const detail=route.startsWith("/app/competitions/")&&route!=="/app/competitions/";
          await visit(route,detail?"document.querySelectorAll('#app-standings-body tr').length===16":"true");
          const gutter=await run("(()=>{const scroll=document.querySelector('.fa-shell-content-scroll'),root=scroll||document.documentElement,measure=()=>scroll?scroll.clientWidth:document.body.getBoundingClientRect().width,oldWidth=measure(),probe=document.createElement('div');probe.style.cssText='height:2400px;flex:0 0 2400px;visibility:hidden';(scroll||document.body).appendChild(probe);const width=measure(),overflow=root.scrollHeight>root.clientHeight,mode=getComputedStyle(root).scrollbarGutter;probe.remove();return {mode,oldWidth,width,overflow,pageWidth:document.documentElement.scrollWidth,viewport:innerWidth}})()");
          assert.equal(gutter.mode,"stable","SCROLLBAR-GUTTER-01 "+route+" "+name+"/"+theme);
          assert.equal(gutter.width,gutter.oldWidth,"no horizontal shift "+route+" "+name+"/"+theme);
          assert.ok(gutter.overflow,"vertical probe scrolls "+route+" "+name+"/"+theme);
          assert.ok(gutter.pageWidth<=gutter.viewport+1,"no horizontal overflow "+route+" "+name+"/"+theme);
        }
        checks.push(name+"/"+theme);
      }
    }
    // DIV-ASSET-07: artwork must render from the HTML with all page scripts disabled.
    // Declarative shadow DOM prevents the original .s0/.s1 rules crossing logo boundaries.
    const divisions=JSON.parse(await readFile(join(root,"data/divisions.json"),"utf8"));
    await cmd("Emulation.setScriptExecutionDisabled",{value:true});
    for(const theme of ["dark","light"]){
      for(const route of ["/app/competitions/",...divisions.map(d=>"/app/competitions/"+d.id.toLowerCase()+"/")]){
        const index=route==="/app/competitions/";
        await visit(route,"true");
        await run("document.documentElement.dataset.theme='"+theme+"'");
        const logos=await run("(()=>{const attack=document.createElement('style');attack.textContent='.s0,.s1{fill:magenta!important}';document.head.append(attack);return [...document.querySelectorAll('[data-division-variant]')].map(host=>{const svg=host.shadowRoot?.querySelector('svg'),rect=svg?.getBoundingClientRect(),box=svg?.viewBox.baseVal;return {variant:host.dataset.divisionVariant,hidden:host.getAttribute('aria-hidden'),viewBox:svg?.getAttribute('viewBox'),ratio:box?box.width/box.height:null,scaleX:svg?.getScreenCTM().a,scaleY:svg?.getScreenCTM().d,align:svg?.preserveAspectRatio.baseVal.align,meet:svg?.preserveAspectRatio.baseVal.meetOrSlice,width:rect?.width,height:rect?.height,hostWidth:host.getBoundingClientRect().width,hostHeight:host.getBoundingClientRect().height,paint:[...new Set([...svg.querySelectorAll('path')].map(p=>getComputedStyle(p).fill))],background:getComputedStyle(host).backgroundColor,border:getComputedStyle(host).borderWidth,requests:performance.getEntriesByType('resource').filter(r=>/assets\\/divisions\\//.test(r.name)).length}})})()");
        assert.equal(logos.length,index?16:1,route+" initial logo count");
        const selected=index?["IT","ENG","ES","DE","FR","PT","NL","BR"].flatMap(c=>divisions.filter(d=>d.countryId===c)):divisions.filter(d=>route.includes('/'+d.id.toLowerCase()+'/'));
        for(let i=0;i<logos.length;i++){
          const logo=logos[i],d=selected[i];
          assert.equal(logo.variant,"compact");
          assert.equal(logo.hidden,"true");
          assert.ok(logo.width>0&&logo.height>0&&logo.ratio>0);
          assert.ok(logo.width<=logo.hostWidth+0.1&&logo.height<=logo.hostHeight+0.1,"SVG viewport fits reserved frame");
          assert.ok(Math.abs(logo.scaleX-logo.scaleY)<1e-9,"uniform artwork scaling");
          assert.equal(logo.align,6,"xMidYMid");
          assert.equal(logo.meet,1,"meet: no cropping");
          assert.equal(logo.background,"rgba(0, 0, 0, 0)");
          assert.equal(logo.border,"0px");
          assert.equal(logo.requests,0,"no logo resource fetches");
          const rgb=hex=>"rgb("+[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16)).join(", ")+")";
          const colors=[d.primaryHex,d.secondaryHex,d.ivoryHex].map(rgb);
          for(const paint of logo.paint)assert.ok(colors.includes(paint),d.id+" original CSS is isolated: "+paint);
        }
        await snap("DIV-ASSET-07 "+theme+" "+route,320,700);
      }
    }
    await cmd("Emulation.setScriptExecutionDisabled",{value:false});
    // Exercise the real DEV runtime across season changes, without a refresh.
    const division=JSON.parse(await readFile(join(root,"app/competitions/_shared/manifest.json"),"utf8")).divisions.find(d=>d.id==="IT-1");
    const signature="JSON.stringify([...document.querySelectorAll('[data-fixture-match]')].map(n=>[n.dataset.fixtureMatch,n.querySelector('.app-fixture-score').textContent]))";
    const expected=(season,round,days=7)=>JSON.stringify(createPreviewStandings(division,30,season).fixtures
      .filter(g=>g.round===round).sort((a,b)=>a.homeId-b.homeId||a.awayId-b.awayId)
      .map(g=>[g.round+":"+g.homeId+":"+g.awayId,g.round<=days?g.homeGoals+" – "+g.awayGoals:"—"]));
    const expectSeason=async(season,round)=>{
      await wait("window.faCompetitionRoute?.get().season==="+JSON.stringify(String(season))+"&&"+signature+"==="+JSON.stringify(expected(season,round)));
      assert.equal(await run(signature),expected(season,round),"Fixtures match the selected season "+season+" round "+round);
    };
    const chooseSeason=async season=>{
      await run("document.getElementById('app-competition-season').click();document.querySelector('#app-competition-season-menu [data-menu-value=\""+season+"\"]').click()");
    };
    await cmd("Page.navigate",{url:devOrigin+"/"});
    await wait("document.readyState==='complete'&&location.origin==="+JSON.stringify(devOrigin));
    await run("sessionStorage.setItem('football-architect:standings-dev-preview','on');sessionStorage.setItem('football-architect:standings-dev-matchdays','7')");
    await cmd("Page.navigate",{url:devOrigin+"/app/competitions/it-1?season=1&view=fixtures&matchday=1"});
    await expectSeason(1,1);
    for(const season of [2,1,2]){await chooseSeason(season);await expectSeason(season,1);}
    devManifestDelay=150;
    await chooseSeason(1);await chooseSeason(2);await chooseSeason(1);
    await expectSeason(1,1);
    await delay(600);assert.equal(await run(signature),expected(1,1),"delayed season work cannot overwrite the final selection");
    devManifestDelay=0;
    await cmd("Page.reload",{ignoreCache:true});await expectSeason(1,1);
    devFixturesDelay=500;
    await cmd("Page.navigate",{url:devOrigin+"/app/competitions/it-1?season=2&view=fixtures&matchday=1"});
    await expectSeason(2,1);
    devFixturesDelay=0;
    // Observe every rendered frame when season 2 auto-enables DEV after refresh.
    const observer=await cmd("Page.addScriptToEvaluateOnNewDocument",{source:`
      window.__faEmptyFrames=[];window.__faObserveEmpty=true;
      const sample=()=>{
        const empty=document.getElementById('app-fixtures-empty');
        if(empty&&!empty.hidden&&empty.getClientRects().length&&getComputedStyle(empty).visibility==='visible')window.__faEmptyFrames.push(location.search);
        if(window.__faObserveEmpty)requestAnimationFrame(sample);
      };requestAnimationFrame(sample);
    `});
    // Keep DEV enabled across the navigation so this specifically tests restoration
    // during delayed manifest/Fixtures hydration, rather than expecting a removed
    // session flag to enable fictional standings by itself.
    await run("sessionStorage.setItem('football-architect:standings-dev-preview','on')");
    devManifestDelay=250;devFixturesDelay=500;devLegacyGuard=true;
    await cmd("Page.navigate",{url:devOrigin+"/app/competitions/it-1?season=2&view=fixtures&matchday=1"});
    await expectSeason(2,1);
    await run("window.__faObserveEmpty=false");
    assert.deepEqual(await run("window.__faEmptyFrames"),[],"no empty Fixtures frame while DEV season 2 is restoring");
    await cmd("Page.removeScriptToEvaluateOnNewDocument",{identifier:observer.identifier});
    devManifestDelay=0;devFixturesDelay=0;devLegacyGuard=false;
    // Public season 1 still exposes its honest empty state once DEV is OFF.
    await run("sessionStorage.removeItem('football-architect:standings-dev-preview')");
    await cmd("Page.navigate",{url:devOrigin+"/app/competitions/it-1?season=1&view=fixtures&matchday=1"});
    await wait("!!window.faFixtures&&!document.documentElement.dataset.faDevStandingsPending");
    assert.equal(await run("(()=>{const e=document.getElementById('app-fixtures-empty');return !e.hidden&&e.getClientRects().length>0&&getComputedStyle(e).visibility==='visible'})()"),true,"DEV OFF reveals the legitimate empty state");
    // Mobile Fixtures QA uses CDP touch input rather than programmatic .click().
    const tap=async selector=>{
      const point=await run("(()=>{const e=document.querySelector("+JSON.stringify(selector)+");if(!e)throw Error('Missing touch target');e.scrollIntoView({block:'center',inline:'nearest'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()");
      assert.ok(point.x>=0&&point.x<await run("innerWidth")&&point.y>=0&&point.y<await run("innerHeight"),selector+" touch target fits viewport");
      await cmd("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:point.x,y:point.y,radiusX:1,radiusY:1,force:1}]});
      await cmd("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    };
    const menuFits=async id=>{
      const box=await run("(()=>{const e=document.getElementById("+JSON.stringify(id)+"),r=e.getBoundingClientRect();return {open:!e.hidden,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight}})()");
      assert.equal(box.open,true,id+" opened by touch");
      assert.ok(box.left>=0&&box.right<=box.width&&box.top>=0&&box.bottom<=box.height,id+" remains inside mobile viewport");
    };
    for(const [width,height] of [[390,844],[320,700]])for(const theme of ["dark","light"]){
      await cmd("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:height});
      await cmd("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:1});
      await run("localStorage.setItem('football-architect:theme',"+JSON.stringify(theme)+");sessionStorage.setItem('football-architect:standings-dev-preview','on');sessionStorage.setItem('football-architect:standings-dev-matchdays','7')");
      await cmd("Page.navigate",{url:devOrigin+"/app/competitions/it-1?season=1&view=standings"});
      await wait("!!window.faFixtures&&!document.documentElement.dataset.faDevStandingsPending");
      assert.equal(await run("document.documentElement.dataset.theme"),theme);
      const tabState=()=>run("(()=>{const t=document.querySelector('.app-competition-tabs'),b=t.getBoundingClientRect(),a=t.querySelector('[aria-selected=true]').getBoundingClientRect(),third=t.children[2].getBoundingClientRect(),style=getComputedStyle(t);return {left:t.dataset.canScrollLeft,right:t.dataset.canScrollRight,selected:a.left>=b.left-1&&a.right<=b.right+1,peek:third.left<b.right-16&&third.right>b.right,width:t.clientWidth,tabWidth:t.children[0].getBoundingClientRect().width,mask:style.maskImage||style.webkitMaskImage,scroll:t.scrollLeft,page:document.documentElement.scrollWidth,viewport:innerWidth}})()");
      let tabGeometry=await tabState();
      assert.equal(tabGeometry.left,'false');assert.equal(tabGeometry.right,'true');assert.equal(tabGeometry.peek,true,'a readable slice of the next view invites scrolling');assert.equal(tabGeometry.selected,true);assert.notEqual(tabGeometry.mask,'none');assert.ok(tabGeometry.page<=tabGeometry.viewport);
      await snap("TABS-MOBILE "+width+" "+theme+" start",width,height);
      await run("document.querySelector('.app-competition-tabs').scrollLeft=120");
      await wait("document.querySelector('.app-competition-tabs').dataset.canScrollLeft==='true'");
      tabGeometry=await tabState();assert.equal(tabGeometry.right,'true','both edges indicate more views in the middle');
      await snap("TABS-MOBILE "+width+" "+theme+" middle",width,height);
      await run("window.faCompetitionRoute.set({view:'awards'})");
      tabGeometry=await tabState();assert.equal(tabGeometry.left,'true');assert.equal(tabGeometry.right,'false');assert.equal(tabGeometry.selected,true,'last view is fully visible and has no right fade');
      await snap("TABS-MOBILE "+width+" "+theme+" end",width,height);
      await run("window.faCompetitionRoute.set({view:'standings'})");
      tabGeometry=await tabState();assert.equal(tabGeometry.selected,true);assert.equal(tabGeometry.left,'false');
      const expectedStadiums=createPreviewStandings(division,7,1).rows.map(row=>({homeId:row.recent[0].homeId,stadium:division.clubs.find(c=>c.clubId===row.recent[0].homeId).stadiumName}));
      for(const index of [0,1]){
        await tap('#app-standings-compact-list > li:nth-child('+(index+1)+') .app-world-form-dot');
        await wait("(()=>{const t=document.getElementById('fa-dev-form-tooltip');return !t.hidden&&getComputedStyle(t).opacity==='1'})()");
        const details=await run("(()=>{const t=document.getElementById('fa-dev-form-tooltip'),r=t.getBoundingClientRect();return {date:t.querySelector('.app-world-form-tooltip-date')?.textContent,stadium:t.querySelector('.app-world-form-tooltip-stadium')?.textContent,fit:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,overflow:t.scrollWidth>t.clientWidth}})()");
        assert.equal(details.date,'Date TBD');assert.equal(details.stadium,expectedStadiums[index].stadium,'tooltip always names the home stadium');assert.equal(details.fit,true);assert.equal(details.overflow,false);
        if(index===0)await snap("STANDINGS-MOBILE "+width+" "+theme+" date and stadium",width,height);
      }
      await tap('#competition-tab-fixtures');await expectSeason(1,8);
      const centeredControls=await run("(()=>{const n=document.querySelector('.app-fixtures-navigation').getBoundingClientRect(),p=document.getElementById('competition-panel-fixtures').getBoundingClientRect(),b=document.getElementById('app-fixtures-round').getBoundingClientRect();return {center:(n.left+n.right)/2,panel:(p.left+p.right)/2,width:n.width,height:b.height,arrow:document.getElementById('app-fixtures-next').getBoundingClientRect().width}})()");
      assert.ok(centeredControls.height<=32&&centeredControls.arrow<=32,'compact mobile matchday controls');
      assert.ok(Math.abs(centeredControls.center-centeredControls.panel)<1,'matchday navigation is centered');
      await tap('#app-fixtures-round');await wait("!document.getElementById('app-fixtures-picker').hidden");await menuFits('app-fixtures-picker');
      const pickerGeometry=await run("(()=>{const menu=document.getElementById('app-fixtures-picker'),m=menu.getBoundingClientRect(),trigger=document.getElementById('app-fixtures-round').getBoundingClientRect(),option=menu.querySelector('[role=option]'),r=option.getBoundingClientRect();let overlap=0;const above=[...document.querySelectorAll('[data-fixture-match]')].every(e=>{const b=e.getBoundingClientRect(),l=Math.max(m.left,b.left),t=Math.max(m.top,b.top),right=Math.min(m.right,b.right),bottom=Math.min(m.bottom,b.bottom);if(right<=l||bottom<=t)return true;overlap++;return menu.contains(document.elementFromPoint((l+right)/2,(t+bottom)/2))});return {menuWidth:m.width,triggerWidth:trigger.width,optionHeight:r.height,optionFont:parseFloat(getComputedStyle(option).fontSize),triggerFont:parseFloat(getComputedStyle(document.getElementById('app-fixtures-round')).fontSize),above,overlap}})()");
      assert.ok(Math.abs(pickerGeometry.menuWidth-pickerGeometry.triggerWidth)<1,'matchday menu matches trigger width');
      assert.ok(pickerGeometry.optionHeight<=32&&pickerGeometry.optionFont===pickerGeometry.triggerFont,'matchday options match the compact trigger dimensions');
      assert.ok(pickerGeometry.overlap>0&&pickerGeometry.above,'matchday menu paints above overlapping match cards');
      await snap("FIXTURES-MOBILE "+width+" "+theme+" matchday menu",width,height);
      await tap('#app-fixtures-round-option-1');await expectSeason(1,1);
      const currentLayout=await run("(()=>{const n=document.querySelector('.app-fixtures-navigation').getBoundingClientRect(),p=document.getElementById('competition-panel-fixtures').getBoundingClientRect(),c=document.getElementById('app-fixtures-current').getBoundingClientRect();return {center:(n.left+n.right)/2,right:p.right,currentRight:c.right,top:n.top,currentTop:c.top}})()");
      assert.ok(Math.abs(currentLayout.center-centeredControls.center)<1,'showing current-matchday button never shifts navigation');
      assert.ok(Math.abs(currentLayout.currentRight-currentLayout.right)<1&&Math.abs(currentLayout.currentTop-currentLayout.top)<1,'current-matchday button stays top right on the same row');
      assert.equal(await run("document.getElementById('app-fixtures-picker').hidden"),true);
      await tap('#app-fixtures-round');await tap('#app-fixtures-previous');
      await wait("document.getElementById('app-fixtures-picker').hidden");await expectSeason(1,1);
      await tap('#app-fixtures-next');await expectSeason(1,2);
      await tap('#app-fixtures-previous');await expectSeason(1,1);
      for(const season of [2,1]){
        await tap('#app-competition-season');await wait("!document.getElementById('app-competition-season-menu').hidden");await menuFits('app-competition-season-menu');
        const stacking=await run("(()=>{const menu=document.getElementById('app-competition-season-menu'),m=menu.getBoundingClientRect(),controls=[...document.querySelectorAll('.app-fixtures-navigation button')];let overlaps=0;const above=controls.every(e=>{const r=e.getBoundingClientRect(),l=Math.max(m.left,r.left),t=Math.max(m.top,r.top),right=Math.min(m.right,r.right),bottom=Math.min(m.bottom,r.bottom);if(right<=l||bottom<=t)return true;overlaps++;return menu.contains(document.elementFromPoint((l+right)/2,(t+bottom)/2))});return {above,overlaps}})()");
        assert.equal(stacking.above,true,'season menu paints above overlapping matchday controls');
        if(season===2){
          console.log("SEASON_MENU_STACK|"+width+"|"+theme+"|overlapping controls="+stacking.overlaps);
          await snap("FIXTURES-MOBILE "+width+" "+theme+" season menu",width,height);
        }
        await tap('#app-competition-season-option-'+season);await expectSeason(season,1);
      }
      for(const lang of ['en','it','de','es','fr']){
        await run("document.documentElement.lang="+JSON.stringify(lang)+";window.faAppRenderLanguage?.()");
        const layout=await run("(()=>{const rows=[...document.querySelectorAll('[data-fixture-match]')],r=e=>e.getBoundingClientRect(),toolbar=r(document.querySelector('.app-fixtures-toolbar')),n=r(document.querySelector('.app-fixtures-navigation')),c=r(document.getElementById('app-fixtures-current'));return {rows:rows.length,scroll:document.documentElement.scrollWidth,width:innerWidth,fit:rows.every(e=>r(e).left>=0&&r(e).right<=innerWidth),names:rows.every(e=>[...e.querySelectorAll('.app-fixture-name')].every(n=>n.scrollWidth<=n.clientWidth+1)),controls:(!c.width&&!c.height)||((n.right<=c.left+1||c.right<=n.left+1)&&c.right<=innerWidth),geometry:{toolbar:{left:toolbar.left,right:toolbar.right,width:toolbar.width},navigation:{left:n.left,right:n.right,width:n.width,center:n.left+n.width/2},current:{left:c.left,right:c.right,width:c.width},lang:document.documentElement.lang}}})()");
        assert.equal(layout.rows,8);assert.ok(layout.scroll<=layout.width,width+" "+theme+" "+lang+" no horizontal page overflow");assert.equal(layout.fit,true);assert.equal(layout.names,true,"club names wrap without clipping");assert.equal(layout.controls,true,"round controls and current shortcut do not overlap; "+JSON.stringify(layout.geometry));
      }
      const matchDetails=await run("(()=>{const clubs=window.faCompetitionDivision.clubs,r=e=>e.getBoundingClientRect();return [...document.querySelectorAll('[data-fixture-match]')].every(row=>{const home=clubs.find(c=>c.clubId===Number(row.dataset.fixtureMatch.split(':')[1])),status=row.querySelector('.app-fixture-status'),score=row.querySelector('.app-fixture-score'),stadium=row.querySelector('.app-fixture-stadium');return stadium.textContent===home.stadiumName&&r(status).bottom<=r(score).top&&r(score).bottom<=r(stadium).top&&Math.abs(r(stadium).height-2*parseFloat(getComputedStyle(stadium).lineHeight))<=1&&getComputedStyle(stadium).whiteSpace==='normal'&&getComputedStyle(stadium).webkitLineClamp==='2'})})()");
      assert.equal(matchDetails,true,"status above result and home stadium below with exactly two reserved mobile lines");
      const hierarchy=await run("(()=>{const row=document.querySelector('[data-fixture-match]'),result=row.querySelector('.app-fixture-result'),name=row.querySelector('.app-fixture-home'),score=row.querySelector('.app-fixture-score'),status=row.querySelector('.app-fixture-status');return {resultWidth:result.getBoundingClientRect().width,nameWidth:name.getBoundingClientRect().width,scoreSize:parseFloat(getComputedStyle(score).fontSize),statusSize:parseFloat(getComputedStyle(status).fontSize)}})()");
      assert.ok(hierarchy.resultWidth<=100&&hierarchy.nameWidth>0,"mobile keeps a compact result column and a visible team-name column");
      assert.ok(hierarchy.scoreSize>=18&&hierarchy.scoreSize>hierarchy.statusSize,"score leads the card hierarchy");

      await run("document.documentElement.lang='en';window.faAppRenderLanguage?.();document.getElementById('competition-panel-fixtures').scrollIntoView({block:'start'})");
      await snap("FIXTURES-MOBILE "+width+" "+theme,width,height);
      const frameObserver=await cmd("Page.addScriptToEvaluateOnNewDocument",{source:`window.__faEmptyFrames=[];window.__faObserveEmpty=true;const sample=()=>{const e=document.getElementById('app-fixtures-empty');if(e&&!e.hidden&&e.getClientRects().length&&getComputedStyle(e).visibility==='visible')window.__faEmptyFrames.push(1);if(window.__faObserveEmpty)requestAnimationFrame(sample)};requestAnimationFrame(sample);`});
      await cmd("Page.reload",{ignoreCache:true});await expectSeason(1,1);
      await run("window.__faObserveEmpty=false");assert.deepEqual(await run("window.__faEmptyFrames"),[],"mobile refresh has no empty frame");
      await cmd("Page.removeScriptToEvaluateOnNewDocument",{identifier:frameObserver.identifier});
      await tap('#app-fixtures-current');await expectSeason(1,8);
      await tap('#app-fixtures-round');await tap('#app-fixtures-round-option-30');await expectSeason(1,30);
      assert.equal(await run("document.getElementById('app-fixtures-next').disabled"),true);
      await tap('#app-fixtures-next');await expectSeason(1,30);
      await run("sessionStorage.setItem('football-architect:standings-dev-matchdays','0')");
      await cmd("Page.reload",{ignoreCache:true});
      await wait(signature+"==="+JSON.stringify(expected(1,30,0)));
      assert.equal(await run("!document.getElementById('app-fixtures-toolbar').hidden"),true,"zero completed games still has a schedule");
      await run("sessionStorage.removeItem('football-architect:standings-dev-preview')");
      await cmd("Page.reload",{ignoreCache:true});
      await wait("!!window.faFixtures&&!document.documentElement.dataset.faDevStandingsPending");
      assert.equal(await run("document.getElementById('app-fixtures-toolbar').hidden&&!document.getElementById('app-fixtures-empty').hidden"),true,"DEV OFF hides all navigation and shows the empty state");
      console.log("FIXTURES_MOBILE_PASS|"+width+"|"+theme+"|touch menus, arrows, season changes, current round, refresh, empty state, zero completed games, five-language layout");
    }
    // History stays silent while loading and links to the shared Standings view.
    const historyManifest=JSON.parse(await readFile(join(root,'app/competitions/_shared/manifest.json'),'utf8'));
    await run("sessionStorage.setItem('football-architect:standings-dev-preview','on');sessionStorage.setItem('football-architect:standings-dev-matchdays','7')");
    for(const division of historyManifest.divisions){
      await cmd('Page.navigate',{url:devOrigin+'/competitions/'+division.id.toLowerCase()+'?season=4&view=history'});
      await wait("document.querySelectorAll('[data-history-season]').length===4");
      assert.equal(await run("!!document.querySelector('#app-history-hall,#app-history-final,.app-history-dev-banner,#competition-panel-history>h2')"),false);
      assert.deepEqual(await run("[...document.querySelectorAll('[data-history-season]')].map(b=>b.dataset.historySeason)"),['4','3','2','1']);
      const podiums=[4,3,2,1].map(season=>createPreviewStandings(division,30,season).rows.slice(0,3).map(row=>row.club.countryId+'-'+row.club.clubId));
      assert.deepEqual(await run("[...document.querySelectorAll('[data-history-season]')].map(b=>[...b.querySelectorAll('[data-club-crest]')].map(c=>c.dataset.clubCrest))"),podiums);
      const records={titles:new Map(),podiums:new Map(),streak:new Map(),totalWins:new Map(),totalGoals:new Map(),totalPoints:new Map()};let previous=null,streak=0;
      for(const season of [1,2,3,4]){
        const rows=createPreviewStandings(division,30,season).rows,id=club=>club.countryId+'-'+club.clubId,winner=id(rows[0].club);
        records.titles.set(winner,(records.titles.get(winner)||0)+1);
        for(const row of rows){
          records.totalWins.set(id(row.club),(records.totalWins.get(id(row.club))||0)+row.won);
          records.totalGoals.set(id(row.club),(records.totalGoals.get(id(row.club))||0)+row.gf);
          records.totalPoints.set(id(row.club),(records.totalPoints.get(id(row.club))||0)+row.pts);
        }
        for(const row of rows.slice(0,3)){const clubId=id(row.club);records.podiums.set(clubId,(records.podiums.get(clubId)||0)+1);}
        streak=winner===previous?streak+1:1;previous=winner;records.streak.set(winner,Math.max(records.streak.get(winner)||0,streak));
      }
      for(const [metric,counts] of Object.entries(records)){
        const maximum=Math.max(...counts.values());
        const card=await run("(()=>{const c=document.querySelector('[data-history-record=\""+metric+"\"]');return {value:Number(c.querySelector('strong').textContent),clubs:[...c.querySelectorAll('[data-club-crest]')].map(n=>n.dataset.clubCrest).sort()}})()");
        assert.equal(card.value,maximum,division.id+' '+metric);
        assert.deepEqual(card.clubs,[...counts].filter(([,count])=>count===maximum).map(([id])=>id).sort());
      }
      for(const [metric,field,extreme] of [['attack','gf',Math.max],['defence','ga',Math.min],['wins','won',Math.max],['points','pts',Math.max],['goalDifference','gd',Math.max]]){
        const entries=[1,2,3,4].flatMap(season=>createPreviewStandings(division,30,season).rows.map(row=>({season,club:row.club.countryId+'-'+row.club.clubId,value:row[field]})));
        const value=extreme(...entries.map(entry=>entry.value));
        const card=await run("(()=>{const c=document.querySelector('[data-history-record=\""+metric+"\"]');return {value:Number(c.querySelector('strong').textContent),entries:[...c.querySelectorAll('[data-history-record-season]')].map(n=>({season:Number(n.dataset.historyRecordSeason),club:n.querySelector('[data-club-crest]').dataset.clubCrest}))}})()");
        assert.deepEqual(card,{value,entries:entries.filter(entry=>entry.value===value).map(({season,club})=>({season,club}))},division.id+' '+metric);
        if(metric==='goalDifference')assert.equal(await run("document.querySelector('[data-history-record=goalDifference] strong').textContent"),value>0?'+'+value:String(value));
      }
      assert.equal(await run("!!document.querySelector('.app-history-dev [data-app-i18n=historyGoalsScored],.app-history-dev [data-app-i18n=historyGoalsConceded]')"),false);
      const margins=[1,2,3,4].map(season=>{const rows=createPreviewStandings(division,30,season).rows;return {season,club:rows[0].club.countryId+'-'+rows[0].club.clubId,value:rows[0].pts-rows[1].pts}});
      const marginValue=Math.max(...margins.map(item=>item.value));
      const marginCard=await run("(()=>{const c=document.querySelector('[data-history-record=margin]');return {value:Number(c.querySelector('strong').textContent),entries:[...c.querySelectorAll('[data-history-record-season]')].map(n=>({season:Number(n.dataset.historyRecordSeason),club:n.querySelector('[data-club-crest]').dataset.clubCrest}))}})()");
      assert.deepEqual(marginCard,{value:marginValue,entries:margins.filter(item=>item.value===marginValue).map(({season,club})=>({season,club}))});
      assert.deepEqual(await run("[...document.querySelectorAll('.app-history-dev [data-history-record]:not([hidden])')].map(c=>c.dataset.historyRecord)"),['attack','defence','wins','points','goalDifference','margin']);
      assert.equal(await run("document.querySelectorAll('.app-history-dev [data-history-player-record]:not([hidden])').length"),3);
      await run("document.querySelector('.app-history-dev [data-history-record-scope=\"all-time\"]').click()");
      assert.equal(await run("document.querySelectorAll('.app-history-dev [data-history-player-record]:not([hidden])').length"),4);
      assert.equal(await run("!!document.querySelector('.app-history-dev [data-history-player-records] strong,.app-history-dev [data-history-player-records] [data-club-crest]')"),false);
      assert.deepEqual(await run("[...document.querySelectorAll('.app-history-dev [data-history-record]:not([hidden])')].map(c=>c.dataset.historyRecord)"),['titles','podiums','streak','totalWins','totalGoals','totalPoints']);
      await run("document.querySelector('.app-history-dev [data-history-record-scope=\"season\"]').click()");
      await run("document.querySelector('[data-history-season=\"3\"]').click()");
      const standings=createPreviewStandings(division,7,3).rows.map(row=>[row.club.countryId+'-'+row.club.clubId,row.pts]);
      const standingsState="[...document.querySelectorAll('#app-standings-body tr')].map(row=>[row.dataset.worldClub,Number(row.children[9].textContent)])";
      await wait("window.faCompetitionRoute.get().view==='standings'&&window.faCompetitionRoute.get().season==='3'&&JSON.stringify("+standingsState+")==="+JSON.stringify(JSON.stringify(standings)));
      assert.equal(await run("document.activeElement.id"),'competition-tab-standings');
      assert.equal(await run("sessionStorage.getItem('football-architect:standings-dev-matchdays')"),'7');
      await run("history.back()");
      await wait("window.faCompetitionRoute.get().view==='history'&&window.faCompetitionRoute.get().season==='4'&&!document.getElementById('competition-panel-history').hidden");
    }
    const historyFrameObserver=await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`window.__faPrematureHistory=[];window.__faWatchHistory=true;const sampleHistory=()=>{const empty=document.querySelector('[data-history-empty]');if(empty&&!empty.hidden&&empty.getClientRects().length&&getComputedStyle(empty).visibility==='visible'&&sessionStorage.getItem('football-architect:standings-dev-preview')==='on')window.__faPrematureHistory.push(1);if(window.__faWatchHistory)requestAnimationFrame(sampleHistory)};requestAnimationFrame(sampleHistory);`});
    devManifestDelay=300;
    try{
      await cmd('Page.reload',{ignoreCache:true});
      await wait("document.querySelectorAll('[data-history-season]').length===4&&!document.documentElement.dataset.faDevStandingsPending&&!document.documentElement.dataset.faDebugPending");
      await run('window.__faWatchHistory=false');
      assert.deepEqual(await run('window.__faPrematureHistory'),[],'History records never flash in the shorter empty layout during refresh');
    }finally{devManifestDelay=0;await cmd('Page.removeScriptToEvaluateOnNewDocument',{identifier:historyFrameObserver.identifier});}
    for(const width of [1440,621,620,390,320])for(const theme of ['dark','light']){
      await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<621});
      await run("localStorage.setItem('football-architect:theme',"+JSON.stringify(theme)+")");
      await cmd('Page.navigate',{url:devOrigin+'/competitions/it-1?season=3&view=history'});
      await wait("document.querySelectorAll('[data-history-season]').length===4");
      for(const lang of ['en','de','es','fr','it']){
        await run("document.documentElement.lang="+JSON.stringify(lang));
        const layout=await run("(()=>{const r=document.querySelector('.app-history-dev');return {fit:document.documentElement.scrollWidth<=innerWidth+1,nested:[...r.querySelectorAll('*')].some(e=>e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflowX==='auto'),emptyLabels:[...r.querySelectorAll('[data-app-i18n]')].some(e=>!e.textContent.trim())}})()");
        assert.equal(layout.fit,true,width+' '+theme+' '+lang+' History fit');assert.equal(layout.nested,false);assert.equal(layout.emptyLabels,false);
        const cards=await run("[...document.querySelectorAll('.app-history-dev .app-competition-stat-card:not([hidden])')].map(c=>{const s=getComputedStyle(c);return {expected:c.querySelector('.app-competition-stat-value')?160:128,min:parseFloat(s.minHeight),height:c.getBoundingClientRect().height,overflow:c.scrollHeight>c.clientHeight+1,max:s.maxHeight,align:s.justifyContent}})");
        assert.ok(cards.every(c=>c.min===c.expected&&c.height>=c.expected-.5&&!c.overflow&&c.max==='none'),width+' '+theme+' '+lang+' History cards keep minimum heights and grow with content');
      }
      const toggle="document.querySelector('[data-dev-control=\"fictional-standings\"]')";
      const scrollCheck=await run("(()=>{const s=document.querySelector('.fa-shell-content-scroll');s.scrollTop=Math.min(180,s.scrollHeight-s.clientHeight);const top=s.scrollTop;const results=[];for(const scope of ['all-time','season','all-time','season']){document.querySelector('.app-history-dev [data-history-record-scope=\"'+scope+'\"]').click();results.push(s.scrollTop)}return {top,results,period:!!document.querySelector('.app-history-record-period')}})()");
      assert.ok(scrollCheck.results.every(value=>value>=0&&value<=scrollCheck.top),'History scroll remains in range at '+width+' '+theme);
      const spacing=await run("(()=>{const root=document.querySelector('.app-history-dev'),team=root.querySelector('[data-history-team-records]'),players=root.querySelector('[data-history-player-records]');return {gap:Math.round(players.getBoundingClientRect().top-team.getBoundingClientRect().bottom),ordered:!!(team.compareDocumentPosition(players)&Node.DOCUMENT_POSITION_FOLLOWING),sticky:[...root.querySelectorAll('.app-competition-stat-grid')].some(grid=>grid.style.minHeight!=='')}})()");
      assert.ok(spacing.ordered&&spacing.gap>=8&&spacing.gap<=28&&!spacing.sticky,'Player records sit below Team records without a spacer at '+width+' '+theme);
      assert.equal(scrollCheck.period,false,'History omits the overall Seasons 1–4 label');
      await run(toggle+".checked=false;"+toggle+".dispatchEvent(new Event('change',{bubbles:true}))");
      await wait("!document.querySelector('.app-history-dev')&&!document.querySelector('[data-history-empty]').hidden");
      assert.equal(await run("document.querySelectorAll('[data-history-empty] [data-history-team-records] .app-competition-stat-card:not([hidden])').length===6&&document.querySelectorAll('[data-history-empty] [data-history-player-record]:not([hidden])').length===3&&!document.querySelector('[data-history-empty] strong,[data-history-empty] [data-club-crest]')"),true,'Empty History starts with six team and three player seasonal cards without invented values');
      assert.equal(await run("[...document.querySelectorAll('[data-history-empty] .app-competition-stat-card:not([hidden])')].every(c=>getComputedStyle(c).minHeight==='128px'&&c.getBoundingClientRect().height>=127.5&&c.scrollHeight<=c.clientHeight+1)"),true,'All empty History cards use the 128px minimum');
      const emptyAlignment=await run("(()=>{const root=document.querySelector('[data-history-empty]'),team=root.querySelector('[data-history-team-records] .app-competition-stat-card:not([hidden])'),player=root.querySelector('[data-history-player-record]:not([hidden])'),offset=card=>Math.round(card.querySelector('.app-competition-empty').getBoundingClientRect().top-card.getBoundingClientRect().top);return {team:offset(team),player:offset(player),teamGrid:getComputedStyle(team).display,playerGrid:getComputedStyle(player).display}})()");
      assert.ok(emptyAlignment.team===emptyAlignment.player&&emptyAlignment.team===(width<=650?71:57)&&emptyAlignment.teamGrid==='grid'&&emptyAlignment.playerGrid==='grid','History Team and Player empty messages share the exact top offset at '+width+' '+theme);
      await run("document.querySelector('[data-history-empty] [data-history-record-scope=\"all-time\"]').click()");
      assert.equal(await run("document.querySelectorAll('[data-history-empty] [data-history-team-records] .app-competition-stat-card:not([hidden])').length"),6);
      assert.equal(await run("document.querySelectorAll('[data-history-empty] [data-history-player-record]:not([hidden])').length"),4);
      assert.equal(await run("(()=>{const root=document.querySelector('[data-history-empty]'),team=root.querySelector('[data-history-team-records] .app-competition-stat-card:not([hidden])'),player=root.querySelector('[data-history-player-record]:not([hidden])'),offset=c=>Math.round(c.querySelector('.app-competition-empty').getBoundingClientRect().top-c.getBoundingClientRect().top);return offset(team)===offset(player)&&offset(team)===(innerWidth<=650?71:57)})()"),true,'All-time empty Team and Player messages align at '+width+' '+theme);
      assert.deepEqual(await run('window.__faRuntimeErrors'),[], 'History has no uncaught runtime errors');
      await run(toggle+".checked=true;"+toggle+".dispatchEvent(new Event('change',{bubbles:true}))");
      await wait("document.querySelectorAll('[data-history-season]').length===4");
      assert.equal(await run("document.querySelectorAll('.app-history-dev [data-history-record]:not([hidden])').length"),6,'Debug restoration preserves All-time scope');
      assert.equal(await run("document.querySelectorAll('.app-history-dev [data-history-player-record]:not([hidden])').length"),4);
      await run("document.querySelector('.app-history-dev [data-history-record-scope=\"season\"]').click()");
      await snap('HISTORY '+width+' '+theme,width,900);
      await cmd('Page.navigate',{url:devOrigin+'/competitions/it-1?season=3&view=stats'});
      await wait("document.querySelectorAll('#fa-dev-stats .fa-dev-stats-card').length===3");
      await run("sessionStorage.removeItem('football-architect:standings-dev-preview');window.dispatchEvent(new Event('fa:fictional-standings-change'))");
      const statsGeometry=await run("(()=>{const dimensions=elements=>elements.map(e=>({height:e.getBoundingClientRect().height,scroll:e.scrollHeight,client:e.clientHeight})),offset=e=>{const m=e.querySelector('.fa-dev-stats-empty');return m?Math.round(m.getBoundingClientRect().top-e.getBoundingClientRect().top):null},overview=[...document.querySelectorAll('#fa-dev-stats .fa-dev-stats-card')],overviewDim=dimensions(overview),baseline=offset(overview[0]),overviewAligned=overview.every(c=>c.isConnected&&offset(c)===baseline);document.querySelectorAll('#fa-dev-stats .fa-dev-stats-nav button')[2].click();const players=[...document.querySelectorAll('#fa-dev-stats .fa-dev-stats-leader-card')],playerDim=dimensions(players),aligned=baseline===45&&overviewAligned&&players.every(c=>c.isConnected&&offset(c)===baseline);document.querySelectorAll('#fa-dev-stats .fa-dev-stats-nav button')[1].click();return {overview:overviewDim,players:playerDim,teams:document.querySelectorAll('#fa-dev-stats .fa-dev-stats-team-card').length,aligned}})()");
      assert.ok(statsGeometry.overview.length===3&&statsGeometry.players.length===4&&statsGeometry.teams===7&&statsGeometry.aligned&&[...statsGeometry.overview,...statsGeometry.players].every(c=>Math.abs(c.height-88)<=1&&c.scroll<=c.client+1),'Stats Overview/Players fixed 88px and aligned empty content at '+width+' '+theme+' '+JSON.stringify(statsGeometry));
      await run("sessionStorage.setItem('football-architect:standings-dev-preview','on');window.dispatchEvent(new Event('fa:fictional-standings-change'));document.querySelectorAll('#fa-dev-stats .fa-dev-stats-nav button')[0].click()");
      assert.equal(await run("[...document.querySelectorAll('#fa-dev-stats .fa-dev-stats-card')].every(c=>Math.abs(c.getBoundingClientRect().height-88)<=1&&!!c.querySelector('.app-competition-stat-value'))"),true,'Populated Stats Overview keeps 88px at '+width+' '+theme);
      await run("document.querySelectorAll('#fa-dev-stats .fa-dev-stats-nav button')[1].click()");
      const teamsGeometry=await run("(()=>{const cards=[...document.querySelectorAll('#fa-dev-stats .fa-dev-stats-team-card')],rows=[...document.querySelectorAll('#fa-dev-stats .fa-dev-stats-team-card .fa-dev-stats-top>li')];const valid=rows.every(row=>{const [rank,identity,value]=row.children;if(!rank||!identity||!value)return false;const crest=identity.querySelector('.app-world-club-crest-placeholder'),name=identity.querySelector('.fa-dev-stats-team-name');if(!crest||!name)return false;const a=rank.getBoundingClientRect(),b=identity.getBoundingClientRect(),c=value.getBoundingClientRect(),d=crest.getBoundingClientRect();const style=getComputedStyle(name);return a.right<=b.left+1&&b.right<=c.left+1&&Math.abs((d.top+d.bottom)/2-(c.top+c.bottom)/2)<4&&style.whiteSpace==='normal'&&style.textOverflow!=='ellipsis'&&row.scrollWidth<=row.clientWidth+1});const first=rows[0],name=first?.querySelector('.fa-dev-stats-team-name'),before=first?.getBoundingClientRect().height||0;let after=before;if(name){const original=name.textContent;name.textContent='A Very Long Fictional Football Club Name Repeated Across Multiple Words And Regional Identities Several Times For A Full Wrap Test';after=first.getBoundingClientRect().height;name.textContent=original;}return {cards:cards.length,rows:rows.length,valid,grows:after>before,overflow:cards.some(c=>c.scrollWidth>c.clientWidth+1),nested:cards.some(c=>getComputedStyle(c).overflowY==='auto')}})()");
      assert.ok(teamsGeometry.cards===7&&teamsGeometry.rows>=28&&teamsGeometry.valid&&teamsGeometry.grows&&!teamsGeometry.overflow&&!teamsGeometry.nested,'Stats Teams aligned and wrapping at '+width+' '+theme);
      for(const lang of ['en','de','es','fr','it']){
        await run("document.documentElement.lang="+JSON.stringify(lang));
        const labelCheck=await run("(()=>{const root=document.getElementById('fa-dev-stats'),select=[...root.querySelectorAll('.fa-dev-stats-nav button')],cards=[...root.querySelectorAll('.fa-dev-stats-team-card')],label=cards[0].querySelector('[data-app-i18n]');return {lang:document.documentElement.lang,labels:select.map(n=>n.textContent),heading:label.textContent,keys:cards.every(c=>c.querySelector('[data-app-i18n]')?.textContent.trim()),nonEnglish:document.documentElement.lang==='en'||select[0].textContent!=='Overview'}})()");
        assert.ok(labelCheck.nonEnglish&&labelCheck.keys&&labelCheck.labels.every(Boolean),'Stats localized labels at '+width+' '+theme+' '+lang);
      }
      const modalTrigger=await run("document.querySelector('#fa-dev-stats .fa-dev-stats-team-card .fa-dev-stats-expand')?.click();!!document.querySelector('dialog.fa-dev-stats-dialog[open]')");
      if(modalTrigger){
        const dialogI18n=await run("(()=>{const d=document.querySelector('dialog.fa-dev-stats-dialog[open]');return {heading:d.querySelector('[data-app-i18n]')?.textContent,close:d.querySelector('[data-app-aria]')?.getAttribute('aria-label'),labelled:d.getAttribute('aria-labelledby')===d.querySelector('h3')?.id}})()");
        assert.ok(dialogI18n.heading&&dialogI18n.close&&dialogI18n.labelled,'Stats modal translated accessibility');
        await run("document.querySelector('dialog.fa-dev-stats-dialog[open]')?.close()");
      }
    }
    console.log('HISTORY_BROWSER_PASS|16 divisions; archive and records; 5 viewport widths; Dark/Light; 5 locales; season links to Standings; debug OFF/ON');
    console.log("Browser QA PASS: "+checks.join(", ")+"; "+screenshots+" real Chrome PNG screenshots; theme, contrast, search, standings, tooltip CSS and persistence checked.");
  }finally{
    try{socket?.close();}catch{}
    proc.kill("SIGTERM");devServer.close();server.close();
    await new Promise(ok=>server.once("close",ok));
    for(let i=0;i<30&&proc.exitCode===null;i++)await delay(100);
    if(proc.exitCode===null)proc.kill("SIGKILL");
    try{await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch{}
  }
});
