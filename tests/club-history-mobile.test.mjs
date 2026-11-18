import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('#560 History mobile uses a full-width four-column grid and leaves desktop table intact',()=>{
 const css=read('assets/club-page.css'),start=css.indexOf('/* CLUB-HISTORY-MOBILE:');
 assert.ok(start>0,'standalone mobile-only History styling is present');
 const mobile=css.slice(start,css.indexOf('/* Club Fixtures:',start));
 assert.match(mobile,/@media\(max-width:620px\)\{/);
 assert.match(mobile,/\.club-history\{margin-top:5px;min-width:0\}/,
  'mobile History retains the requested 5px separation from tabs');
 assert.match(css,/\.club-history\{margin-top:5px;min-width:0\}/,
  'desktop uses the same 5px separation as mobile');
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
 assert.ok(html.includes('<td><span class="club-history-stat-value">+25</span></td>'),'signed goal difference retained');
 assert.ok(html.includes('<td><span class="club-history-stat-value">61</span></td>'),'points retained');
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
 {const firstPaint=read('clubs/_shared/index.html'),generator=read('tools/generate-club-pages.mjs'),runtime=read('assets/club-page.js');
  for(const source of [firstPaint,generator]){
   assert.ok(source.includes('let restoredTabScroll=false;'));
   assert.ok(source.includes('if(chosen&&!restoredTabScroll)'));
  }
  assert.ok(runtime.includes("if(tabs.dataset.clubInteractionsBound!=='true')"));
  assert.ok(runtime.includes('if(!restored&&Number.isFinite(tabScrollLeft))tabs.scrollLeft=tabScrollLeft'));
 }

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
 {const style=read('assets/club-page.css');
  assert.ok(style.includes('.club-history-table .club-history-season-row{padding-top:0}'));
  assert.ok(style.includes('.club-history-table .club-history-season-row .club-history-expand{min-height:34px;align-items:center}'));
  assert.ok(style.includes('.club-history-table .club-history-row-loading .club-history-skeleton-label{min-height:34px}'));
 }

 const css=read('assets/club-page.css');
 const mobile=css.slice(css.indexOf('/* CLUB-HISTORY-MOBILE:'),css.indexOf('/* Club Fixtures:',css.indexOf('/* CLUB-HISTORY-MOBILE:')));
 for(const n of [4,5,6,7,8,9,10,11])
  assert.ok(mobile.includes('.club-history-table tr>td:nth-child('+n+')::before'),'label '+n);
 for(const locale of ['it','de','es','fr'])
  assert.ok(mobile.includes('html:lang('+locale+') .club-history-table'),'translated '+locale+' abbrev');
 assert.match(mobile,/\.club-history-table \.club-history-competition-value a\.club-history-competition-link\{[^}]*white-space:normal;overflow:visible/);
 assert.match(mobile,/\.club-history-table \.club-history-competition-row td:nth-child\(3\)\{[^}]*grid-column:1\/-1;display:grid;grid-template-columns:max-content minmax\(0,1fr\);[^}]*align-items:baseline/);
 assert.match(mobile,/\.club-history-table \.club-history-competition-row td:nth-child\(3\):not\(:empty\)::before\{[^}]*font-size:12px;line-height:inherit;[^}]*align-self:baseline/);
 assert.match(mobile,/\.club-history-table tr>td:nth-child\(n\+4\)\{[^}]*grid-template-rows:12px 24px;align-content:center;justify-items:center/);
 assert.match(mobile,/\.club-history-table \.club-history-row-loading>td:nth-child\(n\+4\) \.club-fp-bar\{[^}]*align-self:center;justify-self:center/);
 assert.match(mobile,/\.club-history-table \.club-history-season-row:has\(\.club-history-empty-season\)>td:nth-child\(2\)\{/);
});

test('#578 Club History shows Season, Competition and Result header in all five languages',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const selected=model.route('/clubs/it/1/history');
 const labels={
  en:['Season','Competition','Result'],it:['Stagione','Competizione','Risultato'],
  de:['Saison','Wettbewerb','Ergebnis'],es:['Temporada','Competición','Resultado'],
  fr:['Saison','Compétition','Résultat']
 };
 for(const [lang,expected] of Object.entries(labels)){
  const page=model.render(manifest,selected,lang,'',null,1,{source:'loading'});
  const headings=[...page.matchAll(/<th scope="col" class="club-history-(?:season|name|position)-col" aria-label="([^"]+)">([^<]+)<\/th>/g)];
  assert.equal(headings.length,3,lang+' keeps three semantic headers');
  assert.deepEqual(headings.map(hit=>hit[2]),expected,lang+' shows headings instead of visually empty cells');
  assert.deepEqual(headings.map(hit=>hit[1]),expected,lang+' preserves spoken labels');
 }
});

