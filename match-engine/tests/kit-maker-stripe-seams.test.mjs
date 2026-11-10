import test from 'node:test';
import assert from 'node:assert/strict';
import {alignOriginalShoulderStripes} from '../../kit-maker/lab/kit-stripe-seams.mjs';
import {applyKitDesign,createKitDesignStore,KIT_STRIPE_SHADER_KEY} from
  '../../kit-maker/lab/kit-design.mjs';

function panel(name,{flip=false,offset=0,lower=false,
    z=0,overlap=true,side=1}={}){
  const n=19,vertices=[],triangles=[],ys=lower?[1.39,1.48]:[1.48,1.60];
  for(const y of ys)for(let i=0;i<n;i++){
    const x=side*(.14+.24*i/(n-1));
    vertices.push({p:[x,y,z],uv:[offset+(flip?-x:x)/1.52,y/1.52]});
  }
  for(let i=0;i<n-1;i++){
    const a=i,b=i+1,c=i+n,d=i+n+1;
    triangles.push(a,b,c,b,d,c);
  }
  const position={count:vertices.length,
    getX(i){return vertices[i].p[0]},
    getY(i){return vertices[i].p[1]},
    getZ(i){return vertices[i].p[2]}},
    uv={count:vertices.length,
      getX(i){return vertices[i].uv[0]},
      getY(i){return vertices[i].uv[1]}};
  const geometry={
    index:{count:triangles.length,getX(i){return triangles[i]}},
    getAttribute(k){return k==='position'?position:k==='uv'?uv:null}
  };
  const originU=(uv.getX(0)+uv.getX(n-1))/2;
  return {part:'jersey',meshName:name,mesh:{name},
    geometry,metric:{originU,metresPerUv:1.52},
    seamSamples:vertices.slice(lower?n:0,lower?n*2:n)};
}
const adjusted=(entry,result)=>result.adjustments.get(entry.geometry)??entry.metric;
const phase=(vertex,uniforms)=>(vertex.uv[0]-uniforms.originU)*uniforms.metresPerUv;

test('KM-29 shoulder aligns mirrored sleeve and front/back pattern islands',()=>{
  const body=panel('FA_jersey__9'),
    back=panel('FA_jersey__42',{flip:true,offset:.4}),
    sleeve=panel('FA_jersey__38',{flip:true,offset:.8,lower:true});
  const outfit={},inputs=[body,back,sleeve];
  const result=alignOriginalShoulderStripes(outfit,inputs);
  assert.equal(result.report.status,'aligned');
  assert.equal(result.adjustments.size,3);
  assert.ok(result.report.connections.length>=2);
  for(const other of [back,sleeve]){
    for(let i=0;i<19;i++){
      const a=body.seamSamples[i],b=other.seamSamples[i];
      assert.ok(Math.abs(phase(a,adjusted(body,result))-
        phase(b,adjusted(other,result)))<1e-8,
        'Stripe boundary changes phase across shoulder seam');
    }
  }
  for(const entry of inputs)
    assert.equal(Math.abs(adjusted(entry,result).metresPerUv),
      entry.metric.metresPerUv,'Stripe fabric width must stay unchanged');
  // KM-36: the renderer uses sewn-coordinates per vertex when present.
  // Legacy affine UV uniforms are no longer the render-time stripe field.
  const chestMetres=result.coordinates.get(body.geometry),
    sleeveMetres=result.coordinates.get(sleeve.geometry);
  assert.ok(chestMetres&&sleeveMetres);
  for(const width of [.01,.03,.075,.15]){
    for(let i=0;i<19;i++)
      assert.ok(Math.abs(Math.cos(Math.PI*chestMetres[i]/width)-
        Math.cos(Math.PI*sleeveMetres[19+i]/width))<1e-5);
  }
  assert.equal(alignOriginalShoulderStripes(outfit,inputs),result,
    'Repeated style or slider updates must reuse one geometry analysis');
});
test('KM-29 never fabricates shoulder phase across separated panels',()=>{
  const a=panel('FA_jersey__9'),
    b=panel('FA_jersey__62',{offset:.7,lower:true,z:.012,side:1});
  const result=alignOriginalShoulderStripes({},[a,b]);
  assert.equal(result.report.status,'no-seam-match');
  assert.equal(result.report.matches,0);
  assert.equal(result.adjustments.has(b.geometry),false);
});
test('KM-29 never align cuffs, collar or non-jersey clothes',()=>{
  const body=panel('FA_jersey__9'),
    sleeve=panel('FA_jersey__38',{flip:true,offset:.8,lower:true}),
    collar=panel('FA_jersey__Pattern2D_3805002'),
    socks=panel('FA_socks__mesh');
  socks.part='socks';
  const result=alignOriginalShoulderStripes({},[body,sleeve,collar,socks]);
  assert.ok(result.adjustments.has(sleeve.geometry));
  assert.ok(!result.adjustments.has(collar.geometry));
  assert.ok(!result.adjustments.has(socks.geometry));
});

