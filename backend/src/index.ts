import { ApiError } from './errors.ts';
import { projectWorld } from './public-projections.ts';
import { readWorld, type WorldDatabase } from './world-repository.ts';

export interface Env {
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
 * Deliberately read-only initial Worker boundary. No placeholder authorization,
 * account creation, credential acceptance or mutation endpoints are exposed.
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
    // Admin endpoints must fail closed until session and CSRF verification exist.
    if (url.pathname === '/api/admin' || url.pathname.startsWith('/api/admin/'))
      return json(404, { error: { code: 'not_found' } });
    return json(404, { error: { code: 'not_found' } });
  },
};
