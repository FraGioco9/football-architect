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
import {JERSEY_SPEC,torsoEnvelope,createNeutralShortSleeveJersey} from '../../kit-maker/lab/jersey-geometry.mjs';

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
  assert.equal((html.match(/class="km-color-option"/g)||[]).length,2);
  assert.match(html,/Primary/);
  assert.match(html,/Secondary/);
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
test('KM-01 uses only its private, whitelisted local WebGL assets',async t=>{
  const server=await open({subdomains:true});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  for(const path of ['/__fa_kit_maker__/lab.css',
    '/__fa_kit_maker__/viewer.mjs','/__fa_kit_maker__/reference-import.mjs',
    '/__fa_kit_maker__/rigged-arms.mjs',
    '/__fa_kit_maker__/club-select.mjs',
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
  assert.match(script,/studioAssets\+"mannequin-180\.glb"/);
  assert.match(script,/studioAssets\+"mannequin-180\.obj"/);
  assert.ok(script.includes('location.pathname==="/dev/kit-maker"'));
  assert.match(script,/new GLTFLoader\(\)\.parseAsync/);
  assert.ok(script.includes('await import(studioAssets+"jersey-geometry.mjs")'));
  assert.ok(script.includes('createNeutralShortSleeveJersey(model,THREE)'));
  assert.ok(script.includes('if(location.pathname==="/dev/kit-maker")'));
  const garment=(await get(server,'/__fa_kit_maker__/jersey-geometry.mjs')).body.toString('utf8');
  assert.ok(garment.includes('export function createNeutralShortSleeveJersey'));
  assert.ok(garment.includes('mesh.getVertexPosition(i,vertex)'));
  assert.ok(garment.includes('km03-jersey-sleeve-'));
  assert.ok(garment.includes('km03-collar-rib'));
  assert.doesNotMatch(garment,/fetch\(|localStorage|sessionStorage|\bPOST\b/);
  assert.ok(script.includes('referenceInput?.addEventListener'));
  assert.ok(script.includes('if(!modelTitle||!modelDescription'));
  const clubsJS=(await get(server,'/__fa_kit_maker__/club-select.mjs')).body.toString('utf8');
  assert.ok(clubsJS.includes('/clubs/_shared/manifest.json'));
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
    '__fa_kit_maker__/club-select.mjs','__fa_kit_maker__/jersey-geometry.mjs',
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
  const bones=[{name:'spine01'},{name:'upperarm01.L',isBone:true,
    getWorldPosition:()=>new V(.205,1.441,.019)},
  {name:'lowerarm01.L',isBone:true,getWorldPosition:()=>new V(.252,1.182,.022)},
  {name:'upperarm01.R',isBone:true,getWorldPosition:()=>new V(-.205,1.441,.019)},
  {name:'lowerarm01.R',isBone:true,getWorldPosition:()=>new V(-.252,1.182,.022)}];
  const skinned={
    isSkinnedMesh:true,skeleton:{bones},
    geometry:{getAttribute:name=>({
      position:{count:points.length},skinIndex:{getComponent:()=>0},
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
  assert.equal(jersey.children.length,8);
  assert.deepEqual(jersey.children.map(mesh=>mesh.name),[
    'km03-jersey-torso','km03-jersey-shoulders','km03-collar-rib',
    'km03-jersey-sleeve-l','km03-jersey-cuff-l',
    'km03-jersey-sleeve-r','km03-jersey-cuff-r','km03-jersey-hem'
  ]);
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
  assert.throws(()=>createNeutralShortSleeveJersey(root,THREE),/already attached/);
});
