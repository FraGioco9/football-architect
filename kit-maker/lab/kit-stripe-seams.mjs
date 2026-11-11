// KM-40 — seam-continuous front/flank/back circumferential torso stripes.
//
// Front/back share the fitted rig's SIGNED X centerline for their
// exactly centred main stripe. At the flanks a source-fitted X/Z
// ellipse supplies a circumference coordinate rather than a mirrored
// X-only arc: there is no phase reversal on the side seam. The fitted
// lower/upper sections also compensate for normal torso taper.
// Sleeves deliberately keep their OWN original cloth UV patterns.
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

// A correction based only on world X (KM-39's capped asin()) cannot
// carry a stripe around the maximum left/right side: dx/ds approaches
// zero there, so it folds the bands over the flank. We need X AND Z.
// Sample lower original torso cross sections and fit TWO robust ellipses
// at different heights, so the shader can follow the garment taper
// without twisting bands along the sides. Both source panels share
// exactly the same x/z center and cross-section measurements.
function estimateTorsoSections(panels,centerX){
  const bins=new Map();
  for(const panel of panels){
    const points=panel.positions;
    for(let i=0;i<points.length;i+=3){
      const x=points[i],y=points[i+1],z=points[i+2];
      if(y<1.045||y>1.405||!Number.isFinite(x)||!Number.isFinite(z))continue;
      const key=Math.floor(y/.035);
      let record=bins.get(key);
      if(!record){
        record={count:0,minX:Infinity,maxX:-Infinity,
          minZ:Infinity,maxZ:-Infinity,ySum:0,
          front:0,back:0};
        bins.set(key,record);
      }
      record.count++;
      record.ySum+=y;
      record.minX=Math.min(record.minX,x);
      record.maxX=Math.max(record.maxX,x);
      record.minZ=Math.min(record.minZ,z);
      record.maxZ=Math.max(record.maxZ,z);
      if(FRONT.test(panel.item.meshName))record.front++;
      if(BACK.test(panel.item.meshName))record.back++;
    }
  }
  const sections=[...bins.values()].filter(b=>b.count>=16&&b.front>=4&&b.back>=4)
    .map(b=>({
      rx:Math.max(Math.abs(b.minX-centerX),Math.abs(b.maxX-centerX)),
      rz:(b.maxZ-b.minZ)/2,cz:(b.maxZ+b.minZ)/2,
      y:b.ySum/b.count
    }))
    .filter(p=>p.rx>.10&&p.rx<.8&&p.rz>.04&&p.rz<.7)
    .sort((a,b)=>a.y-b.y);
  if(!sections.length)return null;
  // Low/high bins are chosen far enough apart to avoid a single slice
  // driving the phase; source with only one usable bin is valid and
  // uses constant radii rather than a fabricated height gradient.
  const low=sections[Math.floor((sections.length-1)*.15)],
    high=sections[Math.ceil((sections.length-1)*.85)];
  return {low,high,reference:{
    rx:(low.rx+high.rx)/2,rz:(low.rz+high.rz)/2},
    sectionCount:sections.length};
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
    const torsoSections=estimateTorsoSections(panels,rigCenterX);
    const sideRadius=torsoSections?.reference.rx??0;
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
      sideRadiusM:sideRadius,
      sideCorrection:torsoSections?'continuous-front-side-back-ellipse':'disabled-no-suitable-source',
      torsoSections,
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
