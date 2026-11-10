import test from 'node:test';
import assert from 'node:assert/strict';
import {alignOriginalShoulderStripes} from '../../kit-maker/lab/kit-stripe-seams.mjs';
import {applyKitDesign,createKitDesignStore,KIT_STRIPE_SHADER_KEY,
  measureKitStripeFabricMetric} from '../../kit-maker/lab/kit-design.mjs';

function garment(name,{side=1,n=31,front=true,z=0,
  patternOffset=0,flip=false,warpedUv=false,
  nonindexed=false,verticalOnly=false,translateX=0,
  lowerY=1.05}={}){
  const rows=5,original=[],indices=[];
  for(let row=0;row<rows;row++)for(let i=0;i<n;i++){
    const t=i/(n-1),r=row/(rows-1),
      x=side*(verticalOnly?.25:.12+.24*t),
      y=verticalOnly?1.38+.19*t:1.55-.04*t-(1.55-lowerY)*r,
      uvX=patternOffset+(flip?-x:x)/1.52+
        (warpedUv?.075*r*Math.sin(t*Math.PI):0);
    original.push({pos:[x,y,z+(front?.04:-.04)*r],
      uv:[uvX,y/1.52]});
  }
  for(let row=0;row<rows-1;row++)for(let i=0;i<n-1;i++){
    const a=row*n+i,b=a+1,c=a+n,d=c+1;
    indices.push(a,b,c,b,d,c);
  }
  const vertices=nonindexed?indices.map(i=>original[i]):original,
    position={count:vertices.length,
      getX:i=>vertices[i].pos[0],
      getY:i=>vertices[i].pos[1],
      getZ:i=>vertices[i].pos[2]},
    uv={count:vertices.length,
      getX:i=>vertices[i].uv[0],
      getY:i=>vertices[i].uv[1]},
    attrs=new Map([['position',position],['uv',uv]]);
  const geometry={
    index:nonindexed?null:{count:indices.length,getX:i=>indices[i]},
    getAttribute:k=>attrs.get(k)||null,
    setAttribute(k,value){attrs.set(k,value);return this}
  };
  const mesh={name,geometry,isMesh:true,
    matrixWorld:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,
      translateX,0,0,1]}};
  const metric={originU:.12+patternOffset,
    metresPerUv:1.52,metresPerUvV:1.52};
  return {part:'jersey',meshName:name,geometry,mesh,metric,
    original,positions:vertices,translateX};
}
const front=name=>garment(name||'FA_jersey__9');
const back=name=>garment(name||'FA_jersey__42',{front:false,n:57,
  z:.014,patternOffset:.75,flip:true,warpedUv:true});
const sleeve=(name='FA_jersey__38',offset=.52)=>garment(name,{
  n:53,front:false,patternOffset:offset,flip:true,lowerY:1.38,
  z:0,warpedUv:true
});
const meter=(panel,i)=>panel.geometry.getAttribute('kmStripeSewnMetres')?.array[i];
const worldX=(panel,i)=>panel.geometry.getAttribute('position').getX(i)+
  panel.translateX;

