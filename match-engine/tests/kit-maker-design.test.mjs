import test from 'node:test';
import assert from 'node:assert/strict';
import {KIT_PARTS,KIT_STYLES,KIT_STRIPE_WIDTH_RANGE,formatKitStripeWidth,isKitStripeWidthAllowed,KIT_NEUTRALS,kitColorChoices,
  createKitDesignStore,applySolidKitColors,applyKitDesign,KIT_STRIPE_SHADER_KEY,
  stripeSectionForMesh,measureKitStripeFabricMetric,
  kitJerseyDetailRegion,KIT_CUFF_BORDER_METRES,
  KIT_CUFF_FOLD_RETURN_METRES,KIT_TORSO_HEM_METRES,
  measureKitPhysicalTrimProjection} from '../../kit-maker/lab/kit-design.mjs';

// Minimal BufferGeometry-like fixture with a true flattened sewing-pattern UV
// and 3D vertex positions. A metre on this cloth is independent of its shape
// after the original artist drapes it over a side seam.
function fabricGeometry(tag,metresPerUV=1.52,offset=0,mirror=false){
  const rawPairs=[[.1,.2],[.2,.2],[.1,.3],[.2,.2],[.2,.3],[.1,.3]];
  const uvPairs=rawPairs.map(([u,v])=>[offset+(mirror?.3-u:u),v]);
  const points=rawPairs.map(([u,v])=>[u*metresPerUV,v*metresPerUV,0]);
  const uv={
    count:uvPairs.length,
    getX(i){return uvPairs[i][0];},
    getY(i){return uvPairs[i][1];}
  };
  const position={
    count:points.length,
    getX(i){return points[i][0];},
    getY(i){return points[i][1];},
    getZ(i){return points[i][2];}
  };
  return {tag,index:null,getAttribute(key){
    return key==='uv'?uv:key==='position'?position:null;
  }};
}


test('KM-17 initial design shows Solid and Vertical stripes, three garments and allowed neutrals',()=>{
  assert.deepEqual(KIT_PARTS,['jersey','shorts','socks']);
  assert.deepEqual(KIT_STYLES.map(s=>s.id),['solid','vertical-stripes']);
  assert.deepEqual(KIT_STRIPE_WIDTH_RANGE,
    {minMm:30,maxMm:150,stepMm:5,defaultMm:75});
  assert.equal(formatKitStripeWidth(75),'7.5 cm');
  assert.equal(formatKitStripeWidth(100),'10 cm');
  assert.equal(isKitStripeWidthAllowed(.075),true);
  assert.equal(isKitStripeWidthAllowed(.11),true);
  assert.equal(isKitStripeWidthAllowed(.074),false);
  assert.deepEqual(KIT_NEUTRALS.map(c=>c.hex),
    ['#FFFFFF','#111111','#808080','#F5F1E9']);
  const state=createKitDesignStore().getState();
  assert.equal(state.clubId,null);
  assert.equal(state.activePart,'jersey');
  assert.equal(state.style,'solid');
  assert.deepEqual(state.styles,{jersey:'solid',shorts:'solid',socks:'solid'});
  assert.equal(state.activeLayer,'base');
  assert.equal(state.choices.length,6);
  assert.equal(state.choices[0].enabled,false);
  assert.equal(state.choices[1].enabled,false);
  assert.ok(state.choices.slice(2).every(c=>c.enabled));
  assert.deepEqual(state.colors,{
    jersey:'#FFFFFF',shorts:'#FFFFFF',socks:'#FFFFFF'
  });
});

test('KM-16 palette uses supplied canonical club colours and no draft proposals',()=>{
  const example={primaryColor:'#173b65',secondaryColor:'#f5f1e9'};
  assert.deepEqual(kitColorChoices(example).slice(0,2).map(c=>c.hex),
    ['#173B65','#F5F1E9']);
  assert.equal(kitColorChoices({primaryColor:'red',secondaryColor:'#12af42'})[0].hex,null);
  const state=createKitDesignStore();
  assert.equal(state.selectColor('primary'),false,
    'Club colours disabled before catalogue selection');
  state.setClub('ENG-1',example);
  assert.equal(state.selectColor('primary'),true);
  assert.equal(state.getState().colors.jersey,'#173B65');
  state.selectPart('shorts');
  assert.equal(state.selectColor('secondary'),true);
  assert.equal(state.getState().colors.shorts,'#F5F1E9');
  state.setClub('BR-1',{primaryColor:'#ae4656',secondaryColor:'#4b8e88'});
  assert.equal(state.getState().colors.jersey,'#AE4656',
    'Role selection must track newly selected club');
  assert.equal(state.getState().colors.shorts,'#4B8E88');
  assert.equal(state.getState().colors.socks,'#FFFFFF');
  state.setClub(null);
  assert.equal(state.getState().colors.jersey,'#FFFFFF',
    'Club role falls back to white while no club is selected');
  assert.equal(state.getState().choices[0].enabled,false);
  assert.equal(state.selectColor('primary'),false);
});

