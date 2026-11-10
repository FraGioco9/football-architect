// KM-27: select faces between actual authored crease/seam rings.
// No artist bytes leave the browser and no fixed colour-band width is used.
const TAU=Math.PI*2;
const diff=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const magnitude=a=>Math.hypot(...a);
const unit=a=>{const m=magnitude(a);if(m<1e-5)throw Error("Degenerate source ring direction");return a.map(x=>x/m);};
const mean=points=>[0,1,2].map(i=>points.reduce((s,p)=>s+p[i],0)/points.length);
const DEFAULT_MATRIX=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const transform=(p,m)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
  m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],
  m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
function topology(entries,zone){
  if(!entries.length)throw Error("No source garment panels");
  const geoms=[];let minY=Infinity;
  for(const entry of entries){
    const pos=entry.geometry?.getAttribute?.("position");
    if(!pos||pos.count<3)throw Error("Original position attribute missing");
    const matrix=entry.mesh?.matrixWorld?.elements??DEFAULT_MATRIX,positions=[];
    for(let i=0;i<pos.count;i++){
      const p=transform([pos.getX(i),pos.getY(i),pos.getZ(i)],matrix);
      if(!p.every(Number.isFinite))throw Error("Nonfinite original source point");
      positions.push(p);minY=Math.min(minY,p[1]);
    }
    geoms.push({entry,positions});
  }
  const welded=new Map(),points=[],edges=new Map(),triangles=[];
  const identify=p=>{const key=p.map(v=>Math.round(v*50000)).join(",");
    if(!welded.has(key)){welded.set(key,points.length);points.push(p);}
    return welded.get(key);
  };
  for(const {entry,positions} of geoms){
    const index=entry.geometry.index,count=Math.floor((index?.count??positions.length)/3);
    for(let tri=0;tri<count;tri++){
      const indices=[0,1,2].map(k=>index?index.getX(3*tri+k):3*tri+k);
      if(indices.some(i=>!Number.isInteger(i)||i<0||i>=positions.length))
        throw Error("Invalid original garment index");
      const pp=indices.map(i=>positions[i]),centre=mean(pp);
      if(zone==="waist"&&centre[1]>minY+.09)continue;
      const a=diff(pp[1],pp[0]),b=diff(pp[2],pp[0]),
        cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
        size=magnitude(cross);
      if(size<1e-12)continue;
      const faceNormal=cross.map(v=>v/size),ids=pp.map(identify);
      if(new Set(ids).size!==3)continue;
      triangles.push({entry,tri,centre});
      for(const [v,w] of [[ids[0],ids[1]],[ids[1],ids[2]],[ids[2],ids[0]]]){
        const lo=Math.min(v,w),hi=Math.max(v,w),key=lo+":"+hi;
        let edge=edges.get(key);
        if(!edge){edge={a:lo,b:hi,faces:[]};edges.set(key,edge);}
        if(edge.faces.length<3)edge.faces.push({entry,normal:faceNormal});
      }
    }
  }
  const opens=[],seams=[],folds=[];
  for(const edge of edges.values()){
    if(edge.faces.length===1)opens.push(edge);
    if(edge.faces.length===2){
      const [a,b]=edge.faces;
      if(a.entry!==b.entry)seams.push(edge);
      if(dot(a.normal,b.normal)<.70710678)folds.push(edge);
    }
  }
  return {points,triangles,opens,seams,folds,minY};
}
function connectedRings(edges,points){
  const adjacent=new Map();
  edges.forEach((edge,i)=>{for(const v of [edge.a,edge.b]){
    if(!adjacent.has(v))adjacent.set(v,[]);
    adjacent.get(v).push(i);
  }});
  const seen=new Set(),components=[];
  for(let i=0;i<edges.length;i++){
    if(seen.has(i))continue;
    seen.add(i);const todo=[i],vertices=new Set(),members=[];
    while(todo.length){
      const e=edges[todo.pop()];members.push(e);
      for(const v of [e.a,e.b]){
        vertices.add(v);
        for(const next of adjacent.get(v)??[])
          if(!seen.has(next)){seen.add(next);todo.push(next);}
      }
    }
    if(members.length<12)continue;
    const raw=[...vertices].map(v=>points[v]);
    components.push({closed:[...vertices].every(v=>adjacent.get(v).length===2),
      coords:raw,center:mean(raw),
      perimeter:members.reduce((total,e)=>total+magnitude(diff(points[e.a],points[e.b])),0)});
  }
  return components;
}
function ringProfile(raw,theta,coordinate){
  const data=raw.map(p=>({t:(theta(p)+TAU)%TAU,v:coordinate(p)}))
    .sort((a,b)=>a.t-b.t),out=[];
  for(const p of data){
    const last=out.at(-1);
    if(last&&Math.abs(p.t-last.t)<1e-6){
      last.v=(last.v*last.n+p.v)/(last.n+1);last.n++;
    }else out.push({...p,n:1});
  }
  if(out.length<12)throw Error("Incomplete original sewn contour");
  return out;
}
function valueAt(profile,theta){
  const x=(theta+TAU)%TAU;
  let lo=0,hi=profile.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(profile[mid].t<x)lo=mid+1;else hi=mid;}
  let a,b,q=x;
  if(lo===0||lo===profile.length){
    a=profile.at(-1);b={...profile[0],t:profile[0].t+TAU};
    if(lo===0)q+=TAU;
  }else{a=profile[lo-1];b=profile[lo];}
  const span=b.t-a.t;
  return span<1e-10?a.v:a.v+(b.v-a.v)*(q-a.t)/span;
}
function cuffBetween(g){
  const seam=connectedRings(g.seams,g.points).filter(l=>
    l.closed&&l.perimeter>.25&&l.perimeter<.46);
  const shoulders=connectedRings(g.opens,g.points).filter(l=>
    l.closed&&l.perimeter>.37&&l.perimeter<.65);
  const crease=connectedRings(g.folds,g.points).filter(l=>
    l.closed&&l.perimeter>.25&&l.perimeter<.46);
  if(!seam.length||!shoulders.length||!crease.length)
    throw Error("Author cuff seam, opening or folded edge missing");
  const shoulder=shoulders.sort((a,b)=>b.center[1]-a.center[1])[0];
  const inner=seam.filter(l=>l.center[1]<shoulder.center[1]-.035)
    .sort((a,b)=>a.center[1]-b.center[1])[0];
  if(!inner)throw Error("Author distal cuff seam absent");
  const direction=unit(diff(inner.center,shoulder.center));
  const outer=crease.map(l=>({...l,d:dot(diff(l.center,inner.center),direction)}))
    .filter(l=>l.d>.006&&l.d<.05&&Math.abs(l.perimeter-inner.perimeter)<.07)
    .sort((a,b)=>b.d-a.d)[0];
  if(!outer)throw Error("Author cuff outer fold absent");
  const u=unit([-direction[1],direction[0],0]),
    v=[direction[1]*u[2]-direction[2]*u[1],
      direction[2]*u[0]-direction[0]*u[2],
      direction[0]*u[1]-direction[1]*u[0]];
  const theta=p=>{const rel=diff(p,inner.center);return Math.atan2(dot(rel,v),dot(rel,u));};
  const coordinate=p=>dot(diff(p,inner.center),direction);
  const start=ringProfile(inner.coords,theta,coordinate),
    end=ringProfile(outer.coords,theta,coordinate);
  return {includes:p=>{
    const a=theta(p),min=valueAt(start,a),max=valueAt(end,a),x=coordinate(p);
    return max-min>.004&&x>=min-.0004&&x<=max+.0004;
  },evidence:{innerPerimeterM:inner.perimeter,outerPerimeterM:outer.perimeter,
      modeledFoldDepthM:outer.d}};
}
function waistBetween(g){
  const ring=connectedRings(g.folds,g.points).filter(l=>
    l.closed&&l.perimeter>.7&&l.perimeter<1.35&&l.center[1]<g.minY+.04)
    .sort((a,b)=>a.center[1]-b.center[1])[0];
  if(!ring)throw Error("Original lower waist fold ring missing");
  const theta=p=>Math.atan2(p[2]-ring.center[2],p[0]-ring.center[0]),
    low=ringProfile(ring.coords,theta,p=>p[1]);
  const seamEdges=g.seams.filter(e=>{
    const y=(g.points[e.a][1]+g.points[e.b][1])/2;
    return y>ring.center[1]+.005&&y<ring.center[1]+.075;
  });
  const vertices=new Set();
  for(const edge of seamEdges){vertices.add(edge.a);vertices.add(edge.b);}
  if(vertices.size<35)throw Error("Original upper waist seam missing");
  const high=ringProfile([...vertices].map(i=>g.points[i]),theta,p=>p[1]);
  let gap=0;
  for(let i=0;i<high.length;i++){
    const next=high[(i+1)%high.length].t+(i===high.length-1?TAU:0);
    gap=Math.max(gap,next-high[i].t);
  }
  if(gap>.85)throw Error("Original waist seam incomplete; no fabricated hem");
  return {includes:p=>{
    const t=theta(p),a=valueAt(low,t),b=valueAt(high,t);
    return b-a>.004&&b-a<.065&&p[1]>=a-.0004&&p[1]<=b+.0004;
  },evidence:{lowerFoldPerimeterM:ring.perimeter,upperSeamVertices:vertices.size,
      maximumUncoveredAngleRad:gap}};
}
export function findOriginalSewnTrimFaces(entries,region){
  if(!Array.isArray(entries)||(region!=="cuffs"&&region!=="waist"))
    throw Error("Invalid topology trim request");
  const mesh=topology(entries,region),
    mask=region==="cuffs"?cuffBetween(mesh):waistBetween(mesh),
    selected=new Map(entries.map(entry=>[entry,[]]));
  for(const triangle of mesh.triangles)
    if(mask.includes(triangle.centre))
      selected.get(triangle.entry).push(triangle.tri);
  const total=[...selected.values()].reduce((n,a)=>n+a.length,0);
  if(total<30)throw Error("No actual source trim faces isolated");
  return {selected,triangles:total,evidence:mask.evidence};
}
