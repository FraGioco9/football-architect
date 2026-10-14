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
      await wait("location.href==="+JSON.stringify(url)+"&&document.readyState==='complete'&&("+condition+")");
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
          "mobile dark search","mobile light tooltip fixture"].includes(label)||label.startsWith("UX-01A ")){
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
        await visit("/app/competitions/it-1/","document.querySelectorAll('#app-standings-body tr').length===20");
        const table=await run("(()=>{const t=document.querySelector('.app-world-standing-table');return {rows:document.querySelectorAll('#app-standings-body tr').length,sticky:getComputedStyle(t.querySelector('tbody tr>*:first-child')).position,head:getComputedStyle(t.querySelector('thead th')).backgroundColor,logo:document.querySelector('.app-brand-symbol')?.getAttribute('src')}})()");
        assert.equal(table.rows,20);assert.equal(table.sticky,"sticky");
        assert.equal(table.head,theme==="light"?"rgb(232, 241, 235)":"rgb(23, 45, 48)");
        assert.ok(table.logo?.endsWith("-"+theme+".svg"),name+" async logo");
        await snap(name+" "+theme+" standings",w,h);
        // UX-01A focused real-Chrome responsive acceptance (theme + native disclosure).
        // Do not confuse the public unknown-statistics state with DEV-only fictional results.
        const qaWidths = name==="iPhone" ? [320,360,390,620,621] : [w];
        for(const width of qaWidths){
          await cmd("Emulation.setDeviceMetricsOverride",
            {width,height:h,deviceScaleFactor:1,mobile,screenWidth:width,screenHeight:h});
          const compactExpected=width<=620;
          await wait("(()=>{if(innerWidth!=="+width+")return false;const c=document.getElementById('app-standings-compact'),f=document.getElementById('app-standings-full');return !!c&&!!f&&c.hidden==="+(!compactExpected)+"&&f.hidden==="+compactExpected+"})()");
          const state=await run("(()=>{const full=document.getElementById('app-standings-full'),compact=document.getElementById('app-standings-compact'),items=[...document.querySelectorAll('#app-standings-compact-list > li')],table=document.querySelector('.app-world-standing-table'),first=items[0]?.querySelector('details'),summary=first?.querySelector('summary'),points=summary?.querySelector('.app-world-mobile-points'),fg=points?getComputedStyle(points):null;return {inner:innerWidth,scroll:document.documentElement.scrollWidth,compact:compact.hidden,full:full.hidden,compactDisplay:getComputedStyle(compact).display,fullDisplay:getComputedStyle(full).display,rows:document.querySelectorAll('#app-standings-body tr').length,clubs:items.length,idsMatch:items.every((li,i)=>li.dataset.worldClub===document.querySelectorAll('#app-standings-body tr')[i]?.dataset.worldClub),cells:table.querySelector('tbody tr').children.length,stats:first?.querySelectorAll('.app-world-mobile-stat').length,form:summary?.querySelectorAll('.app-world-form-dot').length,points:points?.firstChild?.textContent,color:fg?.color,background:fg?.backgroundColor,summaryTag:summary?.tagName,logo:!!document.querySelector('#app-competition-badge picture[data-division-logo]')}})()");
          assert.equal(state.inner,width,"responsive viewport "+width);
          assert.ok(state.scroll<=width+1,"no page-wide overflow at "+width+"px "+theme);
          assert.equal(state.rows,20,"canonical public rows "+width);
          assert.equal(state.clubs,20,"compact public rows "+width);
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
          await visit(route,detail?"document.querySelectorAll('#app-standings-body tr').length===20":"true");
          const gutter=await run("(()=>{const scroll=document.querySelector('.fa-shell-content-scroll'),root=scroll||document.documentElement,oldWidth=root.clientWidth,probe=document.createElement('div');probe.style.cssText='height:2400px;flex:0 0 2400px;visibility:hidden';(scroll||document.body).appendChild(probe);const width=root.clientWidth,overflow=root.scrollHeight>root.clientHeight,mode=getComputedStyle(root).scrollbarGutter;probe.remove();return {mode,oldWidth,width,overflow,pageWidth:document.documentElement.scrollWidth,viewport:innerWidth}})()");
          assert.equal(gutter.mode,"stable","SCROLLBAR-GUTTER-01 "+route+" "+name+"/"+theme);
          assert.equal(gutter.width,gutter.oldWidth,"no horizontal shift "+route+" "+name+"/"+theme);
          assert.ok(gutter.overflow,"vertical probe scrolls "+route+" "+name+"/"+theme);
          assert.ok(gutter.pageWidth<=gutter.viewport+1,"no horizontal overflow "+route+" "+name+"/"+theme);
        }
        checks.push(name+"/"+theme);
      }
    }
    console.log("Browser QA PASS: "+checks.join(", ")+"; "+screenshots+" real Chrome PNG screenshots; theme, contrast, search, standings, tooltip CSS and persistence checked.");
  }finally{
    try{socket?.close();}catch{}
    proc.kill("SIGTERM");server.close();
    await new Promise(ok=>server.once("close",ok));
    for(let i=0;i<30&&proc.exitCode===null;i++)await delay(100);
    if(proc.exitCode===null)proc.kill("SIGKILL");
    try{await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch{}
  }
});
