import {ApiError} from './errors.ts';
import {requireDatabase} from './database.ts';
export interface EnvironmentConfig {DB?:unknown;PLAYER_MODE?:string;PLAYER_ORIGIN?:string;PLAYER_TRUSTED_SOURCE?:string}
/** A label is a deployment safety check; both frontends must use this same DB. */
export async function assertEnvironmentPool(env:EnvironmentConfig,code='environment_unavailable'){
 const mode=env.PLAYER_MODE;
 if(!['local','preview','production'].includes(mode??''))return;
 const row=await requireDatabase(env.DB).prepare('SELECT pool FROM account_environment_pool WHERE id=1').first<{pool:string}>();
 if(mode==='preview'?row?.pool!=='dev-preview':row&&row.pool!==(mode==='production'?'production':'dev-preview'))throw new ApiError(503,code);
}
export async function resolveAccountConfiguration(request:Request,env:EnvironmentConfig,code:string){
 const url=new URL(request.url),origin=env.PLAYER_ORIGIN??'',mode=env.PLAYER_MODE??'';
 try{const trusted=new URL(origin);if(trusted.origin!==origin||trusted.pathname!=='/'||trusted.search||trusted.hash||trusted.username||trusted.password)throw Error()}catch{throw new ApiError(503,code)}
 let source:string;
 if(mode==='local'){
  if(url.protocol!=='http:'||url.origin!==origin||!['localhost','127.0.0.1','[::1]','app.localhost'].includes(url.hostname))throw new ApiError(503,code);
  source='local-loopback';
 }else{
  if(!['production','preview'].includes(mode)||env.PLAYER_TRUSTED_SOURCE!=='cloudflare'||url.protocol!=='https:'||url.origin!==origin)throw new ApiError(503,code);
  const ip=request.headers.get('CF-Connecting-IP');
  if(!ip||ip.length>45||!/^[0-9a-fA-F:.]+$/.test(ip))throw new ApiError(503,code);
  source=ip;
 }
 await assertEnvironmentPool(env,code);
 return {origin,source,cookie:mode==='local'?'fa_player_local':'__Host-fa_player',flags:`${mode==='local'?'':'Secure; '}HttpOnly; SameSite=Strict; Path=/`};
}
