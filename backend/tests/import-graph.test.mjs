import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {auditImportGraph} from '../tools/audit-import-graph.mjs';
function fixture(files,fn){
 const root=mkdtempSync(join(tmpdir(),'fa-be01-imports-'));
 try{
  for(const [name,body] of Object.entries(files)){
   const path=join(root,name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,body);
  }
  return fn(root);
 }finally{rmSync(root,{recursive:true,force:true})}
}
test('maps worker entrypoint, dynamic imports and cycles without treating unused code as dead',()=>fixture({
 'wrangler.toml':'main = "src/index.ts"',
 'src/index.ts':"import {a} from './a.ts';\nconst next=import('./b.ts');\nimport '../catalogues/season.mjs';",
 'src/a.ts':"export {b} from './b.ts'; export type {T} from './types.ts';",
 'src/b.ts':"import {a} from './a.ts'; export const b=1;",
 'src/types.ts':'export interface T { x:number }',
 'src/unused.ts':'export const value=1;',
 'catalogues/season.mjs':'export const season=1;',
 'tests/example.test.ts':"import {a} from '../src/a.ts';",
 },root=>{
 const result=auditImportGraph(root);
 assert.deepEqual(result.modules,{src:5,tests:1,tools:0});
 assert.equal(result.missing.length,0);
 assert.equal(result.dynamicLiteral,1);
 assert.equal(result.cycles.length,1);
 assert.deepEqual(result.cycles[0].map(p=>p.split('/').at(-1)),['a.ts','b.ts']);
 assert.equal(result.reachableFromWorker,4);
 assert.ok(result.outsideWorkerReachability.some(p=>p.endsWith('/unused.ts')));
 assert.equal(result.edges,7);
}));
test('reports missing references and nonliteral dynamic imports independently',()=>fixture({
 'wrangler.toml':'main = "src/index.ts"',
 'src/index.ts':"import './missing.ts'; const s='./later.ts'; import(s); require('./existing.ts');",
 'src/existing.ts':'export const x=1;',
 },root=>{
 const result=auditImportGraph(root);
 assert.equal(result.missing.length,1);
 assert.equal(result.missing[0].specifier,'./missing.ts');
 assert.equal(result.dynamicUnknown.length,1);
 assert.equal(result.dynamicUnknown[0].kind,'dynamic-import');
 assert.equal(result.edges,1);
}));
test('supports type-only imports and package imports',()=>fixture({
 'wrangler.toml':'main = "src/index.ts"',
 'src/index.ts':"import type {T} from './type.ts'; import pkg from 'pkg'; export type {T} from './type.ts';",
 'src/type.ts':'export interface T {}',
 },root=>{
 const result=auditImportGraph(root);
 assert.equal(result.missing.length,0);
 assert.deepEqual(result.external,['pkg']);
 assert.equal(result.edges,2);
}));
