// KM-29: match phase of original flat-fabric UV stripes at REAL upper
// jersey stitches. Width stays in original cloth metres; no 3D planar
// stripe projection, no UV/geometry mutation, no private model upload.
const CELL=.0015,MAX_GAP=.0027;
const key=(x,y,z)=>x+":"+y+":"+z;
const mid=v=>{const a=[...v].sort((x,y)=>x-y),n=a.length;
  if(!n)throw Error("Empty shoulder seam data");
  return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2;};
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const category=name=>/^FA_jersey__(?:9|10|42|43)(?:_\d+)?$/i.test(name)?"body":
  /^FA_jersey__(?:38|39)(?:_\d+)?$/i.test(name)?"right":
  /^FA_jersey__(?:62|63)(?:_\d+)?$/i.test(name)?"left":null;
function boundaryIndices(geometry){
  const indices=geometry.index,pos=geometry.getAttribute("position");
  if(!indices)return Array.from({length:pos.count},(_,i)=>i);
  const edges=new Map();
  const count=Math.floor(indices.count/3);
  for(let t=0;t<count;t++){
    const ids=[indices.getX(3*t),indices.getX(3*t+1),indices.getX(3*t+2)];
    for(const [a,b] of [[ids[0],ids[1]],[ids[1],ids[2]],[ids[2],ids[0]]]){
      const lo=Math.min(a,b),hi=Math.max(a,b),name=lo+":"+hi;
      if(!edges.has(name))edges.set(name,{a:lo,b:hi,count:1});
      else edges.get(name).count++;
    }
  }
  const open=new Set();
  for(const e of edges.values())if(e.count===1){
    open.add(e.a);open.add(e.b);
  }
  return [...open];
}
function locateSamples(entry){
  const geometry=entry.geometry,p=geometry.getAttribute("position"),
    uv=geometry.getAttribute("uv");
  if(!p||!uv||p.count!==uv.count)return new Map();
  const m=entry.mesh?.matrixWorld?.elements??
    [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const grid=new Map();
  for(const i of boundaryIndices(geometry)){
    if(i<0||i>=p.count)continue;
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const pos=[
      m[0]*x+m[4]*y+m[8]*z+m[12],
      m[1]*x+m[5]*y+m[9]*z+m[13],
      m[2]*x+m[6]*y+m[10]*z+m[14]];
    // Upper shoulder/armhole seam; explicitly exclude waist and cuffs.
    if(pos[1]<1.39||Math.abs(pos[0])<.105)continue;
    const u=uv.getX(i);
    if(!Number.isFinite(u)||!pos.every(Number.isFinite))continue;
    const gridKey=key(...pos.map(x=>Math.round(x/CELL)));
    const point={pos,i,d:(u-entry.metric.originU)*entry.metric.metresPerUv};
    if(!grid.has(gridKey))grid.set(gridKey,[]);
    grid.get(gridKey).push(point);
  }
  return grid;
}
function seamPairs(a,b){
  const found=[],used=new Set();
  for(const [where,points] of a.grid){
    const [x,y,z]=where.split(":").map(Number);
    for(const left of points){
      let candidate=null,gap=MAX_GAP;
      for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)
        for(let dz=-2;dz<=2;dz++)
          for(const right of b.grid.get(key(x+dx,y+dy,z+dz))??[]){
            const d=dist(left.pos,right.pos);
            if(d<gap){gap=d;candidate=right;}
          }
      if(!candidate)continue;
      const identifier=left.pos.map(x=>Math.round(x/.002)).join(":");
      if(used.has(identifier))continue;
      used.add(identifier);
      found.push({a:left.d,b:candidate.d,ai:left.i,bi:candidate.i});
    }
  }
  return found;
}
function fit(pairs,sourceCoords,entry){
  if(pairs.length<8)return null;
  const uv=entry.geometry.getAttribute("uv");
  if(!uv)return null;
  const desired=pairs.map(p=>sourceCoords[p.ai]);
  if(desired.some(v=>!Number.isFinite(v)))return null;
  const span=xs=>Math.max(...xs)-Math.min(...xs);
  if(span(desired)<.018)return null;
  const evaluate=(axis,values)=>{
    if(span(values)<.018)return null;
    let best=null;
    for(const sign of [1,-1]){
      const offsets=values.map((x,i)=>desired[i]-sign*x),
        offset=mid(offsets),
        error=mid(offsets.map(x=>Math.abs(x-offset)));
      if(!best||error+1e-6<best.error)
        best={axis,sign,offset,error,matched:pairs.length};
    }
    return best;
  };
  const horizontal=evaluate("u",pairs.map(p=>p.b));
  // A rotated author pattern can place the across-shoulder direction
  // along V, not U. Its vertical fabric metric remains in metres.
  const scaleV=entry.metric.metresPerUvV??entry.metric.metresPerUv;
  const vertical=evaluate("v",pairs.map(p=>uv.getY(p.bi)*scaleV));
  const valid=[horizontal,vertical].filter(x=>x&&x.error<=.035);
  return valid.sort((a,b)=>a.error-b.error)[0]??null;
}
// KM-30: stitch-accurate intrinsic stripe coordinates. An affine
// UV correction aligns only a median seam phase; genuine curved
// shoulder stitches can require a different correction at each point.
// All source seam vertices inherit the SAME stripe coordinate as their
// corresponding torso vertex. Smooth, bounded phase transport into
// the sewn fabric avoids a stripe break at the join.
function stitchedCoordinates(entry,pairs,fit,sourceCoords){
  const uv=entry.geometry.getAttribute("uv"),length=uv.count;
  const baseline=new Float32Array(length);
  const scaleV=entry.metric.metresPerUvV??entry.metric.metresPerUv;
  for(let i=0;i<length;i++)
    baseline[i]=fit.sign*(fit.axis==="v"?uv.getY(i)*scaleV:
      (uv.getX(i)-entry.metric.originU)*entry.metric.metresPerUv)+fit.offset;
  const byIndex=new Map();
  for(const pair of pairs){
    const wanted=sourceCoords[pair.ai];
    if(!Number.isFinite(wanted)||pair.bi<0||pair.bi>=length)continue;
    const difference=wanted-baseline[pair.bi];
    if(!byIndex.has(pair.bi))byIndex.set(pair.bi,[]);
    byIndex.get(pair.bi).push(difference);
  }
  if(byIndex.size<8)throw Error("Too few genuine sewn stripe anchors");
  const anchors=[...byIndex].map(([i,list])=>({
    i,u:uv.getX(i),v:uv.getY(i),delta:mid(list)
  }));
  if(anchors.some(a=>Math.abs(a.delta)>.08))
    throw Error("Incompatible UV shoulder seam: excessive distortion");
  const direct=new Map(anchors.map(a=>[a.i,a.delta]));
  const sample=anchors.length<=128?anchors:
    anchors.filter((a,i)=>i%Math.ceil(anchors.length/128)===0);
  const result=new Float32Array(length);
  for(let i=0;i<length;i++){
    let correction=direct.get(i);
    if(correction===undefined){
      const u=uv.getX(i),v=uv.getY(i);
      const nearest=[];
      for(const a of sample){
        const d2=(a.u-u)**2+(a.v-v)**2;
        if(nearest.length<4){
          nearest.push({d2,delta:a.delta});
          nearest.sort((a,b)=>a.d2-b.d2);
        }else if(d2<nearest[3].d2){
          nearest[3]={d2,delta:a.delta};
          nearest.sort((a,b)=>a.d2-b.d2);
        }
      }
      let weighted=0,total=0;
      for(const a of nearest){
        const w=1/(a.d2+1e-7);total+=w;weighted+=a.delta*w;
      }
      correction=total?weighted/total:0;
    }
    result[i]=baseline[i]+correction;
  }
  return {values:result,anchors:anchors.length,
    maxSeamCorrectionMm:Math.round(
      1000*Math.max(...anchors.map(a=>Math.abs(a.delta))))};
}

