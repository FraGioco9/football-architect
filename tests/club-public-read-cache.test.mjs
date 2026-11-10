import test from 'node:test';
import assert from 'node:assert/strict';
import {createClubPublicReadCache} from '../assets/club-public-read-cache.mjs';

const base={source:'authoritative',sourceRevision:1,worldStatus:'ready',
 world:{generation:'g1',revision:20,seasonNumber:2,day:12,phase:'active'}};
const next=()=>new Promise(resolve=>{queueMicrotask(resolve)});

test('CLUB-API-01: identical world/path shares one in-flight read across Club tabs',async()=>{
 let state=base,calls=0,complete;
 const cache=createClubPublicReadCache({getState:()=>state,fetchJson:async(path,{signal})=>{
  calls++;return new Promise((resolve,reject)=>{
   complete=resolve;
   signal.addEventListener('abort',()=>reject(Error('fetch aborted')),{once:true});
  });
 }});
 const abort=new AbortController();
 const one=cache.read('/api/clubs/IT-1/seasons/2/overview',{signal:abort.signal});
 const two=cache.read('/api/clubs/IT-1/seasons/2/overview');
 await next();
 assert.equal(calls,1);
 abort.abort();
 await assert.rejects(one,/cancelled/);
 complete({status:'partial',data:{season:2}});
 assert.deepEqual(await two,{status:'partial',data:{season:2}});
 assert.deepEqual(await cache.read('/api/clubs/IT-1/seasons/2/overview'),{status:'partial',data:{season:2}});
 assert.equal(calls,1,'the completed response is reused on tab revisit');
 cache.clear();
});

test('CLUB-API-01: sporting day/source change aborts and fences old projections',async()=>{
 let state=base,requests=0,aborted=0;
 const cache=createClubPublicReadCache({getState:()=>state,fetchJson:async(path,{signal})=>{
  requests++;
  if(requests===1)return new Promise((resolve,reject)=>{
   signal.addEventListener('abort',()=>{aborted++;reject(Error('old world cancelled'))},{once:true});
  });
  return {day:state.world.day};
 }});
 const one=cache.read('/api/clubs/IT-1/seasons/2/overview');
 await next();
 state={...base,world:{...base.world,day:13,revision:21}};
 assert.deepEqual(await cache.read('/api/clubs/IT-1/seasons/2/overview'),{day:13});
 await assert.rejects(one,/cancelled/);
 assert.equal(aborted,1);
 assert.equal(requests,2);
 state={...state,sourceRevision:2};
 assert.deepEqual(await cache.read('/api/clubs/IT-1/seasons/2/overview'),{day:13});
 assert.equal(requests,3,'new source token invalidates prior cache');
 cache.clear();
});

test('CLUB-API-01: errors are retryable and an aborted consumer does not start a request',async()=>{
 let state=base,calls=0;
 const cache=createClubPublicReadCache({getState:()=>state,fetchJson:async()=>{
  if(++calls===1)throw Error('temporary 503');
  return {ok:true};
 }});
 await assert.rejects(cache.read('/api/clubs/IT-1/seasons/2/overview'),/temporary 503/);
 await next();
 assert.deepEqual(await cache.read('/api/clubs/IT-1/seasons/2/overview'),{ok:true});
 assert.equal(calls,2);
 const controller=new AbortController();controller.abort();
 await assert.rejects(cache.read('/api/clubs/IT-1/seasons/1/overview',{signal:controller.signal}),/cancelled/);
 assert.equal(calls,2);
 state={...base,source:'dev'};
 await assert.rejects(cache.read('/api/clubs/IT-1/seasons/2/overview'),/not ready/);
 cache.clear();
});
