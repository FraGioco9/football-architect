// KM-39 — keep author jersey INSIDE neutral, never stripe/color both sides.
// The white-source model contains normals, including inner shell faces.
// Derive an exterior mask from ORIGINAL outward-facing garment normals,
// not UV colours or triangle indexes. Geometry is never rewritten.
const JERSEY=/^FA_jersey__/i;
const RIGHT=/^FA_jersey__(?:38|39)(?:_\d+)?$/i;
const LEFT=/^FA_jersey__(?:62|63)(?:_\d+)?$/i;
const cache=new WeakMap();
function point(position,i,m){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
  return m?[
    m[0]*x+m[4]*y+m[8]*z+m[12],
    m[1]*x+m[5]*y+m[9]*z+m[13],
    m[2]*x+m[6]*y+m[10]*z+m[14]
  ]:[x,y,z];
}
// Compute one inverse-transpose per SOURCE mesh, not per vertex. On
// the 19MB original artist GLB this saves hundreds of thousands of
// repeated cross products during the initial Solid render.
function normalMatrix(m){
  if(!m)return null;
  const a0=m[0],a1=m[1],a2=m[2],
    b0=m[4],b1=m[5],b2=m[6],
    c0=m[8],c1=m[9],c2=m[10],
    ax=b1*c2-b2*c1,ay=b2*c0-b0*c2,az=b0*c1-b1*c0,
    bx=c1*a2-c2*a1,by=c2*a0-c0*a2,bz=c0*a1-c1*a0,
    cx=a1*b2-a2*b1,cy=a2*b0-a0*b2,cz=a0*b1-a1*b0,
    det=a0*ax+a1*ay+a2*az;
  if(Math.abs(det)<1e-10)return null;
  return [ax/det,bx/det,cx/det,
    ay/det,by/det,cy/det,
    az/det,bz/det,cz/det];
}
function outerNormal(normal,i,nm){
  const x=normal.getX(i),y=normal.getY(i),z=normal.getZ(i);
  if(!nm)return [x,y,z];
  return [nm[0]*x+nm[1]*y+nm[2]*z,
    nm[3]*x+nm[4]*y+nm[5]*z,
    nm[6]*x+nm[7]*y+nm[8]*z];
}
function sleeveAxis(entries){
  const samples=[];
  for(const entry of entries){
    const position=entry.geometry.getAttribute?.('position'),
      m=entry.mesh?.matrixWorld?.elements;
    if(!position)continue;
    // Tiny diagnostic sample; independent of jersey stripe UV mapping.
    const stride=Math.max(1,Math.floor(position.count/1000));
    for(let i=0;i<position.count;i+=stride)
      samples.push(point(position,i,m));
  }
  if(samples.length<12)return null;
  const minY=Math.min(...samples.map(p=>p[1])),
    maxY=Math.max(...samples.map(p=>p[1]));
  const span=maxY-minY;
  if(span<.045)return null;
  function endpoint(high){
    const range=samples.filter(p=>high?
      p[1]>=maxY-span*.18:p[1]<=minY+span*.18);
    if(range.length<4)return null;
    const xs=range.map(p=>p[0]),zs=range.map(p=>p[2]);
    return [(Math.min(...xs)+Math.max(...xs))/2,
      (Math.min(...zs)+Math.max(...zs))/2];
  }
  const low=endpoint(false),high=endpoint(true);
  if(!low||!high)return null;
  return {minY,maxY,low,high};
}
function axisPoint(axis,y){
  const t=Math.max(0,Math.min(1,
    (y-axis.minY)/(axis.maxY-axis.minY)));
  return [axis.low[0]+t*(axis.high[0]-axis.low[0]),
    axis.low[1]+t*(axis.high[1]-axis.low[1])];
}
export function classifyOriginalJerseySurfaces(outfit,prepared){
  if(cache.has(outfit))return cache.get(outfit);
  outfit?.updateMatrixWorld?.(true);
  const jersey=prepared.filter(e=>e.part==='jersey'&&JERSEY.test(e.meshName)),
    axes={
      right:sleeveAxis(jersey.filter(e=>RIGHT.test(e.meshName))),
      left:sleeveAxis(jersey.filter(e=>LEFT.test(e.meshName)))
    };
  const cx=outfit?.matrixWorld?.elements?.[12]??0,
    cz=outfit?.matrixWorld?.elements?.[14]??0;
  const masks=new Map(),report={
    status:'source-normals',exteriorVertices:0,
    interiorVertices:0,undeterminedVertices:0,
    missingNormals:[],sleeveAxes:{
      right:Boolean(axes.right),left:Boolean(axes.left)
    }
  };
  for(const entry of jersey){
    if(masks.has(entry.geometry))continue;
    const position=entry.geometry.getAttribute?.('position'),
      normal=entry.geometry.getAttribute?.('normal');
    if(!position||!normal||position.count!==normal.count){
      report.missingNormals.push(entry.meshName);
      continue;
    }
    const group=RIGHT.test(entry.meshName)?'right':
      LEFT.test(entry.meshName)?'left':null,
      axis=group?axes[group]:null,
      m=entry.mesh?.matrixWorld?.elements,
      nm=normalMatrix(m),
      exterior=new Float32Array(position.count);
    for(let i=0;i<position.count;i++){
      const world=point(position,i,m),
        n=outerNormal(normal,i,nm),
        center=axis?axisPoint(axis,world[1]):[cx,cz],
        radialX=world[0]-center[0],
        radialZ=world[2]-center[1],
        radius=Math.hypot(radialX,radialZ),
        length=Math.hypot(...n),
        cosine=radius>1e-5&&length>1e-5
          ?(n[0]*radialX+n[2]*radialZ)/(radius*length):0;
      // Strictly inward-facing original shell normals indicate the
      // shirt lining. In ambiguous folded edges leave the original
      // outside untouched rather than erase details.
      const lining=cosine<-.18;
      exterior[i]=lining?0:1;
      if(lining)report.interiorVertices++;
      else report.exteriorVertices++;
      if(Math.abs(cosine)<=.18)report.undeterminedVertices++;
    }
    masks.set(entry.geometry,exterior);
  }
  const result={masks,report};
  cache.set(outfit,result);
  return result;
}
