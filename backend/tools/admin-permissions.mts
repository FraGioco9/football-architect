// Owner-only LOCAL permission command. No Worker route, network API or remote D1.
import {isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {openLocalDatabase} from './operator-local.mts';
import {accountPool,initializeAccountPool,inspectAdminPermissions,changeAdminPermissions} from './owner-permissions.mts';
import {parseOperatorEmail} from '../src/email-identity.ts';

export function parsePermissionArguments(argv:string[]){
 const [action,...flags]=argv;
 if(!['init','status','grant','revoke'].includes(action))throw Error('invalid_action');
 const values=new Map<string,string>();let apply=false,dryRun=false;
 for(let i=0;i<flags.length;i++){
  const flag=flags[i];
  if(flag==='--apply'){if(apply)throw Error('invalid_arguments');apply=true;continue}
  if(flag==='--dry-run'){if(dryRun)throw Error('invalid_arguments');dryRun=true;continue}
  if(!['--email','--environment','--persist-to','--legacy-id','--confirm-account'].includes(flag)||values.has(flag)||!flags[i+1]||flags[i+1].startsWith('--'))throw Error('invalid_arguments');
  values.set(flag,flags[++i]);
 }
 if(values.has('--legacy-id')&&action!=='grant')throw Error('invalid_arguments');
 if(apply&&dryRun||action==='status'&&(apply||values.has('--confirm-account'))||action==='init'&&(values.has('--email')||values.has('--legacy-id')||values.has('--confirm-account')))throw Error('invalid_arguments');
 const environment=values.get('--environment')??'dev',pool=accountPool(environment);
 const persistTo=values.get('--persist-to')??fileURLToPath(new URL('../.wrangler/state/',import.meta.url));
 if(!isAbsolute(persistTo)||persistTo.includes('://')||/^[\\/]{2}/.test(persistTo))throw Error('explicit_local_directory_required');
 const email=action==='init'?null:parseOperatorEmail(values.get('--email'));
 const legacyId=values.get('--legacy-id'),confirmation=values.get('--confirm-account');
 for(const id of [legacyId,confirmation])if(id!==undefined&&(!id||id.length>128||/[\u0000-\u0020\u007f]/.test(id)))throw Error('invalid_arguments');
 return {action,environment,pool,persistTo,email,legacyId,confirmation,apply};
}
type IO={output:(text:string)=>void;confirm?:(prompt:string)=>Promise<string>};
export async function runPermissionCommand(argv:string[],io:IO){
 const args=parsePermissionArguments(argv);
 if(args.action==='init'&&!args.apply){io.output(JSON.stringify({localOnly:true,dryRun:true,action:'init',pool:args.pool}));return}
 const handle=await openLocalDatabase(args.persistTo,{migrate:args.action==='init',requireExisting:args.action!=='init'});
 try{
  const now=Math.floor(Date.now()/1000);
  if(args.action==='init'){
   const result=await initializeAccountPool(handle.db,args.environment,now);io.output(JSON.stringify({localOnly:true,initialized:true,...result}));return;
  }
  const status=await inspectAdminPermissions(handle.db,args.environment,args.email!);
  if(args.action==='status'||!args.apply){
   io.output(JSON.stringify({localOnly:true,dryRun:args.action!=='status',pool:status.pool,accountId:status.accountId,verified:status.verified,status:status.status,permissions:status.permissions,legacyId:status.legacyId,legacyCandidateId:status.legacyCandidateId}));return;
  }
  let expectedAccountId=args.confirmation;
  if(!expectedAccountId){
   if(!io.confirm)throw Error('confirmation_required');
   const phrase=args.action.toUpperCase()+' '+args.environment+' '+args.email;
   if(await io.confirm('LOCAL ONLY: type '+phrase+' to confirm: ')!==phrase)throw Error('confirmation_mismatch');
   expectedAccountId=status.accountId;
  }
  const result=await changeAdminPermissions(handle.db,{action:args.action as 'grant'|'revoke',environment:args.environment,email:args.email!,expectedAccountId,legacyId:args.legacyId},now);
  io.output(JSON.stringify({localOnly:true,action:args.action,...result}));
 }finally{await handle.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const io:IO={output:text=>process.stdout.write(text+'\n')};
 if(process.stdin.isTTY&&process.stderr.isTTY)io.confirm=async prompt=>{
  const input=createInterface({input:process.stdin,output:process.stderr});
  try{return await input.question(prompt)}finally{input.close()}
 };
 runPermissionCommand(process.argv.slice(2),io).catch(error=>{
  // Never dump SQL/rows, identifiers, passwords or stack traces into logs.
  const code=error instanceof Error&&/^[a-z_]+$/.test(error.message)?error.message:'permission_operation_failed';
  process.stderr.write('LOCAL owner permission action failed: '+code+'. No remote target is supported.\n');process.exitCode=1;
 });
}
