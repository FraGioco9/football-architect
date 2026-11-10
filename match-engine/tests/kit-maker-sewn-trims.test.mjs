import test from 'node:test';
import assert from 'node:assert/strict';
import {findOriginalSewnTrimFaces} from '../../kit-maker/lab/kit-trim-geometry.mjs';

function tube(name,rings,n=90){
  const points=[],indices=[];
  for(const ring of rings)for(let j=0;j<n;j++){
    const a=2*Math.PI*j/n;
    points.push([ring.x+ring.r*Math.cos(a),ring.y+.005*Math.sin(2*a),
      ring.z+ring.r*Math.sin(a)]);
  }
  for(let row=0;row<rings.length-1;row++)for(let j=0;j<n;j++){
    const a=row*n+j,b=row*n+(j+1)%n,c=(row+1)*n+j,d=(row+1)*n+(j+1)%n;
    indices.push(a,c,b,b,c,d);
  }
  const pos={count:points.length,getX(i){return points[i][0]},
    getY(i){return points[i][1]},getZ(i){return points[i][2]}};
  return {meshName:name,geometry:{index:{count:indices.length,getX(i){return indices[i]}},
    getAttribute(k){return k==='position'?pos:null;}}};
}
test('KM-27 sleeve uses actual seam and folded lip, never a fixed width',()=>{
  const shoulder={x:.195,y:1.46,z:-.029,r:.076},
    join={x:.224,y:1.368,z:-.026,r:.056},
    outer={x:.232,y:1.350,z:-.025,r:.055},
    returnFold={x:.232,y:1.3502,z:-.025,r:.052};
  for(const sign of [-1,1]){
    const flip=p=>({...p,x:p.x*sign});
    const input=[tube('outside',[flip(shoulder),flip(join)]),
      tube('inside',[flip(join),flip(outer),flip(returnFold)])];
    const selection=findOriginalSewnTrimFaces(input,'cuffs');
    assert.ok(selection.triangles>100);
    assert.ok(selection.evidence.modeledFoldDepthM>.008);
    assert.ok(selection.evidence.modeledFoldDepthM<.03);
    assert.ok(selection.selected.get(input[0]).length<
      selection.selected.get(input[1]).length);
  }
});
test('KM-27 waist uses existing lower fold and authored material interface',()=>{
  const top={x:0,y:1.10,z:.013,r:.17},join={x:0,y:.965,z:.013,r:.174},
    lower={x:0,y:.937,z:.013,r:.173},fold={x:0,y:.9372,z:.013,r:.168};
  const input=[tube('outer',[top,join],160),tube('hem',[join,lower,fold],160)];
  const actual=findOriginalSewnTrimFaces(input,'waist');
  assert.ok(actual.triangles>100);
  assert.ok(actual.evidence.lowerFoldPerimeterM>.7);
  assert.ok(actual.evidence.upperSeamVertices>70);
  assert.equal(actual.selected.get(input[0]).length,0,
    'Main shirt must remain its original body colour');
});
test('KM-27 if source lacks a sewn fold, refuses to invent a hem',()=>{
  const a={x:.195,y:1.46,z:-.029,r:.076},
    b={x:.224,y:1.368,z:-.026,r:.056};
  assert.throws(()=>findOriginalSewnTrimFaces([tube('body',[a,b])],'cuffs'),
    /ring|fold|missing|absent/i);
});

function tubeHalf(name,rings,start,n=160){
  const positions=[],indices=[],half=n/2;
  for(const ring of rings)for(let j=0;j<=half;j++){
    const a=2*Math.PI*(start+j)/n;
    positions.push([ring.r*Math.cos(a),ring.y+.004*Math.cos(2*a),
      .013+ring.r*Math.sin(a)]);
  }
  const columns=half+1;
  for(let row=0;row<rings.length-1;row++)for(let j=0;j<half;j++){
    const a=row*columns+j,b=a+1,c=(row+1)*columns+j,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  return {meshName:name,geometry:{index:{
    count:indices.length,getX(i){return indices[i];}},
    getAttribute(key){
      return key==='position'?{
        count:positions.length,getX(i){return positions[i][0];},
        getY(i){return positions[i][1];},getZ(i){return positions[i][2]}
      }:null;
    }
  }};
}
test('KM-28 side seams do not pull the waist trim above its genuine circumferential border',()=>{
  // Front/back panels join vertically up to Y=.995, while the original
  // sewn horizontal hem ends at Y=.965. Both side joins must stay clean.
  const upper=[{y:1.10,r:.17},{y:.995,r:.171},{y:.965,r:.174}],
    lower=[{y:.965,r:.174},{y:.937,r:.173},{y:.9372,r:.169}];
  const panels=[
    tubeHalf('body front',upper,0),tubeHalf('body back',upper,80),
    tubeHalf('hem front',lower,0),tubeHalf('hem back',lower,80)
  ];
  const selected=findOriginalSewnTrimFaces(panels,'waist');
  assert.ok(selected.evidence.excludedVerticalSideEdges>=4,
    'Must exclude original vertical side joins from upper waist seam');
  assert.ok(selected.evidence.upperCircumferentialEdges>100,
    'Preserve real front and back hem circumference');
  assert.ok(selected.evidence.maximumUncoveredAngleRad<.1,
    'Both lateral joins must remain connected without a fabricated band');
  assert.equal(selected.selected.get(panels[0]).length,0,
    'Do not paint a vertical stripe up the front side seam');
  assert.equal(selected.selected.get(panels[1]).length,0,
    'Do not paint a vertical stripe up the back side seam');
  assert.ok(selected.selected.get(panels[2]).length>50,
    'Original front hem remains coloured at both lateral joins');
  assert.ok(selected.selected.get(panels[3]).length>50,
    'Original back hem remains coloured at both lateral joins');
});
