// KM-17: DEV-only kit geometry styles. All colours are canonical club roles
// or the fixed local neutral allowlist. No arbitrary colour picker or writes.
export const KIT_PARTS=Object.freeze(["jersey","shorts","socks"]);
export const KIT_STYLES=Object.freeze([
  Object.freeze({id:"solid",label:"Solid"}),
  Object.freeze({id:"vertical-stripes",label:"Vertical stripes"})
]);
export const KIT_STRIPE_WIDTH_RANGE=Object.freeze({minMm:30,maxMm:150,stepMm:5,defaultMm:75});
export function formatKitStripeWidth(mm){
  if(!Number.isFinite(mm))throw new Error("Invalid stripe width display");
  return (mm/10).toFixed(1).replace(/\.0$/,"")+" cm";
}
export function isKitStripeWidthAllowed(metres){
  const mm=metres*1000,limits=KIT_STRIPE_WIDTH_RANGE;
  return Number.isFinite(mm)&&Math.abs(mm-Math.round(mm))<1e-6&&
    mm>=limits.minMm-1e-6&&mm<=limits.maxMm+1e-6&&
    (Math.round(mm)-limits.minMm)%limits.stepMm===0;
}
export const KIT_NEUTRALS=Object.freeze([
  Object.freeze({id:"neutral-white",label:"White",hex:"#FFFFFF"}),
  Object.freeze({id:"neutral-black",label:"Black",hex:"#111111"}),
  Object.freeze({id:"neutral-grey",label:"Grey",hex:"#808080"}),
  Object.freeze({id:"neutral-ivory",label:"Ivory",hex:"#F5F1E9"})
]);
const HEX=/^#[0-9A-F]{6}$/;
function hexOrNull(value){
  return typeof value==="string"&&HEX.test(value.toUpperCase())
    ?value.toUpperCase():null;
}
export function kitColorChoices(club=null){
  return [
    {id:"primary",label:"Primary",hex:hexOrNull(club?.primaryColor)},
    {id:"secondary",label:"Secondary",hex:hexOrNull(club?.secondaryColor)},
    ...KIT_NEUTRALS
  ];
}
export function createKitDesignStore(){
  let clubId=null,club=null,activePart="jersey",activeLayer="base";
  const selections={jersey:"neutral-white",shorts:"neutral-white",socks:"neutral-white"};
  const accentSelections={jersey:"neutral-black",shorts:"neutral-black",socks:"neutral-black"};
  const styles={jersey:"solid",shorts:"solid",socks:"solid"};
  const stripeWidths={jersey:75,shorts:75,socks:75};
  const listeners=new Set();
  const getState=()=>{
    const choices=kitColorChoices(club);
    const byId=new Map(choices.map(c=>[c.id,c.hex]));
    const resolve=roles=>Object.fromEntries(KIT_PARTS.map(part=>[
      part,byId.get(roles[part])||"#FFFFFF"
    ]));
    return {
      clubId,style:styles[activePart],activePart,activeLayer,
      selections:{...selections},
      accentSelections:{...accentSelections},
      styles:{...styles},
      stripeWidths:{...stripeWidths},
      widths:Object.fromEntries(KIT_PARTS.map(part=>[
        part,stripeWidths[part]/1000
      ])),
      choices:choices.map(c=>({...c,enabled:Boolean(c.hex)})),
      colors:resolve(selections),
      accentColors:resolve(accentSelections)
    };
  };
  const announce=()=>{
    const next=getState();
    for(const fn of listeners)fn(next);
    return next;
  };
  return Object.freeze({
    getState,
    subscribe(fn){
      if(typeof fn!=="function")throw new Error("Kit design subscriber required");
      listeners.add(fn);
      return ()=>listeners.delete(fn);
    },
    setClub(id,record=null){
      if(id!==null&&(typeof id!=="string"||!id.trim()||
        !hexOrNull(record?.primaryColor)||!hexOrNull(record?.secondaryColor)))
        throw new Error("Kit Maker club needs canonical primary and secondary colours");
      clubId=id;
      club=id?{primaryColor:hexOrNull(record.primaryColor),
        secondaryColor:hexOrNull(record.secondaryColor)}:null;
      return announce();
    },
    selectPart(part){
      if(!KIT_PARTS.includes(part))throw new Error("Unknown kit garment");
      activePart=part;
      activeLayer="base";
      return announce();
    },
    selectStyle(style){
      if(!KIT_STYLES.some(s=>s.id===style))
        throw new Error("Unsupported Kit Maker style");
      styles[activePart]=style;
      if(style==="solid")activeLayer="base";
      return announce();
    },
    selectColorLayer(layer){
      if(!["base","accent"].includes(layer))
        throw new Error("Unsupported Kit Maker colour layer");
      if(layer==="accent"&&styles[activePart]!=="vertical-stripes")
        throw new Error("Stripe colour is unavailable for solid kits");
      activeLayer=layer;
      return announce();
    },
    selectStripeWidth(widthMm){
      const limits=KIT_STRIPE_WIDTH_RANGE;
      if(!Number.isInteger(widthMm)||widthMm<limits.minMm||
         widthMm>limits.maxMm||
         (widthMm-limits.minMm)%limits.stepMm!==0)
        throw new Error("Unsupported stripe width");
      if(styles[activePart]!=="vertical-stripes")
        throw new Error("Stripe width is unavailable for solid kits");
      stripeWidths[activePart]=widthMm;
      return announce();
    },
    selectColor(id){
      if(!kitColorChoices(club).some(c=>c.id===id&&c.hex))return false;
      (activeLayer==="accent"?accentSelections:selections)[activePart]=id;
      announce();
      return true;
    }
  });
}
export const kitDesignStore=createKitDesignStore();

