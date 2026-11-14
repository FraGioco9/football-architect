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
 assert.match(css,/\.app-players-table\{--app-players-flag-width:44px;--app-players-name-width:216px;--app-players-positions-width:176px;min-width:720px\}/);
 assert.match(css,/\.app-players-table\{--app-players-flag-width:40px;--app-players-name-width:192px;--app-players-positions-width:160px;min-width:680px\}/);
 for(const path of ['players/index.html','admin/players/preview/index.html','admin/contracts/index.html']){
  assert.match(read(path),/<div class="app-players-table-scroll[^"]*" role="region"[^>]*tabindex="0"/,path+' keyboard-scrollable region');
 }
 assert.match(read('clubs/_shared/index.html'),/class="app-players-table-scroll club-roster-table-scroll"/);
});

test('#574 Contracts matches the mobile player tracks and reserves enough fixed space for each column',()=>{
 for(const [breakpoint,width,columns] of [
  [720,888,[44,44,216,176,70,78,80,180]],
  [420,810,[40,40,192,160,68,72,76,162]]
 ]){
  assert.equal(columns.reduce((sum,n)=>sum+n,0),width,'all eight columns sum to fixed table minimum at '+breakpoint);
  const section=admin.split('@media(max-width:'+breakpoint+'px){').at(-1);
  assert.ok(section,'media section exists at '+breakpoint);
  assert.match(section,new RegExp('\\.app-admin-view \\.admin-contracts-table\\{min-width:'+width+'px\\}'));
  for(let index=1;index<=8;index++){
   assert.match(section,new RegExp('\\.app-admin-view \\.admin-contracts-table :is\\(th,td\\):nth-child\\('+index+'\\)\\{width:'+columns[index-1]+'px'));
  }
  assert.equal(columns[1],breakpoint===720?44:40,'flag width matches shared tables');
  assert.equal(columns[2],breakpoint===720?216:192,'player width matches shared tables');
  assert.equal(columns[3],breakpoint===720?176:160,'positions width matches shared tables');
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
