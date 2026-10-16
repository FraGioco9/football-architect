import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    assert.ok(read('app/index.html').includes('location.replace("/dashboard" +'));
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
