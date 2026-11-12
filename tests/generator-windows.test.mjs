import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,mkdirSync,readFileSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']});

const generatorFixturePaths=['backend/catalogues','clubs','tools','data','account','admin','dashboard','calendar','settings','competitions','players','templates','assets/flags','assets/divisions','assets/clubs','assets/world-catalog.mjs','assets/sporting-contract.js','assets/routes-registry.mjs','assets/routes-registry.js','assets/rules-registry.js','assets/club-fixtures.js','assets/competition-model.js','assets/competition-rules.js','assets/competition-rules-view.js','assets/competition-stats.js','assets/world-calendar-model.js','assets/sidebar-evolution.js','assets/sidebar-first-paint.js'];
function copyGeneratorFixture(fixture){
 for(const path of generatorFixturePaths){
  const destination=join(fixture,path);mkdirSync(join(destination,'..'),{recursive:true});
  cpSync(join(root,path),destination,{recursive:true});
 }
}

test('CRLF flag sources generate the same checked-in competition HTML without rewriting artwork',()=>{
 const fixture=mkdtempSync(join(tmpdir(),'fa-crlf-flags-'));
 try{
  copyGeneratorFixture(fixture);
  for(const name of readdirSync(join(fixture,'assets/flags')).filter(name=>name.endsWith('.svg'))){
   const path=join(fixture,'assets/flags',name);
   writeFileSync(path,readFileSync(path,'utf8').replace(/\r?\n/g,'\r\n'));
  }
  const flag=join(fixture,'assets/flags/gb-eng.svg'),before=readFileSync(flag);
  const output=execFileSync(process.execPath,['tools/generate-app-pages.mjs','--check'],{cwd:fixture,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  assert.match(output,/22\/22/);
  assert.deepEqual(readFileSync(flag),before,'Generation must not modify source SVG bytes');
 }finally{rmSync(fixture,{recursive:true,force:true})}
});

test('Windows Git checkout preserves approved SVG bytes and canonical LF flags',()=>{
 const fixture=mkdtempSync(join(tmpdir(),'fa-windows-checkout-'));
 try{
  const source=join(fixture,'source'),checkout=join(fixture,'checkout');mkdirSync(source);
  for(const path of ['.gitattributes','assets/flags/gb-eng.svg','assets/divisions']){
   const destination=join(source,path);mkdirSync(join(destination,'..'),{recursive:true});
   cpSync(join(root,path),destination,{recursive:true});
  }
  git(source,'init','--quiet');git(source,'add','.');
  git(source,'-c','user.name=Test','-c','user.email=test@example.invalid','-c','commit.gpgsign=false','commit','--quiet','-m','Fixture');
  git(fixture,'-c','core.autocrlf=true','clone','--no-local','--quiet',source,checkout);
  const flag='assets/flags/gb-eng.svg';
  const flagBytes=Buffer.from(readFileSync(join(root,flag),'utf8').replace(/\r\n/g,'\n'));
  assert.deepEqual(readFileSync(join(checkout,flag)),flagBytes,'Flags must retain LF on checkout');
  for(const division of readdirSync(join(root,'assets/divisions'))){
   for(const variant of ['primary.svg','compact.svg']){
    const path=join('assets/divisions',division,variant);
    assert.deepEqual(readFileSync(join(checkout,path)),readFileSync(join(root,path)),'Approved artwork bytes: '+path);
   }
  }
 }finally{rmSync(fixture,{recursive:true,force:true})}
});


test('CRLF serialized bootstraps check and generate canonical LF pages without hiding content drift',()=>{
 const fixture=mkdtempSync(join(tmpdir(),'fa-crlf-bootstrap-'));
 try{
  copyGeneratorFixture(fixture);
  for(const name of readdirSync(join(fixture,'tools')).filter(name=>name.endsWith('.mjs'))){
   const path=join(fixture,'tools',name);
   writeFileSync(path,readFileSync(path,'utf8').replace(/\r?\n/g,'\r\n'));
  }
  const source=join(fixture,'tools/render-world-calendar.mjs'),sourceBefore=readFileSync(source);
  assert.ok(sourceBefore.includes(Buffer.from('\r\n')),'Fixture must reproduce Windows bootstrap source');
  const outputs=['calendar/index.html','competitions/it-1/index.html','clubs/_shared/index.html'];
  const before=outputs.map(path=>readFileSync(join(fixture,path),'utf8').replace(/\r\n/g,'\n'));
  const run=(...args)=>execFileSync(process.execPath,['tools/generate-app-pages.mjs',...args],{cwd:fixture,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  assert.match(run('--check'),/22\/22/,'CRLF function source must compare equal to checked-in LF HTML');
  run();
  outputs.forEach((path,index)=>assert.equal(readFileSync(join(fixture,path),'utf8'),before[index],'Generated LF bytes: '+path));
  assert.deepEqual(readFileSync(source),sourceBefore,'Generator must not rewrite the CRLF source');
  const calendar=join(fixture,'calendar/index.html');
  writeFileSync(calendar,readFileSync(calendar,'utf8').replace('data-calendar-bootstrap','data-calendar-bootstrap-corrupted'));
  assert.throws(()=>run('--check'),error=>/Generated output differs from checked-in file: calendar\/index.html/.test(String(error.stderr)),'Real generated content drift must still fail');
 }finally{rmSync(fixture,{recursive:true,force:true})}
});
