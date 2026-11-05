import test from 'node:test';
import assert from 'node:assert/strict';
import {visualProfiles,frameDrift,screenshotBudget,visualOrigins} from './fe-05-visual-fixtures.mjs';

const good={width:320,height:44,x:18,y:85,display:'flex',visibility:'visible',fontSize:'14px',fontWeight:'400',backgroundColor:'rgb(10, 15, 20)',color:'rgb(250, 250, 250)',borderRadius:'10px'};
test('FE-05: bounded representative matrix covers pages, sizes, locales and themes',()=>{
  assert.ok(visualProfiles.length>=10&&visualProfiles.length<=16);
  assert.deepEqual(new Set(visualProfiles.map(x=>x.width)),new Set([320,390,768,1440]));
  assert.deepEqual(new Set(visualProfiles.map(x=>x.language)),new Set(['en','de','es','fr','it']));
  assert.deepEqual(new Set(visualProfiles.map(x=>x.theme)),new Set(['dark','light']));
  assert.equal(new Set(visualProfiles.map(x=>x.id)).size,visualProfiles.length);
  for(const sample of visualProfiles){
    assert.match(sample.path,/^\//);assert.match(sample.frame,/^[.#\[]/);
    assert.ok(sample.ready&&sample.height>=700);
    assert.ok([visualOrigins.site,visualOrigins.app].includes(sample.site?visualOrigins.site:visualOrigins.app));
  }
  assert.ok(visualProfiles.some(x=>x.path.includes('/competitions/int-1/')));
  assert.ok(visualProfiles.some(x=>x.path.includes('/clubs/it/1/roster')));
  assert.ok(visualProfiles.some(x=>x.path.includes('/account/login')));
});

test('FE-05: geometry comparator rejects meaningful layout or theme regressions',()=>{
  assert.deepEqual(frameDrift(good,{...good,width:320.5}),[]);
  assert.deepEqual(frameDrift(good,{...good,height:47}).map(x=>x.field),['height']);
  assert.deepEqual(frameDrift(good,{...good,backgroundColor:'rgb(0, 0, 0)'}).map(x=>x.field),['backgroundColor']);
  assert.deepEqual(frameDrift(good,{...good,x:21,visibility:'hidden'}).map(x=>x.field),['x','visibility']);
  assert.equal(frameDrift(good,null)[0].field,'missing');
  assert.ok(frameDrift({...good,width:NaN},good).some(x=>x.field==='width'));
});

test('FE-05: a single changed pixel is detectable and tolerance cannot swallow broad changes',()=>{
  assert.equal(screenshotBudget(10,10),1);
  assert.equal(screenshotBudget(100,100),20);
  assert.throws(()=>screenshotBudget(100,100,{fraction:0.5}),/Unsafe/);
  assert.throws(()=>screenshotBudget(0,100),/Invalid/);
});