test('KM-30 continuous stripe along every nonlinear shoulder stitch',()=>{
  const body=panel('FA_jersey__9'),
    sleeve=panel('FA_jersey__38',{lower:true,offset:.8});
  for(let i=0;i<19;i++)
    sleeve.seamSamples[i].uv[0]+=.014*Math.sin(2*Math.PI*i/19)/1.52;
  const r=alignOriginalShoulderStripes({},[body,sleeve]);
  assert.equal(r.report.status,'aligned');
  assert.ok(r.report.connections[0].preciseAnchors>=18);
  assert.ok(r.report.connections[0].maxSeamCorrectionMm>4);
  const a=r.coordinates.get(body.geometry),b=r.coordinates.get(sleeve.geometry);
  assert.ok(a&&b);
  for(let i=0;i<19;i++)assert.ok(Math.abs(a[i]-b[19+i])<1e-6);
  for(const w of [.03,.075,.15])for(let i=0;i<19;i++)
    assert.ok(Math.abs(Math.cos(Math.PI*a[i]/w)-
      Math.cos(Math.PI*b[19+i]/w))<1e-5);
});
test('KM-30 continuation survives a 90-degree rotated sewn sleeve atlas',()=>{
  const body=panel('FA_jersey__9'),
    sleeve=panel('FA_jersey__38',{lower:true,offset:.8});
  const p=sleeve.geometry.getAttribute('position'),
    previous=sleeve.geometry.getAttribute.bind(sleeve.geometry);
  sleeve.geometry.getAttribute=k=>k==='uv'?{
    count:p.count,
    getX(i){return .8+(p.getY(i)-1.39)/1.52;},
    getY(i){return p.getX(i)/1.52;}
  }:previous(k);
  sleeve.metric.metresPerUvV=1.52;
  const r=alignOriginalShoulderStripes({},[body,sleeve]);
  assert.equal(r.report.status,'aligned');
  assert.equal(r.report.connections[0].seamAcrossUvAxis,'V');
  const a=r.coordinates.get(body.geometry),b=r.coordinates.get(sleeve.geometry);
  assert.ok(a&&b);
  for(let i=0;i<19;i++)assert.ok(Math.abs(a[i]-b[19+i])<1e-6);
});
test('KM-33 Solid outfit loads without shoulder analysis and upgrades shader on stripes',()=>{
  const source=[
    panel('FA_jersey__9'),
    panel('FA_jersey__38',{lower:true,flip:true,offset:.8}),
    panel('FA_shorts__body'),
    panel('FA_socks__body')
  ];
  class Color{constructor(v){this.hex=v;}set(v){this.hex=v;return this;}}
  class Float32BufferAttribute{
    constructor(array,itemSize){this.array=array;this.itemSize=itemSize;
      this.count=array.length/itemSize;}
  }
  for(const item of source){
    const old=item.geometry.getAttribute.bind(item.geometry),extra=new Map();
    item.geometry.getAttribute=k=>extra.get(k)??old(k);
    item.geometry.setAttribute=(k,a)=>{extra.set(k,a);return item.geometry;};
  }
  const meshes=source.map(e=>({
    isMesh:true,name:e.meshName,geometry:e.geometry,
    material:{name:(e.meshName.startsWith('FA_jersey__')?
      'km13-white-':'km14-white-')+e.meshName,
      color:new Color('#FFFFFF'),userData:{}}
  }));
  const outfit={userData:{},traverse(f){meshes.forEach(f);}};
  const store=createKitDesignStore(),THREE={Color,Float32BufferAttribute};
  applyKitDesign(outfit,store.getState(),THREE);
  const shirt=meshes[0],sleeve=meshes[1];
  assert.equal(outfit.userData.km32ShoulderOriginReport,undefined,
    'Initial Solid garment must never wait for KM-32 seam analysis');
  assert.equal(shirt.geometry.getAttribute('kmStripeSewnMetres'),null);
  assert.equal(sleeve.material.customProgramCacheKey(),KIT_STRIPE_SHADER_KEY+'-plain');
  store.selectStyle('vertical-stripes');store.selectStripeWidth(30);
  applyKitDesign(outfit,store.getState(),THREE);
  const a=shirt.geometry.getAttribute('kmStripeSewnMetres'),
    b=sleeve.geometry.getAttribute('kmStripeSewnMetres');
  assert.ok(a&&b);
  for(let i=0;i<19;i++)assert.ok(Math.abs(a.array[i]-b.array[19+i])<1e-6);
  assert.equal(sleeve.material.customProgramCacheKey(),KIT_STRIPE_SHADER_KEY+'-sewn');
  const shader={uniforms:{},vertexShader:'void main(){\n#include <begin_vertex>\n}',
    fragmentShader:'void main(){\n#include <color_fragment>\n}'};
  sleeve.material.onBeforeCompile(shader);
  assert.match(shader.vertexShader,/attribute float kmStripeSewnMetres;/);
  assert.match(shader.vertexShader,/vKmPatternU = kmStripeSewnMetres/);
  const u=sleeve.material.userData.kitStripeUniforms;
  assert.equal(u.kmStripeFabricOrigin.value,0);
  assert.equal(u.kmStripeFabricScale.value,1);
  applyKitDesign(outfit,store.getState(),THREE);
  assert.equal(sleeve.geometry.getAttribute('kmStripeSewnMetres'),b);
  assert.equal(sleeve.material.userData.kitStripeUniforms,u);
  assert.equal(u.kmStripeEnabled.value,1);
  assert.equal(u.kmStripeWidth.value,.03);
  store.selectStripeWidth(150);
  applyKitDesign(outfit,store.getState(),THREE);
  assert.equal(u.kmStripeWidth.value,.15);
});

