import test from 'node:test';
import assert from 'node:assert/strict';
import {alignOriginalShoulderStripes} from '../../kit-maker/lab/kit-stripe-seams.mjs';
import {classifyOriginalJerseySurfaces} from '../../kit-maker/lab/kit-stripe-surfaces.mjs';
import {applyKitDesign,createKitDesignStore,KIT_STRIPE_SHADER_KEY} from
  '../../kit-maker/lab/kit-design.mjs';

class Color{
  constructor(hex){this.hex=hex;}
  set(hex){this.hex=hex;return this;}
}
class Float32BufferAttribute{
  constructor(array,itemSize){this.array=array;this.itemSize=itemSize;
    this.count=array.length/itemSize;}
  getX(i){return this.array[i*this.itemSize]}
  getY(i){return this.array[i*this.itemSize+1]}
  getZ(i){return this.array[i*this.itemSize+2]}
}
const THREE={Color,Float32BufferAttribute,DoubleSide:2};
function createGarment(name,{kind='front',normalLining=true,
    width=.3,depth=.16,side=1,withNormals=true}={}){
  const n=31,rows=5,vertices=[],index=[];
  for(let shell=0;shell<(normalLining?2:1);shell++)
    for(let row=0;row<rows;row++)
      for(let i=0;i<n;i++){
        const t=i/(n-1),
          theta=(-Math.PI/2)+(Math.PI*t),
          y=1.56-row*.13,
          sleeve=kind==='sleeve',
          collar=kind==='collar';
        let x,z,nx,nz,uvU;
        if(sleeve){
          const rootX=side*(.33+.19*row/(rows-1)),
            radius=.055*(shell?.90:1);
          x=rootX+radius*Math.sin(theta);
          z=.06*(shell?.90:1)*Math.cos(theta);
          nx=Math.sin(theta);nz=Math.cos(theta);
          uvU=.6+side*t*.33;
        }else if(collar){
          x=.09*(shell?.90:1)*Math.sin(theta);
          z=.075*(shell?.90:1)*Math.cos(theta);
          nx=Math.sin(theta);nz=Math.cos(theta);
          uvU=.2+t*.3;
        }else{
          const r=shell?.94:1;
          x=width*r*Math.sin(theta);
          z=depth*r*Math.cos(theta)*(kind==='back'?-1:1);
          nx=Math.sin(theta);nz=Math.cos(theta)*(kind==='back'?-1:1);
          uvU=(kind==='back'?.82:.24)+t*.35;
        }
        const factor=shell?-1:1;
        vertices.push({x,y,z,nx:nx*factor,ny:0,nz:nz*factor,
          u:uvU+(shell?.55:0),v:row*.17});
      }
  for(let shell=0;shell<(normalLining?2:1);shell++)
    for(let row=0;row<rows-1;row++)
      for(let i=0;i<n-1;i++){
        const a=shell*rows*n+row*n+i,b=a+1,c=a+n,d=c+1;
        index.push(a,b,c,b,d,c);
      }
  const pos=new Float32BufferAttribute(
      Float32Array.from(vertices.flatMap(v=>[v.x,v.y,v.z])),3),
    normal=new Float32BufferAttribute(
      Float32Array.from(vertices.flatMap(v=>[v.nx,v.ny,v.nz])),3),
    uv=new Float32BufferAttribute(
      Float32Array.from(vertices.flatMap(v=>[v.u,v.v])),2),
    attrs=new Map([['position',pos],['uv',uv]]);
  if(withNormals)attrs.set('normal',normal);
  const geometry={
    index:{count:index.length,getX:i=>index[i]},
    getAttribute:k=>attrs.get(k)||null,
    setAttribute(k,v){attrs.set(k,v);return this}
  },material={name:'km13-white-'+name,
    color:new Color('#FFFFFF'),side:THREE.DoubleSide,userData:{}},
    mesh={isMesh:true,name,geometry,material,
      matrixWorld:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}};
  return {part:'jersey',meshName:name,geometry,mesh,material,
    metric:{originU:.36,metresPerUv:1,metresPerUvV:1},
    outerCount:rows*n,innerCount:normalLining?rows*n:0,
    vertices};
}
function scene(){
  const front=createGarment('FA_jersey__9',{kind:'front'}),
    back=createGarment('FA_jersey__42',{kind:'back'}),
    sleeve=createGarment('FA_jersey__38',{kind:'sleeve'}),
    left=createGarment('FA_jersey__62',{kind:'sleeve',side:-1}),
    collar=createGarment('FA_jersey__Pattern2D_3805002',
      {kind:'collar'});
  const all=[front,back,sleeve,left,collar];
  for(const part of ['shorts','socks']){
    const item=createGarment('FA_'+part+'__body',{normalLining:false,
      withNormals:false});
    item.part=part;
    item.material.name='km14-white-'+item.meshName;
    all.push(item);
  }
  return {parts:all,front,back,sleeve,left,collar,
    outfit:{traverse(fn){for(const p of all)fn(p.mesh);},
      updateMatrixWorld(){},userData:{}}};
}
function compile(material){
  const shader={uniforms:{},
    vertexShader:'void main(){\n#include <begin_vertex>\n}',
    fragmentShader:'void main(){\n#include <color_fragment>\n}'};
  material.onBeforeCompile(shader);
  return shader;
}
// Exact CPU mirror of KM-40's compact elliptical fragment projection.
function smoothstep(a,b,x){
  const t=Math.max(0,Math.min(1,(x-a)/(b-a)));
  return t*t*(3-2*t);
}
function flankPhase(x,z,y,sections,width,centerX=0){
  if(!sections)return x-centerX;
  const low=sections.low,high=sections.high,
    t=Math.max(0,Math.min(1,(y-low.y)/Math.max(high.y-low.y,.001))),
    rx=low.rx+(high.rx-low.rx)*t,
    rz=low.rz+(high.rz-low.rz)*t,
    cz=low.cz+(high.cz-low.cz)*t,
    theta=Math.atan2((x-centerX)/rx,(z-cz)/rz),
    refX=.5*(low.rx+high.rx),refZ=.5*(low.rz+high.rz),
    meanRadius=.5*(refX+refZ),
    directX=x-centerX;
  let arc=theta*meanRadius+.25*(refX-refZ)*Math.sin(2*theta);
  const blend=Math.max(smoothstep(.095,.13,Math.abs(directX)),
    smoothstep(Math.PI/2,1.69,Math.abs(theta)));
  arc=directX*(1-blend)+arc*blend;
  const halfArc=Math.PI*meanRadius,
    evenBands=2*Math.max(1,Math.floor(halfArc/(2*width)+.5)),
    shift=evenBands*width-halfArc;
  return arc+Math.sign(arc)*shift*smoothstep(.5*halfArc,halfArc,Math.abs(arc));
}
function ellipsePoint(theta,section){
  return {x:section.rx*Math.sin(theta),
    z:section.cz+section.rz*Math.cos(theta),y:section.y};
}

