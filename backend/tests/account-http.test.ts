import {describe,it,expect} from 'vitest';
import {accountJson,accountCookie,accountInput} from '../src/account-http.ts';
import {ApiError} from '../src/errors.ts';

describe('shared authenticated HTTP boundary',()=>{
 it('preserves private/no-store security headers and isolated response extras',()=>{
  const response=accountJson(202,{ok:true},{'Set-Cookie':'session=test'});
  expect(response.status).toBe(202);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
  expect(response.headers.get('Vary')).toBe('Cookie');
  expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  expect(response.headers.get('Set-Cookie')).toBe('session=test');
 });
 it('rejects duplicate cookies and accepts one precise named cookie',()=>{
  const make=(cookie:string)=>new Request('https://example.test/',{headers:{Cookie:cookie}});
  expect(accountCookie(make('other=x; sid=abc; another=y'),'sid')).toBe('abc');
  expect(accountCookie(make('other=x'),'sid')).toBe('');
  expect(()=>accountCookie(make('sid=x; sid=y'),'sid')).toThrowError(ApiError);
 });
 it('parses valid JSON and rejects invalid media type and malformed content',async()=>{
  const make=(raw:string,type='application/json')=>new Request('https://example.test/',{method:'POST',headers:{'Content-Type':type},body:raw});
  await expect(accountInput(make('{"a":1}'))).resolves.toEqual({a:1});
  await expect(accountInput(make('{}','text/plain'))).rejects.toMatchObject({status:415,code:'json_required'});
  await expect(accountInput(make('{'))).rejects.toMatchObject({status:400,code:'invalid_json'});
  await expect(accountInput(make('x'.repeat(4097)))).rejects.toMatchObject({status:413,code:'request_too_large'});
 });
});
