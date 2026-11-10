import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createPreviewServer} from '../../tools/dev-standings-preview.mjs';
import {hideAnatomicalBody} from '../../kit-maker/lab/body-visibility.mjs';
import {SENA_MODEL_SHA,SENA_FIT,SENA_INNER_NECK_PRINT_MESH,SENA_BOOT_LACE_MATERIAL,SENA_BOOT_MONOCHROME,getSenaFitMode,fitSenaOutfit,removeSenaInnerNeckPrint,makeSenaJerseySolidWhite,makeSenaShortsSocksSolidWhite,makeSenaBootLacesSolidWhite,makeSenaBootsBlackAndWhite} from '../../kit-maker/lab/sena-fit.mjs';
import {isAllowlistedPublicPath,planPublicFiles} from '../../tools/publication-guard.mjs';

const path=p=>fileURLToPath(new URL('../../'+p,import.meta.url));
const route='/__fa_kit_maker__/alberto-sena-outfit.glb';
async function get(server,url,host='app.localhost:2000',method='GET'){
  return new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port:server.address().port,
      method,path:url,headers:{host}},res=>{
      const parts=[];
      res.on('data',p=>parts.push(p));
      res.on('end',()=>resolve({status:res.statusCode,
        headers:res.headers,bytes:Buffer.concat(parts)}));
    });
    req.on('error',reject);req.end();
  });
}
test('KM-05 clothing-only source and original approved mannequin stay separate',()=>{
  const viewer=readFileSync(path('tools/kit-designer-prototype/viewer.mjs'),'utf8');
  assert.match(viewer,/alberto-sena-outfit\.glb/);
  assert.match(viewer,/FA_\(jersey\|shorts\|socks\|boots\)/);
  assert.match(viewer,/model\.add\(outfit\)/);
  assert.doesNotMatch(viewer,/createNeutralShortSleeveJersey/);
  assert.match(viewer,/mannequin-180\.glb/);
  const exporter=readFileSync(path('tools/kit-designer-prototype/export-sena-outfit.py'),'utf8');
  assert.match(exporter,/if re\.match\(r"\^shoes_/);
  assert.match(exporter,/obj\.name\.lower\(\)/);
  assert.match(exporter,/CLASSIFIED|classify_object/);
  assert.match(exporter,/use_selection=True/);
  assert.match(exporter,/missing_categories/);
  assert.match(exporter,/bounds\["min"\]\[2\]/,
    'Blender source garments must be classified by Z-up height');
  assert.match(exporter,/obj\.matrix_world = world_matrix/,
    'Original 0.1-scaled boots must keep world placement');
});
test('KM-05 third-party binary can never appear in publication allowlist',()=>{
  const ignored=readFileSync(path('.gitignore'),'utf8');
  assert.match(ignored,/^\/kit-maker\/local-assets\/$/m);
  assert.equal(isAllowlistedPublicPath('kit-maker/local-assets/alberto-sena-outfit.glb'),false);
  assert.ok(planPublicFiles().every(p=>!p.includes('/alberto-sena-outfit.glb')));
  // A local artist kit may exist in a developer's ignored workspace.
  // Its existence must not fail tests; it must never enter publication.
});
test('KM-05 optional private outfit path is 404 when absent and inaccessible outside app host',async t=>{
  const server=createPreviewServer({subdomains:true});
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const hasLocalAsset=existsSync(path('kit-maker/local-assets/alberto-sena-outfit.glb'));
  const asset=await get(server,route,'app.localhost:2000','HEAD');
  assert.equal(asset.status,hasLocalAsset?200:404);
  assert.equal(asset.headers['cache-control'],hasLocalAsset?'private, no-store':'no-store');
  if(hasLocalAsset)assert.equal(asset.headers['x-robots-tag'],'noindex, nofollow');
  const other=await get(server,route,'localhost:2000','HEAD');
  assert.equal(other.status,404);
});
test('KM-05 local Blender exporter is syntactically valid when Python is installed',()=>{
  const file=path('tools/kit-designer-prototype/export-sena-outfit.py');
  const run=spawnSync('python',['-c',
    'import ast,sys; ast.parse(open(sys.argv[1],encoding="utf8").read())',file],
    {encoding:'utf8',timeout:15000});
  if(run.error?.code==='ENOENT')return;
  assert.equal(run.status,0,run.stderr);
});

test('KM-06 hide anatomical reference, keep root/rig and appended outfit visible',()=>{
  class Node{
    constructor(isMesh=false){this.isMesh=isMesh;this.visible=true;
      this.castShadow=true;this.receiveShadow=true;this.children=[];}
    add(child){this.children.push(child);return child;}
    traverse(cb){cb(this);for(const child of this.children)child.traverse(cb);}
  }
  const rig=new Node(),bone=rig.add(new Node());
  const skin=bone.add(new Node(true)),eye=bone.add(new Node(true));
  const hidden=hideAnatomicalBody(rig);
  assert.equal(hidden,2);
  assert.equal(rig.visible,true);
  assert.equal(bone.visible,true);
  for(const mesh of [skin,eye]){
    assert.equal(mesh.visible,false);
    assert.equal(mesh.castShadow,false);
    assert.equal(mesh.receiveShadow,false);
  }
  const outfit=rig.add(new Node()),shirt=outfit.add(new Node(true));
  assert.equal(outfit.visible,true);
  assert.equal(shirt.visible,true);
  assert.equal(bone.children.length,2,'Anatomical skeleton hierarchy unchanged');
  assert.throws(()=>hideAnatomicalBody(null),/root is unavailable/);
  assert.throws(()=>hideAnatomicalBody(new Node()),/no renderable meshes/);
});

test('KM-11 upgrades original and KM-07 GLBs, keeps shoes fixed and avoids double fits',()=>{
  assert.equal(getSenaFitMode(SENA_MODEL_SHA.original),'apply-original');
  assert.equal(getSenaFitMode(SENA_MODEL_SHA.km07),'apply-km11');
  assert.equal(getSenaFitMode(SENA_MODEL_SHA.km08),'upgrade-km08');
  assert.equal(getSenaFitMode('unknown'),'unknown');

  function geometry(sign=1,{cuff=.105,upper=.28,shoulder=.4,cuffX=.09,heelZ=.03}={}){
    const p=[sign*.08,shoulder,.02,sign*cuffX,cuff,heelZ,sign*.10,upper,.04];
    const n=[0,1,0,0,1,0,0,1,0];
    const attr=a=>({
      count:a.length/3,
      getX:i=>a[3*i],getY:i=>a[3*i+1],getZ:i=>a[3*i+2],
      setXYZ:(i,x,y,z)=>{a[3*i]=x;a[3*i+1]=y;a[3*i+2]=z;}
    });
    return {positions:p,normals:n,uv:[.2,.4],getAttribute:k=>attr(k==='position'?p:n),
      computeBoundingBox(){},computeBoundingSphere(){}};
  }
  function scene(start='km07'){
    const km08=start==='km08',g=km08?{
      cuff:.098,upper:.326,shoulder:.446,cuffX:.101,heelZ:.005
    }:{};
    const meshes=[
      {name:'FA_jersey__shirt',isMesh:true,geometry:geometry(1,g)},
      {name:'FA_shorts__pants',isMesh:true,geometry:geometry(1,g)},
      {name:'FA_socks__right',isMesh:true,geometry:geometry(1,g)},
      {name:'FA_socks__left',isMesh:true,geometry:geometry(-1,g)},
      {name:'FA_boots__right',isMesh:true,geometry:geometry(1)},
      {name:'FA_boots__left',isMesh:true,geometry:geometry(-1)}
    ];
    const root={userData:{},traverse:fn=>meshes.forEach(fn)};
    return {root,meshes};
  }
  for(const hash of [SENA_MODEL_SHA.original,SENA_MODEL_SHA.km07]){
    const {root,meshes}=scene();
    const footwear=meshes.slice(4).map(m=>[...m.geometry.positions]);
    const originalUV=meshes.map(m=>[...m.geometry.uv]);
    const result=fitSenaOutfit(root,hash);
    assert.equal(result.revision,'KM-11');
    assert.equal(result.changed,4);
    assert.equal(root.userData.senaFitRevision,'KM-11');
    assert.ok(Math.abs(meshes[0].geometry.positions[1]-.48)<1e-6);
    assert.ok(Math.abs(meshes[1].geometry.positions[1]-.48)<1e-6);
    for(const [idx,sign] of [[2,1],[3,-1]]){
      const p=meshes[idx].geometry.positions;
      assert.ok(Math.abs(p[3]-sign*.101)<1e-6,'Sock cuff 11mm outward');
      assert.ok(Math.abs(p[4]-.130)<1e-6,'Sock cuff at 130mm');
      assert.ok(Math.abs(p[5]-.005)<1e-6,'Sock ankle 25mm heelward');
      assert.ok(Math.abs(p[7]-.36)<1e-6,'Upper sock at +80mm');
    }
    assert.deepEqual(meshes.slice(4).map(m=>m.geometry.positions),footwear);
    assert.deepEqual(meshes.map(m=>m.geometry.uv),originalUV);
    const before=meshes.map(m=>[...m.geometry.positions]);
    const repeated=fitSenaOutfit(root,hash);
    assert.equal(repeated.mode,'already-applied');
    assert.equal(repeated.changed,0);
    assert.deepEqual(meshes.map(m=>m.geometry.positions),before);
  }
  const unknown=scene();
  const untouched=unknown.meshes.map(m=>[...m.geometry.positions]);
  assert.throws(()=>fitSenaOutfit(unknown.root,'unknown'),/Unrecognized/);
  assert.deepEqual(unknown.meshes.map(m=>m.geometry.positions),untouched);
});
test('KM-11 also lifts a pre-corrected KM-08 GLB instead of skipping it',()=>{
  function geometry(sign,group){
    const isBoot=group==='boots';
    const isSock=group==='socks';
    const cuff=isSock?.098:.12,top=isSock?.326:.446;
    const p=[sign*.08,top,.02,sign*(isSock?.101:.09),cuff,isSock?.005:.03];
    const n=[0,1,0,0,1,0];
    const a=arr=>({count:arr.length/3,getX:i=>arr[3*i],getY:i=>arr[3*i+1],
      getZ:i=>arr[3*i+2],setXYZ:(i,x,y,z)=>{arr[3*i]=x;arr[3*i+1]=y;arr[3*i+2]=z;}});
    return {positions:p,normals:n,uv:[0,0,1,1],getAttribute:k=>a(k==='position'?p:n),
      computeBoundingBox(){},computeBoundingSphere(){}};
  }
  const meshes=['jersey','shorts','socks','boots'].map(group=>({
    name:'FA_'+group+'__fixture',isMesh:true,geometry:geometry(1,group)
  }));
  const root={userData:{},traverse:fn=>meshes.forEach(fn)};
  const oldBoot=[...meshes[3].geometry.positions];
  const result=fitSenaOutfit(root,SENA_MODEL_SHA.km08);
  assert.equal(result.mode,'upgrade-km08');
  assert.equal(result.revision,'KM-11');
  assert.equal(result.changed,3);
  assert.ok(Math.abs(meshes[0].geometry.positions[1]-.48)<1e-6);
  assert.ok(Math.abs(meshes[1].geometry.positions[1]-.48)<1e-6);
  assert.ok(Math.abs(meshes[2].geometry.positions[1]-.36)<1e-6);
  assert.ok(Math.abs(meshes[2].geometry.positions[4]-.130)<1e-6);
  assert.ok(Math.abs(meshes[2].geometry.positions[3]-.101)<1e-6,
    'KM-08 cuff already positioned laterally: no duplicate outward movement');
  assert.ok(Math.abs(meshes[2].geometry.positions[5]-.005)<1e-6,
    'KM-08 heel already positioned: no duplicate heel shift');
  assert.deepEqual(meshes[3].geometry.positions,oldBoot);
});

test('KM-11 cuff clears the measured boot height while preserving original assets',()=>{
  // Shoe upper world bound measured on the unchanged author GLB during KM-07 QA.
  const measuredBootMaxY=0.118171;
  assert.equal(SENA_FIT.revision,'KM-11');
  assert.equal(SENA_FIT.shirtShortsLiftM,.080);
  assert.equal(SENA_FIT.socksLiftM,.080);
  assert.ok(SENA_FIT.sockCuffY-measuredBootMaxY>=.010,
    'Lower sock cuff must clear fixed shoe maximum by at least 10mm');
  assert.ok(SENA_FIT.sockCuffY>.102,
    'Distance from the boots must increase relative to KM-10');
  assert.equal(SENA_FIT.ankleOutwardM,.011);
  assert.equal(SENA_FIT.ankleHeelwardM,-.025);
});

test('KM-12 removes only the black-lettered curved tape inside the jersey neck',()=>{
  assert.equal(SENA_INNER_NECK_PRINT_MESH,'FA_jersey__Pattern_2702362');
  const collar={isMesh:true,name:'FA_jersey__Pattern2D_3805002'};
  const printedTape={isMesh:true,name:SENA_INNER_NECK_PRINT_MESH};
  const jersey={isMesh:true,name:'FA_jersey__42'};
  const shorts={isMesh:true,name:'FA_shorts__Pattern2D_1871004'};
  const socks={isMesh:true,name:'FA_socks__Pattern2D_3590'};
  const shoes={isMesh:true,name:'FA_boots__shoes_l.001'};
  const root={children:[],remove(child){
    const i=this.children.indexOf(child);
    if(i>=0){this.children.splice(i,1);child.parent=null;}
  },traverse(fn){
    fn(this);for(const child of [...this.children])fn(child);
  }};
  for(const child of [jersey,collar,printedTape,shorts,socks,shoes]){
    child.parent=root;root.children.push(child);
  }
  const originalGeometry=[jersey,collar,shorts,socks,shoes];
  const result=removeSenaInnerNeckPrint(root);
  assert.equal(result.removed,1);
  assert.equal(result.meshName,SENA_INNER_NECK_PRINT_MESH);
  assert.equal(printedTape.parent,null);
  assert.equal(root.children.length,5);
  assert.deepEqual(root.children,originalGeometry,
    'No outer collar, jersey, shorts, socks or boots may be removed');
  assert.throws(()=>removeSenaInnerNeckPrint(root),/exactly one/);
  const duplicated={children:[{isMesh:true,name:SENA_INNER_NECK_PRINT_MESH},
    {isMesh:true,name:SENA_INNER_NECK_PRINT_MESH}],
    traverse(fn){for(const x of this.children)fn(x);}};
  assert.throws(()=>removeSenaInnerNeckPrint(duplicated),/exactly one/);
});

test('KM-13 solid white jersey removes every texture only from jersey meshes',()=>{
  class MockWhiteMaterial{
    constructor(options){
      Object.assign(this,options);
      this.map=null;
      this.normalMap=null;
      this.roughnessMap=null;
      this.metalnessMap=null;
      this.emissiveMap=null;
    }
  }
  const THREE={MeshStandardMaterial:MockWhiteMaterial,FrontSide:0};
  const atlas={name:'source-artist-atlas'};
  let disposed=0;
  const shared={map:atlas,normalMap:atlas,roughnessMap:atlas,
    side:2,dispose:()=>{disposed++;}};
  const trim={map:atlas,side:1,dispose:()=>{disposed++;}};
  const shirt={name:'FA_jersey__Pattern2D_38244',isMesh:true,
    material:shared,geometry:{id:'shirt'}};
  const sleeve={name:'FA_jersey__Pattern2D_38245',isMesh:true,
    material:[shared,trim],geometry:{id:'sleeve'}};
  const collar={name:'FA_jersey__Pattern2D_3805002',isMesh:true,
    material:shared,geometry:{id:'collar'}};
  const shorts={name:'FA_shorts__Pattern2D_190',isMesh:true,
    material:shared,geometry:{id:'shorts'}};
  const socks={name:'FA_socks__Pattern2D_3590',isMesh:true,
    material:trim,geometry:{id:'socks'}};
  const boots={name:'FA_boots__shoes_l.001',isMesh:true,
    material:shared,geometry:{id:'boots'}};
  const meshes=[shirt,sleeve,collar,shorts,socks,boots];
  const root={userData:{},traverse:fn=>meshes.forEach(fn)};
  const geometries=meshes.map(m=>m.geometry);
  const res=makeSenaJerseySolidWhite(root,THREE);
  assert.equal(res.changed,3);
  assert.equal(root.userData.senaJerseyBase,'solid-white');
  assert.equal(disposed,0,'GLTF materials must never be disposed while still shared');
  for(const child of [shirt,sleeve,collar]){
    for(const material of Array.isArray(child.material)?child.material:[child.material]){
      assert.ok(material instanceof MockWhiteMaterial);
      assert.equal(material.color,0xffffff);
      assert.equal(material.roughness,.85);
      assert.equal(material.metalness,0);
      assert.equal(material.transparent,false);
      assert.equal(material.map,null);
      assert.equal(material.normalMap,null);
      assert.equal(material.roughnessMap,null);
      assert.equal(material.metalnessMap,null);
      assert.equal(material.emissiveMap,null);
      assert.match(material.name,/^km13-white-/);
    }
  }
  assert.equal(shirt.material.side,2);
  assert.equal(sleeve.material.length,2,'Original geometry material groups preserved');
  assert.equal(sleeve.material[1].side,1);
  assert.equal(collar.material.side,2);
  assert.equal(shorts.material,shared);
  assert.equal(socks.material,trim);
  assert.equal(boots.material,shared);
  assert.equal(shared.map,atlas);
  assert.deepEqual(meshes.map(m=>m.geometry),geometries);
  assert.equal(makeSenaJerseySolidWhite(root,THREE).changed,0,
    'Repeated application must not recreate white materials');
  assert.throws(()=>makeSenaJerseySolidWhite(null,THREE),/Missing outfit scene/);
  assert.throws(()=>makeSenaJerseySolidWhite({traverse(){}},THREE),/No jersey meshes/);
  assert.throws(()=>makeSenaJerseySolidWhite(root,{}),/MeshStandardMaterial/);
});

test('KM-14B GLTFLoader boots: five single-material meshes per foot, white only laces',()=>{
  class White{
    constructor(o){Object.assign(this,o);this.map=null;this.normalMap=null;}
  }
  const THREE={MeshStandardMaterial:White,FrontSide:0},atlas={source:true};
  let disposed=0;
  const original=name=>({name,map:atlas,dispose:()=>{disposed++;}});
  const shirtMat=original('white-shirt'),shortMat=original('shorts');
  const sockMat=original('socks');
  const bootMats=Array.from({length:5},(_,i)=>original('FA_boots__material_'+i));
  const jersey={name:'FA_jersey__body',isMesh:true,material:shirtMat,geometry:{id:1}};
  const shorts={name:'FA_shorts__body',isMesh:true,material:shortMat,geometry:{id:2}};
  const socks={name:'FA_socks__left',isMesh:true,material:[sockMat,shortMat],geometry:{id:3}};
  const boots=['l','r'].flatMap(side=>bootMats.map((mat,i)=>({
    name:'FA_boots__shoes_'+side+'001'+(i?'_'+i:''),
    isMesh:true,material:mat,geometry:{id:side+i}
  })));
  const meshes=[jersey,shorts,socks,...boots],root={
    userData:{},traverse(fn){for(const mesh of meshes)fn(mesh);}
  };
  const originalGeometry=meshes.map(m=>m.geometry);
  assert.equal(SENA_BOOT_LACE_MATERIAL,'FA_boots__material_1');
  const lower=makeSenaShortsSocksSolidWhite(root,THREE);
  assert.deepEqual(lower.counts,{shorts:1,socks:1});
  assert.equal(jersey.material,shirtMat);
  for(const material of [shorts.material,...socks.material]){
    assert.ok(material instanceof White);
    assert.equal(material.color,0xffffff);
    assert.equal(material.map,null);
  }
  const lace=makeSenaBootLacesSolidWhite(root,THREE);
  assert.equal(lace.changed,2);
  assert.equal(lace.materialSlot,1);
  for(const side of ['l','r']){
    const parts=boots.filter(m=>m.name.includes('shoes_'+side+'001'));
    assert.equal(parts.length,5);
    for(let i=0;i<5;i++){
      if(i===1){
        assert.ok(parts[i].material instanceof White);
        assert.equal(parts[i].material.color,0xffffff);
        assert.equal(parts[i].material.map,null);
      }else{
        assert.equal(parts[i].material,bootMats[i],
          'Never recolour boot upper, sole or studs');
      }
    }
  }
  assert.deepEqual(meshes.map(m=>m.geometry),originalGeometry);
  assert.equal(bootMats[1].map,atlas);
  assert.equal(disposed,0);
  assert.equal(makeSenaBootLacesSolidWhite(root,THREE).changed,0);
  assert.equal(makeSenaShortsSocksSolidWhite(root,THREE).changed,0);
});

test('KM-14B two-foot validation fails atomically if a lace primitive is absent',()=>{
  class White{constructor(o){Object.assign(this,o);}}
  const THREE={MeshStandardMaterial:White,FrontSide:0};
  const pieces=['l','r'].flatMap(side=>Array.from({length:5},(_,i)=>({
    name:'FA_boots__shoes_'+side+'001'+(i?'_'+i:''),
    isMesh:true,material:{name:'FA_boots__material_'+i},
    geometry:{id:side+i}
  })));
  const root={userData:{},traverse(fn){for(const m of pieces)fn(m);}};
  pieces.find(m=>m.name==='FA_boots__shoes_r001_1').material.name='missing-laces';
  const original=pieces.map(m=>m.material);
  assert.throws(()=>makeSenaBootLacesSolidWhite(root,THREE),/Dedicated lace/);
  assert.deepEqual(pieces.map(m=>m.material),original);
  assert.equal(root.userData.senaWhiteLaces,undefined);
  assert.throws(()=>makeSenaBootLacesSolidWhite(null,THREE),/Missing outfit scene/);
});

test('KM-15 actual glTF boot primitives have only black and white visible materials',()=>{
  class Material{
    constructor(o){Object.assign(this,o);
      this.map=null;this.normalMap=null;this.metalnessMap=null;
      this.roughnessMap=null;this.emissiveMap=null;}
  }
  const THREE={MeshStandardMaterial:Material,FrontSide:0};
  const greenAtlas={name:'fluorescent-green-atlas'};
  const grayscaleAtlas={name:'grayscale-upper-atlas'};
  const sources=Array.from({length:5},(_,i)=>({
    name:'FA_boots__material_'+i,
    map:i===0?grayscaleAtlas:greenAtlas,
    side:i===3?2:0
  }));
  // Real THREE.GLTFLoader turns each of five primitives into one Mesh.
  const bootMeshes=['l','r'].flatMap(side=>sources.map((material,index)=>({
    isMesh:true,
    name:'FA_boots__shoes_'+side+'001'+(index?'_'+index:''),
    geometry:{id:'geometry-'+side+'-'+index},
    material
  })));
  const nonBoot={name:'FA_jersey__body',isMesh:true,
    material:{name:'white-jersey'},geometry:{id:'jersey'}};
  const meshes=[...bootMeshes,nonBoot],root={
    userData:{},traverse(fn){for(const m of meshes)fn(m);}
  };
  const geo=meshes.map(m=>m.geometry);
  const original0=bootMeshes.filter(m=>m.material.name==='FA_boots__material_0');
  const originalLaces=bootMeshes.filter(m=>m.material.name==='FA_boots__material_1');
  assert.equal(SENA_BOOT_MONOCHROME['FA_boots__material_4'],'black');
  const result=makeSenaBootsBlackAndWhite(root,THREE);
  assert.equal(result.changed,6);
  assert.equal(result.blackStudAndTrimMaterials,4);
  assert.equal(result.whiteDetailMaterials,2);
  for(const side of ['l','r']){
    const group=bootMeshes.filter(m=>m.name.includes('shoes_'+side+'001'));
    assert.equal(group.length,5);
    assert.equal(group[0].material,sources[0],
      'Original grayscale upper texture retained');
    assert.equal(group[1].material,sources[1],
      'Lace material left for KM-14B to whiten');
    assert.ok(group[2].material instanceof Material);
    assert.equal(group[2].material.color,0xffffff);
    assert.equal(group[2].material.map,null);
    assert.equal(group[3].material.color,0x181818);
    assert.equal(group[3].material.map,null);
    assert.equal(group[3].material.side,2);
    assert.equal(group[4].material.color,0x101010);
    assert.equal(group[4].material.map,null,'No more green studs');
  }
  assert.deepEqual(bootMeshes.map(m=>m.geometry),geo.slice(0,10));
  assert.equal(nonBoot.material.name,'white-jersey');
  assert.equal(sources[4].map,greenAtlas,'Do not alter original assets');
  assert.equal(makeSenaBootsBlackAndWhite(root,THREE).changed,0);
  const laceResult=makeSenaBootLacesSolidWhite(root,THREE);
  assert.equal(laceResult.changed,2);
  for(const m of originalLaces){
    assert.equal(m.material.color,0xffffff);
    assert.equal(m.material.map,null);
  }
  assert.equal(makeSenaBootLacesSolidWhite(root,THREE).changed,0);
  assert.throws(()=>makeSenaBootsBlackAndWhite(null,THREE),/Missing outfit scene/);
});

test('KM-15 if boot materials are unexpected, neither shoe is repainted',()=>{
  class Material{constructor(x){Object.assign(this,x);}}
  const THREE={MeshStandardMaterial:Material,FrontSide:0};
  const all=['l','r'].flatMap(side=>Array.from({length:5},(_,i)=>({
    isMesh:true,
    name:'FA_boots__shoes_'+side+'001'+(i?'_'+i:''),
    material:{name:'FA_boots__material_'+i},
    geometry:{id:side+i}
  })));
  const root={userData:{},traverse(fn){for(const m of all)fn(m);}};
  const before=all.map(m=>m.material);
  all[8].material.name='unsupported-shoe-material';
  assert.throws(()=>makeSenaBootsBlackAndWhite(root,THREE),/Unexpected or duplicate/);
  assert.deepEqual(all.map(m=>m.material),before);
  assert.equal(root.userData.senaBootsMonochrome,undefined);
});
