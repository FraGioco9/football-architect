// Football Architect MANNEQUIN-180: mannequin-only WebGL viewer.
// Asset is already in metres. Never import kit, club, world or account code.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createRiggedArmPose } from "./rigged-arms.mjs";
import { validateLocalModelFile, validateStandaloneGLB } from "./reference-import.mjs";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const canvas=document.getElementById("viewport");
const status=document.getElementById("status");
if(!canvas||!status)throw new Error("Mannequin studio DOM structure is incomplete");

const scene=new THREE.Scene();
scene.background=null;
const camera=new THREE.PerspectiveCamera(34,1,.08,25);
const focus=new THREE.Vector3(0,.90,0);
camera.position.set(0,.98,3.52);

const renderer=new THREE.WebGLRenderer({
  canvas,antialias:true,alpha:true,powerPreference:"high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.17;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

const controls=new OrbitControls(camera,canvas);
controls.target.copy(focus);
controls.enableDamping=true;
controls.dampingFactor=.075;
controls.enablePan=false;
controls.minDistance=1.65;
controls.maxDistance=7.8;
controls.minPolarAngle=.22;
controls.maxPolarAngle=Math.PI-.22;
controls.update();

const bodyMaterial=new THREE.MeshPhysicalMaterial({
  color:0xbfc6c3,roughness:.81,metalness:0,
  clearcoat:0,clearcoatRoughness:1,side:THREE.DoubleSide
});
scene.add(new THREE.HemisphereLight(0xe8f4ff,0x53646d,1.9));
const key=new THREE.DirectionalLight(0xffffff,3.1);
key.position.set(-2.9,4.8,3.9);
key.castShadow=true;
key.shadow.mapSize.set(1024,1024);
key.shadow.camera.left=-2.1;
key.shadow.camera.right=2.1;
key.shadow.camera.top=2.8;
key.shadow.camera.bottom=-1.4;
key.shadow.normalBias=.009;
scene.add(key);
const fill=new THREE.DirectionalLight(0xd1e4ed,1.1);
fill.position.set(3,2.2,1.7);
scene.add(fill);
const rim=new THREE.DirectionalLight(0xc4dfe4,1.7);
rim.position.set(1.8,3,-3);
scene.add(rim);

const floor=new THREE.Mesh(
  new THREE.PlaneGeometry(30,30),
  new THREE.ShadowMaterial({opacity:.20})
);
floor.rotation.x=-Math.PI/2;
floor.position.y=-.008;
floor.receiveShadow=true;
scene.add(floor);

const views={
  front:[0,.98,3.52],
  back:[0,.98,-3.52],
  side:[3.52,.98,0]
};
function selectView(name){
  const chosen=name==="reset"?"front":name;
  const coordinates=views[chosen];
  if(!coordinates)return;
  camera.position.set(...coordinates);
  controls.target.copy(focus);
  controls.update();
  for(const button of document.querySelectorAll("[data-view]")){
    button.setAttribute("aria-pressed",String(button.dataset.view===chosen));
  }
}
for(const button of document.querySelectorAll("[data-view]")){
  button.addEventListener("click",()=>selectView(button.dataset.view));
}

function resize(){
  const rect=canvas.getBoundingClientRect();
  if(rect.width<1||rect.height<1)return;
  camera.aspect=rect.width/rect.height;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width,rect.height,false);
}
const observer=new ResizeObserver(resize);
observer.observe(canvas);
resize();
let visible=true;
document.addEventListener("visibilitychange",()=>{visible=!document.hidden;});
renderer.setAnimationLoop(()=>{
  if(!visible)return;
  controls.update();
  renderer.render(scene,camera);
});
canvas.addEventListener("webglcontextlost",event=>{
  event.preventDefault();
  status.textContent="WebGL context lost. Reload the page to restore the mannequin.";
});


const referenceInput=document.getElementById("reference-file");
const restoreBase=document.getElementById("restore-base");
const previewSource=document.getElementById("preview-source");
const modelTitle=document.getElementById("model-title");
const modelDescription=document.getElementById("model-description");
const relaxArms=document.getElementById("relax-arms");
const restoreRigPose=document.getElementById("restore-rig-pose");
const rigInfo=document.getElementById("rig-info");
const anatomyMetrics=document.getElementById("base-anatomy-metrics");
if(referenceInput&&(!restoreBase||!previewSource||!modelTitle||!modelDescription||!anatomyMetrics||!relaxArms||!restoreRigPose||!rigInfo)){
  throw new Error("Missing local reference preview controls.");
}
let bundledModel=null;
let activeModel=null;
let loadGeneration=0;
function prepareModel(root,{weldObj=false}={}){
  let meshes=0,vertices=0;
  const remove=[];
  root.traverse(child=>{
    if(child.isLight||child.isCamera){remove.push(child);return;}
    if(!child.isMesh)return;
    if(!child.geometry||!child.geometry.getAttribute("position")){
      throw new Error("Imported mesh has no vertex positions.");
    }
    meshes++;
    vertices+=child.geometry.getAttribute("position").count;
    if(meshes>512||vertices>2000000){
      throw new Error("The local model is too complex for the preview.");
    }
    if(weldObj&&!child.isSkinnedMesh){
      const raw=child.geometry;
      raw.deleteAttribute("normal");
      const smooth=mergeVertices(raw,1e-5);
      smooth.computeVertexNormals();
      child.geometry=smooth;
      raw.dispose();
    }else if(!child.geometry.getAttribute("normal")){
      child.geometry.computeVertexNormals();
    }
    child.material=bodyMaterial;
    child.castShadow=true;
    child.receiveShadow=true;
  });
  for(const child of remove)child.parent?.remove(child);
  if(meshes===0)throw new Error("The selected model contains no body mesh.");
}
function modelBounds(model){
  model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model,true);
  if(box.isEmpty()||!Number.isFinite(box.min.y)||!Number.isFinite(box.max.y)){
    throw new Error("The model has invalid geometry.");
  }
  return box;
}
function normalizeReference(model){
  const box=modelBounds(model);
  const sourceHeight=box.max.y-box.min.y;
  if(!Number.isFinite(sourceHeight)||sourceHeight<=.0001){
    throw new Error("The model has no valid standing height.");
  }
  const factor=1.8/sourceHeight;
  if(factor<.00001||factor>100000){
    throw new Error("The local model has an unsupported scale.");
  }
  model.scale.multiplyScalar(factor);
  const resized=modelBounds(model);
  model.position.add(new THREE.Vector3(
    -(resized.min.x+resized.max.x)/2,
    -resized.min.y,
    -(resized.min.z+resized.max.z)/2
  ));
  const grounded=modelBounds(model);
  if(Math.abs(grounded.max.y-grounded.min.y-1.8)>.005||
     Math.abs(grounded.min.y)>.005){
    throw new Error("Unable to normalize the local model to 180 cm.");
  }
}
function disposePreview(root){
  if(!root||root===bundledModel)return;
  const disposed=new Set();
  root.traverse(child=>{
    const geometry=child.geometry;
    if(child.isMesh&&geometry&&!disposed.has(geometry)){
      disposed.add(geometry);
      geometry.dispose();
    }
  });
}