function irregularSeamPanel(name,{count,lower=false,rotated=false,
    triangleSoup=false,offset=0,side=1}){
  const original=[],faces=[];
  for(const y of [1.48,lower?1.39:1.60])
    for(let j=0;j<count;j++){
      const t=j/(count-1),x=side*(.14+.24*t),
        u=(rotated?y:x)/1.52+offset+
          (lower?.008*Math.sin(2*Math.PI*t):0),
        v=(rotated?x:y)/1.52;
      original.push({p:[x,y,0],uv:[u,v]});
    }
  for(let j=0;j<count-1;j++){
    const a=j,b=j+1,c=j+count,d=c+1;
    faces.push(a,b,c,b,d,c);
  }
  const nodes=triangleSoup?faces.map(i=>original[i]):original,
    pos={count:nodes.length,getX(i){return nodes[i].p[0]},
      getY(i){return nodes[i].p[1]},getZ(i){return nodes[i].p[2]}},
    uv={count:nodes.length,getX(i){return nodes[i].uv[0]},
      getY(i){return nodes[i].uv[1]}};
  const geometry={
    index:triangleSoup?null:{count:faces.length,getX(i){return faces[i]}},
    getAttribute(k){return k==='position'?pos:k==='uv'?uv:null;}
  };
  // Reference the actual source pattern extrema, NOT triangle-soup
  // index positions. Repeated nonindexed vertices do not define UV bounds.
  const originU=(original[0].uv[0]+original[count-1].uv[0])/2;
  return {part:'jersey',meshName:name,mesh:{name},geometry,
    metric:{originU,metresPerUv:1.52,metresPerUvV:1.52}};
}
test('KM-31 projects finely tessellated sleeve seam to coarser torso edges at 1cm',()=>{
  const body=irregularSeamPanel('FA_jersey__9',{count:13}),
    sleeve=irregularSeamPanel('FA_jersey__38',
      {count:57,lower:true,offset:.6});
  const result=alignOriginalShoulderStripes({},[body,sleeve]);
  assert.equal(result.report.status,'aligned');
  assert.equal(result.report.connections[0].segmentProjected,true);
  assert.ok(result.report.connections[0].matchedVertices>=55);
  assert.ok(result.report.connections[0].medianPhysicalGapMm<=1);
  assert.equal(result.report.sleeves.right,true);
  const field=result.coordinates.get(sleeve.geometry),
    pos=sleeve.geometry.getAttribute('position');
  assert.ok(field&&field.length===pos.count);
  for(let i=0;i<57;i++){
    const expected=pos.getX(i)-.26;
    assert.ok(Math.abs(field[i]-expected)<.0001,
      'Every finer sleeve stitch must retain the same 1cm band phase');
    for(const width of [.01,.015,.075]){
      const waveA=Math.cos(Math.PI*field[i]/width),
        waveB=Math.cos(Math.PI*expected/width);
      assert.ok(Math.abs(waveA-waveB)<.04);
    }
  }
});
test('KM-31 physically duplicated triangle-soup stitches stay equal',()=>{
  const body=irregularSeamPanel('FA_jersey__9',
      {count:15,triangleSoup:true}),
    sleeve=irregularSeamPanel('FA_jersey__38',
      {count:59,lower:true,offset:.7,triangleSoup:true});
  const result=alignOriginalShoulderStripes({},[body,sleeve]);
  assert.equal(result.report.status,'aligned');
  const field=result.coordinates.get(sleeve.geometry),
    pos=sleeve.geometry.getAttribute('position');
  assert.ok(field);
  for(let i=0;i<field.length;i++){
    if(Math.abs(pos.getY(i)-1.48)>.00001)continue;
    assert.ok(Math.abs(field[i]-(pos.getX(i)-.26))<.00012,
      'Duplicate real source vertices must share one stripe colour');
  }
});
test('KM-31 left sleeve with rotated atlas and different mesh sampling joins the shirt',()=>{
  const body=irregularSeamPanel('FA_jersey__42',{count:16,side:-1}),
    sleeve=irregularSeamPanel('FA_jersey__62',
      {count:47,lower:true,rotated:true,offset:.6,side:-1});
  const result=alignOriginalShoulderStripes({},[body,sleeve]);
  assert.equal(result.report.status,'aligned');
  assert.equal(result.report.connections[0].seamAcrossUvAxis,'V');
  assert.equal(result.report.sleeves.left,true);
  const field=result.coordinates.get(sleeve.geometry),
    pos=sleeve.geometry.getAttribute('position');
  assert.ok(field);
  for(let i=0;i<47;i++)
    assert.ok(Math.abs(field[i]-(pos.getX(i)+.26))<.0001);
});

