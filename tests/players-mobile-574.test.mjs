import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=read('assets/app.css'),admin=read('assets/admin-settings.css');

test('#574 desktop player-table dimensions remain at owner-approved #567 baseline',()=>{
 assert.match(css,/\.app-players-table\{--app-players-flag-width:54px;--app-players-name-width:248px;--app-players-positions-width:200px;width:100%;min-width:782px/);
 assert.match(css,/\.app-players-table thead th\{height:42px;padding-block:2px;[^}]*font-size:12px/);
 assert.match(css,/\.app-players-table tbody tr:not\(\.app-players-empty-row\)\{height:36px\}/);
 assert.match(admin,/\.app-admin-view \.admin-contracts-table\{box-sizing:border-box;width:100%;min-width:1024px;[^}]*font-size:14px/);
 assert.match(admin,/\.app-admin-view \.admin-contracts-table thead th\{height:42px;[^}]*font-size:12px/);
 assert.match(admin,/\.app-admin-view \.admin-contracts-table tbody tr\{height:36px\}/);
});

test('#574 four mobile tables have independent bounded touch scrolling and fixed player tracks',()=>{
 assert.match(css,/\.app-players-table-scroll\{width:100%;max-width:100%;min-width:0;[^}]*overflow-x:auto/);
 assert.match(css,/@media\(max-width:720px\)\{\s*\.app-players-table-scroll\{box-sizing:border-box;scroll-padding-inline:10px\}/);
 assert.match(css,/\.app-players-table-scroll\{overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch\}/);
 assert.match(css,/\.app-players-table\{--app-players-flag-width:32px;--app-players-name-width:128px;--app-players-positions-width:112px;min-width:484px\}/);
 assert.match(css,/\.app-players-table\{--app-players-flag-width:30px;--app-players-name-width:120px;--app-players-positions-width:104px;min-width:464px\}/);
 for(const path of ['players/index.html','admin/players/preview/index.html','admin/contracts/index.html']){
  assert.match(read(path),/<div class="app-players-table-scroll[^"]*" role="region"[^>]*tabindex="0"/,path+' keyboard-scrollable region');
 }
 assert.match(read('clubs/_shared/index.html'),/class="app-players-table-scroll club-roster-table-scroll"/);
});

test('#574 Contracts matches the mobile player tracks and reserves enough fixed space for each column',()=>{
 for(const [breakpoint,width,columns] of [
  [720,630,[34,32,128,112,54,66,60,144]],
  [420,588,[32,30,120,104,52,64,58,128]]
 ]){
  assert.equal(columns.reduce((sum,n)=>sum+n,0),width,'all eight columns sum to fixed table minimum at '+breakpoint);
  const section=admin.split('@media(max-width:'+breakpoint+'px){').at(-1);
  assert.ok(section,'media section exists at '+breakpoint);
  assert.match(section,new RegExp('\\.app-admin-view \\.admin-contracts-table\\{min-width:'+width+'px\\}'));
  for(let index=1;index<=8;index++){
   assert.match(section,new RegExp('\\.app-admin-view \\.admin-contracts-table :is\\(th,td\\):nth-child\\('+index+'\\)\\{width:'+columns[index-1]+'px'));
  }
  assert.equal(columns[1],breakpoint===720?32:30,'flag width matches shared tables');
  assert.equal(columns[2],breakpoint===720?128:120,'player width matches shared tables');
  assert.equal(columns[3],breakpoint===720?112:104,'positions width matches shared tables');
 }
 assert.match(admin,/\.app-admin-view \.admin-contracts-table tbody td:nth-child\(3\),\s*\.app-admin-view \.admin-contracts-table tbody td:nth-child\(8\)\{white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/);
 assert.match(admin,/\.app-admin-view \.admin-contracts-checkbox-cell input\{width:17px;height:17px/);
});

test('#574 first paint and checkbox flow are unchanged at narrow widths',()=>{
 for(const path of ['players/index.html','clubs/_shared/index.html','admin/players/preview/index.html']){
  assert.equal((read(path).match(/class="app-players-loading-row"/g)||[]).length,5,path);
 }
 const contracts=read('admin/contracts/index.html');
 assert.equal((contracts.match(/class="admin-contracts-skeleton"/g)||[]).length,5);
 assert.match(contracts,/data-contracts-all aria-label="Select all players on this page"/);
 assert.match(read('assets/admin-contracts.js'),/input\.dataset\.contractsCheck=String\(p\.id\)/);
 assert.match(css,/\.app-players-table \.app-players-loading-row td\{height:36px/);
 assert.match(admin,/\.app-admin-view \.admin-contracts-skeleton td\{height:36px\}/);
});

test('#574 Club Roster scroller is keyboard-focusable both before and after hydration',()=>{
 const model=read('assets/club-model.js'),generator=read('tools/generate-club-pages.mjs'),shell=read('clubs/_shared/index.html');
 assert.match(shell,/class="app-players-table-scroll club-roster-table-scroll" role="region" aria-label="Roster" tabindex="0" aria-busy="true"/);
 assert.ok(generator.includes('role=\\"region\\" aria-label=\\"Roster\\" tabindex=\\"0\\"'));
 assert.match(model,/role="region" aria-label="'\+escape\(t\.roster\)\+'" tabindex="0"/);
 assert.match(css,/\.app-players-table-scroll:focus-visible\{outline:2px solid var\(--focus\)/);
});

test('#574 mobile names abbreviate without losing original text or accessibility',async()=>{
 const {default:ui}=await import('../assets/players-mobile.js');
 for(const [full,short] of [
  ['Marco Rossi','M. Rossi'],['Émile Zola','É. Zola'],
  ['João Van Dijk','J. Van Dijk'],["Anna D'Amico","A. D'Amico"],
  ['N. Rossi','N. Rossi'],['Pelé','Pelé']
 ])assert.equal(ui.abbreviate(full),short);
 assert.match(read('assets/app.js'),/mobileTablePath==='\/players'/);
 assert.match(read('assets/app.js'),/import\('\/assets\/players-mobile\.js'\)/);
 assert.match(read('tools/publication-guard.mjs'),/"players-directory.js","players-mobile.js"/);
 assert.match(css,/\.app-players-table :is\(\.app-player-name-link,\.club-roster-player-link\)\[data-mobile-name\]::before/);
 assert.match(css,/\.app-admin-view \.admin-contracts-table td\.admin-contracts-player-name\[data-mobile-name\]::before/);
});

test('#574 table edge fades reflect actual overflow, with no false fade at the ends',async()=>{
 const {default:ui}=await import('../assets/players-mobile.js');
 assert.deepEqual(ui.scrollState(720,320,0),{left:false,right:true});
 assert.deepEqual(ui.scrollState(720,320,200),{left:true,right:true});
 assert.deepEqual(ui.scrollState(720,320,400),{left:true,right:false});
 assert.deepEqual(ui.scrollState(320,320,0),{left:false,right:false});
 const source=read('assets/players-mobile.js');
 assert.match(source,/MutationObserver/);
 assert.match(source,/ResizeObserver/);
 assert.match(source,/region\.addEventListener\('scroll'/);
 assert.match(css,/\.app-players-table-scroll\[data-can-scroll-left="true"\]\{--fa-table-fade-left:16px\}/);
 assert.match(css,/\.app-players-table-scroll\[data-can-scroll-right="true"\]\{--fa-table-fade-right:16px\}/);
});


test('#574 player initials render with each row, without a follow-up mutation',()=>{
 const directory=read('assets/players-directory.js'),roster=read('assets/club-model.js');
 const preview=read('assets/admin-players-preview.js'),contracts=read('assets/admin-contracts.js');
 for(const source of [directory,roster,preview,contracts])assert.match(source,/compactPlayerName/);
 assert.match(directory,/link\.dataset\.mobileName=compactPlayerName\(player\.display_name\)/);
 assert.match(preview,/link\.dataset\.mobileName=compactPlayerName\(player\.display_name\)/);
 assert.match(contracts,/name\.dataset\.mobileName=compactPlayerName\(p\.name\)/);
 assert.match(roster,/data-mobile-name=/);
 assert.doesNotMatch(read('assets/players-mobile.js'),/replaceChildren\(fullSpan,smallSpan\)/);
});

test('#574 official club compactName is used only for the mobile Club cell',()=>{
 const directory=read('assets/players-directory.js');
 assert.match(directory,/manifest\.clubs/);
 assert.match(directory,/c\.compactName/);
 assert.match(directory,/label\.dataset\.mobileClubName=compact/);
 assert.match(css,/\.app-players-table \.app-player-club-name\[data-mobile-club-name\]::before/);
 assert.match(css,/th:nth-child\(7\)\{width:220px\}/);
 assert.match(css,/th:nth-child\(7\)\{width:200px\}/);
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const club=manifest.clubs.find(c=>c.countryId==='ENG'&&c.clubId===4);
 assert.equal(club.primaryName,'Bournbrook United');
 assert.equal(club.compactName,'Bournbrook');
});

test('#574 subview fade is visible at first paint and removed when scrolling ends',()=>{
 assert.match(css,/\.app-players-groups\{--app-tabs-fade-left:0px;--app-tabs-fade-right:16px/);
 assert.match(css,/\.app-players-groups\[data-can-scroll-right="false"\]\{--app-tabs-fade-right:0px\}/);
 const roster=read('assets/club-page.css');
 assert.match(roster,/\.club-roster \.club-roster-tabs\{--app-tabs-fade-left:0px;--app-tabs-fade-right:16px/);
 assert.match(roster,/\.club-roster \.club-roster-tabs\[data-can-scroll-right="false"\]\{--app-tabs-fade-right:0px\}/);
});

test('#574 preview subview fade responds to scroll and resizing after first paint',()=>{
 const preview=read('assets/admin-players-preview.js');
 assert.match(preview,/groupBar\.dataset\.canScrollLeft=/);
 assert.match(preview,/groupBar\.dataset\.canScrollRight=/);
 assert.match(preview,/groupBar\?\.addEventListener\('scroll',syncGroupEdges/);
 assert.match(preview,/ResizeObserver\(syncGroupEdges\)/);
});

test('#574 mobile Club crest and compact name are centered together',()=>{
 assert.match(css,/\.app-players-table\[data-players-public\]:not\(\[data-players-table-mode="attributes"\]\) \.app-players-club-content\{display:flex;align-items:center;justify-content:center;gap:0;width:100%/);
 assert.match(css,/\.app-players-table\[data-players-public\]:not\(\[data-players-table-mode="attributes"\]\) tbody td:nth-child\(7\)\{text-align:center\}/);
 assert.match(css,/\.app-players-table\[data-players-public\]:not\(\[data-players-table-mode="attributes"\]\) th:nth-child\(7\) \.app-players-sort-button\{justify-content:center\}/);
 assert.match(css,/\.app-players-table\[data-players-public\]:not\(\[data-players-table-mode="attributes"\]\)\{min-width:678px\}/);
 assert.match(css,/\.app-players-table\[data-players-public\]:not\(\[data-players-table-mode="attributes"\]\)\{min-width:640px\}/);
});


test('#574 Club text center is independent of crest, wrapper and underline',()=>{
 const directory=read('assets/players-directory.js');
 assert.match(directory,/labelAnchor\.append\(crest,link\);content\.append\(labelAnchor\)/);
 assert.match(css,/\.app-players-club-label-anchor\{display:contents\}/,'desktop keeps original layout');
 assert.match(css,/\.app-players-club-label-anchor\{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:0 1 auto;min-width:0;max-width:calc\(100% - 56px\)/);
 assert.match(css,/\.app-players-club-mark\{position:absolute;right:calc\(100% \+ 4px\);top:50%;transform:translateY\(-50%\)\}/,'crest follows text without shifting its center');
 assert.match(css,/\.app-player-club-link\{display:inline-flex;align-items:center;justify-content:center;flex:0 1 auto;width:max-content;min-width:0;max-width:100%;height:18px;min-height:18px;line-height:18px/);
 assert.match(css,/\.app-player-club-name\{display:inline-block;width:max-content;max-width:100%;min-width:0;height:18px;line-height:18px/);
 assert.match(css,/\.app-players-table :is\(\.app-player-name-link,\.club-roster-player-link,\.app-player-club-link\)::after\{content:"";position:absolute;inset-inline:0;bottom:0;height:1px/,'Club and Player share the same underline baseline');
 assert.doesNotMatch(css,/padding-inline-end:28px/, 'no centering padding');
});

test('#574 positions use an overflow-driven, accessible mobile disclosure',async()=>{
 const {default:ui}=await import('../assets/players-mobile.js');
 assert.deepEqual(ui.positionCodes(' RB , RWB, LB '),['RB','RWB','LB']);
 assert.equal(ui.positionsNeedCompact(116,102,3),true);
 assert.equal(ui.positionsNeedCompact(100,102,3),false);
 assert.equal(ui.positionsNeedCompact(116,102,1),false);
 assert.equal(ui.positionsNeedCompact(116,0,3),false,'hidden table should never force a disclosure');
 const code=read('assets/players-mobile.js');
 assert.match(code,/table\.classList\.contains\('admin-contracts-table'\)\?3:2/);
 assert.match(code,/cell\.dataset\.faCompact='false'/);
 assert.match(code,/positionCells\.set\(cell,state\)/);
 assert.match(code,/aria-label/);
 assert.match(code,/aria-expanded/);
 assert.match(code,/event\.key==='Escape'/);
 assert.match(code,/win\.addEventListener\('resize',\(\)=>\{closePopup\(\);schedule\(\)\}/);
 assert.match(code,/win\.addEventListener\('scroll',\(\)=>closePopup\(\),\{capture:true,passive:true\}\)/);
 assert.match(code,/doc\.body\.append\(popup\)/,'tooltip must escape scrolling/masked table');
 assert.match(css,/\.fa-positions-cell\[data-fa-compact="true"\] \.fa-positions-more\{display:inline-flex\}/);
 assert.match(css,/\.fa-positions-more:focus-visible\{outline:2px solid var\(--focus\)/);
 assert.match(css,/\.fa-positions-popup\[hidden\]\{display:none\}/);
});