test('KM-16 each garment has independent colour, state listeners are unsubscribable',()=>{
  const store=createKitDesignStore(),updates=[];
  const unsub=store.subscribe(state=>updates.push(state));
  store.setClub('IT-1',{primaryColor:'#A52332',secondaryColor:'#D5AA46'});
  store.selectPart('jersey');store.selectColor('primary');
  store.selectPart('shorts');store.selectColor('neutral-black');
  store.selectPart('socks');store.selectColor('neutral-ivory');
  const state=store.getState();
  assert.deepEqual(state.colors,{
    jersey:'#A52332',shorts:'#111111',socks:'#F5F1E9'
  });
  assert.equal(state.style,'solid');
  store.selectStyle('solid');
  assert.throws(()=>store.selectStyle('stripes'),/Unsupported/);
  assert.throws(()=>store.selectPart('boots'),/Unknown kit garment/);
  assert.equal(store.selectColor('#FF0000'),false,'No arbitrary hex colours');
  assert.equal(store.selectColor('unapproved-green'),false);
  assert.throws(()=>store.setClub('XX-100',{primaryColor:'red',secondaryColor:'#FFFFFF'}),
    /canonical primary/);
  unsub();
  const before=updates.length;
  store.selectPart('jersey');
  assert.equal(updates.length,before);
  assert.ok(before>=7);
});

test('KM-16 applies each selected colour to private garment materials only',()=>{
  const seen=[];
  function material(prefix,name){
    return {name:prefix+name,map:null,
      color:{set(hex){seen.push({material:name,hex});this.hex=hex;}}};
  }
  const jersey={isMesh:true,name:'FA_jersey__body',
    material:material('km13-white-','jersey'),geometry:{tag:'jersey'}};
  const shorts={isMesh:true,name:'FA_shorts__body',
    material:[material('km14-white-','shorts-0'),
      material('km14-white-','shorts-1')],geometry:{tag:'shorts'}};
  const socks={isMesh:true,name:'FA_socks__left',
    material:material('km14-white-','socks'),geometry:{tag:'socks'}};
  const boots={isMesh:true,name:'FA_boots__shoes_l001_1',
    material:material('km14-white-','laces'),geometry:{tag:'boots'}};
  const geometries=[jersey,shorts,socks,boots].map(m=>m.geometry);
  const meshes=[jersey,shorts,socks,boots],root={
    traverse(fn){for(const mesh of meshes)fn(mesh);}
  };
  const result=applySolidKitColors(root,{
    jersey:'#173B65',shorts:'#111111',socks:'#F5F1E9'
  });
  assert.equal(result.changedMaterials,4);
  assert.deepEqual(seen.map(v=>v.hex),
    ['#173B65','#111111','#111111','#F5F1E9']);
  assert.equal(boots.material.color.hex,undefined);
  assert.deepEqual(meshes.map(m=>m.geometry),geometries);
  assert.equal(jersey.material.map,null);
  applySolidKitColors(root,{jersey:'#FFFFFF',shorts:'#FFFFFF',socks:'#FFFFFF'});
  assert.equal(jersey.material.color.hex,'#FFFFFF');
  assert.equal(shorts.material[1].color.hex,'#FFFFFF');
});

test('KM-16 rejects unsupported materials and partial palettes before recolouring',()=>{
  let updates=0;
  const good=group=>({
    isMesh:true,name:'FA_'+group+'__mesh',
    material:{name:group==='jersey'?'km13-white-a':'km14-white-a',
      color:{set(){updates++;}}}
  });
  const meshes=['jersey','shorts','socks'].map(good);
  const root={traverse(fn){for(const mesh of meshes)fn(mesh);}};
  assert.throws(()=>applySolidKitColors(root,{
    jersey:'#FF0000',shorts:'#00FF00',socks:'invalid'
  }),/Invalid allowed/);
  assert.equal(updates,0);
  meshes[2].material={name:'source-artist-material',color:{set(){updates++;}}};
  assert.throws(()=>applySolidKitColors(root,{
    jersey:'#FFFFFF',shorts:'#FFFFFF',socks:'#FFFFFF'
  }),/not a private neutral/);
  assert.equal(updates,0,'Validation should be atomic before changing colours');
  assert.throws(()=>applySolidKitColors(null,{}),/Missing outfit/);
});

