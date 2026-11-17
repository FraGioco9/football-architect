import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const page=read('competitions/_shared/index.html');
const controller=read('assets/competition-page.js');
const dev=read('tools/dev-standings-preview-client.mjs');
const css=read('assets/app.css');
const i18n=read('assets/app.js');
const keys=['standingsViewOverall','standingsViewFirstHalf','standingsViewSecondHalf',
 'standingsViewHome','standingsViewAway','standingsViewLastFive'];
const modes=['overall','first','second','home','away','last5'];

test('six compact subviews are visible in parser-time Standings markup',()=>{
 const panel=page.slice(page.indexOf('id="competition-panel-standings"'),page.indexOf('id="competition-panel-postseason"'));
 assert.ok(panel.indexOf('app-standings-subviews')>=0);
 assert.ok(panel.indexOf('app-standings-subviews')<panel.indexOf('app-world-standings'));
 for(const [index,mode] of modes.entries()){
   assert.match(panel,new RegExp('data-standings-subview="'+mode+'"'));
   assert.match(panel,new RegExp('data-app-i18n="'+keys[index]+'"'));
 }
 assert.match(panel,/aria-pressed="true">Overall/);
 assert.match(css,/\.app-standings-subviews .*app-competition-tab/);
});
test('all supported languages have the six view labels and accessible group name',()=>{
 for(const key of [...keys,'standingsSubviewLabel'])
   assert.equal((i18n.match(new RegExp('\\b'+key+':','g'))||[]).length,5,key);
});
test('standings subview switch is in-memory, route-preserving and handles history',()=>{
 const start=controller.indexOf('const setSubview=next=>');
 const end=controller.indexOf("window.addEventListener('fa:competition-context-change',refresh);",start);
 const navigation=controller.slice(start,end);
 assert.ok(start>0&&end>start);
 assert.match(navigation,/history\.pushState/);
 assert.match(navigation,/url\.searchParams\.set\('table',next\)/);
 assert.match(navigation,/window\.addEventListener\('popstate'/);
 assert.doesNotMatch(navigation,/fetch\(|\.load\(/);
 assert.match(controller,/projectStandings\?\.\(rows,data\.fixtures,definition,activeStandingsSubview\)/);
});
test('DEV preview updates active subview on existing renderer, not another API read',()=>{
 const start=dev.indexOf('const onSubviewChange=()=>');
 const end=dev.indexOf('publishContext();',start);
 const handler=dev.slice(start,end);
 assert.ok(start>0&&end>start);
 assert.match(handler,/restore\.refresh\(projected,null,null/);
 assert.match(handler,/fa:standings-subview-change/);
 assert.doesNotMatch(handler,/fetch\(/);
});
