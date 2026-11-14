import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=read('assets/app.css'),admin=read('assets/admin-settings.css');

test('#574 desktop player-table dimensions remain at owner-approved #567 baseline',()=>{
 assert.match(css,/\.app-players-table\{--app-players-flag-width:54px;--app-players-name-width:248px;--app-players-positions-width:200px;width:100%;min-width:782px/);
 assert.match(css,/\.app-players-table thead th\{height:42px;padding-block:2px;[^}]*font-size:12px/);
 assert.match(css,/\.app-players-table tbody tr:not\(\.app-players-empty-row\)\{height:36px\}/);
 assert.match(admin,/\.app-admin-view \.admin-contracts-table\{box-sizing:border-box;width:100%;min-width:1000px;[^}]*font-size:14px/);
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
 assert.match(css,/th:nth-child\(7\)\{width:176px\}/);
 assert.match(css,/th:nth-child\(7\)\{width:156px\}/);
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

test('#574 Club header and row names are left-aligned on phones with compact tracks',()=>{
 const mobile=css.split('/* #574: mobile Club header and rows follow the desktop left alignment.')[1];
 assert.ok(mobile,'mobile Club styling exists');
 assert.match(mobile,/tbody td:nth-child\(7\)\{text-align:left\}/);
 assert.match(mobile,/th\.app-players-club-col\{text-align:left\}/);
 assert.match(mobile,/\.app-players-club-content\{display:flex;align-items:center;justify-content:flex-start;gap:0/);
 assert.match(mobile,/\.app-players-club-label-anchor\{position:relative;display:inline-flex;align-items:center;justify-content:flex-start;gap:4px/);
 assert.match(mobile,/\.app-players-club-mark\{position:relative;right:auto;top:auto;transform:none\}/);
 assert.match(mobile,/\.app-player-club-link\{display:inline-flex;align-items:center;justify-content:flex-start;[^}]*height:18px;min-height:18px;line-height:18px/);
 assert.match(mobile,/\.app-player-club-name\{display:inline-block;[^}]*text-align:left/);
 assert.match(css,/\.app-players-club-label-anchor\{display:contents\}/,'desktop treatment unchanged');
 assert.match(css,/\.app-players-table :is\(\.app-player-name-link,\.club-roster-player-link,\.app-player-club-link\)::after\{content:"";position:absolute;inset-inline:0;bottom:0;height:1px/,'Club underline matches Player');
 const dir=read('assets/players-directory.js');
 assert.match(dir,/labelAnchor\.append\(crest,link\);content\.append\(labelAnchor\)/);
 assert.match(css,/th:nth-child\(7\)\{width:176px\}/);
 assert.match(css,/th:nth-child\(7\)\{width:156px\}/);
 assert.match(css,/\.app-players-table\[data-players-public\]:not\(\[data-players-table-mode="attributes"\]\)\{min-width:634px\}/);
 assert.match(css,/\.app-players-table\[data-players-public\]:not\(\[data-players-table-mode="attributes"\]\)\{min-width:596px\}/);
});

test('#574 positions reveal the maximum whole codes and use a +N disclosure',async()=>{
 const {default:ui}=await import('../assets/players-mobile.js');
 const codes=['CB','RB','RWB','LB'];
 assert.deepEqual(ui.positionCodes(' CB , RB, RWB, LB '),codes);
 const measure=(limit)=>(visible,hidden)=>visible.length*7+(hidden?26:0)<=limit;
 assert.deepEqual(ui.visiblePositionPlan(codes,measure(200)),{visible:'CB, RB, RWB, LB',hidden:0});
 assert.deepEqual(ui.visiblePositionPlan(codes,measure(80)),{visible:'CB, RB',hidden:2});
 assert.deepEqual(ui.visiblePositionPlan(codes,measure(52)),{visible:'CB',hidden:3});
 assert.equal(ui.positionsNeedCompact(116,102,3),true);
 const code=read('assets/players-mobile.js');
 assert.match(code,/table\.classList\.contains\('admin-contracts-table'\)\?3:2/);
 assert.match(code,/const badge=hidden\?'\+'\+hidden:''/);
 assert.match(code,/positionCells\.set\(cell,state\)/);
 assert.match(code,/aria-label/);
 assert.match(code,/aria-expanded/);
 assert.match(code,/event\.key==='Escape'/);
 assert.match(code,/win\.addEventListener\('resize',\(\)=>\{closePopup\(\);schedule\(\)\}/);
 assert.match(code,/win\.addEventListener\('scroll',\(\)=>closePopup\(\),\{capture:true,passive:true\}\)/);
 assert.match(code,/doc\.body\.append\(popup\)/,'tooltip must escape scrolling/masked table');
 assert.match(code,/mutation\.target\.closest\?\.\('\.fa-positions-layout'\)/,'internal text changes must not retrigger observers');
 assert.match(code,/const listener=\(\)=>updateFade\(region,false\)/,'horizontal scrolling must not remeasure every player row');
 assert.match(css,/\.fa-positions-visible\{display:block;flex:0 1 auto/,'+N sits right beside the visible positions');
 assert.match(css,/\.fa-positions-cell\[data-fa-compact="true"\] \.fa-positions-more\{display:inline-flex\}/);
 assert.match(css,/\.fa-positions-more:focus-visible\{outline:2px solid var\(--focus\)/);
 assert.match(css,/\.fa-positions-popup\[hidden\]\{display:none\}/);
});

test('#574 position tooltip centers on its +N trigger and prefers above',async()=>{
 const {default:ui}=await import('../assets/players-mobile.js');
 const centered=ui.tooltipPlacement({top:300,bottom:322,left:140,width:22},120,56,390,500);
 assert.deepEqual(centered,{top:237,left:91,placement:'above'},'center aligns with the trigger midpoint');
 const nearBottom=ui.tooltipPlacement({top:420,bottom:442,left:305,width:22},165,68,390,500);
 assert.deepEqual(nearBottom,{top:345,left:217,placement:'above'},'clamped at right edge');
 const nearTop=ui.tooltipPlacement({top:18,bottom:40,left:10,width:22},165,68,390,500);
 assert.deepEqual(nearTop,{top:47,left:8,placement:'below'},'clamped at left edge');
 const code=read('assets/players-mobile.js');
 assert.match(code,/const fitsAbove=above>=edge,fitsBelow=below\+height<=viewportHeight-edge/);
 assert.match(code,/const centeredLeft=rect\.left\+triggerWidth\/2-width\/2/);
 assert.match(code,/popup\.dataset\.placement=position\.placement/);
 assert.match(code,/positionCells\.get\(cell\)\?\.full/,'tooltip shows all positions');
});

test('#574 position tooltip opens and closes with site animation, respecting reduced motion',()=>{
 const code=read('assets/players-mobile.js');
 assert.match(css,/\.fa-positions-popup\{[^}]*animation:app-world-tooltip-in 170ms ease-out both\}/);
 assert.match(css,/\.fa-positions-popup\.is-closing\{animation:app-world-tooltip-out 130ms ease-in both\}/);
 assert.match(css,/\.fa-positions-popup\[hidden\]\{display:none\}/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.fa-positions-popup,\.fa-positions-popup\.is-closing\{animation:none!important\}\}/);
 assert.match(code,/event\.animationName==='app-world-tooltip-out'&&!activeButton/);
 assert.match(code,/popup\.classList\.add\('is-closing'\)/);
 assert.match(code,/popup\.classList\.remove\('is-closing'\)/);
 assert.match(code,/\(prefers-reduced-motion: reduce\)/);
});

test('#574 Club header remains left-aligned at first paint and after hydration',()=>{
 const page=read('players/index.html'),directory=read('assets/players-directory.js');
 assert.match(page,/<th scope="col" class="app-players-club-col">Club<\/th>/);
 assert.match(directory,/club\.className='app-players-club-col'/);
 assert.match(css,/th\.app-players-club-col\{text-align:left\}/);
 assert.match(css,/tbody td:nth-child\(7\)\{text-align:left\}/);
});

test('#574 table right fade is visible at first paint and removed at non-scrollable edge',()=>{
 assert.match(css,/--fa-table-fade-left:0px;--fa-table-fade-right:16px/,'right fade must not wait for JS');
 assert.match(css,/\.app-players-table-scroll\[data-can-scroll-right="false"\]\{--fa-table-fade-right:0px\}/);
 assert.match(css,/\.app-players-table-scroll\[data-can-scroll-right="true"\]\{--fa-table-fade-right:16px\}/);
 assert.match(read('assets/players-mobile.js'),/if\(mobile\(\)&&!region\.clientWidth\)return/,'unmeasurable scrollers should preserve CSS initial fade');
});


test('#574 repeated overflow checks and resize do not lose +N',async()=>{
 const {default:ui}=await import('../assets/players-mobile.js');
 let width=60;
 const cell={dataset:{}},value={
  textContent:'',
  get scrollWidth(){return this.textContent.length*7},
  get clientWidth(){return width-(cell.dataset.faCompact==='true'?26:0)}
 };
 const more={textContent:''},state={value,more,codes:['CB','RB','RWB']};
 assert.equal(ui.updatePositionCompact(cell,state),2);
 assert.equal(value.textContent,'CB');
 assert.equal(more.textContent,'+2');
 assert.equal(ui.updatePositionCompact(cell,state),2);
 assert.equal(more.textContent,'+2','repeat layout passes preserve the disclosure');
 width=98;
 assert.equal(ui.updatePositionCompact(cell,state),0);
 assert.equal(value.textContent,'CB, RB, RWB');
 assert.equal(cell.dataset.faCompact,'false');
 width=74;
 assert.equal(ui.updatePositionCompact(cell,state),1);
 assert.equal(value.textContent,'CB, RB');
 assert.equal(more.textContent,'+1');
 width=60;
 assert.equal(ui.updatePositionCompact(cell,state),2);
 assert.equal(more.textContent,'+2');
});

test('#574 mobile Player names center vertically without depending on underline',()=>{
 const docCss=read('assets/app.css');
 assert.match(docCss,/\.app-players-table tbody td:nth-child\(2\)\{text-align:left;font-weight:650;vertical-align:middle;line-height:18px\}/);
 assert.match(docCss,/\.app-players-table :is\(\.app-player-name-link,\.club-roster-player-link\)\{display:flex;align-items:center;justify-content:flex-start;box-sizing:border-box;width:max-content;max-width:100%;height:18px;min-height:18px;margin:0;padding:0;line-height:18px\}/,'mobile links are block-level flex with exact 18px geometry');
 assert.match(docCss,/\.app-players-table :is\(\.app-player-name-link,\.club-roster-player-link\)\[data-mobile-name\]::before\{content:attr\(data-mobile-name\);display:block;font-size:14px;line-height:18px;white-space:nowrap\}/,'short-name glyphs share stable 18px line box');
 assert.match(docCss,/\.app-players-table :is\(\.app-player-name-link,\.club-roster-player-link,\.app-player-club-link\)::after\{content:"";position:absolute;inset-inline:0;bottom:0;height:1px/,'underline stays outside layout');
 assert.doesNotMatch(docCss,/\.app-player-name-link:hover\{text-decoration:underline/);
});
