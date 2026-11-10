// KM-11 — GitHub-versioned outfit fit (no third-party geometry/texture here).
// The author-supplied GLB remains an owner-local file until redistribution rights exist.
// GitHub stores ONLY the transform, so future fit edits require git fetch, not new ZIPs.
export const SENA_MODEL_SHA=Object.freeze({
  original:"985a459664dbbbea061a5126ba1765acc208e4480091a2882f441379926110c8",
  km07:"8f929ab45ef51c7ce200b0f51514dff40854a2cd81ef68e82121533ca5942dca",
  km08:"6c5968336bf359bca9157dfdaae20ea5b346679c3223be8ddf427ad6e4e2849d"
});
export const SENA_FIT=Object.freeze({
  revision:"KM-11",
  shirtShortsLiftM:.080,
  socksLiftM:.080,
  originalSockCuffY:.105,
  sockCuffY:.130,
  sockFadeUpperY:.28,
  ankleOutwardM:.011,
  ankleHeelwardM:-.025
});
export const SENA_INNER_NECK_PRINT_MESH="FA_jersey__Pattern_2702362";
// The artist model contains a separate curved inner collar tape covered
// with small repeated dark lettering. Only remove this single mesh;
// keep the outer collar, neckline and shared materials untouched.
export function removeSenaInnerNeckPrint(root){
  if(!root?.traverse)throw new Error("Missing outfit scene for inner neck print removal");
  const hits=[];
  root.traverse(child=>{
    if(child.isMesh&&child.name===SENA_INNER_NECK_PRINT_MESH)hits.push(child);
  });
  if(hits.length!==1)
    throw new Error("Expected exactly one Alberto Sena inner collar print mesh");
  const mesh=hits[0];
  if(!mesh.parent?.remove)
    throw new Error("Inner collar print mesh is not attached to an editable parent");
  mesh.parent.remove(mesh);
  return {removed:1,meshName:SENA_INNER_NECK_PRINT_MESH};
}

// KM-13: a fully neutral white jersey base, without the artist's
// printed atlas, colour zones, decals or material texture channels.
// Do not dispose source materials: glTF can share them with shorts,
// socks or boots. No authored geometry or original files are changed.
export function makeSenaJerseySolidWhite(root,THREE){
  if(!root?.traverse)throw new Error("Missing outfit scene for white jersey");
  if(typeof THREE?.MeshStandardMaterial!=="function")
    throw new Error("THREE.MeshStandardMaterial is unavailable");
  if(root.userData?.senaJerseyBase==="solid-white")
    return {changed:0,alreadyApplied:true};

  const jersey=[];
  root.traverse(child=>{
    if(child.isMesh&&/^FA_jersey__/i.test(child.name))jersey.push(child);
  });
  if(!jersey.length)throw new Error("No jersey meshes for white base");

  const whiteMaterial=(original,name,index)=>new THREE.MeshStandardMaterial({
    name:"km13-white-"+name+"-"+index,
    color:0xffffff,
    roughness:0.85,
    metalness:0,
    side:original?.side??THREE.FrontSide,
    transparent:false,
    opacity:1,
    depthWrite:true
  });
  for(const child of jersey){
    const original=child.material;
    child.material=Array.isArray(original)
      ?original.map((material,i)=>whiteMaterial(material,child.name,i))
      :whiteMaterial(original,child.name,0);
  }
  root.userData??={};
  root.userData.senaJerseyBase="solid-white";
  return {changed:jersey.length,alreadyApplied:false};
}

