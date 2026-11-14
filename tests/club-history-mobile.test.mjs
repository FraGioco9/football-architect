import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('#560 History mobile uses a full-width four-column grid and leaves desktop table intact',()=>{
 const css=read('assets/club-page.css'),start=css.indexOf('/* CLUB-HISTORY-MOBILE:');
 assert.ok(start>0,'standalone mobile-only History styling is present');
 const mobile=css.slice(start,css.indexOf('/* Club Fixtures:',start));
 assert.match(mobile,/@media\(max-width:620px\)\{/);
 assert.match(mobile,/\.club-history\{margin-top:8px;min-width:0\}/,
  'mobile History leaves 8px below the tabs separator before the first row');
 assert.match(css,/\.club-history\{margin-top:14px;min-width:0\}/,
  'desktop keeps the existing 14px section margin');
 assert.match(mobile,/\.club-history-table\{[\s\S]*?display:block;width:100%;min-width:0;max-width:100%/);
 assert.match(mobile,/\.club-history-table tr\{[\s\S]*?display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(mobile,/\.club-history-table-wrap\{width:100%;max-width:100%;overflow:visible\}/);
 assert.match(mobile,/\.club-history-table thead\{position:absolute;[^}]*clip-path:inset\(50%\)/,
  'mobile headings remain in accessibility tree');
 assert.match(mobile,/\.club-history-table \.club-history-competition-row\[hidden\]\{display:none\}/);
 assert.match(css,/\.club-history-table\{--club-history-row-height:56px;width:100%;min-width:1020px;table-layout:fixed/,
  'original desktop row height and table width remain');
 assert.match(css,/@media\(max-width:620px\)\{\s*\.club-history-table\{min-width:1020px\}/,
  'the preexisting legacy mobile override is superseded later, not changed for desktop');
});

test('#560 History mobile preserves disclosure DOM, statistics and competition links',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json')),selected=model.route('/clubs/it/1/history');
 const stats={played:30,won:18,drawn:7,lost:5,goalsFor:54,goalsAgainst:29,goalDifference:25};
 const verified={source:'authoritative',clubKey:'IT-1',coverage:'complete',seasons:[{season:5,memberships:[
  {competitionId:'IT-1',category:'domestic',name:'League',position:4,points:61,stats},
  {competitionId:'int-1',category:'international',name:'Long International Cup Name',cupStatus:'quarterfinals',position:null,points:0,stats:{...stats,played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,goalDifference:0}}
 ]}]};
 const html=model.render(manifest,selected,'it','',null,5,verified);
 assert.equal((html.match(/data-club-history-toggle="5"/g)||[]).length,1,'one accessible season toggle');
 assert.equal((html.match(/data-club-history-detail="5"/g)||[]).length,2,'two collapsed competitions');
 assert.match(html,/data-history-competition-row="IT-1" hidden/);
 assert.match(html,/data-history-competition-row="int-1" hidden/);
 assert.match(html,/\/competitions\/it-1\/standings\?season=5/);
 assert.match(html,/\/competitions\/int-1\/standings\?season=5/);
 assert.ok(html.includes('<td>+25</td>'),'signed goal difference retained');
 assert.ok(html.includes('<td>61</td>'),'points retained');
 const skeleton=model.render(manifest,selected,'it','',null,5,{source:'loading'});
 assert.match(skeleton,/club-history-row-loading/);
 assert.match(skeleton,/club-history-chevron-space/);
 assert.doesNotMatch(skeleton,/data-club-history-toggle=/,'no active toggle before History arrives');
 for(const locale of ['en','de','es','fr','it']){
  const translated=model.render(manifest,selected,locale,'',null,5,verified);
  assert.match(translated,/data-club-history-toggle="5" aria-expanded="false"/,locale);
 }
});

test('#560 table semantics are explicitly restored when CSS displays mobile grid rows',()=>{
 const js=read('assets/club-page.js');
 assert.match(js,/for\(const table of host\.querySelectorAll\('\.club-history-table'\)\)\{/);
 assert.match(js,/table\.setAttribute\('role','table'\)/);
 assert.match(js,/table\.tHead\?\.setAttribute\('role','rowgroup'\)/);
 assert.match(js,/for\(const row of table\.rows\)row\.setAttribute\('role','row'\)/);
 assert.match(js,/thead th'\)\)cell\.setAttribute\('role','columnheader'\)/);
 assert.match(js,/tbody th'\)\)cell\.setAttribute\('role','rowheader'\)/);
 assert.match(js,/tbody td'\)\)cell\.setAttribute\('role','cell'\)/);
});

test('#560 mobile History provides the eight localized numeric labels and nonclipped links',()=>{
 const css=read('assets/club-page.css');
 const mobile=css.slice(css.indexOf('/* CLUB-HISTORY-MOBILE:'),css.indexOf('/* Club Fixtures:',css.indexOf('/* CLUB-HISTORY-MOBILE:')));
 for(const n of [4,5,6,7,8,9,10,11])
  assert.ok(mobile.includes('.club-history-table tr>td:nth-child('+n+')::before'),'label '+n);
 for(const locale of ['it','de','es','fr'])
  assert.ok(mobile.includes('html:lang('+locale+') .club-history-table'),'translated '+locale+' abbrev');
 assert.match(mobile,/\.club-history-table \.club-history-competition-value a\.club-history-competition-link\{[^}]*white-space:normal;overflow:visible/);
 assert.match(mobile,/\.club-history-table \.club-history-competition-row td:nth-child\(3\)\{[^}]*grid-column:1\/-1;display:grid;grid-template-columns:max-content minmax\(0,1fr\);[^}]*align-items:baseline/);
 assert.match(mobile,/\.club-history-table \.club-history-competition-row td:nth-child\(3\):not\(:empty\)::before\{[^}]*font-size:12px;line-height:inherit;[^}]*align-self:baseline/);
 assert.match(mobile,/\.club-history-table tr>td:nth-child\(n\+4\)\{[^}]*grid-template-rows:12px 16px;align-content:center;justify-items:center/);
 assert.match(mobile,/\.club-history-table \.club-history-row-loading>td:nth-child\(n\+4\) \.club-fp-bar\{[^}]*align-self:center;justify-self:center/);
 assert.match(mobile,/\.club-history-table \.club-history-season-row:has\(\.club-history-empty-season\)>td:nth-child\(2\)\{/);
});
