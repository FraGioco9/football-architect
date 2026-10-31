import {assertEnvironmentPool,resolveAccountConfiguration} from './environment-pool.ts';
import {handleAdmin,type AdminEnv} from './http-admin.ts';
import {handlePlayer,type PlayerEnv} from './http-player.ts';
import {cloudflareEmailDeliveries,type CloudflareDeliveryEnv} from './cloudflare-email-delivery.ts';
import { ApiError } from './errors.ts';
import {requireDatabase} from './database.ts';
import {readPublicSportingSeason,readPublicCalendarDay} from './public-sporting-read.ts';
import { projectWorld } from './public-projections.ts';
import { readWorld, type WorldDatabase } from './world-repository.ts';

export interface Env extends AdminEnv, PlayerEnv, CloudflareDeliveryEnv {
  DB?: WorldDatabase;
}

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status, headers });
}

/**
 * Anonymous public read and separately configured, server-authorized Admin routes.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // A Dev bridge cannot accidentally dispatch credentials or commands to Production.
    const expected=request.headers.get('X-FA-Expected-Pool');
    if(expected!==null&&(expected!=='dev-preview'||env.PLAYER_MODE!=='preview'))return json(503,{error:{code:'environment_unavailable'}});
    if(url.pathname==='/api/environment'){
      if(request.method!=='GET')return json(405,{error:{code:'method_not_allowed'}});
      try{
        if(env.PLAYER_MODE!=='preview'||url.search)throw new ApiError(503,'environment_unavailable');
        const c=await resolveAccountConfiguration(request,env,'environment_unavailable');
        return json(200,{schemaVersion:1,pool:'dev-preview',origin:c.origin,sharedWorld:true,separateSignIn:true});
      }catch{return json(503,{error:{code:'environment_unavailable'}})}
    }
    if(url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/api/player/')&&!url.pathname.startsWith('/api/admin/')){
      try{await assertEnvironmentPool(env)}catch{return json(503,{error:{code:'environment_unavailable'}})}
    }
    if (url.pathname === '/api/world') {
      if (request.method !== 'GET') return json(405, { error: { code: 'method_not_allowed' } });
      try {
        return json(200, { world: projectWorld(await readWorld(env.DB)) });
      } catch (error) {
        if (error instanceof ApiError) return json(error.status, { error: { code: error.code } });
        return json(503, { error: { code: 'world_unavailable' } });
      }
    }
    const sporting=url.pathname.match(/^\/api\/competitions\/((?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12]))\/seasons\/([1-9][0-9]*)$/);
    if(sporting){
      if(request.method!=='GET')return json(405,{error:{code:'method_not_allowed'}});
      if(url.search||!Number.isSafeInteger(Number(sporting[2])))return json(422,{error:{code:'invalid_public_request'}});
      try{return json(200,await readPublicSportingSeason(requireDatabase(env.DB),sporting[1],Number(sporting[2])))}
      catch(error){
        if(error instanceof ApiError&&error.code==='stale_world')return json(409,{error:{code:'stale_world'}});
        return json(503,{error:{code:'sporting_data_unavailable'}});
      }
    }
    const calendar=url.pathname.match(/^\/api\/calendar\/seasons\/([1-9][0-9]*)\/days\/([1-9][0-9]?)$/);
    if(calendar){
      if(Number(calendar[2])>56)return json(404,{error:{code:'not_found'}});
      if(request.method!=='GET')return json(405,{error:{code:'method_not_allowed'}});
      if(url.search||!Number.isSafeInteger(Number(calendar[1])))return json(422,{error:{code:'invalid_public_request'}});
      try{return json(200,await readPublicCalendarDay(requireDatabase(env.DB),Number(calendar[1]),Number(calendar[2])))}
      catch(error){
        if(error instanceof ApiError&&error.code==='stale_world')return json(409,{error:{code:'stale_world'}});
        return json(503,{error:{code:'sporting_data_unavailable'}});
      }
    }
    if (url.pathname === '/api/player' || url.pathname.startsWith('/api/player/')) {
      const delivery=cloudflareEmailDeliveries(env);
      return handlePlayer(request,{
        ...env,
        PLAYER_VERIFICATION_DELIVERY:env.PLAYER_VERIFICATION_DELIVERY??delivery.verification,
        PLAYER_RESET_DELIVERY:env.PLAYER_RESET_DELIVERY??delivery.reset
      });
    }
    // Admin access requires explicit configuration, durable authorization and CSRF.
    if (url.pathname === '/api/admin' || url.pathname.startsWith('/api/admin/'))
      return handleAdmin(request,env);
    return json(404, { error: { code: 'not_found' } });
  },
};
