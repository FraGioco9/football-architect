// Synthetic lifecycle contract for the PERF-API-657 request-quiescence gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuditedRequestSettler} from './competition-compact-network-browser.mjs';

function fixture(){
 let ms=0;
 const hooks=new Map();
 const page={
  on(name,fn){const callbacks=hooks.get(name)||[];callbacks.push(fn);hooks.set(name,callbacks)},
  fire(name,request){for(const fn of hooks.get(name)||[])fn(request)}
 };
 const create=(settings={})=>createAuditedRequestSettler(page,{
  now:()=>ms,pause:async duration=>{ms+=duration},...settings
 });
 const request=url=>({url:()=>url});
 return {page,create,request,elapsed:()=>ms};
}

test('catalogue response must finish before a bounded quiet window',async()=>{
 const f=fixture(),gate=f.create({quietMs:250});
 const catalogue=f.request('http://app.localhost:2000/competitions/_shared/compact.json');
 f.page.fire('request',catalogue);
 f.page.fire('requestfinished',catalogue);
 await gate.settle('direct');
 assert.equal(f.elapsed(),250);
});

test('public-world and season API requests do not block static catalogue readiness',async()=>{
 const f=fixture(),gate=f.create({quietMs:250});
 f.page.fire('request',f.request('http://app.localhost:2000/api/world'));
 f.page.fire('request',f.request('http://app.localhost:2000/api/competitions/IT-1/seasons/1'));
 // These public APIs may remain unavailable on the loopback preview. Their
 // starts are recorded by the request inventory, but not awaited by this gate.
 await gate.settle('pending-public-api');
 assert.equal(f.elapsed(),250);
});

test('a failed audited request is no longer treated as active',async()=>{
 const f=fixture(),gate=f.create({quietMs:100});
 const compact=f.request('http://app.localhost:2000/competitions/_shared/compact.json');
 f.page.fire('request',compact);
 f.page.fire('requestfailed',compact);
 await gate.settle('refresh');
 assert.equal(f.elapsed(),100);
});

test('external/unrelated requests do not block audited endpoint stability',async()=>{
 const f=fixture(),gate=f.create({quietMs:150});
 f.page.fire('request',f.request('https://another.example/api/world'));
 f.page.fire('request',f.request('http://app.localhost:2000/assets/app.css'));
 await gate.settle('unrelated');
 assert.equal(f.elapsed(),150);
});

test('unresolved catalogue request fails closed at timeout and names the URL',async()=>{
 const f=fixture(),gate=f.create({quietMs:100,timeoutMs:400});
 f.page.fire('request',f.request('http://app.localhost:2000/competitions/_shared/compact.json'));
 await assert.rejects(gate.settle('direct'),error=>
  /PERF-API-657 catalogue requests did not settle: direct/.test(error.message)&&
  error.message.includes('/competitions/_shared/compact.json'));
 assert.equal(f.elapsed(),400);
});

test('obsolete manifest remains an audited resource, even if no API call starts',async()=>{
 const f=fixture(),gate=f.create({quietMs:100,timeoutMs:250});
 f.page.fire('request',f.request('http://app.localhost:2000/competitions/_shared/manifest.json'));
 await assert.rejects(gate.settle('legacy'),/manifest\.json/);
});