function shoulderSewnPanel(name,{samples=29,front=true,side=1,
    flip=false,atlasShift=0,verticalOnly=false}={}){
  const vertices=[],triangles=[];
  for(let row=0;row<2;row++)for(let i=0;i<samples;i++){
    const t=i/(samples-1),
      x=verticalOnly?side*.32:side*(.12+.23*t),
      y=verticalOnly?1.41+.16*t:
        row?1.30:1.55-.04*t,
      z=row?(front?.045:-.045):.008*Math.sin(Math.PI*t),
      u=atlasShift+(flip?-x:x)/1.52+
        ((!front&&row===0)?.006*Math.sin(Math.PI*t)/1.52:0);
    vertices.push({p:[x,y,z],uv:[u,row*.08]});
  }
  for(let i=0;i<samples-1;i++){
    const a=i,b=i+1,c=i+samples,d=c+1;
    triangles.push(a,b,c,b,d,c);
  }
  const position={
    count:vertices.length,
    getX(i){return vertices[i].p[0]},
    getY(i){return vertices[i].p[1]},
    getZ(i){return vertices[i].p[2]}
  },uv={
    count:vertices.length,
    getX(i){return vertices[i].uv[0]},
    getY(i){return vertices[i].uv[1]}
  };
  const geometry={
    index:{count:triangles.length,getX(i){return triangles[i]}},
    getAttribute(k){return k==='position'?position:k==='uv'?uv:null}
  };
  return {part:'jersey',meshName:name,mesh:{name},geometry,
    metric:{originU:(vertices[0].uv[0]+vertices[samples-1].uv[0])/2,
      metresPerUv:1.52,metresPerUvV:1.52}};
}
test('KM-32 torso front/back stripes start together at the actual shoulder, both sides',()=>{
  for(const side of [1,-1]){
    const front=shoulderSewnPanel('FA_jersey__9',
        {samples:21,front:true,side}),
      back=shoulderSewnPanel('FA_jersey__42',
        {samples:51,front:false,side,flip:true,atlasShift:.48});
    // Deliberately list BACK first to reject arbitrary largest-panel root.
    const result=alignOriginalShoulderStripes({},[back,front]),
      reference=result.report.shoulderReference;
    assert.equal(reference.status,'front-back-anchored');
    assert.equal(reference.backConnected,true);
    assert.deepEqual(reference.panels,['FA_jersey__9','FA_jersey__42']);
    assert.ok(reference.side.includes(side===1?'right':'left'));
    assert.ok(reference.matchedStitches>=40);
    assert.equal(result.report.connections[0].role,'front-back-shoulder-origin');
    const frontField=result.coordinates.get(front.geometry),
      backField=result.coordinates.get(back.geometry);
    assert.ok(frontField&&backField);
    assert.ok(Math.abs(frontField[0])<.000005,
      'First front stripe must start from the neck-side shoulder point');
    assert.ok(Math.abs(backField[0])<.000005,
      'First back stripe must start from the exact same physical point');
    const backPositions=back.geometry.getAttribute('position');
    for(let i=0;i<51;i++){
      const physicalDistance=Math.abs(backPositions.getX(i))-.12;
      assert.ok(Math.abs(backField[i]-physicalDistance)<.00002,
        'Front/back stripe field must coincide along the entire shoulder');
      for(const width of [.01,.015,.075,.15])
        assert.ok(Math.abs(Math.cos(Math.PI*backField[i]/width)-
          Math.cos(Math.PI*physicalDistance/width))<.007,
          'One-centimetre stripe cannot begin at a different back position');
    }
  }
});
test('KM-32 front/back shared shoulder calibration precedes sleeve mapping',()=>{
  const sleeve=shoulderSewnPanel('FA_jersey__38',
      {samples:61,front:false,flip:true,atlasShift:.9}),
    back=shoulderSewnPanel('FA_jersey__42',
      {samples:47,front:false,flip:true,atlasShift:.48}),
    front=shoulderSewnPanel('FA_jersey__9',{samples:19,front:true});
  const result=alignOriginalShoulderStripes({},[sleeve,back,front]);
  assert.equal(result.report.shoulderReference.status,'front-back-anchored');
  assert.equal(result.report.connections[0].role,'front-back-shoulder-origin');
  assert.equal(result.report.sleeves.right,true);
  const body=result.coordinates.get(back.geometry),
    sleeveMetres=result.coordinates.get(sleeve.geometry);
  assert.ok(body&&sleeveMetres);
  const positions=sleeve.geometry.getAttribute('position');
  for(let i=0;i<61;i++){
    const expected=positions.getX(i)-.12;
    assert.ok(Math.abs(sleeveMetres[i]-expected)<.00002,
      'The sleeve must inherit the shoulder-anchored torso phase');
  }
});
test('KM-32 never mistakes a vertical side seam for a shared shoulder origin',()=>{
  const front=shoulderSewnPanel('FA_jersey__9',
      {front:true,verticalOnly:true}),
    back=shoulderSewnPanel('FA_jersey__42',
      {front:false,flip:true,verticalOnly:true});
  const result=alignOriginalShoulderStripes({},[front,back]);
  assert.equal(result.report.shoulderReference.status,'not-detected');
  assert.equal(result.report.shoulderReference.innerEdgeZero,undefined);
});