// Keep KM-16's solid-only API for old isolated tests. Private boot materials,
// original textures, geometry and UVs must remain entirely untouched.
export function applySolidKitColors(outfit,colors){
  if(!outfit?.traverse)throw new Error("Missing outfit for Kit Maker colours");
  const chosen={};
  for(const part of KIT_PARTS){
    const hex=hexOrNull(colors?.[part]);
    if(!hex)throw new Error("Invalid allowed Kit Maker colour for "+part);
    chosen[part]=hex;
  }
  const targets=collectGarmentMaterials(outfit);
  for(const {part,material} of targets)material.color.set(chosen[part]);
  return {changedMaterials:targets.length,colors:chosen};
}
function collectGarmentMaterials(outfit){
  if(!outfit?.traverse)throw new Error("Missing outfit for Kit Maker colours");
  const result=[],present=new Set();
  outfit.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const part=/^FA_(jersey|shorts|socks)__/i.exec(mesh.name)?.[1]?.toLowerCase();
    if(!part)return;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    const prefix=part==="jersey"?"km13-white-":"km14-white-";
    if(!materials.length||materials.some(mat=>
      typeof mat?.name!=="string"||!mat.name.startsWith(prefix)||
      typeof mat.color?.set!=="function"))
      throw new Error("Kit colour target is not a private neutral material: "+mesh.name);
    for(const material of materials)result.push({material,part,meshName:mesh.name});
    present.add(part);
  });
  if(KIT_PARTS.some(part=>!present.has(part)))
    throw new Error("Kit Maker outfit is missing a garment category");
  return result;
}

