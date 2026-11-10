// KM-29: match phase of original flat-fabric UV stripes at REAL upper
// jersey stitches. Width stays in original cloth metres; no 3D planar
// stripe projection, no UV/geometry mutation, no private model upload.
const CELL=.008,MAX_GAP=.0027,WELD=.00002;
const SHOULDER_REFERENCE_SAMPLE_BUDGET=192;
const key=(x,y,z)=>x+":"+y+":"+z;
const mid=v=>{const a=[...v].sort((x,y)=>x-y),n=a.length;
  if(!n)throw Error("Empty shoulder seam data");
  return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2;};
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const category=name=>/^FA_jersey__(?:9|10|42|43)(?:_\d+)?$/i.test(name)?"body":
  /^FA_jersey__(?:38|39)(?:_\d+)?$/i.test(name)?"right":
  /^FA_jersey__(?:62|63)(?:_\d+)?$/i.test(name)?"left":null;
// KM-31: Identify physical triangle boundaries after welding duplicated
// positions. Non-indexed glTF and UV-normal splits are not genuine seams.
function boundaryEdges(geometry){
  const pos=geometry.getAttribute?.("position"),idx=geometry.index;
  if(!pos||pos.count<3)throw Error("Missing source positions");
  const raw=Array.from({length:pos.count},(_,i)=>[
    pos.getX(i),pos.getY(i),pos.getZ(i)]);
  const unique=new Map(),welded=new Int32Array(pos.count);
  for(let i=0;i<raw.length;i++){
    const key=raw[i].map(x=>Math.round(x/WELD)).join(":");
    if(!unique.has(key))unique.set(key,unique.size);
    welded[i]=unique.get(key);
  }
  const edges=new Map(),count=Math.floor((idx?.count??pos.count)/3);
  for(let i=0;i<count;i++){
    const ids=[0,1,2].map(k=>idx?idx.getX(i*3+k):i*3+k);
    if(ids.some(id=>!Number.isInteger(id)||id<0||id>=pos.count))
      throw Error("Malformed source triangle");
    const physical=ids.map(id=>welded[id]);
    if(new Set(physical).size<3)continue;
    for(const [x,y] of [[0,1],[1,2],[2,0]]){
      const lo=Math.min(physical[x],physical[y]),
        hi=Math.max(physical[x],physical[y]),key=lo+":"+hi;
      if(!edges.has(key))edges.set(key,{i:ids[x],j:ids[y],count:1});
      else edges.get(key).count++;
    }
  }
  return {raw,edges:[...edges.values()].filter(e=>e.count===1)};
}
const inShoulder=p=>p[1]>=1.385&&Math.abs(p[0])>=.105;
const gridAt=p=>key(...p.map(x=>Math.floor(x/CELL)));
function locateSamples(entry){
  const geom=entry.geometry,pos=geom.getAttribute?.("position"),
    uv=geom.getAttribute?.("uv");
  if(!pos||!uv||pos.count!==uv.count)
    return {grid:new Map(),samples:[],segmentGrid:new Map(),segments:[]};
  const outline=boundaryEdges(geom);
  const matrix=entry.mesh?.matrixWorld?.elements??
    [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const world=outline.raw.map(([x,y,z])=>[
    matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12],
    matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13],
    matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14]]);
  const samples=new Map(),grid=new Map(),segmentGrid=new Map(),segments=[];
  const get=i=>{
    if(samples.has(i))return samples.get(i);
    const p=world[i],u=uv.getX(i),v=uv.getY(i);
    if(!Number.isFinite(u)||!Number.isFinite(v)||!p.every(Number.isFinite))
      return null;
    const sample={i,pos:p,d:(u-entry.metric.originU)*entry.metric.metresPerUv};
    samples.set(i,sample);
    return sample;
  };
  for(const edge of outline.edges){
    const first=get(edge.i),last=get(edge.j);
    if(!first||!last||!inShoulder(first.pos)||!inShoulder(last.pos))continue;
    const length=dist(first.pos,last.pos);
    if(length<.00004||length>.06)continue;
    const segment={first,last,length};segments.push(segment);
    // Index the FULL line segment in a spatial hash. Different source
    // tessellations can share a continuous seam without shared vertices.
    const lower=first.pos.map((v,i)=>Math.floor(
        (Math.min(v,last.pos[i])-MAX_GAP)/CELL)),
      upper=first.pos.map((v,i)=>Math.floor(
        (Math.max(v,last.pos[i])+MAX_GAP)/CELL));
    for(let x=lower[0];x<=upper[0];x++)
      for(let y=lower[1];y<=upper[1];y++)
        for(let z=lower[2];z<=upper[2];z++){
          const cell=key(x,y,z);
          if(!segmentGrid.has(cell))segmentGrid.set(cell,[]);
          segmentGrid.get(cell).push(segment);
        }
    for(const item of [first,last]){
      const cell=gridAt(item.pos);
      if(!grid.has(cell))grid.set(cell,[]);
      grid.get(cell).push(item);
    }
  }
  return {grid,samples:[...samples.values()],segments,segmentGrid};
}
function seamPairs(source,target,maxSamples=Infinity){
  const pairs=[],seen=new Set();
  const stride=Math.max(1,Math.ceil(target.samples.length/maxSamples));
  for(let i=0;i<target.samples.length;i+=stride){
    const vertex=target.samples[i];
    if(!inShoulder(vertex.pos)||seen.has(vertex.i))continue;
    const candidates=source.segmentGrid.get(gridAt(vertex.pos))??[];
    let nearest,smallest=MAX_GAP;
    for(const edge of candidates){
      const direction=edge.first.pos.map((v,i)=>edge.last.pos[i]-v),
        offset=edge.first.pos.map((v,i)=>vertex.pos[i]-v),
        t=Math.max(0,Math.min(1,
          direction.reduce((sum,x,i)=>sum+x*offset[i],0)/edge.length**2)),
        point=edge.first.pos.map((v,i)=>v+t*direction[i]),
        gap=dist(vertex.pos,point);
      if(gap<smallest){smallest=gap;nearest={edge,t,gap};}
    }
    if(!nearest)continue;
    seen.add(vertex.i);
    pairs.push({ai:nearest.edge.first.i,aj:nearest.edge.last.i,
      bi:vertex.i,b:vertex.d,t:nearest.t,physicalGap:nearest.gap});
  }
  return pairs;
}
const desiredValue=(pair,values)=>
  values[pair.ai]*(1-pair.t)+values[pair.aj]*pair.t;
