// KM-06 — clothing-only Kit Maker preview, preserving the approved rig.
// Hide the anatomical reference *meshes*, not their parent Group/Bones:
// a hidden parent would also hide the outfit that is attached afterwards.
// Call BEFORE adding any artist outfit and BEFORE showing the model.
export function hideAnatomicalBody(root){
  if(!root || typeof root.traverse!=="function")
    throw new Error("Kit Maker mannequin root is unavailable");
  let hidden=0;
  root.traverse(child=>{
    if(!child.isMesh && !child.isSkinnedMesh)return;
    child.visible=false;
    child.castShadow=false;
    child.receiveShadow=false;
    hidden++;
  });
  if(!hidden)throw new Error("The anatomical mannequin has no renderable meshes");
  return hidden;
}
