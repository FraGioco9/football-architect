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
    const point={pos,d:(u-entry.metric.originU)*entry.metric.metresPerUv};
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
      found.push({a:left.d,b:candidate.d});
    }
  }
  return found;
}
function fit(pairs,source){
  if(pairs.length<8)return null;
  const span=(key)=>Math.max(...pairs.map(p=>p[key]))-Math.min(...pairs.map(p=>p[key]));
  if(span("a")<.018||span("b")<.018)return null;
  let choice;
  for(const sign of [1,-1]){
    const offsets=pairs.map(({a,b})=>source.sign*a+source.offset-sign*b),
      offset=mid(offsets),
      error=mid(offsets.map(x=>Math.abs(x-offset)));
    if(!choice||error+1e-6<choice.error)choice={sign,offset,error};
  }
  if(choice.error>.015)return null;
  return {...choice,matched:pairs.length};
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
  const solved=new Map(),report={status:"no-seam-match",matches:0,connections:[]};
  const body=entries.filter(x=>x.kind==="body");
  if(body.length){
    const root=body.sort((a,b)=>b.grid.size-a.grid.size)[0];
    solved.set(root.geometry,{sign:1,offset:0});
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
          const p=pairCache.get(k),candidate=fit(p,src);
          if(!candidate)continue;
          const score=candidate.matched/(1+candidate.error*1000);
          if(!best||score>best.score)best={a,b,candidate,score};
        }
      }
      if(!best)break;
      const {a,b,candidate}=best;
      solved.set(b.geometry,{sign:candidate.sign,offset:candidate.offset});
      report.matches+=candidate.matched;
      report.connections.push({from:a.meshName,to:b.meshName,
        matchedVertices:candidate.matched,
        residualMm:Math.round(candidate.error*1000),
        mirroredUV:candidate.sign===-1});
    }
    if(report.matches)report.status="aligned";
  }
  const adjustments=new Map();
  for(const item of entries){
    const x=solved.get(item.geometry);
    if(!x)continue;
    const metresPerUv=item.metric.metresPerUv*x.sign;
    adjustments.set(item.geometry,{
      metresPerUv,
      originU:item.metric.originU-x.offset/metresPerUv
    });
  }
  const result={adjustments,report};
  alignmentCache.set(outfit,result);
  return result;
}
