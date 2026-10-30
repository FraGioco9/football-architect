// PLAYER-AUTH-01: deferred real-browser regression for safe post-login return routing.
// Browser/CI execution is reserved for the explicitly approved final gate.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';

const html=await readFile(new URL('../account/login/index.html',import.meta.url),'utf8');
const js=await readFile(new URL('../assets/account-login.js',import.meta.url),'utf8');
const server=createServer((request,response)=>{
 const pathname=new URL(request.url,'http://localhost').pathname;
 if(pathname==='/account/login/'||pathname==='/account/login'){
  response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});response.end(html);return;
 }
 if(pathname==='/assets/account-login.js'){
  response.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});response.end(js);return;
 }
 if(['/assets/competition-tabs.js','/assets/app.css','/assets/account-ui.js','/assets/theme.js','/assets/landing.css','/assets/account.css','/favicon.svg'].includes(pathname)){
  readFile(new URL('..'+pathname,import.meta.url)).then(bytes=>{
   response.writeHead(200,{'Content-Type':pathname.endsWith('.js')?'text/javascript':pathname.endsWith('.css')?'text/css':'image/svg+xml'});response.end(bytes);
  }).catch(()=>{response.writeHead(404);response.end();});return;
 }
 if(pathname==='/api/player/session'){
  response.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
  response.end(JSON.stringify({authenticated:true,actor:{id:'synthetic-player'}}));return;
 }
 if(pathname==='/account/'||pathname==='/settings/'){
  response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  response.end('<!doctype html><title>Safe destination</title><main id="destination">Allowed</main>');return;
 }
 response.writeHead(404);response.end('Not found');
});
let browser;
try{
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin='http://127.0.0.1:'+server.address().port;
 const playwright=await import(process.env.FA_PLAYER_PLAYWRIGHT||'playwright');
 browser=await playwright.chromium.launch({headless:true,...(process.env.FA_PLAYER_CHROME?{executablePath:process.env.FA_PLAYER_CHROME,args:['--no-sandbox']}: {})});
 const cases=[
  ['/account/','/account/'],['/settings/','/settings/'],
  ['https://example.invalid/','/account/'],['//example.invalid','/account/'],
  ['/api/player/session','/account/'],['/admin/','/account/'],
  ['/account/%2e%2e/api/admin','/account/'],
  ['/%2f%2fexample.invalid','/account/'],
  ['/settings/?external=https://example.invalid','/account/'],
  ['javascript:alert(1)','/account/'],
  ['\\\\example.invalid','/account/']
 ];
 let assertions=0;
 for(const [next,expected] of cases){
  const context=await browser.newContext();
  try{
   const page=await context.newPage();
   const outside=[];
   page.on('request',req=>{
    if(!req.url().startsWith(origin+'/'))outside.push(req.url());
   });
   await page.goto(origin+'/account/login/?next='+encodeURIComponent(next));
   await page.locator('#destination').waitFor();
   assert.equal(new URL(page.url()).pathname,expected,'safe return for '+next);
   assert.deepEqual(outside,[],'no external requests for '+next);
   assertions+=2;
  }finally{await context.close()}
 }
 console.log('PLAYER-AUTH-01 safe return browser assertions passed: '+assertions);
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