test('#578 first-paint Club History skeleton matches hydrated column geometry',()=>{
 const html=read('clubs/_shared/index.html'),generator=read('tools/generate-club-pages.mjs'),css=read('assets/club-page.css');
 const start=html.indexOf('<section class="club-history club-first-paint-panel club-first-paint-other"');
 assert.ok(start>=0,'first paint section exists');
 const section=html.slice(start,html.indexOf('</section>',start)+10);
 for(const [label,column] of [['Season','season'],['Competition','competition'],['Result','result']]){
  const heading='data-club-history-label="'+column+'" aria-label="'+label+'">'+label+'</th>';
  assert.ok(section.includes(heading),'static '+label+' is visible');
  assert.ok(generator.includes(heading),'generator retains '+label);
 }
 const pendingStart=section.indexOf('<tr class="club-history-season-row club-history-row-loading"');
 assert.ok(pendingStart>=0);
 const pending=section.slice(pendingStart,section.indexOf('</tr>',pendingStart)+5);
 assert.ok(pending.includes('club-history-chevron-space'));
 assert.ok(pending.includes('club-history-total-label'));
 assert.equal(pending.split('data-club-history-skeleton=').length-1,7);
 for(const key of ['played','won','drawn','lost','gf','ga','gd']){
  assert.ok(pending.includes('data-club-history-skeleton="'+key+'"><span class="club-history-stat-value">'));
  assert.ok(pending.includes('data-club-history-skeleton="'+key+'"><span class="club-history-stat-value"><span class="club-fp-bar" data-skeleton-sample="'),
   'first-paint metric '+key+' uses a font-measured bar');
 }
 assert.ok(pending.endsWith('<td></td></tr>'),'points summary placeholder stays empty');
 assert.ok(css.includes('--club-history-row-height:56px'));
 assert.ok(css.includes('.club-history-table td:nth-child(n+4) .club-history-stat-value'));
 assert.ok(css.includes('.club-history-table .club-history-total-value'));
 assert.ok(css.includes('grid-row:2;min-height:24px;width:100%;align-self:center;justify-content:center'));
 assert.ok(pending.includes('class="club-history-total-label"><span class="club-history-total-value">'));
 assert.ok(generator.includes('const historyKeys=["season","competition","result"'));
});

test('#578 Club History hydrated values and skeletons share the same slots',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const route=model.route('/clubs/it/1/history');
 const stats={played:30,won:18,drawn:7,lost:5,goalsFor:54,goalsAgainst:29,goalDifference:25};
 const data={source:'authoritative',clubKey:'IT-1',coverage:'complete',
  seasons:[{season:1,memberships:[{competitionId:'IT-1',category:'domestic',
    name:'League',position:4,points:61,stats}]}]};
 const ready=model.render(manifest,route,'en','',null,1,data);
 const pending=model.render(manifest,route,'en','',null,1,{source:'loading'});
 assert.equal((ready.match(/class="club-history-stat-value"/g)||[]).length,16,
  'eight cells in summary and eight in competition use shared value geometry');
 assert.equal((pending.match(/class="club-history-stat-value"/g)||[]).length,7,
  'seven loading numeric cells use the same value geometry');
 assert.ok(ready.includes('class="club-history-total-value">Total</span>'));
 assert.ok(pending.includes('class="club-history-total-value"><span class="club-fp-bar"'));
});

