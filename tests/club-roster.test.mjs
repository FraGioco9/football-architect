import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Roster generated first paint exactly matches the canonical bootstrap and Stats metadata',async()=>{
 const generator=read('tools/generate-club-pages.mjs'),html=read('clubs/_shared/index.html');
 const {default:model}=await import('../assets/club-model.js');
 const embedded=html.match(/<script data-fa-club-first-paint>\((function bootstrapClubFirstPaint\([\s\S]*?\n\})\)\(([\s\S]*?)\);<\/script>/);
 assert.ok(embedded,'embedded first-paint bootstrap is present');
 const canonical=generator.match(/(function bootstrapClubFirstPaint\([\s\S]*?\n\})\nfunction buildClubShell/);
 assert.ok(canonical);
 assert.equal(embedded[1],canonical[1],'published HTML must be regenerated when first-paint code changes');
 const [labels,tabs,menus,keys,help]=JSON.parse('['+embedded[2]+']');
 const expected=model.rosterSortKeys('stats').slice(3);
 assert.deepEqual(keys,expected,'parser-time Stats columns use the same sort keys as hydration');
 assert.equal(keys.length,10,'Stats shows ten numerical columns, never legacy four-stat headers');
 assert.deepEqual(labels,model.rosterLabels,'parser-time headers match the current five-language model');
 assert.deepEqual(tabs,model.rosterTabs,'parser-time Roster subview labels match hydration in all five languages');
 assert.deepEqual(help,model.rosterStatHelp,'parser-time metric tooltips and labels match hydration');
 assert.deepEqual(Object.keys(menus),['group','competition']);
 for(const lang of ['en','de','es','fr','it']){
  assert.equal(labels[lang].length,keys.length+4);
  assert.ok(keys.every(k=>help[lang][k]));
  assert.equal(tabs[lang][1],({en:'Stats',de:'Statistiken',es:'Estadísticas',fr:'Statistiques',it:'Statistiche'})[lang]);
 }
 assert.match(generator,/rosterTabs\[locale\]\[1\]/);
 assert.match(generator,/wordsForRoster\.slice\(1,1\+statKeys\.length\)/);
 assert.match(generator,/\['nationality','name','positions',\.\.\.statKeys\]/);
 assert.match(generator,/wordsForRoster\[statKeys\.length\+1\]/);
 assert.match(generator,/wordsForRoster\[statKeys\.length\+2\]/);
});

