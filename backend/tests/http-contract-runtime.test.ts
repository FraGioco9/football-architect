import {test,expect} from 'vitest';
import {ApiError} from '../src/errors.ts';
import {httpJson,httpError,routeMethod,readSessionCookie,readJsonBody} from '../src/http-contract.ts';

test('public and authenticated responses keep distinct wire/cache contracts',async()=>{
 const a=httpJson('account',200,{ok:true},{'Set-Cookie':'session=secret; HttpOnly'});
 const p=httpJson('public',200,{ok:true});
 const d=httpJson('local-inbox',200,{ok:true});
 expect(a.headers.get('cache-control')).toBe('private, no-store, max-age=0');
 expect(a.headers.get('vary')).toBe('Cookie');
 expect(a.headers.get('pragma')).toBe('no-cache');
 expect(a.headers.get('set-cookie')).toContain('HttpOnly');
 expect(p.headers.get('cache-control')).toBe('no-store');
 expect(p.headers.has('vary')).toBe(false);
 expect(d.headers.get('cache-control')).toBe('private, no-store');
 expect(d.headers.has('vary')).toBe(false);
 expect(await p.json()).toEqual({ok:true});
});
test('method errors preserve the explicit allow header only for authenticated routes',()=>{
 const request=new Request('https://example.invalid/',{method:'POST'});
 expect(routeMethod(request,'GET','account')?.headers.get('Allow')).toBe('GET');
 expect(routeMethod(request,'GET','public',false)?.headers.has('Allow')).toBe(false);
 expect(routeMethod(new Request(request.url),'GET','account')).toBe(null);
});
test('duplicate session cookie fails closed without affecting other names',()=>{
 const req=(value:string)=>new Request('https://example.invalid/',{headers:{Cookie:value}});
 expect(readSessionCookie(req('s=first; other=s; s2=next'),'s')).toBe('first');
 expect(readSessionCookie(req('other=one'),'s')).toBe('');
 expect(()=>readSessionCookie(req('s=first; s=second'),'s')).toThrowError(ApiError);
 expect(()=>readSessionCookie(req('s=; s=second'),'s')).toThrowError(ApiError);
});
test('strict bounded JSON rejects wrong media type, malformed UTF-8 and oversized streams',async()=>{
 const req=(data:BodyInit|null,contentType='application/json')=>new Request('https://example.invalid/',{method:'POST',headers:{'Content-Type':contentType},body:data});
 expect(await readJsonBody(req('{"ok":true}','Application/JSON; charset=utf-8'))).toEqual({ok:true});
 for(const [request,status,code] of [
  [req('{}','text/plain'),415,'json_required'],
  [req(''),400,'invalid_json'],
  [req('{broken'),400,'invalid_json'],
  [req(new Uint8Array([0xff])),400,'invalid_json'],
  [req(' '.repeat(4097)),413,'request_too_large']
 ] as const){
  await expect(readJsonBody(request)).rejects.toMatchObject({status,code});
 }
});
test('known errors retain public codes and rate-limit headers; unexpected errors never leak details',async()=>{
 const known=httpError('account',new ApiError(429,'login_throttled'),'player_unavailable');
 expect(known.status).toBe(429);
 expect(known.headers.get('Retry-After')).toBe('900');
 expect(await known.json()).toEqual({error:{code:'login_throttled'}});
 const unexpected=httpError('account',new Error('SQL password secret'),'player_unavailable');
 expect(unexpected.status).toBe(503);
 expect(JSON.stringify(await unexpected.json())).toBe('{"error":{"code":"player_unavailable"}}');
});
