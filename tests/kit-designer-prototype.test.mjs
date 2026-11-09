import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { request } from "node:http";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createMannequinStudioServer } from "../tools/kit-designer-prototype/server.mjs";

const directory=new URL("../tools/kit-designer-prototype/",import.meta.url);
const load=name=>readFile(new URL(name,directory),"utf8");

test("new anatomical asset is a single ungarmented adult male mesh at exactly 180 cm",async()=>{
  const source=await load("mannequin-180.obj");
  assert.match(source,/MANNEQUIN-180.*adult male/);
  assert.match(source,/MakeHuman hm08 CC0/);
  const vertices=[];
  const faceLines=[];
  const groups=[];
  for(const line of source.split("\n")){
    if(line.startsWith("v "))vertices.push(line.slice(2).trim().split(/\s+/).map(Number));
    if(line.startsWith("f "))faceLines.push(line.slice(2).trim().split(/\s+/).map(Number));
    if(line.startsWith("g "))groups.push(line.slice(2).trim());
  }
  assert.ok(vertices.length>12500,"Need an actual anatomical mesh, not cylinders");
  assert.ok(faceLines.length>13000,"Keep realistic quad topology");
  assert.deepEqual(groups,["body"],"No helper clothes, eyes, hair or genital proxy");
  assert.ok(vertices.every(v=>v.length===3&&v.every(Number.isFinite)),"Finite geometry");
  const ymin=Math.min(...vertices.map(v=>v[1]));
  const ymax=Math.max(...vertices.map(v=>v[1]));
  assert.ok(Math.abs(ymin)<.00001,"Foot soles at ground level");
  assert.ok(Math.abs(ymax-1.8)<.00001,"Exact target height 1.80 m");
  for(const f of faceLines){
    assert.equal(f.length,4,"Preserve source anatomical quad topology");
    assert.ok(f.every(i=>Number.isInteger(i)&&i>=1&&i<=vertices.length));
  }
});

test("lowered arms remain symmetric, beside the hips and slightly apart",async()=>{
  const source=await load("mannequin-180.obj");
  const p=source.split("\n").filter(x=>x.startsWith("v "))
    .map(x=>x.slice(2).trim().split(/\s+/).map(Number));
  // Hands are at thigh height, rather than suspended at the shoulders.
  const section=p.filter(v=>v[1]>=.78&&v[1]<=.93);
  const right=section.filter(v=>v[0]>.26);
  const left=section.filter(v=>v[0]<-.26);
  assert.ok(right.length>100&&left.length>100,"Both lowered arms/hands must exist");
  const meanX=v=>v.reduce((s,p)=>s+p[0],0)/v.length;
  assert.ok(Math.abs(meanX(right)+meanX(left))<.008,"Symmetric relaxed stance");
  const mostLateral=Math.max(...section.map(v=>Math.abs(v[0])));
  assert.ok(mostLateral>.30&&mostLateral<.39,"Arms should hang near the hips");
  const torso=section.filter(v=>Math.abs(v[0])<.24);
  assert.ok(torso.length>50,"Thighs must remain in place");
  assert.ok(right.some(v=>v[0]>.29),"Keep a narrow gap between hands and thighs");
});

test("head and neck are part of the single anatomical mesh, with no geometric clothing",async()=>{
  const obj=await load("mannequin-180.obj");
  const vertices=obj.split("\n").filter(x=>x.startsWith("v "))
    .map(x=>x.slice(2).trim().split(/\s+/).map(Number));
  const radiusAt=y=>{
    const ring=vertices.filter(p=>Math.abs(p[1]-y)<.013);
    assert.ok(ring.length>35,"Anatomical head section at "+y);
    return Math.max(...ring.map(p=>Math.abs(p[0])));
  };
  const neck=radiusAt(1.56),head=radiusAt(1.68);
  assert.ok(neck<head&&neck>.035&&head<.110,"Natural neck-to-cranium proportions");
  assert.ok(vertices.some(v=>v[1]>1.79),"Cranium extends to target stature");
  assert.doesNotMatch(obj,/g (?:helper|clothing|shirt|shorts|pants)/i);
  const ui=await load("index.html");
  assert.match(ui,/Clothing<\/span><strong>None/);
  assert.doesNotMatch(ui,/id="(?:pattern|collar|primary|secondary|export|swap)"/);
  const javascript=await load("viewer.mjs");
  assert.ok(javascript.includes("mannequin-180.obj"));
  assert.ok(!javascript.includes("SphereGeometry")&&!javascript.includes("CylinderGeometry"));
  assert.ok(!javascript.includes("clothCanvas")&&!javascript.includes("kit-prototype"));
});


