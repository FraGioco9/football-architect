/**
 * Session and CSRF secrets are generated only by the Worker cryptographic RNG.
 * Never persist plaintext token values; store SHA-256 digests only.
 */
export function createOpaqueToken(): string {
  const bytes=new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
export async function digestOpaqueToken(token: string): Promise<string> {
  if (!/^[0-9a-f]{64}$/.test(token)) throw new TypeError('invalid_token');
  const bytes=new TextEncoder().encode(token);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
export function getSessionDeadlines(nowSeconds:number): Readonly<{absoluteExpiresAt:number;idleExpiresAt:number}> {
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds<0) throw new TypeError('invalid_time');
  return {absoluteExpiresAt:nowSeconds+8*60*60,idleExpiresAt:nowSeconds+30*60};
}