test('KM-33 Kit Maker keeps Solid fast and shares front/back origin when striped',()=>{
  const front=shoulderSewnPanel('FA_jersey__9',{samples:19}),
    back=shoulderSewnPanel('FA_jersey__42',
      {samples:43,front:false,flip:true,atlasShift:.5}),
    shorts=panel('FA_shorts__body'),
    socks=panel('FA_socks__body');
  const panels=[back,shorts,front,socks];
  class Color{
    constructor(value){this.hex=value;}
    set(value){this.hex=value;return this;}
  }
  class Float32BufferAttribute{
    constructor(array,itemSize){this.array=array;this.itemSize=itemSize;
      this.count=array.length/itemSize;}
  }
  const meshes=panels.map(e=>{
    const attrs=new Map(),previous=e.geometry.getAttribute.bind(e.geometry);
    e.geometry.getAttribute=k=>attrs.get(k)??previous(k);
    e.geometry.setAttribute=(k,value)=>{attrs.set(k,value);return e.geometry;};
    return {isMesh:true,name:e.meshName,geometry:e.geometry,
      material:{name:(e.meshName.startsWith('FA_jersey__')?
        'km13-white-':'km14-white-')+e.meshName,
        color:new Color('#FFFFFF'),userData:{}}};
  });
  const outfit={traverse(fn){meshes.forEach(fn);},userData:{}},
    store=createKitDesignStore(),THREE={Color,Float32BufferAttribute};
  applyKitDesign(outfit,store.getState(),THREE);
  assert.equal(outfit.userData.km31ShoulderStripeReport,undefined);
  assert.equal(back.geometry.getAttribute('kmStripeSewnMetres'),null);
  const bodyMaterial=meshes.find(e=>e.name==='FA_jersey__9').material,
    backMaterial=meshes.find(e=>e.name==='FA_jersey__42').material;
  assert.equal(bodyMaterial.customProgramCacheKey(),KIT_STRIPE_SHADER_KEY+'-plain');
  assert.equal(backMaterial.customProgramCacheKey(),KIT_STRIPE_SHADER_KEY+'-plain');
  store.selectStyle('vertical-stripes');
  store.selectStripeWidth(10);
  applyKitDesign(outfit,store.getState(),THREE);
  const origin=outfit.userData.km31ShoulderStripeReport.shoulderReference;
  assert.equal(origin.status,'front-back-anchored');
  const a=front.geometry.getAttribute('kmStripeSewnMetres'),
    b=back.geometry.getAttribute('kmStripeSewnMetres');
  assert.ok(a&&b);
  assert.ok(Math.abs(a.array[0])<.000005);
  assert.ok(Math.abs(b.array[0])<.000005);
  for(const material of [bodyMaterial,backMaterial]){
    assert.equal(material.userData.kitStripeUniforms.kmStripeFabricOrigin.value,0);
    assert.equal(material.userData.kitStripeUniforms.kmStripeFabricScale.value,1);
    assert.equal(material.customProgramCacheKey(),KIT_STRIPE_SHADER_KEY+'-sewn');
  }
  applyKitDesign(outfit,store.getState(),THREE);
  assert.equal(bodyMaterial.userData.kitStripeUniforms.kmStripeWidth.value,.01);
  assert.equal(back.geometry.getAttribute('kmStripeSewnMetres'),b,
    'Changing the slider must not move the shared shoulder start');
});

