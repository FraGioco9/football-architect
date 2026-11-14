import test from 'node:test';
import assert from 'node:assert/strict';
import {createChromeProfile} from './fixtures/chrome-profile.mjs';
test('Chrome profile counts PNG, JPEG and readiness waits without altering return values',async()=>{
 let time=10;const lines=[];
 const profile=createChromeProfile('sample',{clock:()=>time,log:line=>lines.push(line)});
 assert.equal(await profile.measureCDP('Page.captureScreenshot',{format:'png'},async()=>{time+=9;return 'image';}),'image');
 await profile.measureCDP('Page.captureScreenshot',{format:'jpeg'},async()=>{time+=4;});
 await profile.measure('readiness-wait',async()=>{time+=12;});
 const data=profile.emit({pngScreenshots:1});
 assert.equal(data.wallMs,25);
 assert.deepEqual(data.observed,{
  'readiness-wait':{calls:1,elapsedMs:12},
  'screenshot:jpeg':{calls:1,elapsedMs:4},
  'screenshot:png':{calls:1,elapsedMs:9}
 });
 assert.equal(data.pngScreenshots,1);
 assert.equal(lines.length,1);
 assert.deepEqual(JSON.parse(lines[0].slice('CHROME_PROFILE|'.length)),data);
});
test('Chrome profile records failed CDP commands and keeps original rejection',async()=>{
 let time=0;
 const profile=createChromeProfile('failure',{clock:()=>time,log:()=>{}});
 await assert.rejects(profile.measureCDP('Runtime.evaluate',{},async()=>{time+=7;throw Error('CDP failure');}),/CDP failure/);
 const result=profile.emit();
 assert.equal(result.pngScreenshots,0);
 assert.deepEqual(result.observed['runtime-evaluate'],{calls:1,elapsedMs:7});
 assert.equal(result.wallMs,7);
});
test('Chrome profile requires an explicit label',()=>{
 assert.throws(()=>createChromeProfile(''),/non-empty suite/);
 assert.throws(()=>createChromeProfile(null),/non-empty suite/);
});

test('Site Chrome readiness contract keeps the 10-second budget with 50ms checks',async()=>{
 const {readFileSync}=await import('node:fs');
 for(const path of ['club-pages-browser.test.mjs','theme-browser.test.mjs']){
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  assert.ok(source.includes('for(let i=0;i<200;i++){try{if(await run(expr))return;}catch{}await delay(50);}'),path);
  assert.ok(!source.includes('for(let i=0;i<100;i++){try{if(await run(expr))return;}catch{}await delay(100);}'),path);
 }
});
