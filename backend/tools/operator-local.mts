// Operator-only local tooling. No network database API or remote execution path.
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readD1Migrations} from '@cloudflare/vitest-plugin';
import setupWasm from 'argon2id/lib/setup.js';
import {readFile,mkdir,lstat,readdir} from 'node:fs/promises';
import {isAbsolute,join,parse,relative,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPasswordService} from '../src/password-core.ts';
import {parseOperatorEmail} from '../src/email-identity.ts';
import type {Database} from '../src/database.ts';
export const LOCAL_DATABASE_ID='00000000-0000-4000-8000-000000000001';
let service:ReturnType<typeof createPasswordService>|undefined;
async function passwordService(){
 if(!service){
  const root=new URL('./',import.meta.resolve('argon2id'));
  const compiled=await Promise.all(['dist/simd.wasm','dist/no-simd.wasm'].map(async p=>WebAssembly.compile(Uint8Array.from(await readFile(new URL(p,root))))));
  const loader=(module:WebAssembly.Module)=>(imports:WebAssembly.Imports)=>WebAssembly.instantiate(module,imports).then(instance=>({module,instance}));
  service=createPasswordService(setupWasm(loader(compiled[0]),loader(compiled[1])));
 }
 return service;
}
async function ensureLocalDirectory(path:string):Promise<void>{
 const parent=dirname(path);if(parent!==path)await ensureLocalDirectory(parent);
 try{const info=await lstat(path);if(info.isSymbolicLink()||!info.isDirectory())throw Error('unsafe_state_directory')}
 catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;await mkdir(path,{mode:0o700})}
}
async function rejectSubtreeLinks(path:string):Promise<void>{
 for(const item of await readdir(path,{withFileTypes:true})){
  const next=join(path,item.name);if(item.isSymbolicLink())throw Error('symlink_state_directory_forbidden');
  if(item.isDirectory())await rejectSubtreeLinks(next);
 }
}
export async function openLocalDatabase(persistTo:string){
 if(!isAbsolute(persistTo)||persistTo.startsWith('//')||persistTo.includes('://')||resolve(persistTo)===parse(persistTo).root)throw Error('explicit_local_directory_required');
 persistTo=resolve(persistTo);
 await ensureLocalDirectory(join(persistTo,'v3','d1'));
 await rejectSubtreeLinks(join(persistTo,'v3','d1'));
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response(null,{status:404})}}',compatibilityDate:'2026-10-26',d1Databases:{DB:LOCAL_DATABASE_ID},resourcePersistencePath:join(persistTo,'v3')}));
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  await db.prepare("CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)").run();
  const applied=await db.prepare('SELECT name FROM d1_migrations').all<{name:string}>();
  for(const migration of await readD1Migrations(fileURLToPath(new URL('../migrations/',import.meta.url)))){
   if(applied.results.some(x=>x.name===migration.name))continue;
   await db.batch([...migration.queries.map(sql=>db.prepare(sql)),db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').bind(migration.name)]);
  }
  return {db,close:()=>mf.dispose()};
 }catch(error){await mf.dispose();throw error}
}
export async function manageAccount(db:Database,operation:string,emailInput:string,password:string){
 const email=parseOperatorEmail(emailInput);
 if(!['create','replace-password'].includes(operation))throw Error('invalid_operator_action');
 const verifier=await (await passwordService()).hashPassword(password);
 if(operation==='create'){
  await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES (?,?,?,?)').bind(crypto.randomUUID(),email,verifier,Math.floor(Date.now()/1000)).run();
 }else{
  const results=await db.batch([
   db.prepare('UPDATE admin_accounts SET password_verifier=?,credential_version=credential_version+1 WHERE email_normalized=? AND enabled=1').bind(verifier,email),
   db.prepare('DELETE FROM admin_sessions WHERE account_id IN (SELECT id FROM admin_accounts WHERE email_normalized=? AND password_verifier=?)').bind(email,verifier)
  ]);
  if(results[0].meta.changes!==1)throw Error('operator_not_found_or_disabled');
 }
}