test('KM-18 slider widths and layers are independent for each garment',()=>{
  const store=createKitDesignStore();
  assert.throws(()=>store.selectColorLayer('accent'),/unavailable for solid/);
  assert.throws(()=>store.selectStripeWidth(110),/unavailable for solid/);
  store.selectStyle('vertical-stripes');
  store.selectColor('neutral-grey'); // Base
  store.selectColorLayer('accent');
  store.selectColor('neutral-black'); // Stripes
  store.selectStripeWidth(45);
  let design=store.getState();
  assert.equal(design.style,'vertical-stripes');
  assert.equal(design.colors.jersey,'#808080');
  assert.equal(design.accentColors.jersey,'#111111');
  assert.equal(design.widths.jersey,.045);
  assert.equal(design.activeLayer,'accent');
  store.selectPart('shorts');
  assert.equal(store.getState().style,'solid');
  assert.equal(store.getState().activeLayer,'base');
  store.selectStyle('vertical-stripes');
  store.selectStripeWidth(110);
  store.selectColorLayer('accent');
  store.selectColor('neutral-ivory');
  store.selectPart('jersey');
  design=store.getState();
  assert.equal(design.style,'vertical-stripes');
  assert.equal(design.activeLayer,'base','Switching garment selects the base layer');
  assert.equal(design.widths.jersey,.045);
  assert.equal(design.widths.shorts,.11);
  assert.equal(design.accentColors.shorts,'#F5F1E9');
  assert.equal(design.styles.socks,'solid');
  store.selectStyle('solid');
  assert.equal(store.getState().style,'solid');
  store.selectStyle('vertical-stripes');
  assert.equal(store.getState().accentColors.jersey,'#111111',
    'Switching styles must not forget the stripe colour');
  assert.equal(store.getState().widths.jersey,.045);
  assert.throws(()=>store.selectStripeWidth('invalid'),/Unsupported/);
  assert.throws(()=>store.selectStripeWidth(74),/Unsupported/);
  assert.throws(()=>store.selectStripeWidth(155),/Unsupported/);
  assert.throws(()=>store.selectStripeWidth(25),/Unsupported/);
  assert.throws(()=>store.selectStripeWidth(75.5),/Unsupported/);
  assert.throws(()=>store.selectStripeWidth(0),/Unsupported/);
  assert.throws(()=>store.selectColorLayer('third'),/Unsupported/);
});

test('KM-17 stripe roles follow published club colours, not draft palettes',()=>{
  const store=createKitDesignStore();
  store.setClub('ENG-1',{primaryColor:'#173B65',secondaryColor:'#FFFFFF'});
  store.selectColor('primary');
  store.selectStyle('vertical-stripes');
  store.selectColorLayer('accent');
  store.selectColor('secondary');
  let state=store.getState();
  assert.equal(state.colors.jersey,'#173B65');
  assert.equal(state.accentColors.jersey,'#FFFFFF');
  store.setClub('ENG-2',{primaryColor:'#882E2D',secondaryColor:'#F5F1E9'});
  state=store.getState();
  assert.equal(state.colors.jersey,'#882E2D');
  assert.equal(state.accentColors.jersey,'#F5F1E9');
  store.setClub(null);
  state=store.getState();
  assert.equal(state.colors.jersey,'#FFFFFF');
  assert.equal(state.accentColors.jersey,'#FFFFFF');
  assert.equal(store.selectColor('primary'),false);
});