// KM-14 — white shorts and socks without changing other source materials.
function senaWhiteMaterial(THREE,source,name,slot){
  return new THREE.MeshStandardMaterial({
    name:"km14-white-"+name+"-"+slot,
    color:0xffffff,roughness:0.85,metalness:0,
    side:source?.side??THREE.FrontSide,
    transparent:false,opacity:1,depthWrite:true
  });
}
export function makeSenaShortsSocksSolidWhite(root,THREE){
  if(!root?.traverse)throw new Error("Missing outfit scene for white shorts and socks");
  if(typeof THREE?.MeshStandardMaterial!=="function")
    throw new Error("THREE.MeshStandardMaterial unavailable");
  if(root.userData?.senaWhiteShortsSocks===true)
    return {changed:0,alreadyApplied:true,counts:{shorts:0,socks:0}};
  const parts={shorts:[],socks:[]};
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const match=/^FA_(shorts|socks)__/i.exec(mesh.name);
    if(match)parts[match[1].toLowerCase()].push(mesh);
  });
  if(!parts.shorts.length||!parts.socks.length)
    throw new Error("White shorts and socks require both garment categories");
  // Validate all target slots before editing; original GLB materials may be shared.
  for(const mesh of [...parts.shorts,...parts.socks]){
    if(!mesh.material||(Array.isArray(mesh.material)&&mesh.material.some(m=>!m)))
      throw new Error("Missing garment material");
  }
  for(const mesh of [...parts.shorts,...parts.socks]){
    const old=mesh.material;
    mesh.material=Array.isArray(old)
      ?old.map((material,i)=>senaWhiteMaterial(THREE,material,mesh.name,i))
      :senaWhiteMaterial(THREE,old,mesh.name,0);
  }
  root.userData??={};
  root.userData.senaWhiteShortsSocks=true;
  return {changed:parts.shorts.length+parts.socks.length,
    alreadyApplied:false,counts:{shorts:parts.shorts.length,socks:parts.socks.length}};
}

// KM-14B: GLTFLoader creates FIVE child Mesh objects for a boot's
// five glTF primitives. Each child has ONE material, not an array.
// Only the primitive with material_1 represents the actual laces.
export const SENA_BOOT_LACE_MATERIAL="FA_boots__material_1";
export function makeSenaBootLacesSolidWhite(root,THREE){
  if(!root?.traverse)throw new Error("Missing outfit scene for white laces");
  if(typeof THREE?.MeshStandardMaterial!=="function")
    throw new Error("THREE.MeshStandardMaterial unavailable");
  if(root.userData?.senaWhiteLaces===true)
    return {changed:0,alreadyApplied:true};
  const parts={l:[],r:[]};
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    // GLTFLoader SANITIZES the dot in '.001' and adds numeric suffixes.
    // Also accept source-style names in direct unit harnesses.
    const m=/^FA_boots__shoes_([lr])(?:\.001|001)(?:_\d+)?$/i.exec(mesh.name);
    if(m)parts[m[1].toLowerCase()].push(mesh);
  });
  const laces=[];
  for(const side of ["l","r"]){
    if(parts[side].length!==5)
      throw new Error("Expected five boot primitives for side "+side);
    const names=new Set();
    for(const mesh of parts[side]){
      if(!mesh.geometry||!mesh.material||Array.isArray(mesh.material)||
         typeof mesh.material.name!=="string")
        throw new Error("Unexpected boot primitive structure for side "+side);
      if(names.has(mesh.material.name))
        throw new Error("Duplicate boot material for side "+side);
      names.add(mesh.material.name);
      if(mesh.material.name===SENA_BOOT_LACE_MATERIAL)laces.push(mesh);
    }
    if(!names.has(SENA_BOOT_LACE_MATERIAL))
      throw new Error("Dedicated lace primitive missing for side "+side);
  }
  if(laces.length!==2)
    throw new Error("Expected exactly one lace primitive per foot");
  // Validate BOTH shoes before mutating either of them.
  for(const mesh of laces){
    mesh.material=senaWhiteMaterial(THREE,mesh.material,mesh.name,1);
  }
  root.userData??={};
  root.userData.senaWhiteLaces=true;
  return {changed:laces.length,alreadyApplied:false,materialSlot:1};
}