test("neutral face, chin and neck have continuous non-protruding profiles",async()=>{
  const obj=await load("mannequin-180.obj");
  const vertices=obj.split("\n").filter(line=>line.startsWith("v "))
    .map(line=>line.slice(2).trim().split(/\s+/).map(Number));
  const frontAt=y=>{
    const section=vertices.filter(([x,py])=>Math.abs(py-y)<.009&&Math.abs(x)<.020);
    assert.ok(section.length>0,"Missing central head cross-section at "+y);
    return Math.max(...section.map(p=>p[2]));
  };
  const z150=frontAt(1.50),z152=frontAt(1.52),z154=frontAt(1.54);
  const z156=frontAt(1.56),z160=frontAt(1.60),z162=frontAt(1.62);
  const z168=frontAt(1.68),z172=frontAt(1.72),z176=frontAt(1.76);
  assert.ok(z150<z152&&z152<z154&&z154<z156,
    "Neck and jaw must connect with a gradual forward slope");
  assert.ok(z154<.116&&z156<.130&&Math.abs(z154-z150)<.030,
    "Restore natural neck/chin continuity, not the old 15 cm projection");
  assert.ok(z160>.12&&z160<.14&&Math.abs(z162-z160)<.010,
    "Remove the old over-protruding flat face while retaining adult head volume");
  assert.ok(z168>=z160&&z172<z168&&z176<z172,
    "The forehead must round toward the crown rather than bulge forward");
  for(const y of [1.54,1.56,1.60,1.62,1.68,1.72]){
    const cheek=vertices.filter(([x,py,z])=>
      Math.abs(py-y)<.009&&Math.abs(x)>.032&&Math.abs(x)<.050&&z>.025);
    assert.ok(cheek.length>0,"Missing face side section at "+y);
    assert.ok(Math.max(...cheek.map(p=>p[2]))<=frontAt(y)+.005,
      "Cheeks must not protrude ahead of a neutral smooth face at "+y);
  }
});

test("arm-to-thigh clearance stays natural and body topology remains closed",async()=>{
  const obj=await load("mannequin-180.obj");
  const vertices=[],faces=[];
  for(const line of obj.split("\n")){
    if(line.startsWith("v "))vertices.push(line.slice(2).trim().split(/\s+/).map(Number));
    if(line.startsWith("f "))faces.push(line.slice(2).trim().split(/\s+/).map(Number));
  }
  const hipHeight=vertices.filter(v=>v[1]>=.80&&v[1]<=.87);
  const rightArm=hipHeight.filter(v=>v[0]>.265);
  const rightThigh=hipHeight.filter(v=>v[0]>=0&&v[0]<.225);
  assert.ok(rightArm.length>50&&rightThigh.length>30,"Need arm and thigh cross-sections");
  const clearance=Math.min(...rightArm.map(p=>p[0]))-Math.max(...rightThigh.map(p=>p[0]));
  assert.ok(clearance>.035&&clearance<.11,
    "Hands should stay slightly separated from the thighs, without an exaggerated gap");
  const edgeCounts=new Map();
  for(const face of faces){
    for(let i=0;i<4;i++){
      const a=face[i],b=face[(i+1)%4];
      const key=a<b?a+":"+b:b+":"+a;
      edgeCounts.set(key,(edgeCounts.get(key)||0)+1);
    }
  }
  assert.ok(edgeCounts.size>25000,"Authentic connected anatomical surface is required");
  assert.ok([...edgeCounts.values()].every(count=>count===2),
    "The head, neck and body must form a closed connected quad surface, without open seams");
});


test("reposed shoulder, elbow, wrist and hand form a relaxed bilateral arm axis",async()=>{
  const p=(await load("mannequin-180.obj")).split("\n").filter(x=>x.startsWith("v "))
    .map(x=>x.slice(2).trim().split(/\s+/).map(Number));
  const sample=(y,side)=>{
    const a=p.filter(([x,py])=>Math.abs(py-y)<.012&&x*side>.23);
    assert.ok(a.length>10,"Source arm must exist at "+y);
    return {
      x:a.reduce((s,v)=>s+v[0],0)/a.length,
      z:a.reduce((s,v)=>s+v[2],0)/a.length
    };
  };
  const hand=sample(.82,1),wrist=sample(.92,1),
    forearm=sample(1.05,1),elbow=sample(1.16,1),
    upper=sample(1.28,1),shoulder=sample(1.38,1);
  for(const y of [.82,.92,1.05,1.16,1.28,1.38]){
    const right=sample(y,1),left=sample(y,-1);
    assert.ok(Math.abs(right.x+left.x)<.004,"Left/right horizontal arm symmetry at "+y);
    assert.ok(Math.abs(right.z-left.z)<.004,"Left/right side-view arm symmetry at "+y);
  }
  assert.ok(hand.x>.28&&hand.x<.33&&wrist.x>.29&&wrist.x<.34,
    "Lowered hands and wrists must run alongside the hips, not extend outward");
  assert.ok(forearm.x>.28&&forearm.x<.34&&elbow.x>.28&&elbow.x<.34,
    "Forearm and elbow should follow the natural downward arm line");
  assert.ok(upper.x>.26&&upper.x<.32&&shoulder.x>.24&&shoulder.x<.30,
    "Upper arm retains a believable shoulder attachment");
  assert.ok(hand.z>.045&&hand.z<.13&&wrist.z>.045&&wrist.z<.13,
    "Hands and wrists must no longer project unnaturally in front of the thighs");
  assert.ok(Math.abs(forearm.z-elbow.z)<.065&&Math.abs(elbow.z-upper.z)<.065,
    "Elbow and forearm must form a gradual side-view bend");
});

