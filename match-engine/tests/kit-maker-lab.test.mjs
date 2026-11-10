import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request} from 'node:http';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createPreviewServer} from '../../tools/dev-standings-preview.mjs';
import {sidebarFromAppPage,addDevelopmentToAppHtml,renderKitMakerLab,kitFirstPaintBootstrap} from '../src/sidebar-shell.mjs';
import {isAllowlistedPublicPath,planPublicFiles} from '../../tools/publication-guard.mjs';
import {groupKitMakerClubs} from '../../kit-maker/lab/club-select.mjs';
import {JERSEY_SPEC,torsoEnvelope,shoulderSkinEnvelope,fittedSleeveRadii,createNeutralShortSleeveJersey} from '../../kit-maker/lab/jersey-geometry.mjs';

async function open(options){
  const server=createPreviewServer(options);
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  return server;
}
async function get(server,path,{host='app.localhost:2000',method='GET'}={}){
  return new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port:server.address().port,path,
      method,headers:{host}},response=>{
      const chunks=[];
      response.on('data',part=>chunks.push(part));
      response.on('end',()=>resolve({status:response.statusCode,
        headers:response.headers,body:Buffer.concat(chunks)}));
    });
    req.on('error',reject);req.end();
  });
}
test('KM-01 canonical DEV lab and both Development sidebar links work on app.localhost',async t=>{
  const server=await open({subdomains:true});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const page=await get(server,'/dev/kit-maker'),html=page.body.toString('utf8');
  assert.equal(page.status,200);
  assert.equal(page.headers['cache-control'],'private, no-store');
  assert.match(page.headers['x-robots-tag'],/noindex/);
  assert.equal(page.headers['x-frame-options'],'DENY');
  assert.match(page.headers['content-security-policy'],/default-src 'none'/);
  assert.match(page.headers['content-security-policy'],/cdn\.jsdelivr\.net/);
  assert.match(page.headers['content-security-policy'],/frame-ancestors 'none'/);
  assert.match(html,/<title>Kit Maker — Football Architect<\/title>/);
  assert.doesNotMatch(html,/KM-01_CANONICAL_SIDEBAR/);
  assert.match(html,/data-km-dev-link aria-current="page"/);
  assert.match(html,/data-me-dev-link/);
  assert.equal((html.match(/data-km-dev-link/g)||[]).length,1);
  assert.equal((html.match(/data-me-dev-link/g)||[]).length,1);
  assert.match(html,/>Kit Maker<\/span>/);
  assert.match(html,/>Match Engine<\/span>/);
  assert.match(html,/id="app-nav-profile"/);
  assert.match(html,/id="nav01-children"/);
  assert.match(html,/href="\/assets\/app\.css"/);
  assert.match(html,/href="\/__fa_kit_maker__\/lab\.css"/);
  assert.match(html,/src="\/__fa_kit_maker__\/sidebar-first-paint\.js"/);
  assert.match(html,/src="\/__fa_kit_maker__\/viewer\.mjs"/);
  assert.match(html,/id="viewport"/);
  assert.match(html,/aria-label="3D football outfit preview"/);
  assert.match(html,/class="km-camera-hint"/);
  assert.match(html,/Right-drag to move/);
  assert.match(html,/two fingers move and zoom/);
  assert.doesNotMatch(html,/aria-label="3D mannequin preview"/);
  assert.equal(html.split('<h1 ').length-1,1);
  for(const id of ['status','viewport','km-club-select','km-club-status','km-colors-title'])
    assert.ok(html.includes('id="'+id+'"'),id);
  for(const missing of ['reference-file','restore-base','relax-arms',
    'restore-rig-pose','base-anatomy-metrics','model-title','model-description'])
    assert.ok(!html.includes('id="'+missing+'"'),missing+' must not appear');
  assert.doesNotMatch(html,/data-view=/);
  assert.ok(html.includes('src="/__fa_kit_maker__/club-select.mjs"'));
  assert.match(html,/Select club/);
  assert.match(html,/class="app-panel km-preview-panel"/);
  assert.match(html,/class="app-panel km-settings"/);
  assert.match(html,/class="language-control km-club-control"/);
  assert.match(html,/id="km-club-trigger" class="language-trigger"/);
  assert.match(html,/id="km-club-menu" class="language-menu" role="listbox"/);
  assert.match(html,/id="km-club-status"[^>]*\bhidden/);
  assert.doesNotMatch(html,/Loading clubs/i);
  assert.equal((html.match(/class="km-color-option"/g)||[]).length,6);
  assert.equal((html.match(/data-km-part=/g)||[]).length,3);
  assert.equal((html.match(/data-km-style=/g)||[]).length,2);
  assert.equal((html.match(/data-km-layer=/g)||[]).length,3);
  assert.match(html,/data-km-layer="trim"/);
  assert.match(html,/id="km-trim-note"/);
  assert.match(html,/Collar, sleeve edges and bottom hem use the same color/);
  assert.doesNotMatch(html,/data-km-layer="collar"|data-km-layer="cuffs"/);
  assert.match(html,/id="km-color-target"/);
  assert.doesNotMatch(html,/data-km-stripe-width=/);
  assert.match(html,/id="km-stripe-width"[^>]*type="range"[^>]*min="30" max="150" step="5" value="75"/);
  assert.match(html,/id="km-stripe-width-value"[^>]*>7\.5 cm</);
  assert.match(html,/id="km-stripe-settings"[^>]*hidden/);
  assert.match(html,/data-km-style="vertical-stripes"/);
  assert.match(html,/<h2 id="km-color-target-title">Color area<\/h2>/);
  assert.match(html,/Stripe width/);
  assert.equal((html.match(/data-km-color=/g)||[]).length,6);
  for(const id of ['km-parts-title','km-style-title','km-colors-title'])
    assert.ok(html.includes('id="'+id+'"'));
  assert.match(html,/Primary/);
  assert.match(html,/Secondary/);
  assert.match(html,/Allowed neutrals/);
  assert.match(html,/Solid/);
  assert.doesNotMatch(html,/Coming soon/);
  assert.doesNotMatch(html,/type="color"/);
  assert.doesNotMatch(html,/Compare 3D reference|Measurements &amp; pose|Kit Maker foundation/);
  assert.match(html,/cdn\.jsdelivr\.net\/npm\/three@0\.181\.0/);
  assert.doesNotMatch(html,/class="app-footer"/);

  const dashboard=(await get(server,'/dashboard')).body.toString('utf8');
  assert.match(dashboard,/data-me-dev-link/);
  assert.match(dashboard,/data-km-dev-link/);
  const site=(await get(server,'/dashboard',{host:'localhost:2000'})).body.toString('utf8');
  assert.doesNotMatch(site,/data-km-dev-link/);
  assert.doesNotMatch(site,/data-me-dev-link/);
});
test('KM-05 uses only whitelisted private WebGL assets and the new outfit loader',async t=>{
  const server=await open({subdomains:true});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  for(const path of ['/__fa_kit_maker__/lab.css',
    '/__fa_kit_maker__/viewer.mjs','/__fa_kit_maker__/reference-import.mjs',
    '/__fa_kit_maker__/rigged-arms.mjs',
    '/__fa_kit_maker__/club-select.mjs',
    '/__fa_kit_maker__/kit-design.mjs',
    '/__fa_kit_maker__/body-visibility.mjs',
    '/__fa_kit_maker__/sena-fit.mjs',
    '/__fa_kit_maker__/jersey-geometry.mjs',
    '/__fa_kit_maker__/sidebar-first-paint.js']){
    const res=await get(server,path);
    assert.equal(res.status,200,path);
    assert.match(res.headers['cache-control'],/private, no-store/);
  }
  const glb=await get(server,'/__fa_kit_maker__/mannequin-180.glb');
  assert.equal(glb.status,200);
  assert.match(glb.headers['content-type'],/model\/gltf-binary/);
  assert.equal(glb.body.byteLength,4498816);
  assert.equal(glb.body.toString('utf8',0,4),'glTF');
  assert.equal((await get(server,'/__fa_kit_maker__/mannequin-180.glb',{method:'HEAD'})).status,200);
  const obj=await get(server,'/__fa_kit_maker__/mannequin-180.obj',{method:'HEAD'});
  assert.equal(obj.status,200);
  const script=(await get(server,'/__fa_kit_maker__/viewer.mjs')).body.toString('utf8');
  // KM-22: remove ALL scene shadow casting and shadow-catching, but keep
  // directional lighting and clipping. OrbitControls must also pan freely.
  assert.ok(script.includes('renderer.shadowMap.enabled=false;'));
  assert.ok(script.includes('key.castShadow=false;'));
  assert.doesNotMatch(script,/new THREE\.ShadowMaterial|scene\.add\(floor\)|castShadow=true|receiveShadow=true/);
  assert.ok(script.includes('controls.enablePan=true;'));
  assert.ok(script.includes('controls.screenSpacePanning=true;'));
  assert.ok(script.includes('RIGHT:THREE.MOUSE.PAN'));
  assert.ok(script.includes('TWO:THREE.TOUCH.DOLLY_PAN'));
  assert.ok(script.includes('controls.target.copy(focus)'),
    'Preset/reset views must retain a predictable target after panning');
  assert.match(script,/studioAssets\+"mannequin-180\.glb"/);
  assert.match(script,/studioAssets\+"mannequin-180\.obj"/);
  assert.ok(script.includes('location.pathname==="/dev/kit-maker"'));
  assert.match(script,/new GLTFLoader\(\)\.parseAsync/);
  // KM-05 replaces the former procedural jersey preview with the private
  // clothing-only Alberto Sena GLB; legacy geometry stays available solely
  // for historical geometry regressions, never as the default viewer outfit.
  assert.ok(script.includes('studioAssets+"alberto-sena-outfit.glb"'));
  assert.ok(script.includes('validateStandaloneGLB(data)'));
  assert.ok(script.includes('model.add(outfit)'));
  assert.ok(script.includes('fitSenaOutfit(outfit,hash)'));
  assert.ok(script.includes('removeSenaInnerNeckPrint(outfit)'));
  assert.ok(script.includes('makeSenaJerseySolidWhite(outfit,THREE)'));
  assert.ok(script.includes('makeSenaShortsSocksSolidWhite(outfit,THREE)'));
  assert.ok(script.includes('makeSenaBootLacesSolidWhite(outfit,THREE)'));
  assert.ok(script.includes('makeSenaBootsBlackAndWhite(outfit,THREE)'));
  assert.ok(script.indexOf('makeSenaBootsBlackAndWhite(outfit,THREE)')<
    script.indexOf('makeSenaBootLacesSolidWhite(outfit,THREE)'));
  assert.ok(script.includes('outfit.userData.monochromeBootWarning=bootColorWarning'));
  assert.ok(script.includes('outfit.userData.whiteBootLaceWarning=laceWarning'));
  assert.ok(script.includes('Details: '));
  assert.ok(script.indexOf('makeSenaJerseySolidWhite(outfit,THREE)')<
    script.indexOf('makeSenaShortsSocksSolidWhite(outfit,THREE)'));
  assert.ok(script.indexOf('makeSenaShortsSocksSolidWhite(outfit,THREE)')<
    script.indexOf('makeSenaBootLacesSolidWhite(outfit,THREE)'));
  assert.ok(script.indexOf('makeSenaBootLacesSolidWhite(outfit,THREE)')<
    script.indexOf('model.add(outfit)'));
  assert.ok(script.indexOf('removeSenaInnerNeckPrint(outfit)') <
    script.indexOf('makeSenaJerseySolidWhite(outfit,THREE)'));
  assert.ok(script.indexOf('makeSenaJerseySolidWhite(outfit,THREE)') <
    script.indexOf('model.add(outfit)'));
  assert.ok(script.includes('outfit.userData.removedInnerCollarPrint=neck.meshName'));
  assert.ok(script.includes('await sha256Outfit(data)'));
  assert.ok(script.includes('kitDesigner=await import("./kit-design.mjs")'));
  assert.ok(script.includes('kitDesigner.applyKitDesign(outfit,'));
  assert.ok(script.includes('kitDesigner.applyKitDesign(activeKitOutfit,state,THREE)'));
  assert.ok(script.includes('kitDesigner.kitDesignStore.subscribe(state=>'));
  assert.ok(script.includes('activeKitOutfit=outfit;'));
  assert.ok(script.includes('fit.mode==="apply-original"'));
  assert.ok(script.includes('renderer.localClippingEnabled=true'));
  assert.ok(script.includes('const cut=new THREE.Plane(new THREE.Vector3(0,1,0),-.130)'),
    'KM-11 trims the original local sock panels at the new 130mm cuff');
  assert.ok(script.includes('hideAnatomicalBody(model)'));
  assert.ok(script.includes('import { hideAnatomicalBody }'));
  assert.ok(script.indexOf('hideAnatomicalBody(model)') <
    script.indexOf('setActiveModel(model);describeSource();'),
    'Anatomical body must be hidden before the first render');
  assert.ok(script.includes('Outfit not found locally · clothing-only preview is empty.'));
  assert.match(script,/FA_\(jersey\|shorts\|socks\|boots\)/);
  assert.ok(script.includes('result.status===404'));
  assert.doesNotMatch(script,/createNeutralShortSleeveJersey/);
  assert.ok(script.includes('if(location.pathname==="/dev/kit-maker")'));
  const garment=(await get(server,'/__fa_kit_maker__/jersey-geometry.mjs')).body.toString('utf8');
  assert.ok(garment.includes('export function createNeutralShortSleeveJersey'));
  assert.ok(garment.includes('mesh.getVertexPosition(i,vertex)'));
  assert.ok(garment.includes('km03-jersey-shell'));
  assert.ok(garment.includes('const armholes='));
  assert.ok(garment.includes('km03-collar-rib'));
  assert.doesNotMatch(garment,/fetch\(|localStorage|sessionStorage|\bPOST\b/);
  assert.ok(script.includes('referenceInput?.addEventListener'));
  assert.ok(script.includes('if(!modelTitle||!modelDescription'));
  const clubsJS=(await get(server,'/__fa_kit_maker__/club-select.mjs')).body.toString('utf8');
  assert.ok(clubsJS.includes('/clubs/_shared/manifest.json'));
  assert.ok(clubsJS.includes('kitDesignStore.setClub('));
  assert.ok(clubsJS.includes('initKitMakerControls()'));
  const designJS=(await get(server,'/__fa_kit_maker__/kit-design.mjs')).body.toString('utf8');
  assert.ok(designJS.includes('createKitDesignStore'));
  assert.ok(designJS.includes('applySolidKitColors'));
  assert.ok(designJS.includes('applyKitDesign'));
  assert.ok(designJS.includes('KIT_STRIPE_WIDTH_RANGE'));
  // KM-20 replaces approximate 3D-X warps with the artist's original
  // 2D cloth pattern UVs, which preserve sewn stripe widths at the sides.
  assert.ok(designJS.includes('measureKitStripeFabricMetric'));
  assert.ok(designJS.includes('vKmPatternU = uv.x'));
  assert.ok(designJS.includes('distanceOnFabric='));
  assert.ok(designJS.includes('kmStripeFabricOrigin'));
  assert.ok(designJS.includes('kmStripeFabricScale'));
  assert.ok(designJS.includes('kitJerseyDetailRegion'));
  // KM-27 colours faces between author-made seams/folds. KM-25's
  // 24mm rim-distance shaders must not be part of the active render path.
  assert.ok(designJS.includes('kmTrimRegion'));
  assert.ok(designJS.includes('colourOriginalSewnTrims'));
  assert.ok(designJS.includes('makeOriginalTrimOverlay'));
  assert.ok(designJS.includes('authorTrimOverlayCache'));
  assert.ok(designJS.includes('km27SourceTrimReport'));
  assert.ok(designJS.includes('polygonOffset:true'));
  assert.ok(designJS.includes('38|39|62|63'));
  assert.ok(designJS.includes('9|10|42|43'));
  assert.doesNotMatch(designJS,/kmTrimCuffV|kitCuffOuterTrimThreshold/);
  // KM-27: sewn material/crease faces are rendered as small overlays,
  // never as atlas-V or an estimated 24mm vertex-distance band.
  assert.ok(designJS.includes('findOriginalSewnTrimFaces'));
  assert.ok(designJS.includes('km27-sewn-trim-overlay'));
  assert.doesNotMatch(designJS,/attribute float kmRimDistance;/);
  assert.doesNotMatch(designJS,/smoothstep\(0\.024-edgeAA/);
  assert.doesNotMatch(designJS,/vKmPatternV\s*=\s*uv\.y/);
  const topologyModule=await get(server,'/__fa_kit_maker__/kit-trim-geometry.mjs');
  assert.equal(topologyModule.status,200,'Source trim geometry must be served in DEV');
  assert.ok(topologyModule.body.toString('utf8').includes('findOriginalSewnTrimFaces'));
  assert.ok(designJS.includes('cachedKitStripeMetric'));
  assert.ok(designJS.includes('alignOriginalShoulderStripes'));
  assert.ok(designJS.includes('km29ShoulderStripeReport'));
  assert.ok(designJS.includes('kmStripeSewnMetres'));
  assert.ok(designJS.includes('shoulder.coordinates'));
  assert.ok(designJS.includes('hasSewnCoordinates'));
  assert.ok(designJS.includes('new THREE.Float32BufferAttribute(metres,1)'));
  const seamsModule=await get(server,'/__fa_kit_maker__/kit-stripe-seams.mjs');
  assert.equal(seamsModule.status,200,'Private DEV shoulder seam calibration must load');
  assert.ok(seamsModule.body.toString('utf8').includes('alignOriginalShoulderStripes'));
  assert.doesNotMatch(designJS,/kmTorsoStripeArc|kmSleeveStripeArc|kmTorsoStripeCoordinate|kmParallelStripeCoordinate|vKmKitX/);
  assert.ok(clubsJS.includes('widthSlider.addEventListener("input"'));
  assert.doesNotMatch(designJS,/\bPOST\b|\bPUT\b|\bDELETE\b/);
  assert.ok(clubsJS.includes('item.className="language-option"'));
  assert.ok(clubsJS.includes('item.setAttribute("aria-selected"'));
  assert.ok(clubsJS.includes('event.key==="Escape"'));
  assert.ok(clubsJS.includes('trigger.disabled=false'));
  assert.doesNotMatch(clubsJS,/Loading clubs/i);
  assert.doesNotMatch(clubsJS,/\\bPOST\\b|\\bPUT\\b|\\bDELETE\\b/);
  const canonicalCss=(await get(server,'/__fa_kit_maker__/lab.css')).body.toString('utf8');
  assert.ok(canonicalCss.includes('.km-club-control .language-trigger'));
  assert.ok(canonicalCss.includes('var(--fa-radius-control)'));
  assert.ok(canonicalCss.includes('var(--fa-space-4)'));
  assert.doesNotMatch(canonicalCss,/\.km-field select\s*\{/);
  const manifest=await get(server,'/clubs/_shared/manifest.json');
  assert.equal(manifest.status,200);
  assert.equal(groupKitMakerClubs(JSON.parse(manifest.body.toString('utf8')))
    .reduce((n,group)=>n+group.clubs.length,0),320);
  const firstPaint=(await get(server,'/__fa_kit_maker__/sidebar-first-paint.js')).body.toString('utf8');
  assert.match(firstPaint,/const selected=path==='\/dev\/kit-maker'/);
  assert.match(firstPaint,/data-km-dev-link/);
  assert.equal((await get(server,'/__fa_kit_maker__/unknown.mjs')).status,404);
  assert.equal((await get(server,'/__fa_kit_maker__/jersey-geometry.mjs',
    {host:'localhost:2000'})).status,404);
  assert.equal((await get(server,'/dev/kit-maker',{method:'POST'})).status,405);
  assert.equal((await get(server,'/__fa_kit_maker__/viewer.mjs',{method:'POST'})).status,405);
  assert.equal((await get(server,'/__fa_kit_maker__/%2e%2e/test')).status,403);
});
test('KM-01 is denied on public hosts, LAN, and non-DEV mode',async()=>{
  for(const [options,host] of [
    [{subdomains:true,devPreview:false},'app.localhost:2000'],
    [{subdomains:false},'localhost:2000'],
    [{subdomains:true},'localhost:2000']
  ]){
    const server=await open(options);
    try{
      for(const path of ['/dev/kit-maker','/__fa_kit_maker__/viewer.mjs',
        '/__fa_kit_maker__/mannequin-180.glb']){
        const response=await get(server,path,{host});
        assert.ok([403,404].includes(response.status),path+' '+response.status);
      }
    }finally{await new Promise(resolve=>server.close(resolve));}
  }
});
test('KM-01 reuses canonical sidebar without touching ME-01 active states',()=>{
  const canonical=readFileSync(new URL('../../dashboard/index.html',import.meta.url),'utf8');
  const originalAside=sidebarFromAppPage(canonical);
  const augmented=addDevelopmentToAppHtml(canonical);
  const aside=sidebarFromAppPage(augmented);
  const inserted=/<section class="fa-shell-nav-group" aria-labelledby="me-nav-development">[\s\S]*?<\/section>\n        /;
  assert.equal(aside.replace(inserted,''),originalAside);
  assert.equal((aside.match(/data-km-dev-link/g)||[]).length,1);
  assert.equal((aside.match(/data-me-dev-link/g)||[]).length,1);
  assert.equal(addDevelopmentToAppHtml(augmented),augmented);
  const markup='<!-- KM-01_CANONICAL_SIDEBAR -->';
  const kit=renderKitMakerLab(markup,canonical);
  assert.match(kit,/data-km-dev-link aria-current="page"/);
  assert.doesNotMatch(kit,/data-me-dev-link aria-current="page"/);
  assert.doesNotMatch(kit,/id="app-nav-dashboard" aria-current="page"/);
  assert.throws(()=>renderKitMakerLab(markup,'not canonical'),/sidebar/);
  assert.throws(()=>kitFirstPaintBootstrap('invalid'),/selection contract/);
  const bootstrap=readFileSync(new URL('../../assets/sidebar-first-paint.js',import.meta.url),'utf8');
  const newBootstrap=kitFirstPaintBootstrap(bootstrap);
  assert.ok(newBootstrap.includes("const selected=path==='/dev/kit-maker'"));
  assert.equal(newBootstrap.replace(
    "const selected=path==='/dev/kit-maker'?nav.querySelector('[data-km-dev-link]'):onClubs?",
    'const selected=onClubs?'),bootstrap);
});
test('KM-02 club selector uses canonical club keys and validates catalogue integrity',()=>{
  const countries=['BR','DE','ENG','ES','FR','IT','NL','PT'];
  const fixture={clubs:countries.flatMap(countryId=>Array.from({length:40},(_,i)=>({
    countryId,clubId:i+1,primaryName:'Club '+String(i+1).padStart(2,'0')
  })))};
  const groups=groupKitMakerClubs(fixture);
  assert.equal(groups.length,8);
  assert.equal(groups.reduce((total,group)=>total+group.clubs.length,0),320);
  assert.equal(groups[0].clubs[0].id,'BR-1');
  assert.equal(groups[7].clubs[39].id,'PT-40');
  assert.throws(()=>groupKitMakerClubs({clubs:fixture.clubs.slice(0,319)}),/320-club/);
  assert.throws(()=>groupKitMakerClubs({clubs:[...fixture.clubs.slice(0,319),fixture.clubs[0]]}),/Duplicate/);
  assert.throws(()=>groupKitMakerClubs({clubs:[...fixture.clubs.slice(0,319),{countryId:'XX',clubId:40,primaryName:'Fake'}]}),/Invalid/);
});

test('KM-01 files are excluded from all publication allowlists and pass syntax checks',()=>{
  for(const p of ['kit-maker/lab/index.html','kit-maker/lab/lab.css',
    '__fa_kit_maker__/viewer.mjs','__fa_kit_maker__/lab.css',
    '__fa_kit_maker__/club-select.mjs','__fa_kit_maker__/kit-design.mjs',
    '__fa_kit_maker__/jersey-geometry.mjs',
    '__fa_kit_maker__/mannequin-180.glb',
    'tools/kit-designer-prototype/mannequin-180.glb']){
    assert.equal(isAllowlistedPublicPath(p),false,p);
  }
  assert.ok(!planPublicFiles().some(p=>p.startsWith('kit-maker/')||p.startsWith('__fa_kit_maker__/')));
  for(const path of ['../src/sidebar-shell.mjs','../../tools/dev-standings-preview.mjs',
    '../../tools/kit-designer-prototype/viewer.mjs','../../kit-maker/lab/club-select.mjs',
    '../../kit-maker/lab/jersey-geometry.mjs']){
    const file=fileURLToPath(new URL(path,import.meta.url));
    const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(checked.status,0,path+' '+checked.stderr);
  }
});

test('KM-03A body envelope follows the skin rather than an arbitrary cylinder',()=>{
  const spec=JERSEY_SPEC,points=[];
  const delta=(spec.torsoShoulderY-spec.torsoHemY)/(spec.torsoRings-1);
  for(let row=0;row<spec.torsoRings;row++){
    const y=spec.torsoHemY+delta*row;
    for(let angle=0;angle<spec.circumferenceSegments;angle++){
      const theta=angle/spec.circumferenceSegments*Math.PI*2;
      const radius=.128+.018*(y-1.05)+.012*Math.cos(theta*2)+.015*Math.exp(-(((y-1.32)/.1)**2));
      points.push({x:radius*Math.sin(theta),y,
        z:spec.centerZ+radius*Math.cos(theta)});
    }
  }
  const radius=torsoEnvelope(points,spec);
  assert.equal(radius.length,spec.torsoRings*spec.circumferenceSegments);
  assert.ok(radius.every(r=>Number.isFinite(r)&&r>.10&&r<.30));
  for(let row=0;row<spec.torsoRings;row++){
    for(let side=0;side<spec.circumferenceSegments;side++){
      const p=points[row*spec.circumferenceSegments+side];
      const surface=Math.hypot(p.x,p.z-spec.centerZ);
      assert.ok(radius[row*spec.circumferenceSegments+side]>=surface+spec.clearanceM-.00001,
        'The shirt must enclose the scanned body at each ring/angle');
    }
  }
  assert.throws(()=>torsoEnvelope(points.slice(0,50),spec),/Insufficient/);
  assert.throws(()=>torsoEnvelope(points.map(p=>({...p,y:3})),spec),/Invalid torso geometry/);
});

test('KM-03A builds a separate 3D jersey with two cuffs, open collar and hem',()=>{
  class V{
    constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
    set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
    clone(){return new V(this.x,this.y,this.z);}
    sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
    addScaledVector(v,f){this.x+=v.x*f;this.y+=v.y*f;this.z+=v.z*f;return this;}
    multiplyScalar(f){this.x*=f;this.y*=f;this.z*=f;return this;}
    length(){return Math.hypot(this.x,this.y,this.z);}
    normalize(){const f=this.length();return this.multiplyScalar(1/f);}
    cross(v){const{x,y,z}=this;this.x=y*v.z-z*v.y;this.y=z*v.x-x*v.z;this.z=x*v.y-y*v.x;return this;}
    toArray(){return [this.x,this.y,this.z];}
  }
  class Geometry{
    constructor(){this.attributes={};this.index=[];}
    setAttribute(name,value){this.attributes[name]=value;return this;}
    getAttribute(name){return this.attributes[name];}
    setIndex(index){this.index=index;}
    computeVertexNormals(){this.normalsComputed=true;}
  }
  class Attribute{
    constructor(values,stride){this.values=values;this.count=values.length/stride;}
  }
  class Material{constructor(props){Object.assign(this,props);}}
  class Group{
    constructor(){this.children=[];this.userData={};}
    add(child){this.children.push(child);}
  }
  class Mesh{
    constructor(geometry,material){this.geometry=geometry;this.material=material;}
  }
  const THREE={Vector3:V,BufferGeometry:Geometry,Float32BufferAttribute:Attribute,
    MeshStandardMaterial:Material,Group,Mesh,DoubleSide:2};
  const points=[];
  for(let row=0;row<40;row++){
    const y=.925+row*.014;
    for(let side=0;side<96;side++){
      const theta=side/96*Math.PI*2;
      const r=.129+.025*Math.sin((y-.95)*3)**2+.006*Math.cos(theta*2);
      points.push({x:Math.sin(theta)*r,y,z:.02+Math.cos(theta)*r});
    }
  }
  // The mannequin's real upper shoulders extend beyond its slim chest.
  // These deltoid samples carry arm weights and must be considered by
  // the dedicated shoulder scan, but NOT the torso envelope fitter.
  const torsoVertexCount=points.length;
  for(let row=0;row<4;row++){
    const y=1.446+row*.012;
    for(let side=0;side<56;side++){
      const theta=side/56*Math.PI*2;
      const r=.135+.12*Math.pow(Math.abs(Math.sin(theta)),8);
      points.push({x:r*Math.sin(theta),y,
        z:.02+r*Math.cos(theta)});
    }
  }
  const bones=[{name:'spine01'},{name:'upperarm01.L',isBone:true,
    getWorldPosition:()=>new V(.205,1.441,.019)},
  {name:'lowerarm01.L',isBone:true,getWorldPosition:()=>new V(.252,1.182,.022)},
  {name:'upperarm01.R',isBone:true,getWorldPosition:()=>new V(-.205,1.441,.019)},
  {name:'lowerarm01.R',isBone:true,getWorldPosition:()=>new V(-.252,1.182,.022)}];
  const skinned={
    isSkinnedMesh:true,skeleton:{bones},
    geometry:{getAttribute:name=>({
      position:{count:points.length},skinIndex:{getComponent:i=>i>=torsoVertexCount?(points[i].x>=0?1:3):0},
      skinWeight:{getComponent:(_,i)=>i===0?1:0}})[name]},
    getVertexPosition:(i,out)=>out.set(points[i].x,points[i].y,points[i].z),
    localToWorld:v=>v
  };
  const root=new Group();
  root.updateMatrixWorld=()=>{};
  root.worldToLocal=v=>v;
  root.traverse=fn=>{fn(skinned);for(const bone of bones)fn(bone);};
  root.getObjectByName=name=>root.children.find(child=>child.name===name);
  const jersey=createNeutralShortSleeveJersey(root,THREE);
  assert.equal(jersey.name,'km03-neutral-jersey');
  assert.equal(root.children.length,1,'Jersey must be separate from original skin geometry');
  assert.equal(jersey.children.length,5);
  assert.deepEqual(jersey.children.map(mesh=>mesh.name),[
    'km03-jersey-cuff-l','km03-jersey-cuff-r',
    'km03-jersey-shell','km03-collar-rib','km03-jersey-hem'
  ]);
  const shell=jersey.children.find(mesh=>mesh.name==='km03-jersey-shell');
  // The connected shoulder cap must wrap the actual deltoid samples,
  // rather than staying at the much narrower chest-cylinder width.
  const positions=shell.geometry.getAttribute('position').values;
  const upperX=[];
  for(let i=0;i<positions.length;i+=3){
    if(positions[i+1]>1.448&&positions[i+1]<1.483)
      upperX.push(positions[i]);
  }
  const right=Math.max(...upperX),left=-Math.min(...upperX);
  assert.ok(right>.22&&left>.22,
    'Both shoulder caps must expand beyond the upper chest');
  assert.ok(right<.29&&left<.29,
    'The upper shoulders must not be inflated with loose fabric');
  assert.ok(Math.abs(right-left)<.012,
    'The shirt shoulders must remain symmetric in the relaxed pose');
  const triangles=shell.geometry.index;
  const edges=new Map(),graph=new Map();
  const edge=(a,b)=>{
    const k=Math.min(a,b)+','+Math.max(a,b);
    edges.set(k,(edges.get(k)||0)+1);
    if(!graph.has(a))graph.set(a,new Set());
    if(!graph.has(b))graph.set(b,new Set());
    graph.get(a).add(b);graph.get(b).add(a);
  };
  for(let i=0;i<triangles.length;i+=3){
    const [a,b,c]=triangles.slice(i,i+3);
    assert.ok(a!==b&&b!==c&&c!==a,'Degenerate triangle indices');
    const p=[a,b,c].map(id=>positions.slice(3*id,3*id+3));
    const u=p[1].map((v,j)=>v-p[0][j]);
    const v=p[2].map((value,j)=>value-p[0][j]);
    const triangleArea=Math.hypot(
      u[1]*v[2]-u[2]*v[1],
      u[2]*v[0]-u[0]*v[2],
      u[0]*v[1]-u[1]*v[0])/2;
    assert.ok(triangleArea>1e-8,
      'The fitted shoulder and sleeve triangles must retain area');
    edge(a,b);edge(b,c);edge(c,a);
  }
  assert.ok([...edges.values()].every(n=>n===1||n===2),
    'The shell has no non-manifold edges');
  const visited=new Set(),components=[];
  for(const v of graph.keys()){
    if(visited.has(v))continue;
    const stack=[v];visited.add(v);let size=0;
    while(stack.length){
      const next=stack.pop();size++;
      for(const other of graph.get(next)){
        if(!visited.has(other)){visited.add(other);stack.push(other);}
      }
    }
    components.push(size);
  }
  assert.deepEqual(components,[shell.geometry.getAttribute('position').count],
    'Bodice, shoulder and both sleeves must share one connected surface');
  // Exactly four allowed boundary loops: neckline, hem and two cuffs.
  const rim=new Map();
  for(const [key,count] of edges){
    if(count!==1)continue;
    const [a,b]=key.split(',').map(Number);
    for(const [u,v] of [[a,b],[b,a]]){
      if(!rim.has(u))rim.set(u,new Set());
      rim.get(u).add(v);
    }
  }
  assert.ok([...rim.values()].every(n=>n.size===2),
    'Neither armhole may leave an unstitched slit');
  const seenRim=new Set();let openings=0;
  for(const v of rim.keys()){
    if(seenRim.has(v))continue;
    openings++;
    const stack=[v];seenRim.add(v);
    while(stack.length)for(const next of rim.get(stack.pop())){
      if(!seenRim.has(next)){seenRim.add(next);stack.push(next);}
    }
  }
  assert.equal(openings,4,'Only collar, hem and bilateral cuffs may be open');
  for(const mesh of jersey.children){
    assert.ok(mesh.geometry.normalsComputed,mesh.name);
    assert.ok(mesh.geometry.index.length>0,mesh.name);
    assert.equal(mesh.geometry.getAttribute('position').count*
      3,mesh.geometry.getAttribute('position').values.length);
    assert.equal(mesh.material.metalness,0);
    assert.ok(mesh.material.roughness>=.9);
    assert.equal(mesh.castShadow,true);
    assert.equal(mesh.receiveShadow,true);
  }
  assert.equal(jersey.userData.kitMakerJersey.version,'KM-03A');
  assert.equal(jersey.userData.kitMakerJersey.separateGeometry,true);
  assert.equal(jersey.userData.kitMakerJersey.sleeves,2);
  assert.equal(jersey.userData.kitMakerJersey.connectedShell,true);
  assert.equal(jersey.userData.kitMakerJersey.armholes,2);
  assert.equal(jersey.userData.kitMakerJersey.fitRevision,'KM-03E');
  assert.equal(jersey.userData.kitMakerJersey.shoulderFit,'posed-skin');
  assert.equal(jersey.userData.kitMakerJersey.raisedNeckline,true);
  const collar=jersey.children.find(mesh=>mesh.name==='km03-collar-rib');
  const collarPositions=collar.geometry.getAttribute('position').values;
  const fabricPositions=shell.geometry.getAttribute('position').values;
  const sides=JERSEY_SPEC.circumferenceSegments;
  const p=(side,row)=>collarPositions.slice((row*(sides+1)+side)*3,
    (row*(sides+1)+side)*3+3);
  const front=p(0,0),back=p(sides/2,0);
  assert.ok(Math.abs(front[1]-JERSEY_SPEC.necklineFrontY)<1e-6);
  assert.ok(Math.abs(back[1]-JERSEY_SPEC.necklineBackY)<1e-6);
  assert.ok(front[1]>1.55&&back[1]>front[1],
    'The raised fabric must reach the neck from front and back');
  assert.ok(Math.abs(front[2]-(JERSEY_SPEC.necklineCenterZ+
    JERSEY_SPEC.necklineDepth))<1e-6);
  assert.ok(JERSEY_SPEC.necklineHalfWidth<.09,
    'The neckline must not remain oversized around the neck');
  for(let side=0;side<sides;side++){
    const a=p(side,0),b=p(side,2);
    assert.ok(Math.abs(b[1]-a[1]-JERSEY_SPEC.collarRiseM)<1e-6,
      'The crew neck rib must rise from the shirt');
    let attached=false;
    for(let i=0;i<fabricPositions.length;i+=3){
      if(Math.hypot(a[0]-fabricPositions[i],
        a[1]-fabricPositions[i+1],
        a[2]-fabricPositions[i+2])<1e-6){attached=true;break;}
    }
    assert.ok(attached,'The collar outer edge must meet the main jersey shell');
  }
  assert.throws(()=>createNeutralShortSleeveJersey(root,THREE),/already attached/);
});

test('KM-03B fitted jersey uses narrow body ease and skin-measured arm contours',()=>{
  assert.equal(JERSEY_SPEC.clearanceM,.006);
  assert.equal(JERSEY_SPEC.sleeveEaseM,.0035);
  const shoulder={x:.21,y:1.43,z:.02},axis={x:.052,y:-.26,z:.006};
  const unitLength=Math.hypot(axis.x,axis.y,axis.z);
  const samples=[];
  for(let i=0;i<33;i++){
    const t=.045+i*.022,center={
      x:shoulder.x+axis.x*t,y:shoulder.y+axis.y*t,z:shoulder.z+axis.z*t
    };
    const skinRadius=.052-.010*t;
    for(let j=0;j<24;j++){
      const angle=j/24*Math.PI*2;
      // Sample local radial directions, orthogonal to the measured arm axis.
      const ax=axis.x/unitLength,ay=axis.y/unitLength;
      const tangent=[-ay,ax,0],binormal=[0,0,1];
      samples.push({x:center.x+skinRadius*Math.cos(angle)*tangent[0],
        y:center.y+skinRadius*Math.cos(angle)*tangent[1],
        z:center.z+skinRadius*Math.sin(angle)*binormal[2]});
    }
  }
  const radii=fittedSleeveRadii(samples,shoulder,axis);
  assert.equal(radii.length,13);
  assert.ok(radii.every(r=>r>.046&&r<.072),'Sleeve follows the actual narrow arm');
  assert.ok(radii[0]>radii[12],'The sleeve must taper toward its cuff');
  assert.ok(radii[0]<.09,'No oversized 127 mm upper-arm sleeve cylinder');
  assert.ok(radii.every((r,i)=>i===0||Math.abs(r-radii[i-1])<.016),
    'No abrupt bulges along the arm');
  assert.throws(()=>fittedSleeveRadii(samples,shoulder,{x:0,y:0,z:0}),/Invalid posed sleeve rig/);
});

test('KM-03E samples actual upper shoulder skin rather than stretching the chest cylinder',()=>{
  const sides=JERSEY_SPEC.circumferenceSegments,points=[];
  // Synthetic deltoid contour, with a broad exterior at 1.46 m.
  for(let row=0;row<5;row++){
    const y=1.438+row*.012;
    for(let side=0;side<sides;side++){
      const t=side/sides*Math.PI*2;
      const lateral=Math.pow(Math.abs(Math.sin(t)),8);
      const radius=.135+.118*lateral;
      points.push({x:radius*Math.sin(t),y,z:.02+radius*Math.cos(t)});
    }
  }
  const envelope=shoulderSkinEnvelope(points);
  assert.ok(envelope.accepted>=sides*5);
  assert.ok(envelope.radiusAt(1.465,sides/4)>.24,
    'Lateral cap must preserve the real deltoid width');
  assert.ok(envelope.radiusAt(1.465,3*sides/4)>.24,
    'Right and left shoulders must be equally supported');
  assert.ok(envelope.radiusAt(1.465,0)<.15,
    'Shoulders must not inflate the centre of the chest');
  assert.equal(envelope.radiusAt(1.62,sides/4),0,
    'No artificial shoulder volume beyond sampled anatomy');
  assert.equal(shoulderSkinEnvelope([]).radiusAt(1.46,sides/4),0,
    'Unavailable shoulder samples must leave the fitted torso intact');
});
