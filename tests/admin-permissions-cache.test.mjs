import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {KEY,create}=require('../assets/admin-permissions-cache.js');
function storage(){
 const data=new Map();
 return {data,getItem:key=>data.has(key)?data.get(key):null,
  setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
}
const page=(s,type='navigate')=>({sessionStorage:s,performance:{getEntriesByType:()=>[{type}]}});
test('Admin route changes reuse one permissions lookup per browser tab',()=>{
 const s=storage(),a=create(page(s));assert.equal(a.read(),null);
 assert.equal(a.write(['admin.access','admin.world.read','admin.world.write']),true);
 assert.deepEqual(create(page(s)).read(),['admin.access','admin.world.read','admin.world.write']);
 assert.equal(a.write([]),true);assert.deepEqual(create(page(s)).read(),[]);
});
test('refresh, manual invalidation and separate tabs require another check',()=>{
 const s=storage(),first=create(page(s));first.write(['admin.access']);
 assert.deepEqual(create(page(s)).read(),['admin.access']);
 assert.equal(create(page(s,'reload')).read(),null);
 create(page(s)).write(['admin.access']);create(page(s)).clear();
 assert.equal(create(page(s)).read(),null);
 assert.equal(create(page(storage())).read(),null);
});
test('malformed or manipulated snapshots fail closed',()=>{
 const s=storage();
 for(const raw of ['invalid',JSON.stringify({version:2,permissions:['admin.access']}),
  JSON.stringify({version:1,permissions:'admin.access'}),
  JSON.stringify({version:1,permissions:['<script>']})]){
  s.setItem(KEY,raw);assert.equal(create(page(s)).read(),null);
 }
});
test('disabled storage fails closed and cannot break Admin pages',()=>{
 const win={performance:{getEntriesByType:()=>[{type:'navigate'}]},get sessionStorage(){throw Error('denied')}};
 const c=create(win);assert.equal(c.read(),null);assert.equal(c.write(['admin.access']),false);assert.doesNotThrow(()=>c.clear());
});