test("new two-joint arms have smooth anatomical elbows without the screenshot bulge",async()=>{
  const obj=await load("mannequin-180.obj");
  assert.match(obj,/Two-bone articulated pose/,
    "Arms must be rebuilt from pristine anatomy, not warped incrementally");
  const p=obj.split("\n").filter(line=>line.startsWith("v "))
    .map(line=>line.slice(2).trim().split(/\s+/).map(Number));
  const section=(height,side)=>{
    const a=p.filter(v=>Math.abs(v[1]-height)<.012&&v[0]*side>.23);
    assert.ok(a.length>=10,"Missing arm anatomy at "+height);
    return {
      height,
      cx:a.reduce((s,v)=>s+v[0],0)/a.length,
      cz:a.reduce((s,v)=>s+v[2],0)/a.length,
      width:Math.max(...a.map(v=>v[0]*side))-Math.min(...a.map(v=>v[0]*side))
    };
  };
  const heights=[.82,.92,1.05,1.16,1.28,1.38];
  const right=heights.map(y=>section(y,1)),left=heights.map(y=>section(y,-1));
  for(let i=0;i<right.length;i++){
    assert.ok(Math.abs(right[i].cx+left[i].cx)<.003,
      "Arms must be horizontally symmetrical at "+heights[i]);
    assert.ok(Math.abs(right[i].cz-left[i].cz)<.003,
      "Arms must be symmetrical in side view at "+heights[i]);
    if(i===0)continue;
    assert.ok(Math.abs(right[i].cx-right[i-1].cx)<.060,
      "Arm centreline kinks outward at "+heights[i]);
    assert.ok(Math.abs(right[i].cz-right[i-1].cz)<.068,
      "Arm centreline jumps forward or backward at "+heights[i]);
  }
  const elbow=right[3],forearm=right[2],upper=right[4];
  assert.ok(elbow.width>.055&&elbow.width<.130,
    "Elbow must be formed by the natural joint instead of a bulbous cylinder");
  assert.ok(forearm.width>.045&&forearm.width<.110,
    "Forearm must taper towards the wrist without artificial swelling");
  assert.ok(elbow.cz>upper.cz-.012&&elbow.cz<right[1].cz+.025,
    "Elbow must follow a relaxed two-segment standing pose");
  assert.ok(right[0].cz>upper.cz&&right[1].cz>elbow.cz,
    "Hand and wrist should hang gently forward of the elbow");
});

test("blank head has no protruding eye, nose, mouth or ear features in its neutral envelope",async()=>{
  const p=(await load("mannequin-180.obj")).split("\n").filter(x=>x.startsWith("v "))
    .map(x=>x.slice(2).trim().split(/\s+/).map(Number));
  const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
  const rings=[
    [1.60,.060,.127,-.019],
    [1.62,.068,.131,-.022],
    [1.65,.086,.137,-.036],
    [1.68,.089,.136,-.044],
    [1.70,.087,.133,-.049]
  ];
  const envelope=(y,dim)=>{
    for(let j=1;j<rings.length;j++){
      const a=rings[j-1],b=rings[j];
      if(y<=b[0]){
        const t=smooth(a[0],b[0],y);
        return a[dim]+(b[dim]-a[dim])*t;
      }
    }
    return rings.at(-1)[dim];
  };
  for(const y of [1.62,1.68]){
    const surface=p.filter(([x,py,z])=>
      Math.abs(py-y)<.007&&z>.070&&Math.abs(x)<.056);
    assert.ok(surface.length>150,"Blank cranial surface requires dense anatomy at "+y);
    const residuals=surface.map(([x,py,z])=>{
      const rx=envelope(py,1),front=envelope(py,2),back=envelope(py,3);
      const center=(front+back)/2,rz=(front-back)/2;
      return Math.abs(Math.sqrt((x/rx)**2+((z-center)/rz)**2)-1)*rz;
    });
    const mean=residuals.reduce((a,b)=>a+b,0)/residuals.length;
    assert.ok(mean<.0011,"Unwanted facial relief at "+y+"m: "+mean);
    assert.ok(Math.max(...residuals)<.008,"Sharp protruding face features remain");
  }
  const obj=await load("mannequin-180.obj");
  assert.doesNotMatch(obj,/^(?:g|o) (?:eyes?|ears?|nose|mouth|hair|brows?|face-mask)(?:\s|$)/im,
    "The faceless mannequin must not use separate face-feature meshes");
});

