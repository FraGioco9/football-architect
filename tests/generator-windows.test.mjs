import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,mkdirSync,readFileSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']});

test('CRLF flag sources generate the same checked-in competition HTML without rewriting artwork',()=>{
 const fixture=mkdtempSync(join(tmpdir(),'fa-crlf-flags-'));
 try{
  for(const path of ['tools','data','dashboard','calendar','settings','competitions','templates','assets/flags','assets/divisions','assets/clubs','assets/competition-model.js']){
   const destination=join(fixture,path);mkdirSync(join(destination,'..'),{recursive:true});
   cpSync(join(root,path),destination,{recursive:true});
  }
  for(const name of readdirSync(join(fixture,'assets/flags')).filter(name=>name.endsWith('.svg'))){
   const path=join(fixture,'assets/flags',name);
   writeFileSync(path,readFileSync(path,'utf8').replace(/\r?\n/g,'\r\n'));
  }
  const flag=join(fixture,'assets/flags/gb-eng.svg'),before=readFileSync(flag);
  const output=execFileSync(process.execPath,['tools/generate-app-pages.mjs','--check'],{cwd:fixture,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  assert.match(output,/21\/21/);
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