// KM-19: near-vertical, PARALLEL bands with a bounded cloth-contour bend.
// The prior angular atan unwrap made all bands appear to radiate from a
// focal point, particularly near sleeves/collar. Do NOT use polar/angle
// coordinates or a width normalization that approaches zero.
// The bounded local displacement gently follows surface depth/shoulders,
// while adjacent stripes retain consistent spacing across the shirt.
export const KIT_STRIPE_SHADER_KEY="km19-parallel-curved-stripes-v1";
export function stripeSectionForMesh(meshName){
  if(/^FA_jersey__(?:38|39)$/i.test(meshName))return 1;
  if(/^FA_jersey__(?:62|63)$/i.test(meshName))return -1;
  return 0;
}
export function installKitStripeShader(material,THREE){
  if(material.userData?.kitStripeUniforms)
    return material.userData.kitStripeUniforms;
  if(typeof THREE?.Color!=="function")
    throw new Error("THREE.Color required for Kit Maker striped materials");
  if(typeof material?.color?.set!=="function")
    throw new Error("Expected a private MeshStandardMaterial");
  const uniforms={
    kmStripeEnabled:{value:0},
    kmStripeWidth:{value:.075},
    kmStripeSection:{value:0},
    kmStripeBase:{value:new THREE.Color("#FFFFFF")},
    kmStripeAccent:{value:new THREE.Color("#111111")}
  };
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=function(shader,renderer){
    if(typeof previous==="function")previous.call(this,shader,renderer);
    if(!shader.vertexShader.includes("#include <begin_vertex>"))
      throw new Error("Kit striped vertex shader hook missing");
    if(!shader.fragmentShader.includes("#include <color_fragment>"))
      throw new Error("Kit striped fragment shader hook missing");
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader="varying vec3 vKmClothPosition;\n"+shader.vertexShader
      .replace("#include <begin_vertex>",
        "#include <begin_vertex>\n vKmClothPosition = position;");
    shader.fragmentShader=[
      "varying vec3 vKmClothPosition;",
      "uniform float kmStripeEnabled;",
      "uniform float kmStripeWidth;",
      "uniform float kmStripeSection;",
      "uniform vec3 kmStripeBase;",
      "uniform vec3 kmStripeAccent;",
      // No singularity or focal point: d(horizontal)/dx stays > 0.93.
      // A small z- and height-aware lateral warp makes every stripe
      // softly follow the silhouette without fanning toward a pole.
      "float kmTorsoStripeCoordinate(vec3 p){",
      "  float height=smoothstep(1.12,1.62,p.y);",
      "  float depth=smoothstep(0.015,0.145,abs(p.z));",
      "  float drape=0.010*sin(p.x*7.0)*mix(0.35,0.85,depth)*(0.55+0.45*height);",
      "  return p.x+drape;",
      "}",
      // Sleeves follow the sloping arm axis rather than radiating around
      // a tube. The extra slope fades out at the upper sleeve seam.
      "float kmSleeveStripeCoordinate(vec3 p,float side){",
      "  float sleeveDrop=1.0-smoothstep(1.40,1.53,p.y);",
      "  float sleeveTilt=side*0.18*(p.y-1.53)*sleeveDrop;",
      "  return kmTorsoStripeCoordinate(p)+sleeveTilt;",
      "}",
      "float kmParallelStripeCoordinate(vec3 p){",
      "  if(abs(kmStripeSection)<0.5)return kmTorsoStripeCoordinate(p);",
      "  return kmSleeveStripeCoordinate(p,sign(kmStripeSection));",
      "}"
    ].join("\n")+"\n"+shader.fragmentShader.replace("#include <color_fragment>",
      [
        "#include <color_fragment>",
        "if(kmStripeEnabled > 0.5){",
        "  float band=kmParallelStripeCoordinate(vKmClothPosition);",
        "  float wave=cos(3.141592653589793*band/kmStripeWidth);",
        "  float edge=max(fwidth(wave),0.002);",
        "  float alternate=smoothstep(-edge,edge,-wave);",
        "  diffuseColor.rgb=mix(kmStripeBase,kmStripeAccent,alternate);",
        "}"
      ].join("\n"));
  };
  material.customProgramCacheKey=()=>KIT_STRIPE_SHADER_KEY;
  material.userData??={};
  material.userData.kitStripeUniforms=uniforms;
  material.needsUpdate=true;
  return uniforms;
}
// Applies validated UI design state to only the existing private garment
// materials. The two stripe colours are restricted to active palette choices.
export function applyKitDesign(outfit,state,THREE){
  if(!state||!KIT_PARTS.every(part=>
    KIT_STYLES.some(s=>s.id===state.styles?.[part])&&
    Number.isFinite(state.widths?.[part])&&
    isKitStripeWidthAllowed(state.widths[part])))
    throw new Error("Invalid kit style or stripe width");
  const allowed=new Set((state.choices||[])
    .filter(c=>c.enabled&&hexOrNull(c.hex)).map(c=>hexOrNull(c.hex)));
  const base={},accent={};
  for(const part of KIT_PARTS){
    base[part]=hexOrNull(state.colors?.[part]);
    accent[part]=hexOrNull(state.accentColors?.[part]);
    if(!base[part]||!accent[part]||
       !allowed.has(base[part])||!allowed.has(accent[part]))
      throw new Error("Kit colours must use club colours or allowed neutrals");
  }
  const targets=collectGarmentMaterials(outfit);
  if(typeof THREE?.Color!=="function")
    throw new Error("THREE.Color required for Kit Maker rendering");
  // Validate all targets and state before mutating the scene.
  for(const {material} of targets)
    if(!material.userData&&Object.isFrozen(material))
      throw new Error("Kit Maker material cannot be edited");
  for(const {part,material,meshName} of targets){
    const uniforms=installKitStripeShader(material,THREE);
    uniforms.kmStripeSection.value=part==="jersey"
      ?stripeSectionForMesh(meshName):0;
    uniforms.kmStripeEnabled.value=state.styles[part]==="vertical-stripes"?1:0;
    uniforms.kmStripeWidth.value=state.widths[part];
    uniforms.kmStripeBase.value.set(base[part]);
    uniforms.kmStripeAccent.value.set(accent[part]);
    material.color.set(state.styles[part]==="solid"?base[part]:"#FFFFFF");
  }
  return {changedMaterials:targets.length,styles:{...state.styles}};
}
