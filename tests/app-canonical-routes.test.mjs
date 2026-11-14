import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { once } from 'node:events';
import { request } from 'node:http';
import { createPreviewServer } from '../tools/dev-standings-preview.mjs';
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
test('canonical navigation has no /app prefix and all app routes load with assets', async () => {
  const server=createPreviewServer(); server.listen(0,'127.0.0.1'); await once(server,'listening');
  const get=path=>new Promise((resolve,reject)=>{
    const req=request({host:'127.0.0.1',port:server.address().port,path,headers:{host:'127.0.0.1:2000'}},res=>{
      let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body}));
    });req.on('error',reject);req.end();
  });
  try {
    for(const path of ['/dashboard','/calendar','/settings','/admin','/admin/calendar','/admin/players','/admin/contracts','/competitions','/players','/competitions/it-1/fixtures?season=2']) {
      const page=await get(path);assert.equal(page.status,200,path);
      assert.doesNotMatch(page.body,/<a\b[^>]*href=["']\/app(?:\/|["'])/);
      const base=page.body.match(/<base href="([^"]+)"/)?.[1]||path;
      for(const match of page.body.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)="([^"]+)"/g)) {
        const url=new URL(match[1],new URL(base,'http://127.0.0.1:2000'));
        if(url.origin==='http://127.0.0.1:2000')assert.equal((await get(url.pathname)).status,200,url.pathname);
      }
    }
    // Reject all retired /app aliases through the same canonical DEV HTTP server.
    // Its successful canonical pages are already checked with asset loading above;
    // only these additional canonical routes were unique to the old second test.
    for(const path of ['/app','/app/','/app/index.html','/app/dashboard',
      '/app/calendar/','/app/settings/index.html','/app/competitions',
      '/app/competitions/it-1'])
      assert.equal((await get(path)).status,404,path);
    for(const path of ['/','/competitions/it-1/standings'])
      assert.equal((await get(path)).status,200,path);
    assert.ok(read('index.html').includes('href="/dashboard"'));
    assert.equal(existsSync(new URL('../app/index.html',import.meta.url)),false);
  } finally {await new Promise(resolve=>server.close(resolve));}
});

test('publication aliases map canonical app URLs to the same allowlisted DEV files', async()=>{
  const {publicRequestFile,isAllowlistedPublicPath}=await import('../tools/publication-guard.mjs');
  const config=JSON.parse(read('vercel.json'));
  const tokens=[[':page(dashboard|calendar|settings|admin|competitions|players)','(?<page>dashboard|calendar|settings|admin|competitions|players)'],
    [':division((?:it|eng|es|de|fr|pt|nl|br)-[12])','(?<division>(?:it|eng|es|de|fr|pt|nl|br)-[12])'],
    [':file(index.html|manifest.json)','(?<file>index.html|manifest.json)'],
    [':section(calendar|players|contracts)','(?<section>calendar|players|contracts)']];
  const paths=['/dashboard','/calendar','/settings','/admin','/admin/calendar','/admin/players','/admin/contracts','/competitions','/players','/competitions/_shared/manifest.json',
    ...['it','eng','es','de','fr','pt','nl','br'].flatMap(country=>[1,2].map(tier=>'/competitions/'+country+'-'+tier))];
  for(const path of paths){
    let target;
    for(const rule of config.rewrites){
      let pattern=rule.source;for(const [token,replacement] of tokens)pattern=pattern.replace(token,replacement);
      const match=path.match(new RegExp('^'+pattern+'$'));
      if(match){target=rule.destination.replace(/:(page|division|file|section)/g,(_,name)=>match.groups[name]);break;}
    }
    assert.equal(target?.slice(1),publicRequestFile(path),path);
    assert.ok(isAllowlistedPublicPath(target.slice(1)),path);
  }
});