test('KM-37 front and back stripes use one shoulder start with no vertical bending',()=>{
  const chest=front(),rear=back();
  const result=alignOriginalShoulderStripes({},[rear,chest]);
  assert.equal(result.report.status,'torso-straight');
  assert.equal(result.report.torsoShoulderStart.method,'constant-source-world-x');
  assert.equal(result.report.torsoShoulderStart.noVerticalBlend,true);
  const expectedOrigin=.12;
  assert.equal(result.report.torsoShoulderStart.originRadialM,expectedOrigin);
  for(const panel of [chest,rear]){
    const field=result.coordinates.get(panel.geometry);
    assert.ok(field);
    const n=panel.geometry.getAttribute('position').count;
    for(let i=0;i<n;i++){
      const expected=Math.abs(worldX(panel,i))-expectedOrigin;
      assert.ok(Math.abs(field[i]-expected)<3e-8,
        'Vertical stripe bends with the y-coordinate');
    }
  }
  const a=result.coordinates.get(chest.geometry),b=result.coordinates.get(rear.geometry);
  for(const width of [.01,.015,.03,.075,.15]){
    for(let i=0;i<31;i++){
      const x=worldX(chest,i);
      const j=Math.round((x-.12)/.24*(57-1));
      const d=Math.abs(a[i]-b[j]);
      assert.ok(d<.0044,'Torso origin differs at corresponding world X');
      assert.ok(Math.abs(Math.cos(Math.PI*a[i]/width)-
        Math.cos(Math.PI*(x-.12)/width))<.0001);
    }
  }
});
test('KM-37 left and right of torso both stay straight at 1 cm',()=>{
  for(const side of [-1,1]){
    const chest=garment('FA_jersey__9',{side}),
      rear=garment('FA_jersey__42',{side,front:false,
        n:47,patternOffset:.55,flip:true,warpedUv:true});
    const r=alignOriginalShoulderStripes({},[rear,chest]);
    assert.equal(r.report.status,'torso-straight');
    assert.equal(r.report.torsoShoulderStart.originRadialM,.12);
    for(const panel of [chest,rear]){
      const values=r.coordinates.get(panel.geometry);
      const n=panel.geometry.getAttribute('position').count;
      for(let i=0;i<n;i++)
        assert.ok(Math.abs(values[i]-(Math.abs(worldX(panel,i))-.12))<3e-8);
    }
  }
});
test('KM-37 all four original torso primitives receive the SAME stripe origin',()=>{
  const panels=[
    garment('FA_jersey__9'),
    garment('FA_jersey__10',{patternOffset:.88}),
    garment('FA_jersey__42',{front:false,flip:true,patternOffset:1.1}),
    garment('FA_jersey__43',{front:false,flip:true,patternOffset:1.8,warpedUv:true})
  ];
  const r=alignOriginalShoulderStripes({},panels);
  assert.equal(r.report.status,'torso-straight');
  assert.equal(r.coordinates.size,4);
  for(const p of panels)
    for(let i=0;i<p.geometry.getAttribute('position').count;i++)
      assert.ok(Math.abs(r.coordinates.get(p.geometry)[i]-
        (Math.abs(worldX(p,i))-.12))<3e-8);
});
test('KM-37 sleeves use independent original UVs even if physically adjacent',()=>{
  const chest=front(),rear=back(),
    right=sleeve('FA_jersey__38',.58),
    left=sleeve('FA_jersey__62',.96);
  // Both sleeves share X positions with the torso on purpose.
  const sourceRightUV=right.geometry.getAttribute('uv'),
    sourceLeftUV=left.geometry.getAttribute('uv');
  const r=alignOriginalShoulderStripes({},[chest,rear,right,left]);
  assert.equal(r.report.status,'torso-straight');
  assert.equal(r.report.sleeves.mode,'independent-source-uv');
  assert.ok(!r.coordinates.has(right.geometry)&&!r.coordinates.has(left.geometry));
  assert.ok(!r.adjustments.has(right.geometry)&&!r.adjustments.has(left.geometry));
  assert.equal(right.geometry.getAttribute('uv'),sourceRightUV);
  assert.equal(left.geometry.getAttribute('uv'),sourceLeftUV);
  assert.equal(r.report.connections.length,0);
});
test('KM-37 original source geometry and UVs stay byte-for-byte unchanged',()=>{
  const chest=front(),rear=back(),arm=sleeve();
  const originals=[chest,rear,arm].map(p=>({
    position:p.geometry.getAttribute('position'),
    uv:p.geometry.getAttribute('uv'),
    points:p.original.map(v=>({pos:[...v.pos],uv:[...v.uv]}))
  }));
  const outfit={};
  const first=alignOriginalShoulderStripes(outfit,[arm,rear,chest]);
  assert.equal(alignOriginalShoulderStripes(outfit,[arm,rear,chest]),first,
    'Slider and colour updates reuse cached geometry');
  for(const [i,p] of [chest,rear,arm].entries()){
    assert.equal(p.geometry.getAttribute('position'),originals[i].position);
    assert.equal(p.geometry.getAttribute('uv'),originals[i].uv);
    assert.deepEqual(p.original,originals[i].points);
  }
});
test('KM-37 indexed and nonindexed original torso triangles map identically',()=>{
  const a=garment('FA_jersey__9',{nonindexed:true}),
    b=garment('FA_jersey__42',{nonindexed:false,front:false,n:43});
  const r=alignOriginalShoulderStripes({},[a,b]);
  assert.equal(r.report.status,'torso-straight');
  for(const p of [a,b]){
    const field=r.coordinates.get(p.geometry);
    for(let i=0;i<field.length;i++)
      assert.ok(Math.abs(field[i]-(Math.abs(worldX(p,i))-.12))<3e-8);
  }
});
test('KM-37 source world transform produces straight reference without editing local vertices',()=>{
  const a=garment('FA_jersey__9',{translateX:.04}),
    b=garment('FA_jersey__42',{front:false,translateX:.04,
      flip:true,patternOffset:.45});
  const r=alignOriginalShoulderStripes({},[a,b]);
  assert.equal(r.report.status,'torso-straight');
  assert.equal(r.report.torsoShoulderStart.originRadialM,.16);
  for(const p of [a,b]){
    const field=r.coordinates.get(p.geometry);
    for(let i=0;i<field.length;i++)
      assert.ok(Math.abs(field[i]-(worldX(p,i)-.16))<3e-8);
  }
});
test('KM-37 vertical side seams without shoulders do not fabricate a shared start',()=>{
  const a=garment('FA_jersey__9',{verticalOnly:true}),
    b=garment('FA_jersey__42',{verticalOnly:true,front:false});
  const r=alignOriginalShoulderStripes({},[a,b]);
  assert.equal(r.report.status,'no-common-shoulder-start');
  assert.equal(r.coordinates.size,0);
  assert.equal(r.report.torsoShoulderStart.status,'not-detected');
});
test('KM-37 a missing front or back must not claim a common torso origin',()=>{
  for(const selection of [[front()], [back()]]){
    const r=alignOriginalShoulderStripes({},selection);
    assert.equal(r.report.status,'no-common-shoulder-start');
    assert.equal(r.coordinates.size,0);
  }
});
class Color{
  constructor(v){this.hex=v;}
  set(v){this.hex=v;return this;}
}
class Float32BufferAttribute{
  constructor(array,itemSize){this.array=array;this.itemSize=itemSize;
    this.count=array.length/itemSize;}
}
const THREE={Color,Float32BufferAttribute};
function scene(panels){
  const others=['shorts','socks'].map(part=>{
    const p=garment('FA_'+part+'__body',{n:21});
    p.part=part;return p;
  });
  const all=[...panels,...others],
    meshes=all.map(e=>{
      e.mesh.material={
        name:(e.part==='jersey'?'km13-white-':'km14-white-')+e.meshName,
        color:new Color('#FFFFFF'),userData:{}
      };
      return e.mesh;
    });
  const outfit={traverse(fn){meshes.forEach(fn);},userData:{},
    updateMatrixWorld(){}};
  return {outfit,panels:all,meshes};
}
test('KM-37 renderer: Solid fast, torso sewn shader, sleeves plain independent shader',()=>{
  const chest=front(),rear=back(),
    right=sleeve('FA_jersey__38',.87),
    left=sleeve('FA_jersey__62',1.44),
    model=scene([rear,left,chest,right]),
    store=createKitDesignStore();
  applyKitDesign(model.outfit,store.getState(),THREE);
  assert.equal(model.outfit.userData.km37StripeReport,undefined);
  for(const item of model.panels)
    assert.equal(item.geometry.getAttribute('kmStripeSewnMetres'),null);
  store.selectStyle('vertical-stripes');
  store.selectStripeWidth(10);
  applyKitDesign(model.outfit,store.getState(),THREE);
  assert.equal(model.outfit.userData.km37StripeReport.status,'torso-straight');
  for(const p of [chest,rear]){
    const material=p.mesh.material,
      u=material.userData.kitStripeUniforms;
    assert.ok(p.geometry.getAttribute('kmStripeSewnMetres'));
    assert.equal(material.customProgramCacheKey(),KIT_STRIPE_SHADER_KEY+'-sewn');
    assert.equal(u.kmStripeFabricOrigin.value,0);
    assert.equal(u.kmStripeFabricScale.value,1);
    assert.equal(u.kmStripeWidth.value,.01);
    const shader={uniforms:{},
      vertexShader:'void main(){\n#include <begin_vertex>\n}',
      fragmentShader:'void main(){\n#include <color_fragment>\n}'};
    material.onBeforeCompile(shader);
    assert.match(shader.vertexShader,/vKmPatternU = kmStripeSewnMetres/);
    assert.match(shader.vertexShader,/attribute float kmStripeSewnMetres/);
    const n=p.geometry.getAttribute('position').count;
    for(let i=0;i<n;i++)
      assert.ok(Math.abs(meter(p,i)-(Math.abs(worldX(p,i))-.12))<3e-8);
  }
  for(const p of [left,right]){
    const material=p.mesh.material,u=material.userData.kitStripeUniforms;
    assert.equal(p.geometry.getAttribute('kmStripeSewnMetres'),null);
    assert.equal(material.customProgramCacheKey(),KIT_STRIPE_SHADER_KEY+'-plain');
    assert.equal(u.kmStripeEnabled.value,1);
    assert.equal(u.kmStripeWidth.value,.01);
    assert.ok(Math.abs(u.kmStripeFabricOrigin.value-
      measureKitStripeFabricMetric(p.geometry).originU)<1e-8);
    assert.ok(Math.abs(u.kmStripeFabricScale.value-
      measureKitStripeFabricMetric(p.geometry).metresPerUv)<1e-8);
    const shader={uniforms:{},
      vertexShader:'void main(){\n#include <begin_vertex>\n}',
      fragmentShader:'void main(){\n#include <color_fragment>\n}'};
    material.onBeforeCompile(shader);
    assert.match(shader.vertexShader,/vKmPatternU = uv.x/);
    assert.doesNotMatch(shader.vertexShader,/attribute float kmStripeSewnMetres/);
  }
  const original=chest.geometry.getAttribute('kmStripeSewnMetres');
  store.selectStripeWidth(150);
  applyKitDesign(model.outfit,store.getState(),THREE);
  assert.equal(chest.geometry.getAttribute('kmStripeSewnMetres'),original);
  assert.equal(right.mesh.material.userData.kitStripeUniforms.kmStripeWidth.value,.15);
  store.selectStyle('solid');
  applyKitDesign(model.outfit,store.getState(),THREE);
  assert.equal(right.mesh.material.userData.kitStripeUniforms.kmStripeEnabled.value,0);
});
test('KM-37 jersey torso geometry never influences sleeve phase or shade on updates',()=>{
  const a=front(),b=back(),
    arm=sleeve('FA_jersey__38',.68),
    model=scene([a,b,arm]),store=createKitDesignStore();
  store.selectStyle('vertical-stripes');
  applyKitDesign(model.outfit,store.getState(),THREE);
  const sleeveUniforms=arm.mesh.material.userData.kitStripeUniforms;
  const before=[sleeveUniforms.kmStripeFabricOrigin.value,
    sleeveUniforms.kmStripeFabricScale.value];
  assert.equal(arm.geometry.getAttribute('kmStripeSewnMetres'),null);
  store.selectStripeWidth(15);
  applyKitDesign(model.outfit,store.getState(),THREE);
  assert.deepEqual([sleeveUniforms.kmStripeFabricOrigin.value,
    sleeveUniforms.kmStripeFabricScale.value],before);
  assert.equal(sleeveUniforms.kmStripeWidth.value,.015);
  assert.equal(arm.geometry.getAttribute('kmStripeSewnMetres'),null);
});