const alignmentCache=new WeakMap();
export function alignOriginalShoulderStripes(outfit,prepared){
  const old=alignmentCache.get(outfit);
  if(old)return old;
  outfit?.updateMatrixWorld?.(true);
  const entries=[],seen=new Set();
  for(const item of prepared){
    const kind=item.part==="jersey"?category(item.meshName):null;
    if(!kind||seen.has(item.geometry))continue;
    seen.add(item.geometry);
    const grid=locateSamples(item);
    if(grid.size>=8)entries.push({...item,kind,grid});
  }
  const solved=new Map(),coordinates=new Map(),
    report={status:"no-seam-match",matches:0,connections:[]};
  const body=entries.filter(x=>x.kind==="body");
  if(body.length){
    const root=body.sort((a,b)=>b.grid.size-a.grid.size)[0];
    solved.set(root.geometry,{sign:1,offset:0});
    const rootUv=root.geometry.getAttribute("uv");
    coordinates.set(root.geometry,Float32Array.from(
      {length:rootUv.count},(_,i)=>
        (rootUv.getX(i)-root.metric.originU)*root.metric.metresPerUv));
    const pairCache=new Map();
    while(solved.size<entries.length){
      let best=null;
      for(let i=0;i<entries.length;i++){
        const a=entries[i],src=solved.get(a.geometry);
        if(!src)continue;
        for(let j=0;j<entries.length;j++){
          const b=entries[j];
          if(solved.has(b.geometry)||a.kind!=="body"&&
              b.kind!=="body"&&a.kind!==b.kind)continue;
          const k=i+":"+j;
          if(!pairCache.has(k))pairCache.set(k,seamPairs(a,b));
          const p=pairCache.get(k),candidate=fit(p,coordinates.get(a.geometry),b);
          if(!candidate)continue;
          const score=candidate.matched/(1+candidate.error*1000);
          if(!best||score>best.score)best={a,b,candidate,score};
        }
      }
      if(!best)break;
      const {a,b,candidate}=best;
      const complete=stitchedCoordinates(b,pairCache.get(
        entries.indexOf(a)+":"+entries.indexOf(b)),
        candidate,coordinates.get(a.geometry));
      solved.set(b.geometry,{axis:candidate.axis,
        sign:candidate.sign,offset:candidate.offset});
      coordinates.set(b.geometry,complete.values);
      report.matches+=candidate.matched;
      report.connections.push({from:a.meshName,to:b.meshName,
        matchedVertices:candidate.matched,
        preciseAnchors:complete.anchors,
        maxSeamCorrectionMm:complete.maxSeamCorrectionMm,
        residualMm:Math.round(candidate.error*1000),
        mirroredUV:candidate.sign===-1,
        seamAcrossUvAxis:candidate.axis.toUpperCase()});
    }
    if(report.matches)report.status="aligned";
  }
  const adjustments=new Map();
  for(const item of entries){
    const x=solved.get(item.geometry);
    if(!x||x.axis==="v")continue;
    const metresPerUv=item.metric.metresPerUv*x.sign;
    adjustments.set(item.geometry,{
      metresPerUv,
      originU:item.metric.originU-x.offset/metresPerUv
    });
  }
  // No spurious attribute when a source has no trustworthy seams.
  if(report.status!=="aligned")coordinates.clear();
  const result={adjustments,coordinates,report};
  alignmentCache.set(outfit,result);
  return result;
}
