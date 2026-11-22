import test from 'node:test';
import assert from 'node:assert/strict';
import {runIndependentCupMatrix} from '../tools/ci-opt-06-cup-matrix.mjs';

test('distinct cups overlap, but widths remain ordered within each cup',async()=>{
 let release;
 const hold=new Promise(resolve=>release=resolve);
 const calls=[];
 const execution=runIndependentCupMatrix(['int-1','int-2'],[1440,768,390,320],async(cup,width)=>{
  calls.push(cup+':'+width);
  if(width===1440)await hold;
 });
 await Promise.resolve();
 assert.deepEqual(calls,['int-1:1440','int-2:1440'],
  'both independent cups begin before either completes');
 release();
 await execution;
 for(const cup of ['int-1','int-2']){
  assert.deepEqual(calls.filter(x=>x.startsWith(cup+':')),
   [1440,768,390,320].map(width=>cup+':'+width));
 }
 assert.equal(calls.length,8,'full two-cup four-width matrix preserved');
});

test('no more than two independent cups execute concurrently',async()=>{
 let release;
 const hold=new Promise(resolve=>release=resolve);
 const started=[];
 const execution=runIndependentCupMatrix(['a','b','c'],[390],async cup=>{
  started.push(cup);
  if(cup!=='c')await hold;
 });
 await Promise.resolve();
 assert.deepEqual(started,['a','b'],'third cup is not started before first pair settles');
 release();
 await execution;
 assert.deepEqual(started,['a','b','c']);
});

test('failure in either cup blocks FULL after awaiting the other cup',async()=>{
 for(const failed of ['int-1','int-2']){
  const finished=[];
  const rejected=runIndependentCupMatrix(['int-1','int-2'],[1440],async cup=>{
   if(cup===failed)throw Error('broken '+cup);
   await Promise.resolve();finished.push(cup);
  });
  await assert.rejects(rejected,error=>{
   assert.equal(error instanceof AggregateError,true);
   assert.match(String(error.errors?.[0]?.message),new RegExp('broken '+failed));
   return true;
  });
  assert.deepEqual(finished,['int-1','int-2'].filter(cup=>cup!==failed),
   'sibling cup is awaited even if the other fails');
 }
});

test('two simultaneous failures are both reported instead of masked',async()=>{
 await assert.rejects(
  runIndependentCupMatrix(['int-1','int-2'],[390],async cup=>{throw Error('broken '+cup)}),
  error=>error instanceof AggregateError&&error.errors.length===2&&
   error.errors.some(e=>String(e.message).includes('int-1'))&&
   error.errors.some(e=>String(e.message).includes('int-2'))
 );
});

test('matrix with no cups is a valid no-op, with no invented browser calls',async()=>{
 let calls=0;
 await runIndependentCupMatrix([], [1440,390],async()=>{calls++});
 assert.equal(calls,0);
});
