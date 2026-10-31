/** Offline only: no upload, migration or Cloudflare API. */
import {mkdtemp,mkdir,readFile,writeFile,readdir,rm,stat,symlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {isDeepStrictEqual} from 'node:util';import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';import {join,resolve,isAbsolute} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
export interface PreviewTarget {accountId:string;databaseId:string;origin:string;sourceSha:string}
interface Entry {path:string;sha256:string;bytes:number}
export interface PreviewManifest {schemaVersion:1;sourceSha:string;sourceTree:string;pool:'dev-preview';origin:string;target:{accountId:string;databaseId:string};publicationAuthorized:false;files:Entry[]}
export function validatePreviewTarget(t:PreviewTarget){
 if(!/^[a-f0-9]{40}$/.test(t.sourceSha)||!/^[a-f0-9]{32}$/.test(t.accountId)||!/^https:\/\/football-architect-preview\.[a-z0-9-]+\.workers\.dev$/.test(t.origin)||new URL(t.origin).origin!==t.origin||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(t.databaseId)||t.databaseId==='00000000-0000-4000-8000-000000000001')throw Error('Invalid explicit nonproduction target/source');
}
function commonConfig(t:PreviewTarget){return {name:'football-architect-preview',account_id:t.accountId,compatibility_date:'2026-10-26',workers_dev:true,preview_urls:false,vars:{PLAYER_MODE:'preview',PLAYER_ORIGIN:t.origin,PLAYER_TRUSTED_SOURCE:'cloudflare',PREVIEW_SOURCE_SHA:t.sourceSha},d1_databases:[{binding:'DB',database_name:'football-architect-dev',database_id:t.databaseId}],assets:{directory:'./assets',binding:'ASSETS',run_worker_first:true,html_handling:'none',not_found_handling:'none'}}}
function finalConfig(t:PreviewTarget){return {...commonConfig(t),main:'./bundle/preview.js',no_bundle:true,find_additional_modules:true,base_dir:'./bundle',rules:[{type:'CompiledWasm',globs:['**/*.wasm'],fallthrough:true}]}}
const sha=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
async function entries(root:string,path=''):Promise<Entry[]>{
 const out:Entry[]=[];
 for(const item of await readdir(join(root,path),{withFileTypes:true})){
  const next=path?path+'/'+item.name:item.name;
  if(item.isSymbolicLink())throw Error('Unsafe package link');
  if(item.isDirectory())out.push(...await entries(root,next));
  else if(item.isFile()&&next!=='manifest.json'){const data=await readFile(join(root,next));out.push({path:next,sha256:sha(data),bytes:data.length})}
  else if(!item.isFile())throw Error('Unsafe package item');
 }
 return out.sort((a,b)=>a.path.localeCompare(b.path,'en'));
}
export async function verifyPreviewPackage(output:string):Promise<PreviewManifest>{
 const manifest=JSON.parse(await readFile(join(output,'manifest.json'),'utf8')) as PreviewManifest;
 if(manifest.schemaVersion!==1||manifest.pool!=='dev-preview'||manifest.publicationAuthorized!==false||!Array.isArray(manifest.files)||JSON.stringify(await entries(output))!==JSON.stringify(manifest.files))throw Error('Package hash/integrity mismatch');
 const target={...manifest.target,sourceSha:manifest.sourceSha,origin:manifest.origin};validatePreviewTarget(target);
 const config=JSON.parse(await readFile(join(output,'wrangler.json'),'utf8'));
 if(!/^[a-f0-9]{40}$/.test(manifest.sourceTree)||!isDeepStrictEqual(config,finalConfig(target)))throw Error('Preview configuration/target policy mismatch');
 return manifest;
}
export async function preparePreview(t:PreviewTarget&{repository?:string;output:string}):Promise<PreviewManifest>{
 validatePreviewTarget(t);
 const repository=resolve(t.repository??fileURLToPath(new URL('../../',import.meta.url)));
 if(!isAbsolute(t.output)||/^[\\/]{2}/.test(t.output))throw Error('Absolute local output required');
 const output=resolve(t.output);try{await stat(output);throw Error('Refusing to overwrite existing package')}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}
 const git=(...args:string[])=>execFileSync('git',args,{cwd:repository,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 if(git('cat-file','-t',t.sourceSha)!=='commit'||git('rev-parse',t.sourceSha)!==t.sourceSha)throw Error('Exact source commit required');
 const temp=await mkdtemp(join(tmpdir(),'fa-preview-source-'));
 try{
  const source=join(temp,'source');await mkdir(source);
  const archive=join(temp,'source.tar');git('archive',t.sourceSha,'--format=tar','--output',archive);execFileSync('tar',['-xf',archive,'-C',source]);
  const guard=await import(pathToFileURL(join(source,'tools/publication-guard.mjs')).href) as {stagePublicArtifact:(root:string,dest:string)=>string[]};
  await mkdir(output,{recursive:true});guard.stagePublicArtifact(source,join(output,'assets'));
  const localBackend=fileURLToPath(new URL('../',import.meta.url));
  if(!(await readFile(join(source,'backend/package-lock.json'))).equals(await readFile(join(localBackend,'package-lock.json'))))throw Error('Pinned toolchain lock differs from requested source');
  // Compiler-only dependency link is created AFTER guarded staging, outside assets.
  await symlink(join(localBackend,'node_modules'),join(source,'backend/node_modules'),'junction');
  const common=commonConfig(t);
  const buildFile=join(output,'build.json');await writeFile(buildFile,JSON.stringify({...common,main:join(source,'backend/src/preview.ts')},null,2));
  const env:NodeJS.ProcessEnv={};for(const key of ['PATH','Path','SystemRoot','SYSTEMROOT','TEMP','TMP','TMPDIR','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','XDG_CONFIG_HOME','XDG_CACHE_HOME'])if(process.env[key])env[key]=process.env[key];
  Object.assign(env,{CI:'true',WRANGLER_SEND_METRICS:'false',NODE_PATH:join(localBackend,'node_modules')});
  const wrangler=fileURLToPath(new URL('../bin/wrangler.js',import.meta.resolve('wrangler')));
  execFileSync(process.execPath,[wrangler,'deploy','--dry-run','--no-autoconfig','--config',buildFile,'--outdir',join(output,'bundle')],{cwd:output,env,stdio:'pipe',timeout:60000});
  await rm(buildFile);
  const bundle=await readdir(join(output,'bundle'));if(!bundle.includes('preview.js'))throw Error('Compiled Preview entry missing');
  await writeFile(join(output,'wrangler.json'),JSON.stringify(finalConfig(t),null,2)+'\n');
  const manifest:PreviewManifest={schemaVersion:1,sourceSha:t.sourceSha,sourceTree:git('rev-parse',t.sourceSha+'^{tree}'),pool:'dev-preview',origin:t.origin,target:{accountId:t.accountId,databaseId:t.databaseId},publicationAuthorized:false,files:await entries(output)};
  await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');await verifyPreviewPackage(output);return manifest;
 }finally{await rm(temp,{recursive:true,force:true})}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const allowed=new Set(['source-sha','output','account-id','database-id','origin']);const args:Record<string,string>={};
 for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i]?.replace(/^--/,'');if(!allowed.has(key)||Object.hasOwn(args,key)||!process.argv[i+1]||!process.argv[i].startsWith('--'))throw Error('Invalid/duplicate preparation arguments');args[key]=process.argv[i+1]}
 if(Object.keys(args).length!==5)throw Error('Required: --source-sha --output --account-id --database-id --origin');
 const manifest=await preparePreview({sourceSha:args['source-sha'],output:args.output,accountId:args['account-id'],databaseId:args['database-id'],origin:args.origin});
 console.log(JSON.stringify({sourceSha:manifest.sourceSha,pool:manifest.pool,origin:manifest.origin,files:manifest.files.length,output:resolve(args.output),published:false},null,2));
}
