import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const generator=read('tools/generate-club-pages.mjs');
const firstPaint=read('clubs/_shared/index.html');
const model=read('assets/club-model.js');
const css=read('assets/club-page.css');

test('Club Competitions reuse one semantic row for hydrated, runtime pending and first paint',()=>{
 for(const [name,source] of [['generator',generator],['generated HTML',firstPaint],['runtime pending',model]]){
  assert.match(source,/club-competition-list club-fp-competition/,name+' pending list');
  assert.match(source,/club-competition-layout club-competition-entry/,name+' canonical entry');
  for(const klass of ['club-competition-logo club-fp-competition-logo','club-competition-copy',
   'club-fp-competition-name','club-fp-competition-tier','club-competition-metrics',
   'club-fp-competition-position','club-competition-next-content',
   'club-fp-competition-fixture','club-fp-competition-round'])
   assert.ok(source.includes(klass),name+' preserves '+klass);
 }
 assert.match(model,/const competitionRow=\(\{id,badge,name,tier,status,nextInfo\}\)=>/);
 assert.match(model,/const competitionCard=division\?'<div class="club-competition-list">'\+competitionRow\(/);
 assert.match(model,/const memberCard=membership=>\{[\s\S]*?return competitionRow\(/);
 assert.match(model,/publicMemberships\.map\(memberCard\)/);
 assert.equal((model.match(/club-competition-layout club-competition-entry/g)||[]).length,2,
  'shared renderer plus pending placeholder are the only runtime entry definitions');
});

test('Club Competitions define a single three-column entry and shared label/value tracks',()=>{
 assert.match(css,/container:club-competition-panel\s*\/\s*inline-size/);
 assert.match(css,/\.club-competition-list \.club-competition-entry\{[\s\S]*?grid-template-columns:minmax\(180px,1fr\) minmax\(205px,220px\) minmax\(0,340px\)/);
 assert.match(css,/\.club-competition-list \.club-competition-summary\{[^}]*display:contents;/,'Summary wrapper does not create a nested layout');
 assert.match(css,/\.club-competition-list \.club-competition-metrics\{[^}]*grid-column:2;grid-row:1;/,'Status is in direct column two');
 assert.match(css,/\.club-competition-list \.club-competition-next\{[^}]*grid-column:3;grid-row:1;/,'Next match is in direct column three');
 assert.match(css,/\.club-competition-list \.club-competition-metrics>div,\s*\.club-competition-list \.club-competition-next\{[\s\S]*?grid-template-rows:16px minmax\(59px,auto\);row-gap:4px;/,
  'Status and Next match use identical 16px labels and 59px value slots');
 assert.match(css,/\.club-competition-list \.club-competition-metrics dt\{text-align:center\}/,
  'Status header is centered in its value column');
 assert.match(css,/\.club-competition-list \.club-competition-metrics dd\{[^}]*text-align:center;/,
  'Status value is centered in the same column, even when wrapped');
 assert.match(css,/\.club-competition-list \.club-competition-next-content\{[^}]*grid-column:1;grid-row:2;/,
  'Next match always starts on value row 2');
 assert.match(css,/@container club-competition-panel \(max-width:800px\)/);
 assert.match(css,/@container club-competition-panel \(max-width:500px\)/);
 assert.match(css,/grid-template-columns:minmax\(92px,40%\) minmax\(0,1fr\)/);
 assert.match(css,/grid-template-columns:minmax\(261px,276px\) minmax\(0,1fr\)/,'Stacked layouts reserve the same columns for every row');
 assert.match(css,/\.club-competition-list \.club-competition-metrics\{[^}]*grid-column:1;grid-row:2;padding-left:56px;/);
 assert.match(css,/\.club-competition-list \.club-competition-entry\+\.club-competition-entry\{[^}]*border-top:1px solid var\(--line\);margin:0;padding:0;/);
 assert.doesNotMatch(css,/\.club-competition-layout\s*\{/,'old competing rules for layout class were removed');
 assert.doesNotMatch(css,/grid-template-rows:subgrid/,'layout must not rely on nested subgrids');
});

test('Competition skeleton paint sits inside hydrated text line boxes without duplicate spacing',()=>{
 assert.match(css,/\.club-fp-competition \.club-competition-name\{min-height:1\.3em\}/);
 assert.match(css,/\.club-fp-competition \.club-competition-tier\{min-height:1\.35em\}/);
 assert.match(css,/\.club-fp-competition \.club-fp-competition-position\{[^}]*margin:calc\(\(1\.15em - 12px\)\/2\) auto 0;/);
 assert.match(css,/\.club-fp-competition \.club-fp-competition-fixture\{[^}]*font-size:14px;line-height:1\.25;block-size:1\.25em;/);
 assert.match(css,/\.club-fp-competition \.club-fp-competition-round\{[^}]*font-size:12px;line-height:1\.25;block-size:1\.25em;/);
 assert.match(css,/\.club-competition \.club-fp-competition \.club-competition-next-content>\.club-fp-bar\+\.club-fp-bar\{\s*margin-top:0;/);
 assert.doesNotMatch(css,/\.club-fp-competition \.club-fp-competition-round\{inline-size:64px;block-size:10px\}/,
  'round wrapper remains 15px while its inner painted bar is 10px');
 assert.match(css,/@media\(max-width:760px\)\{\s*\.club-fp-competition \.club-fp-competition-fixture\{font-size:13px\}/);
});
