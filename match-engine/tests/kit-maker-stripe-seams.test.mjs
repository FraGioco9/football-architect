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
  for(const width of [.01,.03,.075,.15]){
    for(let i=0;i<19;i++){
      const value=phase(body.seamSamples[i],adjusted(body,result));
      const opposite=phase(sleeve.seamSamples[i],adjusted(sleeve,result));
      assert.ok(Math.abs(Math.cos(Math.PI*value/width)-
        Math.cos(Math.PI*opposite/width))<1e-8);
    }
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
test('KM-30 actual design pipeline binds one continuous shader attribute before style toggle',()=>{
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
  const shirt=meshes[0],sleeve=meshes[1],
    a=shirt.geometry.getAttribute('kmStripeSewnMetres'),
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
  store.selectStyle('vertical-stripes');store.selectStripeWidth(30);
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
