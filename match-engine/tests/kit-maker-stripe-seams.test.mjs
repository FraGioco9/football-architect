import test from 'node:test';
import assert from 'node:assert/strict';
import {alignOriginalShoulderStripes} from '../../kit-maker/lab/kit-stripe-seams.mjs';
import {applyKitDesign,createKitDesignStore,KIT_STRIPE_SHADER_KEY,
  measureKitStripeFabricMetric} from '../../kit-maker/lab/kit-design.mjs';

function garment(name,{side=1,n=31,front=true,z=0,
  patternOffset=0,flip=false,warpedUv=false,
  nonindexed=false,verticalOnly=false,spansCenter=false,translateX=0,
  lowerY=1.05}={}){
  const rows=5,original=[],indices=[];
  for(let row=0;row<rows;row++)for(let i=0;i<n;i++){
    const t=i/(n-1),r=row/(rows-1),
      x=side*(verticalOnly?.25:spansCenter?-.30+.60*t:.12+.24*t),
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

test('KM-38 front and back use one signed centerline with no vertical bending',()=>{
  const chest=front(),rear=back();
  const result=alignOriginalShoulderStripes({},[rear,chest]);
  assert.equal(result.report.status,'torso-straight');
  assert.equal(result.report.torsoShoulderStart.method,'signed-source-world-x');
  assert.equal(result.report.torsoShoulderStart.noVerticalBlend,true);
  const expectedCenterX=0;
  assert.equal(result.report.torsoShoulderStart.centerWorldXM,expectedCenterX);
  assert.equal(result.report.torsoShoulderStart.centerStripe,'base-color-full-width');
  assert.equal(result.report.torsoShoulderStart.continuousAcrossMidline,true);
  for(const panel of [chest,rear]){
    const field=result.coordinates.get(panel.geometry);
    assert.ok(field);
    const n=panel.geometry.getAttribute('position').count;
    for(let i=0;i<n;i++){
      const expected=worldX(panel,i)-expectedCenterX;
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
        Math.cos(Math.PI*x/width))<.0001);
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
    assert.equal(r.report.torsoShoulderStart.centerWorldXM,0);
    for(const panel of [chest,rear]){
      const values=r.coordinates.get(panel.geometry);
      const n=panel.geometry.getAttribute('position').count;
      for(let i=0;i<n;i++)
        assert.ok(Math.abs(values[i]-worldX(panel,i))<3e-8);
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
        worldX(p,i))<3e-8);
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
      assert.ok(Math.abs(field[i]-worldX(p,i))<3e-8);
  }
});
test('KM-37 source world transform produces straight reference without editing local vertices',()=>{
  const a=garment('FA_jersey__9',{translateX:.04}),
    b=garment('FA_jersey__42',{front:false,translateX:.04,
      flip:true,patternOffset:.45});
  const shiftedRoot={matrixWorld:{elements:[1,0,0,0,0,1,0,0,
    0,0,1,0,.04,0,0,1]}};
  const r=alignOriginalShoulderStripes(shiftedRoot,[a,b]);
  assert.equal(r.report.status,'torso-straight');
  assert.equal(r.report.torsoShoulderStart.centerWorldXM,.04);
  for(const p of [a,b]){
    const field=r.coordinates.get(p.geometry);
    for(let i=0;i<field.length;i++)
      assert.ok(Math.abs(field[i]-(worldX(p,i)-.04))<3e-8);
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
      assert.ok(Math.abs(meter(p,i)-worldX(p,i))<3e-8);
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

function sampleTorsoBandAtX(panel,metres,x,row=0){
  const p=panel.geometry.getAttribute('position');
  const n=panel.original.length/5;
  const from=row*n;
  for(let i=from;i<from+n-1;i++){
    const x1=p.getX(i)+panel.translateX,
      x2=p.getX(i+1)+panel.translateX;
    const lo=Math.min(x1,x2),hi=Math.max(x1,x2);
    if(x>=lo-1e-9&&x<=hi+1e-9){
      const t=(x-x1)/(x2-x1);
      return metres[i]*(1-t)+metres[i+1]*t;
    }
  }
  throw Error('Stripe sample outside source torso range: '+x);
}

test('KM-38 center stripe stays centered and full width for all slider widths',()=>{
  // Even vertex count deliberately leaves NO vertex at X=0. This catches
  // old abs(X) shader fields that form a broad mirrored plateau across
  // the two triangles straddling the central line.
  const chest=garment('FA_jersey__9',{n:62,spansCenter:true}),
    rear=garment('FA_jersey__42',{n:74,front:false,
      spansCenter:true,flip:true,patternOffset:.91,warpedUv:true}),
    r=alignOriginalShoulderStripes({},[rear,chest]);
  assert.equal(r.report.status,'torso-straight');
  assert.equal(r.report.torsoShoulderStart.status,'shared-centered-torso-axis');
  assert.equal(r.report.torsoShoulderStart.centerWorldXM,0);
  for(const panel of [chest,rear]){
    const field=r.coordinates.get(panel.geometry);
    assert.ok(field);
    for(let row=0;row<5;row++){
      const center=sampleTorsoBandAtX(panel,field,0,row);
      assert.ok(Math.abs(center)<1e-7,'Center x=0 must interpolate to stripe phase zero');
      for(const width of [.01,.015,.03,.075,.15]){
        const left=sampleTorsoBandAtX(panel,field,-width,row),
          right=sampleTorsoBandAtX(panel,field,width,row),
          leftBorder=sampleTorsoBandAtX(panel,field,-width/2,row),
          rightBorder=sampleTorsoBandAtX(panel,field,width/2,row);
        assert.ok(Math.abs(left+width)<1e-7);
        assert.ok(Math.abs(right-width)<1e-7);
        assert.ok(Math.abs(leftBorder+width/2)<1e-7);
        assert.ok(Math.abs(rightBorder-width/2)<1e-7);
        // The actual shader uses cos(pi * sewnMetres / width):
        // primary centre band is [-w/2,+w/2], exactly w wide.
        assert.ok(Math.abs(Math.cos(Math.PI*center/width)-1)<1e-7);
        assert.ok(Math.abs(Math.cos(Math.PI*left/width)+1)<1e-7);
        assert.ok(Math.abs(Math.cos(Math.PI*right/width)+1)<1e-7);
        assert.ok(Math.abs(Math.cos(Math.PI*leftBorder/width))<1e-6);
        assert.ok(Math.abs(Math.cos(Math.PI*rightBorder/width))<1e-6);
      }
    }
  }
});

test('KM-38 signed interpolation crosses physical torso midline monotonically',()=>{
  const a=garment('FA_jersey__9',{n:62,spansCenter:true}),
    b=garment('FA_jersey__42',{n:62,front:false,
      spansCenter:true,flip:true,patternOffset:1.7}),
    r=alignOriginalShoulderStripes({},[a,b]);
  for(const panel of [a,b]){
    const field=r.coordinates.get(panel.geometry),p=panel.geometry.getAttribute('position');
    const n=panel.original.length/5;
    const mid=n/2-1;
    for(let row=0;row<5;row++){
      const i=row*n+mid;
      assert.ok(p.getX(i)<0&&p.getX(i+1)>0);
      assert.ok(field[i]<0&&field[i+1]>0,
        'Signed phase must change monotonically across the center triangle');
      const center=field[i]+(field[i+1]-field[i])*
        (-p.getX(i))/(p.getX(i+1)-p.getX(i));
      assert.ok(Math.abs(center)<1e-7);
      assert.ok(Math.abs(field[i+1]-field[i]-
        (p.getX(i+1)-p.getX(i)))<1e-7);
    }
  }
});

test('KM-38 front/back bands remain identical at matched X along full torso height',()=>{
  const front=garment('FA_jersey__9',{n:62,spansCenter:true}),
    back=garment('FA_jersey__42',{n:88,spansCenter:true,
      front:false,flip:true,patternOffset:.71,warpedUv:true}),
    r=alignOriginalShoulderStripes({},[front,back]),
    a=r.coordinates.get(front.geometry),b=r.coordinates.get(back.geometry);
  for(let row=0;row<5;row++)
    for(let k=-30;k<=30;k++){
      const x=k/100;
      const first=sampleTorsoBandAtX(front,a,x,row),
        second=sampleTorsoBandAtX(back,b,x,row);
      assert.ok(Math.abs(first-second)<1e-7,
        'Body front/back phase differs for the same physical X and height');
      assert.ok(Math.abs(first-x)<1e-7);
    }
});

test('KM-38 renderer uses signed centerline from Solid to 1cm and 15cm stripes',()=>{
  const front=garment('FA_jersey__9',{n:62,spansCenter:true}),
    back=garment('FA_jersey__42',{n:74,spansCenter:true,
      front:false,flip:true,patternOffset:1.4,warpedUv:true}),
    right=sleeve('FA_jersey__38',.5),
    left=sleeve('FA_jersey__62',1.2),
    model=scene([front,back,right,left]),
    store=createKitDesignStore();
  applyKitDesign(model.outfit,store.getState(),THREE);
  assert.equal(front.geometry.getAttribute('kmStripeSewnMetres'),null);
  store.selectStyle('vertical-stripes');
  store.selectStripeWidth(10);
  applyKitDesign(model.outfit,store.getState(),THREE);
  const frontAttr=front.geometry.getAttribute('kmStripeSewnMetres'),
    backAttr=back.geometry.getAttribute('kmStripeSewnMetres');
  for(const panel of [front,back]){
    const shader={uniforms:{},
      vertexShader:'void main(){\n#include <begin_vertex>\n}',
      fragmentShader:'void main(){\n#include <color_fragment>\n}'};
    panel.mesh.material.onBeforeCompile(shader);
    assert.match(shader.vertexShader,/vKmPatternU = kmStripeSewnMetres/);
    assert.match(shader.fragmentShader,/cos\(3\.141592653589793\*distanceOnFabric\/kmStripeWidth\)/);
    const attr=panel.geometry.getAttribute('kmStripeSewnMetres');
    assert.ok(Math.abs(sampleTorsoBandAtX(panel,attr.array,0))<1e-7);
    assert.equal(panel.mesh.material.userData.kitStripeUniforms.kmStripeWidth.value,.01);
  }
  for(const panel of [right,left]){
    assert.equal(panel.geometry.getAttribute('kmStripeSewnMetres'),null);
    assert.equal(panel.mesh.material.customProgramCacheKey(),KIT_STRIPE_SHADER_KEY+'-plain');
  }
  store.selectStripeWidth(150);
  applyKitDesign(model.outfit,store.getState(),THREE);
  assert.equal(front.geometry.getAttribute('kmStripeSewnMetres'),frontAttr);
  assert.equal(back.geometry.getAttribute('kmStripeSewnMetres'),backAttr);
  assert.equal(front.mesh.material.userData.kitStripeUniforms.kmStripeWidth.value,.15);
  assert.ok(Math.abs(sampleTorsoBandAtX(front,frontAttr.array,0))<1e-7);
});
