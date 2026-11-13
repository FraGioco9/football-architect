// Shared club controller: passive data loading, native page links, no career state.
(async()=>{
 'use strict';
 const model=window.faClubModel,host=document.getElementById('club-page');
 let selected=model.route(location.pathname),competitionSnapshot={source:'loading'},historySnapshot={source:'loading'},rosterSnapshot={source:'loading'};
 let refreshClubHistory=()=>{},refreshClubOverview=()=>{},refreshClubRoster=()=>{},fixturesController=null;
 const language=()=>Object.hasOwn(model.copies,document.documentElement.lang)?document.documentElement.lang:'en';
 const currentWorldSeason=()=>{
  const value=window.faWorldState?.get?.().current?.season;
  return Number.isSafeInteger(value)&&value>=0?Math.max(1,value):null;
 };
 const competitionSeason=()=>{
  const resolved=window.faRoutesRegistry.resolveSeasonQuery(location.search,currentWorldSeason());
  if(resolved.season!==null)return resolved.season;
  if(window.faDevPreviewMode===true&&window.faDebugEnabled!==false){
   try{const raw=sessionStorage.getItem('football-architect:standings-dev-season'),n=raw===null?NaN:Number(raw);
    if(Number.isInteger(n)&&n>=1&&n<=4)return n}catch{}
  }
  const current=Number(window.faWorldState?.get?.().current?.season);
  return Number.isInteger(current)&&current>=1?current:1;
 };
 try{
  if(!selected)throw Error('Unknown club route');
  // A refresh starts at /roster; the API will choose Info only after success.
  if(selected.view==='roster'){
   if(location.search)history.replaceState(null,'',location.pathname+location.hash);
  }else{
   const params=new URLSearchParams(location.search);
   params.delete('view');
   if(['overview','history'].includes(selected.view)){params.delete('season');params.delete('matchday');}
   const query=params.size?'?'+params:'';
   if(query!==location.search)history.replaceState(null,'',location.pathname+query+location.hash);
  }
  const selectorScript=document.createElement('script');
  selectorScript.type='module';selectorScript.src='/assets/provider-selectors-bootstrap.mjs';
  document.head.append(selectorScript);
  const response=await fetch('/clubs/_shared/manifest.json',{credentials:'same-origin'});
  if(!response.ok)throw Error('Club manifest unavailable');
  const manifest=await response.json();
  window.faClubCrests=manifest.clubCrests;
  // Move already-loaded crest hosts rather than tearing down images on navigation,
  // locale changes or a sporting summary refresh. Match within the relevant panel:
  // the same club may legitimately appear more than once on a page.
  const reuseCrests=(previous,next,skipHeader=false)=>{
   const matches=root=>[...root.querySelectorAll('[data-club-crest]')].filter(node=>!skipHeader||!node.closest('.club-header'));
   const available=matches(previous);
   for(const incoming of matches(next)){
    const index=available.findIndex(old=>old.dataset.clubCrest===incoming.dataset.clubCrest
     &&old.className===incoming.className);
    if(index<0)continue;
    const old=available.splice(index,1)[0];
    if(old.querySelector('.app-club-crest-image'))incoming.replaceWith(old);
   }
  };
  // SAF-03: explicit same-origin league navigation for primary Safari taps.
  // Modified clicks and middle clicks remain native links.
  const boundDivisionLinks=new WeakSet();
  const bindDivisionLinks=root=>{
   for(const link of root.querySelectorAll('a[data-club-division-link]')){
    if(boundDivisionLinks.has(link))continue;
    boundDivisionLinks.add(link);
    link.addEventListener('click',event=>{
     if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
     const destination=new URL(link.href,location.href);
     if(destination.origin!==location.origin||
       !/^\/competitions\/(?:it|eng|es|de|fr|pt|nl|br)-[12]\/standings$/.test(destination.pathname))return;
     event.preventDefault();
     location.assign(destination.href);
    });
   }
  };
  // One accessible disclosure per completed season; no competition filter.
  // Expanded rows persist on language change and world/source redraws.
  const openHistorySeasons=new Set();
  const syncHistoryRows=()=>{
   const buttons=host.querySelectorAll('[data-club-history-toggle]');
   for(const button of buttons){
    const season=button.dataset.clubHistoryToggle;
    const expanded=openHistorySeasons.has(season);
    button.setAttribute('aria-expanded',String(expanded));
    for(const row of host.querySelectorAll('[data-club-history-detail]'))
     if(row.dataset.clubHistoryDetail===season)row.hidden=!expanded;
   }
  };
  // The Roster nav is recreated when its view or sorting changes.
  // Track both scrollable edges on scroll and viewport resize for conditional fades.
  const syncRosterTabEdges=()=>{
   const nav=host.querySelector('.club-roster-tabs');
   if(!nav)return;
   const maximum=Math.max(0,nav.scrollWidth-nav.clientWidth);
   nav.dataset.canScrollLeft=String(maximum>1&&nav.scrollLeft>1);
   nav.dataset.canScrollRight=String(maximum>1&&nav.scrollLeft<maximum-1);
  };
  window.addEventListener('resize',syncRosterTabEdges,{passive:true});
  host.addEventListener('click',event=>{
   if(selected.view!=='history'||event.target.closest?.('a,input,select,textarea'))return;
   const row=event.target.closest?.('[data-club-history-summary]');
   const button=row?.querySelector('[data-club-history-toggle]');
   if(!button||!host.contains(row))return;
   const key=button.dataset.clubHistoryToggle;
   if(openHistorySeasons.has(key))openHistorySeasons.delete(key);else openHistorySeasons.add(key);
   syncHistoryRows();
  });
  const paint=(preserveCrest=false,preserveFocus=false)=>{
   const active=preserveFocus&&host.contains(document.activeElement)?document.activeElement:null;
   const activeHref=active?.getAttribute('href');
   const activeTranslate=active?.hasAttribute('data-translate-club');
   const activeHistoryToggle=active?.getAttribute('data-club-history-toggle');
   const scrollX=window.scrollX,scrollY=window.scrollY;
   const previousTabs=host.querySelector(':scope > .club-tabs');
   const tabScrollLeft=previousTabs?.scrollLeft;
   const historyTableScroll=host.querySelector('.club-history-table-wrap')?.scrollLeft;
   const rosterTabScrollLeft=host.querySelector('.club-roster-tabs')?.scrollLeft;
   const rosterTableScroll=host.querySelector('.club-roster-table-scroll')?.scrollLeft;
   const retainedFixtures=selected.view==='fixtures'?host.querySelector(':scope > .club-fixtures'):null;
   const staging=document.createElement('div');
   staging.innerHTML=model.render(manifest,selected,language(),location.search,competitionSnapshot,competitionSeason(),historySnapshot,rosterSnapshot,currentWorldSeason());
   const stagedHeader=staging.querySelector('.club-header'),stagedTabs=staging.querySelector('.club-tabs');
   let header=host.querySelector(':scope > .club-header'),tabs=previousTabs;
   if(header&&stagedHeader){
    const oldCrest=header.querySelector('.club-crest'),incoming=stagedHeader.querySelector('.club-crest');
    const currentSrc=oldCrest?.querySelector('img')?.getAttribute('src')||null;
    const expectedSrc=incoming?.querySelector('img')?.getAttribute('src')||null;
    if(oldCrest&&incoming){
     if(oldCrest.dataset.clubCrest===incoming.dataset.clubCrest&&currentSrc===expectedSrc){
      oldCrest.setAttribute('aria-label',incoming.getAttribute('aria-label'));
      oldCrest.setAttribute('role','img');
     }else oldCrest.replaceWith(incoming);
    }
    const title=header.querySelector('#club-title'),nextTitle=stagedHeader.querySelector('#club-title');
    if(title&&nextTitle&&title.textContent!==nextTitle.textContent)title.textContent=nextTitle.textContent;
    for(const selector of ['.club-location']){
     const existing=header.querySelector(selector),next=stagedHeader.querySelector(selector);
     if(existing&&next&&existing.innerHTML!==next.innerHTML)existing.innerHTML=next.innerHTML;
    }
    header.removeAttribute('aria-hidden');
   }else if(stagedHeader){header=stagedHeader;host.prepend(header)}
   if(tabs&&stagedTabs){
    tabs.setAttribute('aria-label',stagedTabs.getAttribute('aria-label'));
    const oldLinks=[...tabs.querySelectorAll('a')],newLinks=[...stagedTabs.querySelectorAll('a')];
    if(oldLinks.length!==newLinks.length)throw Error('Club tabs mismatch');
    for(let i=0;i<oldLinks.length;i++){
     const old=oldLinks[i],next=newLinks[i];
     if(old.getAttribute('href')!==next.getAttribute('href'))old.setAttribute('href',next.getAttribute('href'));
     if(old.textContent!==next.textContent)old.textContent=next.textContent;
     old.classList.toggle('is-active',next.classList.contains('is-active'));
     if(next.hasAttribute('aria-current'))old.setAttribute('aria-current','page');
     else old.removeAttribute('aria-current');
    }
   }else if(stagedTabs){tabs=stagedTabs;header.after(tabs)}
   // Preserve the original first-paint header, tab links, scroll and crest image nodes.
   reuseCrests(host,staging,true);
   for(const child of [...host.childNodes])if(child!==header&&child!==tabs&&child!==retainedFixtures)child.remove();
   for(const child of [...staging.childNodes])if(child!==stagedHeader&&child!==stagedTabs&&!(retainedFixtures&&child.matches?.('.club-fixtures')))host.append(child);
   if(Number.isFinite(historyTableScroll)){const tableWrap=host.querySelector('.club-history-table-wrap');if(tableWrap)tableWrap.scrollLeft=historyTableScroll;}
   if(Number.isFinite(rosterTableScroll)){const rosterWrap=host.querySelector('.club-roster-table-scroll');if(rosterWrap)rosterWrap.scrollLeft=rosterTableScroll;}
   const rosterTabs=host.querySelector('.club-roster-tabs');
   if(rosterTabs){
    if(Number.isFinite(rosterTabScrollLeft))rosterTabs.scrollLeft=rosterTabScrollLeft;
    // On a direct URL, keep the selected category fully visible.
    const active=rosterTabs.querySelector('[aria-selected="true"]');
    if(active){
     const bounds=rosterTabs.getBoundingClientRect(),selectedTab=active.getBoundingClientRect();
     if(selectedTab.right>bounds.right)rosterTabs.scrollLeft+=selectedTab.right-bounds.right;
     else if(selectedTab.left<bounds.left)rosterTabs.scrollLeft+=selectedTab.left-bounds.left;
    }
    syncRosterTabEdges();
    rosterTabs.addEventListener('scroll',syncRosterTabEdges,{passive:true});
   }
   syncHistoryRows();
   host.dataset.clubBase=selected.base;
   if(tabs){
    const key='football-architect:club-tabs-scroll:'+selected.base;
    if(Number.isFinite(tabScrollLeft))tabs.scrollLeft=tabScrollLeft;
    else try{const saved=sessionStorage.getItem(key),n=Number(saved);if(saved!==null&&Number.isFinite(n)&&n>=0)tabs.scrollLeft=n}catch{}
    const syncTabEdges=()=>{
     const maximum=Math.max(0,tabs.scrollWidth-tabs.clientWidth);
     tabs.dataset.canScrollLeft=String(maximum>1&&tabs.scrollLeft>1);
     tabs.dataset.canScrollRight=String(maximum>1&&tabs.scrollLeft<maximum-1);
    };
    syncTabEdges();
    if(tabs.dataset.clubInteractionsBound!=='true'){
     tabs.dataset.clubInteractionsBound='true';
     tabs.addEventListener('scroll',()=>{syncTabEdges();try{sessionStorage.setItem(key,String(tabs.scrollLeft))}catch{}},{passive:true});
     // Overflow and fades must follow a desktop/mobile breakpoint change even
     // when scrollLeft stays at zero and therefore emits no scroll event.
     window.addEventListener('resize',syncTabEdges,{passive:true});
     tabs.addEventListener('click',event=>{
      const link=event.target.closest?.('a');
      if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const nextUrl=new URL(link.href),next=model.route(nextUrl.pathname);
      if(!next||next.base!==selected.base)return;
      event.preventDefault();history.pushState(null,'',nextUrl.pathname+nextUrl.search+nextUrl.hash);
      if(next.view==='roster')rosterSnapshot={source:'loading'};
      selected=next;paint(true);refreshClubHistory();refreshClubOverview();refreshClubRoster();
      tabs.querySelector('[aria-current="page"]')?.focus({preventScroll:true});
     });
     tabs.addEventListener('keydown',event=>{
      const links=[...tabs.querySelectorAll('a')],i=links.indexOf(event.target);
      if(i<0)return;
      const n=links.length,next={ArrowRight:(i+1)%n,ArrowLeft:(i+n-1)%n,Home:0,End:n-1}[event.key];
      if(next!==undefined){event.preventDefault();links[next].focus()}
     });
    }
   }
   for(const crest of host.querySelectorAll('.club-crest[data-club-crest]')){
    if(!Object.hasOwn(manifest.clubCrests,crest.dataset.clubCrest))crest.dataset.clubCrestFallback='true';
   }
   const titleName=host.querySelector('#club-title')?.textContent?.trim();
    const fallback={en:'Club',de:'Verein',es:'Club',fr:'Club',it:'Club'};
    document.title=(titleName&&!/^(?:undefined|null|nan)$/i.test(titleName)?titleName:fallback[language()])+' — Football Architect';
   document.querySelector('.skip-link').textContent=model.copies[language()].skip;
   // Loading Roster subviews are inert anchors without href. Routing those
   // through faAppHref(null) throws and used to trigger the whole-page error.
   for(const link of host.querySelectorAll('a[href]'))if(window.faAppHref)link.href=window.faAppHref(link.getAttribute('href'));
   bindDivisionLinks(host);
   const translate=host.querySelector('[data-translate-club]');
   if(translate)translate.addEventListener('click',()=>{
    const description=host.querySelector('.club-description');
    const translated=translate.getAttribute('aria-pressed')!=='true';
    description.textContent=translated?description.dataset.translatedDescription:description.dataset.originalDescription;
    translate.setAttribute('aria-pressed',String(translated));
    translate.textContent=model.copies[language()][translated?'originalLabel':'translateLabel'];
   });
   if(active){
    const replacement=activeTranslate?host.querySelector('[data-translate-club]')
     :activeHistoryToggle?host.querySelector('[data-club-history-toggle="'+activeHistoryToggle+'"]')
     :activeHref?[...host.querySelectorAll('a')].find(link=>link.getAttribute('href')===activeHref):null;
    replacement?.focus({preventScroll:true});
    if(window.scrollX!==scrollX||window.scrollY!==scrollY)window.scrollTo(scrollX,scrollY);
   }
   document.documentElement.dataset.clubIdentityReady='true';
   document.documentElement.dataset.clubReady='true';
   fixturesController?.mount();
  };
  const applyCompetitionSnapshot=incoming=>{
   const previous=JSON.stringify(competitionSnapshot);
   if(previous===JSON.stringify(incoming))return;
   competitionSnapshot=incoming;
   const panel=host.querySelector('.club-competition');if(!panel)return;
   const focused=panel.contains(document.activeElement),href=focused?document.activeElement.getAttribute('href'):null;
   const staging=document.createElement('div');
   staging.innerHTML=model.render(manifest,selected,language(),location.search,competitionSnapshot,competitionSeason(),historySnapshot,rosterSnapshot,currentWorldSeason());
   const replacement=staging.querySelector('.club-competition');
   if(!replacement)return;
   for(const link of replacement.querySelectorAll('a'))if(window.faAppHref)link.href=window.faAppHref(link.getAttribute('href'));
   bindDivisionLinks(replacement);
   reuseCrests(panel,replacement);
   panel.replaceWith(replacement);
   if(focused){
    const target=[...replacement.querySelectorAll('a')].find(link=>link.getAttribute('href')===href);
    if(target)target.focus({preventScroll:true});else{replacement.tabIndex=-1;replacement.focus({preventScroll:true});}
   }
  };
  // Isolated protected DEV summaries never override an authoritative snapshot.
  window.addEventListener('fa:club-competition-summary',event=>{
   if(window.faDebugEnabled===false||!window.faDevPreviewMode&&window.faWorldState?.get?.().source==='authoritative')return;
   const incoming=event.detail;
   if(incoming?.schemaVersion===1){
    const selectors=window.faProviderSelectors;
    if(!selectors)return;
    const chosen=incoming.scope==='history'
     ?selectors.selectHistoryData(incoming,incoming.competitionId,incoming.selectedSeason)
     :selectors.selectSeasonData(incoming,incoming.competitionId,incoming.selectedSeason);
    if(!chosen)return;
    applyCompetitionSnapshot(chosen);
   }else if(incoming===null){
    applyCompetitionSnapshot(null);
   }else if(incoming?.source==='dev'){
    applyCompetitionSnapshot(incoming);
   }
  });
  paint();
  // Each roster subview is a direct URL; no intermediate Attributes tab.
  // Reuse the loaded club snapshot for category switches without another request.
  host.addEventListener('click',event=>{
   const control=event.target.closest?.('a[data-club-roster-view]');
   if(!control||selected.view!=='roster'||event.defaultPrevented||event.button!==0||
    event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   if(control.getAttribute('aria-disabled')==='true'||!control.hasAttribute('href')){
    event.preventDefault();
    return;
   }
   const target=control.dataset.clubRosterView;
   const groups={
    info:['age','height','foot'],
    technical:['passing','technique','dribbling','shooting','crossing','tackling','marking','heading'],
    mental:['vision','positioning','decisions','composure'],
    physical:['speed','strength','stamina','agility'],
    goalkeeping:['gk_reflexes','gk_handling','gk_positioning','gk_aerial']
   };
   if(!Object.hasOwn(groups,target))return;
   event.preventDefault();
   const params=new URLSearchParams(location.search);
   params.delete('view');params.delete('group');params.set('view',target);
   const sort=params.get('sort');
   if(sort&&!['nationality','name','positions',...groups[target]].includes(sort)){
    params.delete('sort');params.delete('order');
   }
   const next=location.pathname+'?'+params.toString()+location.hash;
   if(next===location.pathname+location.search+location.hash)return;
   history.pushState(null,'',next);
   paint(true);
   host.querySelector('[data-club-roster-view="'+target+'"]')?.focus({preventScroll:true});
  });
  // Identical sort cycle to /players: descending, ascending, reset.
  // Sort the in-memory club snapshot without repeating its public API request.
  host.addEventListener('click',event=>{
   const button=event.target.closest?.('[data-club-roster-sort]');
   if(!button||selected.view!=='roster')return;
   const key=button.dataset.clubRosterSort;
   const params=new URLSearchParams(location.search);
   const requested=params.get('view'),group=['technical','mental','physical','goalkeeping'].includes(requested)?requested:'info';
   const common=['nationality','name','positions'];
   const byView={
    info:['age','height','foot'],
    technical:['passing','technique','dribbling','shooting','crossing','tackling','marking','heading'],
    mental:['vision','positioning','decisions','composure'],
    physical:['speed','strength','stamina','agility'],
    goalkeeping:['gk_reflexes','gk_handling','gk_positioning','gk_aerial']
   };
   if(!common.includes(key)&&!byView[group].includes(key))return;
   if(params.get('sort')!==key){params.set('sort',key);params.set('order','desc');}
   else if(params.get('order')==='desc')params.set('order','asc');
   else{params.delete('sort');params.delete('order');}
   history.pushState(null,'',location.pathname+'?'+params.toString()+location.hash);
   paint(true);
   host.querySelector('[data-club-roster-sort="'+key+'"]')?.focus({preventScroll:true});
  });
  host.addEventListener('keydown',event=>{
   const tab=event.target.closest?.('[data-club-roster-view]');
   if(!tab||selected.view!=='roster'||tab.getAttribute('aria-disabled')==='true')return;
   const list=tab.closest('[role="tablist"]');
   const options=[...list.querySelectorAll('[role="tab"]')],index=options.indexOf(tab);
   if(index<0)return;
   const next={ArrowRight:(index+1)%options.length,ArrowLeft:(index+options.length-1)%options.length,Home:0,End:options.length-1}[event.key];
   if(next===undefined)return;
   event.preventDefault();options[next].click();
  });
  // A current-state roster read is independent of sporting seasons and archives.
  let rosterRequest=0,rosterAbort=null;
  refreshClubRoster=()=>{
   if(selected.view!=='roster')return;
   const clubKey=selected.countryId+'-'+selected.clubId;
   const ticket=++rosterRequest;
   rosterAbort?.abort();rosterAbort=new AbortController();
   const {signal}=rosterAbort;
   void (async()=>{
    try{
     const response=await fetch('/api/clubs/'+clubKey+'/roster',{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',signal,headers:{Accept:'application/json'}});
     if(!response.ok){const error=Error('roster_http_'+response.status);error.status=response.status;throw error;}
     const data=await response.json();
     if(data?.clubKey!==clubKey||!Number.isSafeInteger(data.count)||data.count<0||
      !Array.isArray(data.players)||data.players.length!==data.count||
      data.players.some((p,i)=>!Number.isSafeInteger(p?.id)||p.id<1||
       i>0&&p.id<=data.players[i-1].id||typeof p.display_name!=='string'||
       typeof p.nationality!=='string'||typeof p.primary_position!=='string'))
      throw Error('invalid_roster_response');
     if(signal.aborted||ticket!==rosterRequest)return;
     rosterSnapshot={source:'ready',...data};
     // No table is shown for a verified empty squad; keep the neutral route.
     // A positive response selects Info without creating a history entry.
     if(selected.view==='roster'&&data.count>0&&!new URLSearchParams(location.search).has('view'))
      history.replaceState(null,'',location.pathname+'?view=info'+location.hash);
    }catch(error){
     if(signal.aborted||ticket!==rosterRequest)return;
     rosterSnapshot={source:'unavailable',status:Number.isSafeInteger(error?.status)?error.status:0};
    }
    if(selected.view==='roster')paint(true);
   })();
  };
  window.addEventListener('pagehide',()=>{rosterAbort?.abort();rosterRequest++});
  refreshClubRoster();
  // Public source: exactly the club's two domestic candidates plus both cups.
  // Shared world ownership, strict season validation and a reset fence prevent
  // showing Season 1 memberships in Season 2 or on Debug source transitions.
  let publicEpoch=0,publicAbort=null,lastWorldKey=null;
  const {createClubPublicReadCache}=await import('/assets/club-public-read-cache.mjs');
  const publicReadCache=createClubPublicReadCache({
   getState:()=>window.faWorldState?.get?.(),
   fetchJson:async(path,{signal}={})=>{
    const response=await fetch(path,{signal,credentials:'omit',cache:'no-store',redirect:'error'});
    if(!response.ok){const error=Error('Public club competition data unavailable');error.status=response.status;throw error;}
    return response.json();
   }
  });
  const publicJson=publicReadCache.read;
  window.addEventListener('fa:source-change',publicReadCache.clear);
  window.addEventListener('pagehide',publicReadCache.clear);
  const enablePublic=async()=>{
   try{
    const projection=await import('/assets/club-season-source.mjs');
    // app.js imports the shared adapter asynchronously. A cold Club URL can
    // resolve its manifest before that import finishes: subscribe only after
    // the adapter has created faWorldState, or the skeleton never settles.
    await import('/assets/world-clock-adapter.js');
    const state=window.faWorldState;
    if(!state)throw Error('Shared world state unavailable');
    const sameWorld=(a,b)=>['generation','revision','seasonNumber','day','phase'].every(k=>a?.[k]===b?.[k]);
    const refresh=()=>{
     // Other Club views have no competition overview panel. Keep a completed
     // or in-flight result for when the user returns instead of refetching.
     if(selected.view!=='overview')return;
     const current=state.get(),dev=current.source==='dev'&&window.faDebugEnabled!==false;
     if(dev){
      lastWorldKey=null;publicAbort?.abort();++publicEpoch;
      if(competitionSnapshot?.source!=='dev')applyCompetitionSnapshot({source:'loading'});
      return;
     }
     if(current.source!=='authoritative')return;
     const world=current.world;
     const key=JSON.stringify([current.sourceRevision,world?.generation,world?.revision,world?.seasonNumber,world?.day,world?.phase]);
     if(key===lastWorldKey)return;
     lastWorldKey=key;
     const epoch=++publicEpoch;
     publicAbort?.abort();publicAbort=new AbortController();const {signal}=publicAbort;
     if(!world||current.worldStatus!=='ready'){
      applyCompetitionSnapshot({source:current.worldStatus==='unavailable'?'unavailable':'loading'});
      return;
     }
     applyCompetitionSnapshot({source:'loading'});
     void (async()=>{
      try{
       const clubKey=selected.countryId+'-'+selected.clubId;
       // The shared History endpoint supplies the current competition snapshot.
       const verified=await projection.readClubMemberships({clubKey,world,fetchJson:publicJson,signal});
       const now=state.get();
       if(signal.aborted||epoch!==publicEpoch||now.source!=='authoritative'||
        now.sourceRevision!==current.sourceRevision||
        !sameWorld(now.world,world))return;
       applyCompetitionSnapshot(verified);
      }catch(error){
       const now=state.get();
       if(!signal.aborted&&epoch===publicEpoch&&now.source==='authoritative'&&
        now.sourceRevision===current.sourceRevision&&
        sameWorld(now.world,world))
        applyCompetitionSnapshot({source:'unavailable'});
      }
    })();
    };
    refreshClubOverview=refresh;
    state.subscribe(refresh);
    window.addEventListener('fa:source-change',()=>{lastWorldKey=null;refresh()});
    window.addEventListener('pagehide',()=>{publicAbort?.abort();publicEpoch++});
    refresh();
   }catch{
    if(window.faWorldState?.get?.().source!=='dev')applyCompetitionSnapshot({source:'unavailable'});
   }
  };
  void enablePublic();
  // Club History includes the current verified season and sealed prior seasons,
  // while reading only when the History tab is viewed.
  const enableClubHistory=async()=>{
   try{
    const {readClubHistory}=await import('/assets/club-history-source.mjs');
    await import('/assets/world-clock-adapter.js');
    const state=window.faWorldState;if(!state)throw Error('World state unavailable');
    let epoch=0,abort=null,lastKey=null;
    const same=(a,b)=>['generation','revision','seasonNumber','day','phase'].every(k=>a?.[k]===b?.[k]);
    const publish=value=>{historySnapshot=value;if(selected.view==='history')paint(true)};
    // DEV-only preview arrives from the protected local client, never through
    // the public HTTP reader. Validate its provenance and current source/day.
    const devHistory=value=>{
     const current=state.get(),key=selected.countryId+'-'+selected.clubId;
     return window.faDevPreviewMode===true&&window.faDebugEnabled!==false&&
      current.source==='dev'&&value?.schemaVersion===1&&value.source==='dev'&&
      value.clubKey===key&&value.currentSeason===current.current?.season&&
      value.worldDay===current.current?.day&&value.provenance?.kind==='fictional'&&
      value.provenance.sourceRef==='dev-fictional-preview'&&value.provenance.approved===false&&
      ['empty','complete'].includes(value.coverage)&&Array.isArray(value.seasons);
    };
    window.addEventListener('fa:club-history-preview',event=>{
     if(state.get().source!=='dev'||window.faDevPreviewMode!==true||window.faDebugEnabled===false)return;
     if(devHistory(event.detail))publish(event.detail);
     else if(event.detail===null)publish({source:'unavailable'});
    });
    const refresh=()=>{
     // Switching tabs does not invalidate a verified world snapshot. Finish
     // in-flight History reads and reuse them when returning to this tab.
     if(selected.view!=='history')return;
     const current=state.get();
     if(current.source==='dev'){
      abort?.abort();abort=null;epoch++;lastKey=null;
      // Season 0 has no sporting fixtures by construction, even before the
      // protected DEV preview reader completes. Never expose stale season data.
      if(window.faDevPreviewMode===true&&window.faDebugEnabled!==false&&current.current?.season===0){
       const empty={schemaVersion:1,source:'dev',clubKey:selected.countryId+'-'+selected.clubId,
        currentSeason:0,worldDay:0,matchdays:0,coverage:'empty',seasons:[],
        provenance:{kind:'fictional',sourceRef:'dev-fictional-preview',approved:false}};
       if(historySnapshot.source!=='dev'||historySnapshot.currentSeason!==0||historySnapshot.coverage!=='empty')publish(empty);
       return;
      }
      const cached=window.faDevClubHistorySnapshot;
      if(devHistory(cached)){if(historySnapshot!==cached)publish(cached);}
      else if(window.faDevClubHistoryPublished===true&&cached===null)
       publish({source:'unavailable'});
      else if(historySnapshot.source!=='loading')publish({source:'loading'});
      return;
     }
     if(current.source!=='authoritative')return;
     const world=current.world;
     const key=JSON.stringify([current.sourceRevision,world?.generation,world?.revision,world?.seasonNumber,world?.day,world?.phase,current.worldStatus]);
     if(key===lastKey)return;lastKey=key;
     const seq=++epoch;abort?.abort();abort=new AbortController();
     if(!world||current.worldStatus!=='ready'){
      publish({source:current.worldStatus==='unavailable'?'unavailable':'loading'});return;
     }
     const {signal}=abort,clubKey=selected.countryId+'-'+selected.clubId;
     publish({source:'loading'});
     void (async()=>{
      try{
       const result=await readClubHistory({clubKey,world,fetchJson:publicJson,signal});
       const now=state.get();
       if(signal.aborted||seq!==epoch||now.source!=='authoritative'||!same(now.world,world)||
          now.sourceRevision!==current.sourceRevision)return;
       publish(result);
      }catch{
       const now=state.get();
       if(!signal.aborted&&seq===epoch&&now.source==='authoritative'&&same(now.world,world))
        publish({source:'unavailable'});
      }
     })();
    };
    refreshClubHistory=refresh;state.subscribe(refresh);
    window.addEventListener('fa:source-change',()=>{lastKey=null;refresh()});
    window.addEventListener('pagehide',()=>{abort?.abort();epoch++});
    refresh();
   }catch{historySnapshot={source:'unavailable'};if(selected.view==='history')paint(true)}
  };
  void enableClubHistory();
  const fixtureModule=await import('/assets/club-fixtures-controller.mjs');
  fixturesController=fixtureModule.mountClubFixtures({host,manifest});
  fixturesController.mount();

  // Ignore unrelated attribute mutations and retain focus, scroll and SVG/image
  // nodes when the user changes the interface language.
  let renderedLanguage=language();
  new MutationObserver(()=>{
   const nextLanguage=language();
   if(nextLanguage===renderedLanguage)return;
   renderedLanguage=nextLanguage;
   paint(false,true);
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  window.addEventListener('popstate',()=>{
   const next=model.route(location.pathname);
   if(next&&next.base===selected.base){
    const queryOnly=selected.view==='roster'&&next.view==='roster';
    if(next.view==='roster'&&!queryOnly)rosterSnapshot={source:'loading'};
    selected=next;paint(true);refreshClubHistory();refreshClubOverview();
    if(!queryOnly)refreshClubRoster();
    if(queryOnly){
     const requested=new URLSearchParams(location.search).get('view');
     const mode=['technical','mental','physical','goalkeeping'].includes(requested)?requested:'info';
     host.querySelector('[data-club-roster-view="'+mode+'"]')?.focus({preventScroll:true});
    }else host.querySelector('.club-tabs [aria-current="page"]')?.focus({preventScroll:true});
   }
  });
  const crests=document.createElement('script');crests.src='/assets/club-crests.js';document.head.append(crests);
 }catch(error){
  // A failure in a later optional reader/controller must not erase an already
  // hydrated club identity and replace it with a misleading catalog error.
  console.error('Club page initialization failed:',error);
  if(document.documentElement.dataset.clubIdentityReady==='true')return;
  // Before identity hydration, report a genuine startup/manifest failure.
  for(const child of [...host.children])if(!child.matches('.club-header,.club-tabs'))child.remove();
  const message=document.createElement('p');message.className='app-panel club-load-error';
  message.setAttribute('role','alert');message.textContent=model.copies[language()].error;host.append(message);
 }
})();
