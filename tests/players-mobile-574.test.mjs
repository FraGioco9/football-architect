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
 assert.match(css,/\.app-players-table\{--app-players-flag-width:36px;--app-players-name-width:160px;--app-players-positions-width:112px;min-width:640px\}/);
 assert.match(css,/\.app-players-table\{--app-players-flag-width:34px;--app-players-name-width:144px;--app-players-positions-width:104px;min-width:608px\}/);
 for(const path of ['players/index.html','admin/players/preview/index.html','admin/contracts/index.html']){
  assert.match(read(path),/<div class="app-players-table-scroll[^"]*" role="region"[^>]*tabindex="0"/,path+' keyboard-scrollable region');
 }
 assert.match(read('clubs/_shared/index.html'),/class="app-players-table-scroll club-roster-table-scroll"/);
});

test('#574 Contracts matches the mobile player tracks and reserves enough fixed space for each column',()=>{
 for(const [breakpoint,width,columns] of [
  [720,706,[40,36,160,112,64,72,72,150]],
  [420,650,[36,34,144,104,60,68,68,136]]
 ]){
  assert.equal(columns.reduce((sum,n)=>sum+n,0),width,'all eight columns sum to fixed table minimum at '+breakpoint);
  const section=admin.split('@media(max-width:'+breakpoint+'px){').at(-1);
  assert.ok(section,'media section exists at '+breakpoint);
  assert.match(section,new RegExp('\\.app-admin-view \\.admin-contracts-table\\{min-width:'+width+'px\\}'));
  for(let index=1;index<=8;index++){
   assert.match(section,new RegExp('\\.app-admin-view \\.admin-contracts-table :is\\(th,td\\):nth-child\\('+index+'\\)\\{width:'+columns[index-1]+'px'));
  }
  assert.equal(columns[1],breakpoint===720?36:34,'flag width matches shared tables');
  assert.equal(columns[2],breakpoint===720?160:144,'player width matches shared tables');
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
 assert.match(css,/\.fa-player-short-name\{display:none\}/);
 assert.match(css,/\.app-players-table \.fa-player-short-name,[\s\S]*?\.app-admin-view \.admin-contracts-table \.fa-player-short-name\{display:inline\}/);
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
