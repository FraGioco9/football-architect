import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const generator=read('tools/generate-club-pages.mjs');
const firstPaint=read('clubs/_shared/index.html');
const model=read('assets/club-model.js');
const css=read('assets/club-page.css');
test('Club competition first-paint and pending rendering reuse hydrated competition row layout',()=>{
 for(const [name,source] of [['generator',generator],['generated HTML',firstPaint],['runtime pending',model]]){
  assert.match(source,/club-competition-list club-fp-competition/,name+' list wrapper');
  assert.match(source,/club-competition-layout club-competition-entry/,name+' verified row grid');
  for(const className of ['club-competition-logo club-fp-competition-logo','club-competition-copy','club-fp-competition-name',
   'club-fp-competition-tier','club-competition-metrics','club-fp-competition-position',
   'club-competition-next-content','club-fp-competition-fixture','club-fp-competition-round'])
   assert.ok(source.includes(className),name+' matches hydrated slot '+className);
  assert.doesNotMatch(source,/club-competition-layout club-fp-competition/,name+' must not restore the legacy three-track placeholder');
 }
 assert.match(model,/club-competition-list.*publicMemberships\.map\(memberCard\)/s,'verified membership list uses shared layout');
 assert.match(model,/const competitionRow=\(\{id,badge,name,tier,status,nextInfo\}\)=>/,'one shared renderer defines the geometry');
 assert.match(model,/const competitionCard=division\?'<div class="club-competition-list">'\+competitionRow\(/,'DEV uses the same list and row');
 assert.match(model,/const memberCard=membership=>\{[\s\S]*?return competitionRow\(/,'authoritative uses the same row');
 assert.equal((model.match(/club-competition-layout club-competition-entry/g)||[]).length,2,
  'only shared renderer and pending skeleton define an entry; never a third source-dependent layout');
 assert.match(css,/^body\.app-body\{--app-page-pad-top:8px\}$/m,'club-only top padding is fixed at 8px');
 assert.match(css,/container:club-competition-panel\s*\/\s*inline-size/);
 assert.match(css,/@container club-competition-panel \(max-width:800px\)/);
 assert.match(css,/grid-template-columns:minmax\(180px,1fr\) minmax\(0,580px\)/);
 assert.match(css,/grid-template-columns:minmax\(205px,220px\) minmax\(0,1fr\)/);
 assert.match(css,/\.club-competition-list \.club-competition-identity\{[^}]*align-self:center;[^}]*min-height:80px/);
 assert.match(css,/\.club-competition-list \.club-competition-entry\{[^}]*align-items:center;padding:0;margin:0;border:0;/);
 assert.doesNotMatch(css,/\.club-competition-list \.club-competition-entry\+\.club-competition-entry\{[^}]*padding/,'following competition rows have no padding');
 assert.doesNotMatch(css,/@container club-competition-panel \(max-width:800px\)\{\s*\.club-competition-list \.club-competition-entry\{[^}]*padding/,'stacked rows retain zero padding');
 assert.match(css,/\.club-competition-list \.club-competition-metrics,[\s\S]*?justify-content:flex-start;[\s\S]*?align-self:stretch;/);
 assert.match(css,/\.club-competition-list \.club-competition-logo\{[^}]*width:60px;height:60px;flex:0 0 60px/);
 assert.match(css,/\.club-competition-list \.club-competition-cup-mark\{[^}]*width:60px;height:60px;flex:0 0 60px/);
 assert.match(css,/\.club-competition-list \.club-competition-name\{font-size:17px;font-weight:700/);
 assert.match(css,/@media\(max-width:760px\)\{[^}]*\.club-competition-list \.club-competition-logo,[^}]*44px/);
 assert.match(css,/\.club-competition-list \.club-competition-name\{font-size:14px\}/);
 assert.match(css,/\.club-competition-list \.club-competition-metrics dd\{[^}]*font-size:24px;font-weight:700;line-height:1\.15/);
 assert.match(css,/\.club-competition-list \.club-competition-metrics dd\{[^}]*white-space:normal;overflow-wrap:anywhere/,'Status wraps long localized values in wide and compact layouts');
 assert.match(css,/\.club-competition-list \.club-competition-metrics dt,[\s\S]*?font-size:12px;line-height:1\.3/);
 assert.match(css,/\.club-competition-list \.club-competition-next-content>a\.app-link,[\s\S]*?font-size:14px;line-height:1\.25/);
 assert.match(css,/\.club-competition-list \.club-competition-next small\{font-size:12px;line-height:1\.25\}/);
 assert.match(css,/\.club-competition-list \.club-competition-metrics dd\{font-size:19px\}/);
 assert.match(css,/\.club-competition-list \.club-competition-next-empty\{font-size:13px;line-height:1\.25/);
 assert.match(css,/\.club-competition-list \.club-competition-summary\{[^}]*align-self:stretch;min-height:80px;/);
 assert.match(css,/\.club-competition-list \.club-competition-match-name\{[^}]*-webkit-line-clamp:unset/);
 assert.match(css,/\.club-competition-list \.club-competition-next-content\{[^}]*min-height:59px;[^}]*justify-content:flex-start;/);
 assert.match(css,/\.club-fp-competition \.club-competition-next-content\{min-block-size:59px;justify-content:flex-start\}/);
});