// KM-15: the source boot atlas for primitives 1-4 is fluorescent green.
// Materials 0/1 are already grayscale shoe upper / white lace target.
// Normalize all THREE other components to achromatic surfaces:
// material_2 -> white detail, material_3 -> dark trim,
// material_4 -> black outsole and studs (green tips removed).
// Never edit the artist's source textures or move the football boots.
export const SENA_BOOT_MONOCHROME=Object.freeze({
  "FA_boots__material_0":"preserve-grayscale-upper",
  "FA_boots__material_1":"preserve-for-white-laces",
  "FA_boots__material_2":"white",
  "FA_boots__material_3":"black",
  "FA_boots__material_4":"black"
});
export function makeSenaBootsBlackAndWhite(root,THREE){
  if(!root?.traverse)throw new Error("Missing outfit scene for monochrome boots");
  if(typeof THREE?.MeshStandardMaterial!=="function")
    throw new Error("THREE.MeshStandardMaterial unavailable");
  if(root.userData?.senaBootsMonochrome===true)
    return {changed:0,alreadyApplied:true};
  const parts={l:[],r:[]};
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const m=/^FA_boots__shoes_([lr])(?:\.001|001)(?:_\d+)?$/i.exec(mesh.name);
    if(m)parts[m[1].toLowerCase()].push(mesh);
  });
  const toReplace=[];
  for(const side of ["l","r"]){
    if(parts[side].length!==5)
      throw new Error("Expected five boot primitives for monochrome side "+side);
    const map=new Map();
    for(const mesh of parts[side]){
      if(!mesh.geometry||!mesh.material||Array.isArray(mesh.material)||
         typeof mesh.material.name!=="string")
        throw new Error("Invalid monochrome boot primitive on side "+side);
      const name=mesh.material.name;
      if(!Object.hasOwn(SENA_BOOT_MONOCHROME,name)||map.has(name))
        throw new Error("Unexpected or duplicate boot material on side "+side+": "+name);
      map.set(name,mesh);
    }
    if(map.size!==5)
      throw new Error("Incomplete monochrome boot materials on side "+side);
    for(const slot of [2,3,4]){
      const sourceName="FA_boots__material_"+slot;
      toReplace.push({mesh:map.get(sourceName),slot});
    }
  }
  // Both boots validated: recolour only the three green-atlas primitives.
  for(const {mesh,slot} of toReplace){
    const original=mesh.material;
    mesh.material=slot===2
      ?senaWhiteMaterial(THREE,original,mesh.name,slot)
      :new THREE.MeshStandardMaterial({
        name:"km15-black-"+mesh.name+"-"+slot,
        color:slot===4?0x101010:0x181818,
        roughness:0.85,
        metalness:0,
        side:original?.side??THREE.FrontSide,
        transparent:false,
        opacity:1,
        depthWrite:true
      });
  }
  root.userData??={};
  root.userData.senaBootsMonochrome=true;
  return {changed:toReplace.length,alreadyApplied:false,
    whiteDetailMaterials:2,blackStudAndTrimMaterials:4};
}