test('KM-39 source normals distinguish outer torso from inner shell',()=>{
  const m=scene(),r=classifyOriginalJerseySurfaces(m.outfit,m.parts);
  for(const panel of [m.front,m.back]){
    const v=r.masks.get(panel.geometry);
    assert.ok(v&&v.length===panel.vertices.length);
    for(let i=0;i<panel.outerCount;i++)
      assert.equal(v[i],1,'Exterior shirt front/back should receive colour');
    for(let i=panel.outerCount;i<v.length;i++)
      assert.equal(v[i],0,'Inner shirt lining must stay neutral');
  }
  assert.ok(r.report.interiorVertices>0);
  assert.equal(r.report.status,'source-normals');
});
test('KM-39 inner surface of both sleeves and collar remains neutral',()=>{
  const m=scene(),r=classifyOriginalJerseySurfaces(m.outfit,m.parts);
  for(const panel of [m.sleeve,m.left,m.collar]){
    const values=r.masks.get(panel.geometry);
    assert.ok(values);
    const outer=values.slice(0,panel.outerCount);
    const inner=values.slice(panel.outerCount);
    const maskedInner=inner.filter(x=>x===0).length;
    assert.ok(outer.filter(x=>x===1).length>outer.length*.9,
      'Outward-facing sleeve surfaces should remain coloured');
    assert.ok(maskedInner>inner.length*.9,
      'Lining should remain neutral on arms and collar');
  }
});
test('KM-39 no unknown source normals means no false exterior claim',()=>{
  const m=scene(),unavailable=createGarment('FA_jersey__10',
    {kind:'front',withNormals:false});
  const r=classifyOriginalJerseySurfaces({},[unavailable]);
  assert.ok(!r.masks.has(unavailable.geometry));
  assert.deepEqual(r.report.missingNormals,['FA_jersey__10']);
  // Original classified shirt is unaffected by an unrelated source.
  const baseline=classifyOriginalJerseySurfaces(m.outfit,m.parts);
  assert.equal(baseline.masks.size,5);
});
test('KM-39 classification does not modify artist positions, normals or UVs',()=>{
  const m=scene(),before=m.parts.map(p=>[
    p.geometry.getAttribute('position'),
    p.geometry.getAttribute('normal'),
    p.geometry.getAttribute('uv')]);
  const a=classifyOriginalJerseySurfaces(m.outfit,m.parts),
    b=classifyOriginalJerseySurfaces(m.outfit,m.parts);
  assert.equal(a,b);
  for(let i=0;i<m.parts.length;i++)
    assert.deepEqual(before[i],[
      m.parts[i].geometry.getAttribute('position'),
      m.parts[i].geometry.getAttribute('normal'),
      m.parts[i].geometry.getAttribute('uv')]);
});
test('KM-39 renderer preserves inside white in Solid and Vertical stripes',()=>{
  const m=scene(),store=createKitDesignStore();
  applyKitDesign(m.outfit,store.getState(),THREE);
  assert.ok(m.outfit.userData.km39ExteriorReport.interiorVertices>0);
  for(const panel of [m.front,m.back,m.sleeve,m.left,m.collar]){
    const material=panel.material;
    assert.ok(panel.geometry.getAttribute('kmJerseyExteriorMask'));
    assert.match(material.customProgramCacheKey(),/-exterior$/);
    const shader=compile(material);
    assert.match(shader.vertexShader,/attribute float kmJerseyExteriorMask/);
    assert.match(shader.vertexShader,/vKmJerseyExteriorMask = kmJerseyExteriorMask/);
    assert.match(shader.fragmentShader,/vKmJerseyExteriorMask < 0.5 \|\| !gl_FrontFacing/);
    assert.match(shader.fragmentShader,/diffuseColor.rgb=vec3\(1.0\)/);
    assert.equal(material.userData.kitStripeUniforms.kmStripeEnabled.value,0);
  }
  store.selectStyle('vertical-stripes');
  store.selectStripeWidth(10);
  applyKitDesign(m.outfit,store.getState(),THREE);
  for(const panel of [m.front,m.back,m.sleeve,m.left]){
    const material=panel.material;
    assert.equal(material.userData.kitStripeUniforms.kmStripeEnabled.value,1);
    const mask=panel.geometry.getAttribute('kmJerseyExteriorMask');
    for(let i=panel.outerCount;i<mask.count;i++)assert.equal(mask.array[i],0);
    assert.match(compile(material).fragmentShader,/diffuseColor.rgb=vec3\(1.0\)/);
  }
});
test('KM-40 front/flank/back uses both X and Z, not capped asin(X)',()=>{
  const m=scene(),store=createKitDesignStore();
  store.selectStyle('vertical-stripes');
  store.selectStripeWidth(10);
  applyKitDesign(m.outfit,store.getState(),THREE);
  const report=m.outfit.userData.km37StripeReport.torsoShoulderStart,
    sections=report.torsoSections;
  assert.ok(sections&&sections.reference.rx>.20&&sections.reference.rx<.35);
  assert.ok(sections.reference.rz>.06&&sections.reference.rz<.2);
  assert.equal(report.sideCorrection,'continuous-front-side-back-ellipse');
  for(const panel of [m.front,m.back]){
    const u=panel.material.userData.kitStripeUniforms,
      shader=compile(panel.material);
    assert.equal(u.kmStripeSideRadius.value,report.sideRadiusM);
    assert.ok(u.kmStripeTorsoLow.value[0]>0);
    assert.ok(u.kmStripeTorsoHigh.value[1]>0);
    assert.match(shader.vertexShader,/vKmTorsoWorld = \(modelMatrix \* vec4\(position, 1\.0\)\)\.xyz/);
    assert.match(shader.fragmentShader,/float theta=atan\(/);
    assert.match(shader.fragmentShader,/float rearShift=evenBands\*kmStripeWidth-halfArc/);
    assert.doesNotMatch(shader.fragmentShader,/asin\(min\(x\/radius,cap\)\)/);
  }
  for(const panel of [m.sleeve,m.left,m.collar]){
    const u=panel.material.userData.kitStripeUniforms,
      shader=compile(panel.material);
    assert.equal(u.kmStripeSideRadius.value,0);
    assert.equal(u.kmStripeTorsoLow.value[0],0);
    assert.equal(u.kmStripeTorsoHigh.value[1],0);
    assert.doesNotMatch(shader.vertexShader,/vKmTorsoWorld/);
    assert.doesNotMatch(shader.fragmentShader,/vKmTorsoWorld/);
  }
  const z=sections.reference.rz+sections.low.cz,y=sections.low.y;
  for(const width of [.01,.015,.03,.075,.15]){
    assert.ok(Math.abs(flankPhase(0,z,y,sections,width))<1e-7);
    for(const sign of [-1,1]){
      const edge=sign*width/2;
      assert.ok(Math.abs(flankPhase(edge,z,y,sections,width)-edge)<1e-7,
        'Front center stripe edges must keep the actual selected width');
    }
  }
});
test('KM-40 stripes advance through each flank and join front/back',()=>{
  const m=scene(),r=alignOriginalShoulderStripes(m.outfit,m.parts),
    shape=r.report.torsoShoulderStart.torsoSections;
  assert.ok(shape);
  for(const side of [-1,1]){
    const y=shape.low.y,w=.03,low=shape.low;
    const mk=t=>ellipsePoint(side*t,low);
    const samples=[Math.PI/2-.075,Math.PI/2-.025,
      Math.PI/2,Math.PI/2+.025,Math.PI/2+.075]
      .map(theta=>{
        const p=mk(theta);
        return flankPhase(p.x,p.z,y,shape,w);
      });
    const monotonic=side===1?samples:samples.map(x=>-x);
    for(let i=1;i<monotonic.length;i++)
      assert.ok(monotonic[i]>monotonic[i-1],
        'Stripe phase must continue across the real front-to-back side');
    const before=mk(Math.PI/2-.025),after=mk(Math.PI/2+.025);
    assert.ok(Math.abs(before.x-after.x)<.0001,
      'Adversarial points have almost identical X on each side');
    const a=flankPhase(before.x,before.z,y,shape,w),
      b=flankPhase(after.x,after.z,y,shape,w);
    assert.ok(Math.abs(b-a)>.003,
      'XZ mapping must prevent a repeated/folded stripe at the side');
    const at=mk(Math.PI/2);
    assert.ok(Number.isFinite(flankPhase(at.x,at.z,y,shape,w)));
  }
});
test('KM-40 full circumference has no discontinuity at rear center',()=>{
  const m=scene(),r=alignOriginalShoulderStripes(m.outfit,m.parts),
    shape=r.report.torsoShoulderStart.torsoSections;
  assert.ok(shape);
  for(const width of [.01,.015,.03,.075,.15]){
    const high=shape.high;
    const left=ellipsePoint(-Math.PI+1e-6,high),
      right=ellipsePoint(Math.PI-1e-6,high);
    const a=flankPhase(left.x,left.z,left.y,shape,width),
      b=flankPhase(right.x,right.z,right.y,shape,width);
    assert.ok(Math.abs(a+b)<.00001);
    assert.ok(Math.abs(Math.cos(Math.PI*a/width)-1)<1e-5,
      'Rear center band must finish at primary colour');
    assert.ok(Math.abs(Math.cos(Math.PI*b/width)-1)<1e-5);
    assert.ok(Math.abs(Math.cos(Math.PI*a/width)-
      Math.cos(Math.PI*b/width))<1e-7);
  }
});
test('KM-40 taper does not make stripes twist around shoulder or waist',()=>{
  const m=scene(),r=alignOriginalShoulderStripes(m.outfit,m.parts),
    shape=r.report.torsoShoulderStart.torsoSections;
  assert.ok(shape);
  for(const width of [.01,.03,.075,.15])
    for(const theta of [Math.PI/2,Math.PI*.67,Math.PI*.85])
      for(const side of [-1,1]){
        const lo=ellipsePoint(theta*side,shape.low),
          hi=ellipsePoint(theta*side,shape.high),
          a=flankPhase(lo.x,lo.z,lo.y,shape,width),
          b=flankPhase(hi.x,hi.z,hi.y,shape,width);
        assert.ok(Math.abs(a-b)<1e-7,
          'Same normalized angular source curve must carry one vertical stripe');
      }
});
test('KM-39 independent sleeves and untouched original trims, color controls',()=>{
  const m=scene(),store=createKitDesignStore();
  store.selectStyle('vertical-stripes');store.selectStripeWidth(30);
  applyKitDesign(m.outfit,store.getState(),THREE);
  for(const p of [m.sleeve,m.left]){
    assert.equal(p.geometry.getAttribute('kmStripeSewnMetres'),null);
    assert.match(p.material.customProgramCacheKey(),/-plain-exterior$/);
    assert.equal(p.material.userData.kitStripeUniforms.kmStripeSideRadius.value,0);
  }
  const a=m.front.geometry.getAttribute('kmStripeSewnMetres'),
    mask=m.front.geometry.getAttribute('kmJerseyExteriorMask');
  store.selectStripeWidth(150);
  applyKitDesign(m.outfit,store.getState(),THREE);
  assert.equal(m.front.geometry.getAttribute('kmStripeSewnMetres'),a);
  assert.equal(m.front.geometry.getAttribute('kmJerseyExteriorMask'),mask);
  assert.equal(m.front.material.userData.kitStripeUniforms.kmStripeWidth.value,.15);
});