function fit(pairs,sourceCoords,entry){
  if(pairs.length<8)return null;
  const uv=entry.geometry.getAttribute("uv");
  if(!uv)return null;
  const desired=pairs.map(p=>desiredValue(p,sourceCoords));
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
    const wanted=desiredValue(pair,sourceCoords);
    if(!Number.isFinite(wanted)||pair.bi<0||pair.bi>=length)continue;
    const difference=wanted-baseline[pair.bi];
    if(!byIndex.has(pair.bi))byIndex.set(pair.bi,[]);
    byIndex.get(pair.bi).push({wanted,difference});
  }
  if(byIndex.size<8)throw Error("Too few genuine sewn stripe anchors");
  const anchors=[...byIndex].map(([i,list])=>({
    i,u:uv.getX(i),v:uv.getY(i),
    wanted:mid(list.map(p=>p.wanted)),
    delta:mid(list.map(p=>p.difference))
  }));
  if(anchors.some(a=>Math.abs(a.delta)>.08))
    throw Error("Incompatible UV shoulder seam: excessive distortion");
  const direct=new Map(anchors.map(a=>[a.i,a.delta]));
  // Original glTF may have multiple normal/UV indices at the same
  // physical seam. All duplicates must share the same stripe value.
  const position=entry.geometry.getAttribute("position"),
    duplicates=new Map();
  for(let i=0;i<length;i++){
    const key=[position.getX(i),position.getY(i),position.getZ(i)]
      .map(v=>Math.round(v/WELD)).join(":");
    if(!duplicates.has(key))duplicates.set(key,[]);
    duplicates.get(key).push(i);
  }
  for(const anchor of anchors){
    const key=[position.getX(anchor.i),position.getY(anchor.i),
      position.getZ(anchor.i)].map(v=>Math.round(v/WELD)).join(":");
    for(const i of duplicates.get(key)??[])
      direct.set(i,anchor.wanted-baseline[i]);
  }
  const sample=anchors.length<=128?anchors:
    anchors.filter((a,i)=>i%Math.ceil(anchors.length/128)===0);
  const scaleU=entry.metric.metresPerUv,
    chartScaleV=entry.metric.metresPerUvV??scaleU;
  const result=new Float32Array(length);
  for(let i=0;i<length;i++){
    let correction=direct.get(i);
    if(correction===undefined){
      const u=uv.getX(i),v=uv.getY(i);
      const nearest=[];
      for(const a of sample){
        const d2=((a.u-u)*scaleU)**2+((a.v-v)*chartScaleV)**2;
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
      // Restrict nonlinear corrections to the shoulder area. Elsewhere
      // preserve the artist's flat-fabric stripe width and direction.
      const near=Math.sqrt(nearest[0]?.d2??Infinity),
        attenuation=Math.exp(-Math.pow(near/.045,2));
      correction=total?(weighted/total)*attenuation:0;
    }
    result[i]=baseline[i]+correction;
  }
  return {values:result,anchors:anchors.length,
    maxSeamCorrectionMm:Math.round(
      1000*Math.max(...anchors.map(a=>Math.abs(a.delta))))};
}

