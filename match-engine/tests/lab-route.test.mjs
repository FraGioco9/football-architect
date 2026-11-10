import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request} from 'node:http';
import {readdirSync,existsSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createPreviewServer} from '../../tools/dev-standings-preview.mjs';
import {addDevelopmentToAppHtml,renderMatchEngineLab,labFirstPaintBootstrap,sidebarFromAppPage} from '../src/sidebar-shell.mjs';
import {drawPitchMarkings,pitchProjection,PITCH_LENGTH_M,PITCH_WIDTH_M} from '../src/pitch-markings.mjs';
import {NUMERIC_BOUNDS,formatNumericValue,stepNumericValue} from '../src/numeric-controls.mjs';
import {isAllowlistedPublicPath,planPublicFiles} from '../../tools/publication-guard.mjs';

const getServer = async options => {
  const server = createPreviewServer(options);
  server.listen(0, '127.0.0.1');
  await once(server,'listening');
  return server;
};
async function fetchLocal(server,path,{host='app.localhost:2000',method='GET'}={}){
  return await new Promise((resolve,reject)=>{
    const req=request({host:'127.0.0.1',port:server.address().port,path,method,headers:{host}},res=>{
      let body='';
      res.setEncoding('utf8');
      res.on('data',part=>{if(body.length<120000)body+=part.slice(0,120000-body.length);});
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));
    });
    req.on('error',reject);req.end();
  });
}
test('ME-01 lab is accessible on local DEV app host with strict headers and assets',async()=>{
 const server=await getServer({subdomains:true});
 try{
  for(const path of ['/dev/match-engine','/__fa_match_engine__/core.mjs','/__fa_match_engine__/aerodynamics.mjs','/__fa_match_engine__/magnus.mjs','/__fa_match_engine__/calibration-evidence.mjs','/__fa_match_engine__/universal-ball-readiness.mjs','/__fa_match_engine__/calibration-dataset-intake.mjs','/__fa_match_engine__/ball3d-trajectory-adapter.mjs','/__fa_match_engine__/literature-aero-candidate.mjs','/__fa_match_engine__/flight-playback.mjs','/__fa_match_engine__/aero-model-review.mjs','/__fa_match_engine__/spin-axis-qa.mjs','/__fa_match_engine__/spin-decay-qa.mjs','/__fa_match_engine__/spin-retention-evidence.mjs','/__fa_match_engine__/lift-input-qa.mjs','/__fa_match_engine__/contact-impact-qa.mjs','/__fa_match_engine__/player-movement.mjs','/__fa_match_engine__/lab.mjs','/__fa_match_engine__/lab.css','/__fa_match_engine__/sidebar-first-paint.js','/__fa_match_engine__/pitch-markings.mjs','/__fa_match_engine__/numeric-controls.mjs','/__fa_match_engine__/rebound-metrics.mjs','/__fa_match_engine__/physics-diagnostics.mjs']){
   const r=await fetchLocal(server,path);
   assert.equal(r.status,200,path);
   assert.equal(r.headers['cache-control'],'private, no-store');
   assert.match(r.headers['content-security-policy'],/default-src 'none'/);
  }
  const wasm=await fetchLocal(server,'/__fa_match_engine__/rapier.es.js',{method:'HEAD'});
  const moduleRoot = new URL('../node_modules/@dimforge/rapier3d-deterministic-compat/', import.meta.url);
  const installedFiles = existsSync(moduleRoot) ? readdirSync(moduleRoot) : ['package directory missing'];
  const packageMeta = existsSync(new URL('package.json',moduleRoot))
    ? JSON.parse(readFileSync(new URL('package.json',moduleRoot),'utf8')) : {};
  assert.equal(wasm.status,200,'compat ESM module missing. Package files='+installedFiles.join(',')+
    ', module='+String(packageMeta.module)+', exports='+JSON.stringify(packageMeta.exports));
  const page = await fetchLocal(server,'/dev/match-engine');
  assert.match(page.body,/LAB-01/);
  assert.match(page.body,/LAB-04 · Ball Roll \(Grass\)/);
  assert.match(page.body,/LAB-05 · Ball Bounce \(2 m\)/);
  assert.match(page.body,/id="players-toggle"/);
  assert.match(page.body,/id="player-controls"[^>]*hidden/);
  assert.match(page.body,/ME-PLAYER-01 autonomous team movement/);
  assert.match(page.body,/id="player-inspect-choice"[^>]*aria-label="Read-only inspect autonomous player"/);
  for(const id of ['player-ball-sector','player-pressing','player-inspection','player-inspection-duty'])
    assert.match(page.body,new RegExp('id="'+id+'"'));
  assert.doesNotMatch(page.body,/id="player-duty-pace"|id="player-duty-directions"|id="player-duty-travel"|id="player-duty-history"|id="player-recent-motion"|id="player-motion-vectors"|id="player-trails-toggle"|id="player-detour-progress"|id="player-support-width"/);
  assert.match(page.body,/Players move automatically/);
  assert.doesNotMatch(page.body,/id="player-select"|data-player-direction|Move selected player|WASD\/arrow keys/);
  assert.match(page.body,/id="bounce-result"/);
  assert.match(page.body,/id="measure" class="me-button"/);
  assert.match(page.body,/<dialog id="metrics-dialog" class="me-metrics-dialog"/);
  assert.match(page.body,/ME-PHYS-05 · Natural-grass sensitivity/);
  assert.match(page.body,/ME-PHYS-06 · LAB-02 flight baseline/);
  assert.match(page.body,/ME-PHYS-07 · Air drag A\/B experiment/);
  assert.match(page.body,/ME-PHYS-08 · Speed-dependent Cd\(v\) research/);
  assert.match(page.body,/ME-PHYS-09 · Magnus spin \/ flight A\/B/);
  assert.match(page.body,/ME-PHYS-10 · Combined Cd\(v\) \+ Magnus flight diagnostics/);
  assert.match(page.body,/ME-PHYS-11 · Aerodynamic calibration evidence audit/);
  assert.match(page.body,/ME-PHYS-12 · Single-ball calibration readiness gate/);
  assert.match(page.body,/ME-PHYS-13 · Verified dataset intake and flight holdout/);
  assert.match(page.body,/ME-PHYS-14 · Offline 3D trajectory unit adapter/);
  assert.match(page.body,/ME-PHYS-15 · Independent 3D trajectory error protocol/);
  assert.match(page.body,/ME-PHYS-17 · One-ball literature-inspired aerodynamic candidate/);
  assert.match(page.body,/ME-PHYS-18 · Visual pre-impact shot trajectory QA/);
  assert.match(page.body,/ME-PHYS-19 · Synchronized shot animation/);
  assert.match(page.body,/ME-PHYS-21 · Coefficient parameterization audit/);
  assert.match(page.body,/ME-PHYS-22 · Spin axes: sidespin, topspin and backspin/);
  assert.match(page.body,/ME-PHYS-23 · In-flight spin decay — controlled sensitivity/);
  assert.match(page.body,/ME-PHYS-24 · Observed spin retention vs published free-flight trial/);
  assert.match(page.body,/ME-PHYS-25 · Velocity-vector vs spin-vector lift attribution/);
  assert.match(page.body,/ME-PHYS-26 · First ground contact and spin rebound audit/);
  assert.match(page.body,/STATIC SNAPSHOTS, NOT NEW FLIGHT MEASUREMENTS/);
  assert.match(page.body,/SIMULATED MOTION ONLY/);
  assert.match(page.body,/PROVISIONAL DIAGNOSTIC — NOT A CALIBRATED UNIVERSAL BALL/);
  assert.match(page.body,/SCIENTIFIC HOLD — NO VERIFIED REAL FLIGHT HOLDOUT/);
  assert.match(page.body,/CONVERSION ONLY — NOT CALIBRATED OR LICENSED FOR GAME USE/);
  assert.match(page.body,/NO VERIFIED MATCHED DATASET/);
  assert.match(page.body,/Ward et al\. \(2023\)/);
  assert.match(page.body,/100–400 rpm/);
  assert.match(page.body,/CC BY-NC-SA 4\.0/);
  assert.match(page.body,/CALIBRATION HOLD — EVIDENCE INCOMPLETE/);
  assert.match(page.body,/RESEARCH AUDIT — NOT CALIBRATED/);
  assert.match(page.body,/36 independent Rapier worlds/);
  assert.match(page.body,/experimental hypotheses/);
  assert.match(page.body,/Cd is calculated from total 3D speed including vy and vz/);
  assert.equal((page.body.match(/Launch vx \(m\/s\)/g)||[]).length,3);
  assert.match(page.body,/No default\/gameplay physics parameters are changed/);
  assert.match(page.body,/Cd=0\.24 is illustrative/);
  assert.match(page.body,/Baker \(1989\)/);
  assert.match(page.body,/0\.45 \/ 0\.80 \/ 1\.50 m\/s²/);
  for(const id of ['metrics-bounce-rows','metrics-roll-rows','metrics-roll-checkpoints','metrics-roll-chart','metrics-spin-rows','metrics-spin-checkpoints','metrics-spin-chart','metrics-grass-rows','metrics-grass-checkpoints','metrics-grass-chart','metrics-flight-rows','metrics-flight-checkpoints','metrics-flight-chart','metrics-drag-rows','metrics-drag-checkpoints','metrics-drag-chart','metrics-speed-rows','metrics-speed-checkpoints','metrics-speed-curve-chart','metrics-speed-range-chart','metrics-speed-note','metrics-magnus-side-chart','metrics-magnus-height-chart','metrics-magnus-rows','metrics-magnus-checkpoints','metrics-magnus-note','metrics-combined-side-chart','metrics-combined-distance-chart','metrics-combined-rows','metrics-combined-checkpoints','metrics-combined-note','metrics-calibration-cd-chart','metrics-calibration-cs-chart','metrics-calibration-drag-rows','metrics-calibration-side-rows','metrics-calibration-note','metrics-universal-range-chart','metrics-universal-orientation-rows','metrics-universal-gates','metrics-universal-range-note','metrics-universal-readiness','metrics-intake-sources','metrics-intake-status','metrics-literature-cl-chart','metrics-literature-rows','metrics-literature-note','metrics-aero-review-title','metrics-aero-review-rows','metrics-aero-review-verdict','metrics-spin-axis-title','metrics-spin-axis-elevation','metrics-spin-axis-rows','metrics-spin-axis-note','metrics-spin-decay-title','metrics-spin-decay-chart','metrics-spin-decay-rows','metrics-spin-decay-note','metrics-spin-retention-title','metrics-spin-retention-rows','metrics-spin-retention-note','metrics-lift-input-title','metrics-lift-input-rows','metrics-lift-input-note','metrics-contact-impact-title','metrics-contact-impact-rows','metrics-contact-impact-note','metrics-literature-speed','metrics-literature-topdown','metrics-literature-elevation','metrics-literature-trajectory-note','metrics-animation-speed','metrics-animation-spin','metrics-animation-play','metrics-animation-reset','metrics-animation-timeline','metrics-animation-time','metrics-animation-topdown','metrics-animation-elevation','metrics-animation-status','metrics-animation-announcement','metrics-close'])
    assert.match(page.body,new RegExp('id="'+id+'"'));
  assert.match(page.body,/id="ground-speed"/);
  assert.match(page.body,/data-nav01-static/);
  assert.match(page.body,/data-me-dev-link aria-current="page"/);
  assert.match(page.body,/Development<\/h2>/);
  assert.match(page.body,/>Match Engine<\/span>/);
  assert.doesNotMatch(page.body,/>Match Engine Lab<\/span>/);
  assert.match(page.body,/id="nav01-children"/);
  assert.match(page.body,/id="app-nav-profile"/);
  assert.match(page.body,/data-nav01-clubs/);
  assert.match(page.body,/data-nav01-guide/);
  assert.match(page.body,/id="app-nav-settings"/);
  assert.match(page.body,/data-nav01-guide/);
  assert.match(page.body,/id="app-nav-profile"/);
  assert.match(page.body,/src="\/__fa_match_engine__\/sidebar-first-paint\.js"/);
  assert.match(page.body,/src="\/assets\/sidebar-evolution\.js"/);
  assert.match(page.body,/src="\/assets\/profile-navigation\.js"/);
  assert.match(page.body,/href="\/assets\/sidebar-evolution\.css"/);
  assert.match(page.body,/href="\/assets\/landing\.css"/);
  assert.match(page.body,/href="\/assets\/app\.css"/);
  assert.match(page.body,/src="\/assets\/theme\.js"/);
  assert.match(page.body,/href="\/__fa_match_engine__\/lab\.css"/);
  assert.match(page.body,/class="language-trigger"/);
  assert.match(page.body,/data-me-dropdown="preset"/);
  assert.match(page.body,/data-me-dropdown="speed"/);
  assert.match(page.body,/aria-haspopup="listbox"/);
  assert.match(page.body,/role="combobox"/);
  assert.match(page.body,/role="option" tabindex="-1"/);
  assert.match(page.body,/data-theme-choice="dark"/);
  assert.match(page.body,/data-theme-choice="light"/);
  assert.match(page.body,/class="fa-career-shell"/);
  assert.match(page.body,/class="fa-shell-topbar"/);
  assert.match(page.body,/class="app-panel me-panel/);
  assert.match(page.body,/id="lab-title">Match Engine<\/h1>/);
  assert.match(page.body,/id="preset-trigger"/);
  assert.match(page.body,/id="speed-trigger"/);
  assert.match(page.body,/id="pitch"/);
  assert.match(page.body,/class="me-canvas-frame me-pitch-frame"/);
  assert.match(page.body,/Complete 105 by 68 meter football field/);
  assert.match(page.body,/<svg class="language-chevron me-details-chevron" viewBox="0 0 20 20"/);
  assert.match(page.body,/<path d="m5 7 5 5 5-5" fill="none" stroke="currentColor"/);
  assert.doesNotMatch(page.body,/class="me-details-chevron">⌄/);
  assert.match(page.body,/id="height"/);
  assert.match(page.body,/Height above ground/);
  assert.match(page.body,/id="z" type="number" inputmode="decimal" step="any" min="0" max="30"/);
  assert.match(page.body,/Distance from ball underside to the pitch over simulated time/);
  assert.match(page.body,/id="elevation"/);
  assert.match(page.body,/<details class="app-panel me-advanced" id="advanced-settings">/);
  assert.doesNotMatch(page.body,/<details[^>]*id="advanced-settings"[^>]*open/);
  assert.match(page.body,/<summary>Advanced settings/);
  assert.equal((page.body.match(/id="advanced-settings"/g) || []).length,1);
  assert.equal((page.body.match(/id="pitch"/g) || []).length,1);
  assert.equal((page.body.match(/id="speed"/g) || []).length,1);
  assert.equal((page.body.match(/id="preset"/g) || []).length,1);
  const mainViewport = page.body.slice(page.body.indexOf('id="lab-title"'),
    page.body.indexOf('<details class="app-panel me-advanced"'));
  for (const control of ['play','pause','step','reset'])
    assert.match(mainViewport,new RegExp('id="'+control+'"'));
  assert.doesNotMatch(mainViewport,/id="vx"|id="vy"|id="vz"|id="compare"/,
    'technical configuration must stay inside collapsed Advanced settings');
  for (const technical of ['x','y','z','vx','vy','vz','seed','apply','compare','position','velocity'])
    assert.match(page.body,new RegExp('id="'+technical+'"'));
  assert.doesNotMatch(page.body,/Foundation · v1|TOP DOWN · X \/ Y|TEST INPUTS/,
    'remove repeated diagnostic decorations from the simplified view');
  assert.match(page.headers['content-security-policy'],/style-src 'self' 'unsafe-inline'/);
  for (const shared of ['/assets/landing.css','/assets/app.css','/assets/theme.js','/assets/brand/symbol-dark.svg','/assets/sidebar-evolution.css','/assets/sidebar-evolution.js','/assets/profile-navigation.js']) {
    assert.equal((await fetchLocal(server,shared)).status,200,shared);
  }
  const bootstrap = await fetchLocal(server,'/__fa_match_engine__/sidebar-first-paint.js');
  assert.match(bootstrap.body,/path==='\/dev\/match-engine'/);
  assert.match(bootstrap.body,/fa-nav01-expanded/);
  const app = await fetchLocal(server,'/dashboard');
  assert.equal(app.status,200);
  assert.match(app.body,/data-me-dev-link/);
  assert.equal((app.body.match(/data-me-dev-link/g) || []).length,1);
  assert.match(app.body,/id="nav01-children"/);
  assert.match(app.body,/data-nav01-guide/);
  assert.match(app.body,/id="app-nav-profile"/);
  const siteHost = await fetchLocal(server,'/dashboard',{host:'localhost:2000'});
  assert.doesNotMatch(siteHost.body,/data-me-dev-link/);
  assert.equal((await fetchLocal(server,'/dev/match-engine',{method:'POST'})).status,405);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('ME-01 lab is denied for public mode, shared/non-DEV modes and other hosts',async()=>{
 for(const options of [{subdomains:true,devPreview:false},{subdomains:false},{subdomains:true}]){
  const server=await getServer(options);
  try{
   const host=options.devPreview===false?'app.localhost:2000':'localhost:2000';
   assert.ok([403,404].includes((await fetchLocal(server,'/dev/match-engine',{host})).status));
   assert.ok([403,404].includes((await fetchLocal(server,'/__fa_match_engine__/core.mjs',{host})).status));
   assert.ok([403,404].includes((await fetchLocal(server,'/__fa_match_engine__/aerodynamics.mjs',{host})).status));
   assert.ok([403,404].includes((await fetchLocal(server,'/__fa_match_engine__/magnus.mjs',{host})).status));
   assert.ok([403,404].includes((await fetchLocal(server,'/__fa_match_engine__/calibration-evidence.mjs',{host})).status));
   assert.ok([403,404].includes((await fetchLocal(server,'/__fa_match_engine__/universal-ball-readiness.mjs',{host})).status));
   assert.ok([403,404].includes((await fetchLocal(server,'/__fa_match_engine__/calibration-dataset-intake.mjs',{host})).status));
   assert.ok([403,404].includes((await fetchLocal(server,'/__fa_match_engine__/ball3d-trajectory-adapter.mjs',{host})).status));
   assert.ok([403,404].includes((await fetchLocal(server,'/__fa_match_engine__/literature-aero-candidate.mjs',{host})).status));
   assert.ok([403,404].includes((await fetchLocal(server,'/__fa_match_engine__/flight-playback.mjs',{host})).status));
   assert.ok([403,404].includes((await fetchLocal(server,'/__fa_match_engine__/aero-model-review.mjs',{host})).status));
   const page = await fetchLocal(server,'/dashboard',{host});
   if(page.status===200)assert.doesNotMatch(page.body,/data-me-dev-link/);
   assert.ok([403,404].includes((await fetchLocal(server,'/__fa_match_engine__/sidebar-first-paint.js',{host})).status));
  }finally{await new Promise(resolve=>server.close(resolve));}
 }
});
test('Lab sidebar preserves every canonical section and link, adding only Development', () => {
  const source=readFileSync(new URL('../../dashboard/index.html',import.meta.url),'utf8');
  const canonical=sidebarFromAppPage(source);
  const augmented=addDevelopmentToAppHtml(source);
  const aside=sidebarFromAppPage(augmented);
  const development=/<section class="fa-shell-nav-group" aria-labelledby="me-nav-development">[\s\S]*?<\/section>\n        /;
  assert.equal(aside.replace(development,''),canonical,'existing sidebar bytes must not change');
  assert.equal((aside.match(/data-me-dev-link/g)||[]).length,1,'exactly one DEV page link');
  assert.equal(addDevelopmentToAppHtml(augmented),augmented,'idempotent injection');
  const template='<main>before</main><!-- ME-01_CANONICAL_SIDEBAR --><main>after</main>';
  const lab=renderMatchEngineLab(template,source);
  assert.match(lab,/data-me-dev-link aria-current="page"/);
  assert.doesNotMatch(lab,/class="fa-shell-link is-active" id="app-nav-dashboard"/);
  assert.match(lab,/src="\/__fa_match_engine__\/sidebar-first-paint\.js"/);
  assert.match(lab,/id="app-nav-profile"/);
  assert.match(lab,/data-nav01-guide/);
  assert.match(lab,/id="nav01-children"/);
  assert.match(lab,/class="app-brand" href="http:\/\/localhost:2000\/"/);
  assert.match(lab,/href="http:\/\/localhost:2000\/guide" data-nav01-guide/);
  assert.throws(()=>renderMatchEngineLab(template,'not a dashboard'),/sidebar/);
  assert.throws(()=>labFirstPaintBootstrap('invalid'),/selection contract/);
});
test('Lab-first-paint script keeps canonical navigation logic except active DEV route', () => {
  const original=readFileSync(new URL('../../assets/sidebar-first-paint.js',import.meta.url),'utf8');
  const adapted=labFirstPaintBootstrap(original);
  assert.ok(adapted.includes("const selected=path==='/dev/match-engine'"));
  assert.ok(adapted.includes("nav.querySelector('[data-me-dev-link]')"));
  assert.equal(adapted.replace("const selected=path==='/dev/match-engine'?nav.querySelector('[data-me-dev-link]'):onClubs?","const selected=onClubs?"),original);
});


test('ME-01 numeric steppers preserve fractional part and move exactly 1.00', () => {
  assert.equal(Object.keys(NUMERIC_BOUNDS).length,6);
  assert.equal(formatNumericValue(3),'3.00');
  assert.equal(formatNumericValue('3.256'),'3.26');
  assert.equal(formatNumericValue(-0),'0.00');
  assert.equal(formatNumericValue(''),null);
  assert.equal(formatNumericValue('abc'),null);
  assert.equal(stepNumericValue('x','3.25',1),'4.25');
  assert.equal(stepNumericValue('x','3.25',-1),'2.25');
  assert.equal(stepNumericValue('vz','-4.20',1),'-3.20');
  assert.equal(stepNumericValue('vz','-4.20',-1),'-5.20');
  assert.equal(stepNumericValue('z','0.80',1),'1.80');
  assert.equal(stepNumericValue('z','0.80',-1),null,'near-ground step must not partially clamp');
  assert.equal(NUMERIC_BOUNDS.z[0],0,'Z=0 must be allowed to rest on grass');
  assert.equal(stepNumericValue('z','0.00',1),'1.00');
  assert.equal(stepNumericValue('z','0.00',-1),null);
  assert.equal(stepNumericValue('x','48.00',1),null);
  assert.equal(stepNumericValue('x','-48.00',-1),null);
  assert.equal(stepNumericValue('x','47.00',1),'48.00');
  assert.equal(stepNumericValue('x','',1),null);
  assert.equal(stepNumericValue('x','nan',1),null);
  assert.throws(()=>stepNumericValue('unknown','0',1),/Invalid numeric step/);
  assert.throws(()=>stepNumericValue('x','0',2),/Invalid numeric step/);
});

test('ME-01 numeric field chrome uses canonical chevrons and inert captions', () => {
  const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../lab/lab.css',import.meta.url),'utf8');
  const js=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
  for(const id of Object.keys(NUMERIC_BOUNDS)){
    assert.match(html,new RegExp('<span class="me-field-caption" id="me-label-'+id+'">'));
    assert.match(html,new RegExp('<input id="'+id+'" type="number" inputmode="decimal" step="any"[^>]*aria-labelledby="me-label-'+id+'"'));
    const controls=[...html.matchAll(new RegExp('data-me-spin="'+id+'" data-direction="([+-]?\\d+)"','g'))];
    assert.deepEqual(controls.map(x=>x[1]),['1','-1'],id);
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  }
  assert.equal((html.match(/class="me-number-chevron/g)||[]).length,0,'arrow artwork must use canonical class');
  assert.equal((html.match(/class="language-chevron me-number-chevron/g)||[]).length,12,'two site-style chevrons per numeric field');
  assert.doesNotMatch(html,/<label class="me-field">/,'numeric captions must not focus inputs');
  assert.doesNotMatch(html,/<label class="me-field me-seed-field">/,'seed caption must also be inert');
  assert.match(css,/\.me-field-caption\{[^}]*cursor:default;user-select:none;transition:none;animation:none/);
  assert.match(css,/\.me-number-control input::-webkit-outer-spin-button/);
  assert.match(css,/\.me-number-control input::-webkit-inner-spin-button/);
  assert.match(css,/\.me-number-arrow:hover:not\(:disabled\)/);
  assert.match(js,/event\.key==='ArrowUp'/);
  assert.match(js,/event\.preventDefault\(\); \/\/ Never use the browser's native step/);
  assert.match(js,/formatNumericValue\(defaults\[key\]\)/);
  assert.match(js,/setupNumericFields\(\)/);
  assert.match(js,/input\.addEventListener\('change',\(\)=>normalizeNumericField\(field\)\)/);
  assert.match(js,/input\.addEventListener\('blur',\(\)=>normalizeNumericField\(field\)\)/);
});

test('ME-01 custom lab dropdown script parses and references shared menu semantics', () => {
  const codePath=fileURLToPath(new URL('../src/lab.mjs',import.meta.url));
  const parsed=spawnSync(process.execPath,['--check',codePath],{encoding:'utf8'});
  assert.equal(parsed.status,0,parsed.stderr);
  const script=readFileSync(codePath,'utf8');
  assert.match(script,/function setupDropdowns\(\)/);
  assert.match(script,/dispatchEvent\(new Event\('change'/);
  assert.match(script,/selectedIndex\(\)/);
  assert.match(script,/Escape/);
  assert.match(script,/ArrowDown/);
  assert.match(script,/input\.value/);
  assert.match(script,/byId\('height'\)\.textContent/);
  assert.match(script,/drawPitchMarkings\(c, w, h\)/);
  assert.match(script,/topDown\(\); \/\/ Show the complete static pitch/);
  assert.match(script,/byId\('ground'\)\.textContent/);
  assert.match(script,/byId\('ground-speed'\)\.textContent/);
  assert.match(script,/toGroundClearance\(p\.z\)/);
  assert.match(script,/history\.map\(s => toGroundClearance\(s\.ball\.position\.z\)\)/);
  assert.match(script,/Z\(toGroundClearance\(snap\.ball\.position\.z\)\)/);
  assert.match(script,/Z\(toGroundClearance\(p\.ball\.position\.z\)\)/);
  assert.match(script,/roll:'Ball Roll \(Grass\)'/);
  assert.match(script,/bounce:'Ball Bounce \(2 m\)'/);
  assert.match(script,/measureBounceHistory\(history\)/);
  assert.match(script,/runPhysicsDiagnostics\(rapier\)/);
  assert.match(script,/renderSpinMetrics\(report\.spinTrials\)/);
  assert.match(script,/renderNaturalGrassMetrics\(report\.naturalGrass\)/);
  assert.match(script,/renderFlightMetrics\(report\.flight\)/);
  assert.match(script,/renderAirDragMetrics\(report\.dragComparison\)/);
  assert.match(script,/drawSpinComparison\(trials\)/);
  assert.match(script,/SLIP_TRANSITION_THRESHOLD_MPS|slipMps/);
  assert.match(script,/byId\('metrics-dialog'\)\.showModal\(\)/);
  assert.match(script,/canonicalSnapshot\(before\)!==canonicalSnapshot\(engine\.snapshot\(\)\)/);
  assert.match(script,/FIFA_TURF_QUALITY_PRO_REFERENCE_M/);
  assert.match(script,/byId\('compare-result'\)\.hidden = true/);
  assert.match(script,/byId\('compare-result'\)\.hidden = false/);
});

test('ME-01 paths are excluded from all public artifacts and canonical route allowlists',()=>{
 for(const path of ['match-engine/lab/index.html','match-engine/lab/lab.css','match-engine/src/core.mjs','match-engine/src/lab.mjs','__fa_match_engine__/rapier.es.js','__fa_match_engine__/lab.css','__fa_match_engine__/sidebar-first-paint.js','match-engine/src/pitch-markings.mjs','__fa_match_engine__/pitch-markings.mjs','match-engine/src/numeric-controls.mjs','__fa_match_engine__/numeric-controls.mjs','match-engine/src/rebound-metrics.mjs','__fa_match_engine__/rebound-metrics.mjs','match-engine/src/physics-diagnostics.mjs','__fa_match_engine__/physics-diagnostics.mjs'])
   assert.equal(isAllowlistedPublicPath(path),false,path);
 assert.equal(planPublicFiles().some(x=>x.startsWith('match-engine/')||x.startsWith('__fa_match_engine__/')),false);
});

test('ME-01 pitch markings preserve real field scale and all football markings', () => {
  const {X,Y,R,scale}=(()=>{ const proj=pitchProjection(1050,680);return {...proj,R:m=>m*proj.scale}; })();
  assert.equal(PITCH_LENGTH_M,105);
  assert.equal(PITCH_WIDTH_M,68);
  assert.ok(Math.abs((X(52.5)-X(-52.5))/(Y(34)-Y(-34))-105/68)<1e-10);
  assert.ok(X(-54.5)>0 && X(54.5)<1050,'goals must stay inside the canvas');
  assert.ok(Y(-34)>0 && Y(34)<680);
  assert.throws(()=>pitchProjection(20,20),/size/);
  const calls={strokeRects:[],arcs:[],lines:[],fills:0,strokes:0};
  const ctx={
    fillStyle:'',strokeStyle:'',lineWidth:0,lineJoin:'',
    fillRect(){},
    strokeRect(...args){calls.strokeRects.push(args);},
    beginPath(){},moveTo(...args){calls.lines.push(['move',...args]);},
    lineTo(...args){calls.lines.push(['line',...args]);},
    arc(...args){calls.arcs.push(args);},
    fill(){calls.fills++;},stroke(){calls.strokes++;}
  };
  const projection=drawPitchMarkings(ctx,1050,680);
  assert.equal(projection.X(0),525);
  assert.equal(projection.Y(0),340);
  assert.equal(calls.strokeRects.length,7,'touchline + 2 penalty + 2 goal areas + 2 goals');
  assert.equal(calls.arcs.length,10,'center circle + 2 penalty arcs + 4 corner arcs + 3 spots');
  const near=(a,b)=>Math.abs(a-b)<1e-8;
  assert.ok(calls.strokeRects.some(([x,y,w,h])=>near(x,X(-52.5))&&near(y,Y(-34))&&near(w,R(105))&&near(h,R(68))));
  assert.equal(calls.strokeRects.filter(([,y,w,h])=>near(w,R(16.5))&&near(h,R(40.32))).length,2,'both penalty areas');
  assert.equal(calls.strokeRects.filter(([,y,w,h])=>near(w,R(5.5))&&near(h,R(18.32))).length,2,'both goal areas');
  assert.equal(calls.strokeRects.filter(([,y,w,h])=>near(w,R(2))&&near(h,R(7.32))).length,2,'both goals');
  assert.equal(calls.arcs.filter(([, ,r])=>near(r,R(9.15))).length,3,'center circle and penalty arcs');
  assert.equal(calls.arcs.filter(([, ,r])=>near(r,R(1))).length,4,'four corner arcs');
  const penaltyArcs=calls.arcs.filter(([, ,r,begin,end])=>near(r,R(9.15))&&end-begin<Math.PI*2-0.01);
  assert.equal(penaltyArcs.length,2);
  const outside=Math.acos(5.5/9.15);
  assert.ok(penaltyArcs.some(([x,,r,begin,end])=>near(x,X(-41.5))&&near(begin,-outside)&&near(end,outside)));
  assert.ok(penaltyArcs.some(([x,,r,begin,end])=>near(x,X(41.5))&&near(begin,Math.PI-outside)&&near(end,Math.PI+outside)));
  assert.ok(calls.lines.some(line=>line[0]==='move'&&near(line[1],X(0))&&near(line[2],Y(-34))));
  assert.ok(calls.lines.some(line=>line[0]==='line'&&near(line[1],X(0))&&near(line[2],Y(34))));
  assert.ok(scale>0);
});

test('ME-01 compact pitch caps desktop dimensions and uses canonical site chevron',()=>{
  const stylesheet=readFileSync(new URL('../lab/lab.css',import.meta.url),'utf8');
  const markup=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
  assert.match(stylesheet,/\.me-pitch-frame canvas\{[^}]*width:min\(100%, 1200px, calc\(154dvh - 540px\)\)/);
  assert.match(stylesheet,/\.me-field-grid\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(stylesheet,/\.me-lab-page \.app-main\{[^}]*padding-top:clamp\(10px,1\.6dvh,18px\)/);
  assert.match(stylesheet,/\.me-lab-page \.app-footer\{padding-block:7px\}/);
  assert.match(stylesheet,/@media\(min-width:901px\) and \(max-height:768px\)/);
  assert.match(stylesheet,/@media\(min-width:901px\) and \(min-height:1000px\)/);
  assert.match(stylesheet,/\.me-pitch-frame canvas\{width:min\(100%, 1200px, calc\(154dvh - 550px\)\)\}/);
  assert.match(stylesheet,/\.me-pitch-frame canvas\{width:min\(100%, 1200px, calc\(113dvh - 218px\)\)\}/);
  assert.match(stylesheet,/\.me-elevation-frame canvas\{width:min\(100%, 36\.6dvh\)/);
  assert.match(markup,/<body class="app-body me-lab-page">/);
  assert.equal((markup.match(/<fieldset class="me-parameter-group">/g)||[]).length,2);
  assert.match(markup,/<legend>Position · m<\/legend>/);
  assert.match(markup,/<legend>Velocity · m\/s<\/legend>/);
  assert.match(markup,/id="compare-result"[^>]*hidden/);
  const advanced=markup.slice(markup.indexOf('id="advanced-settings"'),markup.indexOf('</details>'));
  for(const id of ['x','y','z','vx','vy','vz','seed','apply','compare','position','velocity'])
    assert.match(advanced,new RegExp('id="'+id+'"'));
  assert.match(stylesheet,/\.me-pitch-frame canvas\{[^}]*height:auto;aspect-ratio:105\/68/);
  assert.match(stylesheet,/\.me-advanced\[open\] \.me-details-chevron\{transform:rotate\(180deg\)/);
  const chevron=markup.match(/<svg class="language-chevron me-details-chevron"[\s\S]*?<\/svg>/)?.[0];
  assert.ok(chevron,'advanced settings must use the shared SVG chevron');
  assert.match(chevron,/viewBox="0 0 20 20"/);
  assert.match(chevron,/d="m5 7 5 5 5-5"/);
  assert.doesNotMatch(chevron,/>⌄</);
});
