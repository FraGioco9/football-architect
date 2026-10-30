import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {accountTarget,resolveLanguage}=require('../assets/account-ui.js');
test('account entry uses app host and carries only supported language and safe account parameters',()=>{
 assert.equal(accountTarget('http://localhost:2000/account/login/?next=%2Fsettings%2F','it'),'http://app.localhost:2000/account/login/?next=%2Fsettings%2F&lang=it');
 assert.equal(accountTarget('https://www.example.com/account/register/?origin=https://evil.invalid','de'),'https://app.example.com/account/register/?lang=de');
 assert.equal(accountTarget('https://app.example.com/account/login/?next=//evil.invalid','fr'),'https://app.example.com/account/login/?lang=fr');
 assert.throws(()=>accountTarget('https://example.com/api/admin','it'));
 assert.equal(new URL(accountTarget('https://example.com/account/recover/?token='+'a'.repeat(64),'es')).searchParams.get('token'),'a'.repeat(64));
 assert.equal(new URL(accountTarget('http://app.localhost:2000/account/','xx')).searchParams.get('lang'),'en');
});
test('language selection prioritizes explicit trusted handoff then saved language with English fallback',()=>{
 assert.equal(resolveLanguage('it','de'),'it');
 assert.equal(resolveLanguage('zz','de'),'de');
 assert.equal(resolveLanguage(null,'fr'),'fr');
 assert.equal(resolveLanguage(null,null),'en');
});