test('#578 Club History loading bars and verified numeric values share one 24px centerline',()=>{
 const css=read('assets/club-page.css');
 assert.match(css,/\.club-history-table td:nth-child\(n\+4\) \.club-history-stat-value\{\s*display:flex;box-sizing:border-box;width:100%;min-width:0;height:24px;min-height:24px;/);
 assert.match(css,/\.club-history-table \.club-history-row-loading \.club-history-stat-value>\.club-fp-bar\{\s*flex:0 0 auto;max-width:100%;/);
 assert.match(css,/\.club-history-table \.club-history-total-value\{\s*display:flex;box-sizing:border-box;width:100%;min-width:0;height:24px;min-height:24px;/);
 assert.match(css,/\.club-history-table \.club-history-row-loading :is\(\.club-history-skeleton-label,\.club-history-total-value\)>\.club-fp-bar\{\s*align-self:center;flex:none;margin-inline-start:0;/,
  'Season and Total skeletons remain anchored to the verified text center and left edge');
 assert.match(css,/\.club-fp-bar\{display:block;inline-size:[^}]*block-size:12px;border-radius:5px;background:/,
  'History inherits the original Club skeleton bar');
 assert.match(css,/\.club-history-table \.club-history-row-loading \.club-fp-bar\{\s*display:block;box-sizing:border-box;translate:none;/,
  'History uses filled bars instead of stroke decoration');
 assert.match(css,/@media\(min-width:621px\)\{\s*\.club-history-table \.club-history-row-loading \.club-fp-bar\{translate:0 1px\}/,
  'History desktop skeleton paints below the data center instead of above it');
 assert.match(css,/\.club-history-row-loading \.club-history-skeleton-label\{[^}]*font-weight:700\}/,
  'History Season uses the verified label typography');
 assert.doesNotMatch(css,/\.club-history-row-loading \.club-fp-bar::before\{[^}]*text-decoration-line:line-through/,
  'History has no ghost-text-based skeleton painter');
 for(const marker of ['club-history-skeleton-label','club-history-total-value','club-history-skeleton-stat'])
  assert.ok(css.includes(marker),'History loading geometry reserves '+marker);
 assert.match(css,/\.club-history-chevron,\.club-history-chevron-space\{\s*position:absolute;inset-inline-start:0;top:calc\(50% - 4px\);/,
  'Club History icon placement does not shift text or skeletons');
});

test('#578 Club History pending skeleton samples match runtime and reserve actual numeric glyph widths',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const route=model.route('/clubs/it/1/history');
 const loading=model.render(manifest,route,'it','',null,1,{source:'loading'});
 const firstPaint=read('clubs/_shared/index.html'),css=read('assets/club-page.css');
 const samples={played:'30',won:'18',drawn:'10',lost:'12',gf:'104',ga:'104',gd:'+52'};
 assert.ok(Object.values(samples).every(sample=>sample.replace(/^[+-]/,'').length>=2),
  'every Club History numeric skeleton represents at least two digit positions');
 assert.equal(samples.gf.length,3,'GF reserves three digits when required');
  assert.equal(samples.ga,samples.gf,'GA and GF reserve identical widths in first paint and runtime pending');
 assert.equal(samples.played.length,2,'played reserves two digits');
 for(const [key,text] of Object.entries(samples)){
  const mark='data-club-history-skeleton="'+key+'"><span class="club-history-stat-value"><span class="club-fp-bar" data-skeleton-sample="'+text+'"';
  assert.ok(loading.includes(mark),'runtime pending value '+key+' measured with real glyphs');
  assert.ok(firstPaint.includes(mark),'parser-time pending value '+key+' matches');
 }
 assert.match(css,/\.club-history-table \.club-history-row-loading \.club-history-skeleton-stat \.club-fp-bar\[data-skeleton-sample\]\{/);
 assert.match(css,/content:attr\(data-skeleton-sample\);font-variant-numeric:tabular-nums;/);
 assert.doesNotMatch(css,/\[data-club-history-skeleton="played"\] \.club-fp-bar\{width:/);
 assert.match(css,/\.club-history-competition-value a\.club-history-competition-link\{line-height:1\.5;vertical-align:middle\}/,
  'the competition link leaves full glyph and underline height');
 assert.match(css,/@media\(min-width:621px\)\{\s*\.club-history-table \.club-history-competition-row \.club-history-competition-value\{position:relative\}/,
  'desktop History Competition is positioned against its own row');
 assert.match(css,/\.club-history-competition-row \.club-history-competition-value a\.club-history-competition-link\{\s*position:absolute;inset-inline-start:10px;top:50%;transform:translateY\(-50%\);\s*display:inline-flex;align-items:center;block-size:24px;min-height:24px;/,
  'Competition text uses the same 24px centerline as actual stats');
 assert.match(css,/\.club-history-table \.club-history-competition-value\{text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-inline-start:10px\}/,
  'Club History Competition starts at the same 10px text origin as Total and the header');
 assert.match(css,/@media\(max-width:620px\)\{[\s\S]*?\.club-history-table \.club-history-competition-value a\.club-history-competition-link\{\s*display:inline;max-width:100%;white-space:normal;/,
  'long mobile Competition names still wrap inside their own grid row');
 assert.match(css,/a\.club-history-competition-link:is\(:hover,:focus-visible\) \.club-history-competition-text\{/,
  'Club History keeps text-only competition underline');
});
