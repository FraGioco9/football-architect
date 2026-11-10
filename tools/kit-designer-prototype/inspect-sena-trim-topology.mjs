// KM-26: local-only, read-only inspection of real artist fabric borders.
// Outputs compact aggregate topology; no artist vertices or files are uploaded.
import {readFileSync} from 'node:fs';
const TARGETS={rightSleeve:[38,39],leftSleeve:[62,63],waist:[9,10,42,43]};
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],r=n=>Math.round(n*1e4)/1e4;
const mul=(a,b)=>{const c=Array(16).fill(0);
 for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)
 c[j*4+i]+=a[k*4+i]*b[j*4+k];return c;};
function matrix(n){
 if(n.matrix)return n.matrix;
 const [x,y,z,w]=n.rotation??[0,0,0,1],[sx,sy,sz]=n.scale??[1,1,1],
 [tx,ty,tz]=n.translation??[0,0,0];
 return [(1-2*(y*y+z*z))*sx,2*(x*y+w*z)*sx,2*(x*z-w*y)*sx,0,
 2*(x*y-w*z)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+w*x)*sy,0,
 2*(x*z+w*y)*sz,2*(y*z-w*x)*sz,(1-2*(x*x+y*y))*sz,0,tx,ty,tz,1];
}
const apply=(p,m)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
 m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],
 m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
function load(b){
 if(b.length<20||b.length>64*1024*1024||b.readUInt32LE(0)!==0x46546c67||
 b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length)throw Error('Invalid GLB header/size');
 let ptr=12,doc,bin;
 while(ptr+8<=b.length){const n=b.readUInt32LE(ptr),type=b.readUInt32LE(ptr+4);ptr+=8;
 if(n>b.length-ptr)throw Error('Invalid GLB chunk');
 if(type===0x4e4f534a)doc=JSON.parse(b.subarray(ptr,ptr+n).toString('utf8'));
 if(type===0x004e4942)bin=b.subarray(ptr,ptr+n);ptr+=n;}
 if(ptr!==b.length||!doc||!bin)throw Error('Incomplete GLB');return {doc,bin};
}
function accessor(doc,bin,id){
 const a=doc.accessors?.[id],v=doc.bufferViews?.[a?.bufferView];
 if(!a||!v||v.buffer!==0||a.sparse)throw Error('Unsupported GLB accessor');
 const arity={SCALAR:1,VEC3:3}[a.type],bytes={5121:1,5123:2,5125:4,5126:4}[a.componentType];
 if(!arity||!bytes||!a.count)throw Error('Malformed GLB accessor');
 const step=v.byteStride??arity*bytes,off=(v.byteOffset??0)+(a.byteOffset??0);
 if(step<arity*bytes||off+(a.count-1)*step+arity*bytes>bin.length)throw Error('Accessor beyond buffer');
 const data=new DataView(bin.buffer,bin.byteOffset+off);
 return {count:a.count,type:a.componentType,arity,get:(i,j=0)=>{
 if(i<0||i>=a.count||j>=arity)throw Error('Index outside position array');
 const o=i*step+j*bytes;
 return a.componentType===5121?data.getUint8(o):
 a.componentType===5123?data.getUint16(o,true):
 a.componentType===5125?data.getUint32(o,true):data.getFloat32(o,true);}};
}
function partOf(name){const m=/^FA_jersey__(\d+)(?:_\d+)?$/i.exec(name);
 return m?Object.keys(TARGETS).find(k=>TARGETS[k].includes(+m[1]))??null:null;}
