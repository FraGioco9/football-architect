// KM-04 intake: inspect Alberto Sena's ORIGINAL soccer-kit download locally.
// Inventory only. Never import unknown bytes into the app or infer a license.
// Usage: node tools/kit-designer-prototype/inspect-sena-kit.mjs path/to/kit.gltf
// Supports .gltf (with adjacent textures) and .glb, without external deps.
import {readFileSync,statSync} from 'node:fs';
import {basename,dirname,extname,isAbsolute,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export const SENA_SOURCE='https://www.behance.net/gallery/229397033/Free-Soccer-Kit';
const MAX_BYTES=250*1024*1024;
const TYPES=Object.freeze({
  jersey:/(?:^|[^a-z])(jersey|shirt|t.?shirt|camiseta|camisa|maglia)(?:$|[^a-z])/i,
  shorts:/(?:^|[^a-z])(shorts?|pantaloncini|pantalones?|pants)(?:$|[^a-z])/i,
  socks:/(?:^|[^a-z])(socks?|stockings|calcetines?|medias|calzettoni)(?:$|[^a-z])/i,
  boots:/(?:^|[^a-z])(boots?|cleats?|shoes?|botas?|scarpini)(?:$|[^a-z])/i
});
function readJson(bytes,filename){
  const buf=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
  if(buf.length>MAX_BYTES||buf.length<12)
    throw new Error('Asset file size is invalid or exceeds the 250 MB safety cap');
  const ext=extname(filename).toLowerCase();
  let text;
  if(ext==='.glb'){
    if(buf.readUInt32LE(0)!==0x46546c67||buf.readUInt32LE(4)!==2||
       buf.readUInt32LE(8)!==buf.length)
      throw new Error('Malformed glTF binary header');
    let ptr=12,found=false;
    while(ptr+8<=buf.length){
      const n=buf.readUInt32LE(ptr),type=buf.readUInt32LE(ptr+4);
      ptr+=8;
      if(n>buf.length-ptr)throw new Error('Malformed glTF binary chunk');
      if(type===0x4e4f534a&&!found){
        text=buf.subarray(ptr,ptr+n).toString('utf8').replace(/\0+$/,'');
        found=true;
      }
      ptr+=n;
    }
    if(ptr!==buf.length||!found)throw new Error('Missing glTF JSON chunk');
  }else if(ext==='.gltf'){
    text=buf.toString('utf8');
  }else{
    throw new Error('Expected a .gltf or .glb kit, not '+ext);
  }
  let doc;
  try{doc=JSON.parse(text);}catch{throw new Error('Invalid glTF JSON');}
  if(!doc||typeof doc!=='object'||doc.asset?.version?.split('.')[0]!=='2'||
     !Array.isArray(doc.meshes)||doc.meshes.length===0)
    throw new Error('Not a valid glTF 2.0 mesh asset');
  return doc;
}
export function inspectSenaGltf(bytes,fileName='kit.gltf'){
  const gltf=readJson(bytes,fileName);
  const meshes=gltf.meshes??[],nodes=gltf.nodes??[],materials=gltf.materials??[];
  const byGroup={jersey:[],shorts:[],socks:[],boots:[]};
  const meshLabels=meshes.map((m,i)=>{
    const nodeNames=nodes.filter(n=>n.mesh===i).map(n=>n.name||'');
    const assigned=(m.primitives||[]).map(p=>materials[p.material]?.name||'');
    return {index:i,name:m.name||'',nodes:nodeNames,materials:assigned,
      primitives:m.primitives?.length||0};
  });
  for(const m of meshLabels){
    const label=[m.name,...m.nodes,...m.materials].join(' ');
    for(const [group,re] of Object.entries(TYPES))
      if(re.test(label))byGroup[group].push(m.index);
  }
  const requiredUris=[...(gltf.buffers||[]).map(b=>b.uri),
    ...(gltf.images||[]).map(i=>i.uri)].filter(v=>typeof v==='string');
  const unknown=meshLabels.filter(m=>!Object.values(byGroup).some(ids=>ids.includes(m.index)));
  return {
    source:SENA_SOURCE,fileName,meshCount:meshes.length,nodeCount:nodes.length,
    materialCount:materials.length,textureCount:gltf.textures?.length||0,
    animations:gltf.animations?.length||0,
    groups:byGroup,
    completeByNames:Object.values(byGroup).every(ids=>ids.length>0),
    unclassifiedMeshes:unknown.map(m=>({index:m.index,name:m.name,nodes:m.nodes})),
    meshes:meshLabels,
    referencedUris:requiredUris,
    licence:'NOT VERIFIED — free download does not establish redistribution/commercial rights',
    fit:'NOT VERIFIED — mesh scale, pose and suitability require Blender/manual QA'
  };
}
function localDependency(base,uri){
  if(uri.startsWith('data:'))return {uri:'data:[embedded]',embedded:true};
  if(/^[a-z][a-z\d+.-]*:/i.test(uri)||uri.startsWith('//')||uri.includes('\\')||
     uri.includes('\0')||decodeURIComponent(uri).includes('..'))
    throw new Error('Unsafe or nonlocal glTF dependency: '+uri.slice(0,100));
  const decoded=decodeURIComponent(uri);
  if(isAbsolute(decoded))throw new Error('Absolute resource URI is forbidden');
  const full=resolve(base,decoded),r=relative(base,full);
  if(r==='..'||r.startsWith('..'+sep)||isAbsolute(r))
    throw new Error('Referenced resource escapes the kit folder');
  try{
    const st=statSync(full);
    return {uri,embedded:false,exists:st.isFile(),bytes:st.size};
  }catch{return {uri,embedded:false,exists:false};}
}
export function inspectSenaLocalFile(input){
  const file=resolve(input),stat=statSync(file);
  if(!stat.isFile()||stat.size>MAX_BYTES)throw new Error('Invalid local kit file');
  const summary=inspectSenaGltf(readFileSync(file),basename(file));
  const dependencies=summary.referencedUris.map(u=>localDependency(dirname(file),u));
  return {...summary,referencedUris:summary.referencedUris.map(u=>
      u.startsWith('data:')?'data:[embedded]':u),dependencies,
    missingDependencies:dependencies.filter(d=>!d.embedded&&!d.exists).map(d=>d.uri)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const arg=process.argv[2];
  if(!arg){console.error('Usage: node tools/kit-designer-prototype/inspect-sena-kit.mjs <downloaded .gltf or .glb>');process.exitCode=2;}
  else {
    try{
      const report=inspectSenaLocalFile(arg);
      console.log(JSON.stringify(report,null,2));
      if(report.missingDependencies.length||!report.completeByNames)
        process.exitCode=1;
    }catch(error){console.error('Kit intake failed: '+error.message);process.exitCode=1;}
  }
}