test('KM-32 tilted side seam cannot masquerade as an upper shoulder',()=>{
  const front=shoulderSewnPanel('FA_jersey__9',
      {front:true,verticalOnly:true}),
    back=shoulderSewnPanel('FA_jersey__42',
      {front:false,flip:true,verticalOnly:true});
  // Source side seam drifts outward 8cm while rising 16cm.
  // Its horizontal span alone is NOT evidence of a shoulder.
  for(const e of [front,back]){
    const position=e.geometry.getAttribute('position'),
      old=position.getX.bind(position);
    position.getX=i=>old(i)+.08*(position.getY(i)-1.41)/.16;
  }
  const r=alignOriginalShoulderStripes({},[back,front]);
  assert.equal(r.report.shoulderReference.status,'not-detected');
});

test('KM-33 shoulder reference discovery is bounded on dense private-source topology',()=>{
  const front=shoulderSewnPanel('FA_jersey__9',{samples:620}),
    back=shoulderSewnPanel('FA_jersey__42',{
      samples:640,front:false,flip:true,atlasShift:.5});
  const mapped=alignOriginalShoulderStripes({},[back,front]);
  assert.equal(mapped.report.shoulderReference.status,'front-back-anchored');
  assert.ok(mapped.report.shoulderReference.matchedStitches<=192,
    'Only a bounded shoulder discovery sample may run before full fitting');
  assert.ok(mapped.report.connections[0].matchedVertices>500,
    'Selected actual front/back seam must still fit its full detail');
  assert.ok(mapped.coordinates.has(front.geometry));
  assert.ok(mapped.coordinates.has(back.geometry));
});