test('Roster first paint exposes Info, Stats and Attributes and reserves five rows',()=>{
 const html=read('clubs/_shared/index.html');
 for(const view of ['info','stats','attributes'])assert.ok(html.includes('data-club-roster-view="'+view+'"'));
 assert.equal((html.match(/data-club-roster-view="/g)||[]).length,3);
 assert.match(html,/data-club-roster-view="stats"[^>]*>Stats<\/a>/);
 assert.doesNotMatch(html,/data-club-roster-view="stats"[^>]*>undefined<\/a>/);
 assert.equal((html.match(/class="app-players-loading-row"/g)||[]).length,5);
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
  assert.match(html,/href="\/clubs\/it\/1\/roster\?view=attributes&amp;group=technical"/);
   assert.doesNotMatch(html,/aria-disabled="true"/);
  assert.match(html,/<div class="club-roster-view-row"><nav[^>]+class="app-competition-tabs app-players-tabs club-roster-tabs"/);
  assert.match(html,/<\/nav><span class="club-roster-count">.*?<span>65 /);

  assert.match(html,new RegExp('>'+expectedOverview[language]+'<'));
  const attributes=model.render(manifest,selected,language,'?view=attributes',null,1,null,snapshot);
  for(const label of expectedCategories[language])assert.ok(attributes.includes('>'+label+'</div>'));
  const stats=model.render(manifest,selected,language,'?view=stats',null,1,null,{...snapshot,season:2});
  assert.match(stats,/data-roster-mode="stats"/);
  assert.match(stats,new RegExp('data-club-roster-view="stats"[^>]*>'+model.rosterTabs[language][1]+'</a>'));
  assert.doesNotMatch(stats,/data-club-roster-view="stats"[^>]*>undefined<\/a>/);
  for(const panel of [attributes,stats])assert.match(panel,/data-club-roster-control="(?:group|competition)"[\s\S]+?<span class="club-roster-count">/);
  assert.doesNotMatch(stats,/club-roster-scope/);
  assert.equal((stats.match(/class="club-roster-player-link"/g)||[]).length,65);
  for(const key of ['appearances','minutes','goals','assists','goalsAssistsPer90','yellowCards','redCards','cleanSheets','mvpAwards','averageRating'])
   assert.match(stats,new RegExp('data-club-roster-sort="'+key+'"'));
  assert.equal((stats.match(/<th scope="col"/g)||[]).length,13,language);
  assert.doesNotMatch(html,/club-empty|pagination|pageSize|development_aptitude|initial_age|<h2>Roster/);
  assert.ok(html.includes('65 '),language);
  for(const [group,length] of [['technical',11],['mental',7],['physical',7],['goalkeeping',7]]){
   const rendered=model.render(manifest,selected,language,'?view=attributes&group='+group,null,1,null,snapshot);
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
  const empty=model.render(manifest,selected,language,(view==='info'?'?view=info':'?view=attributes&group='+view),null,1,null,{source:'ready',clubKey:'IT-1',count:0,players:[]});
  const section=empty.match(/<section class="club-roster"[^>]*>[\s\S]*?<\/section>/)?.[0];
  assert.equal(section,
   '<section class="club-roster" aria-busy="false" data-roster-mode="empty"><p class="club-roster-empty" role="status">'+emptyMessages[language]+'</p></section>',
   language+'/'+view+': verified empty roster must show only localized text');
  assert.doesNotMatch(section,/<table\b|<nav\b|<button\b|<tr\b|club-roster-count|app-players-loading-row|app-players-table-scroll|0 players/);
 }
 assert.match(read('assets/club-page.css'),/\.club-roster-empty\{margin:14px 0 0;color:var\(--muted\)/);
 const pending=model.render(manifest,selected,'en','?view=attributes&group=technical',null,1,null,{source:'loading'});
 const pendingRoster=pending.match(/<section class="club-roster"[^>]*>[\s\S]*?<\/section>/)?.[0];
 assert.equal((pendingRoster.match(/aria-disabled="true"/g)||[]).length,0);
 assert.equal((pendingRoster.match(/tabindex="-1"/g)||[]).length,2);
 assert.match(pendingRoster,/\shref="\/clubs\/.*?\/roster\?view=/);
 assert.match(pendingRoster,/aria-busy="true"/);
 assert.equal((pending.match(/app-players-loading-row/g)||[]).length,5);
 assert.match(pending,/colspan="11"/);
 assert.doesNotMatch(pending,/No players are currently assigned/);
 const legacy=model.render(manifest,selected,'en','?view=mental',null,1,null,snapshot);
 assert.match(legacy,/data-roster-mode="overview"/);
 const failed=model.render(manifest,selected,'en','',null,1,null,{source:'unavailable'});
 assert.equal((failed.match(/aria-disabled="true"/g)||[]).length,0,'navigation remains available');
 assert.doesNotMatch(failed,/data-club-roster-view="info"[^>]*href=/);
 assert.match(failed,/temporarily unavailable/);
 assert.match(failed,/href="\/clubs\/it\/1\/roster\?view=/);
 const missing=model.render(manifest,selected,'en','',null,1,null,{source:'unavailable',status:404});
 assert.match(missing,/Restart the local development server/);
});
test('Roster Stats mirrors Player Stats including zero, unavailable and competition-specific values',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const club={countryId:'IT',clubId:1,view:'roster',base:'/clubs/it/1'};
 const make=(goals,assists,minutes,averageRating,ratedAppearances,cleanSheets,starts,subAppearances,redCards,appearances)=>({
  appearances,starts,subAppearances,minutes,goals,assists,cleanSheets,yellowCards:2,redCards,
  ratedAppearances,averageRating,
  goalsAssistsPer90:assists===null||!minutes?null:Math.round((goals+assists)*90/minutes*100)/100
 });
 const domestic=make(4,2,600,7.2,5,null,7,1,1,8);
 const international=make(0,null,15,null,0,0,0,1,null,1);
 international.mvpAwards=0;international.mvpCoveredAppearances=1;
 const combined=make(4,null,690,7.1,6,null,8,null,null,9);
 const players=[
  {id:1,display_name:'First Player',nationality:'ITA',primary_position:'ST',secondary_positions:[],stats:combined,competitionStats:{'IT-1':domestic,'int-1':international}},
  {id:2,display_name:'Second Player',nationality:'ITA',primary_position:'ST',secondary_positions:[],stats:null,competitionStats:{'IT-1':null,'int-1':null}}
 ];
 const snapshot={source:'ready',clubKey:'IT-1',count:2,season:1,competitions:['IT-1','int-1'],players};
 const render=query=>model.render(manifest,club,'en',query,null,1,null,snapshot);
 const all=render('?view=stats');
 assert.ok(all.includes('>7.1</td>')&&all.includes('>9 (—)</td>'),'Rating and Apps (Subs) retain recorded values without a visible XI column');
 assert.ok(all.includes('>2</td>'),'recorded yellow cards appear');
 const keys=[...all.matchAll(/data-club-roster-sort="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(keys.slice(3),['appearances','minutes','goals','assists','goalsAssistsPer90','yellowCards','redCards','cleanSheets','mvpAwards','averageRating']);
 assert.ok(!keys.includes('starts'),'XI removed from the Stats UI and sort');
 assert.ok(!all.includes('data-roster-stat-help="Starts"'));
 assert.equal((all.match(/data-roster-stat-help="/g)||[]).length,10);
 assert.ok(all.indexOf('data-club-roster-sort="goalsAssistsPer90"')<
  all.indexOf('data-club-roster-sort="yellowCards"'));
 assert.ok(all.indexOf('data-club-roster-sort="averageRating"')>
  all.indexOf('data-club-roster-sort="cleanSheets"'));
 assert.ok(!all.includes('>7.1 (6)</td>')&&!all.includes('>0 (9)</td>'),'rating and clean sheets do not display appearance counts');
 assert.ok(!all.includes('>0.00</td>'),'unknown assists must not create a per-90 rate');
 for(const word of ['Appearances (substitute appearances)','Minutes played','Yellow cards','Average match rating','Clean sheets'])
  assert.ok(all.includes('data-roster-stat-help="'+word+'"'),word);
 const domesticHtml=render('?view=stats&competition=domestic');
 for(const value of ['>7.2</td>','>0.90</td>','>8 (1)</td>'])
  assert.ok(domesticHtml.includes(value),value);
 const internationalHtml=render('?view=stats&competition=international');
 assert.ok(internationalHtml.includes('>1 (1)</td>')&&internationalHtml.includes('>0</td>'),'international scope excludes the removed XI display');
 assert.match(internationalHtml,/>0<\/td><td><span[^>]*>—<\/span><\/td><\/tr>/,'a substitute with no recorded award has zero MVPs before Rating');
 assert.ok(!internationalHtml.includes('>7.2</td>'));
 assert.match(all,/<td><span[^>]*>—<\/span><\/td><td>7\.1<\/td>/,
  'legacy coverage remains unavailable in the all-competitions MVP column');
 const sorted=render('?view=stats&competition=domestic&sort=goalsAssistsPer90&order=desc');
 assert.ok(sorted.includes('aria-sort="descending"'));
 assert.ok(sorted.indexOf('href="/players/1"')<sorted.indexOf('href="/players/2"'));
 assert.ok(render('?view=stats&competition=domestic&sort=assists&order=asc').includes('aria-sort="ascending"'));
 for(const language of ['en','de','es','fr','it'])
  assert.equal((model.render(manifest,club,language,'?view=stats',null,1,null,snapshot).match(/<th scope="col"/g)||[]).length,13);
 const css=read('assets/club-page.css');
 assert.match(css,/width:var\(--club-roster-stat-share\)/);
 assert.doesNotMatch(css,/--club-roster-stat-space/,'mixed percentage/length calc breaks first-paint <col> geometry');
 const fractions=[...css.matchAll(/--club-roster-stat-share:([\d.]+)%\}/g)].map(m=>Number(m[1]));
 assert.equal(fractions.length,10);
 assert.ok(Math.abs(fractions.reduce((a,b)=>a+b,0)-100)<1e-9);
 assert.match(css,/thead th:last-child\{\s*background:#305c4c;color:#effff4;font-weight:800/);
 assert.match(css,/tbody tr:not\(\.app-players-loading-row\):not\(\.app-players-empty-row\)>td:last-child\{\s*background:#26473e;color:#e6ffed;font-weight:800/);
 assert.match(css,/html\[data-theme="light"\].*thead th:last-child\{\s*background:#B7DCC7;color:#173F30/);
 assert.match(css,/html\[data-theme="light"\].*tbody tr:not\(\.app-players-loading-row\):not\(\.app-players-empty-row\)>td:last-child\{\s*background:#D4EBDD;color:#174936/);
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
 assert.deepEqual(ids('?view=attributes&group=technical'),defaultIds,'attribute views share the same default');
 assert.deepEqual(ids('?view=info&sort=positions&order=desc'),defaultIds);
 assert.deepEqual(ids('?view=info&sort=positions&order=asc'),[...defaultIds].reverse());
 assert.deepEqual(ids('?view=info&sort=age&order=desc'),defaultIds.slice());
 assert.deepEqual(ids('?view=attributes&group=technical&sort=passing&order=desc'),defaultIds);
 assert.deepEqual(ids('?view=attributes&group=technical&sort=passing&order=asc'),players.map(p=>p.id));
 assert.deepEqual(ids('?view=info&sort=passing&order=desc'),defaultIds,'invalid Info sort falls back to pitch order');
 const sorted=render('?view=info&sort=age&order=desc');
 assert.match(sorted,/data-club-roster-sort="age"/);
 assert.match(sorted,/<th scope="col" aria-sort="descending"><button type="button" class="app-players-sort-button" data-club-roster-sort="age"/);
 assert.match(render('?view=attributes&group=technical&sort=passing&order=asc'),/<th scope="col" aria-sort="ascending"><button type="button" class="app-players-sort-button" data-club-roster-sort="passing"/);
 assert.deepEqual(players.map(p=>p.primary_position),[...pitch].reverse(),'rendering never mutates API snapshot');
});
test('CLUB-ROSTER-01 keeps subview switching local and explains Worker route mismatch',()=>{
 const js=read('assets/club-page.js');
 assert.match(js,/data-club-roster-view/);
 assert.match(js,/control\.getAttribute\('aria-disabled'\)==='true'/);
 assert.match(js,/!control\.hasAttribute\('href'\)/);
 assert.doesNotMatch(js,/data-club-roster-group/);
 assert.match(js,/data-club-roster-sort/);
 assert.match(js,/showRosterStatHelp/);
 assert.match(js,/hideRosterStatHelp/);
 assert.match(js,/params\.get\('sort'\)!==key/);
 assert.match(js,/params\.get\('order'\)==='desc'/);
 assert.match(js,/params\.delete\('sort'\);params\.delete\('order'\)/);
 assert.match(js,/const canonicalRosterInfo=/);
 assert.match(js,/const queryOnly=selected.view==='roster'&&next.view==='roster'/);
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
 const match=js.match(/  const rosterReads=new Map\(\);[\s\S]*?window\.addEventListener\('pagehide',[^\n]+\);/);
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
 const match=js.match(/  const rosterReads=new Map\(\);[\s\S]*?window\.addEventListener\('pagehide',[^\n]+\);/);
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

test('market value is a localized numeric Info column with stable missing-last sorting',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const players=[{id:1,market_value_arc:null},{id:2,market_value_arc:4700},{id:3,market_value_arc:0},{id:4,market_value_arc:4700}].map(p=>({...p,display_name:'Player '+p.id,nationality:'ITA',age:24,primary_position:'CM',height_cm:180,preferred_foot:'right'}));
 const snapshot={source:'ready',clubKey:'IT-1',count:players.length,players};
 const html=model.renderRoster('IT-1','it',model.copies.it,snapshot,'?sort=market_value_arc&order=asc');
 assert.match(html,/Valore di mercato/);assert.match(html,/4\.700 ARC/);assert.match(html,/0 ARC/);
 assert.deepEqual([...html.matchAll(/class="club-roster-player-link" href="\/players\/(\d+)"/g)].map(m=>Number(m[1])),[3,2,4,1]);
 assert.doesNotMatch(model.renderRoster('IT-1','it',model.copies.it,snapshot,'?view=attributes&group=technical'),/data-club-roster-sort="market_value_arc"/);
});
