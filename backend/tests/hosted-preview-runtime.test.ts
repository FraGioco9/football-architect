import {it,expect} from 'vitest';
import preview,{type PreviewEnv} from '../src/preview.ts';
const origin='https://football-architect-preview.example.workers.dev';
const seen:Request[]=[];
const config:PreviewEnv={PLAYER_MODE:'preview',PLAYER_ORIGIN:origin,PLAYER_TRUSTED_SOURCE:'cloudflare',ASSETS:{fetch:async(input)=>{const request=new Request(input);seen.push(request);return new Response('<!doctype html><title>Fixture</title>',{headers:{'Content-Type':'text/html','Set-Cookie':'unsafe=1','Cache-Control':'public'}})}}};
const call=(path:string,options:RequestInit={},configuration=config)=>preview.fetch(new Request(origin+path,options),configuration);
it('routes canonical pages to shared physical HTML without forwarding credentials, tokens or source headers',async()=>{
 for(const [path,file] of [['/account/login?token=secret','/account/login/index.html'],['/competitions/it-1/fixtures?season=2','/competitions/it-1/index.html'],['/competitions/int-1/rules','/competitions/int-1/index.html'],['/clubs/it/3/fixtures?season=2','/clubs/_shared/index.html'],['/calendar?season=1&calendarView=week','/calendar/index.html']]){
  const r=await call(path,{headers:{Cookie:'private=secret',Authorization:'secret','CF-Connecting-IP':'192.0.2.1','X-CSRF-Token':'secret'}});expect(r.status).toBe(200);
  const asset=seen.at(-1)!;expect(new URL(asset.url).pathname).toBe(file);expect(new URL(asset.url).search).toBe('');
  for(const key of ['cookie','authorization','cf-connecting-ip','x-csrf-token'])expect(asset.headers.get(key)).toBeNull();
  expect(r.headers.get('set-cookie')).toBeNull();expect(r.headers.get('cache-control')).toContain('no-store');expect(r.headers.get('referrer-policy')).toBe('no-referrer');
 }
});
it('canonical redirects preserve approved season/query state and remove legacy view/matchday aliases',async()=>{
 for(const [path,target] of [['/account/login/','/account/login'],['/account/register/index.html?lang=it','/account/register?lang=it'],['/competitions/it-1?view=history&season=2&matchday=7','/competitions/it-1/history?season=2'],['/clubs/it/3?view=history&season=2&matchday=7','/clubs/it/3/history'],['/competitions/int-1','/competitions/int-1/standings'],['/competitions/it-1/fixtures/?season=2','/competitions/it-1/fixtures?season=2']]){
  const r=await call(path);expect(r.status).toBe(308);expect(r.headers.get('location')).toBe(target);
 }
});
it('API requests never fall through to assets, even for browser navigation',async()=>{
 const before=seen.length;const r=await call('/api/player/session',{headers:{'Sec-Fetch-Mode':'navigate'}});expect(r.status).toBe(503);expect(seen.length).toBe(before);
 expect((await call('/api/unknown')).status).toBe(503);expect(seen.length).toBe(before);
});
it('rejects unsafe paths, non-Preview host/config and writes; supports HEAD without an HTML body',async()=>{
 expect((await call('/assets/%2e%2e/backend')).status).toBe(404); // Request normalizes encoded dot segments before dispatch.
 for(const path of ['//evil.invalid','/assets/a%2fb'])expect((await call(path)).status).toBe(403);
 expect((await call('/account/login',{method:'POST'})).status).toBe(405);
 expect((await call('/account/login',{}, {...config,PLAYER_MODE:'production'})).status).toBe(503);
 expect((await call('/account/login',{}, {...config,PLAYER_ORIGIN:'https://other.invalid'})).status).toBe(503);
 expect(await (await call('/account/login',{method:'HEAD'})).text()).toBe('');
});

it('404: real HTML only for missing documents and HEAD, never for assets or APIs',async()=>{
 const lookedUp:string[]=[];
 const env:PreviewEnv={...config,ASSETS:{fetch:async input=>{
  const path=new URL(new Request(input).url).pathname;
  lookedUp.push(path);
  if(path==='/404.html')return new Response('<!doctype html><a href="/dashboard">Go to Dashboard</a>',
   {status:200,headers:{'Content-Type':'text/html','Set-Cookie':'untrusted=1'}});
  return new Response('Not Found',{status:404,headers:{'Content-Type':'text/plain'}});
 }}};
 const page=await call('/does-not-exist?lang=it',{headers:{Accept:'text/html'}},env);
 expect(page.status).toBe(404);
 expect(page.headers.get('content-type')).toContain('text/html');
 expect(page.headers.get('cache-control')).toContain('no-store');
 expect(page.headers.get('set-cookie')).toBeNull();
 expect(page.headers.get('location')).toBeNull();
 expect(await page.text()).toContain('href="/dashboard"');
 expect(lookedUp.slice(-2)).toEqual(['/does-not-exist/index.html','/404.html']);
 const head=await call('/does-not-exist',{method:'HEAD',headers:{Accept:'text/html'}},env);
 expect(head.status).toBe(404);expect(await head.text()).toBe('');
 expect(lookedUp.slice(-2)).toEqual(['/does-not-exist/index.html','/404.html']);
 const direct=await call('/404.html',{headers:{Accept:'text/html'}},env);
 expect(direct.status).toBe(404);
 expect(await direct.text()).toContain('href="/dashboard"');
 const asset=await call('/assets/missing.js',{headers:{Accept:'*/*'}},env);
 expect(asset.status).toBe(404);
 expect(asset.headers.get('content-type')).toContain('text/plain');
 expect(await asset.text()).toBe('Not Found');
 expect(lookedUp.at(-1)).toBe('/assets/missing.js');
 const json=await call('/does-not-exist',{headers:{Accept:'application/json'}},env);
 expect(json.status).toBe(404);expect(json.headers.get('content-type')).toContain('text/plain');
 expect(lookedUp.at(-1)).toBe('/does-not-exist/index.html');
 expect((await call('/assets/a%2fb',{headers:{Accept:'text/html'}},env)).status).toBe(403);
 expect((await call('/does-not-exist',{method:'POST'},env)).status).toBe(405);
});