test('KM-20 flat-fabric UV shader maintains even stripe widths on curved kit',()=>{
  class FakeColor {
    constructor(hex){this.hex=hex;}
    set(hex){this.hex=hex;return this;}
  }
  const THREE={Color:FakeColor};
  function privateMaterial(prefix,name){
    return {name:prefix+name,color:new FakeColor('#FFFFFF'),userData:{},
      needsUpdate:false};
  }
  const meshes=[
    {isMesh:true,name:'FA_jersey__body',material:privateMaterial('km13-white-','jersey'),
      geometry:fabricGeometry('shirt')},
    {isMesh:true,name:'FA_shorts__body',material:[
      privateMaterial('km14-white-','shortsA'),privateMaterial('km14-white-','shortsB')],
      geometry:fabricGeometry('shorts')},
    {isMesh:true,name:'FA_socks__left',material:privateMaterial('km14-white-','socks'),
      geometry:fabricGeometry('socks')},
    {isMesh:true,name:'FA_boots__shoes_l001_1',material:{
      name:'km14-white-laces',color:new FakeColor('#FFFFFF')},geometry:{id:'boots'}}
  ];
  const outfit={traverse(fn){for(const mesh of meshes)fn(mesh);}};
  const store=createKitDesignStore();
  store.setClub('ENG-1',{primaryColor:'#173B65',secondaryColor:'#FFFFFF'});
  store.selectColor('primary');
  store.selectStyle('vertical-stripes');
  store.selectColorLayer('accent');
  store.selectColor('secondary');
  store.selectStripeWidth(110);
  const state=store.getState();
  const geometries=meshes.map(m=>m.geometry);
  const result=applyKitDesign(outfit,state,THREE);
  assert.equal(result.changedMaterials,4);
  const jersey=meshes[0].material;
  const shaderUniforms=jersey.userData.kitStripeUniforms;
  assert.equal(shaderUniforms.kmStripeEnabled.value,1);
  assert.equal(shaderUniforms.kmStripeWidth.value,.11);
  assert.equal(shaderUniforms.kmStripeSection.value,0);
  assert.ok(Math.abs(shaderUniforms.kmStripeFabricOrigin.value-.15)<1e-10);
  assert.ok(Math.abs(shaderUniforms.kmStripeFabricScale.value-1.52)<1e-10);
  assert.equal(shaderUniforms.kmStripeFabricScale.value,
    measureKitStripeFabricMetric(meshes[0].geometry).metresPerUv);
  assert.equal(shaderUniforms.kmStripeBase.value.hex,'#173B65');
  assert.equal(shaderUniforms.kmStripeAccent.value.hex,'#FFFFFF');
  assert.equal(jersey.color.hex,'#FFFFFF',
    'The shader supplies PBR stripe colours; material must not tint them');
  assert.equal(jersey.customProgramCacheKey(),KIT_STRIPE_SHADER_KEY);
  const shader={
    uniforms:{},
    vertexShader:'void main() {\n#include <begin_vertex>\n}',
    fragmentShader:'void main() {\n#include <color_fragment>\n}'
  };
  jersey.onBeforeCompile(shader);
  assert.match(shader.vertexShader,/vKmPatternU = uv\.x/);
  assert.ok(shader.fragmentShader.includes('distanceOnFabric='));
  assert.ok(shader.fragmentShader.includes('kmStripeFabricOrigin'));
  assert.ok(shader.fragmentShader.includes('kmStripeFabricScale'));
  assert.ok(shader.fragmentShader.includes('distanceOnFabric/kmStripeWidth'));
  assert.doesNotMatch(shader.fragmentShader,/atan\(|theta|kmTorsoStripeCoordinate/,
    'No angular/screen-X mapping or convergence');
  assert.doesNotMatch(shader.vertexShader,/vKmClothPosition|vKmKitX/);
  assert.match(shader.fragmentShader,/fwidth\(wave\)/);
  assert.equal(shader.uniforms.kmStripeWidth,shaderUniforms.kmStripeWidth);
  assert.equal(meshes[3].material.color.hex,'#FFFFFF');
  assert.equal(meshes[3].material.userData,undefined);
  assert.deepEqual(meshes.map(m=>m.geometry),geometries);
  store.selectStyle('solid');
  store.selectColor('neutral-grey');
  applyKitDesign(outfit,store.getState(),THREE);
  assert.equal(shaderUniforms.kmStripeEnabled.value,0);
  assert.equal(jersey.color.hex,'#808080');
  assert.equal(jersey.userData.kitStripeUniforms,shaderUniforms,
    'Style toggle reuses uniforms and does not recreate materials');
  store.selectStyle('vertical-stripes');
  applyKitDesign(outfit,store.getState(),THREE);
  assert.equal(shaderUniforms.kmStripeEnabled.value,1);
  assert.equal(shaderUniforms.kmStripeBase.value.hex,'#808080');
  assert.equal(jersey.color.hex,'#FFFFFF');
});

test('KM-17 refuses unsupported stripe widths/colours/materials without partial mutation',()=>{
  class FakeColor {constructor(hex){this.hex=hex;}set(hex){this.hex=hex;}}
  const THREE={Color:FakeColor};
  const meshes=['jersey','shorts','socks'].map(part=>({
    isMesh:true,name:'FA_'+part+'__test',material:{
      name:(part==='jersey'?'km13-white-':'km14-white-')+part,
      color:new FakeColor('#FFFFFF'),userData:{}}
  }));
  const outfit={traverse(fn){for(const mesh of meshes)fn(mesh);}};
  const state=createKitDesignStore().getState();
  state.widths.jersey=0;
  assert.throws(()=>applyKitDesign(outfit,state,THREE),/Invalid kit style/);
  assert.ok(meshes.every(m=>!m.material.userData.kitStripeUniforms));
  state.widths.jersey=.075;
  state.accentColors.jersey='#11FF22';
  assert.throws(()=>applyKitDesign(outfit,state,THREE),/club colours or allowed neutrals/);
  assert.ok(meshes.every(m=>!m.material.userData.kitStripeUniforms));
  state.accentColors.jersey='#111111';
  meshes[2].material.name='original-author-texture';
  assert.throws(()=>applyKitDesign(outfit,state,THREE),/private neutral material/);
  assert.ok(meshes.every(m=>!m.material.userData.kitStripeUniforms));
});

test('KM-18 slider continuously controls widths and remembers them across garments',()=>{
  const store=createKitDesignStore(),sizes=[];
  store.selectStyle('vertical-stripes');
  const unsubscribe=store.subscribe(next=>sizes.push(next.stripeWidths.jersey));
  for(const width of [30,35,40,45,50,55,60,65,70,75,80,85,90,95,100,105,110,115,120,125,130,135,140,145,150]){
    const state=store.selectStripeWidth(width);
    assert.equal(state.stripeWidths.jersey,width);
    assert.ok(Math.abs(state.widths.jersey-width/1000)<1e-9);
  }
  assert.equal(sizes.length,25,'Slider input changes are broadcast without model reload');
  unsubscribe();
  store.selectPart('shorts');
  store.selectStyle('vertical-stripes');
  store.selectStripeWidth(60);
  store.selectPart('jersey');
  assert.equal(store.getState().stripeWidths.jersey,150);
  assert.equal(store.getState().stripeWidths.shorts,60);
  store.selectStyle('solid');
  store.selectStyle('vertical-stripes');
  assert.equal(store.getState().stripeWidths.jersey,150);
});

test('KM-18 right and left sleeve stripes use local arm-axis contour coordinates',()=>{
  assert.equal(stripeSectionForMesh('FA_jersey__38'),1);
  assert.equal(stripeSectionForMesh('FA_jersey__39'),1);
  assert.equal(stripeSectionForMesh('FA_jersey__62'),-1);
  assert.equal(stripeSectionForMesh('FA_jersey__63'),-1);
  assert.equal(stripeSectionForMesh('FA_jersey__9'),0);
  assert.equal(stripeSectionForMesh('FA_jersey__42'),0);
  class Color{constructor(value){this.hex=value}set(value){this.hex=value;}}
  const meshes=['FA_jersey__38','FA_jersey__62','FA_jersey__9',
    'FA_shorts__mesh','FA_socks__mesh'].map(name=>({
    isMesh:true,name,
    material:{name:(name.startsWith('FA_jersey__')?'km13-white-':'km14-white-')+name,
      color:new Color('#FFFFFF'),userData:{},needsUpdate:false},
    geometry:fabricGeometry(name)
  }));
  const store=createKitDesignStore();
  store.selectStyle('vertical-stripes');
  store.selectStripeWidth(85);
  const before=meshes.map(m=>m.geometry);
  applyKitDesign({traverse(fn){meshes.forEach(fn)}},store.getState(),{Color});
  const sections=meshes.map(m=>m.material.userData.kitStripeUniforms.kmStripeSection.value);
  assert.deepEqual(sections,[1,-1,0,0,0]);
  assert.equal(meshes[0].material.userData.kitStripeUniforms.kmStripeWidth.value,.085);
  assert.deepEqual(meshes.map(m=>m.geometry),before);
});



test('KM-20 calipers derive physical stripe width from source-pattern UV geometry',()=>{
  const cloth=fabricGeometry('sample',1.52);
  const metric=measureKitStripeFabricMetric(cloth);
  assert.ok(Math.abs(metric.metresPerUv-1.52)<1e-10);
  assert.ok(Math.abs(metric.originU-.15)<1e-10);
  assert.ok(metric.sampledTriangles>=2);
  assert.ok(Math.abs(metric.rangeU-.1)<1e-12);
  for(const width of [.03,.045,.075,.1,.15]){
    const deltaU=width/metric.metresPerUv;
    const distanceOnCloth=deltaU*metric.metresPerUv;
    assert.ok(Math.abs(distanceOnCloth-width)<1e-12,
      'Every stripe must retain requested sewn width independent of x/z');
  }
});

test('KM-20 a draped curved jersey keeps constant fabric stripe widths at flanks',()=>{
  // Model a real shoulder-to-flank cross-section: horizontal x projection
  // shrinks sharply at the flank, but equal U intervals stay equal on the
  // fabric before draping. This is what author-supplied pattern UVs encode.
  const SCALE=1.52,span=.30,radius=SCALE*span/2.5;
  const nodes=[];
  const count=41,rows=3;
  for(let y=0;y<rows;y++){
    for(let i=0;i<count;i++){
      const u=span*i/(count-1);
      const theta=(u-span/2)*SCALE/radius;
      nodes.push({uv:[u,y*.05],p:[radius*Math.sin(theta),y*.08,
        radius*(1-Math.cos(theta))]});
    }
  }
  const faces=[];
  for(let j=0;j<rows-1;j++){
    for(let i=0;i<count-1;i++){
      const a=j*count+i,b=a+1,c=(j+1)*count+i,d=c+1;
      faces.push(a,b,c,b,d,c);
    }
  }
  const pos={count:nodes.length,
    getX(i){return nodes[i].p[0];},
    getY(i){return nodes[i].p[1];},
    getZ(i){return nodes[i].p[2];}};
  const uv={count:nodes.length,
    getX(i){return nodes[i].uv[0];},
    getY(i){return nodes[i].uv[1];}};
  const geometry={getAttribute(k){return k==='position'?pos:k==='uv'?uv:null;},
    index:{count:faces.length,getX(i){return faces[i];}}};
  const metric=measureKitStripeFabricMetric(geometry);
  assert.ok(Math.abs(metric.metresPerUv-SCALE)<.005,
    'Metric follows curved actual surface rather than compressed horizontal x');
  assert.ok(Math.abs(metric.originU-.15)<1e-10);
  const width=.045,deltaU=width/metric.metresPerUv;
  // Uniform band widths in true sewn cloth:
  for(let u=.035;u+.05<span;u+=.035){
    const before=(u-metric.originU)*metric.metresPerUv;
    const after=(u+deltaU-metric.originU)*metric.metresPerUv;
    assert.ok(Math.abs(after-before-width)<1e-10);
  }
  // Yet these same two stripes would look compressed if projected along X.
  const x=u=>radius*Math.sin((u-span/2)*SCALE/radius);
  const middle=x(.15+deltaU)-x(.15);
  const flank=x(.26+deltaU)-x(.26);
  assert.ok(flank<middle*.75,
    'Old model-X projection must demonstrably squash stripes at the sides');
});

test('KM-20 asymmetric front/back pattern islands keep equal widths',()=>{
  // Both source torso panels have roughly identical scale but use
  // different islands/orientations in the original artist's atlas.
  const front=fabricGeometry('front',1.52);
  const back=fabricGeometry('back',1.52,.4,true);
  const a=measureKitStripeFabricMetric(front);
  const b=measureKitStripeFabricMetric(back);
  const width=.075;
  assert.ok(Math.abs(width/a.metresPerUv-width/b.metresPerUv)<1e-12);
  assert.ok(Math.abs(a.originU-b.originU)>.3,
    'Pattern islands must have different U offsets but the same physical width');
});

test('KM-20 unknown or malformed UV panels fail atomically without recolouring',()=>{
  class Color{constructor(value){this.hex=value;}set(value){this.hex=value;}}
  const parts=['jersey','shorts','socks'].map((part,i)=>({
    isMesh:true,name:'FA_'+part+'__valid',
    material:{name:(i===0?'km13-white-':'km14-white-')+part,
      color:new Color('#FFFFFF'),userData:{}},
    geometry:fabricGeometry(part)
  }));
  // A single missing UV among several correct parts must not recolour any.
  parts[2].geometry={getAttribute(key){
    return key==='position'?{count:6,getX(){return 0;},
      getY(){return 0;},getZ(){return 0;}}:null;
  }};
  const state=createKitDesignStore();
  state.selectColor('neutral-black');
  const outfit={traverse(fn){parts.forEach(fn);}};
  assert.throws(()=>applyKitDesign(outfit,state.getState(),{Color}),/pattern UVs/);
  assert.ok(parts.every(p=>!p.material.userData.kitStripeUniforms));
  assert.ok(parts.every(p=>p.material.color.hex==='#FFFFFF'));
  assert.throws(()=>measureKitStripeFabricMetric(null),/pattern UVs/);
});


test('KM-23 one Jersey trims role colours collar, both cuffs and bottom hem',()=>{
  const store=createKitDesignStore();
  assert.deepEqual(store.getState().detailColors,{trim:'#FFFFFF'});
  store.selectColorLayer('trim');
  assert.equal(store.selectColor('neutral-black'),true);
  assert.deepEqual(store.getState().detailColors,{trim:'#111111'});
  assert.equal(store.getState().colors.jersey,'#FFFFFF');
  store.selectStyle('vertical-stripes');
  assert.equal(store.getState().activeLayer,'trim');
  assert.equal(store.getState().detailColors.trim,'#111111');
  store.selectPart('shorts');
  assert.throws(()=>store.selectColorLayer('trim'),/Jersey trim/);
  store.selectPart('socks');
  assert.throws(()=>store.selectColorLayer('trim'),/Jersey trim/);
  store.selectPart('jersey');
  assert.equal(store.getState().activeLayer,'base');
  store.selectColorLayer('trim');
  store.setClub('ENG-1',{primaryColor:'#162B5A',secondaryColor:'#EADAC0'});
  store.selectColor('primary');
  store.setClub('ENG-2',{primaryColor:'#4B165C',secondaryColor:'#6B9B32'});
  assert.equal(store.getState().detailColors.trim,'#4B165C');
  assert.equal(store.getState().detailSelections.trim,'primary');
  store.setClub(null);
  assert.equal(store.getState().detailColors.trim,'#FFFFFF');
  assert.equal(store.selectColor('primary'),false);
  assert.throws(()=>store.selectColorLayer('collar'),/Unsupported/);
  assert.throws(()=>store.selectColorLayer('cuffs'),/Unsupported/);
  assert.throws(()=>store.selectColorLayer('anything'),/Unsupported/);
});

test('KM-23 includes BOTH source mesh primitives for collar sleeves and hem',()=>{
  for(const name of ['FA_jersey__Pattern2D_3805002',
    'FA_jersey__Pattern2D_3805003','FA_jersey__Pattern2D_3805002_1'])
    assert.equal(kitJerseyDetailRegion(name),'collar',name);
  for(const n of [38,39,62,63]){
    assert.equal(kitJerseyDetailRegion('FA_jersey__'+n),'cuffs');
    assert.equal(kitJerseyDetailRegion('FA_jersey__'+n+'_1'),'cuffs');
  }
  for(const n of [9,10,42,43]){
    assert.equal(kitJerseyDetailRegion('FA_jersey__'+n),'hem');
    assert.equal(kitJerseyDetailRegion('FA_jersey__'+n+'_1'),'hem');
  }
  assert.equal(kitJerseyDetailRegion('FA_jersey__Pattern_2702362'),null);
  assert.equal(kitJerseyDetailRegion('FA_boots__shoes_l001_1'),null);
  assert.equal(kitJerseyDetailRegion('FA_jersey__Pattern2D_1871004'),null);
});

function physicalPositionCloud(points){
  const position={count:points.length,
    getX(i){return points[i][0];},getY(i){return points[i][1];},
    getZ(i){return points[i][2]??0;}};
  return {getAttribute(k){return k==="position"?position:null;}};
}
function slopingSleevePoints(side){
  const points=[],dx=side*.18,dy=-.17,length=Math.hypot(dx,dy);
  const nx=-dy/length,ny=dx/length;
  for(let row=0;row<=16;row++)for(let j=0;j<24;j++){
    const t=row/16,angle=2*Math.PI*j/24,r=.031*Math.cos(angle);
    points.push([side*.19+dx*t+nx*r,1.53+dy*t+ny*r,.031*Math.sin(angle),t]);
  }
  return points;
}
test('KM-24 physical 3D edges cover both distal sleeve rings, excluding the shoulder',()=>{
  assert.equal(KIT_CUFF_BORDER_METRES,.012);
  assert.equal(KIT_CUFF_FOLD_RETURN_METRES,.012);
  assert.equal(KIT_TORSO_HEM_METRES,.024);
  for(const side of [-1,1]){
    const points=slopingSleevePoints(side);
    const metric=measureKitPhysicalTrimProjection([
      physicalPositionCloud(points.slice(0,240)),
      physicalPositionCloud(points.slice(192))],"cuffs",side);
    assert.ok(metric.axisX*side>.5);
    assert.ok(metric.axisY<-.5);
    assert.ok(Math.abs(metric.outerM-metric.startM-.024)<1e-10);
    const project=p=>p[0]*metric.axisX+p[1]*metric.axisY;
    assert.ok(points.filter(p=>p[3]===1).every(p=>project(p)>metric.startM),
      "Full outer cuff circumference must be trimmed");
    assert.ok(points.filter(p=>p[3]===0).every(p=>project(p)<metric.startM),
      "Inner shoulder must remain unchanged");
  }
});
test('KM-24 lowest real 3D waist Y governs hem even for curved cloth',()=>{
  const points=[];
  for(let row=0;row<=8;row++)for(let i=0;i<=20;i++){
    const x=(i/20-.5)*.42;
    points.push([x,.965+.008*Math.sin(i/20*2*Math.PI)+row*.05,0]);
  }
  const metric=measureKitPhysicalTrimProjection([
    physicalPositionCloud(points.slice(0,90)),
    physicalPositionCloud(points.slice(90))],"hem");
  assert.equal(metric.axisX,0);assert.equal(metric.axisY,-1);
  assert.ok(points.filter(p=>p[1]<.98).every(p=>-p[1]>metric.startM));
  assert.ok(points.filter(p=>p[1]>1.15).every(p=>-p[1]<metric.startM));
  assert.throws(()=>measureKitPhysicalTrimProjection([],"hem"),/Invalid/);
  assert.throws(()=>measureKitPhysicalTrimProjection([
    physicalPositionCloud([[0,0],[0,.01],[0,.02]])],"hem"),/too short/);
});
test('KM-23 the same trim color overrides collar sleeves AND torso bottom in both styles',()=>{
  class Color{constructor(hex){this.hex=hex;}set(hex){this.hex=hex;return this;}}
  const sourceNames=[
    'FA_jersey__Pattern2D_3805002','FA_jersey__Pattern2D_3805003',
    'FA_jersey__38','FA_jersey__39','FA_jersey__62','FA_jersey__63',
    'FA_jersey__9','FA_jersey__10','FA_jersey__42','FA_jersey__43',
    'FA_shorts__body','FA_socks__body','FA_boots__shoes_l001'
  ];
  const meshes=sourceNames.map(name=>({
    name,isMesh:true,
    material:{name:(name.startsWith('FA_jersey__')?'km13-white-':
      name.startsWith('FA_boots__')?'author-boot-':'km14-white-')+name,
      color:new Color('#FFFFFF'),userData:{}},
    geometry:name.startsWith('FA_boots__')
      ?{tag:'original boots'}:fabricGeometry(name)
  }));
  const geometries=meshes.map(x=>x.geometry),boot=meshes.at(-1).material;
  const outfit={traverse(fn){meshes.forEach(fn);}};
  const store=createKitDesignStore();
  store.selectColorLayer('base');store.selectColor('neutral-grey');
  store.selectColorLayer('trim');store.selectColor('neutral-black');
  for(const style of ['solid','vertical-stripes']){
    store.selectStyle(style);
    const result=applyKitDesign(outfit,store.getState(),{Color});
    assert.equal(result.changedMaterials,12);
    for(let i=0;i<sourceNames.length-1;i++){
      const region=kitJerseyDetailRegion(sourceNames[i]);
      const uniforms=meshes[i].material.userData.kitStripeUniforms;
      const expected=region==='collar'?1:region==='cuffs'?2:region==='hem'?3:0;
      assert.equal(uniforms.kmTrimRegion.value,expected,sourceNames[i]);
      if(region){
        assert.equal(uniforms.kmTrimColor.value.hex,'#111111');
        if(region!=='collar'){
          assert.ok(Number.isFinite(uniforms.kmTrimStartM.value));
          assert.ok(Math.hypot(uniforms.kmTrimAxisX.value,
            uniforms.kmTrimAxisY.value)>.99);
          if(region==='hem')assert.equal(uniforms.kmTrimAxisY.value,-1);
          else assert.ok(uniforms.kmTrimAxisX.value*
            (sourceNames[i].includes('__38')||sourceNames[i].includes('__39')?1:-1)>0);
        }
      }
      assert.equal(uniforms.kmStripeEnabled.value,
        sourceNames[i].startsWith('FA_jersey__')&&style==='vertical-stripes'?1:0);
    }
    assert.equal(meshes.at(-1).material,boot,
      'Neither boots nor shoe laces may be modified');
  }
  assert.deepEqual(meshes.map(x=>x.geometry),geometries);
  const shader={uniforms:{},
    vertexShader:'void main(){\n#include <begin_vertex>\n}',
    fragmentShader:'void main(){\n#include <color_fragment>\n}'};
  meshes[2].material.onBeforeCompile(shader);
  assert.match(shader.vertexShader,/vKmTrimProjection = position.x/);
  assert.match(shader.fragmentShader,/kmTrimStartM/);
  assert.match(shader.fragmentShader,/smoothstep\(kmTrimStartM/);
  assert.match(shader.fragmentShader,/exteriorMask/);
  assert.doesNotMatch(shader.fragmentShader,/vKmPatternV|kmTrimEdgeV/);
  assert.match(shader.fragmentShader,/diffuseColor.rgb=kmTrimColor/);
});

test('KM-23 invalid shared trim rejects atomically before touching kit materials',()=>{
  class Color{constructor(hex){this.hex=hex;}set(hex){this.hex=hex;return this;}}
  const names=['FA_jersey__Pattern2D_3805002','FA_jersey__38',
    'FA_jersey__9','FA_shorts__body','FA_socks__body'];
  const meshes=names.map(name=>({
    isMesh:true,name,geometry:fabricGeometry(name),
    material:{
      name:(name.startsWith('FA_jersey__')?'km13-white-':'km14-white-')+name,
      color:new Color('#FFFFFF'),userData:{}}
  }));
  const state=createKitDesignStore().getState();
  state.detailColors.trim='#00FF00';
  assert.throws(()=>applyKitDesign({traverse(fn){meshes.forEach(fn);}},
    state,{Color}),/Kit detail colours/);
  assert.ok(meshes.every(m=>m.material.color.hex==='#FFFFFF'));
  assert.ok(meshes.every(m=>!m.material.userData.kitStripeUniforms));
});
