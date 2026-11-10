import test from 'node:test';
import assert from 'node:assert/strict';
import {alignOriginalShoulderStripes} from '../../kit-maker/lab/kit-stripe-seams.mjs';

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
  for(const width of [.03,.075,.15]){
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
