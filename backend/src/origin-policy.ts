import { ApiError } from './errors.ts';

/** Explicit server configured origin; neither Host nor forwarded headers confer trust. */
export function requireMutationOrigin(requestOrigin: string | null, configuredOrigin: string): void {
  let trusted: URL;
  try {
    trusted=new URL(configuredOrigin);
  } catch {
    throw new ApiError(503, 'admin_unavailable');
  }
  if (!['http:','https:'].includes(trusted.protocol) || trusted.username || trusted.password ||
      trusted.search || trusted.hash || trusted.pathname!=='/' || trusted.origin!==configuredOrigin)
    throw new ApiError(503, 'admin_unavailable');
  if (!requestOrigin || requestOrigin==='null' || requestOrigin!==trusted.origin)
    throw new ApiError(403, 'origin_forbidden');
}

/** A production Admin session must never be set over HTTP. */
export function adminCookiePolicy(mode: string, requestUrl: string): string {
  let url: URL;
  try { url=new URL(requestUrl); } catch { throw new ApiError(503,'admin_unavailable'); }
  if (mode==='production') {
    if (url.protocol!=='https:') throw new ApiError(503,'admin_unavailable');
    return '__Host-fa_admin; Secure; HttpOnly; SameSite=Strict; Path=/';
  }
  if (mode==='local' && url.protocol==='http:' &&
      (url.hostname==='localhost' || url.hostname==='127.0.0.1' || url.hostname==='[::1]' || url.hostname==='app.localhost'))
    return 'fa_admin_local; HttpOnly; SameSite=Strict; Path=/';
  throw new ApiError(503,'admin_unavailable');
}
