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
  // One role colours collar, both outer sleeve cuffs and shirt bottom hem.
  const detailSelections={trim:"neutral-white"};
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
      detailSelections:{...detailSelections},
      styles:{...styles},
      stripeWidths:{...stripeWidths},
      widths:Object.fromEntries(KIT_PARTS.map(part=>[
        part,stripeWidths[part]/1000
      ])),
      choices:choices.map(c=>({...c,enabled:Boolean(c.hex)})),
      colors:resolve(selections),
      accentColors:resolve(accentSelections),
      detailColors:Object.fromEntries(Object.entries(detailSelections)
        .map(([part,role])=>[part,byId.get(role)||"#FFFFFF"]))
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
      if(style==="solid"&&activeLayer==="accent")activeLayer="base";
      return announce();
    },
    selectColorLayer(layer){
      if(!["base","accent","trim"].includes(layer))
        throw new Error("Unsupported Kit Maker colour layer");
      if(layer==="accent"&&styles[activePart]!=="vertical-stripes")
        throw new Error("Stripe colour is unavailable for solid kits");
      if(layer==="trim"&&activePart!=="jersey")
        throw new Error("Jersey trim is unavailable for other garments");
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
      if(activeLayer==="trim")detailSelections.trim=id;
      else (activeLayer==="accent"?accentSelections:selections)[activePart]=id;
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
    for(const material of materials)
      result.push({material,part,meshName:mesh.name,geometry:mesh.geometry});
    present.add(part);
  });
  if(KIT_PARTS.some(part=>!present.has(part)))
    throw new Error("Kit Maker outfit is missing a garment category");
  return result;
}

