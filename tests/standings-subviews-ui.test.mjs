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
test('international cups hide Last 5 during first paint and reject direct deep links',()=>{
 const restricted="['first','second','last5']";
 const domestic=read('competitions/it-1/index.html');
 assert.equal(domestic.split(restricted).length-1,0,'domestic pages retain Last 5');
 for(const id of ['int-1','int-2']){
   const html=read('competitions/'+id+'/index.html');
   const start=html.indexOf('const valid=[\'overall\',\'first\',\'second\',\'home\',\'away\',\'last5\']');
   assert.ok(start>0,id+' prepaint script exists');
   const script=html.slice(start,html.indexOf('</script>',start));
   assert.equal(script.split(restricted).length-1,2,id+' hides last5 and normalizes direct links');
 }
 assert.ok(controller.includes("button.hidden=Boolean(cup&&['first','second','last5'].includes(button.dataset.standingsSubview))"));
 assert.ok(controller.includes("if(definition?.category==='international'&&['first','second','last5'].includes(query))return 'overall';"));
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
 assert.ok(controller.includes('projected.some(row=>row.played>0)'),
   'filtered views with no played games do not render numerical positions');
});
test('DEV preview updates active subview on existing renderer, not another API read',()=>{
 const start=dev.indexOf('const onSubviewChange=()=>');
 const end=dev.indexOf('publishContext();',start);
 const handler=dev.slice(start,end);
 assert.ok(start>0&&end>start);
 assert.match(handler,/restore\.refresh\(projected,null,null/);
 assert.ok(dev.includes("const rank=row.played==null?null:index+1"),
   'DEV tables clear rank for empty filtered views');
 assert.ok(dev.includes("cell.textContent=number==null?'—':String(number)"),
   'DEV tables clear statistics for empty filtered views');
 assert.match(handler,/fa:standings-subview-change/);
 assert.doesNotMatch(handler,/fetch\(/);
});

test('Standings mobile subview fades track both scroll edges and responsive overflow',()=>{
 assert.match(css,/\.app-standings-subviews\{--app-tabs-fade-left:0px;--app-tabs-fade-right:16px/);
 assert.match(css,/\.app-standings-subviews\[data-can-scroll-left="true"\]\{--app-tabs-fade-left:16px\}/);
 assert.match(css,/\.app-standings-subviews\[data-can-scroll-right="false"\]\{--app-tabs-fade-right:0px\}/);
 assert.match(controller,/subviewStrip\?\.addEventListener\('scroll',syncSubviewEdges,\{passive:true\}\)/);
 assert.match(controller,/window\.addEventListener\('resize',syncSubviewEdges,\{passive:true\}\)/);
 assert.match(controller,/window\.addEventListener\('pageshow',syncSubviewEdges\)/);
 assert.match(controller,/new ResizeObserver\(syncSubviewEdges\)\.observe\(subviewStrip\)/);
 assert.match(controller,/syncSubviews=\(\)=>\{[\s\S]*?syncSubviewEdges\(\);\n    \};/);
 const source=controller.match(/const syncSubviewEdges=\(\)=>\{([\s\S]*?)\n    \};/);
 assert.ok(source,'edge sync routine remains available');
 const sync=new Function('subviewStrip',source[1]);
 const strip={clientWidth:240,scrollWidth:552,scrollLeft:0,dataset:{}};
 sync(strip);
 assert.deepEqual(strip.dataset,{canScrollLeft:'false',canScrollRight:'true'},'at the beginning only the right edge fades');
 strip.scrollLeft=145;sync(strip);
 assert.deepEqual(strip.dataset,{canScrollLeft:'true',canScrollRight:'true'},'in the middle both edges fade');
 strip.scrollLeft=312;sync(strip);
 assert.deepEqual(strip.dataset,{canScrollLeft:'true',canScrollRight:'false'},'at the end only the left edge fades');
 strip.clientWidth=600;strip.scrollLeft=0;sync(strip);
 assert.deepEqual(strip.dataset,{canScrollLeft:'false',canScrollRight:'false'},'without overflow neither edge fades');
});