test('KM-36 separated front/back source primitives still share the upper shoulder start',()=>{
  for(const side of [1,-1]){
    const front=shoulderSewnPanel('FA_jersey__9',
      {samples:25,front:true,side}),
      back=shoulderSewnPanel('FA_jersey__42',
      {samples:55,front:false,side,flip:true,atlasShift:.84});
    // Two sewn pattern primitives are separated by 12mm in the Z axis.
    // There are NO physically coincident mesh edges for KM-32 to match.
    const pos=back.geometry.getAttribute('position'),
      previousZ=pos.getZ.bind(pos);
    pos.getZ=i=>previousZ(i)+.012;
    const result=alignOriginalShoulderStripes({},[back,front]);
    assert.equal(result.report.shoulderReference.status,'not-detected');
    assert.equal(result.report.torsoShoulderStart.status,
      'shared-physical-upper-start');
    assert.equal(result.report.status,'torso-anchored');
    const a=result.coordinates.get(front.geometry),
      b=result.coordinates.get(back.geometry);
    assert.ok(a&&b);
    assert.ok(Math.abs(a[0])<1e-6);
    assert.ok(Math.abs(b[0])<1e-6);
    for(let i=0;i<55;i++){
      const x=pos.getX(i);
      const expected=Math.abs(x)-.12;
      assert.ok(Math.abs(b[i]-expected)<1e-6,
        'Back first stripe must follow exactly the same physical start');
    }
  }
});
test('KM-36 torso-only fallback does not fabricate a sleeve connection',()=>{
  const front=shoulderSewnPanel('FA_jersey__9',{samples:21}),
    back=shoulderSewnPanel('FA_jersey__42',
      {samples:39,front:false,flip:true,atlasShift:.84}),
    sleeve=irregularSeamPanel('FA_jersey__38',
      {count:51,lower:true,offset:.72});
  const positions=back.geometry.getAttribute('position'),
    original=positions.getZ.bind(positions);
  positions.getZ=i=>original(i)+.012;
  const sleevePos=sleeve.geometry.getAttribute('position'),
    sleeveOriginal=sleevePos.getZ.bind(sleevePos);
  sleevePos.getZ=i=>sleeveOriginal(i)+.08;
  const r=alignOriginalShoulderStripes({},[front,back,sleeve]);
  assert.equal(r.report.torsoShoulderStart.status,'shared-physical-upper-start');
  assert.ok(r.coordinates.has(front.geometry));
  assert.ok(r.coordinates.has(back.geometry));
  assert.ok(!r.coordinates.has(sleeve.geometry),
    'Do not call an unattached sleeve a verified stitched band');
});

