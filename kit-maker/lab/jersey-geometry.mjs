// KM-03E — anatomy-matched rounded shoulders on the connected slim jersey.
// Garment is separate from the approved 180 cm CC0 SkinnedMesh.
// The mannequin is held in its approved relaxed static pose; no cloth physics.
export const JERSEY_SPEC=Object.freeze({
  torsoHemY:.945,
  torsoShoulderY:1.435,
  torsoRings:28,
  circumferenceSegments:56,
  clearanceM:.006,
  centerZ:.020,
  sleeveLengthFraction:.67,
  sleeveEaseM:.0035,
  necklineFrontY:1.562,
  necklineBackY:1.579,
  necklineHalfWidth:.074,
  necklineCenterZ:.048,
  necklineDepth:.080,
  collarRiseM:.010,
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
        for(let dk=-1;dk<=1;dk++)
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
        peak=Math.max(peak,chest*(.985-.008*(row-(rows-5))));
      }
      if(peak>0)sampled++;
      const u=row/(rows-1);
      const waistRelax=.002*Math.pow(1-u,2);
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


function sampleMannequinUpperBody(root,THREE){
  // Include real deltoids, shoulders, clavicles and trapezius.
  // The torso fitter deliberately ignores their weights and cannot shape
  // the top of the jersey; this separate scan retains them.
  root.updateMatrixWorld(true);
  const points=[],vertex=new THREE.Vector3();
  root.traverse(mesh=>{
    if(!mesh.isSkinnedMesh||!mesh.geometry?.getAttribute("position"))return;
    if(typeof mesh.getVertexPosition!=="function")
      throw new Error("Skinning samples required for shoulder fit");
    const count=mesh.geometry.getAttribute("position").count;
    for(let i=0;i<count;i++){
      mesh.getVertexPosition(i,vertex);
      mesh.localToWorld(vertex);
      root.worldToLocal(vertex);
      if(vertex.y>=1.38&&vertex.y<=1.595&&
        Math.abs(vertex.x)<.34&&Math.abs(vertex.z)<.24)
        points.push({x:vertex.x,y:vertex.y,z:vertex.z});
    }
  });
  return points;
}
export function shoulderSkinEnvelope(points,spec=JERSEY_SPEC){
  // Actual posed skin envelope in horizontal slices. A 1-ring search
  // tolerates the sparse triangles of a real GLB without inventing a
  // cylindrical shoulder. Missing skin leaves the fitted torso unchanged.
  const minY=1.38,maxY=1.595,bands=24,sides=spec.circumferenceSegments;
  const grid=new Float32Array(bands*sides);
  const step=(maxY-minY)/(bands-1);
  let accepted=0;
  for(const p of points){
    if(!n(p.x)||!n(p.y)||!n(p.z)||p.y<minY||p.y>maxY)continue;
    const radius=Math.hypot(p.x,p.z-spec.centerZ);
    if(radius<.028||radius>.335)continue;
    const theta=(Math.atan2(p.x,p.z-spec.centerZ)+TAU)%TAU;
    const row=clamp(Math.round((p.y-minY)/step),0,bands-1);
    const side=Math.round(theta/TAU*sides)%sides;
    grid[at(row,side,sides)]=Math.max(grid[at(row,side,sides)],radius);
    accepted++;
  }
  return Object.freeze({
    accepted,
    radiusAt(y,side){
      if(!n(y)||y<minY||y>maxY)return 0;
      const row=clamp(Math.round((y-minY)/step),0,bands-1);
      let peak=0;
      for(let dr=-1;dr<=1;dr++)for(let ds=-1;ds<=1;ds++)
        peak=Math.max(peak,grid[at(clamp(row+dr,0,bands-1),
          side+ds,sides)]);
      return peak;
    }
  });
}

function sampleMannequinArm(root,THREE,side){
  // Read the deformed arm itself, never a nominal sleeve cylinder. Only
  // upper/lower-arm weights of the requested side qualify; torso, fingers
  // and the opposite arm cannot increase the sleeve's radius.
  const samples=[],vertex=new THREE.Vector3();
  const sidePattern=new RegExp("(?:upperarm|lowerarm|forearm)[a-z0-9]*"+side+"$");
  root.traverse(mesh=>{
    if(!mesh.isSkinnedMesh||!mesh.geometry?.getAttribute("position"))return;
    const position=mesh.geometry.getAttribute("position");
    const joints=mesh.geometry.getAttribute("skinIndex");
    const weights=mesh.geometry.getAttribute("skinWeight");
    if(!joints||!weights||typeof mesh.getVertexPosition!=="function")return;
    const armBones=mesh.skeleton.bones.map(b=>
      sidePattern.test(b.name.toLowerCase().replace(/[^a-z0-9]/g,"")));
    for(let i=0;i<position.count;i++){
      let influence=0;
      for(let k=0;k<4;k++)
        if(armBones[joints.getComponent(i,k)])
          influence+=weights.getComponent(i,k);
      if(influence<.42)continue;
      mesh.getVertexPosition(i,vertex);
      mesh.localToWorld(vertex);
      root.worldToLocal(vertex);
      samples.push({x:vertex.x,y:vertex.y,z:vertex.z});
    }
  });
  return samples;
}
export function fittedSleeveRadii(samples,shoulder,axis,{rows=13,lengthFraction=.67,easeM=.0035}={}){
  // One sleeve ring per station along the *posed* shoulder/elbow axis.
  // Robust 97th-percentile cross-sections prevent stray skin vertices
  // from producing a ball-shaped sleeve or pinching the arm.
  const length=Math.hypot(axis.x,axis.y,axis.z);
  if(!(length>.15&&length<.40)||rows<3||!Number.isInteger(rows))
    throw new Error("Invalid posed sleeve rig");
  const unit=[axis.x/length,axis.y/length,axis.z/length];
  const radii=[];
  for(let row=0;row<rows;row++){
    const f=row/(rows-1),distance=length*(.055+lengthFraction*f);
    const section=[];
    for(const p of samples){
      if(!n(p.x)||!n(p.y)||!n(p.z))continue;
      const dx=p.x-shoulder.x,dy=p.y-shoulder.y,dz=p.z-shoulder.z;
      const axial=dx*unit[0]+dy*unit[1]+dz*unit[2];
      if(Math.abs(axial-distance)>.036)continue;
      const squared=Math.max(0,dx*dx+dy*dy+dz*dz-axial*axial);
      const radial=Math.sqrt(squared);
      if(radial>.023&&radial<.125)section.push(radial);
    }
    section.sort((a,b)=>a-b);
    // The fallback is only for a deficient synthetic/test mesh; production
    // obtains dimensions from the actual skin-weighted upper-arm samples.
    const fallback=.055-.008*f;
    const skin=section.length>=5?section[Math.ceil((section.length-1)*.97)]:fallback;
    radii.push(clamp(skin+easeM+.0015*(1-f)*(1-f),.038,.084));
  }
  // Fill narrow sampled valleys without smoothing a protrusion into skin.
  return radii.map((r,i)=>clamp(Math.max(r,
    (radii[Math.max(0,i-1)]+2*r+radii[Math.min(rows-1,i+1)])/4),.038,.084));
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
  const shoulderSkin=shoulderSkinEnvelope(sampleMannequinUpperBody(root,THREE),spec);
  const sides=spec.circumferenceSegments,rows=spec.torsoRings;
  const garment=new THREE.Group();
  garment.name="km03-neutral-jersey";
  const cloth=new THREE.MeshStandardMaterial({
    color:spec.baseColor,metalness:0,roughness:.93,side:THREE.DoubleSide
  });
  const trim=new THREE.MeshStandardMaterial({
    color:spec.trimColor,metalness:0,roughness:.90,side:THREE.DoubleSide
  });

  // A single indexed shirt shell: remove two actual armholes from the
  // upper torso and shoulders, then stitch sleeves to shared border indices.
  // A raised crew neckline hugs the base of the neck, rather than
  // ending in the upper chest. Front sits slightly below the back.
  // These dimensions are based on the 180 cm mannequin's neck profile.
  const neck=angle=>{
    const t=angle/sides*TAU,front=Math.cos(t);
    return [Math.sin(t)*spec.necklineHalfWidth,
      (spec.necklineFrontY+spec.necklineBackY)/2+
        (spec.necklineFrontY-spec.necklineBackY)*front/2,
      spec.necklineCenterZ+front*spec.necklineDepth];
  };
  const shoulderPoint=(band,angle)=>{
    const f=band/8,theta=angle/sides*TAU;
    const outer=radius[at(rows-1,angle,sides)];
    const x0=Math.sin(theta)*outer,z0=spec.centerZ+Math.cos(theta)*outer;
    const inner=neck(angle);
    // A small linear contribution lifts the outer shoulder smoothly:
    // the previous pure smoothstep made a flat ledge above the armpit.
    const rise=.20*f+.80*f*f*(3-2*f);
    const y=spec.torsoShoulderY+(inner[1]-spec.torsoShoulderY)*rise;
    const x=x0+(inner[0]-x0)*f,z=z0+(inner[2]-z0)*f;
    const current=Math.hypot(x,z-spec.centerZ);
    const skin=shoulderSkin.radiusAt(y,angle);
    // Smoothly add only the missing skin clearance, fading to zero at
    // BOTH attached edges to preserve watertight torso and neck seams.
    const start=clamp(f/.25,0,1),end=clamp((1-f)/.25,0,1);
    const fade=(start*start*(3-2*start))*(end*end*(3-2*end));
    const extra=skin>0?Math.max(0,skin+spec.clearanceM-current)*fade:0;
    return [x+Math.sin(theta)*extra,y,z+Math.cos(theta)*extra];
  };
  const xyz=[],uv=[],index=[];
  const add=(p,u,v)=>{
    if(!p.every(n))throw new Error("Non-finite jersey vertex");
    const id=xyz.length/3;
    xyz.push(...p);uv.push(u,v);return id;
  };
  const totalRows=rows+8,base=(row,side)=>at(row,side,sides);
  for(let row=0;row<totalRows;row++)for(let side=0;side<sides;side++){
    const theta=side/sides*TAU;
    const p=row<rows
      ?[Math.sin(theta)*radius[at(row,side,sides)],
        spec.torsoHemY+(spec.torsoShoulderY-spec.torsoHemY)*row/(rows-1),
        spec.centerZ+Math.cos(theta)*radius[at(row,side,sides)]]
      :shoulderPoint(row-(rows-1),side);
    add(p,side/sides,row/(totalRows-1));
  }
  const armholes=[{side:"l",start:11,end:17},
    {side:"r",start:39,end:45}];
  const low=22,high=31;
  for(let row=0;row<totalRows-1;row++)for(let side=0;side<sides;side++){
    if(row>=low&&row<high&&armholes.some(h=>side>=h.start&&side<h.end))
      continue;
    const a=base(row,side),b=base(row,side+1);
    const c=base(row+1,side),d=base(row+1,side+1);
    index.push(a,b,c,b,d,c);
  }
  const stations=16;
  for(const hole of armholes){
    // Clockwise grid boundary, followed by actual sewn sleeve triangles.
    const seam=[];
    for(let side=hole.start;side<hole.end;side++)seam.push(base(low,side));
    for(let row=low;row<high;row++)seam.push(base(row,hole.end));
    for(let side=hole.end;side>hole.start;side--)seam.push(base(high,side));
    for(let row=high;row>low;row--)seam.push(base(row,hole.start));
    const pos=i=>[xyz[3*i],xyz[3*i+1],xyz[3*i+2]];
    const border=seam.map(pos),lengths=[0];
    for(let i=1;i<=border.length;i++){
      const a=border[i-1],b=border[i%border.length];
      lengths.push(lengths[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]));
    }
    const perimeter=lengths.at(-1);
    if(perimeter<.15||perimeter>.85)throw new Error("Invalid armhole edge");
    const {shoulder,axis}=relaxedArmAnchors(root,THREE,hole.side);
    const normal=axis.clone().normalize();
    const xaxis=new THREE.Vector3(0,0,1).cross(normal).normalize();
    const zaxis=normal.clone().cross(xaxis).normalize();
    const profile=fittedSleeveRadii(
      sampleMannequinArm(root,THREE,hole.side),shoulder,axis,{
        rows:13,lengthFraction:spec.sleeveLengthFraction,easeM:spec.sleeveEaseM
      });
    const section=f=>{
      const t=f*(profile.length-1),i=Math.floor(t),alpha=t-i;
      return profile[i]*(1-alpha)+profile[Math.min(profile.length-1,i+1)]*alpha;
    };
    const projection=p=>{
      const dx=p[0]-shoulder.x,dy=p[1]-shoulder.y,dz=p[2]-shoulder.z;
      return [dx*xaxis.x+dy*xaxis.y+dz*xaxis.z,
        dx*zaxis.x+dy*zaxis.y+dz*zaxis.z];
    };
    const p0=projection(border[0]),p1=projection(border[1]);
    const direction=p0[0]*p1[1]-p0[1]*p1[0]>=0?1:-1;
    const phase=Math.atan2(p0[1],p0[0]);
    let previous=seam;
    for(let ring=1;ring<=stations;ring++){
      const f=ring/stations,q=clamp(f/.25,0,1),blend=q*q*(3-2*q);
      const center=shoulder.clone().addScaledVector(axis,
        .055+spec.sleeveLengthFraction*f);
      const fitted=section(f),next=[];
      for(let i=0;i<border.length;i++){
        const angle=phase+direction*TAU*lengths[i]/perimeter;
        const target=center.clone()
          .addScaledVector(xaxis,Math.cos(angle)*fitted)
          .addScaledVector(zaxis,Math.sin(angle)*fitted);
        const a=border[i];
        next.push(add([a[0]*(1-blend)+target.x*blend,
          a[1]*(1-blend)+target.y*blend,
          a[2]*(1-blend)+target.z*blend],lengths[i]/perimeter,f));
      }
      for(let i=0;i<next.length;i++){
        const j=(i+1)%next.length;
        index.push(previous[i],previous[j],next[i],
          previous[j],next[j],next[i]);
      }
      previous=next;
    }
    garment.add(buildRingSurface(THREE,{rows:3,sides,
      name:"km03-jersey-cuff-"+hole.side,material:trim,
      point:(row,angle)=>{
        const t=angle/sides*TAU;
        const center=shoulder.clone().addScaledVector(axis,
          .055+spec.sleeveLengthFraction+row*.006);
        const r=profile.at(-1)+.0015;
        return center.addScaledVector(xaxis,Math.cos(t)*r)
          .addScaledVector(zaxis,Math.sin(t)*r).toArray();
      }}));
  }
  // Remove the interior vertices left over from both excised armholes.
  // Only vertices referenced by triangles belong in the connected shell.
  const remap=new Map(),surface=[],texcoords=[];
  for(const id of index){
    if(remap.has(id))continue;
    remap.set(id,remap.size);
    surface.push(xyz[3*id],xyz[3*id+1],xyz[3*id+2]);
    texcoords.push(uv[2*id],uv[2*id+1]);
  }
  for(let i=0;i<index.length;i++)index[i]=remap.get(index[i]);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(surface,3));
  geometry.setAttribute("uv",new THREE.Float32BufferAttribute(texcoords,2));
  geometry.setIndex(index);geometry.computeVertexNormals();
  const shell=new THREE.Mesh(geometry,cloth);
  shell.name="km03-jersey-shell";
  shell.castShadow=true; shell.receiveShadow=true;
  garment.add(shell);
  garment.add(buildRingSurface(THREE,{rows:3,sides,name:"km03-collar-rib",
    material:trim,point:(row,angle)=>{
      const p=neck(angle),f=row/2;
      // The outer collar edge lies EXACTLY on the shell's neckline.
      // Its narrow inner edge rises 10 mm to wrap around the neck.
      return [p[0]*(1-.025*f),p[1]+spec.collarRiseM*f,
        spec.necklineCenterZ+
          (p[2]-spec.necklineCenterZ)*(1-.025*f)];
    }}));
  // A narrow hem band provides a visible folded bottom opening.
  garment.add(buildRingSurface(THREE,{rows:3,sides,
    name:"km03-jersey-hem",material:trim,point:(row,angle)=>{
      const t=angle/sides*TAU,r=radius[at(0,angle,sides)]+.0015;
      return [Math.sin(t)*r,spec.torsoHemY+.001+row*.004,
        spec.centerZ+Math.cos(t)*r];
    }}));
  garment.userData.kitMakerJersey={
    version:"KM-03A",fitRevision:"KM-03E",color:"neutral-white",separateGeometry:true,
    torsoVertexCount:rows*sides,connectedShell:true,armholes:2,
    sleeves:2,collar:true,hem:true,raisedNeckline:true,shoulderFit:"posed-skin",skinRigUnmodified:true
  };
  root.add(garment);
  return garment;
}
