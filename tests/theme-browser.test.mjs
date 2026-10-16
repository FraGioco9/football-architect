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
    let file=resolve(root,"."+decodeURIComponent(route));
    if(file!==root&&!file.startsWith(root+sep))throw Error("outside root");
    if(!extname(file))file=join(file,"index.html");
    res.writeHead(200,{"Content-Type":mime[extname(file)]||"application/octet-stream","Cache-Control":"no-store"});
    res.end(await readFile(file));
  }catch{res.writeHead(404);res.end("Not found");}
});
// Adapter exercises the actual DEV server on an isolated ephemeral test port.
const devRouter=createPreviewServer();
let devResourceDelay=0;
const devServer=createServer((req,res)=>{
 req.headers.host="127.0.0.1:2000";
 const send=()=>devRouter.emit("request",req,res);
 if(devResourceDelay&&(req.url.startsWith("/__fa_dev__/")||req.url.includes("manifest.json")))setTimeout(send,devResourceDelay);
 else send();
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
    const run=async expression=>{
      const out=await cmd("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
      if(out.exceptionDetails)throw Error(out.exceptionDetails.text);
      return out.result.value;
    };
    const wait=async expr=>{
      for(let i=0;i<100;i++){try{if(await run(expr))return;}catch{}await delay(100);}
      throw Error("Timed out: "+expr);
    };
    const visit=async(route,condition="true")=>{
      const url=origin+route;await cmd("Page.navigate",{url});
      await wait("location.pathname.replace(/\\/$/,'')==="+JSON.stringify(new URL(url).pathname.replace(/\/$/,""))+"&&document.readyState==='complete'&&("+condition+")");
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
          "mobile dark search","mobile light tooltip fixture","mobile light round picker","desktop dark round picker"].includes(label)||label.startsWith("UX-01A ")){
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
        await visit("/app/competitions/","document.querySelectorAll('a.app-division-card').length===16");
        assert.equal(await run("[...document.querySelectorAll('a.app-division-card')].every(a=>new URL(a.href).search==='?season=1&view=standings')"),true);
        await run("document.querySelector('a.app-division-card').click()");
        await wait("document.readyState==='complete'&&window.faCompetitionRoute?.get().view==='standings'&&window.faCompetitionRoute?.get().season==='1'&&document.querySelectorAll('#app-standings-body tr').length===16");
        assert.equal(await run("location.search"),"?season=1&view=standings");
        const table=await run("(()=>{const t=document.querySelector('.app-world-standing-table');return {rows:document.querySelectorAll('#app-standings-body tr').length,sticky:getComputedStyle(t.querySelector('tbody tr>*:first-child')).position,head:getComputedStyle(t.querySelector('thead th')).backgroundColor,logo:document.querySelector('.app-brand-symbol')?.getAttribute('src')}})()");
        assert.equal(table.rows,16);assert.equal(table.sticky,"sticky");
        assert.equal(table.head,theme==="light"?"rgb(232, 241, 235)":"rgb(23, 45, 48)");
        assert.ok(table.logo?.endsWith("-"+theme+".svg"),name+" async logo");
        await snap(name+" "+theme+" standings",w,h);
        // Fixtures: real browser behavior with a test-only supplied schedule.
        await wait("!!window.faFixtures");
        await run("document.getElementById('competition-tab-fixtures').click()");
        const emptyFixtures=await run("({count:document.querySelectorAll('[data-fixture-match]').length,empty:!document.getElementById('app-fixtures-empty').hidden,disabled:document.getElementById('app-fixtures-round').disabled})");
        assert.deepEqual(emptyFixtures,{count:0,empty:true,disabled:true});
        assert.equal(await run("document.getElementById('app-fixtures-current').getClientRects().length"),0);
        const fixtureControls=await run("(()=>{const panel=document.getElementById('competition-panel-fixtures'),select=document.getElementById('app-fixtures-round'),p=panel.getBoundingClientRect(),s=select.getBoundingClientRect();return {centered:Math.abs((s.left+s.right)-(p.left+p.right))<2,title:!!panel.querySelector('h2'),notice:!!document.getElementById('app-fixtures-preview'),siteStyle:select.classList.contains('language-trigger'),height:s.height}})()");
        assert.deepEqual(fixtureControls,{centered:true,title:false,notice:false,siteStyle:true,height:44});
        const fixtureDivision=JSON.parse(await readFile(join(root,"app/competitions/_shared/manifest.json"),"utf8")).divisions.find(d=>d.id==="IT-1");
        const fixtureModel=createPreviewStandings(fixtureDivision,30).fixtures.map(g=>({...g,kickoff:null,homeGoals:g.round<=15?g.homeGoals:null,awayGoals:g.round<=15?g.awayGoals:null}));
        await run("window.faFixtures.prepare("+JSON.stringify(fixtureModel)+",{currentMatchday:16})()");
        await run("document.getElementById('app-fixtures-round').click()");
        const picker=await run("(()=>{const p=document.getElementById('app-fixtures-picker'),b=p.getBoundingClientRect();return {open:!p.hidden,expanded:document.getElementById('app-fixtures-round').getAttribute('aria-expanded'),focused:document.activeElement.id,active:document.getElementById('app-fixtures-round').getAttribute('aria-activedescendant'),fit:b.left>=0&&b.right<=innerWidth}})()");
        assert.deepEqual(picker,{open:true,expanded:"true",focused:"app-fixtures-round",active:"app-fixtures-round-option-1",fit:true});
        const sameMenuStyle=await run("(()=>{const keys=['backgroundColor','borderColor','borderRadius','boxShadow','padding'],reference=getComputedStyle(document.getElementById('language-options'));return ['app-fixtures-picker','app-competition-season-menu'].every(id=>{const style=getComputedStyle(document.getElementById(id));return keys.every(key=>style[key]===reference[key])})})()");
        assert.equal(sameMenuStyle,true,"competition dropdowns share Settings menu styles");
        const dropdownWidths=await run("(()=>{const width=id=>document.getElementById(id).getBoundingClientRect().width;return {round:width('app-fixtures-round'),menu:width('app-fixtures-picker'),season:width('app-competition-season')}})()");
        assert.equal(dropdownWidths.round,dropdownWidths.menu);assert.equal(dropdownWidths.season,88);
        if(w>620)assert.equal(await run("document.getElementById('app-competition-season').getBoundingClientRect().height===document.querySelector('.app-competition-return').getBoundingClientRect().height"),true,"Season and All competitions have the same height");
        const disabledStyle=await run("(()=>{const s=getComputedStyle(document.getElementById('app-fixtures-previous'));return {background:s.backgroundColor,border:s.borderColor,transition:s.transitionDuration,transform:s.transform}})()");
        const disabledPoint=await run("(()=>{const r=document.getElementById('app-fixtures-previous').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
        await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',...disabledPoint});
        assert.deepEqual(await run("(()=>{const s=getComputedStyle(document.getElementById('app-fixtures-previous'));return {background:s.backgroundColor,border:s.borderColor,transition:s.transitionDuration,transform:s.transform}})()"),disabledStyle);
        assert.equal(disabledStyle.transition,'0s');assert.equal(disabledStyle.transform,'none');
        await snap(name+" "+theme+" round picker",w,h);
        await run("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
        assert.equal(await run("window.faCompetitionRoute.get().matchday"),2);
        assert.equal(await run("document.activeElement.id"),"app-fixtures-round");
        await run("document.getElementById('app-fixtures-round').click();document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
        assert.equal(await run("document.getElementById('app-fixtures-picker').hidden"),true);
        await run("window.faCompetitionRoute.set({matchday:1})");
        await run("document.getElementById('app-fixtures-round').click()");
        const disabledClick=await run("(()=>{const b=document.getElementById('app-fixtures-previous').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()");
        for(const type of ['mousePressed','mouseReleased'])await cmd('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...disabledClick});
        assert.equal(await run("document.getElementById('app-fixtures-picker').hidden&&document.activeElement!==document.getElementById('app-fixtures-round')&&window.faCompetitionRoute.get().matchday===1"),true,"disabled arrow dismisses menu and focus without navigating");
        await run("document.getElementById('app-fixtures-round').focus()");
        for(const type of ['mousePressed','mouseReleased'])await cmd('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...disabledClick});
        assert.equal(await run("document.activeElement!==document.getElementById('app-fixtures-round')"),true,"disabled arrow also removes focus from a closed menu");
        for(const lang of ["en","it","de","es","fr"]){
          await run("document.documentElement.lang='"+lang+"'");
          const fixtures=await run("(()=>{const rows=[...document.querySelectorAll('[data-fixture-match]')];return {count:rows.length,options:document.querySelectorAll('[data-fixture-round-choice]').length,previous:document.getElementById('app-fixtures-previous').disabled,fit:rows.every(row=>{const b=row.getBoundingClientRect(),score=row.querySelector('.app-fixture-score').getBoundingClientRect(),home=row.querySelector('.app-fixture-home').getBoundingClientRect(),away=row.querySelector('.app-fixture-club:not(.app-fixture-home)').getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&home.right<=score.left&&(innerWidth<=620?(away.right<=score.left&&home.width>=120&&away.width>=120):away.left>=score.right)}),statuses:rows.map(r=>r.querySelector('.app-fixture-status').textContent),text:getComputedStyle(rows[0]).color,background:getComputedStyle(rows[0]).backgroundColor}})()");
          const currentButton=await run("(()=>{const b=document.getElementById('app-fixtures-current'),r=b.getBoundingClientRect(),p=document.getElementById('competition-panel-fixtures').getBoundingClientRect();return {visible:!b.hidden,fit:r.left>=0&&r.right<=innerWidth,centered:Math.abs((r.left+r.right)-(p.left+p.right))<2,label:b.textContent}})()");
          assert.deepEqual(currentButton,{visible:true,fit:true,centered:true,label:({en:"Current matchday",it:"Giornata attuale",de:"Aktueller Spieltag",es:"Jornada actual",fr:"Journée actuelle"})[lang]});
          assert.equal(fixtures.count,8);assert.equal(fixtures.options,30);assert.equal(fixtures.previous,true);
          assert.ok(fixtures.fit,"Fixtures fit "+name+"/"+theme+"/"+lang);
          assert.ok(ratio(fixtures.text,fixtures.background)>=4.5);
          assert.ok(fixtures.statuses.every(text=>text===({en:"Full time",it:"Terminata",de:"Beendet",es:"Finalizado",fr:"Terminé"})[lang]));
        }
        await run("document.documentElement.lang='en';window.faCompetitionRoute.set({matchday:16})");
        await wait("document.querySelector('[data-fixture-round=\"16\"]')");
        const scheduled=await run("({scores:[...document.querySelectorAll('.app-fixture-score')].map(x=>x.textContent),next:document.getElementById('app-fixtures-next').disabled})");
        assert.ok(scheduled.scores.every(score=>score==="—"));assert.equal(scheduled.next,false);
        await snap(name+" "+theme+" Fixtures",w,h);
        const last=await run("(()=>{window.faCompetitionRoute.set({matchday:30});const s=document.getElementById('app-fixtures-round');return {value:s.value,next:document.getElementById('app-fixtures-next').disabled}})()");
        assert.deepEqual(last,{value:"30",next:true});
        await run("window.faFixtures.prepare(null)();document.getElementById('competition-tab-standings').click()");
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
    // Fixtures integration: real DEV switch, slider, standings totals and OFF restoration.
    await cmd("Page.navigate",{url:devOrigin+"/app/competitions/it-1/"});
    await wait("!!document.querySelector('[data-dev-control=\"fictional-standings\"]')");
    await run("document.getElementById('competition-tab-fixtures').click();document.querySelector('[data-dev-control=\"fictional-standings\"]').click()");
    await wait("document.querySelectorAll('[data-fixture-match]').length===8");
    for(const completed of [0,1,2,3,4,15,30]){
      await run("(()=>{const s=document.querySelector('[data-dev-control=\"matchdays\"]');s.value='"+completed+"';s.dispatchEvent(new Event('change'))})()");
      await wait("document.querySelector('#app-standings-body tr td:nth-child(3)')?.textContent==='"+completed+"'");
      const preview=await run("(()=>{window.faCompetitionRoute.set({matchday:1});const matches=[...document.querySelectorAll('[data-fixture-match]')];return {count:matches.length,scores:matches.map(row=>row.querySelector('.app-fixture-score').textContent),notice:!!document.getElementById('app-fixtures-preview'),allPlayed:[...document.querySelectorAll('#app-standings-body tr')].every(row=>row.cells[2].textContent==='"+completed+"')}})()");
      assert.equal(preview.count,8);assert.equal(preview.notice,false);assert.equal(preview.allPlayed,true);
      assert.ok(preview.scores.every(score=>completed===0?score==="—":/^\d+ – \d+$/.test(score)));
      const current=Math.min(completed+1,30);
      assert.equal(await run("document.getElementById('app-fixtures-current').hidden"),current===1);
      if(current!==1){
        await run("document.getElementById('app-fixtures-current').click()");
        assert.equal(await run("window.faCompetitionRoute.get().matchday"),current);
        assert.equal(await run("document.getElementById('app-fixtures-current').getClientRects().length===0&&document.activeElement.id==='app-fixtures-round'"),true);
      }
    }
    // Compare every match score and each club's goal totals against the same deterministic model.
    const agreement=await run("(()=>{const totals=new Map([...document.querySelectorAll('#app-standings-body tr')].map(row=>[row.dataset.worldClub,{gf:Number(row.cells[6].textContent),ga:Number(row.cells[7].textContent),actualFor:0,actualAgainst:0}]));for(let n=1;n<=30;n++){window.faCompetitionRoute.set({matchday:n});for(const row of document.querySelectorAll('[data-fixture-match]')){const scores=row.querySelector('.app-fixture-score').textContent.split(' – ').map(Number),crests=[...row.querySelectorAll('[data-club-crest]')],home=totals.get(crests[0].dataset.clubCrest),away=totals.get(crests[1].dataset.clubCrest);home.actualFor+=scores[0];home.actualAgainst+=scores[1];away.actualFor+=scores[1];away.actualAgainst+=scores[0]}}return [...totals.values()].every(c=>c.gf===c.actualFor&&c.ga===c.actualAgainst)})()");
    assert.equal(agreement,true,"Fixtures and standings share the same 240 results");
    await run("document.querySelector('[data-dev-control=\"fictional-standings\"]').click()");
    await wait("document.querySelectorAll('[data-fixture-match]').length===0");
    assert.equal(await run("!document.getElementById('app-fixtures-preview')&&document.getElementById('app-fixtures-round').disabled"),true);
    // OFF remains OFF after refresh; it never leaks fictional matches into the public view.
    await cmd("Page.reload");
    await wait("!!document.querySelector('[data-dev-control=\"fictional-standings\"]')");
    assert.equal(await run("document.querySelectorAll('[data-fixture-match]').length"),0);
    await run("document.querySelector('[data-dev-control=\"fictional-standings\"]').click()");
    await wait("document.querySelectorAll('[data-fixture-match]').length===8");
    await run("(()=>{const s=document.querySelector('[data-dev-control=\"matchdays\"]');s.value='4';s.dispatchEvent(new Event('change'))})()");
    await wait("document.querySelector('#app-standings-body tr td:nth-child(3)')?.textContent==='4'");
    await cmd("Page.reload");
    await wait("document.querySelectorAll('[data-fixture-match]').length===8&&document.querySelector('#app-standings-body tr td:nth-child(3)')?.textContent==='4'");
    assert.equal(await run("document.querySelector('[data-dev-control=\"matchdays\"]').value"),"4","existing session matchday preference restores both views");
    await run("document.querySelector('[data-dev-control=\"reset-page\"]').click()");
    await wait("document.querySelectorAll('[data-fixture-match]').length===0&&!document.querySelector('[data-dev-control=\"fictional-standings\"]').checked");
    assert.equal(await run("document.querySelector('[data-dev-control=\"matchdays\"]').value"),"15");
    await run("document.querySelector('[data-dev-control=\"fictional-standings\"]').click()");
    await wait("document.querySelectorAll('[data-fixture-match]').length===8");
    await run("document.querySelector('[data-dev-control=\"reset-global\"]').click()");
    await wait("document.querySelectorAll('[data-fixture-match]').length===0");
    assert.equal(await run("sessionStorage.getItem('football-architect:standings-dev-preview')"),null);
    const clickControl=async selector=>{
      const point=await run("(()=>{const e=document.querySelector("+JSON.stringify(selector)+");e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
      await cmd("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",clickCount:1,...point});
      await cmd("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",clickCount:1,...point});
    };
    // Direct canonical DEV URL, picker, history, refresh and missing seasons.
    await cmd("Page.navigate",{url:devOrigin+"/app/competitions/it-1?season=1&view=fixtures&matchday=12"});
    await wait("!!window.faCompetitionRoute&&!!document.querySelector('[data-dev-control=\"fictional-standings\"]')");
    assert.equal(await run("location.pathname"),"/app/competitions/it-1");
    assert.equal(await run("window.faCompetitionRoute.get().matchday"),12);
    await wait("document.readyState==='complete'");
    await run("if(!document.querySelector('[data-dev-control=\"fictional-standings\"]').checked)document.querySelector('[data-dev-control=\"fictional-standings\"]').click()");
    await wait("document.querySelectorAll('[data-fixture-match]').length===8");
    await clickControl("#app-fixtures-round");
    await clickControl('[data-fixture-round-choice="13"]');
    await clickControl("#competition-tab-history");
    assert.equal(await run("location.search"),"?season=1&view=history&matchday=13");
    await run("history.back()");await wait("location.search==='?season=1&view=fixtures&matchday=13'&&window.faCompetitionRoute.get().view==='fixtures'&&window.faCompetitionRoute.get().matchday===13");
    await run("history.back()");await wait("window.faCompetitionRoute.get().matchday===12");
    await run("history.forward()");await wait("window.faCompetitionRoute.get().matchday===13");
    await cmd("Page.reload");await wait("!!window.faFixtures&&document.querySelectorAll('[data-fixture-match]').length===8");
    assert.equal(await run("document.getElementById(\"app-fixtures-round-number\").textContent"),"13");
    assert.equal(await run("!!document.querySelector('[data-dev-control=\"fictional-standings\"]').checked"),true);
    await run("window.faCompetitionRoute.set({season:\"2\"})");
    assert.equal(await run("!document.getElementById(\"app-competition-season-unavailable\").hidden&&[...document.querySelectorAll(\".app-competition-panel\")].every(p=>p.hidden)"),true);
    await run("document.getElementById(\"app-competition-season\").click();document.getElementById(\"app-competition-season-option-1\").click()");
    assert.equal(await run("!document.getElementById(\"competition-panel-fixtures\").hidden"),true);
    await clickControl("#app-fixtures-current");
    assert.equal(await run("window.faCompetitionRoute.get().matchday"),16);
    await clickControl("#competition-tab-standings");
    assert.equal(await run("location.search"),"?season=1&view=standings&matchday=16");
    await cmd("Page.reload");await wait("!!window.faFixtures&&document.querySelectorAll('[data-fixture-match]').length===8");
    await clickControl("#competition-tab-fixtures");
    assert.equal(await run("document.getElementById('app-fixtures-round-number').textContent"),"16");
    assert.equal(await run("document.getElementById('app-fixtures-current').hidden"),true);
    // Observe actual visible frames during a catalogue-to-competition navigation.
    await run("(()=>{const slider=document.querySelector('[data-dev-control=\"matchdays\"]');slider.value='4';slider.dispatchEvent(new Event('change'))})()");
    await wait("document.querySelector('#app-standings-body tr td:nth-child(3)')?.textContent==='4'");
    devResourceDelay=350;
    const observeSource="(()=>{if(location.origin!==\"PLACEHOLDER\")return;const checks=window.__faDevPaintChecks={wrong:0,correct:0,pendingLogo:false};function frame(){const region=document.querySelector('.app-world-standings'),logo=document.getElementById('app-competition-badge');if(document.documentElement.dataset.faDebugPending==='true'&&logo?.getBoundingClientRect().width>0&&getComputedStyle(logo).visibility==='visible')checks.pendingLogo=true;if(region?.getBoundingClientRect().height>0&&getComputedStyle(region).visibility==='visible'&&!region.closest('[hidden]')){const rows=[...document.querySelectorAll('#app-standings-body tr')];if(rows.length===16&&rows.every(r=>r.cells[2].textContent==='4'))checks.correct++;else checks.wrong++}requestAnimationFrame(frame)}requestAnimationFrame(frame)})();".replace("\"PLACEHOLDER\"",JSON.stringify(devOrigin));
    const observerScript=await cmd("Page.addScriptToEvaluateOnNewDocument",{source:observeSource});
    await cmd("Page.navigate",{url:devOrigin+"/app/competitions/"});
    await wait("document.readyState==='complete'&&!!document.querySelector('a.app-division-card')");
    await run("document.querySelectorAll('a.app-division-card')[2].click()");
    await wait("window.__faDevPaintChecks?.correct>0");
    const paints=await run("window.__faDevPaintChecks");
    assert.equal(paints.wrong,0,"no visible default standings before saved DEV values");
    assert.equal(paints.pendingLogo,true,"logo remains visible while saved DEV values restore");
    assert.equal(await run("document.querySelector('[data-dev-control=\"matchdays\"]').value"),"4");
    await cmd("Page.removeScriptToEvaluateOnNewDocument",{identifier:observerScript.identifier});
    devResourceDelay=0;
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
