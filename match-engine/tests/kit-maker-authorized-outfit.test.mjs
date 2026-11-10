import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {request} from 'node:http';
import {createAuthorizedGitHubOutfitLoader} from '../../tools/kit-designer-prototype/authorized-github-outfit.mjs';
import {createPreviewServer} from '../../tools/dev-standings-preview.mjs';

function sampleGlb(){
  // Synthetic signature-only GLB: no proprietary geometry/textures.
  const bytes=Buffer.alloc(20);
  bytes.write('glTF',0);
  bytes.writeUInt32LE(2,4);
  bytes.writeUInt32LE(bytes.length,8);
  return bytes;
}
function authorizedEnv(bytes=sampleGlb()){
  return {
    FA_KIT_MAKER_ASSET_RIGHTS_CONFIRMED:'1',
    FA_KIT_MAKER_GITHUB_REPO:'owner/private-kit-assets',
    FA_KIT_MAKER_GITHUB_ASSET_ID:'1234',
    FA_KIT_MAKER_GITHUB_SHA256:createHash('sha256').update(bytes).digest('hex'),
    FA_KIT_MAKER_GITHUB_TOKEN:'test-only-unpublished-token'
  };
}
async function requestLab(server,path,{host='app.localhost:2000',method='GET'}={}){
  return new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',
      port:server.address().port,path,method,headers:{host}},res=>{
      const chunks=[];
      res.on('data',chunk=>chunks.push(chunk));
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,
        body:Buffer.concat(chunks)}));
    });
    req.on('error',reject);
    req.end();
  });
}
async function withEmptyKitRoot(t,kitOutfitLoader){
  const root=await mkdtemp(join(tmpdir(),'fa-km34-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const server=createPreviewServer({root,subdomains:true,kitOutfitLoader});
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return server;
}
test('KM-34 no license or source: never fetch a model or expose private credentials',async()=>{
  let fetched=0;
  const fetcher=async()=>{fetched++;throw Error('network must remain disabled');};
  assert.equal((await createAuthorizedGitHubOutfitLoader({
    env:{},fetcher})()).status,'not-configured');
  const withCredentials=authorizedEnv();
  withCredentials.FA_KIT_MAKER_ASSET_RIGHTS_CONFIRMED='0';
  assert.equal((await createAuthorizedGitHubOutfitLoader({
    env:withCredentials,fetcher})()).status,'rights-unverified');
  withCredentials.FA_KIT_MAKER_ASSET_RIGHTS_CONFIRMED='1';
  withCredentials.FA_KIT_MAKER_GITHUB_REPO='https://malicious.invalid/';
  assert.equal((await createAuthorizedGitHubOutfitLoader({
    env:withCredentials,fetcher})()).status,'invalid-configuration');
  assert.equal(fetched,0);
});
test('KM-34 follows only signed GitHub release redirects and removes auth header',async()=>{
  const bytes=sampleGlb(),calls=[],env=authorizedEnv(bytes);
  const fetcher=async(url,options)=>{
    calls.push({url,options});
    if(calls.length===1)return new Response(null,{
      status:302,headers:{
        Location:'https://release-assets.githubusercontent.com/test-owner-binary'
      }
    });
    return new Response(bytes,{status:200,headers:{
      'Content-Type':'application/octet-stream'
    }});
  };
  const loader=createAuthorizedGitHubOutfitLoader({env,fetcher});
  const first=await loader(),second=await loader();
  assert.equal(first.status,'available');
  assert.deepEqual(first.bytes,bytes);
  assert.equal(second,first,'Only one GitHub download per DEV session');
  assert.equal(calls.length,2);
  assert.equal(calls[0].options.headers.Authorization,
    'Bearer '+env.FA_KIT_MAKER_GITHUB_TOKEN);
  assert.equal(calls[1].options.headers.Authorization,undefined);
  assert.match(calls[0].url,/api\.github\.com\/repos\/owner\/private-kit-assets\/releases\/assets\/1234/);
});
test('KM-34 refuses malicious redirects, oversized and hash-invalid binaries',async()=>{
  const bytes=sampleGlb(),env=authorizedEnv(bytes);
  const malicious=createAuthorizedGitHubOutfitLoader({
    env,fetcher:async()=>new Response(null,{
      status:302,headers:{Location:'https://attacker.invalid/collect'}
    })
  });
  assert.equal((await malicious()).status,'untrusted-asset-redirect');
  const oversize=createAuthorizedGitHubOutfitLoader({
    env,fetcher:async()=>new Response(bytes,{
      headers:{'Content-Length':String(100*1024*1024+1)}
    })
  });
  assert.equal((await oversize()).status,'remote-unavailable');
  const corrupt=Buffer.from(bytes);corrupt[15]=0xff;
  const invalid=createAuthorizedGitHubOutfitLoader({
    env,fetcher:async()=>new Response(corrupt,{status:200})
  });
  assert.equal((await invalid()).status,'asset-verification-failed');
});
test('KM-34 missing GLB returns explicit 424 only to authorized DEV host',async t=>{
  let calls=0;
  const server=await withEmptyKitRoot(t,async()=>{
    calls++;return {status:'rights-unverified'};
  });
  const path='/__fa_kit_maker__/alberto-sena-outfit.glb';
  const response=await requestLab(server,path);
  assert.equal(response.status,424);
  assert.deepEqual(JSON.parse(response.body.toString('utf8')),{
    error:'private-kit-asset-unavailable',reason:'rights-unverified'
  });
  assert.equal(response.headers['cache-control'],'private, no-store');
  assert.equal((await requestLab(server,path,{method:'HEAD'})).status,424);
  assert.equal((await requestLab(server,path,{host:'localhost:2000'})).status,404);
  assert.equal(calls,2,'Denied host must not attempt a private asset lookup');
});
test('KM-34 authorized cached GitHub bytes are served only by private DEV route',async t=>{
  const bytes=sampleGlb();
  let calls=0;
  const server=await withEmptyKitRoot(t,async()=>{
    calls++;return {status:'available',bytes};
  });
  const path='/__fa_kit_maker__/alberto-sena-outfit.glb';
  const downloaded=await requestLab(server,path);
  assert.equal(downloaded.status,200);
  assert.equal(downloaded.headers['content-type'],'model/gltf-binary');
  assert.deepEqual(downloaded.body,bytes);
  assert.equal((await requestLab(server,path,{host:'localhost:2000'})).status,404);
  assert.equal(calls,1);
});
