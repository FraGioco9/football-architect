// Hidden, per-tab login return state: restore and submitted-login regressions.
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
 if(['/assets/routes-registry.js','/assets/competition-tabs.js','/assets/app.css','/assets/account-ui.js','/assets/theme.js','/assets/landing.css','/assets/account.css','/favicon.svg'].includes(pathname)){
  readFile(new URL('..'+pathname,import.meta.url)).then(bytes=>{
   response.writeHead(200,{'Content-Type':pathname.endsWith('.js')?'text/javascript':pathname.endsWith('.css')?'text/css':'image/svg+xml'});response.end(bytes);
  }).catch(()=>{response.writeHead(404);response.end();});return;
 }
 if(pathname==='/api/player/login'){response.writeHead(200,{'Content-Type':'application/json'});response.end('{}');return;}
 if(pathname==='/api/player/session'){
  response.writeHead(request.headers.cookie==='anonymous=1'?401:200,{'Content-Type':'application/json','Cache-Control':'no-store'});
  response.end(JSON.stringify({authenticated:true,actor:{id:'synthetic-player'}}));return;
 }
 if(['/account','/settings','/calendar','/clubs','/competitions/it-1/fixtures'].includes(pathname)){
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
 browser=await playwright[process.env.FA_AUTH_BROWSER||'chromium'].launch({headless:true,...(process.env.FA_PLAYER_CHROME&&process.env.FA_AUTH_BROWSER!=='webkit'?{executablePath:process.env.FA_PLAYER_CHROME,args:['--no-sandbox']}: {})});
 const cases=[
  ['/account/','/account'],['/settings/','/settings'],
  ['/calendar?season=1&week=3#round','/calendar?season=1&week=3#round'],
  ['/clubs?q=Rome','/clubs?q=Rome'],['/competitions/it-1/fixtures','/competitions/it-1/fixtures'],
  ['https://example.invalid/','/account'],['//example.invalid','/account'],
  ['/api/player/session','/account'],['/admin/','/account'],
  ['/account/%2e%2e/api/admin','/account'],
  ['/%2f%2fexample.invalid','/account'],
  ['/account/login/','/account'],
  ['javascript:alert(1)','/account'],
  ['\\\\example.invalid','/account']
 ];
 let assertions=0;
 for(const submitted of [false,true])for(const [next,expected] of cases){
  const context=await browser.newContext();
  try{
   await context.addInitScript(path=>{if(location.pathname.startsWith('/account/login'))sessionStorage.setItem('football-architect:login-return',path)},next);
   if(submitted)await context.addCookies([{name:'anonymous',value:'1',url:origin}]);
   const page=await context.newPage();
   const outside=[];
   page.on('request',req=>{
    if(!req.url().startsWith(origin+'/'))outside.push(req.url());
   });
   await page.goto(origin+'/account/login/?next='+encodeURIComponent('https://example.invalid/'));
   if(submitted){
    await page.waitForFunction(()=>document.documentElement.dataset.accountReady==='true');
    assert.equal(new URL(page.url()).searchParams.has('next'),false,'Legacy next is scrubbed');
    await page.locator('[name=email]').fill('synthetic@example.invalid');
    await page.locator('[name=password]').fill('synthetic-password-123');
    await page.locator('#submit').click();
   }
   await page.locator('#destination').waitFor();
   const actual=new URL(page.url());assert.equal(actual.pathname+actual.search+actual.hash,expected,'safe return for '+next);
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('football-architect:login-return')),null,'Return state consumed on success');
   assert.deepEqual(outside,[],'no external requests for '+next);
   assertions+=submitted?4:3;
  }finally{await context.close()}
 }
 console.log('PLAYER-AUTH-01 safe return browser assertions passed: '+assertions);
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