test('KM-36 real shader binds identical physical start to separated front/back mesh',()=>{
  const front=shoulderSewnPanel('FA_jersey__9',{samples:29}),
    back=shoulderSewnPanel('FA_jersey__42',{
      samples:51,front:false,flip:true,atlasShift:.93}),
    shorts=panel('FA_shorts__body'),socks=panel('FA_socks__body');
  const positions=back.geometry.getAttribute('position'),
    original=positions.getZ.bind(positions);
  positions.getZ=i=>original(i)+.012;
  class Color{constructor(value){this.hex=value;}set(value){this.hex=value;return this;}}
  class Float32BufferAttribute{
    constructor(value,itemSize){this.array=value;this.itemSize=itemSize;
      this.count=value.length/itemSize;}
  }
  const meshEntries=[back,front,shorts,socks];
  const meshes=meshEntries.map(e=>{
    const attrs=new Map(),read=e.geometry.getAttribute.bind(e.geometry);
    e.geometry.getAttribute=k=>attrs.get(k)??read(k);
    e.geometry.setAttribute=(k,value)=>{attrs.set(k,value);return e.geometry;};
    return {isMesh:true,name:e.meshName,geometry:e.geometry,
      material:{name:(e.meshName.startsWith('FA_jersey__')?
        'km13-white-':'km14-white-')+e.meshName,
        color:new Color('#FFFFFF'),userData:{}}};
  });
  const outfit={traverse(fn){meshes.forEach(fn);},userData:{}},
    store=createKitDesignStore(),THREE={Color,Float32BufferAttribute};
  applyKitDesign(outfit,store.getState(),THREE);
  store.selectStyle('vertical-stripes');
  store.selectStripeWidth(10);
  applyKitDesign(outfit,store.getState(),THREE);
  assert.equal(outfit.userData.km36TorsoStartReport.status,
    'shared-physical-upper-start');
  assert.equal(outfit.userData.km31ShoulderStripeReport.status,
    'torso-anchored');
  const a=front.geometry.getAttribute('kmStripeSewnMetres'),
    b=back.geometry.getAttribute('kmStripeSewnMetres');
  assert.ok(a&&b);
  for(let i=0;i<51;i++){
    const x=positions.getX(i),expected=x-.12;
    assert.ok(Math.abs(b.array[i]-expected)<1e-6);
    const width=.01;
    assert.ok(Math.abs(Math.cos(Math.PI*b.array[i]/width)-
      Math.cos(Math.PI*expected/width))<.00001);
  }
  assert.ok(Math.abs(a.array[0])<1e-6&&Math.abs(b.array[0])<1e-6);
  for(const name of ['FA_jersey__9','FA_jersey__42']){
    const material=meshes.find(m=>m.name===name).material;
    assert.equal(material.customProgramCacheKey(),KIT_STRIPE_SHADER_KEY+'-sewn');
    assert.equal(material.userData.kitStripeUniforms.kmStripeFabricOrigin.value,0);
    assert.equal(material.userData.kitStripeUniforms.kmStripeFabricScale.value,1);
  }
});
