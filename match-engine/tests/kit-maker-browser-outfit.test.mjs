import test from 'node:test';
import assert from 'node:assert/strict';
import {cachePrivateOutfit,readCachedPrivateOutfit,clearCachedPrivateOutfit} from
  '../../tools/kit-designer-prototype/private-outfit-cache.mjs';

function fakeIndexedDB(){
  const contents=new Map();
  const db={
    objectStoreNames:{contains(name){return name==='private-outfit';}},
    createObjectStore(){},
    close(){},
    transaction(){
      const tx={oncomplete:null,onerror:null,onabort:null};
      const result=fn=>{
        const request={};
        Promise.resolve().then(()=>{
          try{
            request.result=fn();
            request.onsuccess?.();
            tx.oncomplete?.();
          }catch(error){request.error=error;request.onerror?.();}
        });
        return request;
      };
      tx.objectStore=()=>({
        put(value,key){return result(()=>{contents.set(key,value);return key;});},
        get(key){return result(()=>contents.get(key));},
        delete(key){return result(()=>{contents.delete(key);return undefined;});}
      });
      return tx;
    }
  };
  return {
    open(){
      const request={};
      Promise.resolve().then(()=>{
        request.result=db;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },contents
  };
}
function sampleGLB(){
  const bytes=new ArrayBuffer(20),view=new DataView(bytes);
  view.setUint32(0,0x46546c67,true);
  view.setUint32(4,2,true);
  view.setUint32(8,20,true);
  return bytes;
}
test('KM-35 initial browser has no outfit; saved source survives re-opening',async()=>{
  const indexedDB=fakeIndexedDB();
  assert.equal(await readCachedPrivateOutfit(indexedDB),null);
  const bytes=sampleGLB();
  await cachePrivateOutfit(bytes,indexedDB);
  assert.equal(indexedDB.contents.size,1);
  const loaded=await readCachedPrivateOutfit(indexedDB);
  assert.ok(loaded instanceof ArrayBuffer);
  assert.deepEqual(Buffer.from(loaded),Buffer.from(bytes));
  await clearCachedPrivateOutfit(indexedDB);
  assert.equal(await readCachedPrivateOutfit(indexedDB),null);
});
test('KM-35 malformed, oversized and non-GLB files never enter private cache',async()=>{
  const indexedDB=fakeIndexedDB();
  await assert.rejects(()=>cachePrivateOutfit(new ArrayBuffer(20),indexedDB),
    /valid standalone glTF v2/);
  const corrupt=sampleGLB();
  new DataView(corrupt).setUint32(8,200,true);
  await assert.rejects(()=>cachePrivateOutfit(corrupt,indexedDB),
    /valid standalone glTF v2/);
  assert.equal(indexedDB.contents.size,0);
});
test('KM-35 unsupported browser storage fails safely without uploading',async()=>{
  const buffer=sampleGLB();
  assert.equal(await readCachedPrivateOutfit(null),null);
  await assert.rejects(()=>cachePrivateOutfit(buffer,null),
    /Browser storage unavailable/);
});