function updateRigControls(){
  if(!relaxArms||!restoreRigPose||!rigInfo)return;
  const rig=activeModel?.userData?.riggedArmPose;
  const available=Boolean(rig);
  relaxArms.disabled=!available||rig.isRelaxed;
  restoreRigPose.disabled=!available||!rig.isRelaxed;
  rigInfo.textContent=!activeModel||activeModel===bundledModel
    ?"The bundled GLB is already posed; these controls apply to imported rigged GLBs."
    :available
      ?rig.boneCount+" skeleton bones found; "+(rig.isRelaxed?"arms lowered":"original A-pose")+"."
      :"No supported bilateral arm rig found. Use an Innerscene/MakeHuman GLB with bone skin weights.";
}
relaxArms?.addEventListener("click",()=>{
  const rig=activeModel?.userData?.riggedArmPose;
  if(!rig)return;
  try{
    rig.relax();
    updateRigControls();
    status.textContent="Arms lowered by skeleton joints. Check shoulders, elbows and hands in Side, Front and Back.";
  }catch(error){
    updateRigControls();
    status.textContent="Unable to lower arms for this rig: "+String(error?.message||error);
  }
});
restoreRigPose?.addEventListener("click",()=>{
  const rig=activeModel?.userData?.riggedArmPose;
  if(!rig)return;
  rig.restore();
  updateRigControls();
  status.textContent="Original A-pose restored for comparison.";
});

