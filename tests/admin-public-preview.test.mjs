import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {once} from 'node:events';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
async function read(server,path){
 return new Promise((resolve,reject)=>{
  const req=request({host:'127.0.0.1',port:server.address().port,path,headers:{Host:'localhost:2000'}},res=>{
   let body='';res.setEncoding('utf8');res.on('data',part=>body+=part);res.on('end',()=>resolve({status:res.statusCode,body,location:res.headers.location}));
  });req.on('error',reject);req.end();
 });
}
test('public Worker browser harness serves canonical pages without any fictional DEV bootstrap',async()=>{
 const server=createPreviewServer({subdomains:true,devPreview:false});server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  for(const path of ['/calendar','/competitions/it-1/history?season=1','/settings']){
   const result=await read(server,path);assert.equal(result.status,200,path);
   assert.doesNotMatch(result.body,/window\.faDevPreviewMode=true|dataset\.faDevAppOrigin=|data-fa-dev-preview|fictional local DEV calendar|src="\/__fa_dev__\//,path);
  }
  for(const view of ['history','rules']){
   const alias=await read(server,'/competitions/it-1?view='+view+'&season=1&matchday=9');
   assert.equal(alias.status,308);assert.equal(alias.location,'/competitions/it-1/'+view+'?season=1');
  }
  assert.equal((await read(server,'/__fa_dev__/standings-client.mjs')).status,404);
  assert.equal((await read(server,'/backend/src/auth.ts')).status,404);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
});
test('ordinary preview retains its existing opt-in fictional environment',async()=>{
 const server=createPreviewServer({subdomains:true});server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const result=await read(server,'/calendar');assert.equal(result.status,200);
  assert.match(result.body,/window\.faDevPreviewMode=true/);assert.match(result.body,/fictional local DEV calendar/);
  assert.equal((await read(server,'/__fa_dev__/standings-client.mjs')).status,200);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
});
