import test from 'node:test';
import assert from 'node:assert/strict';
import {statsWords,formatApps,formatRating,createPlayerStatsView,aggregateVerifiedCareerStats} from '../assets/player-stats.mjs';
import {renderPlayerDetailPage} from '../tools/render-player-detail.mjs';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('#578 public Player Detail has an active Stats tab, with identical canonical generated output',()=>{
 const html=renderPlayerDetailPage(read('players/index.html'),'public');
 assert.equal(html,read('players/_shared/index.html'));
 assert.match(html,/data-detail-view="stats"[^>]*aria-controls="player-detail-stats-panel"/);
 assert.match(html,/data-detail-panel="stats" data-detail-stats/);
 assert.match(html,/data-detail-stats-rows/);
 assert.match(html,/data-detail-stats-heading="9"/);
 assert.match(html,/get\("view"\)==="stats"/);
 const draft=renderPlayerDetailPage(read('admin/players/preview/index.html'),'preview');
 assert.equal(draft,read('admin/players/preview/player/index.html'));
 assert.match(draft,/data-detail-view="stats"[^>]*disabled aria-disabled="true"/);
 assert.doesNotMatch(draft,/data-detail-panel="stats"/);
});
test('#578 all supported languages label stats and keep genuine unavailable counters',()=>{
 for(const lang of ['en','it','de','es','fr']){
  assert.equal(statsWords[lang].headers.length,10);
  assert.equal(statsWords[lang].keeper,'CS');
 }
 assert.equal(formatApps(24,5),'24 (5)');
 assert.equal(formatApps(24,null),'24 (—)');
 assert.equal(formatRating(null,0),'—');
 assert.equal(formatRating(7.12,3),'7.12');
});
test('#578 backend Stats route accepts canonical numeric player ID',()=>{
 const source=read('backend/src/index.ts');
 assert.ok(source.includes("const playerStats=url.pathname.match(/^\\/api\\/players\\/([1-9][0-9]*)\\/stats$/);"));
});
test('#578 uses one lazily loaded personal Stats API and canonical competition/club links',()=>{
 const script=read('assets/player-detail.js'),view=read('assets/player-stats.mjs'),css=read('assets/player-detail.css');
 assert.ok(script.includes("import('/assets/player-stats.mjs')"));
 assert.ok(script.includes("'/api/players/'+number+'/stats'"));
 assert.ok(view.includes("'/competitions/'")&&view.includes("'/clubs/'"));
 assert.ok(script.includes('competitionLookup=context.matchPublicContext'));
 assert.ok(view.includes('competitionName?.(record.competitionId)'));
 assert.match(css,/\.app-player-stats-table\{/);
 assert.match(css,/html\[data-player-detail-view="stats"\]/);
});

test('#578 seven numeric header tooltips reuse the site animation and show expanded labels',()=>{
 const source=read('assets/player-stats.mjs'),site=read('assets/app.css');
 for(const lang of ['en','it','de','es','fr']){
  assert.equal(statsWords[lang].help.length,10,lang);
  assert.deepEqual(statsWords[lang].help.slice(0,3),[null,null,null],lang+' has no identity tooltip');
  assert.ok(statsWords[lang].help.slice(3).every(v=>typeof v==='string'&&v.length>=4&&v.length<100),lang);
  assert.ok(statsWords[lang].keeperHelp.length>=4&&statsWords[lang].keeperHelp.length<100,lang);
 }
 assert.match(source,/app-players-nationality-tooltip app-player-stats-tooltip/);
 assert.match(source,/setAttribute\('role','tooltip'\)/);
 assert.match(source,/setAttribute\('aria-describedby',tip.id\)/);
 assert.match(source,/pointerover/);assert.match(source,/focusin/);
 assert.match(source,/event.key==='Escape'/);
 assert.match(source,/if\(index<3\)/,'identity headers are plain text');
 assert.match(source,/index<3\|\|index>=10/,'only seven numeric headers can trigger a tooltip');
 assert.match(site,/\.app-players-nationality-tooltip\.is-closing\{animation:app-world-tooltip-out 130ms/);
 assert.match(site,/\.app-players-nationality-tooltip\{[^}]+animation:app-world-tooltip-in 170ms/);
});
test('#578 parser-time Stats skeleton uses the same responsive cells as loaded values',()=>{
 const html=read('players/_shared/index.html'),css=read('assets/player-detail.css');
 const tbody=html.match(/<tbody data-detail-stats-rows>([\s\S]*?)<\/tbody>/)?.[1];
 assert.ok(tbody,'the first paint must reserve a table row');
 assert.match(tbody,/app-player-stats-season-row app-player-stats-loading/);
 assert.match(tbody,/app-player-stats-chevron-space/);
 assert.match(tbody,/app-player-stats-skeleton-season/);
 assert.match(tbody,/app-player-stats-skeleton-total/);
 assert.doesNotMatch(tbody,/data-stats-toggle=/,'loading rows must not expose a fake disclosure');
 const fields=['apps','minutes','score','assists','yellow','red','rating'];
 assert.equal((tbody.match(/class="app-player-stats-number"/g)||[]).length,14,
  'first paint reserves season and career numeric cells');
 assert.equal((tbody.match(/app-player-stats-loading/g)||[]).length,2);
 assert.match(tbody,/data-player-stats-career-skeleton="true"/);
 assert.match(tbody,/app-player-stats-skeleton-career/);
 assert.ok(tbody.indexOf('app-player-stats-skeleton-career')<tbody.indexOf('app-player-stats-skeleton-season'),
  'Career skeleton is first on parser-time HTML');
 assert.equal((tbody.match(/class="app-player-stats-value"/g)||[]).length,14,
  'both skeleton rows reserve exactly seven shared numeric value slots');
 assert.equal((tbody.match(/class="app-player-stats-total-value"/g)||[]).length,2,
  'both total labels reserve the same left-aligned value slot as hydrated rows');
 for(const key of fields){
  assert.match(tbody,new RegExp('data-metric="'+key+'" data-mobile-label="'+(key==='score'?'':'[^"]+')+'"'));
  assert.ok(tbody.includes('data-metric="'+key+'"'),
   'loading markup retains the verified '+key+' cell');
  assert.match(tbody,new RegExp('data-metric="'+key+'"[^>]*><span class="app-player-stats-value"><span class="app-skeleton-bar" data-skeleton-sample="'),
   'parser-time '+key+' uses glyph-measured skeleton sizing');
 }
 assert.match(css,/--player-stats-row-height:56px/);
 assert.ok(css.includes('.app-player-stats-table .app-player-stats-number .app-player-stats-value'));
 assert.match(css,/display:flex;box-sizing:border-box;width:100%;min-width:0;height:24px;min-height:24px;/,
  'hydrated numbers and skeleton bars share one full-height centered value track');
 assert.match(css,/\.app-player-stats-table \.app-player-stats-loading \.app-player-stats-value>\.app-skeleton-bar\[data-skeleton-sample\]\{/);
 assert.match(css,/\.app-player-stats-table \[data-detail-stats-heading="5"\] \.app-player-stats-score-heading-skeleton\{/);
 assert.match(css,/\.app-player-stats-table \[data-detail-stats-heading="5"\] \.app-player-stats-score-heading-skeleton\{[\s\S]*?width:20px;height:28px;margin:0;vertical-align:middle;background:transparent;/,
  'neutral score heading skeleton matches the 28px loaded header track');
 assert.match(css,/\.app-player-stats-table \[data-detail-stats-heading="5"\] \.app-player-stats-score-heading-skeleton::after\{/,
  'score placeholder is painted inside the text-centered heading track');
 assert.ok(css.includes('.app-player-stats-table .app-player-stats-total-value'));
 assert.match(css,/\.app-player-stats-table \.app-player-stats-loading :is\(\.app-player-stats-skeleton-label,\.app-player-stats-total-value\)>\.app-skeleton-bar\{\s*align-self:center;flex:none;margin-inline:0;/,
  'Career/Season/Total skeleton bars follow the actual text flex origin');
 assert.match(css,/\.app-player-stats-table \.app-player-stats-loading \.app-skeleton-bar\{[^}]*overflow:hidden;border-radius:4px;/,
  'Stats skeletons keep the same rounded corners as generic site skeletons');
 assert.match(css,/\.app-player-stats-table \.app-player-stats-loading \.app-player-stats-skeleton-label>\.app-skeleton-bar\{justify-content:flex-start\}/,
  'Season/Career skeleton paint must begin at the loaded text origin');
 assert.match(css,/\.app-player-stats-loading :is\(\.app-player-stats-skeleton-career,\.app-player-stats-skeleton-season\)::before\{content:"Season 11 Season 11"\}/,
  'Season/Career strokes must both fill the same 70px width');
 assert.match(css,/\.app-player-stats-table \.app-player-stats-loading \.app-skeleton-bar::before\{[^}]*text-decoration-line:line-through;/,
  'the font baseline remains the skeleton paint reference');
 assert.match(css,/text-decoration-thickness:12px;text-decoration-skip-ink:none;/,
  'Stats skeleton strokes are 12px high');
 assert.match(css,/\.app-player-stats-score-heading-skeleton::after\{[^}]*height:10px;border-radius:4px;/,
  'neutral score heading uses the same rounded 10px placeholder as the rest of the site');
 assert.ok(css.includes('grid-row:2;min-height:24px;width:100%;align-self:center;justify-content:center'));
 assert.match(css,/\.app-player-stats-table tr>td\.app-player-stats-number::before/);
 assert.match(css,/grid-template-rows:12px 24px/,'mobile value track accommodates the full text line');
 assert.match(css,/a\.app-player-stats-competition-link:is\(:hover,:focus-visible\) \.app-player-stats-competition-name\{/,
  'competition underline renders on text only');
 assert.match(css,/@media\(min-width:621px\)\{\s*\.app-player-stats-table \.app-player-stats-competition-row \.app-player-stats-competition\{position:relative\}/,
  'Player Stats Competition uses the independent desktop centerline');
 assert.match(css,/\.app-player-stats-competition-row a\.app-player-stats-competition-link\{\s*position:absolute;inset-inline-start:10px;top:50%;transform:translateY\(-50%\);\s*display:inline-flex;align-items:center;block-size:24px;min-height:24px;/,
  'Competition text uses the same 24px line as verified stats');
 assert.match(css,/\.app-player-stats-competition-row \.app-player-stats-competition\{padding-inline-start:10px\}/,
  'Player Stats Competition has the same text inset as its header and Total skeleton');
 assert.match(read('assets/player-stats.mjs'),/link\.append\(el\('span',competitionName\?\./,
  'competition text uses its own unclipped underline span');
 assert.match(css,/\.app-player-stats-competition-row\[hidden\]\{display:none\}/);
 assert.match(css,/transition:transform 120ms ease-out/);
 assert.match(html,/data-detail-stats-heading="5" aria-label="Goals or clean sheets"><span class="app-skeleton-bar app-player-stats-score-heading-skeleton" aria-hidden="true"><\/span><\/th>/);
 assert.doesNotMatch(html,/data-detail-stats-heading="5">Gls<\/th>/,
  'a goalkeeper must never see outfield Goals before identity is fetched');
 assert.match(html,/data-detail-stats-heading="9">Rat\.<\/th>/);
 assert.equal((tbody.match(/data-metric="score" data-mobile-label=""/g)||[]).length,2,
  'mobile first-paint score labels stay neutral until position is known');
 assert.match(tbody,/data-metric="rating" data-mobile-label="Rat\."/);
 assert.match(css,/\.app-player-stats-total-label\{color:var\(--muted\);text-align:left\}/);
 assert.doesNotMatch(css,/\.app-player-stats-header-trigger:is\(:hover,:focus-visible\)\{text-decoration:underline/);
});
test('#578 toggling Stats keeps the same chevron node as Club History',async()=>{
 const originalDocument=globalThis.document,originalWindow=globalThis.window;
 const listeners={};
 function item(tag){
  const e={tagName:tag.toUpperCase(),children:[],dataset:{},attributes:{},style:{},hidden:false,textContent:'',className:'',
   classList:{add(){},remove(){}},
   addEventListener(){},remove(){this.hidden=true},
   setAttribute(key,value){this.attributes[key]=String(value)},
   removeAttribute(key){delete this.attributes[key]},
   getAttribute(key){return this.attributes[key]??null},
   append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n)}},
   prepend(...nodes){for(const n of nodes)n.parent=this;this.children.unshift(...nodes)},
   replaceChildren(...nodes){this.children=[];this.append(...nodes)},
   contains(node){for(let p=node;p;p=p.parent)if(p===this)return true;return false},
   closest(selector){for(let p=this;p;p=p.parent)if(p.matches(selector))return p;return null},
   matches(selector){
    const attr=/^\[data-([a-z-]+)(?:="([^"]+)")?\]$/.exec(selector);
    if(!attr)return false;
    const key=attr[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
    return this.dataset[key]!==undefined&&(attr[2]===undefined||this.dataset[key]===attr[2]);
   },
   querySelectorAll(selector){
    if(selector.includes(' ')||selector.startsWith('.'))return [];
    const matches=[];
    const visit=n=>{for(const child of n.children){if(child.matches(selector))matches.push(child);visit(child)}};
    visit(this);return matches;
   },
   querySelector(selector){return this.querySelectorAll(selector)[0]??null},
   focus(){globalThis.document.activeElement=this},
   getBoundingClientRect(){return {left:20,top:100,width:100,height:20,bottom:120}}
  };
  return e;
 }
 const tbody=item('tbody'),note=item('p'),headers=Array.from({length:10},()=>item('th'));
 const host={
  attrs:{},
  querySelector(s){return s==='[data-detail-stats-rows]'?tbody:s==='[data-detail-stats-note]'?note:null},
  querySelectorAll(s){return s==='[data-detail-stats-heading]'?headers:[]},
  contains(){return true},
  setAttribute(k,v){this.attrs[k]=v},
  addEventListener(k,listener){listeners[k]=listener}
 };
 const windowListeners={};
 globalThis.document={body:item('body'),activeElement:null,createElement:item,addEventListener(){}};
 globalThis.window={innerWidth:1100,innerHeight:720,matchMedia:()=>({matches:false}),
  addEventListener(k,fn){windowListeners[k]=fn},clearTimeout(){},
  setTimeout(fn){fn();return 1}};
 const player={appearances:1,starts:1,subAppearances:0,minutes:90,goals:1,gkAppearances:0,cleanSheets:null,
  assists:0,yellowCards:0,redCards:0,averageRating:7.5,ratedAppearances:1};
 const payload={playerId:42,status:'available',seasons:[{season:1,status:'partial',
  data:{total:player,competitions:[
   {...player,competitionId:'IT-1',clubId:'IT-1'},
   {...player,competitionId:'int-1',clubId:'IT-2'}]}}]};
 let lang='en';
 try{
  const view=createPlayerStatsView({host,id:42,position:()=> 'ST',locale:()=>lang,
   clubName:key=>key==='IT-1'?'AC Meneghina':'Club Two',
   clubCrest:key=>key==='IT-1'?'assets/clubs/IT/1/crest.svg':'https://other.example/crest.svg',
   fetchStats:async()=>payload});
  await view.load();
  assert.equal(tbody.children.length,4,'Career, season and both collapsed competition rows exist without extra reads');
  assert.equal(tbody.children[0].dataset.playerStatsCareer,'true');
  assert.equal(tbody.children[0].children[0].children[0].children[1].textContent,'Career');
  assert.equal(tbody.children[0].children[3].children[0].textContent,'1 (0)');
  assert.equal(tbody.children[0].children[4].children[0].textContent,'90');
  assert.equal(tbody.children[0].children[1].children[0].className,'app-player-stats-total-value');
  for(const cell of tbody.children[0].children.slice(3))
   assert.equal(cell.children[0].className,'app-player-stats-value');
  for(let i=0;i<3;i++){
   assert.equal(headers[i].querySelector('[data-stats-help]'),null,'identity header has no tooltip');
   assert.equal(headers[i].textContent,statsWords.en.headers[i]);
  }
  for(let i=3;i<10;i++)
   assert.ok(headers[i].querySelector('[data-stats-help]'),'numeric header has tooltip');
  assert.ok(tbody.children[0].children[1].className.includes('app-player-stats-total-label'));
  const [,season,detail,otherDetail]=tbody.children,button=season.querySelector('[data-stats-toggle]');
  const decorated=detail.children[2].children[0],crest=decorated.children[0],clubLink=decorated.children[1];
  assert.equal(decorated.className,'app-player-stats-club-identity');
  assert.equal(crest.className,'app-players-club-mark app-player-stats-club-crest');
  assert.equal(crest.getAttribute('aria-hidden'),'true');
  assert.equal(crest.children[0].src,'/assets/clubs/IT/1/crest.svg');
  assert.equal(crest.children[0].className,'app-players-club-crest');
  assert.equal(crest.children[0].alt,'');
  assert.equal(crest.children[0].width,24);
  assert.equal(crest.children[0].height,24);
  assert.equal(clubLink.className,'app-player-stats-link app-player-stats-club-link');
  assert.equal(clubLink.children[0].className,'app-player-stats-club-name');
  assert.equal(clubLink.children[0].textContent,'AC Meneghina');
  assert.equal(clubLink.href,'/clubs/it/1/overview');
  assert.equal(otherDetail.children[2].children[0].children.length,2,
   'unknown official crest retains shield fallback and the valid name link');
  assert.equal(otherDetail.children[2].children[0].children[0].className,
   'app-players-club-mark app-player-stats-club-crest');
  assert.equal(otherDetail.children[2].children[0].children[0].children.length,0,
   'untrusted crest path cannot render an image');
  assert.equal(otherDetail.children[2].children[0].children[1].href,'/clubs/it/2/overview');
  const arrow=button.children[0];
  assert.equal(detail.hidden,true);
  assert.equal(otherDetail.hidden,true);
  assert.equal(button.getAttribute('aria-expanded'),'false');
  listeners.click({target:button});
  assert.equal(detail.hidden,false);
  assert.equal(otherDetail.hidden,false);
  assert.equal(button.getAttribute('aria-expanded'),'true');
  assert.strictEqual(tbody.children[1],season,'the table must not be rebuilt on toggle');
  assert.strictEqual(button.children[0],arrow,'chevron must retain its transition element');
  listeners.click({target:button});
  assert.equal(detail.hidden,true);assert.equal(otherDetail.hidden,true);
  assert.equal(button.getAttribute('aria-expanded'),'false');
  const tipTrigger=headers[3].querySelector('[data-stats-help]');
  listeners.focusin({target:tipTrigger});
  const tip=globalThis.document.body.children[0];
  assert.equal(tip.getAttribute('role'),'tooltip');
  assert.equal(tipTrigger.getAttribute('aria-describedby'),tip.id);
  assert.equal(tip.textContent,statsWords.en.help[3]);
  assert.equal(headers[5].querySelector('[data-stats-help]').textContent,'Gls');
  assert.equal(headers[9].querySelector('[data-stats-help]').textContent,'Rat.');
  lang='it';view.render();
  assert.equal(headers[3].querySelector('[data-stats-help]').textContent,statsWords.it.headers[3]);
  assert.equal(tbody.children[2].hidden,true);
 }finally{globalThis.document=originalDocument;globalThis.window=originalWindow}
});

test('#578 Stats club crests are passive, bounded and separated from linked text',()=>{
 const stats=read('assets/player-stats.mjs');
 const bootstrap=read('assets/player-detail.js');
 const css=read('assets/player-detail.css');
 assert.match(stats,/clubCrest\?\.\(record\.clubId\)/,'crest is resolved from canonical club key');
 assert.match(stats,/asset==='assets\/clubs\/'\+match\[1\]/,'only canonical paths are rendered');
 assert.match(stats,/crest\.setAttribute\('aria-hidden','true'\)/,'crest is not a second link');
 assert.match(stats,/image\.alt=''/,'crest has decorative alternative text');
 assert.match(stats,/clubLink\.append\(el\('span',clubName\?\.\(record\.clubId\)\|\|record\.clubId,'app-player-stats-club-name'\)\)/);
 assert.match(stats,/identity\.append\(clubLink\);club\.append\(identity\)/,
  'link remains text-only alongside passive crest');
 assert.match(bootstrap,/crests=catalog\.clubCrests/,'use the existing club catalog');
 assert.match(bootstrap,/clubCrest:key=>crests&&Object\.hasOwn\(crests,key\)/);
 assert.match(css,/\.app-player-stats-club-identity\{\s*display:inline-flex;align-items:center;justify-content:flex-start;gap:0;[\s\S]*?position:relative;padding-inline-start:31px;/,
  'club text has a stable 31px inset that does not depend on the crest');
 assert.match(css,/\.app-player-stats-club-identity \.app-player-stats-club-crest\{\s*position:absolute;inset-inline-start:0;top:50%;transform:translateY\(-50%\);[\s\S]*?flex:0 0 24px;width:24px;height:24px;/,
  'crest is overlaid after positioning club-name text');
 assert.match(css,/\.app-player-stats-club-identity \.app-player-stats-club-link\{[\s\S]*?min-height:24px;line-height:1\.5;/,
  'club name centers against the crest, not against the statistics');
 assert.match(css,/\.app-player-stats-table \.app-player-stats-competition-row a\.app-player-stats-club-link\{\s*display:inline-flex;align-items:center;min-height:24px;line-height:1\.5;/,
  'mobile retains independent crest/name flex alignment');
 assert.match(css,/\.app-player-stats-table a\.app-player-stats-club-link:is\(:hover,:focus-visible\) \.app-player-stats-club-name\{/,
  'underline applies only to the hovered/focused club-name text');
 assert.match(css,/\.app-player-stats-table a\.app-player-stats-club-link\{[^}]*overflow:visible;text-overflow:clip;/,
  'the generic clipped table link must not cut off the underline');
 assert.match(css,/\.app-player-stats-table a\.app-player-stats-club-link:is\(:hover,:focus-visible\)\{\s*text-decoration:none;\s*\}/,
  'club link suppresses the inherited underline instead of doubling the line');
 assert.match(css,/text-decoration-line:underline;text-underline-offset:2px;text-decoration-thickness:\.75px/);
 const shared=read('assets/app.css');
 assert.match(shared,/\.app-players-club-mark\{[^}]*width:24px;height:24px/);
 assert.match(shared,/\.app-players-club-mark::before\{[^}]*clip-path:var\(--fa-crest-shield-shape\)/);
 assert.match(shared,/\.app-players-club-crest\{[^}]*width:24px;height:24px/);
 assert.match(css,/\.app-player-stats-table \.app-player-stats-career-row>th,/);
 assert.match(css,/\.app-player-stats-table \.app-player-stats-career-row>td\{border-bottom:2px solid var\(--border\)\}/);
 assert.match(css,/\.app-player-stats-table \.app-player-stats-career-row\{border-bottom:2px solid var\(--border\)\}/,
  'mobile grid keeps a visibly thicker career divider');
 assert.match(css,/\.app-player-stats-table \.app-player-stats-career-row>td\{border-bottom:0\}/,
  'mobile cells do not duplicate the row separator');
});
test('#578 Career sums official season totals and weights ratings by rated appearances',()=>{
 const row=(season,overrides={})=>({
  season,status:'available',data:{season,competitions:[],
   total:{appearances:20,starts:17,subAppearances:3,minutes:1600,goals:6,assists:4,
    yellowCards:5,redCards:1,gkAppearances:0,cleanSheets:null,ratedAppearances:15,
    averageRating:7.2,...overrides}}
 });
 const rows=[row(1),row(2,{appearances:10,starts:8,subAppearances:2,minutes:800,
  goals:4,assists:3,yellowCards:1,redCards:0,ratedAppearances:10,averageRating:8.1})];
 const career=aggregateVerifiedCareerStats(rows);
 assert.equal(career.appearances,30);
 assert.equal(career.starts,25);
 assert.equal(career.subAppearances,5);
 assert.equal(career.minutes,2400);
 assert.equal(career.goals,10);
 assert.equal(career.assists,7);
 assert.equal(career.yellowCards,6);
 assert.equal(career.redCards,1);
 assert.equal(career.ratedAppearances,25);
 assert.equal(career.averageRating,7.56,'ratings are weighted by rated match count');
 assert.equal(career.cleanSheets,null,'outfield appearances do not get goalkeeper clean sheets');
 const missingEvent=aggregateVerifiedCareerStats([rows[0],row(2,{assists:null,subAppearances:null,yellowCards:null})]);
 assert.equal(missingEvent.assists,null);
 assert.equal(missingEvent.subAppearances,null);
 assert.equal(missingEvent.yellowCards,null);
 assert.equal(missingEvent.goals,12,'known goals survive missing unrelated event coverage');
 assert.equal(aggregateVerifiedCareerStats([{...rows[0],status:'unavailable',data:null},rows[1]]),null,
  'career must not imply complete coverage when any official season is missing');
 assert.equal(aggregateVerifiedCareerStats([rows[0],rows[0]]),null,'duplicate season rejection');
 const withoutNestedSeason={...rows[0],data:{total:rows[0].data.total,competitions:[]}};
 assert.equal(aggregateVerifiedCareerStats([withoutNestedSeason]).appearances,20,
  'actual public API puts season at top level, not inside data');
 assert.equal(aggregateVerifiedCareerStats([]),null);
});
test('#578 goalkeeper Career CS respects eligibility and missing coverage',()=>{
 const row=(season,gkAppearances,cleanSheets)=>({season,status:'partial',
  data:{season,competitions:[],total:{appearances:12,starts:12,subAppearances:0,minutes:1080,
   goals:0,assists:0,yellowCards:0,redCards:0,gkAppearances,cleanSheets,
   ratedAppearances:12,averageRating:7}}});
 assert.equal(aggregateVerifiedCareerStats([row(1,12,8),row(2,12,9)]).cleanSheets,17);
 assert.equal(aggregateVerifiedCareerStats([row(1,12,8),row(2,12,null)]).cleanSheets,null);
 assert.equal(aggregateVerifiedCareerStats([row(1,12,8),row(2,0,null)]).cleanSheets,8);
});
test('#578 History/Stats table gap is 5px on desktop and mobile',()=>{
 const player=read('assets/player-detail.css'),club=read('assets/club-page.css');
 for(const [label,css,selector] of [['Player',player,'.app-player-detail-stats'],['Club',club,'.club-history']]){
  const expected=selector+'{margin-top:5px;min-width:0}';
  assert.equal(css.split(expected).length-1,2,label+' uses 5px on desktop and mobile');
 }
});

test('#578 numeric skeletons use rendered font metrics rather than guessed widths',()=>{
 const css=read('assets/player-detail.css'),club=read('assets/club-page.css');
 const html=read('players/_shared/index.html'),clubShell=read('clubs/_shared/index.html');
 const rows=[...html.matchAll(/<tr class="app-player-stats-season-row[^"]*app-player-stats-loading"[^>]*>[\s\S]*?<\/tr>/g)].map(hit=>hit[0]);
 assert.equal(rows.length,2,'Career and Season use separate loading rows');
 const samples={apps:'128 (24)',minutes:'9870',score:'32',assists:'21',yellow:'17',red:'2',rating:'7.50'};
 const samplesByRow=rows.map((row,index)=>Object.fromEntries(Object.keys(samples).map(metric=>{
  const at=row.indexOf('data-metric="'+metric+'"');
  assert.ok(at>=0,metric+' exists on '+(index===0?'Career':'Season'));
  const match=row.slice(at,at+220).match(/data-skeleton-sample="([^"]+)"/);
  assert.ok(match,'glyph-measured bar for '+metric);
  return [metric,match[1]];
 })));
 assert.deepEqual(samplesByRow[0],samples,'Career reserves representative digit widths');
 assert.deepEqual(samplesByRow[1],samples,
  'each metric column has precisely the same skeleton width in Career and Season');
 assert.match(css,/\.app-player-stats-loading :is\(\.app-player-stats-skeleton-season,\.app-player-stats-skeleton-career\)\{width:70px\}/,
  'even nonnumeric season/Career placeholder widths are identical');
 for(const metric of Object.keys(samples)){
  assert.doesNotMatch(css,new RegExp('\\[data-metric="'+metric+'"\\] \\.app-skeleton-bar\\{width:'),
   metric+' must not hardcode a pixel or ch width');
 }
 assert.match(css,/\.app-player-stats-table \.app-player-stats-number \.app-player-stats-value\{[^}]*justify-content:flex-end/,
  'desktop values and skeletons use the same right-aligned value container');
 assert.match(css,/\.app-player-stats-table tr>td\.app-player-stats-number \.app-player-stats-value\{[^}]*justify-content:center/,
  'mobile values and skeletons use the same centered value container');
 assert.match(css,/\.app-player-stats-table \.app-player-stats-loading \.app-player-stats-value>\.app-skeleton-bar\[data-skeleton-sample\]\{/);
 assert.match(css,/content:attr\(data-skeleton-sample\);font-variant-numeric:tabular-nums;/);
  assert.match(css,/font-variant-numeric:tabular-nums;/,
   'Player skeleton samples use the same tabular digits as hydrated values');
 const history={played:'30',won:'18',drawn:'10',lost:'12',gf:'104',ga:'104',gd:'+52'};
 assert.equal(history.ga,history.gf,'History GA skeleton is the same size as GF');
  for(const [metric,sample] of Object.entries(history)){
  assert.ok(clubShell.includes('data-club-history-skeleton="'+metric+'"><span class="club-history-stat-value"><span class="club-fp-bar" data-skeleton-sample="'+sample+'"'),
   'Club History '+metric+' reserves natural glyph widths before JS');
 }
 assert.match(club,/\.club-history-table \.club-history-row-loading \.club-history-skeleton-stat \.club-fp-bar\[data-skeleton-sample\]\{/);
 assert.match(club,/content:attr\(data-skeleton-sample\);font-variant-numeric:tabular-nums;/);
 assert.match(css,/\.app-player-stats-table \.app-player-stats-number \.app-player-stats-value\{[\s\S]*?justify-content:flex-end/);
 assert.match(club,/\.club-history-table td:nth-child\(n\+4\) \.club-history-stat-value\{[\s\S]*?justify-content:center/);
 assert.ok(css.includes('.app-player-stats-table :is(.app-player-stats-toggle,.app-player-stats-static-label,.app-player-stats-skeleton-label)'),
  'Season/Career labels and skeletons share a row centerline');
 assert.match(css,/min-height:28px;\s*padding:2px 0;padding-inline-start:18px;\s*align-items:center;line-height:1\.5/,
  'Career, Season and skeleton labels use the same 18px text inset');
 assert.match(css,/\.app-player-stats-chevron,\.app-player-stats-chevron-space\{\s*position:absolute;inset-inline-start:0;top:calc\(50% - 4px\);/,
  'chevrons do not enter Player Stats text flow');
 assert.ok(club.includes('.club-history-table :is(.club-history-expand,.club-history-skeleton-label)'),
  'Club History labels and skeletons share a row centerline');
});

test('#578 initial Stats score is neutral until profile, then GK is CS in all languages',()=>{
 const source=read('assets/player-detail.js'),html=read('players/_shared/index.html');
 const start=source.indexOf(' function syncStatsScoreLabel(){');
 const end=source.indexOf('\n function ensurePlayerStats(){',start);
 assert.ok(start>=0&&end>start,'score label identity hook exists');
 const implementation=source.slice(start,end);
 assert.ok(source.indexOf('  syncStatsScoreLabel();')<source.indexOf("if(view==='stats')void ensurePlayerStats()"),
  'identity-specific header and mobile labels synchronize before Stats loader');
 const scoreHeader={textContent:'',attributes:{},setAttribute(k,v){this.attributes[k]=v},
  querySelector(){return null}};
 const cells=[{dataset:{mobileLabel:''}},{dataset:{mobileLabel:''}}];
 const host={querySelector:s=>s==='[data-detail-stats-heading="5"]'?scoreHeader:null,
  querySelectorAll:s=>s==='.app-player-stats-loading [data-metric="score"]'?cells:[]};
 assert.equal((html.match(/data-metric="score" data-mobile-label=""/g)||[]).length,2);
 for(const [lang,outfield] of Object.entries({en:'Gls',it:'Gol',de:'Tor.',es:'Gol',fr:'Bts'})){
  const identitySync=new Function('statsHost','player','language',implementation+'\nreturn syncStatsScoreLabel;');
  identitySync(host,{primary_position:'GK'},()=>lang)();
  assert.equal(scoreHeader.textContent,'CS',lang+' GK header');
  assert.equal(scoreHeader.attributes['aria-label'],'CS');
  assert.deepEqual(cells.map(x=>x.dataset.mobileLabel),['CS','CS'],lang+' GK mobile');
  identitySync(host,{primary_position:'ST'},()=>lang)();
  assert.equal(scoreHeader.textContent,outfield,lang+' outfield header');
  assert.deepEqual(cells.map(x=>x.dataset.mobileLabel),[outfield,outfield]);
 }
});
