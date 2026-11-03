import test from 'node:test';
import assert from 'node:assert/strict';

test('request fixture handshake resolves only after handler assignment and times out with its scenario',async()=>{
 const {requestHandshake}=await import('./helpers/request-handshake.mjs');
 const handshake=requestHandshake('synthetic reset request',1000);
 let settled=false;handshake.ready.then(()=>{settled=true});
 await Promise.resolve();assert.equal(settled,false);
 handshake.arrive({id:1});assert.deepEqual(await handshake.ready,{id:1});
 const missing=requestHandshake('missing handler',5);await assert.rejects(missing.ready,/missing handler/);
});
