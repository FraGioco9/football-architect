/** The existing loopback DEV Worker only. Never imported by the ordinary/public Preview bundle. */
import worker,{type Env} from './index.ts';
import {handleAdmin} from './http-admin.ts';
import {httpJson} from './http-contract.ts';
import {requireDatabase} from './database.ts';
import {executeDevOperator} from './dev-operator.ts';
type DevEnv=Env&{DEV_OPERATOR_ENABLED?:string;DEV_OPERATOR_SOURCE?:string};
export function devOperatorEnabled(env:DevEnv,request:Request){
 return env.DEV_OPERATOR_ENABLED==='true'&&typeof env.DEV_OPERATOR_SOURCE==='string'&&/^[a-f0-9]{40}$/.test(env.DEV_OPERATOR_SOURCE)&&
  env.PLAYER_MODE==='local'&&env.PLAYER_ORIGIN==='http://app.localhost:2000'&&new URL(request.url).origin===env.PLAYER_ORIGIN;
}
export default {
 async fetch(request:Request,env:DevEnv):Promise<Response>{
  if(new URL(request.url).pathname!=='/api/admin/dev-operator')return worker.fetch(request,env);
  if(!devOperatorEnabled(env,request))return httpJson('account',404,{error:{code:'not_found'}});
  try{
   const pool=await requireDatabase(env.DB).prepare('SELECT pool FROM account_environment_pool WHERE id=1').first<{pool:string}>();
   if(pool?.pool!=='dev-preview')return httpJson('account',503,{error:{code:'environment_unavailable'}});
  }catch{return httpJson('account',503,{error:{code:'environment_unavailable'}})}
  return handleAdmin(request,env,(req,db,session,now)=>executeDevOperator(req,db,session,now,env.DEV_OPERATOR_SOURCE!));
 }
};
