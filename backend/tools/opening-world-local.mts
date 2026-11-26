/** #791 explicit local rehearsal library. No CLI, HTTP route, auto-loop or remote binding. Only open the project's verified local Miniflare state.
 * Callers must hold exclusive access to this disposable directory.
 */
import {open,readFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {openLocalDatabase} from './operator-local.mts';
import type {WorldV1} from '../src/types.ts';
import {buildOpeningManifest,createOpeningRehearsal,type OpeningPrivatePlan as Plan} from '../src/opening-world-operator.ts';
import {manifestDigest} from '../../tools/world-bootstrap-791/planner.mjs';
const assert=(ok:unknown,msg:string)=>{if(!ok)throw Error(msg)};
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const FILE='opening-world-plan.private.json';
const MAX_BYTES=8*1024*1024;
export async function buildLocalOpeningManifest(world:WorldV1,seed:string){
 const sources=await Promise.all(['../src/players-generator-core.mjs','../src/opening-world-inventory.ts','../src/opening-world-retained.ts','../../tools/world-bootstrap-791/planner.mjs','../../tools/world-bootstrap-791/persistence.mjs'].map(path=>readFile(new URL(path,import.meta.url))));
 return buildOpeningManifest(world,seed,manifestDigest(sources.map(sha)));
}
async function readPrivatePlan(path:string):Promise<Plan>{
 const info=await lstat(path);
 assert(info.isFile()&&!info.isSymbolicLink()&&info.size<=MAX_BYTES,'invalid private opening plan file');
 const plan=JSON.parse(await readFile(path,'utf8')) as Plan;
 assert(plan?.schema==='opening-local-rehearsal-v1'&&typeof plan.seed==='string'&&!!plan.inventory&&!!plan.root,'invalid opening plan');
 return plan;
}
async function savePrivatePlan(path:string,plan:Plan){
 const bytes=JSON.stringify(plan);
 assert(Buffer.byteLength(bytes)<=MAX_BYTES,'opening plan exceeds local file bound');
 // Exclusive creation; if interrupted before sync the file is invalid and no
 // journal has begun. Never overwrite an existing input or resume from a cursor.
 const handle=await open(path,'wx',0o600);
 try{await handle.writeFile(bytes,'utf8');await handle.sync()}finally{await handle.close()}
}
export async function openLocalOpeningRehearsal(persistTo:string){
 const handle=await openLocalDatabase(persistTo,{requireExisting:true,migrate:false});
 const path=join(resolve(persistTo),FILE);
 return {close:handle.close,...createOpeningRehearsal(handle.db,{
  read:()=>readPrivatePlan(path),save:plan=>savePrivatePlan(path,plan)
 },buildLocalOpeningManifest)};
}