// KM-20: original flat sewing-pattern UVs provide equal sewn band widths
// as the shirt curves around shoulders and hips. Projected model X
// compresses width at the flanks; polar methods create focal points.
// UV widths are measured in metres by sampling source mesh triangles.
// Never edit artist vertices, texture atlas, normals, skinning or UVs.
export const KIT_STRIPE_SHADER_KEY="km23-unified-exterior-shirt-trims-v1";
const stripeMetricCache=new WeakMap();
export function stripeSectionForMesh(name){
  if(/^FA_jersey__(?:38|39)(?:_\d+)?$/i.test(name))return 1;
  if(/^FA_jersey__(?:62|63)(?:_\d+)?$/i.test(name))return -1;
  return 0;
}
export function measureKitStripeFabricMetric(geometry){
  const pos=geometry?.getAttribute?.("position");
  const uv=geometry?.getAttribute?.("uv");
  if(!pos||!uv||pos.count!==uv.count||pos.count<3)
    throw new Error("Kit stripes require the original cloth position and pattern UVs");
  const index=geometry.index;
  if(index&&typeof index.getX!=="function")
    throw new Error("Kit stripes require a readable triangle index");
  let low=Infinity,high=-Infinity,lowV=Infinity,highV=-Infinity;
  for(let i=0;i<uv.count;i++){
    const u=uv.getX(i),v=uv.getY(i);
    if(!Number.isFinite(u)||!Number.isFinite(v))
      throw new Error("Nonfinite kit pattern UV");
    low=Math.min(low,u);high=Math.max(high,u);
    lowV=Math.min(lowV,v);highV=Math.max(highV,v);
  }
  if(high-low<1e-5)throw new Error("Kit pattern UV has no horizontal extent");
  const count=Math.floor((index?.count??pos.count)/3);
  const stride=Math.max(1,Math.floor(count/512)),samples=[],samplesV=[];
  for(let tri=0;tri<count;tri+=stride){
    const a=index?index.getX(tri*3):tri*3;
    const b=index?index.getX(tri*3+1):tri*3+1;
    const c=index?index.getX(tri*3+2):tri*3+2;
    const du1=uv.getX(b)-uv.getX(a),dv1=uv.getY(b)-uv.getY(a);
    const du2=uv.getX(c)-uv.getX(a),dv2=uv.getY(c)-uv.getY(a);
    const determinant=du1*dv2-du2*dv1;
    if(Math.abs(determinant)<1e-10)continue;
    const dx1=pos.getX(b)-pos.getX(a),dx2=pos.getX(c)-pos.getX(a);
    const dy1=pos.getY(b)-pos.getY(a),dy2=pos.getY(c)-pos.getY(a);
    const dz1=pos.getZ(b)-pos.getZ(a),dz2=pos.getZ(c)-pos.getZ(a);
    const scale=Math.hypot(
      (dx1*dv2-dx2*dv1)/determinant,
      (dy1*dv2-dy2*dv1)/determinant,
      (dz1*dv2-dz2*dv1)/determinant
    );
    const scaleV=Math.hypot(
      (dx2*du1-dx1*du2)/determinant,
      (dy2*du1-dy1*du2)/determinant,
      (dz2*du1-dz1*du2)/determinant
    );
    if(Number.isFinite(scale)&&scale>.1&&scale<10&&
       Number.isFinite(scaleV)&&scaleV>.1&&scaleV<10){
      samples.push(scale);samplesV.push(scaleV);
    }
  }
  if(!samples.length)
    throw new Error("No valid triangles for Kit Maker stripe UV calibration");
  samples.sort((a,b)=>a-b);samplesV.sort((a,b)=>a-b);
  const n=samples.length;
  const median=values=>n%2?values[(n-1)/2]
    :(values[n/2-1]+values[n/2])/2;
  return Object.freeze({
    originU:(low+high)/2,metresPerUv:median(samples),
    metresPerUvV:median(samplesV),lowV,highV,
    sampledTriangles:n,rangeU:high-low
  });
}
function cachedKitStripeMetric(geometry){
  let metric=stripeMetricCache.get(geometry);
  if(!metric){
    metric=measureKitStripeFabricMetric(geometry);
    stripeMetricCache.set(geometry,metric);
  }
  return metric;
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
    kmStripeFabricOrigin:{value:0},
    kmStripeFabricScale:{value:1},
    kmTrimRegion:{value:0},
    kmTrimEdgeV:{value:0},
    kmTrimColor:{value:new THREE.Color("#FFFFFF")},
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
    shader.vertexShader="varying float vKmPatternU;\nvarying float vKmPatternV;\n"+
      shader.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\n vKmPatternU = uv.x;\n vKmPatternV = uv.y;");
    shader.fragmentShader=[
      "varying float vKmPatternU;",
      "varying float vKmPatternV;",
      "uniform float kmTrimRegion;",
      "uniform float kmTrimEdgeV;",
      "uniform vec3 kmTrimColor;",
      "uniform float kmStripeEnabled;",
      "uniform float kmStripeWidth;",
      "uniform float kmStripeFabricOrigin;",
      "uniform float kmStripeFabricScale;",
      "uniform vec3 kmStripeBase;",
      "uniform vec3 kmStripeAccent;"
    ].join("\n")+"\n"+shader.fragmentShader.replace("#include <color_fragment>",
      [
        "#include <color_fragment>",
        "if(kmStripeEnabled > 0.5){",
        "  float distanceOnFabric=(vKmPatternU-kmStripeFabricOrigin)*kmStripeFabricScale;",
        "  float wave=cos(3.141592653589793*distanceOnFabric/kmStripeWidth);",
        "  float edge=max(fwidth(wave),0.002);",
        "  float alternate=smoothstep(-edge,edge,-wave);",
        "  diffuseColor.rgb=mix(kmStripeBase,kmStripeAccent,alternate);",
        "}",
        "if(kmTrimRegion > 0.5 && kmTrimRegion < 1.5){",
        "  diffuseColor.rgb=kmTrimColor;",
        "}else if(kmTrimRegion > 1.5){",
        "  float edgeAA=max(fwidth(vKmPatternV),0.0001);",
        "  float exteriorMask=1.0-smoothstep(kmTrimEdgeV-edgeAA,kmTrimEdgeV+edgeAA,vKmPatternV);",
        "  diffuseColor.rgb=mix(diffuseColor.rgb,kmTrimColor,exteriorMask);",
        "}"
      ].join("\n"));
  };
  material.customProgramCacheKey=()=>KIT_STRIPE_SHADER_KEY;
  material.userData??={};
  material.userData.kitStripeUniforms=uniforms;
  material.needsUpdate=true;
  return uniforms;
}
// KM-23: the actual original GLB has V MINIMUM at the OUTER sleeve opening,
// not the V maximum (which is at the shoulder). The earlier high-V threshold
// painted the inner/upper band. All 38/39 and 62/63 material primitives must
// be included; otherwise the visible opposite face keeps its old colour.
// Front/back hem likewise occupies the low-V end of torso panels.
export const KIT_CUFF_BORDER_METRES=.012;
export const KIT_CUFF_FOLD_RETURN_METRES=.012;
export const KIT_TORSO_HEM_METRES=.024;
export function kitOuterTrimThreshold(metric,region){
  if(!Number.isFinite(metric?.highV)||!Number.isFinite(metric?.lowV)||
     !Number.isFinite(metric?.metresPerUvV)||metric.metresPerUvV<=0||
     metric.highV<=metric.lowV)
    throw new Error("Invalid original shirt trim fabric metric");
  if(region!=="cuffs"&&region!=="hem")
    throw new Error("Unsupported shirt outer trim region");
  const width=region==="cuffs"
    ?KIT_CUFF_BORDER_METRES+KIT_CUFF_FOLD_RETURN_METRES
    :KIT_TORSO_HEM_METRES;
  const threshold=metric.lowV+width/metric.metresPerUvV;
  if(threshold>=metric.highV)
    throw new Error("Shirt pattern is too short for exterior trim band");
  return threshold;
}
// Strictly identify garment shell primitives, not shoes, inner collar print,
// or other decorative pieces. Both author material primitives are necessary.
export function kitJerseyDetailRegion(name){
  if(/^FA_jersey__Pattern2D_380500[23](?:_\d+)?$/i.test(name))
    return "collar";
  if(/^FA_jersey__(?:38|39|62|63)(?:_\d+)?$/i.test(name))
    return "cuffs";
  if(/^FA_jersey__(?:9|10|42|43)(?:_\d+)?$/i.test(name))
    return "hem";
  return null;
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
  const base={},accent={},details={};
  for(const part of KIT_PARTS){
    base[part]=hexOrNull(state.colors?.[part]);
    accent[part]=hexOrNull(state.accentColors?.[part]);
    if(!base[part]||!accent[part]||
       !allowed.has(base[part])||!allowed.has(accent[part]))
      throw new Error("Kit colours must use club colours or allowed neutrals");
  }
  for(const detail of ["trim"]){
    details[detail]=hexOrNull(state.detailColors?.[detail]);
    if(!details[detail]||!allowed.has(details[detail]))
      throw new Error("Kit detail colours must use club colours or allowed neutrals");
  }
  const targets=collectGarmentMaterials(outfit);
  if(typeof THREE?.Color!=="function")
    throw new Error("THREE.Color required for Kit Maker rendering");
  // Preflight every fabric panel before editing ANY material.
  const prepared=targets.map(target=>({
    ...target,metric:cachedKitStripeMetric(target.geometry)
  }));
  for(const {material} of prepared)
    if(!material.userData&&Object.isFrozen(material))
      throw new Error("Kit Maker material cannot be edited");
  for(const {part,material,meshName,metric} of prepared){
    const uniforms=installKitStripeShader(material,THREE);
    const region=part==="jersey"?kitJerseyDetailRegion(meshName):null;
    uniforms.kmTrimRegion.value=region==="collar"?1:
      region==="cuffs"?2:region==="hem"?3:0;
    uniforms.kmTrimColor.value.set(region?details.trim:"#FFFFFF");
    uniforms.kmTrimEdgeV.value=region==="cuffs"||region==="hem"
      ?kitOuterTrimThreshold(metric,region):0;
    uniforms.kmStripeFabricOrigin.value=metric.originU;
    uniforms.kmStripeFabricScale.value=metric.metresPerUv;
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