// KM-32: establish the FIRST stripe at the actual front/back shoulder
// stitching line, not at an arbitrary per-panel UV island centre.
// A shoulder must span outward from the neck. Reject near-vertical
// side seams and incidental overlapping vertices.
const torsoFace=name=>/^FA_jersey__(?:9|10)(?:_\d+)?$/i.test(name)?"front":
  /^FA_jersey__(?:42|43)(?:_\d+)?$/i.test(name)?"back":null;
function findShoulderReference(entries){
  const front=entries.filter(e=>torsoFace(e.meshName)==="front"),
    back=entries.filter(e=>torsoFace(e.meshName)==="back");
  let best=null;
  for(const source of front)for(const target of back){
    const points=new Map(target.samples.map(p=>[p.i,p]));
    // Front/back reference discovery is sampled and bounded. A complete
    // source-segment match follows ONCE for the selected shoulder seam.
    const candidates=seamPairs(source,target,
      SHOULDER_REFERENCE_SAMPLE_BUDGET),sides=[];
    for(const side of [-1,1]){
      const sidePairs=candidates.filter(p=>{
        const point=points.get(p.bi);
        return point&&side*point.pos[0]>.105&&point.pos[1]>=1.385;
      });
      // Preserve only the uppermost sewn line in each radial slice:
      // side seams can continue vertically below the same X.
      const maxima=new Map();
      for(const p of sidePairs){
        const point=points.get(p.bi),
          slice=Math.floor(Math.abs(point.pos[0])/.008);
        maxima.set(slice,Math.max(maxima.get(slice)??-Infinity,point.pos[1]));
      }
      const shoulder=sidePairs.filter(p=>{
        const point=points.get(p.bi),
          slice=Math.floor(Math.abs(point.pos[0])/.008);
        return point.pos[1]>=maxima.get(slice)-.006;
      });
      const radial=shoulder.map(p=>Math.abs(points.get(p.bi).pos[0])),
        heights=shoulder.map(p=>points.get(p.bi).pos[1]),
        horizontalSpan=Math.max(...radial)-Math.min(...radial),
        verticalSpan=Math.max(...heights)-Math.min(...heights);
      // A shoulder extends predominantly outwards from the neckline.
      // An inclined SIDE seam may move in X too, but rises much more
      // in Y than it progresses outwards.
      if(shoulder.length<8||horizontalSpan<.045||
         horizontalSpan<1.2*verticalSpan)continue;
      sides.push({side,pairs:shoulder,radial});
    }
    if(!sides.length)continue;
    // Both genuine shoulder lines share one torso pattern reference.
    const selected=sides.flatMap(x=>x.pairs),
      strongest=[...sides].sort((a,b)=>b.pairs.length-a.pairs.length)[0];
    const anchor=[...strongest.pairs].sort((a,b)=>
      Math.abs(points.get(a.bi).pos[0])-
      Math.abs(points.get(b.bi).pos[0]))[0];
    const farthest=[...strongest.pairs].sort((a,b)=>
      Math.abs(points.get(b.bi).pos[0])-
      Math.abs(points.get(a.bi).pos[0]))[0];
    const srcUv=source.geometry.getAttribute("uv"),
      authored=i=>(srcUv.getX(i)-source.metric.originU)*
        source.metric.metresPerUv;
    const original=Float32Array.from({length:srcUv.count},
      (_,i)=>authored(i));
    const inner=desiredValue(anchor,original),
      outer=desiredValue(farthest,original),
      direction=outer>=inner?1:-1,
      radialSpan=Math.abs(points.get(farthest.bi).pos[0])-
        Math.abs(points.get(anchor.bi).pos[0]);
    if(radialSpan<.045||Math.abs(outer-inner)<.025)continue;
    const anchorPoint=points.get(anchor.bi).pos;
    const ref={source,target,pairs:selected,direction,origin:inner,
      anchorPoint,
      sides:sides.map(x=>x.side===1?"right":"left"),
      distanceToEdgeM:radialSpan,matched:selected.length};
    if(!best||ref.matched>best.matched)best=ref;
  }
  return best;
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
    const outline=locateSamples(item);
    if(outline.samples.length>=8&&outline.segments.length>=7)
      entries.push({...item,kind,...outline});
  }
  const solved=new Map(),coordinates=new Map(),
    report={status:"no-seam-match",matches:0,connections:[]};
  const body=entries.filter(x=>x.kind==="body");
  const shoulderReference=findShoulderReference(entries);
  report.shoulderReference=shoulderReference?{
    status:"front-back-anchored",
    panels:[shoulderReference.source.meshName,
      shoulderReference.target.meshName],
    side:shoulderReference.sides,
    matchedStitches:shoulderReference.matched,
    innerEdgeZero:true
  }:{status:"not-detected",reason:"No verified front/back shoulder seam"};
  if(body.length){
    // Source front panel is always the root when a genuine upper
    // front/back shoulder seam exists, regardless of mesh order.
    const root=shoulderReference?.source??
      [...body].sort((a,b)=>b.grid.size-a.grid.size)[0];
    const sign=shoulderReference?.direction??1,
      anchor=shoulderReference?.origin??0;
    solved.set(root.geometry,{axis:"u",sign,offset:-sign*anchor});
    const rootUv=root.geometry.getAttribute("uv");
    coordinates.set(root.geometry,Float32Array.from(
      {length:rootUv.count},(_,i)=>sign*
        ((rootUv.getX(i)-root.metric.originU)*
          root.metric.metresPerUv-anchor)));
    const pairCache=new Map();
    // Anchor BACK onto FRONT at every upper shoulder stitch before
    // either sleeve is considered. This fixes both torso stripe starts.
    if(shoulderReference){
      const target=shoulderReference.target,
        source=shoulderReference.source,
        pairs=seamPairs(source,target),
        rootCoordinates=coordinates.get(source.geometry),
        aligned=fit(pairs,rootCoordinates,target);
      if(aligned){
        const mapped=stitchedCoordinates(target,pairs,aligned,rootCoordinates);
        solved.set(target.geometry,{
          axis:aligned.axis,sign:aligned.sign,offset:aligned.offset});
        coordinates.set(target.geometry,mapped.values);
        report.matches+=pairs.length;
        report.connections.push({
          from:source.meshName,to:target.meshName,
          role:"front-back-shoulder-origin",
          matchedVertices:pairs.length,preciseAnchors:mapped.anchors,
          segmentProjected:true,
          maxSeamCorrectionMm:mapped.maxSeamCorrectionMm,
          mirroredUV:aligned.sign===-1,
          seamAcrossUvAxis:aligned.axis.toUpperCase()
        });
        report.shoulderReference.backConnected=true;
      }else{
        report.shoulderReference.status="front-back-seam-found-but-unaligned";
        report.shoulderReference.backConnected=false;
        report.shoulderReference.innerEdgeZero=false;
      }
    }
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
          // Finish joined torso panels before connecting either arm.
          // The shirt's shoulder origin must never depend on sleeve order.
          const torsoPriority=b.kind==="body"?2:1;
          const score=torsoPriority*1e6+
            candidate.matched/(1+candidate.error*1000);
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
        segmentProjected:true,
        medianPhysicalGapMm:Math.round(mid(pairCache.get(
          entries.indexOf(a)+":"+entries.indexOf(b))
          .map(p=>p.physicalGap))*1000),
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
  // Report incomplete original shoulder connections explicitly, so the
  // owner can distinguish a successful fit from UV fallbacks in Chrome.
  report.connectedPanels=entries.filter(e=>solved.has(e.geometry))
    .map(e=>e.meshName);
  report.unmatchedPanels=entries.filter(e=>!solved.has(e.geometry))
    .map(e=>e.meshName);
  report.sleeves={
    right:entries.some(e=>e.kind==="right"&&solved.has(e.geometry)),
    left:entries.some(e=>e.kind==="left"&&solved.has(e.geometry))
  };
  // No spurious attribute when a source has no trustworthy seams.
  if(report.status!=="aligned")coordinates.clear();
  const result={adjustments,coordinates,report};
  alignmentCache.set(outfit,result);
  return result;
}