const TYPES=new Set(["jersey","shorts","socks","boots"]);
const smooth=t=>t*t*(3-2*t);
const finite=v=>Number.isFinite(v);
export function classifySenaPart(name){
  const match=/^FA_(jersey|shorts|socks|boots)__/i.exec(name||"");
  return match?match[1].toLowerCase():null;
}
export function getSenaFitMode(hash){
  if(hash===SENA_MODEL_SHA.original)return "apply-original";
  if(hash===SENA_MODEL_SHA.km07)return "apply-km11";
  if(hash===SENA_MODEL_SHA.km08)return "upgrade-km08";
  return "unknown";
}
export async function sha256Outfit(buffer,subtle=globalThis.crypto?.subtle){
  if(!(buffer instanceof ArrayBuffer)||!subtle?.digest)
    throw new Error("No WebCrypto SHA-256 available for the outfit file");
  const bytes=new Uint8Array(await subtle.digest("SHA-256",buffer));
  return [...bytes].map(n=>n.toString(16).padStart(2,"0")).join("");
}
function medianX(position){
  const values=[];
  for(let i=0;i<position.count;i++)values.push(position.getX(i));
  values.sort((a,b)=>a-b);
  const mid=values.length>>1;
  return values.length%2?values[mid]:(values[mid-1]+values[mid])/2;
}
// The original/KM-07 geometries use a 105 mm pre-fit ankle start, whereas
// the KM-08 GLB already has a 98 mm ankle and +46 mm upper-sock position.
// All three assets reach the same KM-11 coordinates in one browser pass.
export function fitSenaOutfit(root,hash,spec=SENA_FIT){
  const mode=getSenaFitMode(hash);
  if(mode==="unknown")
    throw new Error("Unrecognized local clothing GLB revision; do not apply an unknown transform");
  if(!root?.traverse)throw new Error("Missing clothing model scene");
  if(root.userData?.senaFitRevision===spec.revision)
    return {revision:spec.revision,mode:"already-applied",meshes:0,changed:0};

  let meshes=0,changed=0;
  const categories=new Set(),selected=[],seen=new Set();
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    meshes++;
    const group=classifySenaPart(mesh.name);
    if(!TYPES.has(group))throw new Error("Unknown clothing part "+mesh.name);
    categories.add(group);
    if(group==="boots")return; // Shoes never move or deform.
    const geometry=mesh.geometry,position=geometry?.getAttribute("position"),
      normal=geometry?.getAttribute("normal");
    if(!position||!normal||position.count!==normal.count||!position.count)
      throw new Error("Invalid clothing vertex/normal geometry");
    if(seen.has(geometry))return;
    seen.add(geometry);
    selected.push({geometry,position,normal,group});
  });
  if(meshes<4||![...TYPES].every(t=>categories.has(t))||!selected.length)
    throw new Error("Outfit must contain jersey, shorts, socks and boots");

  const fromKM08=mode==="upgrade-km08";
  const shirtShortsDelta=spec.shirtShortsLiftM-(fromKM08 ? .046 : 0);
  const cuffStart=fromKM08 ? .098 : spec.originalSockCuffY;
  const fadeTop=fromKM08 ? spec.sockFadeUpperY+.046 : spec.sockFadeUpperY;
  const lowerDelta=spec.sockCuffY-cuffStart;
  const upperDelta=spec.socksLiftM-(fromKM08 ? .046 : 0);
  const liftSlope=upperDelta-lowerDelta;
  const outward=fromKM08 ? 0 : spec.ankleOutwardM;
  const heelward=fromKM08 ? 0 : spec.ankleHeelwardM;

  for(const {geometry,position,normal,group} of selected){
    const sign=group==="socks"?(medianX(position)>0?1:-1):0;
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
      if(group==="jersey"||group==="shorts"){
        position.setXYZ(i,x,y+shirtShortsDelta,z);
      }else if(group==="socks"){
        const t=Math.max(0,Math.min(1,(y-cuffStart)/(fadeTop-cuffStart)));
        const f=smooth(t),d=6*t*(1-t)/(fadeTop-cuffStart);
        position.setXYZ(i,
          x+sign*outward*(1-f),
          y+lowerDelta+liftSlope*f,
          z+heelward*(1-f)
        );
        // Correct normal for the vertical displacement gradient.
        const ny=normal.getY(i),nx=normal.getX(i),nz=normal.getZ(i);
        const dy=1+liftSlope*d,ap=-sign*outward*d,hp=-heelward*d;
        const newY=(ny-ap*nx-hp*nz)/dy,
          length=Math.hypot(nx,newY,nz)||1;
        normal.setXYZ(i,nx/length,newY/length,nz/length);
      }
    }
    position.needsUpdate=true;
    normal.needsUpdate=true;
    geometry.computeBoundingBox?.();
    geometry.computeBoundingSphere?.();
    changed++;
  }
  root.userData??={};
  root.userData.senaFitRevision=spec.revision;
  root.userData.senaFitSource=mode;
  return {revision:spec.revision,mode,meshes,changed};
}