test("viewer controls, scene status and module syntax are aligned",async()=>{
  const html=await load("index.html");
  const script=await load("viewer.mjs");
  assert.match(html,/<title>180 cm Mannequin Studio — Football Architect<\/title>/);
  for(const target of ['data-view="front"','data-view="back"','data-view="side"','data-view="reset"','id="viewport"','id="status"']){
    assert.ok(html.includes(target),"Missing viewer element "+target);
  }
  const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]));
  const references=[...script.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map(x=>x[1]);
  for(const id of references)assert.ok(ids.has(id),"Dangling DOM reference: "+id);
  assert.ok(!references.includes("export"));
  assert.match(script,/renderer\.setAnimationLoop/);
  assert.match(script,/controls\.enablePan=false/);
  // The rigged GLB default is checked through its rendered bounding-box height;
  // keep this test in sync with the active GLB path rather than the legacy OBJ.
  assert.match(script,/fetch\(studioAssets\+"mannequin-180\.glb"/);
  assert.ok(script.includes('location.pathname==="/dev/kit-maker"'));
  assert.match(script,/new GLTFLoader\(\)\.parseAsync\(bytes/);
  assert.match(script,/Math\.abs\(box\.max\.y-box\.min\.y-1\.8\)/);
  const syntax=spawnSync(process.execPath,["--check",fileURLToPath(new URL("viewer.mjs",directory))],{encoding:"utf8"});
  assert.equal(syntax.status,0,syntax.stderr);
});

test("loopback preview serves only 3D assets with safe routes",async t=>{
  const server=createMannequinStudioServer();
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const port=server.address().port;
  const origin="http://127.0.0.1:"+port;
  const page=await fetch(origin+"/");
  assert.equal(page.status,200);
  assert.match(await page.text(),/180 cm Mannequin Studio/);
  assert.match(page.headers.get("content-security-policy"),/default-src 'none'/);
  assert.ok(page.headers.get("content-security-policy").includes("script-src 'self' 'unsafe-inline'"),"The inline importmap must not be blocked by CSP");
  const moduleResponse=await fetch(origin+"/viewer.mjs");
  assert.equal(moduleResponse.status,200);
  assert.match(moduleResponse.headers.get("content-type"),/javascript/);
  assert.match(await moduleResponse.text(),/new OBJLoader/);
  const meshResponse=await fetch(origin+"/mannequin-180.obj");
  assert.equal(meshResponse.status,200);
  assert.match(await meshResponse.text(),/MANNEQUIN-180/);
  assert.equal((await fetch(origin+"/mannequin-180.obj",{method:"HEAD"})).status,200);
  assert.equal((await fetch(origin+"/dashboard")).status,404);
  assert.equal((await fetch(origin+"/base-body.obj")).status,404);
  assert.equal((await fetch(origin+"/",{method:"POST"})).status,405);
  const spoofed=await new Promise((resolve,reject)=>{
    const req=request({hostname:"127.0.0.1",port,path:"/",headers:{Host:"evil.example"}},res=>{
      res.resume();res.on("end",()=>resolve(res.statusCode));
    });
    req.on("error",reject);
    req.end();
  });
  assert.equal(spoofed,403);
});

test("ARM-06: bone-local forearm twist, elbow definition and bilateral topology",async()=>{
  const obj=await load("mannequin-180.obj");
  assert.match(obj,/ARM-06.*bone-local ring frames.*axial twist/);
  const vertices=[],faces=[];
  for(const line of obj.split("\n")){
    if(line.startsWith("v "))vertices.push(line.slice(2).trim().split(/\s+/).map(Number));
    if(line.startsWith("f "))faces.push(line.slice(2).trim().split(/\s+/).map(Number));
  }
  const edges=new Set();
  for(const f of faces)for(let k=0;k<4;k++){
    const a=f[k],b=f[(k+1)%4];
    edges.add(Math.min(a,b)+":"+Math.max(a,b));
  }
  const pairs=[...edges].map(pair=>pair.split(":").map(i=>vertices[Number(i)-1]));
  const section=(y,side)=>{
    const xs=[],zs=[];
    for(const [a,b] of pairs){
      if(!((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y)))continue;
      const t=(y-a[1])/(b[1]-a[1]),x=a[0]+t*(b[0]-a[0]);
      if(side*x<=(y>1.25?.21:.23))continue;
      xs.push(side*x);zs.push(a[2]+t*(b[2]-a[2]));
    }
    assert.ok(xs.length>=15,"Missing anatomical ring at "+y);
    return {width:Math.max(...xs)-Math.min(...xs),
      depth:Math.max(...zs)-Math.min(...zs),
      cx:(Math.max(...xs)+Math.min(...xs))/2,
      cz:(Math.max(...zs)+Math.min(...zs))/2};
  };
  const wrist=section(.96,1),mid=section(1.10,1),
    belly=section(1.125,1),elbow=section(1.18,1),
    upper=section(1.23,1);
  assert.ok(wrist.width>.040&&wrist.width<.052,"Preserve a slim distal wrist");
  assert.ok(mid.width>.080&&mid.width<.098,"Distinct proximal muscle belly");
  assert.ok(belly.width>.080&&belly.width<.098,"Forearm needs natural anatomical volume");
  assert.ok(elbow.width>.068&&elbow.width<.080&&elbow.depth<.087,
    "Maintain a slimmer cubital transition, not a forearm sleeve");
  assert.ok(belly.width>elbow.width+.006&&upper.width>elbow.width+.009,
    "Elbow profile must narrow between upper arm and forearm");
  assert.ok(elbow.cz<belly.cz&&belly.cz<wrist.cz,
    "Natural posterior elbow to slightly anterior wrist transition");
  for(let y=.96;y<1.24;y+=.01){
    const a=section(Number(y.toFixed(5)),1),
      b=section(Number((y+.01).toFixed(5)),1);
    assert.ok(Math.abs(a.width-b.width)<.015 &&
      Math.abs(a.depth-b.depth)<.015 &&
      Math.abs(a.cz-b.cz)<.015,
      "Cross-section kink along forearm at "+y.toFixed(2));
  }
  for(const y of [.96,1,1.035,1.07,1.10,1.125,1.15,1.18,1.205,1.23]){
    const right=section(y,1),left=section(y,-1);
    assert.ok(Math.abs(right.width-left.width)<.001 &&
      Math.abs(right.depth-left.depth)<.001 &&
      Math.abs(right.cx-left.cx)<.001 &&
      Math.abs(right.cz-left.cz)<.001,
      "Paired arms must remain mirrored at "+y);
  }
});

test("ARM-07: smoother forearm surface with bounded shape changes and symmetry",async()=>{
  const source=await load("mannequin-180.obj");
  assert.match(source,/ARM-07.*Taubin forearm surface fairing/);
  const vertices=[],faces=[];
  for(const line of source.split("\n")){
    if(line.startsWith("v "))vertices.push(line.slice(2).trim().split(/\s+/).map(Number));
    if(line.startsWith("f "))faces.push(line.slice(2).trim().split(/\s+/).map(Number));
  }
  assert.equal(vertices.length,13380);
  assert.equal(faces.length,13378);
  const adjacency=Array.from({length:vertices.length},()=>new Set()),edgeKeys=new Set();
  for(const f of faces)for(let k=0;k<4;k++){
    const a=f[k]-1,b=f[(k+1)%4]-1;
    adjacency[a].add(b);adjacency[b].add(a);
    edgeKeys.add(Math.min(a,b)+":"+Math.max(a,b));
  }
  const edges=[...edgeKeys].map(s=>s.split(":").map(Number));
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  const weight=([x,y])=>Math.abs(x)>.258&&y>.948&&y<1.18
    ?smooth((y-.948)/.052)*smooth((1.18-y)/.05):0;
  let roughness=0,count=0;
  for(let i=0;i<vertices.length;i++){
    if(weight(vertices[i])<.8)continue;
    let dx=0,dz=0;
    for(const j of adjacency[i]){
      dx+=vertices[j][0]-vertices[i][0];
      dz+=vertices[j][2]-vertices[i][2];
    }
    roughness+=Math.hypot(dx/adjacency[i].size,dz/adjacency[i].size);
    count++;
  }
  roughness/=count;
  assert.ok(count>=150&&roughness<.00170,
    "Residual angular forearm mesh roughness is excessive: "+roughness);
  const section=(y,side)=>{
    const xs=[],zs=[];
    for(const [a,b] of edges){
      const p=vertices[a],q=vertices[b];
      if(!((p[1]<=y&&q[1]>y)||(q[1]<=y&&p[1]>y)))continue;
      const t=(y-p[1])/(q[1]-p[1]),x=p[0]+(q[0]-p[0])*t;
      if(side*x<=.235)continue;
      xs.push(x*side);zs.push(p[2]+t*(q[2]-p[2]));
    }
    assert.ok(xs.length>=18,"Incomplete anatomical arm at "+y);
    return {w:Math.max(...xs)-Math.min(...xs),
      d:Math.max(...zs)-Math.min(...zs),
      cz:(Math.max(...zs)+Math.min(...zs))/2};
  };
  for(const y of [.96,1,1.04,1.07,1.1,1.125,1.15,1.17]){
    const right=section(y,1),left=section(y,-1);
    assert.ok(Math.abs(right.w-left.w)<.001&&Math.abs(right.d-left.d)<.001,
      "The smooth profile must remain bilaterally symmetric at "+y);
  }
  assert.ok(section(.96,1).w>.040&&section(.96,1).w<.055,
    "Do not lose wrist taper");
  assert.ok(section(1.10,1).w>.080&&section(1.10,1).w<.095,
    "Do not collapse the forearm muscle belly");
  assert.ok(section(1.17,1).d>.075&&section(1.17,1).d<.09,
    "Preserve soft elbow silhouette and depth");
});

test("ARM-08: realign both forearms without breaking the rounded side silhouette",async()=>{
  const obj=await load("mannequin-180.obj");
  assert.match(obj,/ARM-08.*rearward correction of the elbow-to-wrist axis/);
  const vertices=[],faces=[];
  for(const line of obj.split("\n")){
    if(line.startsWith("v "))vertices.push(line.slice(2).trim().split(/\s+/).map(Number));
    if(line.startsWith("f "))faces.push(line.slice(2).trim().split(/\s+/).map(Number));
  }
  const set=new Set();
  for(const f of faces)for(let i=0;i<4;i++){
    const a=f[i],b=f[(i+1)%4];
    set.add(Math.min(a,b)+":"+Math.max(a,b));
  }
  const edges=[...set].map(s=>s.split(":").map(i=>vertices[Number(i)-1]));
  const section=(y,side)=>{
    const xs=[],zs=[];
    for(const [a,b] of edges){
      if(!((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y)))continue;
      const t=(y-a[1])/(b[1]-a[1]),x=a[0]+t*(b[0]-a[0]);
      if(x*side<=(y>1.25?.21:.235))continue;
      xs.push(x*side);zs.push(a[2]+t*(b[2]-a[2]));
    }
    assert.ok(xs.length>=10,"Missing arm section at "+y);
    return {w:Math.max(...xs)-Math.min(...xs),
      d:Math.max(...zs)-Math.min(...zs),
      cz:(Math.max(...zs)+Math.min(...zs))/2};
  };
  const forearm=section(1.10,1),upper=section(1.23,1);
  const elbow=section(1.18,1),wrist=section(.96,1),hand=section(.82,1);
  const anteriorOffset=forearm.cz-upper.cz;
  assert.ok(anteriorOffset>.006&&anteriorOffset<.017,
    "Forearm anterior displacement remains excessive: "+anteriorOffset);
  assert.ok(Math.abs(wrist.cz-elbow.cz)<.009,
    "The wrist must now align with the elbow in Side view");
  assert.ok(hand.cz>.060&&hand.cz<.083,
    "Hands must move with forearm, avoiding a wrist kink");
  assert.ok(forearm.w>.080&&forearm.w<.095,
    "Maintain the rounded ARM-07 forearm volume");
  assert.ok(elbow.w>.072&&elbow.w<.082,
    "Maintain anatomically defined but not sharp elbow");
  for(const y of [.82,.92,.96,1.10,1.18,1.23,1.28]){
    const a=section(y,1),b=section(y,-1);
    assert.ok(Math.abs(a.w-b.w)<.001&&Math.abs(a.d-b.d)<.001&&
      Math.abs(a.cz-b.cz)<.001,"Both arms remain symmetric at "+y);
  }
});

test("SetPose comparison stays local: GLB/OBJ only, embedded resources, no upload endpoint",async t=>{
  const {validateLocalModelFile,validateStandaloneGLB,MAX_PREVIEW_BYTES}=
    await import("../tools/kit-designer-prototype/reference-import.mjs");
  assert.equal(MAX_PREVIEW_BYTES,40*1024*1024);
  assert.equal(validateLocalModelFile({name:"mannequin.glb",size:4096}),"glb");
  assert.equal(validateLocalModelFile({name:"anatomy.OBJ",size:4096}),"obj");
  assert.throws(()=>validateLocalModelFile({name:"pose.gltf",size:4096}),/self-contained/);
  assert.throws(()=>validateLocalModelFile({name:"test.glb",size:MAX_PREVIEW_BYTES+1}),/40 MB/);
  assert.throws(()=>validateLocalModelFile({name:"test.obj",size:0}),/nonempty/);
  const fakeGLB=data=>{
    const text=Buffer.from(JSON.stringify(data));
    const padded=Math.ceil(text.length/4)*4;
    const binary=Buffer.alloc(20+padded,32);
    binary.writeUInt32LE(0x46546c67,0);
    binary.writeUInt32LE(2,4);
    binary.writeUInt32LE(binary.length,8);
    binary.writeUInt32LE(padded,12);
    binary.writeUInt32LE(0x4e4f534a,16);
    text.copy(binary,20);
    return binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength);
  };
  assert.doesNotThrow(()=>validateStandaloneGLB(fakeGLB({
    asset:{version:"2.0"},buffers:[{byteLength:0}],images:[{uri:"data:image/png;base64,AA=="}]
  })));
  assert.throws(()=>validateStandaloneGLB(fakeGLB({
    buffers:[{uri:"https://example.com/private.bin"}]
  })),/external resource/);
  assert.throws(()=>validateStandaloneGLB(fakeGLB({
    images:[{uri:"texture.png"}]
  })),/external resource/);
  assert.throws(()=>validateStandaloneGLB(new ArrayBuffer(4)),/Invalid GLB header/);
  const ui=await load("index.html"),viewer=await load("viewer.mjs");
  assert.match(ui,/id="reference-file"/);
  assert.match(ui,/id="restore-base"/);
  assert.match(ui,/setpose\.com\/s\/0961e1ef/);
  assert.match(ui,/Nothing is uploaded, saved to GitHub or published/);
  assert.match(viewer,/GLTFLoader/);
  assert.match(viewer,/validateStandaloneGLB\(bytes\)/);
  assert.match(viewer,/file\.arrayBuffer\(\)/);
  assert.match(viewer,/file\.text\(\)/);
  assert.match(viewer,/1\.8\/sourceHeight/);
  assert.match(viewer,/normaliz(e|ation)Reference/);
  assert.match(viewer,/setActiveModel\(bundledModel\)/);
  const viewerSyntax=spawnSync(process.execPath,["--check",
    fileURLToPath(new URL("viewer.mjs",directory))],{encoding:"utf8"});
  assert.equal(viewerSyntax.status,0,viewerSyntax.stderr);
  const server=createMannequinStudioServer();
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url="http://127.0.0.1:"+server.address().port;
  assert.equal((await fetch(url+"/reference-import.mjs")).status,200);
  assert.equal((await fetch(url+"/upload")).status,404);
  assert.equal((await fetch(url+"/reference-import.mjs",{method:"POST"})).status,405);
});

