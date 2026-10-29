import {handleAdmin,type AdminEnv} from './http-admin.ts';
import { ApiError } from './errors.ts';
import {requireDatabase} from './database.ts';
import {readPublicSportingSeason} from './public-sporting-read.ts';
import { projectWorld } from './public-projections.ts';
import { readWorld, type WorldDatabase } from './world-repository.ts';

export interface Env extends AdminEnv {
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
    // Admin access requires explicit configuration, durable authorization and CSRF.
    if (url.pathname === '/api/admin' || url.pathname.startsWith('/api/admin/'))
      return handleAdmin(request,env);
    return json(404, { error: { code: 'not_found' } });
  },
};