function setActiveModel(next){
  const previous=activeModel;
  if(previous)scene.remove(previous);
  scene.add(next);
  activeModel=next;
  updateRigControls();
  if(previous&&previous!==next)disposePreview(previous);
}
function describeSource({name=null}={}){
  // The integrated Kit Maker is deliberately a mannequin-only preview.
  if(!modelTitle||!modelDescription||!anatomyMetrics||!previewSource||!restoreBase)return;
  const imported=Boolean(name);
  modelTitle.textContent=imported?"Local reference preview":"Rigged anatomical base";
  modelDescription.textContent=imported
    ?"Temporary external-model preview. Exact anatomy, face, pose and redistribution rights have not been verified."
    :"Innerscene/MakeHuman CC0 rigged male · 180 cm · relaxed arms slightly away from the torso.";
  anatomyMetrics.hidden=imported;
  previewSource.textContent=imported?name:"Innerscene CC0 · relaxed arms";
  restoreBase.disabled=!imported;
}
async function parseLocalReference(file){
  const extension=validateLocalModelFile(file);
  if(extension==="obj"){
    const source=await file.text();
    const root=new OBJLoader().parse(source);
    prepareModel(root,{weldObj:true});
    normalizeReference(root);
    return root;
  }
  const bytes=await file.arrayBuffer();
  validateStandaloneGLB(bytes);
  const parsed=await new GLTFLoader().parseAsync(bytes,"");
  const root=parsed.scene;
  prepareModel(root);
  const alreadyPosed=Boolean(parsed.parser.json.extras?.footballArchitect?.modification?.includes("arms lowered"));
  const rig=alreadyPosed?null:createRiggedArmPose(root,THREE);
  if(rig){
    rig.relax();
    root.userData.riggedArmPose=rig;
  }
  normalizeReference(root);
  return root;
}
referenceInput?.addEventListener("change",async()=>{
  const file=referenceInput.files?.[0];
  if(!file)return;
  const generation=++loadGeneration;
  status.textContent="Reading local 3D reference: "+file.name;
  let model=null;
  try{
    model=await parseLocalReference(file);
    if(generation!==loadGeneration){disposePreview(model);return;}
    setActiveModel(model);
    describeSource({name:file.name});
    status.textContent=model.userData.riggedArmPose
      ?"Rigged base automatically posed with arms lowered and scaled to 180 cm. Check Front/Side/Back; no files uploaded."
      :"Local reference displayed at 180 cm; no compatible rig detected. Check pose and licensing.";
    selectView("front");
  }catch(error){
    disposePreview(model);
    if(generation===loadGeneration){
      console.error("Local reference could not be displayed",error);
      status.textContent="Local preview failed: "+(error instanceof Error?error.message:"Unsupported model");
    }
  }finally{
    referenceInput.value="";
  }
});
restoreBase?.addEventListener("click",()=>{
  ++loadGeneration;
  if(!bundledModel){
    status.textContent="The bundled mannequin has not loaded.";
    return;
  }
  setActiveModel(bundledModel);
  describeSource();
  selectView("front");
  status.textContent="Rigged CC0 default restored · 180 cm · arms down.";
});
// The same viewer works in both the legacy loopback studio (2100) and
// the canonical local DEV Kit Maker page under app.localhost:2000.
const studioAssets=location.pathname==="/dev/kit-maker"?"/__fa_kit_maker__/":"./";
try {
  const response=await fetch(studioAssets+"mannequin-180.glb",{cache:"no-store"});
  if(!response.ok)throw new Error("Rigged default HTTP "+response.status);
  const bytes=await response.arrayBuffer();
  validateStandaloneGLB(bytes);
  const parsed=await new GLTFLoader().parseAsync(bytes,"");
  const model=parsed.scene;
  prepareModel(model);
  const box=modelBounds(model);
  if(Math.abs(box.max.y-box.min.y-1.8)>.005)
    throw new Error("Default rigged mannequin is not 180 cm high");
  bundledModel=model;
  if(!activeModel){
    setActiveModel(model);describeSource();
    status.textContent="Rigged CC0 mannequin loaded · 180 cm · arms beside hips.";
    if(location.pathname==="/dev/kit-maker"){
      // Only the integrated Kit Maker adds a garment. The 2100 anatomical
      // reference studio remains mannequin-only and its tests stay unchanged.
      try{
        const {createNeutralShortSleeveJersey}=await import(studioAssets+"jersey-geometry.mjs");
        const jersey=createNeutralShortSleeveJersey(model,THREE);
        if(jersey?.userData?.kitMakerJersey?.version!=="KM-03A")
          throw new Error("Unexpected jersey geometry");
        status.textContent="Neutral white short-sleeve jersey fitted to the rigged mannequin.";
      }catch(jerseyError){
        // Never replace the approved GLB with an OBJ because a garment fails.
        console.error("KM-03A jersey preview failed",jerseyError);
        status.textContent="Mannequin loaded; jersey preview unavailable.";
      }
    }
  }
}catch(error){
  console.error("Rigged default unavailable; loading old OBJ",error);
  try{
    const model=await new OBJLoader().loadAsync(studioAssets+"mannequin-180.obj");
    prepareModel(model,{weldObj:true});
    bundledModel=model;
    if(!activeModel){
      setActiveModel(model);describeSource();
      status.textContent="Legacy OBJ fallback — new rigged GLB could not be loaded.";
    }
  }catch(e){
    console.error("Legacy OBJ failed",e);
    if(!activeModel)status.textContent="Unable to load the default mannequin.";
  }
}
