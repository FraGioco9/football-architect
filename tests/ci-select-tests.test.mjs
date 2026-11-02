import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectTests,selectFromGit} from '../tools/ci-select-tests.mjs';
test('docs-only stays FAST',()=>assert.equal(selectTests(['docs/maintenance/notes.md']).mode,'fast'));
test('mapped competitions get TARGETED contracts',()=>{
 const s=selectTests(['competitions/index.html']);
 assert.equal(s.mode,'targeted');assert.equal(s.area,'competitions');assert.ok(s.tests.length>0);
});
test('mapped calendar gets TARGETED contracts',()=>assert.equal(selectTests(['calendar/index.html']).area,'calendar'));
for(const path of ['.github/workflows/landing-checks.yml','tools/ci-select-tests.mjs','backend/src/index.ts','account/login/index.html','assets/account.css','assets/debug-mode.js','assets/app.css','assets/club-crests.js','tools/generate-app-pages.mjs','data/clubs.json','unmapped/foo.js']){
 test(path+' requires FULL',()=>assert.equal(selectTests([path]).mode,'full'));
}
test('mixed-area never targets one area',()=>assert.equal(selectTests(['clubs/index.html','competitions/index.html']).mode,'full'));
test('unknown plus docs never reports docs-only',()=>assert.equal(selectTests(['README.md','unmapped/new.js']).mode,'full'));
test('empty and malformed paths fail closed',()=>{for(const paths of [[],['../bad'],['/etc/passwd'],['a\\b']])assert.equal(selectTests(paths).mode,'full')});
test('invalid git trust data fails closed',()=>assert.throws(()=>selectFromGit('bad','bad')));

import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
function fixture(fn){
 const root=mkdtempSync(join(tmpdir(),'fa-ci-select-'));
 const old=process.cwd();
 const git=(...args)=>execFileSync('git',['-c','user.name=Test','-c','user.email=ci@example.invalid',...args],{cwd:root,encoding:'utf8'}).trim();
 try {
  git('init','-q');git('checkout','-qb','main');
  writeFileSync(join(root,'README.md'),'base');git('add','.');git('commit','-qm','base');
  const base=git('rev-parse','HEAD');
  mkdirSync(join(root,'competitions'));
  writeFileSync(join(root,'competitions/index.html'),'updated');git('add','.');git('commit','-qm','targeted');
  const head=git('rev-parse','HEAD');
  process.chdir(root);return fn({git,base,head,root});
 }finally{process.chdir(old);rmSync(root,{recursive:true,force:true});}
}
test('real merge-base and exact HEAD select competition contracts',()=>fixture(({base,head})=>{
 const result=selectFromGit(base,head);
 assert.equal(result.mode,'targeted');assert.equal(result.area,'competitions');
 assert.equal(result.head,head);assert.equal(result.mergeBase,base);
 assert.ok(result.paths.includes('competitions/index.html'));
}));
test('stale or forged expected HEAD is rejected',()=>fixture(({base,head,git})=>{
 assert.throws(()=>selectFromGit(base,'f'.repeat(40)),/exact expected HEAD/);
 writeFileSync('README.md','new');git('add','.');git('commit','-qm','newest');
 assert.throws(()=>selectFromGit(base,head),/exact expected HEAD/);
}));
test('unknown shared change in actual diff forces FULL',()=>fixture(({base,git})=>{
 mkdirSync('backend',{recursive:true});writeFileSync('backend/worker.ts','export {};');
 git('add','.');git('commit','-qm','cross-area');
 assert.equal(selectFromGit(base,git('rev-parse','HEAD')).mode,'full');
}));
test('real docs-only change selects FAST',()=>fixture(({git,head})=>{
 mkdirSync('docs',{recursive:true});writeFileSync('docs/readme.md','notes');
 git('add','.');git('commit','-qm','docs');
 assert.equal(selectFromGit(head,git('rev-parse','HEAD')).mode,'fast');
}));
