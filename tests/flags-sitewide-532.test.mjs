import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');

test('#532 non-player world and club country flags share compact 20x16 frames across first paint and hydration',()=>{
 const css=read('assets/app.css'),club=read('assets/club-page.css'),directory=read('assets/clubs-directory.css');
 assert.match(css,/:root\{--fa-flag-width:20px;--fa-flag-height:16px;/);
 assert.match(css,/\.app-world-flag-frame\{width:var\(--fa-flag-width\);height:var\(--fa-flag-height\);aspect-ratio:5\/4\}/);
 assert.match(css,/\.app-world-flag\{width:100%;height:100%;object-fit:contain\}/);
 assert.match(club,/\.club-first-paint-flag\{display:inline-flex;width:var\(--fa-flag-width\);height:var\(--fa-flag-height\);min-width:var\(--fa-flag-width\)/);
 assert.match(club,/\.club-first-paint-flag \.club-country-flag\{display:block;width:var\(--fa-flag-width\);height:var\(--fa-flag-height\);object-fit:contain/);
 assert.match(club,/\.club-header \.club-country-flag\{display:block;width:var\(--fa-flag-width\)!important;height:var\(--fa-flag-height\)!important;min-width:var\(--fa-flag-width\);max-width:var\(--fa-flag-width\);min-height:var\(--fa-flag-height\);max-height:var\(--fa-flag-height\)/);
 assert.match(directory,/\.nav01-country-flag\{display:inline-block;[^}]*width:20px;height:16px/,'clubs directory already uses small flags');
 assert.match(club,/\.club-identity \.club-country-value svg\.club-country-flag\{[^}]*width:20px;height:16px/,'identity flags have same dimensions');
 assert.doesNotMatch(club,/\.club-header \.club-country-flag\{[^}]*width:25px/);
});

test('#532 player detail real and reserved flags match compact player-table icons',()=>{
 const detail=read('assets/player-detail.css'),js=read('assets/player-detail.js'),css=read('assets/app.css');
 assert.match(detail,/\.app-player-detail-flag-skeleton\{display:block;flex:none;width:20px;height:15px/);
 assert.match(detail,/\.app-player-detail-flag\{display:block;flex:none;width:20px;height:15px;object-fit:contain/);
 assert.match(js,/img\.width=20;img\.height=15/);
 assert.match(css,/\.app-players-nationality-flag\{display:block;width:20px;height:15px;object-fit:contain;margin-inline:auto\}/);
 assert.doesNotMatch(detail,/\.app-player-detail-flag\{[^}]*width:24px/);
});
