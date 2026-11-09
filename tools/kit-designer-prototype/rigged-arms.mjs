// MANNEQUIN-02 — local-only rigged skeleton arm lowering, no bundled external mesh.
// Supports MakeHuman default .L/.R and common Mixamo-style GLB joints.
function sideOf(name){
  const s=String(name||"").toLowerCase().replace(/^mixamorig[:_]?/,"");
  if(/^(?:left|l[_:.-])/.test(s)||/[._:-](?:l|left)$/.test(s)||/left$/.test(s))return "left";
  if(/^(?:right|r[_:.-])/.test(s)||/[._:-](?:r|right)$/.test(s)||/right$/.test(s))return "right";
  return null;
}
function segmentOf(name){
  const s=String(name||"").toLowerCase().replace(/^mixamorig[:_]?/,"").replace(/[^a-z0-9]/g,"");
  if(/lowerarm|forearm/.test(s))return "lower";
  if(/upperarm/.test(s)||/^(?:left|right)arm$/.test(s)||/^arm(?:l|r)$/.test(s))return "upper";
  if(/wrist|^(?:left|right)hand$|^hand(?:l|r)$/.test(s))return "wrist";
  return null;
}
function priority(name,type){
  const s=String(name||"").toLowerCase();
  if(type==="upper"&&/upper.?arm0?1[._:-]/.test(s))return 0;
  if(type==="lower"&&/lower.?arm0?1[._:-]/.test(s))return 0;
  if(type==="wrist"&&/wrist/.test(s))return 0;
  return 1;
}
function isDescendant(child,ancestor){
  for(let p=child?.parent;p;p=p.parent)if(p===ancestor)return true;
  return false;
}
export function findBilateralArmChains(bones){
  const nodes=[...new Set(bones||[])].filter(b=>b&&typeof b.name==="string");
  const chains={};
  for(const side of ["left","right"]){
    const candidates=kind=>nodes.filter(b=>sideOf(b.name)===side&&segmentOf(b.name)===kind)
      .sort((a,b)=>priority(a.name,kind)-priority(b.name,kind));
    for(const upper of candidates("upper")){
      const lower=candidates("lower").find(b=>isDescendant(b,upper));
      const wrist=lower&&candidates("wrist").find(b=>isDescendant(b,lower));
      if(lower&&wrist){chains[side]={upper,lower,wrist};break;}
    }
  }
  return chains.left&&chains.right?chains:null;
}
export function targetArmVectors(side){
  if(side!=="left"&&side!=="right")throw new Error("Unknown arm side");
  // Slightly abducted shoulders and relaxed forearms: hands clear of the thighs.
  return {upper:[.18,-1,.01],lower:[.10,-1,.03]};
}
export function createRiggedArmPose(root,THREE){
  if(!root||typeof root.traverse!=="function")return null;
  const boneSet=new Set();
  let meshCount=0;
  root.traverse(node=>{
    if(!node.isSkinnedMesh||!node.skeleton?.bones?.length)return;
    meshCount++;
    for(const bone of node.skeleton.bones)boneSet.add(bone);
  });
  if(!meshCount)return null;
  const chains=findBilateralArmChains(boneSet);
  if(!chains)return null;
  const joints=[...new Set(Object.values(chains).flatMap(c=>[c.upper,c.lower,c.wrist]))];
  const original=new Map(joints.map(b=>[b,b.quaternion.clone()]));
  let posed=false;
  const at=bone=>bone.getWorldPosition(new THREE.Vector3());
  function aim(bone,child,target){
    root.updateMatrixWorld(true);
    const current=at(child).sub(at(bone));
    if(current.lengthSq()<1e-10)throw new Error("Coincident arm rig joints.");
    const worldCorrection=new THREE.Quaternion().setFromUnitVectors(
      current.normalize(),new THREE.Vector3(...target).normalize()
    );
    const parentWorld=new THREE.Quaternion();
    bone.parent?.getWorldQuaternion(parentWorld);
    const localCorrection=parentWorld.clone().invert().multiply(worldCorrection).multiply(parentWorld);
    bone.quaternion.premultiply(localCorrection).normalize();
    root.updateMatrixWorld(true);
  }
  function restore(){
    for(const [joint,q] of original)joint.quaternion.copy(q);
    root.updateMatrixWorld(true);
    posed=false;
  }
  function relax(){
    restore();
    try{
      for(const side of ["left","right"]){
        const {upper,lower,wrist}=chains[side];
        root.updateMatrixWorld(true);
        const sign=at(upper).x>=0?1:-1;
        const goal=targetArmVectors(side);
        aim(upper,lower,[sign*goal.upper[0],goal.upper[1],goal.upper[2]]);
        aim(lower,wrist,[sign*goal.lower[0],goal.lower[1],goal.lower[2]]);
      }
      posed=true;
    }catch(error){
      restore();
      throw error;
    }
  }
  return {
    relax,restore,
    get isRelaxed(){return posed;},
    boneCount:boneSet.size,
    left:chains.left.upper.name,
    right:chains.right.upper.name
  };
}
