import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('CLUB-ROSTER-01 first paint exposes five direct views without an Attributes tab',()=>{
 const html=read('clubs/_shared/index.html'),generator=read('tools/generate-club-pages.mjs');
 assert.match(html,/class="club-roster club-first-paint-roster" aria-busy="true" data-roster-mode="overview" hidden/);
 assert.match(html,/app-players-table club-roster-table/);
 assert.match(html,/data-club-roster-view="info"/);
 for(const view of ['technical','mental','physical','goalkeeping'])assert.match(html,new RegExp('data-club-roster-view="'+view+'"'));
 assert.equal((html.match(/data-club-roster-view="/g)||[]).length,5);
 assert.doesNotMatch(html,/data-club-roster-view="attributes"|data-club-roster-group=|club-roster-toolbar|>Attributes<\/a>/);
 assert.match(html,/data-club-roster-view="info" aria-selected="true" aria-disabled="true" tabindex="-1"/);
 assert.match(html,/data-club-roster-view="technical" aria-selected="false" aria-disabled="true" tabindex="-1"/);
 assert.equal((html.match(/aria-disabled="true" tabindex="-1"/g)||[]).length,5);
 assert.doesNotMatch(html,/href="\?view=(info|technical|mental|physical|goalkeeping)"/);
 assert.match(generator,/button\.removeAttribute\('href'\)/);
 assert.match(generator,/button\.setAttribute\('aria-disabled','true'\)/);
 assert.match(html,/data-club-roster-sort="positions"/);
 assert.match(html,/class="app-players-sort-button"/);
 assert.match(generator,/button\.dataset\.clubRosterSort=key/);
 assert.match(html,/data-club-roster-view="info"[^>]*>Info<\/a>/);
 assert.match(html,/<div class="club-roster-view-row"><nav class="app-competition-tabs app-players-tabs club-roster-tabs"/);
 assert.match(html,/<\/nav><span class="club-roster-count"><span class="app-players-count-placeholder"/);
 const css=read('assets/club-page.css');
 assert.match(css,/\.app-body \.club-roster \.club-roster-tabs \.app-competition-tab\[aria-disabled="true"\]\{opacity:\.45;[^}]*background:transparent;cursor:default;pointer-events:none\}/);
 assert.match(css,/\.club-roster \.club-roster-tabs\{[^}]*margin:0;padding:0;border:0/);
 assert.match(css,/\.club-roster-view-row\{[^}]*height:42px;min-height:42px/);
 assert.match(css,/\.club-roster \.club-roster-tabs \.app-competition-tab\{[^}]*height:32px;min-height:32px/);
 assert.match(css,/\.club-roster \.club-roster-tabs \.app-competition-tab\{[^}]*padding:5px 5px/);
 assert.doesNotMatch(css,/\.club-roster-toolbar\{|\.club-roster-groups\{/);

 // 2.5 mobile subviews before the separate count; fades only where scroll is possible.
 assert.match(css,/\.club-roster \.club-roster-tabs \.app-competition-tab\{[^}]*flex:0 0 calc\(40% - 3\.2px\)/);
 assert.match(css,/\.club-roster-count\{[^}]*flex:0 0 92px/);
 assert.match(css,/\.club-roster \.club-roster-tabs\[data-can-scroll-left="true"\]\{--app-tabs-fade-left:16px\}/);
 assert.match(css,/\.club-roster \.club-roster-tabs\[data-can-scroll-right="true"\]\{--app-tabs-fade-right:16px\}/);
 assert.match(css,/-webkit-mask-image:linear-gradient\(to right/);
 const client=read('assets/club-page.js');
 assert.match(client,/const syncRosterTabEdges=/);
 assert.match(client,/rosterTabs\.addEventListener\('scroll',syncRosterTabEdges/);
 assert.match(client,/window\.addEventListener\('resize',syncRosterTabEdges/);
 assert.match(html,/const syncSubviewFade=/);
 assert.match(generator,/const syncSubviewFade=/);
 // Issue #548: all primary mobile View bars hide the scrollbar, not only Roster subviews.
 const shared=read('assets/app.css');
 assert.match(shared,/\.app-competition-tabs\{scrollbar-width:none;-ms-overflow-style:none/);
 assert.match(shared,/\.app-competition-tabs::-webkit-scrollbar\{display:none;width:0;height:0\}/);
 assert.match(shared,/\.app-competition-tabs\[data-can-scroll-right="true"\]\{--app-tabs-fade-right:16px\}/);
 assert.match(shared,/\.app-competition-tabs\[data-can-scroll-left="true"\]\{--app-tabs-fade-left:16px\}/);
 assert.match(shared,/\.app-world-standing-scroll\{[^}]*scrollbar-width:thin/);
 assert.match(shared,/\.app-players-table-scroll\{[^}]*scrollbar-width:thin/);
 const playerDetail=read('assets/player-detail.js');
 assert.match(playerDetail,/viewBar\?\.addEventListener\('scroll',syncViewEdges/);
 assert.match(playerDetail,/window\.addEventListener\('resize',syncViewEdges/);


 assert.doesNotMatch(generator,/club-roster-groups/);
 assert.match(html,/data-club-roster-label="5"/);
 assert.equal((html.match(/class="app-players-loading-row"/g)||[]).length,5);
 assert.match(html,/roster\.hidden=view!=='roster'/);
 assert.match(generator,/roster\.hidden=view!=='roster'/);
 assert.doesNotMatch(html,/<h2 data-club-roster-title>|<h2>Roster<\/h2>/);
 assert.doesNotMatch(html,/data-club-roster-pagination|class="club-roster-pagination"/);
});
test('CLUB-ROSTER-01 keeps all current players, across five locales and five subviews',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const selected={countryId:'IT',clubId:1,view:'roster',base:'/clubs/it/1'};
 const attrs=Object.fromEntries('speed strength stamina agility passing technique dribbling shooting crossing tackling marking heading vision positioning decisions composure gk_reflexes gk_handling gk_positioning gk_aerial'.split(' ').map((key,i)=>[key,i+21]));
 const players=Array.from({length:65},(_,i)=>({
  id:i+1,display_name:i===0?'<Private & Name>':'Player '+(i+1),
  nationality:'ITA',age:17,primary_position:'CM',secondary_positions:['DM'],
  height_cm:180,preferred_foot:'left',attributes:attrs
 }));
 const snapshot={source:'ready',clubKey:'IT-1',count:65,players};
 const locales=['en','de','es','fr','it'];
 const expectedOverview={en:'Info',de:'Info',es:'Info',fr:'Info',it:'Info'};
 const expectedCategories={en:['Technical','Mental','Physical','Goalkeeper'],de:['Technisch','Mental','Physisch','Torwart'],es:['Técnicos','Mentales','Físicos','Portero'],fr:['Techniques','Mentaux','Physiques','Gardien'],it:['Tecnici','Mentali','Fisici','Portiere']};
 for(const language of locales){
  const html=model.render(manifest,selected,language,'?view=info',null,1,null,snapshot);
  assert.equal((html.match(/class="club-roster-player-link"/g)||[]).length,65,language);
  assert.equal((html.match(/<tr><td>/g)||[]).length,65,language);
  assert.match(html,/href="\/players\/1"/);
  assert.match(html,/href="\/players\/65"/);
  assert.match(html,/&lt;Private &amp; Name&gt;/);
  assert.match(html,/CM, DM/);
  assert.match(html,/href="\/clubs\/it\/1\/roster\?view=info"/);
  assert.match(html,/href="\/clubs\/it\/1\/roster\?view=technical"/);
   assert.doesNotMatch(html,/aria-disabled="true"/);
  assert.match(html,/<div class="club-roster-view-row"><nav[^>]+class="app-competition-tabs app-players-tabs club-roster-tabs"/);
  assert.match(html,/<\/nav><span class="club-roster-count">65 /);

  assert.match(html,new RegExp('>'+expectedOverview[language]+'<'));
  for(const label of expectedCategories[language])assert.ok(html.includes('>'+label+'</a>'),language+': '+label);
  assert.doesNotMatch(html,/data-club-roster-view="attributes"|club-roster-toolbar|club-roster-groups/);
  assert.doesNotMatch(html,/club-empty|pagination|pageSize|development_aptitude|initial_age|<h2>Roster/);
  assert.ok(html.includes('65 '),language);
  for(const [group,length] of [['technical',11],['mental',7],['physical',7],['goalkeeping',7]]){
   const rendered=model.render(manifest,selected,language,'?view='+group,null,1,null,snapshot);
   assert.match(rendered,/data-roster-mode="attributes"/);
   assert.match(rendered,new RegExp('data-roster-group="'+group+'"'));
   assert.match(rendered,/CM, DM/);
   assert.equal((rendered.match(/class="club-roster-player-link"/g)||[]).length,65,language+'/'+group);
   assert.equal((rendered.match(/<th scope="col"/g)||[]).length,length,language+'/'+group);
   assert.ok(rendered.includes('>'+({technical:25,mental:33,physical:21,goalkeeping:37}[group])+'</td>'),language+'/'+group);
  }
 }
 const emptyMessages={
  en:'No players are currently assigned to this club.',
  de:'Diesem Verein sind derzeit keine Spieler zugeordnet.',
  es:'Actualmente no hay jugadores asignados a este club.',
  fr:'Aucun joueur n’est actuellement affecté à ce club.',
  it:'Nessun giocatore è attualmente assegnato a questo club.'
 };
 for(const language of locales)for(const view of ['info','technical','mental','physical','goalkeeping']){
  const empty=model.render(manifest,selected,language,'?view='+view,null,1,null,{source:'ready',clubKey:'IT-1',count:0,players:[]});
  const section=empty.match(/<section class="club-roster"[^>]*>[\s\S]*?<\/section>/)?.[0];
  assert.equal(section,
   '<section class="club-roster" aria-busy="false" data-roster-mode="empty"><p class="club-roster-empty" role="status">'+emptyMessages[language]+'</p></section>',
   language+'/'+view+': verified empty roster must show only localized text');
  assert.doesNotMatch(section,/<table\b|<nav\b|<button\b|<tr\b|club-roster-count|app-players-loading-row|app-players-table-scroll|0 players/);
 }
 assert.match(read('assets/club-page.css'),/\.club-roster-empty\{margin:14px 0 0;color:var\(--muted\)/);
 const pending=model.render(manifest,selected,'en','?view=technical',null,1,null,{source:'loading'});
 const pendingRoster=pending.match(/<section class="club-roster"[^>]*>[\s\S]*?<\/section>/)?.[0];
 assert.equal((pendingRoster.match(/aria-disabled="true"/g)||[]).length,5);
 assert.equal((pendingRoster.match(/tabindex="-1"/g)||[]).length,5);
 assert.doesNotMatch(pendingRoster,/\shref="\/clubs\/.*?\/roster\?view=/);
 assert.match(pendingRoster,/aria-busy="true"/);
 assert.equal((pending.match(/app-players-loading-row/g)||[]).length,5);
 assert.match(pending,/colspan="11"/);
 assert.doesNotMatch(pending,/No players are currently assigned/);
 const legacy=model.render(manifest,selected,'en','?view=attributes&group=mental',null,1,null,snapshot);
 assert.match(legacy,/data-roster-group="mental"/);
 const failed=model.render(manifest,selected,'en','',null,1,null,{source:'unavailable'});
 assert.equal((failed.match(/aria-disabled="true"/g)||[]).length,5,'API unavailable: keep tabs disabled');
 assert.doesNotMatch(failed,/data-club-roster-view="info"[^>]*href=/);
 assert.match(failed,/temporarily unavailable/);
 assert.doesNotMatch(failed,/href="\/clubs\/it\/1\/roster\?view=/);
 const missing=model.render(manifest,selected,'en','',null,1,null,{source:'unavailable',status:404});
 assert.match(missing,/Restart the local development server/);
});
test('CLUB-ROSTER-01 orders all assigned players by the canonical pitch positions, and sorts each visible column',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const selected={countryId:'IT',clubId:1,view:'roster',base:'/clubs/it/1'};
 const pitch=['GK','RB','RWB','CB','LWB','LB','DM','RM','CM','LM','RW','AM','LW','ST'];
 const players=[...pitch].reverse().map((primary_position,i)=>({
  id:i+1,display_name:'Player '+(i+1),nationality:i%2?'ITA':'ENG',
  age:18+i,primary_position,secondary_positions:[],height_cm:165+i,
  preferred_foot:i%2?'right':'left',attributes:{passing:i+1,vision:i+1,speed:i+1,gk_reflexes:i+1}
 }));
 const snapshot={source:'ready',clubKey:'IT-1',count:players.length,players};
 const render=(query)=>model.render(manifest,selected,'en',query,null,1,null,snapshot);
 const ids=query=>[...render(query).matchAll(/class="club-roster-player-link" href="\/players\/(\d+)"/g)].map(m=>Number(m[1]));
 const defaultIds=players.map(p=>p.id).reverse();
 assert.deepEqual(ids('?view=info'),defaultIds,'default uses GK -> ST independent of API row order');
 assert.deepEqual(ids('?view=technical'),defaultIds,'attribute views share the same default');
 assert.deepEqual(ids('?view=info&sort=positions&order=desc'),defaultIds);
 assert.deepEqual(ids('?view=info&sort=positions&order=asc'),[...defaultIds].reverse());
 assert.deepEqual(ids('?view=info&sort=age&order=desc'),defaultIds.slice());
 assert.deepEqual(ids('?view=technical&sort=passing&order=desc'),defaultIds);
 assert.deepEqual(ids('?view=technical&sort=passing&order=asc'),players.map(p=>p.id));
 assert.deepEqual(ids('?view=info&sort=passing&order=desc'),defaultIds,'invalid Info sort falls back to pitch order');
 const sorted=render('?view=info&sort=age&order=desc');
 assert.match(sorted,/data-club-roster-sort="age"/);
 assert.match(sorted,/<th scope="col" aria-sort="descending"><button type="button" class="app-players-sort-button" data-club-roster-sort="age"/);
 assert.match(render('?view=technical&sort=passing&order=asc'),/<th scope="col" aria-sort="ascending"><button type="button" class="app-players-sort-button" data-club-roster-sort="passing"/);
 assert.deepEqual(players.map(p=>p.primary_position),[...pitch].reverse(),'rendering never mutates API snapshot');
});
test('CLUB-ROSTER-01 keeps subview switching local and explains Worker route mismatch',()=>{
 const js=read('assets/club-page.js');
 assert.match(js,/data-club-roster-view/);
 assert.match(js,/control\.getAttribute\('aria-disabled'\)==='true'/);
 assert.match(js,/!control\.hasAttribute\('href'\)/);
 assert.doesNotMatch(js,/data-club-roster-group/);
 assert.match(js,/data-club-roster-sort/);
 assert.match(js,/params\.get\('sort'\)!==key/);
 assert.match(js,/params\.get\('order'\)==='desc'/);
 assert.match(js,/params\.delete\('sort'\);params\.delete\('order'\)/);
 assert.match(js,/if\(selected\.view==='roster'\)\{/);
 assert.match(js,/if\(location\.search\)history\.replaceState\(null,'',location\.pathname\+location\.hash\)/);
 assert.match(js,/rosterSnapshot\.count>0&&/);
 assert.match(js,/const canonicalRosterInfo=/);
 assert.doesNotMatch(js,/if\(next\.view==='roster'&&!queryOnly\)rosterSnapshot=\{source:'loading'\}/);
 assert.match(js,/location\.pathname\+'\?view=info'\+location\.hash/);
 assert.match(js,/const target=control\.dataset\.clubRosterView/);
 assert.match(js,/const queryOnly=selected\.view==='roster'&&next\.view==='roster'/);
 assert.match(js,/if\(!queryOnly\)refreshClubRoster/);
 assert.match(js,/status:Number\.isSafeInteger\(error\?\.status\)/);
 assert.match(js,/host\.querySelectorAll\('a\[href\]'\)/,'pending tabs must not enter href normalization');
 assert.match(js,/if\(document\.documentElement\.dataset\.clubIdentityReady==='true'\)return/,'optional module errors keep hydrated identity');
});

test('CLUB-ROSTER-01 clicking the already active main tab is inert without a Roster API refresh',()=>{
 const js=read('assets/club-page.js');
 const match=js.match(/tabs\.addEventListener\('click',([\s\S]*?\n     \})\);/);
 assert.ok(match,'the live primary-tab click handler must be present');
 const counters={navigation:0,paint:0,history:0,overview:0,roster:0};
 const selected={base:'/clubs/it/1',view:'roster'};
 const snapshot={source:'ready',count:1,players:[{id:1}]};
 const model={route:path=>({base:'/clubs/it/1',view:path.split('/').at(-1)})};
 const history={pushState:()=>counters.navigation++};
 const makeHandler=new Function(
  'model','selected','history','paint','refreshClubHistory','refreshClubOverview','refreshClubRoster','snapshot',
  'let rosterSnapshot=snapshot; const tabs={querySelector:()=>({focus(){}})}; const handler='+match[1]+'; return {handler,getSnapshot:()=>rosterSnapshot};'
 );
 const {handler,getSnapshot}=makeHandler(model,selected,history,
  ()=>counters.paint++,()=>counters.history++,()=>counters.overview++,()=>counters.roster++,snapshot);
 const click=(view)=>{
  let prevented=false;
  handler({target:{closest:()=>({href:'https://example.test/clubs/it/1/'+view})},
   button:0,defaultPrevented:false,preventDefault(){prevented=true}});
  return prevented;
 };
 assert.equal(click('roster'),true,'the active link must not trigger native navigation');
 assert.deepEqual(counters,{navigation:0,paint:0,history:0,overview:0,roster:0});
 assert.equal(getSnapshot(),snapshot,'loaded players must remain untouched');
 assert.equal(click('history'),true,'switching to a different view still uses client navigation');
 assert.deepEqual(counters,{navigation:1,paint:1,history:1,overview:1,roster:1});
});

test('CLUB-ROSTER-API: revisiting the same club reuses one in-flight or completed read',async()=>{
 const js=read('assets/club-page.js');
 const match=js.match(/  let rosterRequest=0,[\s\S]*?window\.addEventListener\('pagehide',[^\n]+\);/);
 assert.ok(match,'extract the real Roster request handler');
 const makeController=new Function('selected','fetch','history','location','window','paint',
  'let rosterSnapshot={source:"loading"},refreshClubRoster; '+match[0]+
  '; return {refresh:()=>refreshClubRoster(),snapshot:()=>rosterSnapshot};');
 const selected={view:'roster',countryId:'IT',clubId:1};
 const location={pathname:'/clubs/it/1/roster',search:'',hash:''};
 const pending=[];let requests=0,paints=0,replaces=0;
 const fetch=(url,options)=>{
  assert.equal(url,'/api/clubs/IT-1/roster');
  assert.equal(options.method,'GET');
  requests++;
  return new Promise(resolve=>pending.push(resolve));
 };
 const history={replaceState:(_state,_title,url)=>{
  replaces++;location.search=new URL(url,'https://example.test').search;
 }};
 const window={addEventListener:()=>{}};
 const controller=makeController(selected,fetch,history,location,window,()=>paints++);
 controller.refresh();
 assert.equal(requests,1,'initial visit issues one read');
 selected.view='fixtures';controller.refresh();
 selected.view='history';controller.refresh();
 selected.view='roster';controller.refresh();
 assert.equal(requests,1,'returning during an in-flight read does not start a second request');
 const players=[{id:1,display_name:'Test Player',nationality:'IT',primary_position:'ST'}];
 pending.shift()({ok:true,json:async()=>({clubKey:'IT-1',count:1,players})});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(controller.snapshot().source,'ready');
 assert.equal(paints,1,'the successful response renders once');
 assert.equal(location.search,'?view=info','the first loaded squad still selects the canonical Info URL');
 selected.view='history';controller.refresh();
 selected.view='roster';controller.refresh();
 selected.view='fixtures';controller.refresh();
 selected.view='roster';controller.refresh();
 assert.equal(requests,1,'every subsequent return reuses the same validated players');
 assert.equal(controller.snapshot().players,players,'the validated snapshot is preserved');
 assert.equal(replaces,1,'canonical Info must not rewrite an already canonical URL');
});

test('CLUB-ROSTER-API: empty squads are cached, transient failures can retry and stale reads are fenced',async()=>{
 const js=read('assets/club-page.js');
 const match=js.match(/  let rosterRequest=0,[\s\S]*?window\.addEventListener\('pagehide',[^\n]+\);/);
 assert.ok(match);
 const makeController=new Function('selected','fetch','history','location','window','paint',
  'let rosterSnapshot={source:"loading"},refreshClubRoster; '+match[0]+
  '; return {refresh:()=>refreshClubRoster(),snapshot:()=>rosterSnapshot};');
 const selected={view:'roster',countryId:'IT',clubId:1};
 const location={pathname:'/clubs/it/1/roster',search:'',hash:''};
 let count=0;const pending=[];const handlers={};
 const fetch=(_url,{signal})=>{count++;return new Promise((resolve,reject)=>pending.push({resolve,reject,signal}));};
 const controller=makeController(selected,fetch,{replaceState:()=>{throw Error('Empty squad must keep neutral URL');}},
  location,{addEventListener:(type,cb)=>handlers[type]=cb},()=>{});
 controller.refresh();assert.equal(count,1);
 pending.shift().reject(Error('temporary 503'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(controller.snapshot().source,'unavailable');
 selected.view='history';controller.refresh();
 selected.view='roster';controller.refresh();
 assert.equal(count,2,'failed reads are retryable after returning');
 pending.shift().resolve({ok:true,json:async()=>({clubKey:'IT-1',count:0,players:[]})});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(controller.snapshot().source,'ready');
 assert.equal(controller.snapshot().count,0);
 selected.view='fixtures';controller.refresh();
 selected.view='roster';controller.refresh();
 assert.equal(count,2,'a verified empty squad is cached');
 handlers.pagehide();
 controller.refresh();
 assert.equal(count,3,'pagehide clears the in-memory request identity');
 pending.shift().resolve({ok:true,json:async()=>({clubKey:'IT-1',count:0,players:[]})});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(controller.snapshot().source,'ready');
});
