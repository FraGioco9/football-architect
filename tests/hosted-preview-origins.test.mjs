import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ui=require('../assets/account-ui.js');
const origin='https://football-architect-preview.giocolifrancesco.workers.dev';
test('workers.dev account routes preserve their exact HTTPS host instead of inventing app.*',()=>{
 for(const path of ['/account/login','/account/register/','/account/recover','/account/verify-email'])assert.equal(new URL(ui.accountTarget(origin+path,'it')).origin,origin);
 assert.equal(new URL(ui.accountTarget('https://example.com/account/login','en')).hostname,'app.example.com');
 assert.equal(new URL(ui.accountTarget('https://preview.workers.dev.evil.invalid/account/login','en')).hostname,'app.preview.workers.dev.evil.invalid');
});
test('workers.dev app and landing CTA stay on the same origin',()=>{
 const source=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');const code=source.slice(source.indexOf('  function appHref('),source.indexOf('  window.faAppHref'));
 const context={window:{location:{hostname:new URL(origin).hostname,protocol:'https:'}},document:{documentElement:{dataset:{}}}};runInNewContext(code,context);assert.equal(context.appHref('/account/login'),'/account/login');
 const landing=readFileSync(new URL('../assets/landing.js',import.meta.url),'utf8'),link={href:'/dashboard'};runInNewContext(landing.slice(landing.indexOf('  const previewHost ='),landing.indexOf('  // The preview is')),{document:{documentElement:{dataset:{}},querySelectorAll:()=>[link]},window:{location:{hostname:new URL(origin).hostname,protocol:'https:'}}});assert.equal(link.href,'/dashboard');
});
