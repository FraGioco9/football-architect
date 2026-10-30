import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {accountTarget,resolveLanguage}=require('../assets/account-ui.js');
test('account entry uses app host and carries only supported language and one-time tokens without a visible return destination',()=>{
 assert.equal(accountTarget('http://localhost:2000/account/login/?next=%2Fsettings%2F','it'),'http://app.localhost:2000/account/login?lang=it');
 assert.equal(accountTarget('https://www.example.com/account/register/?origin=https://evil.invalid','de'),'https://app.example.com/account/register?lang=de');
 assert.equal(accountTarget('https://app.example.com/account/login/?next=//evil.invalid','fr'),'https://app.example.com/account/login?lang=fr');
 assert.throws(()=>accountTarget('https://example.com/api/admin','it'));
 assert.equal(new URL(accountTarget('https://example.com/account/recover/?token='+'a'.repeat(64),'es')).searchParams.get('token'),'a'.repeat(64));
 assert.equal(new URL(accountTarget('http://app.localhost:2000/account/','xx')).searchParams.get('lang'),null);
});
test('language selection prioritizes explicit trusted handoff then saved language with English fallback',()=>{
 assert.equal(resolveLanguage('it','de'),'it');
 assert.equal(resolveLanguage('zz','de'),'de');
 assert.equal(resolveLanguage(null,'fr'),'fr');
 assert.equal(resolveLanguage(null,null),'en');
});

test('public pages and templates emit internal links without trailing slashes',async()=>{
 const {readdir,readFile}=await import('node:fs/promises');
 async function check(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
   const file=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
   if(entry.isDirectory()){await check(file);continue;}
   if(!entry.name.endsWith('.html'))continue;
   const html=await readFile(file,'utf8');
   for(const [,href] of html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/g)){
    if(!href.startsWith('/')||href.startsWith('//'))continue;
    const path=new URL(href,'https://fa.invalid').pathname;
    assert.ok(path==='/'||!path.endsWith('/'),file.pathname+': '+href);
   }
  }
 }
 for(const name of ['account','calendar','dashboard','settings','clubs','competitions','guide','templates'])await check(new URL('../'+name+'/',import.meta.url));
});

test('login and register provide localized Go back links without obsolete arrow icons or return URL parameters',async()=>{
 const {readFile}=await import('node:fs/promises');
 for(const page of ['login','register']){
  const html=await readFile(new URL('../account/'+page+'/index.html',import.meta.url),'utf8');
  assert.match(html,/<a class="account-go-back" id="account-go-back" href="\/dashboard"><span id="account-go-back-label">Go back<\/span><\/a>/);
  assert.doesNotMatch(html,/<span aria-hidden="true">←<\/span>/);
  assert.doesNotMatch(html,/[?&]next=/);
 }
 const shared=await readFile(new URL('../assets/account-ui.js',import.meta.url),'utf8');
 for(const label of ['Go back','Torna indietro','Zurück','Volver','Retour'])assert.ok(shared.includes(label));
 assert.match(shared,/faLoginReturn\?\.peek\?\.\(\)/);
 const theme=await readFile(new URL('../assets/theme.js',import.meta.url),'utf8');
 assert.match(theme,/peek\(\)/);
});

test('registration and recovery send the selected interface locale, not the browser default, to the mock delivery API',async()=>{
 const {readFile}=await import('node:fs/promises');
 for(const file of ['account-onboarding.js','account-recovery.js']){
  const source=await readFile(new URL('../assets/'+file,import.meta.url),'utf8');
  assert.match(source,/'Accept-Language':ui\.language/,file);
 }
});