test("MANNEQUIN-02: paired MakeHuman and Mixamo skinned arm chains with reversible pose controls",async()=>{
  const {findBilateralArmChains,targetArmVectors,createRiggedArmPose}=
    await import("../tools/kit-designer-prototype/rigged-arms.mjs");
  const node=(name,parent=null)=>({name,parent});
  const spine=node("spine01"),shoulderL=node("shoulder01.L",spine),
    shoulderR=node("shoulder01.R",spine);
  const upperL=node("upperarm01.L",shoulderL),
    upperR=node("upperarm01.R",shoulderR);
  const upperL2=node("upperarm02.L",upperL),
    upperR2=node("upperarm02.R",upperR);
  const lowerL=node("lowerarm01.L",upperL2),
    lowerR=node("lowerarm01.R",upperR2);
  const lowerL2=node("lowerarm02.L",lowerL),
    lowerR2=node("lowerarm02.R",lowerR);
  const wristL=node("wrist.L",lowerL2),
    wristR=node("wrist.R",lowerR2);
  const bones=[spine,shoulderL,shoulderR,upperL,upperR,
    upperL2,upperR2,lowerL,lowerR,lowerL2,lowerR2,wristL,wristR];
  const chains=findBilateralArmChains(bones);
  assert.ok(chains,"MakeHuman default upper/lower/wrist chains must be found");
  assert.equal(chains.left.upper,upperL);
  assert.equal(chains.left.lower,lowerL);
  assert.equal(chains.left.wrist,wristL);
  assert.equal(chains.right.upper,upperR);
  assert.equal(chains.right.lower,lowerR);
  assert.equal(chains.right.wrist,wristR);
  assert.equal(findBilateralArmChains(bones.filter(b=>b!==wristR)),null);
  assert.equal(findBilateralArmChains([...bones.filter(b=>b!==wristL),
    node("wrist.L",spine)]),null,"Disjoint wrist must not be accepted");
  const leftArm=node("mixamorigLeftArm"),leftFore=node("mixamorigLeftForeArm",leftArm),
    leftHand=node("mixamorigLeftHand",leftFore);
  const rightArm=node("mixamorigRightArm"),rightFore=node("mixamorigRightForeArm",rightArm),
    rightHand=node("mixamorigRightHand",rightFore);
  assert.ok(findBilateralArmChains([leftArm,leftFore,leftHand,rightArm,rightFore,rightHand]),
    "Mixamo naming must work too");
  const target=targetArmVectors("left");
  assert.ok(target.upper[1]<-.9&&target.lower[1]<-.9);
  assert.deepEqual(target.upper,[.18,-1,.01]);
  assert.deepEqual(target.lower,[.1,-1,.03]);
  assert.deepEqual(targetArmVectors("right"),target);
  assert.throws(()=>targetArmVectors("invalid"),/Unknown arm side/);
  assert.equal(createRiggedArmPose({traverse(fn){fn({isMesh:true});}},{}),null,
    "Unskinned GLBs and OBJ files must not activate rig controls");
  const html=await load("index.html"),viewer=await load("viewer.mjs"),
    server=await load("server.mjs");
  assert.match(html,/innerscene\.com\/tools\/library\/3d-parts\/male-base-mesh/);
  for(const id of ["relax-arms","restore-rig-pose","rig-info"]){
    assert.ok(html.includes('id="'+id+'"'),"Missing rig control "+id);
  }
  assert.match(viewer,/createRiggedArmPose\(root,THREE\)/);
  assert.match(viewer,/rig\.relax\(\)/);
  assert.match(viewer,/rig\.restore\(\)/);
  assert.match(viewer,/setFromObject\(model,true\)/);
  assert.match(server,/rigged-arms\.mjs/);
  for(const filename of ["viewer.mjs","rigged-arms.mjs"]){
    const syntax=spawnSync(process.execPath,["--check",
      fileURLToPath(new URL(filename,directory))],{encoding:"utf8"});
    assert.equal(syntax.status,0,syntax.stderr);
  }
});

