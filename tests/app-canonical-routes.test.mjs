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
