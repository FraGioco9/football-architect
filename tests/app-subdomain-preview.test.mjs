import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createPreviewServer } from '../tools/dev-standings-preview.mjs';
test('opt-in subdomain preview separates site/app roots, links and Host gates',async()=>{
 const server=createPreviewServer({subdomains:true});server.listen(0,'127.0.0.1');await once(server,'listening');
 const get=(path,host)=>new Promise((resolve,reject)=>{
  const req=request({host:'127.0.0.1',port:server.address().port,path,headers:{host}},res=>{
   let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body}));
  });req.on('error',reject);req.end();
 });
 try {
  const site=await get('/','localhost:2000');assert.equal(site.status,200);
  assert.match(site.body,/href="http:\/\/app\.localhost:2000\/dashboard"/);
  const app=await get('/','app.localhost:2000');assert.equal(app.status,200);
  assert.match(app.body,/id="app-dashboard"/);assert.match(app.body,/href="http:\/\/localhost:2000"/);
  for(const path of ['/guide','/assets/landing.js','/dashboard','/calendar','/settings','/competitions','/competitions/it-1?season=2&view=fixtures','/competitions/_shared/manifest.json'])
   assert.equal((await get(path,'app.localhost:2000')).status,200,path);
  for(const host of ['app.localhost.evil:2000','other.localhost:2000','localhost:3000','app.example.com:2000'])
   assert.equal((await get('/',host)).status,403,host);
  assert.equal((await get('/data/clubs.json','app.localhost:2000')).status,404);
 } finally {await new Promise(resolve=>server.close(resolve));}
});
test('subdomain runtime helpers preserve port, query and fragment',()=>{
 const source=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('  function appHref('),source.indexOf('  window.faAppHref'));
 const context={window:{location:{hostname:'app.localhost',protocol:'http:'}},document:{documentElement:{dataset:{faDevAppOrigin:'http://app.localhost:2000',faDevSiteOrigin:'http://localhost:2000'}}}};
 runInNewContext(code,context);
 assert.equal(context.appHref('/competitions/it-1?season=2&view=fixtures#x/'),'/competitions/it-1?season=2&view=fixtures#x/');
 assert.equal(context.siteHref('/'),'http://localhost:2000');
 assert.equal(context.siteHref('/guide#clubs'),'http://localhost:2000/guide#clubs');
 context.window.location.hostname='localhost';
 assert.equal(context.appHref('/dashboard'),'http://app.localhost:2000/dashboard');
});

test('landing runtime keeps the opt-in app destination after HTML link rewriting',()=>{
 const source=readFileSync(new URL('../assets/landing.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('  const previewHost ='),source.indexOf('  // The preview is'));
 const link={href:'http://app.localhost:2000/dashboard'};
 const document={documentElement:{dataset:{faDevAppOrigin:'http://app.localhost:2000'}},querySelectorAll:()=>[link]};
 runInNewContext(code,{document,window:{location:{hostname:'localhost',protocol:'http:'}}});
 assert.equal(link.href,'http://app.localhost:2000/dashboard');
});
