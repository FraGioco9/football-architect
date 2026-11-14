import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('#532 all player tables share approved 36px/42px layout, 14px/12px type and flags',()=>{
 const css=read('assets/app.css'),admin=read('assets/admin-settings.css');
 assert.match(css,/\.app-players-table\{[^}]*font-size:14px/);
 assert.match(css,/\.app-players-table thead th\{height:42px;padding-block:2px;[^}]*font-size:12px/);
 assert.match(css,/\.app-players-table tbody tr:not\(\.app-players-empty-row\)\{height:36px\}/);
 assert.match(css,/\.app-players-table \.app-players-loading-row td\{height:36px;padding:0 16px\}/);
 assert.match(css,/\.app-players-nationality-flag\{display:block;width:20px;height:15px;object-fit:contain;margin-inline:auto\}/);
 assert.match(css,/\.app-players-table :is\(\.app-player-name-link,\.club-roster-player-link,\.app-player-club-link\):is\(:hover,:focus-visible\)\{text-decoration-line:underline/);
 assert.match(admin,/\.app-admin-view \.admin-contracts-table\{[^}]*font-size:14px/);
 assert.match(admin,/\.app-admin-view \.admin-contracts-table thead th\{height:42px;padding-block:2px;[^}]*font-size:12px/);
 assert.match(admin,/\.app-admin-view \.admin-contracts-table tbody tr\{height:36px\}/);
 assert.match(admin,/\.app-admin-view \.admin-contracts-skeleton td\{height:36px\}/);
 assert.match(read('assets/admin-contracts.js'),/img\.tabIndex=0;img\.width=20;img\.height=15;flagTd\.append\(img\)/);
});

test('#532 Club Roster Info follows public Positions-before-Age while preserving five views and sorting',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const club={countryId:'IT',clubId:1,view:'roster',base:'/clubs/it/1'};
 const attrs=Object.fromEntries('passing technique dribbling shooting crossing tackling marking heading vision positioning decisions composure speed strength stamina agility gk_reflexes gk_handling gk_positioning gk_aerial'.split(' ').map(k=>[k,45]));
 const player={id:17,display_name:'Marco Example',nationality:'ITA',age:23,primary_position:'CM',secondary_positions:['DM'],height_cm:181,preferred_foot:'left',attributes:attrs};
 const snap={source:'ready',clubKey:'IT-1',count:1,players:[player]};
 for(const language of ['en','de','es','fr','it']){
  const html=model.render(manifest,club,language,'?view=info',null,1,null,snap);
  const table=html.slice(html.indexOf('<table class="app-players-table club-roster-table"'));
  assert.deepEqual([...table.matchAll(/data-club-roster-sort="([^"]+)"/g)].slice(0,6).map(x=>x[1]),
   ['nationality','name','positions','age','height','foot'],language+' header order');
  assert.match(table,/<colgroup><col class="app-players-flag-column"><col class="app-players-name-column"><col class="app-players-view-third-column">/);
  assert.match(table,/<a class="club-roster-player-link" href="\/players\/17" data-mobile-name="M. Example" aria-label="Marco Example"><span class="fa-player-full-name">Marco Example<\/span><span class="fa-player-short-name">M. Example<\/span><\/a><\/td><td>CM, DM<\/td><td>23<\/td>/,language+' data order');
  const attrsHtml=model.render(manifest,club,language,'?view=technical',null,1,null,snap);
  assert.match(attrsHtml,/data-roster-mode="attributes"/);
  assert.match(attrsHtml,/data-club-roster-sort="positions"/);
 }
 const shell=read('clubs/_shared/index.html'),gen=read('tools/generate-club-pages.mjs');
 for(const src of [shell,gen]){
  assert.match(src,/else if\(index===2\)col\.className='app-players-view-third-column'/);
  assert.match(src,/\['nationality','name','positions','age','height','foot'\]/);
 }
 assert.deepEqual([...shell.matchAll(/data-club-roster-sort="([^"]+)"/g)].slice(0,6).map(x=>x[1]),
  ['nationality','name','positions','age','height','foot']);
 assert.equal((shell.match(/class="app-players-loading-row"/g)||[]).length,5);
 const css=read('assets/app.css');
 assert.match(css,/\.app-players-table:not\(\[data-players-public\]\):not\(\[data-players-table-mode="attributes"\]\) col\.app-players-view-third-column\{width:var\(--app-players-positions-width\)\}/);
 assert.match(css,/\.app-players-table:not\(\[data-players-public\]\):not\(\[data-players-table-mode="attributes"\]\) :is\(th,td\):nth-child\(3\),/);
});

test('#532 Admin preview retains protected draft flow and common player column order',async()=>{
 const {renderAdminPlayersPreview}=await import('../tools/render-admin-settings.mjs');
 const html=read('admin/players/preview/index.html');
 const preview=renderAdminPlayersPreview();
 assert.ok(html.includes(preview),'generated preview shell must match committed HTML');
 assert.match(preview,/<th scope="col">Player<\/th><th scope="col">Positions<\/th><th scope="col">Age<\/th>/);
 assert.equal((preview.match(/class="app-players-loading-row"/g)||[]).length,5);
 const js=read('assets/admin-players-preview.js');
 assert.match(js,/view==='overview'\?\['nationality','name','positions','age','height','foot'\]/);
 assert.match(js,/if\(view==='overview'\)\{\s*addCell\(row,positions\);\s*addCell\(row,Number\.isSafeInteger\(player\.age\)/);
 assert.match(js,/target\.searchParams\.set\('draftId',id\)/);
 assert.match(js,/authorizedPost\('\/api\/admin\/players\/draft',\{draftId:id\}\)/);
 assert.match(read('assets/app.css'),/\.app-players-table:not\(\[data-players-public\]\):not\(\[data-players-table-mode="attributes"\]\) th:nth-child\(3\)\{width:var\(--app-players-positions-width\)\}/);
});

test('#532 Admin Contracts preserves checkbox selection and aligns player data/first paint',async()=>{
 const {renderAdminContracts}=await import('../tools/render-admin-contracts.mjs');
 const html=read('admin/contracts/index.html'),section=renderAdminContracts();
 assert.ok(html.includes(section),'Admin Contracts generator must exactly match the checked-in page');
 assert.deepEqual([...section.matchAll(/data-contracts-copy="(player|positions|age|height|foot|club)"/g)].map(x=>x[1]),
  ['player','positions','age','height','foot','club']);
 assert.match(section,/data-contracts-all aria-label="Select all players on this page"/);
 assert.equal((section.match(/class="admin-contracts-skeleton"/g)||[]).length,5);
 const js=read('assets/admin-contracts.js'),css=read('assets/admin-settings.css');
 assert.match(js,/const values=\[positions,Number\.isSafeInteger\(p\.age\)/);
 assert.match(js,/input\.dataset\.contractsCheck=String\(p\.id\)/);
 assert.match(css,/\.app-admin-view \.admin-contracts-table :is\(th,td\):nth-child\(3\)\{width:248px;text-align:left\}/);
 assert.match(css,/\.app-admin-view \.admin-contracts-table :is\(th,td\):nth-child\(4\)\{width:200px;text-align:left/);
 assert.match(css,/\.app-admin-view \.admin-contracts-table tbody tr\{height:36px\}/);
});
