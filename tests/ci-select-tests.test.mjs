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