test('canonical pages and public artifacts have no physical app directory or legacy aliases', async () => {
  const {planPublicFiles,publicRequestFile,isAllowlistedPublicPath}=await import('../tools/publication-guard.mjs');
  assert.equal(existsSync(new URL('../app/',import.meta.url)),false);
  const files=planPublicFiles();
  assert.ok(files.every(path=>!path.startsWith('app/')));
  for(const path of ['/dashboard','/calendar','/settings','/admin','/admin/calendar','/admin/players','/admin/contracts','/competitions','/players','/competitions/it-1']) {
    assert.equal(publicRequestFile(path),path.slice(1)+'/index.html');
    assert.ok(isAllowlistedPublicPath(publicRequestFile(path)));
    assert.equal(isAllowlistedPublicPath(publicRequestFile('/app'+path)),false);
  }
  assert.doesNotMatch(read('vercel.json'),/\/app(?:\/|["'])/);
});

test('404: localized error is a real HTTP error, with one Dashboard link and no asset masking',async()=>{
 const page=read('404.html');
 const {isAllowlistedPublicPath,planPublicFiles}=await import('../tools/publication-guard.mjs');
 assert.ok(isAllowlistedPublicPath('404.html'));
 assert.ok(planPublicFiles().includes('404.html'));
 assert.match(page,/<aside class="fa-shell-sidebar"/);
 assert.match(page,/<header class="fa-shell-topbar"/);
 assert.deepEqual([...page.matchAll(/<main\b[\s\S]*?<\/main>/g)].flatMap(m=>[...m[0].matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(a=>a[1])),['/dashboard']);
 for(const lang of ['en','de','es','fr','it'])assert.ok(page.includes('data-fa404-locale="'+lang+'"'));
 assert.ok(page.includes('football-architect:language'));
 assert.doesNotMatch(page.match(/<main\b[\s\S]*?<\/main>/)?.[0]??'',/<select\b|<button\b|data-theme-choice=|fa404-hint|Check the address/i);
 const server=createPreviewServer({devPreview:false});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const get=(path,method='GET',accept='text/html')=>new Promise((resolve,reject)=>{
  const req=request({host:'127.0.0.1',port:server.address().port,path,method,
   headers:{host:'127.0.0.1:2000',accept}},res=>{
   const parts=[];res.on('data',part=>parts.push(part));
   res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(parts).toString()}));
  });req.on('error',reject);req.end();
 });
 try{
  for(const path of ['/a-missing-page','/a-missing-page?lang=it',
    '/clubs/it/41/overview','/missing-competition-page','/404.html']){
   const result=await get(path);
   assert.equal(result.status,404,path);
   assert.match(result.headers['content-type'],/^text\/html;/,path);
   assert.match(result.body,/href="\/dashboard"/,path);
   assert.equal([...result.body.match(/<main\b[\s\S]*?<\/main>/)?.[0]?.matchAll(/<a\b[^>]*href="([^"]+)"/g)??[]].length,1);
   assert.match(result.body,/<aside class="fa-shell-sidebar"/);
   assert.match(result.body,/<header class="fa-shell-topbar"/);
   assert.equal(result.headers.location,undefined,'no automatic redirect');
  }
  const head=await get('/a-missing-page','HEAD');
  assert.equal(head.status,404);assert.equal(head.body,'');
  const asset=await get('/assets/missing.js','GET','*/*');
  assert.equal(asset.status,404);assert.match(asset.headers['content-type'],/^text\/plain/);
  assert.doesNotMatch(asset.body,/<html/);
  const json=await get('/a-missing-page','GET','application/json');
  assert.equal(json.status,404);assert.match(json.headers['content-type'],/^text\/plain/);
  const unsafe=await get('/assets/a%2fb');
  assert.equal(unsafe.status,403);assert.doesNotMatch(unsafe.body,/Page not found/);
  const method=await get('/a-missing-page','POST');
  assert.equal(method.status,405);assert.doesNotMatch(method.body,/Page not found/);
  assert.equal((await get('/dashboard')).status,200);
 }finally{await new Promise(resolve=>server.close(resolve))}
});

test('404 and Dashboard use the same local DEV sidebar additions and link rewriting',async()=>{
 const server=createPreviewServer({devPreview:true,subdomains:true});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const get=path=>new Promise((resolve,reject)=>{
  const req=request({host:'127.0.0.1',port:server.address().port,path,
   headers:{host:'app.localhost:2000',accept:'text/html'}},res=>{
    const parts=[];res.on('data',part=>parts.push(part));
    res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(parts).toString()}));
  });req.on('error',reject);req.end();
 });
 try{
  const dashboard=await get('/dashboard'),missing=await get('/missing-sidebar-example');
  assert.equal(dashboard.status,200);assert.equal(missing.status,404);
  for(const response of [dashboard,missing]){
   assert.match(response.body,/data-me-dev-link/,'DEV section should be present');
   assert.match(response.body,/data-fa-dev-app-origin|faDevAppOrigin/,'subdomain origin bootstrap');
   assert.match(response.body,/href="http:\/\/app\.localhost:2000\/dashboard"/);
   assert.match(response.body,/href="http:\/\/localhost:2000\/guide"/);
  }
  const aside=body=>body.match(/<aside\b[\s\S]*?<\/aside>/)?.[0]??'';
  const hrefs=body=>[...aside(body).matchAll(/\bhref="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(hrefs(missing.body),hrefs(dashboard.body),'404 and Dashboard navigation links must agree');
  assert.doesNotMatch(aside(missing.body),/id="app-nav-dashboard"[^>]*aria-current="page"/);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