function trace(edges,vertices){
 const byVertex=new Map();
 edges.forEach((e,i)=>{for(const v of [e.a,e.b]){if(!byVertex.has(v))byVertex.set(v,[]);byVertex.get(v).push(i);}});
 const seen=new Set(),out=[];
 for(let i=0;i<edges.length;i++){
 if(seen.has(i))continue;const stack=[i],group=[],vs=new Set();seen.add(i);
 while(stack.length){const e=edges[stack.pop()];group.push(e);
 for(const v of [e.a,e.b]){vs.add(v);
 for(const j of byVertex.get(v)??[])if(!seen.has(j)){seen.add(j);stack.push(j);}}}
 if(group.length<4)continue;
 const low=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],sum=[0,0,0];
 for(const v of vs)for(let k=0;k<3;k++){
 const x=vertices[v][k];sum[k]+=x;low[k]=Math.min(low[k],x);hi[k]=Math.max(hi[k],x);}
 const length=group.reduce((s,e)=>s+Math.hypot(...vertices[e.a].map((x,k)=>x-vertices[e.b][k])),0);
 out.push({closed:[...vs].every(v=>byVertex.get(v).length===2),edges:group.length,
 perimeterM:r(length),centerM:sum.map(x=>r(x/vs.size)),lowM:low.map(r),highM:hi.map(r)});
 }
 return out.sort((a,b)=>b.perimeterM-a.perimeterM).slice(0,15);
}
export function summarizeTrimTopology(primitives){
 const ids=new Map(),points=[],edges=new Map(),inventory=[];
 const add=p=>{const key=p.map(x=>Math.round(x*50000)).join(':');
 if(!ids.has(key)){ids.set(key,points.length);points.push(p);}return ids.get(key);};
 for(const prim of primitives){
 const map=prim.points.map(add);let area=0,triangles=0;
 for(let j=0;j<prim.indices.length;j+=3){
 const v=prim.indices.slice(j,j+3).map(k=>map[k]);
 if(new Set(v).size!==3)continue;
 const [a,b,c]=v.map(id=>points[id]),u=b.map((x,i)=>x-a[i]),w=c.map((x,i)=>x-a[i]),
 cross=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],norm=Math.hypot(...cross);
 if(norm<1e-12)continue;
 const n=cross.map(x=>x/norm);area+=norm/2;triangles++;
 for(const [x,y] of [[v[0],v[1]],[v[1],v[2]],[v[2],v[0]]]){
 const lo=Math.min(x,y),hi=Math.max(x,y),key=lo+':'+hi;
 if(!edges.has(key))edges.set(key,{a:lo,b:hi,faces:[]});
 const e=edges.get(key);if(e.faces.length<3)e.faces.push({n,material:prim.material});}
 }
 inventory.push({name:prim.name,material:prim.material,triangles,areaM2:r(area)});
 }
 const exterior=[],material=[],folds=[],nonManifold=[];
 for(const e of edges.values()){
 if(e.faces.length===1)exterior.push(e);
 else if(e.faces.length>2)nonManifold.push(e);
 else{const [a,b]=e.faces;
 if(a.material!==b.material)material.push(e);
 if(a.n.reduce((s,x,i)=>s+x*b.n[i],0)<.70710678)folds.push(e);}
 }
 return {primitives:inventory,uniqueVertices:points.length,
 edgeCounts:{exterior:exterior.length,material:material.length,folds:folds.length,nonManifold:nonManifold.length},
 openings:trace(exterior,points),materialBorders:trace(material,points),foldBorders:trace(folds,points)};
}
export function inspectSenaTrimTopology(bytes){
 const {doc,bin}=load(Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes)),nodes=doc.nodes??[];
 const selected={rightSleeve:[],leftSleeve:[],waist:[]};
 const roots=doc.scenes?.[doc.scene??0]?.nodes??nodes.map((_,i)=>i).filter(i=>
 !nodes.some(n=>(n.children??[]).includes(i)));
 const walk=(i,parent,vis)=>{
 if(vis.has(i))throw Error('Cyclic glTF nodes');
 const n=nodes[i];if(!n)throw Error('Invalid glTF node');
 const m=mul(parent,matrix(n)),mesh=doc.meshes?.[n.mesh],
 name=n.name||mesh?.name||'',part=partOf(name)||partOf(mesh?.name||'');
 if(part&&mesh)for(let k=0;k<(mesh.primitives??[]).length;k++){
 const p=mesh.primitives[k];
 if(p.mode!==undefined&&p.mode!==4)throw Error('Non-triangle garment primitive');
 const a=accessor(doc,bin,p.attributes?.POSITION);
 if(a.arity!==3||a.type!==5126)throw Error('Expected F32 jersey positions');
 const points=Array.from({length:a.count},(_,j)=>apply([a.get(j,0),a.get(j,1),a.get(j,2)],m));
 const indices=p.indices===undefined?points.map((_,j)=>j):(()=>{
 const x=accessor(doc,bin,p.indices);
 if(x.arity!==1)throw Error('Invalid triangle indices');
 return Array.from({length:x.count},(_,j)=>x.get(j));})();
 if(indices.length%3)throw Error('Malformed triangle count');
 const material=doc.materials?.[p.material]?.name||('material '+p.material);
 selected[part].push({name:name+' / primitive '+k,material,points,indices});
 }
 const next=new Set([...vis,i]);for(const child of n.children??[])walk(child,m,next);
 };
 for(const i of roots)walk(i,I,new Set());
 return {kind:'KM-26 local read-only garment border report',privateModelUploaded:false,
 note:'Candidates only: material border and fold edges must be matched to the actual sewn hem before recolouring.',
 sections:Object.fromEntries(Object.entries(selected).map(([k,ps])=>[k,ps.length?
 summarizeTrimTopology(ps):{error:'Expected jersey primitives missing'}]))};
}
if(typeof process!=='undefined'&&process.argv[1]?.endsWith('inspect-sena-trim-topology.mjs')){
 const path=process.argv[2]||'kit-maker/local-assets/alberto-sena-outfit.glb';
 try{console.log(JSON.stringify(inspectSenaTrimTopology(readFileSync(path)),null,2));}
 catch(e){console.error('Private trim inspection failed: '+e.message);process.exitCode=1;}
}
