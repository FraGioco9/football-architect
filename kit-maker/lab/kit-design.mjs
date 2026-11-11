import {findOriginalSewnTrimFaces} from './kit-trim-geometry.mjs';
import {alignOriginalShoulderStripes} from './kit-stripe-seams.mjs';
import {classifyOriginalJerseySurfaces} from './kit-stripe-surfaces.mjs';
// KM-17: DEV-only kit geometry styles. All colours are canonical club roles
// or the fixed local neutral allowlist. No arbitrary colour picker or writes.
export const KIT_PARTS=Object.freeze(["jersey","shorts","socks"]);
export const KIT_STYLES=Object.freeze([
  Object.freeze({id:"solid",label:"Solid"}),
  Object.freeze({id:"vertical-stripes",label:"Vertical stripes"})
]);
export const KIT_STRIPE_WIDTH_RANGE=Object.freeze({minMm:10,maxMm:150,stepMm:5,defaultMm:75});
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
      result.push({material,part,meshName:mesh.name,geometry:mesh.geometry,mesh});
    present.add(part);
  });
  if(KIT_PARTS.some(part=>!present.has(part)))
    throw new Error("Kit Maker outfit is missing a garment category");
  return result;
}

// Original cloth UV metrics retain physical-band widths on sleeves,
// shorts and socks. KM-38's torso uses a signed X-based centerline
// stripe coordinate for uniform, straight, symmetric front/back bands.
// Planar X compresses cloth width on curved flanks; the original
// source UV, vertex positions, normals and GLB are never altered.
export const KIT_STRIPE_SHADER_KEY="km41-original-shoulder-edge-return-v1";
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
export function installKitStripeShader(material,THREE,
  hasSewnCoordinates=false,hasExteriorMask=false){
  // No 3D seam analysis while the Solid model is first loading.
  // Upgrade the existing shader program when stripes are selected.
  if(material.userData?.kitStripeUniforms){
    const previous=Boolean(material.userData.kitStripeSewnCoordinates),
      previousExterior=Boolean(material.userData.kitStripeExteriorMask);
    if(previous!==Boolean(hasSewnCoordinates)||
       previousExterior!==Boolean(hasExteriorMask)){
      material.userData.kitStripeSewnCoordinates=Boolean(hasSewnCoordinates);
      material.userData.kitStripeExteriorMask=Boolean(hasExteriorMask);
      material.needsUpdate=true;
    }
    return material.userData.kitStripeUniforms;
  }
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
    kmStripeSideRadius:{value:0},
    kmStripeTorsoLow:{value:new Float32Array(4)},
    kmStripeTorsoHigh:{value:new Float32Array(4)},
    kmStripeTorsoCenterX:{value:0},
    kmTrimRegion:{value:0},

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
    const useSewn=Boolean(this.userData?.kitStripeSewnCoordinates),
      protectInterior=Boolean(this.userData?.kitStripeExteriorMask),
      doubleSided=Number.isInteger(THREE?.DoubleSide)&&this.side===THREE.DoubleSide;
    shader.vertexShader=(useSewn?
      "attribute float kmStripeSewnMetres;\nvarying vec3 vKmTorsoWorld;\n"+
      "attribute float kmStripeShoulderTopY;\nvarying float vKmStripeShoulderTopY;\n":"")+
      (protectInterior?
        "attribute float kmJerseyExteriorMask;\nvarying float vKmJerseyExteriorMask;\n":"")+
      "varying float vKmPatternU;\n"+
      shader.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\n "+
          (useSewn?"vKmPatternU = kmStripeSewnMetres;\n"+
            "vKmTorsoWorld = (modelMatrix * vec4(position, 1.0)).xyz;\n"+
            "vKmStripeShoulderTopY = kmStripeShoulderTopY;":
            "vKmPatternU = uv.x;")+
          (protectInterior?"\nvKmJerseyExteriorMask = kmJerseyExteriorMask;":""));
    shader.fragmentShader=[
      "varying float vKmPatternU;",
      ...(useSewn?["varying vec3 vKmTorsoWorld;",
        "varying float vKmStripeShoulderTopY;"]:[]),
      ...(protectInterior?["varying float vKmJerseyExteriorMask;"]:[]),
      "uniform float kmTrimRegion;",
      "uniform vec3 kmTrimColor;",
      "uniform float kmStripeEnabled;",
      "uniform float kmStripeWidth;",
      "uniform float kmStripeFabricOrigin;",
      "uniform float kmStripeFabricScale;",
      "uniform float kmStripeSideRadius;",
      "uniform vec4 kmStripeTorsoLow;",
      "uniform vec4 kmStripeTorsoHigh;",
      "uniform float kmStripeTorsoCenterX;",
      "uniform vec3 kmStripeBase;",
      "uniform vec3 kmStripeAccent;"
    ].join("\n")+"\n"+shader.fragmentShader.replace("#include <color_fragment>",
      [
        "#include <color_fragment>",
        "if(kmStripeEnabled > 0.5){",
        "  float distanceOnFabric=(vKmPatternU-kmStripeFabricOrigin)*kmStripeFabricScale;",
        ...(useSewn?[
        // KM-40: x-only arcs plateau at the flank where dx/ds=0.
        // Use the real torso X AND Z, plus fitted 2-height ellipses,
        // to advance the stripe phase continuously front->side->back.
        // This is evaluated per fragment: source UV/vertex buffers remain
        // untouched, and interpolation cannot invent a side cusp.
        "  if(kmStripeTorsoLow.x > 0.0 && kmStripeTorsoLow.y > 0.0){",
        "    float sectionT=clamp((vKmTorsoWorld.y-kmStripeTorsoLow.w)/max(kmStripeTorsoHigh.w-kmStripeTorsoLow.w,0.001),0.0,1.0);",
        "    vec3 section=mix(kmStripeTorsoLow.xyz,kmStripeTorsoHigh.xyz,sectionT);",
        "    float theta=atan((vKmTorsoWorld.x-kmStripeTorsoCenterX)/section.x,(vKmTorsoWorld.z-section.z)/section.y);",
        "    float refX=0.5*(kmStripeTorsoLow.x+kmStripeTorsoHigh.x);",
        "    float refZ=0.5*(kmStripeTorsoLow.y+kmStripeTorsoHigh.y);",
        // Elliptical arc approximation: derivative near FRONT = refX,
        // near SIDE = refZ. No 'asin' cap, no mirrored side bands.
        "    float meanRadius=0.5*(refX+refZ);",
        "    float arc=theta*meanRadius+0.25*(refX-refZ)*sin(2.0*theta);",
        // KM-38 exact nominal central band is retained even if a
        // shoulder/waist taper changes the fitted ellipse ratio.
        "    float directX=vKmTorsoWorld.x-kmStripeTorsoCenterX;",
        "    float blend=max(smoothstep(0.095,0.130,abs(directX)),smoothstep(1.5707963,1.69,abs(theta)));",
        "    arc=mix(directX,arc,blend);",
        // Wrap phase at back midline. Adjust ONLY the rear half of
        // the circumference, leaving front & flank nominal width
        // untouched. Even band count centers a PRIMARY stripe at
        // both front and back, with a seamless rear closure.
        "    float halfArc=3.141592653589793*meanRadius;",
        "    float evenBands=2.0*max(1.0,floor(halfArc/(2.0*kmStripeWidth)+0.5));",
        "    float rearShift=evenBands*kmStripeWidth-halfArc;",
        "    float rearBlend=smoothstep(0.5*halfArc,halfArc,abs(arc));",
        "    distanceOnFabric=arc+sign(arc)*rearShift*rearBlend;",
        "  }",
        // Fragment-space distance from the original upper shoulder
        // edge. Blend over exactly 3-25mm of physical Y even on coarse
        // triangles: vertex-interpolated weights would extend too far
        // down the chest. This corrects the original front/back seam
        // only; sleeves retain untouched UV pattern.
        "  if(vKmStripeShoulderTopY > 0.0){",
        "    float seamDepth=max(0.0,vKmStripeShoulderTopY-vKmTorsoWorld.y);",
        "    float seamWeight=1.0-smoothstep(0.003,0.025,seamDepth);",
        "    distanceOnFabric=mix(distanceOnFabric,vKmPatternU,seamWeight);",
        "  }"
        ]:[]),
        "  float wave=cos(3.141592653589793*distanceOnFabric/kmStripeWidth);",
        "  float edge=max(fwidth(wave),0.002);",
        "  float alternate=smoothstep(-edge,edge,-wave);",
        "  diffuseColor.rgb=mix(kmStripeBase,kmStripeAccent,alternate);",
        "}",
        "if(kmTrimRegion > 0.5 && kmTrimRegion < 1.5){",
        "  diffuseColor.rgb=kmTrimColor;",
        "}",
        ...(protectInterior?[
          // White means the model's ORIGINAL neutral inside. Both Solid
          // and stripes must paint only OUTSIDE. The original two-sided
          // cloth may expose its reverse face when viewed through collar.
          "if(vKmJerseyExteriorMask < 0.5"+
            (doubleSided?" || !gl_FrontFacing":"")+"){",
          "  diffuseColor.rgb=vec3(1.0);",
          "}"
        ]:[])
      ].join("\n"));
  };
  material.userData??={};
  material.userData.kitStripeSewnCoordinates=Boolean(hasSewnCoordinates);
  material.userData.kitStripeExteriorMask=Boolean(hasExteriorMask);
  material.customProgramCacheKey=()=>KIT_STRIPE_SHADER_KEY+
    (material.userData?.kitStripeSewnCoordinates?"-sewn":"-plain")+
    (material.userData?.kitStripeExteriorMask?"-exterior":"");
  material.userData.kitStripeUniforms=uniforms;
  material.needsUpdate=true;
  return uniforms;
}
// KM-27: colour ONLY existing sewn fold faces, selected from the actual
// source triangle topology. The private glTF geometry stays unmodified:
// separate small coplanar MeshStandardMaterial overlays receive the trim.
const authorTrimOverlayCache=new WeakMap();
function makeOriginalTrimOverlay(entry,triangles,THREE,name){
  if(!triangles.length)return null;
  const geometry=entry.geometry,position=geometry.getAttribute("position"),
    normal=geometry.getAttribute("normal"),index=geometry.index,
    exteriorMask=geometry.getAttribute?.("kmJerseyExteriorMask");
  const positions=[],normals=[],exterior=[];
  for(const tri of triangles)for(let corner=0;corner<3;corner++){
    const i=index?index.getX(tri*3+corner):tri*3+corner;
    positions.push(position.getX(i),position.getY(i),position.getZ(i));
    if(normal)normals.push(normal.getX(i),normal.getY(i),normal.getZ(i));
    if(exteriorMask)exterior.push(exteriorMask.getX(i));
  }
  const buffer=new THREE.BufferGeometry();
  buffer.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  if(normal)buffer.setAttribute("normal",new THREE.Float32BufferAttribute(normals,3));
  else buffer.computeVertexNormals();
  if(exteriorMask)buffer.setAttribute("kmJerseyExteriorMask",
    new THREE.Float32BufferAttribute(exterior,1));
  const material=new THREE.MeshStandardMaterial({
    name:"km27-sewn-trim-overlay-"+name,
    color:"#FFFFFF",roughness:.85,metalness:0,
    side:THREE.DoubleSide,polygonOffset:true,
    polygonOffsetFactor:-1,polygonOffsetUnits:-1,
    depthWrite:false
  });
  if(exteriorMask){
    // Original trim fold overlays also have a visible RETURN/lining.
    // Protect their reverse sides just like the shirt fabric, without
    // removing the approved curved original cuff/hem contours.
    material.onBeforeCompile=shader=>{
      shader.vertexShader=
        "attribute float kmJerseyExteriorMask;\nvarying float vKmTrimExterior;\n"+
        shader.vertexShader.replace("#include <begin_vertex>",
          "#include <begin_vertex>\nvKmTrimExterior=kmJerseyExteriorMask;");
      shader.fragmentShader="varying float vKmTrimExterior;\n"+
        shader.fragmentShader.replace("#include <color_fragment>",
          "#include <color_fragment>\n"+
          "if(vKmTrimExterior < 0.5 || !gl_FrontFacing) "+
          "diffuseColor.rgb=vec3(1.0);");
    };
    material.customProgramCacheKey=()=>
      "km39-exterior-source-fold-trim-v1";
  }
  const overlay=new THREE.Mesh(buffer,material);
  overlay.name="km27-author-sewn-fold-"+name;
  overlay.frustumCulled=false;
  overlay.castShadow=false;
  overlay.receiveShadow=false;
  overlay.renderOrder=(entry.mesh.renderOrder??0)+1;
  entry.mesh.add(overlay);
  return {mesh:overlay,material,triangles:triangles.length};
}
function colourOriginalSewnTrims(outfit,prepared,THREE,color){
  let cached=authorTrimOverlayCache.get(outfit);
  if(!cached){
    cached={materials:[],report:{}};
    // No synthetic fallback: without real Three.js geometry the collar
    // alone remains coloured and this state is reported explicitly.
    const canInspectOriginalMesh=typeof THREE?.Mesh==="function"&&
      typeof THREE?.BufferGeometry==="function"&&
      typeof THREE?.Float32BufferAttribute==="function";
    if(canInspectOriginalMesh){
      outfit.updateMatrixWorld?.(true);
      const groups={right:[],left:[],waist:[]};
      const seen=new Set();
      for(const {part,meshName,mesh,geometry} of prepared){
        if(part!=="jersey"||!mesh||seen.has(mesh))continue;
        seen.add(mesh);
        const region=kitJerseyDetailRegion(meshName);
        const key=region==="cuffs"
          ?(stripeSectionForMesh(meshName)===1?"right":"left")
          :region==="hem"?"waist":null;
        if(key)groups[key].push({mesh,meshName,geometry});
      }
      for(const [key,entries] of Object.entries(groups)){
        if(!entries.length){cached.report[key]={status:"missing-original-mesh"};continue;}
        try{
          const result=findOriginalSewnTrimFaces(entries,
            key==="waist"?"waist":"cuffs");
          let painted=0;
          for(const [entry,triangles] of result.selected){
            const record=makeOriginalTrimOverlay(entry,triangles,THREE,key);
            if(record){cached.materials.push(record.material);painted+=record.triangles;}
          }
          cached.report[key]={status:painted>0?"source-fold-faces":"no-source-fold-faces",
            triangles:painted,...result.evidence};
        }catch(error){
          // A failure must NEVER reinstate the inaccurate 24mm band.
          cached.report[key]={status:"not-detected",reason:String(error?.message||error)};
        }
      }
    }else cached.report={status:"3d-source-inspector-unavailable"};
    authorTrimOverlayCache.set(outfit,cached);
    outfit.userData??={};
    outfit.userData.km27SourceTrimReport=cached.report;
    // Unit tests intentionally use tiny Three.js mocks, not a WebGL
    // renderer. Only warn when a real source inspection was attempted.
    if(canInspectOriginalMesh){
      if(cached.materials.length)console.info("Kit Maker original sewn trims",cached.report);
      else console.warn("Kit Maker: no authored trim faces recognised",cached.report);
    }
  }
  for(const material of cached.materials)material.color.set(color);
  return cached.report;
}
// KM-25: The actual cuff and waist edges are curved 3D contours, not
// global planes or atlas-V cuts. A new shader attribute holds the 3D
// distance from each garment's local rim. All original buffers are intact.
export const KIT_CUFF_BORDER_METRES=.012;
export const KIT_CUFF_FOLD_RETURN_METRES=.012;
export const KIT_TORSO_HEM_METRES=.024;
const RIM_BINS=360,TAU=2*Math.PI;
const rimCache=new WeakMap();
function sector(angle){
  return Math.min(RIM_BINS-1,Math.floor(((angle/TAU+1)%1)*RIM_BINS));
}
function contour(raw,isMaximum){
  const populated=[];
  for(let i=0;i<RIM_BINS;i++)if(Number.isFinite(raw[i]))populated.push(i);
  if(populated.length<2)throw new Error("Insufficient physical rim coverage");
  for(let i=0;i<RIM_BINS;i++){
    if(Number.isFinite(raw[i]))continue;
    let best=Infinity,near=populated[0];
    for(const j of populated){
      const d=Math.min(Math.abs(j-i),RIM_BINS-Math.abs(j-i));
      if(d<best){best=d;near=j;}
    }
    raw[i]=raw[near];
  }
  return raw.map((_,i)=>{
    const prev=raw[(i+RIM_BINS-1)%RIM_BINS],next=raw[(i+1)%RIM_BINS];
    return isMaximum?Math.max(prev,raw[i],next):Math.min(prev,raw[i],next);
  });
}
function average3(points){
  const sum=[0,0,0];
  for(const p of points)for(let i=0;i<3;i++)sum[i]+=p[i];
  return sum.map(x=>x/points.length);
}
function normalize3(p){
  const size=Math.hypot(...p);
  if(size<.01)throw new Error("Degenerate sleeve physical axis");
  return p.map(x=>x/size);
}
export function measureKitPhysicalRimDistances(geometries,region){
  if(!Array.isArray(geometries)||!geometries.length||
      !["cuffs","hem"].includes(region))
    throw new Error("Invalid physical jersey rim region");
  const perMesh=new Map(),samples=[];
  for(const geometry of new Set(geometries)){
    const pos=geometry?.getAttribute?.("position");
    if(!pos||pos.count<3)throw new Error("Physical rim requires original positions");
    const points=[];
    for(let i=0;i<pos.count;i++){
      const p=[pos.getX(i),pos.getY(i),pos.getZ(i)];
      if(!p.every(Number.isFinite))throw new Error("Nonfinite jersey rim point");
      points.push(p);samples.push(p);
    }
    perMesh.set(geometry,points);
  }
  if(samples.length<6)throw new Error("Insufficient physical rim vertices");
  const centre=average3(samples),bins=Array(RIM_BINS).fill(
    region==="cuffs"?-Infinity:Infinity);
  let coordinate,angular,isMaximum;
  if(region==="hem"){
    let xmin=Infinity,xmax=-Infinity,zmin=Infinity,zmax=-Infinity;
    for(const p of samples){
      xmin=Math.min(xmin,p[0]);xmax=Math.max(xmax,p[0]);
      zmin=Math.min(zmin,p[2]);zmax=Math.max(zmax,p[2]);
    }
    const cx=(xmin+xmax)/2,cz=(zmin+zmax)/2;
    coordinate=p=>p[1];
    angular=p=>sector(Math.atan2(p[2]-cz,p[0]-cx));
    isMaximum=false;
  }else{
    // Use the arm's physical sign: original L/R labels may be reversed
    // relative to the camera and cannot determine its outward direction.
    const sign=centre[0]>=0?1:-1;
    const xs=samples.map(p=>sign*p[0]).sort((a,b)=>a-b);
    const near=xs[Math.floor((xs.length-1)*.12)];
    const far=xs[Math.floor((xs.length-1)*.88)];
    const shoulder=samples.filter(p=>sign*p[0]<=near);
    const distal=samples.filter(p=>sign*p[0]>=far);
    if(shoulder.length<3||distal.length<3)
      throw new Error("Insufficient sleeve samples");
    const a=average3(shoulder),b=average3(distal),
      axis=normalize3(b.map((v,i)=>v-a[i]));
    if(axis[0]*sign<.3)throw new Error("Sleeve direction not outward");
    const u=normalize3([-axis[1],axis[0],0]);
    const v=[-axis[2]*u[1],axis[2]*u[0],axis[0]*u[1]-axis[1]*u[0]];
    const dot=(p,q)=>p[0]*q[0]+p[1]*q[1]+p[2]*q[2];
    coordinate=p=>dot(p,axis);
    angular=p=>{
      const relative=p.map((x,i)=>x-centre[i]);
      return sector(Math.atan2(dot(relative,v),dot(relative,u)));
    };
    isMaximum=true;
  }
  for(const p of samples){
    const k=angular(p),c=coordinate(p);
    bins[k]=isMaximum?Math.max(bins[k],c):Math.min(bins[k],c);
  }
  const border=contour(bins,isMaximum),result=new Map();
  for(const [geometry,points] of perMesh){
    const d=new Float32Array(points.length);
    for(let i=0;i<points.length;i++){
      const q=coordinate(points[i]),edge=border[angular(points[i])];
      d[i]=Math.max(0,isMaximum?edge-q:q-edge);
    }
    result.set(geometry,d);
  }
  return result;
}
function cachedKitPhysicalRimDistances(outfit,prepared){
  const found=rimCache.get(outfit);
  if(found)return found;
  const groups={right:[],left:[],hem:[]};
  for(const {part,meshName,geometry} of prepared){
    if(part!=="jersey")continue;
    const region=kitJerseyDetailRegion(meshName);
    if(region==="cuffs")
      groups[stripeSectionForMesh(meshName)===1?"right":"left"].push(geometry);
    else if(region==="hem")groups.hem.push(geometry);
  }
  const result=new Map();
  for(const [key,geometries] of Object.entries(groups)){
    if(!geometries.length)continue;
    const samples=measureKitPhysicalRimDistances(geometries,
      key==="hem"?"hem":"cuffs");
    for(const [geometry,distances] of samples){
      if(result.has(geometry))
        throw new Error("Shared geometry overlaps different trim regions");
      result.set(geometry,distances);
    }
  }
  rimCache.set(outfit,result);
  return result;
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
  // First classify original jersey OUTSIDE vs lining by the source
  // normal orientation, including on sleeves and collar. This is cheap
  // and cached, so Solid first paint does not wait for seam fitting.
  const garmentSurfaces=classifyOriginalJerseySurfaces(outfit,prepared);
  outfit.userData??={};
  outfit.userData.km39ExteriorReport=garmentSurfaces.report;
  if(typeof THREE?.Mesh==="function"&&!outfit.userData.km39ExteriorLogged){
    outfit.userData.km39ExteriorLogged=true;
    console.info("Kit Maker original exterior/lining normals",garmentSurfaces.report);
    if(garmentSurfaces.report.missingNormals.length)
      console.warn("Kit Maker: jersey surfaces without source normals",
        garmentSurfaces.report.missingNormals);
  }
  if(typeof THREE?.Float32BufferAttribute==="function"){
    for(const [geometry,mask] of garmentSurfaces.masks)
      if(typeof geometry.setAttribute==="function"&&
         !geometry.getAttribute?.("kmJerseyExteriorMask"))
        geometry.setAttribute("kmJerseyExteriorMask",
          new THREE.Float32BufferAttribute(mask,1));
  }
  // Install narrow overlays on actual sewn faces, never create a fake rim mask.
  colourOriginalSewnTrims(outfit,prepared,THREE,details.trim);
  // KM-40: the exact central torso stripe retains the signed original
  // X reference. Around each curved side, a shared front/back XZ
  // circumference coordinate prevents duplicated and converging bands.
  // Upper/lower source cross sections reduce height-dependent drift.
  // Sleeves remain fully independent in their original UV patterns.
  let shoulder={adjustments:new Map(),coordinates:new Map(),
    report:{status:"inactive"}};
  const canBindSewnCoordinates=typeof THREE?.Float32BufferAttribute==="function";
  // Solid first paint never runs stripe mapping; the private source GLB
  // loads normally. In Vertical stripes only the torso coordinates are
  // derived (and cached) without GLB reload or sleeve matching.
  if(canBindSewnCoordinates&&state.styles.jersey==="vertical-stripes"){
    try{
      shoulder=alignOriginalShoulderStripes(outfit,prepared);
      outfit.userData??={};
      outfit.userData.km29ShoulderStripeReport=shoulder.report;
      outfit.userData.km31ShoulderStripeReport=shoulder.report;
      outfit.userData.km32ShoulderOriginReport=shoulder.report.shoulderReference;
      outfit.userData.km36TorsoStartReport=shoulder.report.torsoShoulderStart;
      outfit.userData.km37StripeReport=shoulder.report;
      outfit.userData.km38TorsoCenterlineReport=shoulder.report.torsoShoulderStart;
      outfit.userData.km40FlankStripeReport={
        status:shoulder.report.torsoShoulderStart?.sideCorrection??"not-detected",
        sections:shoulder.report.torsoShoulderStart?.torsoSections??null
      };
      outfit.userData.km41ShoulderSeamReport=
        shoulder.report.torsoShoulderStart?.shoulderSeam??{
          status:"unverified-shoulder-contour"};
      if(typeof THREE?.Mesh==="function"&&!outfit.userData.km38StripeLogged){
        outfit.userData.km38StripeLogged=true;
        console.info("Kit Maker torso side-seam stripes",shoulder.report);
      }
    }catch(error){
      const reason=String(error?.message??error);
      if(typeof THREE?.Mesh==="function")
        console.warn("Kit Maker shoulder stripe calibration skipped:",reason);
      outfit.userData??={};
      outfit.userData.km29ShoulderStripeReport={status:"skipped",reason};
      outfit.userData.km31ShoulderStripeReport={status:"skipped",reason};
      outfit.userData.km32ShoulderOriginReport={status:"skipped",reason};
      outfit.userData.km37StripeReport={status:"skipped",reason};
      outfit.userData.km38TorsoCenterlineReport={status:"skipped",reason};
      outfit.userData.km40FlankStripeReport={status:"skipped",reason};
      outfit.userData.km41ShoulderSeamReport={status:"skipped",reason};
    }
  }
  // Signed torso X keeps the central primary stripe straight and
  // free of midline interpolation cusps. The WebGL shader adds the
  // height-calibrated XZ circumference field only at the flank/back.
  // Both sleeves retain the original UV shader variant.
  if(canBindSewnCoordinates&&shoulder.report.status==="torso-straight"){
    for(const [geometry,metres] of shoulder.coordinates){
      const p=geometry.getAttribute?.("position");
      if(!p||p.count!==metres.length||
          typeof geometry.setAttribute!=="function")continue;
      if(!geometry.getAttribute("kmStripeSewnMetres"))
        geometry.setAttribute("kmStripeSewnMetres",
          new THREE.Float32BufferAttribute(metres,1));
      if(!geometry.getAttribute("kmStripeShoulderTopY")){
        const top=shoulder.shoulderTopHeightsByGeometry?.get(geometry)??
          new Float32Array(metres.length).fill(-10);
        geometry.setAttribute("kmStripeShoulderTopY",
          new THREE.Float32BufferAttribute(top,1));
      }
    }
  }
  for(const {part,material,meshName,metric,geometry} of prepared){
    const region=part==="jersey"?kitJerseyDetailRegion(meshName):null;
    const sewn=part==="jersey"&&
      /^FA_jersey__(?:9|10|42|43)(?:_\d+)?$/i.test(meshName)&&
      Boolean(geometry.getAttribute?.("kmStripeSewnMetres"));
    const exterior=part==="jersey"&&
      Boolean(geometry.getAttribute?.("kmJerseyExteriorMask"));
    const uniforms=installKitStripeShader(material,THREE,sewn,exterior);
    uniforms.kmTrimRegion.value=region==="collar"?1:
      region==="cuffs"?2:region==="hem"?3:0;
    uniforms.kmTrimColor.value.set(region?details.trim:"#FFFFFF");

    const aligned=part==="jersey"?shoulder.adjustments.get(geometry):null;
    uniforms.kmStripeFabricOrigin.value=sewn?0:(aligned?.originU??metric.originU);
    uniforms.kmStripeFabricScale.value=sewn?1:
      (aligned?.metresPerUv??metric.metresPerUv);
    const footprint=sewn?
      shoulder.report.torsoShoulderStart?.torsoSections:null;
    uniforms.kmStripeSideRadius.value=sewn?
      (shoulder.report.torsoShoulderStart?.sideRadiusM??0):0;
    uniforms.kmStripeTorsoLow.value.set(footprint?
      [footprint.low.rx,footprint.low.rz,footprint.low.cz,footprint.low.y]:
      [0,0,0,0]);
    uniforms.kmStripeTorsoHigh.value.set(footprint?
      [footprint.high.rx,footprint.high.rz,footprint.high.cz,footprint.high.y]:
      [0,0,0,0]);
    uniforms.kmStripeTorsoCenterX.value=sewn?
      (shoulder.report.torsoShoulderStart?.centerWorldXM??0):0;
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
