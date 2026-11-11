// KM-38 — centered, signed, straight torso stripes; autonomous sleeves.
//
// Both torso sides use the same SIGNED world-X reference at the rig's
// central vertical axis. KM-37 mistakenly used abs(X)-shoulderRadius,
// making the center stripe phase arbitrary and creating a nonaffine
// interpolation cusp in triangles straddling X=0. The signed field is
// linear across the front/back, so the central primary-colour stripe
// is exactly one selected band wide and the neighbouring bands have
// the same pitch at every height. Both sleeve patterns intentionally keep their original
// independent cloth UVs and do not inherit a torso seam/phase.
//
// Read-only source geometry sampling; no GLB, vertex, UV, normal, or
// source material mutation. Renderer adds one scalar shader attribute
// to body meshes only, preserving the original artist's geometry.
const TORSO=/^FA_jersey__(?:9|10|42|43)(?:_\d+)?$/i;
const FRONT=/^FA_jersey__(?:9|10)(?:_\d+)?$/i;
const BACK=/^FA_jersey__(?:42|43)(?:_\d+)?$/i;
const SLEEVE=/^FA_jersey__(?:38|39|62|63)(?:_\d+)?$/i;
const HEIGHT_MIN=1.385,NECK_RADIUS_MIN=.095,RADIAL_CELL=.008;
const cache=new WeakMap();

function worldPoint(pos,i,m){
  const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
  if(!m)return [x,y,z];
  return [
    m[0]*x+m[4]*y+m[8]*z+m[12],
    m[1]*x+m[5]*y+m[9]*z+m[13],
    m[2]*x+m[6]*y+m[10]*z+m[14]
  ];
}

function torsoPanel(item){
  const pos=item.geometry?.getAttribute?.('position');
  if(!pos||!pos.count)return null;
  const matrix=item.mesh?.matrixWorld?.elements;
  const positions=new Float32Array(pos.count*3);
  // Uppermost physical source position in each radial slice. Picking
  // only the top envelope prevents an inclined side seam or broad
  // lower torso panel from moving the shoulder-side origin.
  const topByRadial=new Map();
  for(let i=0;i<pos.count;i++){
    const [x,y,z]=worldPoint(pos,i,matrix);
    if(![x,y,z].every(Number.isFinite))
      throw Error('Non-finite original torso geometry');
    positions[i*3]=x;positions[i*3+1]=y;positions[i*3+2]=z;
    const radial=Math.abs(x);
    if(radial<NECK_RADIUS_MIN||y<HEIGHT_MIN)continue;
    const key=Math.floor(radial/RADIAL_CELL);
    const previous=topByRadial.get(key);
    if(!previous||y>previous.y)topByRadial.set(key,{x,y});
  }
  const top=[...topByRadial.values()];
  if(top.length<8)return {item,positions,validShoulder:false};
  const xs=top.map(p=>Math.abs(p.x)),ys=top.map(p=>p.y);
  const dx=Math.max(...xs)-Math.min(...xs),
    dy=Math.max(...ys)-Math.min(...ys);
  return {item,positions,
    validShoulder:dx>=.045&&dx>=1.2*dy,
    radialMin:Math.min(...xs),
    sampledShoulderPoints:top.length};
}

export function alignOriginalShoulderStripes(outfit,prepared){
  const previous=cache.get(outfit);
  if(previous)return previous;
  outfit?.updateMatrixWorld?.(true);
  const panels=[],seen=new Set(),sleeves=[];
  for(const item of prepared){
    if(item.part!=='jersey')continue;
    if(SLEEVE.test(item.meshName)){
      sleeves.push(item.meshName);
      continue;
    }
    if(!TORSO.test(item.meshName)||seen.has(item.geometry))continue;
    seen.add(item.geometry);
    const panel=torsoPanel(item);
    if(panel)panels.push(panel);
  }
  const referenceFront=panels.filter(p=>FRONT.test(p.item.meshName)&&p.validShoulder),
    referenceBack=panels.filter(p=>BACK.test(p.item.meshName)&&p.validShoulder);
  const coordinates=new Map(),adjustments=new Map(),
    report={status:'no-common-shoulder-start',
      matches:0,connections:[],connectedPanels:[],
      unmatchedPanels:panels.map(p=>p.item.meshName),
      sleeves:{mode:'independent-source-uv',panels:sleeves},
      shoulderReference:{status:'not-used',
        reason:'Sleeve seams are intentionally independent of torso stripes'}};
  if(referenceFront.length&&referenceBack.length){
    // Use the ORIGINAL rig centerline instead of starting at the
    // shoulder radius. The shader's cos(pi * x / width) centers ONE
    // full primary-colour band on x=0 for all allowed stripe widths.
    // Signed coordinates also interpolate continuously over triangles
    // spanning the midline; abs(x) created a false plateau there.
    const rigCenterX=outfit?.matrixWorld?.elements?.[12]??0;
    if(!Number.isFinite(rigCenterX))
      throw Error('Invalid original kit torso centerline');
    const shoulderRadius=Math.min(...[...referenceFront,...referenceBack]
      .map(p=>p.radialMin));
    for(const panel of panels){
      const result=new Float32Array(panel.positions.length/3);
      for(let i=0;i<result.length;i++)
        result[i]=panel.positions[i*3]-rigCenterX;
      coordinates.set(panel.item.geometry,result);
    }
    report.status='torso-straight';
    // The two torso sides share physical X, but that does not imply
    // their author mesh has a verified stitched topological edge.
    report.mappedTorsoPanels=panels.map(p=>p.item.meshName);
    report.unmatchedPanels=[];
    report.torsoShoulderStart={
      status:'shared-centered-torso-axis',
      method:'signed-source-world-x',
      centerWorldXM:Math.round(rigCenterX*10000)/10000,
      collarSideReferenceRadialM:Math.round(shoulderRadius*10000)/10000,
      centerStripe:'base-color-full-width',
      continuousAcrossMidline:true,
      sourcePanels:panels.map(p=>p.item.meshName),
      noVerticalBlend:true
    };
  }else{
    report.torsoShoulderStart={
      status:'not-detected',
      reason:'Original source has no recognizable front/back shoulder envelope'
    };
  }
  const output={coordinates,adjustments,report};
  cache.set(outfit,output);
  return output;
}
