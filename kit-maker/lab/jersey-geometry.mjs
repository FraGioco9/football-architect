// KM-03A — first neutral white short-sleeve football jersey.
// Garment is separate from the approved 180 cm CC0 SkinnedMesh.
// The mannequin is held in its approved relaxed static pose; no cloth physics.
export const JERSEY_SPEC=Object.freeze({
  torsoHemY:.945,
  torsoShoulderY:1.435,
  torsoRings:28,
  circumferenceSegments:56,
  clearanceM:.019,
  centerZ:.020,
  sleeveLengthFraction:.67,
  baseColor:0xf4f5f2,
  trimColor:0xe8e9e6
});
const TAU=Math.PI*2;
function clamp(x,min,max){return Math.max(min,Math.min(max,x));}
function at(row,side,count){return row*count+((side%count)+count)%count;}
function n(value){return Number.isFinite(value);}
export function torsoEnvelope(samples,spec=JERSEY_SPEC){
  // A radial outer envelope avoids forcing an ideal cylinder over the
  // anatomical chest and abdomen. Only torso-weighted skinned vertices enter.
  const {torsoRings:rows,circumferenceSegments:sides,torsoHemY:min,
    torsoShoulderY:max,centerZ,clearanceM}=spec;
  if(!Array.isArray(samples)||samples.length<100)
    throw new Error("Insufficient posed torso surface samples");
  const raw=new Float64Array(rows*sides);
  const step=(max-min)/(rows-1);
  let accepted=0;
  for(const point of samples){
    if(!n(point.x)||!n(point.y)||!n(point.z))continue;
    if(point.y<min-step*1.8||point.y>max+step*1.8)continue;
    const radius=Math.hypot(point.x,point.z-centerZ);
    if(radius<.035||radius>.30)continue;
    const normalized=(Math.atan2(point.x,point.z-centerZ)+TAU)%TAU;
    const angle=Math.round(normalized/TAU*sides)%sides;
    const row=Math.round((point.y-min)/step);
    for(let j=Math.max(0,row-1);j<=Math.min(rows-1,row+1);j++)
      raw[at(j,angle,sides)]=Math.max(raw[at(j,angle,sides)],radius);
    accepted++;
  }
  if(accepted<100)throw new Error("Invalid torso geometry or body pose");
  const radius=new Float32Array(rows*sides);
  for(let row=0;row<rows;row++){
    let sampled=0;
    for(let side=0;side<sides;side++){
      // A local angular maximum preserves clearance on pectorals and back;
      // radial construction avoids sharp per-vertex anatomical indentations.
      let peak=0;
      for(let dj=-1;dj<=1;dj++){
        const rr=clamp(row+dj,0,rows-1);
        for(let dk=-2;dk<=2;dk++)
          peak=Math.max(peak,raw[at(rr,side+dk,sides)]);
      }
      // Arm-socket geometry is weighted to the arms, so at the upper
      // four rings shoulder-facing torso sectors may be unsampled.
      // Inherit the last complete upper-chest ring instead of collapsing
      // these sectors to zero (which would cut into the mannequin).
      if(row>=rows-4){
        let chest=0;
        for(let dk=-2;dk<=2;dk++)
          chest=Math.max(chest,raw[at(rows-5,side+dk,sides)]);
        peak=Math.max(peak,chest*(.95-.03*(row-(rows-5))));
      }
      if(peak>0)sampled++;
      const u=row/(rows-1);
      const waistRelax=.011*Math.pow(1-u,2);
      radius[at(row,side,sides)]=peak+clearanceM+waistRelax;
    }
    if(sampled<sides*.55)throw new Error("Incomplete torso circumference");
  }
  return radius;
}
function buildRingSurface(THREE,{rows,sides,point,material,name}){
  const xyz=[],uv=[],idx=[];
  for(let row=0;row<rows;row++){
    for(let side=0;side<=sides;side++){
      const t=side/sides;
      const p=point(row,side%sides,t);
      if(!p.every(n))throw new Error("Non-finite kit mesh vertex");
      xyz.push(...p);uv.push(t,row/(rows-1));
    }
  }
  const stride=sides+1;
  for(let row=0;row<rows-1;row++){
    for(let side=0;side<sides;side++){
      const a=row*stride+side,b=a+1,c=a+stride,d=c+1;
      idx.push(a,b,c,b,d,c);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(xyz,3));
  geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name=name;
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  return mesh;
}
function sampleMannequinTorso(root,THREE){
  root.updateMatrixWorld(true);
  const found=[];
  const vertex=new THREE.Vector3();
  let skinned=0;
  root.traverse(mesh=>{
    if(!mesh.isSkinnedMesh||!mesh.geometry?.getAttribute("position"))return;
    if(typeof mesh.getVertexPosition!=="function")
      throw new Error("Three.js skinning samples are unavailable");
    skinned++;
    const position=mesh.geometry.getAttribute("position");
    const joints=mesh.geometry.getAttribute("skinIndex");
    const weights=mesh.geometry.getAttribute("skinWeight");
    if(!joints||!weights)throw new Error("The mannequin mesh has no skin weights");
    const bones=mesh.skeleton.bones;
    const excluded=bones.map(b=>/upperarm|lowerarm|forearm|clavicle|shoulder|wrist|hand|finger|thumb|index|middle|ring|pinky/i.test(b.name));
    for(let i=0;i<position.count;i++){
      let arm=0;
      for(let k=0;k<4;k++){
        const joint=joints.getComponent(i,k);
        if(excluded[joint])arm+=weights.getComponent(i,k);
      }
      if(arm>.24)continue;
      mesh.getVertexPosition(i,vertex);
      mesh.localToWorld(vertex);
      root.worldToLocal(vertex);
      if(vertex.y<.91||vertex.y>1.47)continue;
      found.push({x:vertex.x,y:vertex.y,z:vertex.z});
    }
  });
  if(!skinned)throw new Error("The approved rigged mannequin is required");
  return found;
}
function relaxedArmAnchors(root,THREE,side){
  const clean=v=>v.toLowerCase().replace(/[^a-z0-9]/g,"");
  let upper=null,elbow=null;
  root.traverse(node=>{
    if(!node.isBone)return;
    const key=clean(node.name);
    if(key==="upperarm01"+side)upper=node;
    if(key==="lowerarm01"+side)elbow=node;
  });
  if(!upper||!elbow)throw new Error("Missing "+side+" upper arm chain");
  const shoulder=root.worldToLocal(upper.getWorldPosition(new THREE.Vector3()));
  const end=root.worldToLocal(elbow.getWorldPosition(new THREE.Vector3()));
  const axis=end.clone().sub(shoulder);
  if(axis.length()<.20||axis.length()>.38)
    throw new Error("Unexpected mannequin upper arm length");
  return {shoulder,axis};
}
export function createNeutralShortSleeveJersey(root,THREE){
  if(!root?.traverse||!THREE?.BufferGeometry)
    throw new Error("Jersey requires a loaded rigged Three.js mannequin");
  if(root.getObjectByName("km03-neutral-jersey"))
    throw new Error("A jersey is already attached to this mannequin");
  const samples=sampleMannequinTorso(root,THREE);
  const spec=JERSEY_SPEC;
  const radius=torsoEnvelope(samples,spec);
  const sides=spec.circumferenceSegments,rows=spec.torsoRings;
  const garment=new THREE.Group();
  garment.name="km03-neutral-jersey";
  const cloth=new THREE.MeshStandardMaterial({
    color:spec.baseColor,metalness:0,roughness:.93,side:THREE.DoubleSide
  });
  const trim=new THREE.MeshStandardMaterial({
    color:spec.trimColor,metalness:0,roughness:.90,side:THREE.DoubleSide
  });
  // Torso surface: hem flares slightly, while the scanned chest/back
  // silhouette controls the garment clearance all around the circumference.
  const torso=buildRingSurface(THREE,{rows,sides,name:"km03-jersey-torso",
    material:cloth,point:(row,angle)=>{
      const theta=angle/sides*TAU;
      const y=spec.torsoHemY+(spec.torsoShoulderY-spec.torsoHemY)*row/(rows-1);
      const r=radius[at(row,angle,sides)];
      return [Math.sin(theta)*r,y,spec.centerZ+Math.cos(theta)*r];
    }});
  garment.add(torso);
  // Shoulder panels continue the torso into an actual open neckline.
  const neck=(angle)=>{
    const t=angle/sides*TAU;
    const front=Math.cos(t);
    return [Math.sin(t)*.098,front>=0?1.502:1.522,
      .017+Math.cos(t)*.106];
  };
  const shoulder=buildRingSurface(THREE,{rows:9,sides,name:"km03-jersey-shoulders",
    material:cloth,point:(row,angle)=>{
      const f=row/8,theta=angle/sides*TAU;
      const outer=radius[at(rows-1,angle,sides)];
      const x0=Math.sin(theta)*outer,z0=spec.centerZ+Math.cos(theta)*outer;
      const inner=neck(angle);
      const ease=f*f*(3-2*f);
      return [x0+(inner[0]-x0)*f,
        spec.torsoShoulderY+(inner[1]-spec.torsoShoulderY)*ease,
        z0+(inner[2]-z0)*f];
    }});
  garment.add(shoulder);
  // Rounded collar piping, separate from both the shirt and the skin.
  garment.add(buildRingSurface(THREE,{rows:3,sides,name:"km03-collar-rib",
    material:trim,point:(row,angle)=>{
      const p=neck(angle),f=row/2;
      return [p[0]*(1-.065*f),p[1]+.003+f*.002,
        .017+(p[2]-.017)*(1-.065*f)];
    }}));
  // Sleeve axis follows each posed upperarm01 -> lowerarm01 bone chain.
  // The open cuff stops well above the elbow and remains separate from skin.
  for(const side of ["l","r"]){
    const {shoulder,axis}=relaxedArmAnchors(root,THREE,side);
    const normal=axis.clone().normalize();
    const xaxis=new THREE.Vector3(0,0,1).cross(normal).normalize();
    const zaxis=normal.clone().cross(xaxis).normalize();
    const sleevePoint=(row,angle,cuff=false)=>{
      const fraction=row/12;
      const t=(.01+spec.sleeveLengthFraction*fraction);
      const origin=shoulder.clone().addScaledVector(axis,t);
      const r=.127-.057*fraction+(cuff?.0015:0);
      const theta=angle/sides*TAU;
      return origin.addScaledVector(xaxis,Math.cos(theta)*r)
        .addScaledVector(zaxis,Math.sin(theta)*r).toArray();
    };
    garment.add(buildRingSurface(THREE,{rows:13,sides,
      name:"km03-jersey-sleeve-"+side,material:cloth,point:(row,angle)=>sleevePoint(row,angle)}));
    const tip=(row,angle)=>{
      const f=row/2;
      const p=sleevePoint(12,angle,true);
      const shift=normal.clone().multiplyScalar((f-.5)*.012);
      return [p[0]+shift.x,p[1]+shift.y,p[2]+shift.z];
    };
    garment.add(buildRingSurface(THREE,{rows:3,sides,
      name:"km03-jersey-cuff-"+side,material:trim,point:tip}));
  }
  // A narrow hem band provides a visible folded bottom opening.
  garment.add(buildRingSurface(THREE,{rows:3,sides,
    name:"km03-jersey-hem",material:trim,point:(row,angle)=>{
      const t=angle/sides*TAU,r=radius[at(0,angle,sides)]+.0015;
      return [Math.sin(t)*r,spec.torsoHemY+.001+row*.004,
        spec.centerZ+Math.cos(t)*r];
    }}));
  garment.userData.kitMakerJersey={
    version:"KM-03A",color:"neutral-white",separateGeometry:true,
    torsoVertexCount:torso.geometry.getAttribute("position").count,
    sleeves:2,collar:true,hem:true,skinRigUnmodified:true
  };
  root.add(garment);
  return garment;
}
