// ME-01 real Chrome viewport regression. Local-only laboratory, no world writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {createPreviewServer} from '../../tools/dev-standings-preview.mjs';

function chromeBinary() {
  const win=process.platform==='win32'
    ? [process.env.ProgramFiles&&join(process.env.ProgramFiles,'Google','Chrome','Application','chrome.exe'),
       process.env['PROGRAMFILES(X86)']&&join(process.env['PROGRAMFILES(X86)'],'Google','Chrome','Application','chrome.exe'),
       process.env.LOCALAPPDATA&&join(process.env.LOCALAPPDATA,'Google','Chrome','Application','chrome.exe')]
    : [];
  for (const candidate of [process.env.CHROME_BIN,...win,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean))
    if(spawnSync(candidate,['--version'],{timeout:4000,stdio:'ignore'}).status===0)return candidate;
  throw Error('Chrome required: set CHROME_BIN');
}
test('ME-01: field and OPEN advanced inputs fit normal desktop viewport heights without scrolling',
  {timeout:90000},async()=>{
  const browser=chromeBinary();
  const temp=await mkdtemp(join(tmpdir(),'fa-me01-viewport-'));
  const server=createPreviewServer({subdomains:true});
  server.listen(2000,'127.0.0.1');
  await once(server,'listening');
  const proc=spawn(browser,[
    '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
    '--no-proxy-server','--disable-extensions','--disable-background-networking',
    '--no-first-run','--no-default-browser-check','--remote-debugging-port=0',
    '--host-resolver-rules=MAP app.localhost 127.0.0.1',
    '--user-data-dir='+temp,'about:blank'
  ],{stdio:['ignore','ignore','pipe']});
  let socket=null,stderr='';
  proc.stderr.on('data',v=>stderr+=v.toString());
  try {
    let endpoint;
    for(let i=0;i<100&&!endpoint;i++){
      endpoint=stderr.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];
      if(proc.exitCode!==null)throw Error('Chrome exited: '+stderr.slice(-900));
      if(!endpoint)await delay(100);
    }
    assert.ok(endpoint,'Chrome debugger unavailable: '+stderr.slice(-900));
    const host=new URL(endpoint).host;
    let tab;
    for(let i=0;i<40&&!tab;i++){
      try{tab=(await (await fetch('http://'+host+'/json/list')).json()).find(x=>x.type==='page');}catch{}
      if(!tab)await delay(100);
    }
    assert.ok(tab?.webSocketDebuggerUrl,'Chrome tab unavailable');
    socket=new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((ok,fail)=>{
      socket.addEventListener('open',ok,{once:true});
      socket.addEventListener('error',fail,{once:true});
    });
    let id=0;
    const pending=new Map();
    socket.addEventListener('message',event=>{
      const data=JSON.parse(event.data);
      const found=pending.get(data.id);
      if(!found)return;
      clearTimeout(found.timeout);
      pending.delete(data.id);
      data.error?found.reject(Error(data.error.message)):found.resolve(data.result);
    });
    function cmd(method,params={}){
      return new Promise((resolve,reject)=>{
        const number=++id;
        const timeout=setTimeout(()=>{
          pending.delete(number);reject(Error('Chrome CDP timeout: '+method));
        },14000);
        pending.set(number,{resolve,reject,timeout});
        socket.send(JSON.stringify({id:number,method,params}));
      });
    }
    async function evaluate(expression) {
      const result=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
      if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
      return result.result.value;
    }
    async function waitFor(expr) {
      for(let i=0;i<100;i++){
        try{if(await evaluate(expr))return;}catch{}
        await delay(100);
      }
      throw Error('Timed out waiting for: '+expr+' '+(await evaluate('document.body?.textContent?.slice(0,300)')));
    }
    await cmd('Page.enable');
    await cmd('Runtime.enable');
    await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await cmd('Page.navigate',{url:'http://app.localhost:2000/dev/match-engine'});
    await waitFor("document.readyState==='complete'&&document.querySelector('#advanced-settings')&&document.querySelector('#pitch')");
    await waitFor("document.querySelector('#status')?.textContent?.startsWith('Ready')");
    for(const [width,height] of [[1280,720],[1366,768],[1440,900],[1600,900],[1920,1080]]) {
      await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      for(const open of [false,true]){
        const source="(async()=>{"+
          "document.querySelector('#advanced-settings').open="+open+";"+
          "await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));"+
          "const pane=document.querySelector('.fa-shell-content-scroll');"+
          "const rect=id=>{const r=document.querySelector(id).getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height}};"+
          "return {width:innerWidth,height:innerHeight,open:"+open+","+
          "scroll:Math.max(0,pane.scrollHeight-pane.clientHeight),"+
          "field:rect('#pitch'),main:rect('.me-main-panel'),"+
          "elevation:rect('.me-elevation-panel'),advanced:rect('#advanced-settings'),"+
          "footer:rect('.app-footer'),pane:rect('.fa-shell-content-scroll'),"+
          "expanded:document.querySelector('#advanced-settings').open,"+
          "styles:{columns:getComputedStyle(document.querySelector('.me-field-grid')).gridTemplateColumns}};"+
          "})()";
        const sample=await evaluate(source);
        assert.equal(sample.expanded,open);
        process.stdout.write('ME01_VIEWPORT_MEASURE '+JSON.stringify(sample)+'\n');
        assert.ok(sample.scroll<=1.5,'desktop scrolling: '+JSON.stringify(sample));
        assert.ok(sample.field.width>=390,'field should not collapse: '+JSON.stringify(sample));
        assert.ok(sample.field.bottom<=sample.pane.bottom+1,'field clipped: '+JSON.stringify(sample));
        assert.ok(sample.advanced.bottom<=sample.pane.bottom+1,'advanced controls clipped: '+JSON.stringify(sample));
        if(open)assert.equal(sample.styles.columns.split(' ').length,3,'advanced XYZ must share one row');
        const expectedMin=new Map([[1280,590],[1366,640],[1440,795],[1600,830],[1920,1090]]).get(width);
        assert.ok(sample.field.width>=expectedMin,'field must grow to available screen: '+JSON.stringify(sample));
        assert.ok(sample.field.height>0&&Math.abs(sample.field.width/sample.field.height-105/68)<0.02,
          'pitch must preserve proportions: '+JSON.stringify(sample));
        process.stdout.write('ME01_VIEWPORT_PASS '+JSON.stringify({
          width,height,open,scroll:sample.scroll,fieldWidth:Math.round(sample.field.width),
          panelHeight:Math.round(sample.advanced.height)})+'\n');
      }
    }
    // Exercise actual DOM inputs and custom site-chevron buttons in real Chrome.
    await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    const numeric=await evaluate("(()=>{"+
      "const el=id=>document.getElementById(id);"+
      "el('advanced-settings').open=true;"+
      "const x=el('x'),z=el('z');"+
      "const step=(id,delta)=>document.querySelector('[data-me-spin=\"'+id+'\"][data-direction=\"'+delta+'\"]');"+
      "const beforeTick=el('tick').textContent;"+
      "x.value='3.25';x.dispatchEvent(new Event('input',{bubbles:true}));"+
      "step('x','1').click();const plus=x.value;"+
      "step('x','-1').click();const minus=x.value;"+
      "x.focus();const down=new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true});"+
      "x.dispatchEvent(down);const keyDown=x.value;"+
      "const up=new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true});"+
      "x.dispatchEvent(up);const keyUp=x.value;"+
      "x.value='3.256';x.dispatchEvent(new Event('change',{bubbles:true}));const decimal=x.value;"+
      "x.value='48.00';x.dispatchEvent(new Event('input',{bubbles:true}));"+
      "const maxDisabled=step('x','1').disabled;"+
      "x.value='3.25';x.dispatchEvent(new Event('input',{bubbles:true}));"+
      "z.value='0.80';z.dispatchEvent(new Event('input',{bubbles:true}));"+
      "const groundDisabled=step('z','-1').disabled;"+
      "step('z','1').click();const heightUp=z.value;"+
      "document.activeElement.blur();"+
      "const label=el('me-label-x');label.click();"+
      "const inertLabel=document.activeElement!==x&&getComputedStyle(label).transitionDuration==='0s'&&getComputedStyle(label).animationDuration==='0s';"+
      "const seed=el('seed');el('me-label-seed').click();"+
      "const inertSeed=document.activeElement!==seed;"+
      "return {plus,minus,keyDown,keyUp,keyPrevented:down.defaultPrevented&&up.defaultPrevented,decimal,maxDisabled,groundDisabled,heightUp,inertLabel,inertSeed,unchangedTick:el('tick').textContent===beforeTick};"+
    "})()");
    assert.deepEqual(numeric,{
      plus:'4.25',minus:'3.25',keyDown:'2.25',keyUp:'3.25',keyPrevented:true,
      decimal:'3.26',maxDisabled:true,groundDisabled:true,heightUp:'1.80',
      inertLabel:true,inertSeed:true,unchangedTick:true
    },'custom stepper values, keyboard semantics, decimals and inert labels');
    process.stdout.write('ME01_NUMERIC_CONTROLS_PASS '+JSON.stringify(numeric)+'\n');
    // LAB-04: inspect grass rolling deceleration in the real browser control flow.
    // Simulate fixed ticks using the existing Step button; no actual page clock is required.
    const rolling=await evaluate("(()=>{"+
      "const el=id=>document.getElementById(id);"+
      "el('preset-trigger').click();el('preset-opt-roll').click();"+
      "const scenario=el('preset').value, initial=el('ground-speed').textContent;"+
      "const startZ=el('z').value,initialHeight=el('height').textContent;"+
      "for(let i=0;i<60;i++)el('step').click();"+
      "const afterSecond=el('ground-speed').textContent;"+
      "for(let i=60;i<480;i++)el('step').click();"+
      "const stopped=el('ground-speed').textContent;"+
      "el('compare').click();"+
      "return {scenario,initial,startZ,initialHeight,afterSecond,stopped,"+
      "heightAfterStop:el('height').textContent,replay:el('compare-result').textContent,"+
      "reportedTime:el('tick').textContent};"+
    "})()");
    assert.equal(rolling.scenario,'roll');
    assert.equal(rolling.startZ,'0.00','rolling preset should start with zero clearance');
    assert.equal(rolling.initialHeight,'0.00 m','physical center 0.11m must display zero clearance');
    assert.equal(rolling.heightAfterStop,'0.00 m','settled rolling ball must read zero ground height');
    assert.ok(parseFloat(rolling.afterSecond)<parseFloat(rolling.initial)-0.35,
      'rolling ball must slow at grass contact: '+JSON.stringify(rolling));
    assert.ok(parseFloat(rolling.stopped)<0.1,
      'rolling ball must stop within 8 seconds: '+JSON.stringify(rolling));
    assert.match(rolling.replay,/^PASS/);
    process.stdout.write('ME01_GRASS_ROLL_PASS '+JSON.stringify(rolling)+'\n');
    // Z is user-facing underside clearance in every preset; internal Rapier center is offset.
    const zPresets=await evaluate("(()=>{"+
      "const el=id=>document.getElementById(id);"+
      "const values={};"+
      "for(const [name,option] of [['drop','preset-opt-drop'],['launch','preset-opt-launch'],['roll','preset-opt-roll']]){"+
      "el('preset-trigger').click();el(option).click();"+
      "values[name]={input:el('z').value,height:el('height').textContent};"+
      "}"+
      "return values;"+
    "})()");
    assert.deepEqual(zPresets,{
      drop:{input:'3.00',height:'3.00 m'},
      launch:{input:'0.80',height:'0.80 m'},
      roll:{input:'0.00',height:'0.00 m'}
    },'all presets must use bottom-of-ball clearance consistently');
    process.stdout.write('ME01_Z_CLEARANCE_PASS '+JSON.stringify(zPresets)+'\n');
    // LAB-05: 2m underside clearance, measured first bounce, then deterministic replay.
    const bounce=await evaluate("(()=>{"+
      "const el=id=>document.getElementById(id);"+
      "el('preset-trigger').click();el('preset-opt-bounce').click();"+
      "const initial={scenario:el('preset').value,z:el('z').value,height:el('height').textContent};"+
      "for(let i=0;i<360;i++)el('step').click();"+
      "const measured=el('bounce-result').textContent,hidden=el('bounce-result').hidden;"+
      "el('compare').click();"+
      "return {...initial,measured,hidden,replay:el('compare-result').textContent};"+
    "})()");
    assert.equal(bounce.scenario,'bounce');
    assert.equal(bounce.z,'2.00');
    assert.equal(bounce.height,'2.00 m');
    assert.equal(bounce.hidden,false,'first rebound should be visible after apex');
    assert.match(bounce.measured,/1st rebound ([0-9.]+) m/);
    const bounceHeight=Number(bounce.measured.match(/1st rebound ([0-9.]+) m/)[1]);
    assert.ok(bounceHeight>=0.60&&bounceHeight<=0.85,'provisional FIFA Quality Pro artificial-turf range: '+JSON.stringify(bounce));
    assert.match(bounce.replay,/^PASS/);
    process.stdout.write('ME02_BOUNCE_BROWSER '+JSON.stringify(bounce)+'\n');
    // ME-PHYS-03: modal A/B diagnostics must be real, independently measured data.
    const metrics=await evaluate("(()=>{"+
      "const el=id=>document.getElementById(id);"+
      "const before=el('tick').textContent;"+
      "el('measure').click();"+
      "const dialog=el('metrics-dialog');"+
      "const bounceRows=[...el('metrics-bounce-rows').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const rollRows=[...el('metrics-roll-rows').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const checkpoints=[...el('metrics-roll-checkpoints').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const spinRows=[...el('metrics-spin-rows').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const spinPoints=[...el('metrics-spin-checkpoints').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const grassRows=[...el('metrics-grass-rows').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const grassPoints=[...el('metrics-grass-checkpoints').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const flightRows=[...el('metrics-flight-rows').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const flightPoints=[...el('metrics-flight-checkpoints').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const dragRows=[...el('metrics-drag-rows').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const dragPoints=[...el('metrics-drag-checkpoints').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const speedRows=[...el('metrics-speed-rows').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const speedPoints=[...el('metrics-speed-checkpoints').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const magnusRows=[...el('metrics-magnus-rows').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const magnusPoints=[...el('metrics-magnus-checkpoints').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const combinedRows=[...el('metrics-combined-rows').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const combinedPoints=[...el('metrics-combined-checkpoints').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const calibrationDragRows=[...el('metrics-calibration-drag-rows').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const calibrationSideRows=[...el('metrics-calibration-side-rows').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const universalOrientationRows=[...el('metrics-universal-orientation-rows').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const universalGateRows=[...el('metrics-universal-gates').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const intakeRows=[...el('metrics-intake-sources').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const literatureRows=[...el('metrics-literature-rows').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const reviewRows=[...el('metrics-aero-review-rows').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const result={opened:dialog.open,title:el('metrics-title').textContent,bounceRows,rollRows,checkpoints,spinRows,spinPoints,grassRows,grassPoints,flightRows,flightPoints,dragRows,dragPoints,speedRows,speedPoints,magnusRows,magnusPoints,combinedRows,combinedPoints,calibrationDragRows,calibrationSideRows,universalOrientationRows,universalGateRows,intakeRows,literatureRows,reviewRows,"+
        "settle:el('metrics-bounce-stop').textContent,version:el('metrics-config').textContent,"+
        "unchanged:el('tick').textContent===before,chart:el('metrics-roll-chart').width,"+
        "spinChart:el('metrics-spin-chart').width,grassChart:el('metrics-grass-chart').width,"+
        "grassNote:el('metrics-grass-note').textContent,flightChart:el('metrics-flight-chart').width,"+
        "flightNote:el('metrics-flight-note').textContent,dragChart:el('metrics-drag-chart').width,"+
        "dragNote:el('metrics-drag-note').textContent,"+
        "speedCurveChart:el('metrics-speed-curve-chart').width,"+
        "speedRangeChart:el('metrics-speed-range-chart').width,"+
        "speedNote:el('metrics-speed-note').textContent,"+
        "magnusSideChart:el('metrics-magnus-side-chart').width,"+
        "magnusHeightChart:el('metrics-magnus-height-chart').width,"+
        "magnusNote:el('metrics-magnus-note').textContent,"+
        "combinedSideChart:el('metrics-combined-side-chart').width,"+
        "combinedDistanceChart:el('metrics-combined-distance-chart').width,"+
        "combinedNote:el('metrics-combined-note').textContent,"+
        "calibrationCdChart:el('metrics-calibration-cd-chart').width,"+
        "calibrationCsChart:el('metrics-calibration-cs-chart').width,"+
        "calibrationNote:el('metrics-calibration-note').textContent,"+
        "universalChart:el('metrics-universal-range-chart').width,"+
        "universalRangeNote:el('metrics-universal-range-note').textContent,"+
        "universalReadiness:el('metrics-universal-readiness').textContent,"+
        "intakeStatus:el('metrics-intake-status').textContent,"+
        "literatureChart:el('metrics-literature-cl-chart').width,"+
        "literatureNote:el('metrics-literature-note').textContent,"+
        "reviewVerdict:el('metrics-aero-review-verdict').textContent,"+
        "topFlightWidth:el('metrics-literature-topdown').width,"+
        "topFlightHeight:el('metrics-literature-topdown').height,"+
        "sideFlightWidth:el('metrics-literature-elevation').width,"+
        "sideFlightHeight:el('metrics-literature-elevation').height};"+
      "el('metrics-close').click();result.closed=!dialog.open;return result;"+
    "})()");
    assert.equal(metrics.opened,true);
    assert.equal(metrics.closed,true);
    assert.equal(metrics.unchanged,true,'diagnostics must not advance active scenario');
    assert.equal(metrics.chart,560);
    assert.equal(metrics.spinChart,560);
    assert.equal(metrics.grassChart,560);
    assert.equal(metrics.flightChart,560);
    assert.equal(metrics.dragChart,560);
    assert.deepEqual(metrics.dragRows.map(row=>row[0]),[
      'First ground contact (s)','First-flight XY travel (m)',
      'Maximum underside height (m)','Apex time (s)'
    ]);
    assert.ok(metrics.dragRows.every(row=>row.length===3));
    assert.ok(Number(metrics.dragRows[1][2])<Number(metrics.dragRows[1][1])-0.5);
    assert.ok(Number(metrics.dragRows[2][2])<Number(metrics.dragRows[2][1])-0.1);
    assert.equal(metrics.dragPoints[0][0],'0.00 s');
    assert.ok(metrics.dragPoints.every(row=>row.length===3));
    assert.ok(metrics.dragPoints.every(row=>row[1].includes(' / ')&&
      (row[2].includes(' / ')||row[2]==='After contact')));
    assert.match(metrics.dragNote,/normal LAB-02 remains Cd=0/);
    assert.equal(metrics.speedCurveChart,560);
    assert.equal(metrics.speedRangeChart,560);
    assert.equal(metrics.speedRows.length,9,'3 launch speeds x 3 coefficient models');
    assert.ok(metrics.speedRows.every(r=>r.length===8));
    assert.deepEqual([...new Set(metrics.speedRows.map(r=>r[0]))],
      ['7.00','15.00','30.00']);
    assert.deepEqual(metrics.speedRows.slice(0,3).map(r=>r[1]),
      ['Cd=0','Cd=0.24','Cd(v)']);
    assert.ok(Number(metrics.speedRows[2][5])<Number(metrics.speedRows[0][5]),
      'diagnostic Cd(v) must measurably shorten the first flight at low speed');
    assert.ok(Number(metrics.speedRows[8][5])<Number(metrics.speedRows[6][5]),
      'diagnostic Cd(v) must measurably shorten the first flight at high speed');
    assert.equal(metrics.speedPoints.length,12,'four precontact checkpoints per launch');
    assert.ok(metrics.speedPoints.every(r=>r.length===5));
    assert.match(metrics.speedNote,/hypotheses/);
    assert.match(metrics.speedNote,/normal LAB-02 remains Cd=0/);
    process.stdout.write('ME08_SPEED_DRAG_BROWSER '+JSON.stringify({
      rows:metrics.speedRows.length,checkpoints:metrics.speedPoints.length,
      lowSpeed:[metrics.speedRows[0][5],metrics.speedRows[2][5]],
      highSpeed:[metrics.speedRows[6][5],metrics.speedRows[8][5]]
    })+'\n');
    assert.equal(metrics.magnusSideChart,560);
    assert.equal(metrics.magnusHeightChart,560);
    assert.deepEqual(metrics.magnusRows.map(r=>r[0]),[
      'No spin','+Side spin (+Z)','−Side spin (−Z)','Topspin (+Y)','Backspin (−Y)'
    ]);
    assert.ok(metrics.magnusRows.every(r=>r.length===9));
    assert.equal(metrics.magnusPoints.length,25,'5 spin cases x 5 checkpoints');
    assert.ok(metrics.magnusPoints.every(r=>r.length===3));
    assert.ok(Number(metrics.magnusRows[1][4])>0.1&&
      Number(metrics.magnusRows[2][4])< -0.1,
      'side spin must bend to opposite Y directions');
    assert.ok(Number(metrics.magnusRows[3][5])<Number(metrics.magnusRows[0][5]));
    assert.ok(Number(metrics.magnusRows[4][5])>Number(metrics.magnusRows[0][5]));
    assert.ok(Math.abs(Number(metrics.magnusRows[0][1]))<0.01);
    assert.ok(metrics.magnusRows.slice(1).every(r=>Math.abs(Number(r[1])-6)<0.02));
    assert.match(metrics.magnusNote,/hypotheses/);
    assert.match(metrics.magnusNote,/normal LAB-02 remains Cd=0/);
    process.stdout.write('ME09_MAGNUS_BROWSER '+JSON.stringify({
      rows:metrics.magnusRows.length,checkpoints:metrics.magnusPoints.length,
      plusY:metrics.magnusRows[1][4],minusY:metrics.magnusRows[2][4],
      topPeak:metrics.magnusRows[3][5],backPeak:metrics.magnusRows[4][5]
    })+'\\n');
    assert.equal(metrics.combinedSideChart,560);
    assert.equal(metrics.combinedDistanceChart,560);
    assert.equal(metrics.combinedRows.length,36,'3 speeds × 3 spins × 4 modes');
    assert.ok(metrics.combinedRows.every(row=>row.length===10));
    assert.deepEqual([...new Set(metrics.combinedRows.map(row=>row[0]))],
      ['7.00','15.00','30.00']);
    assert.deepEqual(metrics.combinedRows.slice(0,4).map(row=>row[2]),
      ['No forces','Cd(v) only','Magnus only','Cd(v) + Magnus']);
    assert.ok(metrics.combinedRows.every(row=>row.slice(3).every(v=>Number.isFinite(Number(v)))),
      'all measured 1s/impact values must be finite');
    assert.equal(metrics.combinedPoints.length,45,'9 trial groups × 5 checkpoints');
    assert.ok(metrics.combinedPoints.every(row=>row.length===7));
    assert.ok(metrics.combinedPoints.every(row=>row.slice(3).every(v=>
      v==='Not observed'||v.split(' / ').length===2)));
    assert.ok(metrics.combinedPoints.some(row=>row.includes('Not observed')),
      'post-contact checkpoint must not be fabricated');
    const selected=(vx,spin,mode)=>metrics.combinedRows.find(row=>
      row[0]===vx&&row[1].startsWith(spin)&&row[2]===mode);
    assert.ok(Number(selected('15.00','+Z','Cd(v) + Magnus')[5])>0.02);
    assert.ok(Number(selected('15.00','−Z','Cd(v) + Magnus')[5])< -0.02);
    assert.equal(selected('15.00','No spin','No forces')[5],
      selected('15.00','No spin','Magnus only')[5]);
    assert.equal(selected('15.00','No spin','Cd(v) only')[5],
      selected('15.00','No spin','Cd(v) + Magnus')[5]);
    assert.match(metrics.combinedNote,/hypotheses/);
    assert.match(metrics.combinedNote,/Normal LAB-02 stays Cd=0/);
    process.stdout.write('ME10_COMBINED_BROWSER '+JSON.stringify({
      rows:metrics.combinedRows.length,
      checkpoints:metrics.combinedPoints.length,
      positiveAt15:selected('15.00','+Z','Cd(v) + Magnus')[5],
      negativeAt15:selected('15.00','−Z','Cd(v) + Magnus')[5]
    })+'\\n');
    assert.equal(metrics.calibrationCdChart,560);
    assert.equal(metrics.calibrationCsChart,560);
    assert.deepEqual(metrics.calibrationDragRows.map(row=>row.slice(0,2)),
      [['19.00','0.21'],['32.00','0.24']]);
    assert.deepEqual(metrics.calibrationDragRows.map(row=>row.slice(2)),
      [['0.21','0.00'],['0.24','0.00']]);
    assert.deepEqual(metrics.calibrationSideRows.map(row=>row.slice(0,2)),
      [['0.18','0.21'],['0.22','0.24'],['0.34','0.29']]);
    assert.deepEqual(metrics.calibrationSideRows.map(row=>row.slice(2)),
      [['0.11','-0.10'],['0.13','-0.11'],['0.20','-0.09']]);
    assert.match(metrics.calibrationNote,/NOT CALIBRATED/);
    assert.match(metrics.calibrationNote,/NOT independent validation/);
    assert.match(metrics.calibrationNote,/not a matched/);
    process.stdout.write('ME11_CALIBRATION_BROWSER '+JSON.stringify({
      dragRows:metrics.calibrationDragRows.length,
      spinRows:metrics.calibrationSideRows.length,
      spinResiduals:metrics.calibrationSideRows.map(x=>x[3])
    })+'\\n');
    assert.equal(metrics.universalChart,560);
    assert.deepEqual(metrics.universalOrientationRows,[
      ['A-90','48.65','0.35','0.24','0.27'],
      ['B-90','51.68','0.33','0.20','0.23']
    ]);
    assert.equal(metrics.universalGateRows.length,7);
    assert.deepEqual(metrics.universalGateRows.map(row=>row[1]),
      ['MISSING','PARTIAL','MISSING','MISSING','MISSING','MISSING','AVAILABLE']);
    assert.match(metrics.universalRangeNote,/3\.03 m/);
    assert.match(metrics.universalRangeNote,/NOT observed landings/);
    assert.match(metrics.universalReadiness,/CALIBRATION HOLD — EVIDENCE INCOMPLETE/);
    assert.match(metrics.universalReadiness,/available 1 \/ partial 1 \/ missing 5/);
    assert.match(metrics.universalReadiness,/Gameplay calibration approved: NO/);
    assert.match(metrics.universalReadiness,/same.*specimen|Same specimen|Same ball|single specimen|Same specimen|machine-readable/);
    process.stdout.write('ME12_SINGLE_BALL_BROWSER '+JSON.stringify({
      orientations:metrics.universalOrientationRows.length,
      gates:metrics.universalGateRows.length,
      range:metrics.universalOrientationRows.map(row=>row[1]),
      status:'CALIBRATION HOLD'
    })+'\\n');
    assert.equal(metrics.intakeRows.length,4);
    assert.ok(metrics.intakeRows.every(row=>row.length===4));
    assert.match(metrics.intakeRows[0][0],/Trionda 2026/);
    assert.match(metrics.intakeRows[1][0],/Soccer Ball 3D/);
    assert.match(metrics.intakeRows[1][1],/3D coordinates/);
    assert.equal(metrics.intakeRows[1][3],'CANDIDATE-ONLY');
    assert.match(metrics.intakeRows[2][0],/Ward et al\. 2023/);
    assert.match(metrics.intakeRows[2][1],/100–400 rpm/);
    assert.equal(metrics.intakeRows[2][2],'PARTIAL');
    assert.equal(metrics.intakeRows[2][3],'NONE');
    assert.match(metrics.intakeStatus,/NO VERIFIED MATCHED DATASET/);
    assert.match(metrics.intakeStatus,/CC BY-NC-SA-4\.0/);
    assert.match(metrics.intakeStatus,/No third-party raw files downloaded/);
    process.stdout.write('ME13_INTAKE_BROWSER '+JSON.stringify({
      sourceRows:metrics.intakeRows.length,
      calibrationRows:metrics.intakeRows.map(row=>row[2]),
      stage:'NO VERIFIED MATCHED DATASET'
    })+'\\n');
    assert.equal(metrics.literatureChart,560);
    assert.deepEqual([metrics.topFlightWidth,metrics.topFlightHeight],[560,320]);
    assert.deepEqual([metrics.sideFlightWidth,metrics.sideFlightHeight],[560,235]);
    assert.equal(metrics.reviewRows.length,9,
      'nine instantaneous model comparisons, no extra Rapier worlds');
    assert.deepEqual([...new Set(metrics.reviewRows.map(r=>r[0]))],
      ['7.00 m/s','15.00 m/s','30.00 m/s']);
    assert.deepEqual(metrics.reviewRows.slice(0,3).map(r=>r[1]),
      ['0.00 rev/s','3.00 rev/s','6.00 rev/s']);
    assert.ok(metrics.reviewRows.every(r=>r.length===6));
    const auditHigh=metrics.reviewRows[8];
    assert.equal(auditHigh[0],'30.00 m/s');
    assert.equal(auditHigh[1],'6.00 rev/s');
    const highCl=auditHigh[3].split(' / ').map(Number);
    assert.ok(highCl[0]<0.1&&highCl[1]>0.23);
    assert.ok(Number(auditHigh[4].replace('×',''))>2.8);
    assert.match(metrics.reviewVerdict,/RETAIN BOTH DIAGNOSTIC MODELS/);
    assert.match(metrics.reviewVerdict,/NO GLOBAL CALIBRATION/);
    assert.match(metrics.reviewVerdict,/Gameplay approved: NO/);
    process.stdout.write('ME21_AUDIT_BROWSER '+JSON.stringify({
      rows:metrics.reviewRows.length,highSp:auditHigh[2],
      oldCl:highCl[0],candidateCl:highCl[1],ratio:auditHigh[4],
      decision:'BOTH DIAGNOSTIC ONLY'
    })+'\\n');
    const axisQa=await evaluate("(()=>{"+
      "const el=id=>document.getElementById(id),canvas=el('metrics-spin-axis-elevation');"+
      "const rows=[...el('metrics-spin-axis-rows').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const im=canvas.getContext('2d').getImageData(45,30,495,160).data;"+
      "let teal=0,amber=0;for(let i=0;i<im.length;i+=4){"+
      "if(im[i]===147&&im[i+1]===220&&im[i+2]===204)teal++;"+
      "if(im[i]===255&&im[i+1]===212&&im[i+2]===124)amber++;}"+
      "return {rows,note:el('metrics-spin-axis-note').textContent,teal,amber};"+
    "})()");
    assert.deepEqual(axisQa.rows.map(r=>r[0]),
      ['No spin','+Z sidespin','−Z sidespin','+Y topspin','−Y backspin']);
    assert.ok(axisQa.rows.every(r=>r.length===6));
    const axisPair=v=>v.split(' / ').map(Number);
    assert.ok(axisPair(axisQa.rows[1][3])[0]>0);
    assert.ok(axisPair(axisQa.rows[2][3])[1]<0);
    assert.ok(axisPair(axisQa.rows[3][4])[1]<axisPair(axisQa.rows[0][4])[1]);
    assert.ok(axisPair(axisQa.rows[4][4])[1]>axisPair(axisQa.rows[0][4])[1]);
    assert.ok(axisQa.teal>4&&axisQa.amber>4,
      'both topspin/backspin elevation traces must paint real pixels');
    assert.match(axisQa.note,/10 isolated 60 Hz Rapier flights/);
    assert.match(axisQa.note,/Gameplay approved: NO/);
    process.stdout.write('ME22_AXIS_BROWSER '+JSON.stringify(axisQa)+'\n');
    const spinDecayQa=await evaluate("(()=>{"+
      "const el=id=>document.getElementById(id),c=el('metrics-spin-decay-chart');"+
      "const rows=[...el('metrics-spin-decay-rows').rows].map(r=>[...r.cells].map(x=>x.textContent));"+
      "const data=c.getContext('2d').getImageData(50,53,475,100).data;"+
      "let teal=0,amber=0;for(let i=0;i<data.length;i+=4){"+
      "if(data[i]===147&&data[i+1]===220&&data[i+2]===204)teal++;"+
      "if(data[i]===255&&data[i+1]===212&&data[i+2]===124)amber++;}"+
      "return {rows,note:el('metrics-spin-decay-note').textContent,teal,amber};"+
    "})()");
    assert.equal(spinDecayQa.rows.length,12);
    assert.ok(spinDecayQa.rows.every(r=>r.length===6));
    assert.deepEqual(spinDecayQa.rows.slice(0,3).map(r=>r[1]),
      ['0.00 s⁻¹','0.20 s⁻¹','0.50 s⁻¹']);
    const rev=s=>Number(s.split(' / ')[0]);
    assert.ok(rev(spinDecayQa.rows[0][2])>rev(spinDecayQa.rows[1][2]));
    assert.ok(rev(spinDecayQa.rows[1][2])>rev(spinDecayQa.rows[2][2]));
    assert.ok(Math.abs(rev(spinDecayQa.rows[0][2])-6)<0.02);
    assert.ok(Math.abs(rev(spinDecayQa.rows[1][2])-6*Math.exp(-0.2))<0.03);
    assert.ok(Math.abs(rev(spinDecayQa.rows[2][2])-6*Math.exp(-0.5))<0.03);
    assert.ok(rev(spinDecayQa.rows[0][3])>rev(spinDecayQa.rows[2][3]));
    assert.ok(spinDecayQa.teal>5&&spinDecayQa.amber>5,
      'both sensitivity curves must be painted, not just legends');
    assert.match(spinDecayQa.note,/24 independent 60 Hz Rapier flights/);
    assert.match(spinDecayQa.note,/Gameplay approved: NO/);
    process.stdout.write('ME23_SPIN_DECAY_BROWSER '+JSON.stringify({
      rows:spinDecayQa.rows.length,firstThree:spinDecayQa.rows.slice(0,3),
      teal:spinDecayQa.teal,amber:spinDecayQa.amber
    })+'\n');
    const retentionQa=await evaluate("(()=>{"+
      "const id=n=>document.getElementById(n),"+
      "rows=[...id('metrics-spin-retention-rows').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const link=[...document.querySelectorAll('[aria-labelledby=\"metrics-spin-retention-title\"] a')].map(a=>a.href);"+
      "const trialLink=[...id('metrics-spin-retention-title').parentElement.querySelectorAll('a')].map(a=>a.href);"+
      "return {rows,note:id('metrics-spin-retention-note').textContent,trialLink};"+
    "})()");
    assert.equal(retentionQa.rows.length,3,'one measured 0.8s checkpoint per sensitivity λ');
    assert.ok(retentionQa.rows.every(r=>r.length===4));
    assert.deepEqual(retentionQa.rows.map(r=>r[0]),['0.00 s⁻¹','0.20 s⁻¹','0.50 s⁻¹']);
    const retainedPct=s=>Number(s.split('%')[0]);
    const lossRatio=s=>Number(s.split('×')[0]);
    assert.ok(Math.abs(retainedPct(retentionQa.rows[0][1])-100)<0.1);
    assert.equal(retentionQa.rows[0][2],'0.00% / 0.00%');
    assert.equal(retentionQa.rows[0][3],'0.00× / 0.00×');
    assert.ok(Math.abs(retainedPct(retentionQa.rows[1][1])-85.21)<0.08);
    assert.ok(Math.abs(retainedPct(retentionQa.rows[2][1])-67.03)<0.08);
    assert.ok(Math.abs(retainedPct(retentionQa.rows[1][2])-14.79)<0.08);
    assert.ok(lossRatio(retentionQa.rows[1][3])>8);
    assert.ok(lossRatio(retentionQa.rows[2][3])>19);
    assert.match(retentionQa.note,/HOLD/);
    assert.match(retentionQa.note,/98\.28% in 0\.80 s/);
    assert.match(retentionQa.note,/periods differ/);
    assert.match(retentionQa.note,/Gameplay approved: NO/);
    assert.ok(retentionQa.trialLink.some(h=>h==='https://www.mdpi.com/2504-3900/49/1/88'));
    process.stdout.write('ME24_RETENTION_BROWSER '+JSON.stringify({
      rows:retentionQa.rows,decision:retentionQa.note.slice(0,115)
    })+'\n');
    const inputQa=await evaluate("(()=>{"+
      "const el=id=>document.getElementById(id),"+
      "rows=[...el('metrics-lift-input-rows').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "return {rows,note:el('metrics-lift-input-note').textContent};"+
    "})()");
    assert.equal(inputQa.rows.length,6,'three spin rates times two pure force laws');
    assert.ok(inputQa.rows.every(r=>r.length===8));
    assert.deepEqual(inputQa.rows.map(r=>r[0]),[
      '0.00 s⁻¹','0.00 s⁻¹','0.20 s⁻¹','0.20 s⁻¹',
      '0.50 s⁻¹','0.50 s⁻¹']);
    assert.deepEqual(inputQa.rows.map(r=>r[1]),[
      'Previous','Candidate','Previous','Candidate','Previous','Candidate']);
    for(const r of inputQa.rows){
      const v=r.slice(2).map(Number);
      assert.ok(v.every(Number.isFinite));
      assert.ok(v[0]>0&&v[1]>0);
      assert.ok(Math.abs(v[2]+v[3]-v[4])<0.02,
        'rounded velocity + spin contributions must close to total delta');
      assert.ok(Math.abs((v[1]-v[0])-v[4])<0.02);
      assert.equal(r[7],'0.00','actual model formula closure residual');
    }
    assert.ok(Math.abs(Number(inputQa.rows[0][5]))<0.01);
    assert.ok(Math.abs(Number(inputQa.rows[1][5]))<0.01);
    assert.ok(Number(inputQa.rows[4][5])<Number(inputQa.rows[2][5]));
    assert.ok(Number(inputQa.rows[5][5])<Number(inputQa.rows[3][5]));
    assert.match(inputQa.note,/6 rows, 4 pure force evaluations each, 0 new Rapier worlds/);
    assert.match(inputQa.note,/INCLUDES flight direction AND speed/);
    assert.match(inputQa.note,/NOT real ball validation/);
    assert.match(inputQa.note,/Gameplay approved: NO/);
    process.stdout.write('ME25_LIFT_INPUT_BROWSER '+JSON.stringify({
      rows:inputQa.rows,note:inputQa.note.slice(0,165)
    })+'\n');
    const contactQa=await evaluate("(()=>{"+
      "const el=id=>document.getElementById(id),"+
      "rows=[...el('metrics-contact-impact-rows').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "return {rows,note:el('metrics-contact-impact-note').textContent};"+
    "})()");
    assert.equal(contactQa.rows.length,5,'five independent real Rapier contact worlds');
    assert.deepEqual(contactQa.rows.map(r=>r[0]),
      ['No spin','+Y topspin','−Y backspin','+Z sidespin','−Z sidespin']);
    assert.ok(contactQa.rows.every(r=>r.length===11));
    for(const r of contactQa.rows){
      assert.ok(r.slice(1).every(x=>Number.isFinite(Number(x.replace('%','')))));
      assert.ok(Number(r[1])< -4&&Number(r[2])>1,
        'actual descending and upward impulse velocities');
      assert.ok(Number(r[3])>0&&Number(r[3])<1,
        'effective time-step rebound coefficient');
      assert.ok(Number(r[4])>0.1,'observed rebound apex');
      assert.ok(Number(r[9].replace('%',''))>0);
      assert.ok(Number(r[9].replace('%',''))<101,'no major unexplained energy creation');
      assert.ok(Number(r[10])>=0,'energy gain is reported, not discarded');
    }
    assert.ok(Number(contactQa.rows[1][5])<Number(contactQa.rows[2][5]),
      'topspin should have less bottom slip than backspin before impact');
    assert.ok(Number(contactQa.rows[1][7])>Number(contactQa.rows[2][7]),
      'forward outgoing speed changes under opposite signed roll spin');
    assert.ok(Math.abs(Number(contactQa.rows[3][7])-
      Number(contactQa.rows[4][7]))<0.05,'±Z symmetry');
    assert.match(contactQa.note,/5 disposable 60 Hz Rapier impact worlds/);
    assert.match(contactQa.note,/Aerodynamic forces|not the configured collider restitution/i);
    assert.match(contactQa.note,/Calibrated to real turf: NO/);
    assert.match(contactQa.note,/Gameplay approved: NO/);
    process.stdout.write('ME26_CONTACT_BROWSER '+JSON.stringify({
      rows:contactQa.rows,note:contactQa.note.slice(0,150)
    })+'\n');
    assert.equal(metrics.literatureRows.length,9);
    assert.ok(metrics.literatureRows.every(row=>row.length===6));
    assert.deepEqual([...new Set(metrics.literatureRows.map(row=>row[0]))],
      ['7.00 m/s','15.00 m/s','30.00 m/s']);
    assert.deepEqual(metrics.literatureRows.slice(0,3).map(row=>row[1]),
      ['0 rev/s','+Z 6 rev/s','−Z 6 rev/s']);
    assert.ok(metrics.literatureRows.every(row=>row.slice(2).every(cell=>
      cell.split(' / ').length===2&&
      cell.split(' / ').every(value=>Number.isFinite(Number(value))))));
    assert.match(metrics.literatureNote,/18 independent 60Hz worlds/);
    assert.match(metrics.literatureNote,/Model calibrated: NO/);
    assert.match(metrics.literatureNote,/Gameplay approved: NO/);
    process.stdout.write('ME17_LITERATURE_BROWSER '+JSON.stringify({
      rowCount:metrics.literatureRows.length,
      plus15:metrics.literatureRows.find(row=>row[0]==='15.00 m/s'&&row[1]==='+Z 6 rev/s'),
      stage:'PROVISIONAL DIAGNOSTIC'
    })+'\\n');
    assert.deepEqual(metrics.flightRows.map(r=>r[0]),[
      'First ground contact (s)','First-flight XY travel (m)',
      'Maximum underside height (m)','Time of maximum height (s)'
    ]);
    assert.equal(metrics.flightRows.length,4);
    assert.ok(metrics.flightRows.every(r=>r.length===3));
    assert.deepEqual(metrics.flightPoints.map(r=>r[0]),[
      '0.00 s','0.25 s','0.50 s','1.00 s','1.50 s','2.00 s'
    ]);
    assert.ok(metrics.flightPoints.every(r=>r.length===4));
    assert.ok(Number(metrics.flightRows[0][1])>2.0 && Number(metrics.flightRows[0][1])<2.3);
    assert.ok(Math.abs(Number(metrics.flightRows[2][1])-Number(metrics.flightRows[2][2]))<0.15);
    assert.ok(metrics.flightPoints.every(r=>Number(r[3])<0.01));
    assert.match(metrics.flightNote,/No drag\/Magnus/);
    assert.deepEqual(metrics.grassRows.map(r=>r[0]),['0.45','0.80 · default','1.50']);
    assert.equal(metrics.grassRows[1][5],'Baseline');
    assert.ok(metrics.grassRows.every(r=>r.length===6));
    assert.deepEqual(metrics.grassPoints.map(r=>r[0]),[
      '0.00 s','0.50 s','1.00 s','2.00 s','4.00 s',
      '6.00 s','8.00 s','10.00 s','12.00 s'
    ]);
    assert.ok(metrics.grassPoints.every(r=>r.length===4 &&
      r.slice(1).every(value=>value.split(' / ').length===3)));
    assert.ok(metrics.grassRows.every(r=>Number(r[1])>0),
      'effective m/s² must be calculated from actual rolling trajectory');
    assert.ok(Number(metrics.grassRows[0][4])>Number(metrics.grassRows[1][4]));
    assert.ok(Number(metrics.grassRows[1][4])>Number(metrics.grassRows[2][4]));
    assert.match(metrics.grassNote,/0\.80 m\/s² default is retained/);
    assert.deepEqual(metrics.spinRows.map(row=>row[0]),['0.00%','50.00%','100.00%']);
    assert.ok(metrics.spinRows.every(row=>row.length===6),'spin summary includes transition/energy');
    assert.deepEqual(metrics.spinPoints.map(row=>row[0]),[
      '0.00 s','0.10 s','0.25 s','0.50 s','1.00 s','2.00 s','4.00 s','6.00 s','7.00 s'
    ]);
    assert.ok(metrics.spinPoints.every(row=>row.length===4),'spin checkpoints all three variants');
    assert.ok(metrics.spinPoints.every(row=>row.slice(1).every(v=>v.split(' / ').length===4)));
    const omega=metrics.spinPoints[0].slice(1).map(value=>Number(value.split(' / ')[2]));
    assert.ok(Math.abs(omega[0])<0.01&&Math.abs(omega[1]-18.18)<0.02&&Math.abs(omega[2]-36.36)<0.02,
      'actual 0/half/full initial angular speeds (rad/s): '+omega);
    const first=metrics.spinPoints[0].slice(1).map(value=>Number(value.split(' / ')[1]));
    assert.ok(Math.abs(first[0]-4)<0.01&&Math.abs(first[1]-2)<0.01&&first[2]<0.01,
      '0 / 50 / 100% spin must begin at 4 / 2 / 0 m/s bottom slip: '+first);
    const speeds=metrics.spinPoints[4].slice(1).map(value=>Number(value.split(' / ')[0]));
    assert.ok(speeds[0]<speeds[1]&&speeds[1]<speeds[2],
      '1s rolling speed should depend on starting spin: '+speeds);
    assert.ok(Number(metrics.spinRows[0][3])<Number(metrics.spinRows[1][3]));
    assert.ok(Number(metrics.spinRows[1][3])<Number(metrics.spinRows[2][3]));
    assert.match(metrics.version,/me-01-physics-v4/);
    assert.ok(metrics.bounceRows.length>=3,'multiple bounce measurements expected');
    assert.ok(metrics.bounceRows.every(r=>r.length===5));
    assert.ok(metrics.bounceRows[0][3]!=='Not resolved');
    assert.deepEqual(metrics.rollRows.map(r=>r[0]),['2.00 m/s','4.00 m/s','6.00 m/s']);
    assert.equal(metrics.rollRows[1][4],'Baseline');
    assert.ok(metrics.rollRows.every(r=>r.length===5),'position and stop distance must appear');
    assert.ok(metrics.checkpoints[0][1].split(' / ').length===3,'speed, distance and slip must be displayed');
    assert.deepEqual(metrics.checkpoints.map(r=>r[0]),['0.00 s','1.00 s','2.00 s','4.00 s','8.00 s','12.00 s']);
    assert.ok(metrics.checkpoints.every(r=>r.length===4));
    assert.ok(parseFloat(metrics.rollRows[0][2])<parseFloat(metrics.rollRows[1][2]));
    assert.ok(parseFloat(metrics.rollRows[1][2])<parseFloat(metrics.rollRows[2][2]));
    assert.match(metrics.settle,/Sustained rest|No sustained rest observed/);
    process.stdout.write('ME03_DIAGNOSTICS_BROWSER '+JSON.stringify(metrics)+'\n');
    // QA-10 automated browser acceptance, beyond data-only assertions above:
    // inspect rendered curve pixels, theme colors/controls, native Escape,
    // scrollable mobile dialog and active-state preservation in real Chrome.
    const qaVisual=await evaluate("(()=>{"+
      "const el=id=>document.getElementById(id), d=el('metrics-dialog');"+
      "const before={tick:el('tick').textContent,seed:el('seed').value};"+
      "const theme=name=>{document.querySelector('[data-theme-choice='+name+']').click();"+
      "return {name:document.documentElement.dataset.theme,"+
      "pressed:document.querySelector('[data-theme-choice='+name+']').getAttribute('aria-pressed'),"+
      "color:getComputedStyle(d).backgroundColor,foreground:getComputedStyle(d).color};};"+
      "const light=theme('light'),dark=theme('dark');"+
      "el('measure').click();"+
      "function ink(id,hex){const canvas=el(id),ctx=canvas.getContext('2d'),"+
      "image=ctx.getImageData(45,39,490,90).data;"+
      "const rgb=hex.match(/../g).map(c=>parseInt(c,16));let count=0;"+
      "for(let i=0;i<image.length;i+=4)if(image[i]===rgb[0]&&"+
      "image[i+1]===rgb[1]&&image[i+2]===rgb[2])count++;return count;}"+
      "const colors={sidePositive:ink('metrics-magnus-side-chart','93dccc'),"+
      "sideNegative:ink('metrics-magnus-side-chart','ffd47c'),"+
      "sideBaseline:ink('metrics-magnus-side-chart','c5dee2'),"+
      "topspin:ink('metrics-magnus-height-chart','ffd47c'),"+
      "backspin:ink('metrics-magnus-height-chart','a8a6ff'),"+
      "heightBaseline:ink('metrics-magnus-height-chart','c5dee2'),"+
      "combinedPositive:ink('metrics-combined-side-chart','93dccc'),"+
      "combinedNegative:ink('metrics-combined-side-chart','ffd47c'),"+
      "combinedRange:ink('metrics-combined-distance-chart','a8a6ff'),"+
      "calibrationCdPrototype:ink('metrics-calibration-cd-chart','93dccc'),"+
      "calibrationCdEvidence:ink('metrics-calibration-cd-chart','ffd47c'),"+
      "calibrationCsPrototype:ink('metrics-calibration-cs-chart','93dccc'),"+
      "calibrationCsEvidence:ink('metrics-calibration-cs-chart','ffd47c'),"+
      "universalA:ink('metrics-universal-range-chart','93dccc'),"+
      "universalB:ink('metrics-universal-range-chart','ffd47c'),"+
      "literatureOld:ink('metrics-literature-cl-chart','93dccc'),"+
      "literatureNew:ink('metrics-literature-cl-chart','ffd47c')};"+
      "const checkpointRows=[...el('metrics-magnus-checkpoints').rows].map(r=>[...r.cells].map(c=>c.textContent));"+
      "const headings=[...d.querySelectorAll('h3')].map(h=>h.textContent);"+
      "const result={light,dark,opened:d.open,colors,"+
      "topspinAfterContact:checkpointRows.some(r=>r[0]==='Topspin (+Y)'&&r[1]==='2.00 s'&&r[2]==='Not observed'),"+
      "oldPanels:headings.some(x=>x.includes('ME-PHYS-07'))&&headings.some(x=>x.includes('ME-PHYS-08')),"+
      "unchanged:before.tick===el('tick').textContent&&before.seed===el('seed').value,"+
      "combinedPanel:headings.some(x=>x.includes('ME-PHYS-10')),"+
      "calibrationPanel:headings.some(x=>x.includes('ME-PHYS-11')),"+
      "universalPanel:headings.some(x=>x.includes('ME-PHYS-12')),"+
      "intakePanel:headings.some(x=>x.includes('ME-PHYS-13')),"+
      "adapterPanel:headings.some(x=>x.includes('ME-PHYS-14')),"+
      "evaluationPanel:headings.some(x=>x.includes('ME-PHYS-15')),"+
      "literaturePanel:headings.some(x=>x.includes('ME-PHYS-17')),"+
      "flightPanel:headings.some(x=>x.includes('ME-PHYS-18')),"+
      "flightVisual:(()=>{"+
        "const speed=el('metrics-literature-speed'),top=el('metrics-literature-topdown'),"+
        "side=el('metrics-literature-elevation');"+
        "const inkAll=(canvas,hex)=>{const rgb=hex.match(/../g).map(x=>parseInt(x,16)),"+
          "data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;"+
          "let n=0;for(let i=0;i<data.length;i+=4)"+
          "if(data[i]===rgb[0]&&data[i+1]===rgb[1]&&data[i+2]===rgb[2])n++;return n;};"+
        "const set=v=>{speed.value=v;speed.dispatchEvent(new Event('change',{bubbles:true}));"+
          "return {note:el('metrics-literature-trajectory-note').textContent,"+
          "top:top.toDataURL(),side:side.toDataURL()};};"+
        "const at30=set('30'),oldInk=inkAll(top,'93dccc'),"+
          "candidateInk=inkAll(top,'ffd47c'),baseInk=inkAll(top,'c5dee2'),"+
          "oldSideInk=inkAll(side,'93dccc'),candidateSideInk=inkAll(side,'ffd47c');"+
        "const at7=set('7'),at15=set('15'),again30=set('30');"+
        "return {oldInk,candidateInk,baseInk,oldSideInk,candidateSideInk,"+
          "changes:at7.top!==at30.top&&at15.top!==at7.top&&at15.side!==at30.side,"+
          "reproducible:at30.top===again30.top&&at30.side===again30.side,"+
          "notes:[at7.note,at15.note,at30.note]};"+
      "})()};"+
      "el('metrics-close').click();result.closeButton=!d.open;return result;"+
    "})()");
    assert.equal(qaVisual.light.name,'light');
    assert.equal(qaVisual.light.pressed,'true');
    assert.equal(qaVisual.dark.name,'dark');
    assert.equal(qaVisual.dark.pressed,'true');
    assert.notEqual(qaVisual.light.color,qaVisual.dark.color);
    assert.notEqual(qaVisual.light.foreground,qaVisual.dark.foreground);
    assert.ok(qaVisual.opened&&qaVisual.closeButton&&qaVisual.unchanged);
    assert.ok(qaVisual.oldPanels&&qaVisual.topspinAfterContact&&qaVisual.combinedPanel&&qaVisual.calibrationPanel&&qaVisual.universalPanel&&qaVisual.intakePanel&&qaVisual.adapterPanel&&qaVisual.evaluationPanel&&qaVisual.literaturePanel&&qaVisual.flightPanel);
    assert.ok(qaVisual.flightVisual.changes&&qaVisual.flightVisual.reproducible,
      '3 speed selections must draw distinct but repeatable real trajectories');
    assert.ok(qaVisual.flightVisual.oldInk>8&&
      qaVisual.flightVisual.candidateInk>8&&
      qaVisual.flightVisual.baseInk>8&&
      qaVisual.flightVisual.oldSideInk>8&&
      qaVisual.flightVisual.candidateSideInk>8,
      'both flight charts must contain painted Rapier paths, not just legends: '+
        JSON.stringify(qaVisual.flightVisual));
    assert.match(qaVisual.flightVisual.notes[0],/7 m\/s/);
    assert.match(qaVisual.flightVisual.notes[1],/15 m\/s/);
    assert.match(qaVisual.flightVisual.notes[2],/30 m\/s/);
    assert.ok(qaVisual.flightVisual.notes.every(note=>note.includes('top-down 1:1 axes')&&
      note.includes('All paths stop at contact')&&note.includes('NOT measured')));
    process.stdout.write('ME18_TRAJECTORY_BROWSER '+JSON.stringify({
      speeds:['7','15','30'],ink:{
        current:qaVisual.flightVisual.oldInk,candidate:qaVisual.flightVisual.candidateInk,
        zero:qaVisual.flightVisual.baseInk,
        sideCurrent:qaVisual.flightVisual.oldSideInk,
        sideCandidate:qaVisual.flightVisual.candidateSideInk
      },changed:true,reproducible:true
    })+'\\n');
    // ME-PHYS-19: interactive animated visual/transport verification in real
    // Chrome, not merely a DOM inventory. No active LAB-world mutation.
    const animation=await evaluate("(()=>{"+
      "const el=id=>document.getElementById(id);"+
      "const before={tick:el('tick').textContent,seed:el('seed').value};"+
      "el('measure').click();"+
      "const dialog=el('metrics-dialog'),"+
        "time=el('metrics-animation-time'),status=el('metrics-animation-status'),"+
        "seek=el('metrics-animation-timeline'),"+
        "speed=el('metrics-animation-speed'),"+
        "spin=el('metrics-animation-spin'),"+
        "top=el('metrics-animation-topdown'),side=el('metrics-animation-elevation');"+
      "const ink=(canvas,hex)=>{const rgb=hex.match(/../g).map(x=>parseInt(x,16)),"+
        "d=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;"+
        "let count=0;for(let i=0;i<d.length;i+=4)"+
        "if(d[i]===rgb[0]&&d[i+1]===rgb[1]&&d[i+2]===rgb[2])count++;return count;};"+
      "const beforeFrames=[top.toDataURL(),side.toDataURL()];"+
      "seek.value='100';seek.dispatchEvent(new Event('input',{bubbles:true}));"+
      "const afterFrames=[top.toDataURL(),side.toDataURL()];"+
      "const scrub={time:time.textContent,status:status.textContent,"+
        "before:beforeFrames[0]!==afterFrames[0]&&beforeFrames[1]!==afterFrames[1],"+
        "teal:ink(top,'93dccc'),amber:ink(top,'ffd47c'),"+
        "sideTeal:ink(side,'93dccc'),sideAmber:ink(side,'ffd47c'),"+
        "phaseOld:status.dataset.phasePrevious,phaseNew:status.dataset.phaseCandidate};"+
      "seek.value=seek.max;seek.dispatchEvent(new Event('input',{bubbles:true}));"+
      "const contact={old:status.dataset.phasePrevious,new:status.dataset.phaseCandidate,"+
        "terminal:time.textContent,play:el('metrics-animation-play').textContent};"+
      "speed.value='15';speed.dispatchEvent(new Event('change',{bubbles:true}));"+
      "const change={speed:el('metrics-literature-speed').value,"+
        "time:time.textContent,frame:top.toDataURL()!==beforeFrames[0]};"+
      "spin.value='minus';spin.dispatchEvent(new Event('change',{bubbles:true}));"+
      "const reverse={spin:spin.value,time:time.textContent};"+
      "el('metrics-animation-reset').click();"+
      "el('metrics-animation-play').click();"+
      "return {opened:dialog.open,scrub,contact,change,reverse,"+
        "playing:el('metrics-animation-play').textContent,"+
        "max:Number(seek.max),before,"+
        "unchanged:before.tick===el('tick').textContent&&before.seed===el('seed').value};"+
    "})()");
    assert.ok(animation.opened&&animation.unchanged);
    assert.ok(animation.scrub.before);
    assert.equal(animation.scrub.time,'1.00 s');
    assert.match(animation.scrub.status,/Previous: airborne/);
    assert.match(animation.scrub.status,/Candidate: airborne/);
    assert.ok(animation.scrub.teal>8&&animation.scrub.amber>8&&
      animation.scrub.sideTeal>8&&animation.scrub.sideAmber>8,
      'both animated traces must paint real model positions');
    assert.equal(animation.contact.old,'contact');
    assert.equal(animation.contact.new,'contact');
    assert.ok(animation.max>100&&animation.max<=350);
    assert.deepEqual(animation.change.speed,'15');
    assert.equal(animation.change.time,'0.00 s');
    assert.ok(animation.change.frame);
    assert.equal(animation.reverse.spin,'minus');
    assert.equal(animation.reverse.time,'0.00 s');
    assert.equal(animation.playing,'Pause');
    await delay(270);
    const advanced=await evaluate("(()=>{"+
      "const el=id=>document.getElementById(id),r=el('metrics-animation-timeline');"+
      "const elapsed=Number(r.value);el('metrics-animation-play').click();"+
      "return {elapsed,paused:el('metrics-animation-play').textContent,"+
        "phase:el('metrics-animation-status').dataset.phasePrevious,"+
        "tick:el('tick').textContent,seed:el('seed').value};"+
    "})()");
    assert.ok(advanced.elapsed>=8&&advanced.elapsed<animation.max,
      'Chrome must advance recorded playback without jumping to end: '+
        JSON.stringify(advanced));
    assert.equal(advanced.paused,'Play');
    assert.equal(advanced.tick,animation.before.tick);
    assert.equal(advanced.seed,animation.before.seed);
    await delay(120);
    assert.equal(await evaluate("Number(document.querySelector('#metrics-animation-timeline').value)"),
      advanced.elapsed,'paused animation must not advance in background');
    await evaluate("document.querySelector('#metrics-animation-play').click();true");
    assert.equal(await evaluate("document.querySelector('#metrics-animation-play').textContent"),'Pause');
    await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
    await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
    await delay(90);
    assert.equal(await evaluate("document.querySelector('#metrics-dialog').open"),false,
      'closing dialog with Escape must cancel animation');
    const resumed=await evaluate("(()=>{"+
      "const el=id=>document.getElementById(id);el('measure').click();"+
      "const v={time:el('metrics-animation-time').textContent,"+
        "play:el('metrics-animation-play').textContent,"+
        "tick:el('tick').textContent,seed:el('seed').value};"+
      "el('metrics-close').click();return v;"+
    "})()");
    assert.equal(resumed.time,'0.00 s');
    assert.equal(resumed.play,'Play');
    assert.equal(resumed.tick,animation.before.tick);
    assert.equal(resumed.seed,animation.before.seed);
    process.stdout.write('ME19_ANIMATED_BROWSER '+JSON.stringify({
      animated:true,scrub:true,firstContactClamp:true,
      elapsedHundredths:advanced.elapsed,
      reducedMotionSafe:true,closedStops:true,verifiedColors:true
    })+'\\n');
    // ME-PHYS-20 (QA-21): real Chrome verifies high-speed signed bends
    // match the physics snapshots, constant XY scale across spin sign,
    // and screen-reader announcements occur on phase transitions only.
    const motionQa=await evaluate("(()=>{"+
      "const el=id=>document.getElementById(id),d=el('metrics-dialog');"+
      "const before={tick:el('tick').textContent,seed:el('seed').value};"+
      "el('measure').click();"+
      "const speed=el('metrics-animation-speed'),spin=el('metrics-animation-spin'),"+
        "seek=el('metrics-animation-timeline'),status=el('metrics-animation-status'),"+
        "ann=el('metrics-animation-announcement');"+
      "const select=(input,value,kind)=>{input.value=value;"+
        "input.dispatchEvent(new Event(kind,{bubbles:true}));};"+
      "const shot=(sign)=>{select(spin,sign,'change');select(seek,'100','input');"+
        "return {old:Number(status.dataset.previousLateralM),"+
        "candidate:Number(status.dataset.candidateLateralM),"+
        "gap:Number(status.dataset.horizontalGapM),"+
        "scale:Number(status.textContent.match(/Top-down 1:1: ([0-9.]+) px\\/m/)[1]),"+
        "phases:[status.dataset.phasePrevious,status.dataset.phaseCandidate],"+
        "clock:el('metrics-animation-time').textContent};};"+
      "select(speed,'30','change');"+
      "const plus=shot('plus'),minus=shot('minus');"+
      "const oldAnnouncement=ann.textContent;"+
      "select(seek,'25','input');select(seek,'50','input');"+
      "const announcedEachFrame=ann.textContent!==oldAnnouncement;"+
      "const contactTimes=status.textContent.match(/contact ([0-9.]+) s/g)."+
        "map(x=>Number(x.match(/[0-9.]+/)[0]));"+
      "const firstContact=Math.ceil(Math.min(...contactTimes)*100)+1;"+
      "select(seek,String(firstContact),'input');"+
      "const announcedImpact=ann.textContent!==oldAnnouncement,"+
        "phasesAtFirst=[status.dataset.phasePrevious,status.dataset.phaseCandidate];"+
      "return {plus,minus,announcedEachFrame,announcedImpact,phasesAtFirst,"+
        "ariaLive:status.getAttribute('aria-live'),liveRegion:ann.getAttribute('aria-live'),"+
        "unchanged:before.tick===el('tick').textContent&&before.seed===el('seed').value,"+
        "noAutoplay:el('metrics-animation-play').textContent==='Play',"+
        "maxTime:Number(seek.max)};"+
    "})()");
    assert.ok(motionQa.unchanged&&motionQa.noAutoplay);
    assert.equal(motionQa.plus.clock,'1.00 s');
    assert.equal(motionQa.minus.clock,'1.00 s');
    assert.deepEqual(motionQa.plus.phases,['airborne','airborne']);
    assert.deepEqual(motionQa.minus.phases,['airborne','airborne']);
    assert.ok(motionQa.plus.old>1.5&&motionQa.plus.old<1.8);
    assert.ok(motionQa.plus.candidate>3.5&&motionQa.plus.candidate<4.5,
      '30m/s 6rev/s candidate high-speed bend must remain visible');
    assert.ok(motionQa.minus.old< -1.5&&motionQa.minus.old> -1.8);
    assert.ok(motionQa.minus.candidate< -3.5&&motionQa.minus.candidate> -4.5);
    assert.ok(Math.abs(motionQa.plus.old+motionQa.minus.old)<0.1);
    assert.ok(Math.abs(motionQa.plus.candidate+motionQa.minus.candidate)<0.2);
    assert.equal(motionQa.plus.scale,motionQa.minus.scale,
      'switching spin sign must not quietly zoom the top-down plot');
    assert.ok(motionQa.plus.gap>2&&motionQa.minus.gap>2);
    assert.equal(motionQa.ariaLive,'off');
    assert.equal(motionQa.liveRegion,'polite');
    assert.equal(motionQa.announcedEachFrame,false,
      'screen readers must not hear 60 live-region updates per second');
    assert.equal(motionQa.announcedImpact,true,
      'first contact transition must be announced once');
    assert.ok(motionQa.phasesAtFirst.includes('contact'));
    assert.ok(motionQa.maxTime>100);
    await evaluate("document.querySelector('#metrics-close').click();true");
    process.stdout.write('ME20_MOTION_QA '+JSON.stringify(motionQa)+'\\n');
    assert.ok(Object.values(qaVisual.colors).every(v=>v>4),
      'both charts must contain real, separate curves inside plot, not legends only: '+JSON.stringify(qaVisual));
    await evaluate("document.querySelector('#measure').click();true");
    assert.equal(await evaluate("document.querySelector('#metrics-dialog').open"),true);
    await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
    await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
    await delay(100);
    assert.equal(await evaluate("document.querySelector('#metrics-dialog').open"),false,
      'Escape must natively close the dialog');
    process.stdout.write('ME09_QA10_DESKTOP '+JSON.stringify(qaVisual)+'\\n');

    for(const [width,height] of [[320,640],[390,720]]){
      await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
      const modal=await evaluate("(async()=>{"+
        "const el=id=>document.getElementById(id),d=el('metrics-dialog');"+
        "const before={tick:el('tick').textContent,seed:el('seed').value};"+
        "el('measure').click();"+
        "await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));"+
        "const box=d.getBoundingClientRect(),table=d.querySelector('.me-metrics-table-scroll');"+
        "const data={width:innerWidth,height:innerHeight,opened:d.open,"+
        "left:box.left,right:box.right,top:box.top,bottom:box.bottom,"+
        "scrollHeight:d.scrollHeight,clientHeight:d.clientHeight,"+
        "overflow:getComputedStyle(d).overflowY,"+
        "tableOverflow:getComputedStyle(table).overflowX,"+
        "preserved:before.tick===el('tick').textContent&&before.seed===el('seed').value};"+
        "d.scrollTop=d.scrollHeight;"+
        "await new Promise(r=>requestAnimationFrame(r));"+
        "data.scrolled=d.scrollTop;el('metrics-close').click();"+
        "data.closed=!d.open;return data;"+
      "})()");
      assert.ok(modal.opened&&modal.closed&&modal.preserved);
      assert.ok(modal.left>=-1&&modal.right<=modal.width+1,
        'dialog clipped horizontally: '+JSON.stringify(modal));
      assert.ok(modal.top>=-1&&modal.bottom<=modal.height+1,
        'dialog clipped vertically: '+JSON.stringify(modal));
      assert.ok(modal.scrollHeight>modal.clientHeight+100&&modal.scrolled>100,
        'dialog must scroll internally at '+width+'px: '+JSON.stringify(modal));
      assert.match(modal.overflow,/auto|scroll/);
      assert.match(modal.tableOverflow,/auto|scroll/);
      process.stdout.write('ME09_QA10_MOBILE '+JSON.stringify(modal)+'\\n');
    }
    await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    // Narrow layouts can scroll instead of clipping controls.
    await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:720,deviceScaleFactor:1,mobile:true});
    const mobile=await evaluate("(async()=>{"+
      "document.querySelector('#advanced-settings').open=true;"+
      "await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));"+
      "return {width:document.querySelector('#pitch').getBoundingClientRect().width,"+
      "input:document.querySelector('#vz').getBoundingClientRect().width,"+
      "visibility:getComputedStyle(document.querySelector('#compare')).display};"+
      "})()");
    assert.ok(mobile.width>180&&mobile.width<390&&mobile.input>0);
    assert.notEqual(mobile.visibility,'none');
  }finally{
    try{socket?.close();}catch{}
    proc.kill();
    await new Promise(resolve=>server.close(resolve));
    await rm(temp,{recursive:true,force:true,maxRetries:3,retryDelay:300});
  }
});
