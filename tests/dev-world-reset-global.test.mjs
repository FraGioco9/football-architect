import test from 'node:test';
import assert from 'node:assert/strict';
import {readGlobalWorldProgress} from '../tools/dev-world-clock.mjs';

test('Debug reset reads actual authoritative world state, not local overrides',async()=>{
 const calls=[];
 const result=await readGlobalWorldProgress(async(path,opts)=>{calls.push([path,opts]);return {ok:true,json:async()=>({world:{seasonNumber:2,day:34}})}});
 assert.deepEqual(result,{season:2,day:34});
 assert.equal(calls[0][0],'/api/world');
 assert.equal(calls[0][1].cache,'no-store');
});
test('unstarted shared world maps to first available DEV control day',async()=>{
 assert.deepEqual(await readGlobalWorldProgress(async()=>({ok:true,json:async()=>({world:{seasonNumber:0,day:0}})})),{season:0,day:1});
});
test('unreachable, malformed and unsupported global state cannot overwrite DEV settings',async()=>{
 for(const get of [
  async()=>{throw Error('offline')},
  async()=>({ok:false}),
  async()=>({ok:true,json:async()=>({world:{seasonNumber:200,day:1}})}),
  async()=>({ok:true,json:async()=>({world:{seasonNumber:0,day:8}})})
 ])assert.equal(await readGlobalWorldProgress(get),null);
});
