import test from 'node:test';
import assert from 'node:assert/strict';
import {accountJson,accountCookie,accountInput} from '../src/account-http.ts';

test('account responses preserve private security headers and extras',()=>{
 const response=accountJson(202,{ok:true},{'Set-Cookie':'session=test'});
 assert.equal(response.status,202);
 assert.equal(response.headers.get('Cache-Control'),'private, no-store, max-age=0');
 assert.equal(response.headers.get('Vary'),'Cookie');
 assert.equal(response.headers.get('X-Robots-Tag'),'noindex, nofollow');
 assert.equal(response.headers.get('Set-Cookie'),'session=test');
});

test('account cookies reject duplicates and accept precise names',()=>{
 const make=(value:string)=>new Request('https://example.test/',{headers:{Cookie:value}});
 assert.equal(accountCookie(make('other=x; sid=abc; another=y'),'sid'),'abc');
 assert.equal(accountCookie(make('other=x'),'sid'),'');
 assert.throws(()=>accountCookie(make('sid=x; sid=y'),'sid'),{status:401,code:'unauthorized'});
});

test('account input enforces JSON, valid UTF-8 and a bounded body',async()=>{
 const make=(value:string,type='application/json')=>new Request('https://example.test/',{method:'POST',headers:{'Content-Type':type},body:value});
 assert.deepEqual(await accountInput(make('{"a":1}')),{a:1});
 await assert.rejects(accountInput(make('{}','text/plain')),{status:415,code:'json_required'});
 await assert.rejects(accountInput(make('{')),{status:400,code:'invalid_json'});
 await assert.rejects(accountInput(make('x'.repeat(4097))),{status:413,code:'request_too_large'});
});
