import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
const {chromium}=await import(process.env.FA_ACCOUNT_PLAYWRIGHT||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.FA_ACCOUNT_CHROME?{executablePath:process.env.FA_ACCOUNT_CHROME,args:['--no-sandbox']}: {})});
const server=createPreviewServer({subdomains:true,devPreview:false});let checks=0;
try{
 server.listen(2000,'127.0.0.1');await once(server,'listening');
 const required={en:'Complete the required fields.',it:'Compila i campi obbligatori.',de:'Fülle die Pflichtfelder aus.',es:'Completa los campos obligatorios.',fr:'Remplissez les champs obligatoires.'};
 for(const lang of Object.keys(required))for(const width of [320,1440])for(const route of ['login','register']){
  const context=await browser.newContext({viewport:{width,height:1000}});
  try{
   await context.addInitScript(language=>{
    localStorage.setItem('football-architect:language',language);window.accountFrames=[];
    const sample=()=>{const el=document.getElementById('account-language-trigger');if(el&&getComputedStyle(document.body).visibility==='visible'){const r=el.getBoundingClientRect();window.accountFrames.push([r.x,r.y,r.width,r.height]);}requestAnimationFrame(sample);};requestAnimationFrame(sample);
   },lang);
   const page=await context.newPage();let writes=0;
   await page.route('**/api/player/**',r=>{if(r.request().method()==='POST')writes++;return r.fulfill({status:401,body:'{}',contentType:'application/json'});});
   await page.goto('http://app.localhost:2000/account/'+route+'/');
   await page.waitForFunction(()=>document.documentElement.dataset.accountReady==='true'&&window.accountFrames.length>1);
   assert.equal(await page.locator('#account-language').isVisible(),false);
   const frames=await page.evaluate(()=>window.accountFrames);
   assert.ok(frames.every(row=>row.every((value,i)=>Math.abs(value-frames[0][i])<1)),'Language menu does not change geometry after first visible paint');
   await page.locator('#submit').click();
   const message=page.locator('.account-feedback');await message.waitFor();
   assert.equal(await message.textContent(),required[lang]);assert.equal(writes,0);
   assert.equal(await message.getAttribute('role'),'status');
   const field=page.locator(route==='login'?'[name=email]':'[name=username]');
   assert.equal(await field.evaluate(el=>getComputedStyle(el).outlineStyle),'none');
   assert.equal(await page.locator('h1').evaluate(el=>getComputedStyle(el).userSelect),'none');
   await field.fill(route==='login'?'synthetic@example.invalid':'Synthetic_User');
   assert.ok((await field.inputValue()).length>0,'Fields remain editable');
   checks++;
  }finally{await context.close();}
 }
 const recovery=await browser.newContext();
 try{
  const page=await recovery.newPage();let requests=0;
  await page.route('**/api/player/verify-email',r=>{requests++;return r.abort()});
  await page.goto('http://app.localhost:2000/account/verify-email/?token='+'a'.repeat(64));
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('unavailable'));
  assert.equal(await page.locator('#status').getAttribute('data-kind'),'error');
  assert.equal(new URL(page.url()).searchParams.has('token'),false);assert.equal(requests,1);checks++;
 }finally{await recovery.close()}
 console.log('Account feedback/first-paint browser PASS: '+checks+' cases');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await browser.close();}
