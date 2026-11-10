import test from 'node:test';
import assert from 'node:assert/strict';
import {KIT_PARTS,KIT_STYLES,KIT_STRIPE_WIDTH_RANGE,formatKitStripeWidth,isKitStripeWidthAllowed,KIT_NEUTRALS,kitColorChoices,
  createKitDesignStore,applySolidKitColors,applyKitDesign,KIT_STRIPE_SHADER_KEY,stripeSectionForMesh} from '../../kit-maker/lab/kit-design.mjs';

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

test('KM-19 near-vertical curved shader updates uniforms without moving geometry',()=>{
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
      geometry:{id:'shirt'}},
    {isMesh:true,name:'FA_shorts__body',material:[
      privateMaterial('km14-white-','shortsA'),privateMaterial('km14-white-','shortsB')],
      geometry:{id:'shorts'}},
    {isMesh:true,name:'FA_socks__left',material:privateMaterial('km14-white-','socks'),
      geometry:{id:'socks'}},
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
  assert.match(shader.vertexShader,/vKmClothPosition = position/);
  assert.ok(shader.fragmentShader.includes("kmTorsoStripeCoordinate"));
  assert.ok(shader.fragmentShader.includes("kmSleeveStripeCoordinate"));
  assert.ok(shader.fragmentShader.includes("kmParallelStripeCoordinate"));
  assert.ok(shader.fragmentShader.includes("return p.x+drape"));
  assert.ok(shader.fragmentShader.includes("sleeveTilt"));
  assert.ok(shader.fragmentShader.includes("cos(3.141592653589793*band"));
  assert.ok(!shader.fragmentShader.includes("atan(")&&
    !shader.fragmentShader.includes("mod(")&&
    !shader.fragmentShader.includes("theta"),
    'Polar coordinates must never create stripe focal points');
  assert.doesNotMatch(shader.fragmentShader,/vKmKitX/);
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
    geometry:{id:name}
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


test('KM-19 torso stripe field has stable spacing and no focal convergence',()=>{
  const smooth=(a,b,v)=>{
    const t=Math.max(0,Math.min(1,(v-a)/(b-a)));
    return t*t*(3-2*t);
  };
  const coord=(x,y,z)=>x+.010*Math.sin(x*7)*
    (.35+.50*smooth(.015,.145,Math.abs(z)))*
    (.55+.45*smooth(1.12,1.62,y));

  for(const y of [1.03,1.13,1.27,1.39,1.53,1.67]){
    for(const z of [-.145,-.1,-.025,0,.035,.12,.145]){
      let previous=null;
      for(let i=0;i<=92;i++){
        const x=-.23+i*.005;
        const phase=coord(x,y,z);
        assert.ok(Number.isFinite(phase));
        if(previous!==null){
          const dx=phase-previous;
          assert.ok(dx>.0046&&dx<.0054,
            'Nearby stripes must retain near-uniform spacing without a pole');
        }
        previous=phase;
      }
      assert.ok(Math.abs(coord(0,y,z))<1e-12,
        'Centre stripe remains vertical at every height and depth');
    }
  }
  assert.ok(Math.abs(coord(.1,1.45,-.125)-coord(.1,1.45,-.018))>.001,
    'The mild contour adjustment must still react to fabric depth');
});

test('KM-19 sleeve stripe field follows tilted sleeves without radial convergence',()=>{
  const smooth=(a,b,v)=>{
    const t=Math.max(0,Math.min(1,(v-a)/(b-a)));
    return t*t*(3-2*t);
  };
  const torso=(x,y,z)=>x+.010*Math.sin(x*7)*
    (.35+.5*smooth(.015,.145,Math.abs(z)))*
    (.55+.45*smooth(1.12,1.62,y));
  const sleeve=(x,y,z,side)=>torso(x,y,z)+
    side*.18*(y-1.53)*(1-smooth(1.40,1.53,y));
  for(const side of [-1,1]){
    for(const y of [1.33,1.38,1.43,1.48,1.53]){
      let previous=null;
      for(let i=0;i<=25;i++){
        const x=(side===1?.16:-.29)+.005*i;
        const phase=sleeve(x,y,-.05,side);
        if(previous!==null)
          assert.ok(phase-previous>.0046&&phase-previous<.0054,
            'Sleeve bands remain parallel through every sleeve height');
        previous=phase;
      }
    }
    for(const x of [side*.175,side*.205,side*.245])
      assert.ok(Math.abs(sleeve(x,1.53,-.05,side)-torso(x,1.53,-.05))<1e-12,
        'Sleeve stripes meet torso phase at shoulder seam');
  }
});

test('KM-19 front/back and side seams never jump or reverse stripe order',()=>{
  const smooth=(a,b,v)=>{
    const t=Math.max(0,Math.min(1,(v-a)/(b-a)));
    return t*t*(3-2*t);
  };
  const coord=(x,y,z)=>x+.010*Math.sin(x*7)*
    (.35+.5*smooth(.015,.145,Math.abs(z)))*
    (.55+.45*smooth(1.12,1.62,y));
  for(const x of [-.2,-.1,0,.1,.2]){
    for(const y of [1.05,1.35,1.60]){
      assert.ok(Math.abs(coord(x,y,-.13)-coord(x,y,.13))<1e-12);
      assert.ok(Math.abs(coord(x,y,-.0001)-coord(x,y,.0001))<1e-12);
    }
  }
});