test("MANNEQUIN-04: bundled default GLB keeps arms relaxed and slightly apart",async()=>{
  const {createHash}=await import("node:crypto");
  const {validateStandaloneGLB}=await import("../tools/kit-designer-prototype/reference-import.mjs");
  const bytes=await readFile(new URL("mannequin-180.glb",directory));
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "d242a684bb636bad4b183d5ab19996acdd2e9c049e0f94c8e133a3db8dbefaf3");
  const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const glb=validateStandaloneGLB(buffer);
  assert.equal(glb.skins.length,1);
  assert.equal(glb.skins[0].joints.length,163);
  assert.ok(glb.extras?.footballArchitect?.modification?.includes("arms lowered relaxed"));
  assert.deepEqual(glb.extras.footballArchitect.upperTarget,[.18,-1,.01]);
  assert.deepEqual(glb.extras.footballArchitect.lowerTarget,[.1,-1,.03]);
  const bones=new Map(glb.nodes.map(n=>[n.name,n]));
  for(const side of ["L","R"]){
    const upper=bones.get("upperarm01."+side),lower=bones.get("lowerarm01."+side);
    assert.ok(upper&&lower&&bones.get("wrist."+side));
    assert.ok(Math.abs(upper.rotation[2])>.48&&Math.abs(upper.rotation[2])<.49);
    assert.ok(Math.abs(lower.rotation[2])>.049&&Math.abs(lower.rotation[2])<.050);
  }
  const root=bones.get("base_male_body.rig");
  assert.deepEqual(root.scale,[1.0082009620848544,1.0082009620848544,1.0082009620848544]);
  const script=await load("viewer.mjs");
  assert.ok(script.includes('fetch(studioAssets+"mannequin-180.glb"'));
  assert.ok(script.includes("alreadyPosed?null:createRiggedArmPose"));
  const http=createMannequinStudioServer();
  await new Promise(resolve=>http.listen(0,"127.0.0.1",resolve));
  try{
    const response=await fetch("http://127.0.0.1:"+http.address().port+"/mannequin-180.glb");
    assert.equal(response.status,200);
    assert.match(response.headers.get("content-type"),/model\/gltf-binary/);
    assert.equal((await response.arrayBuffer()).byteLength,bytes.byteLength);
  }finally{await new Promise(resolve=>http.close(resolve));}
});
