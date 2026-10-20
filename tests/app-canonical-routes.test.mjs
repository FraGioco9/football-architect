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
    for(const path of ['/dashboard','/calendar','/settings','/competitions','/competitions/it-1?season=2&view=fixtures']) {
      const page=await get(path);assert.equal(page.status,200,path);
      assert.doesNotMatch(page.body,/<a\b[^>]*href=["']\/app(?:\/|["'])/);
      const base=page.body.match(/<base href="([^"]+)"/)?.[1]||path;
      for(const match of page.body.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)="([^"]+)"/g)) {
        const url=new URL(match[1],new URL(base,'http://127.0.0.1:2000'));
        if(url.origin==='http://127.0.0.1:2000')assert.equal((await get(url.pathname)).status,200,url.pathname);
      }
    }
    assert.ok(read('index.html').includes('href="/dashboard"'));
    assert.equal(existsSync(new URL('../app/index.html',import.meta.url)),false);
  } finally {await new Promise(resolve=>server.close(resolve));}
});

test('publication aliases map canonical app URLs to the same allowlisted DEV files', async()=>{
  const {publicRequestFile,isAllowlistedPublicPath}=await import('../tools/publication-guard.mjs');
  const config=JSON.parse(read('vercel.json'));
  const tokens=[[':page(dashboard|calendar|settings|competitions)','(?<page>dashboard|calendar|settings|competitions)'],
    [':division((?:it|eng|es|de|fr|pt|nl|br)-[12])','(?<division>(?:it|eng|es|de|fr|pt|nl|br)-[12])'],
    [':file(index.html|manifest.json)','(?<file>index.html|manifest.json)']];
  const paths=['/dashboard','/calendar','/settings','/competitions','/competitions/_shared/manifest.json',
    ...['it','eng','es','de','fr','pt','nl','br'].flatMap(country=>[1,2].map(tier=>'/competitions/'+country+'-'+tier))];
  for(const path of paths){
    let target;
    for(const rule of config.rewrites){
      let pattern=rule.source;for(const [token,replacement] of tokens)pattern=pattern.replace(token,replacement);
      const match=path.match(new RegExp('^'+pattern+'$'));
      if(match){target=rule.destination.replace(/:(page|division|file)/g,(_,name)=>match.groups[name]);break;}
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
  for(const path of ['/dashboard','/calendar','/settings','/competitions','/competitions/it-1']) {
    assert.equal(publicRequestFile(path),path.slice(1)+'/index.html');
    assert.ok(isAllowlistedPublicPath(publicRequestFile(path)));
    assert.equal(isAllowlistedPublicPath(publicRequestFile('/app'+path)),false);
  }
  assert.doesNotMatch(read('vercel.json'),/\/app(?:\/|["'])/);
});

test('DEV rejects removed app paths while canonical routes still load', async () => {
  const server=createPreviewServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  const get=path=>new Promise((resolve,reject)=>{
    const req=request({host:'127.0.0.1',port:server.address().port,path,headers:{host:'127.0.0.1:2000'}},res=>{
      res.resume();res.on('end',()=>resolve(res.statusCode));
    });req.on('error',reject);req.end();
  });
  try {
    for(const path of ['/app','/app/','/app/index.html','/app/dashboard','/app/calendar/','/app/settings/index.html','/app/competitions','/app/competitions/it-1'])
      assert.equal(await get(path),404,path);
    for(const path of ['/','/dashboard','/calendar','/settings','/competitions','/competitions/it-1'])
      assert.equal(await get(path),200,path);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
