// Shared club controller: passive data loading, native page links, no career state.
(async()=>{
 'use strict';
 const model=window.faClubModel,host=document.getElementById('club-page');
 let rosterMenuEvents=null,rosterStatTip=null,rosterStatActive=null;
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
  if(window.faDevPreviewMode===true&&window.faDebugEnabled===true){
   try{const raw=sessionStorage.getItem('football-architect:standings-dev-season'),n=raw===null?NaN:Number(raw);
    if(Number.isInteger(n)&&n>=1&&n<=4)return n}catch{}
  }
  const current=Number(window.faWorldState?.get?.().current?.season);
  return Number.isInteger(current)&&current>=1?current:1;
 };
 try{
  if(!selected)throw Error('Unknown club route');
  if(selected.view!=='roster'){
   const params=new URLSearchParams(location.search);
   params.delete('view');
   if(['overview','history'].includes(selected.view)){params.delete('season');params.delete('matchday');}
   if(selected.view==='records'){
    params.delete('matchday');params.delete('competition');
    if(!['season','verified','all-time'].includes(params.get('scope')))params.delete('scope');
   }
   const query=params.size?'?'+params:'';
   if(query!==location.search)history.replaceState(null,'',location.pathname+query+location.hash);
  }
  const selectorScript=document.createElement('script');
  selectorScript.type='module';selectorScript.src='/assets/provider-selectors-bootstrap.mjs';
  document.head.append(selectorScript);
  // Every view reuses the canonical static identity catalogue. Overview adds
  // only the selected club's biography and rivalries, never the full manifest.
  const identityOnly=selected.view!=='overview';
  const manifestPath='/clubs/_shared/identity.json';
  const clubKey=selected.countryId+'-'+selected.clubId;
  const profilePath=identityOnly?null:'/clubs/_profiles/'+clubKey+'.json';
  const [response,profileResponse]=await Promise.all([
   fetch(manifestPath,{credentials:'same-origin',cache:'force-cache'}),
   profilePath?fetch(profilePath,{credentials:'same-origin',cache:'force-cache'}):Promise.resolve(null)
  ]);
  if(!response.ok)throw Error('Club identity catalogue unavailable');
  const identity=await response.json();
  if(identity?.schemaVersion!==1||identity.projection!=='club-identity-v1'||
     !Array.isArray(identity.clubs)||identity.clubs.length!==320||
     !Array.isArray(identity.divisions)||identity.divisions.length!==16||
     !identity.clubCrests||typeof identity.clubCrests!=='object'||
     !identity.countryFlags||typeof identity.countryFlags!=='object')
   throw Error('Invalid club identity projection');
  let manifest=identity;
  if(profilePath){
   if(!profileResponse?.ok)throw Error('Club Overview profile unavailable');
   const profile=await profileResponse.json();
   const base=identity.clubs.find(c=>c.countryId+'-'+c.clubId===clubKey);
   if(profile?.schemaVersion!==1||profile.projection!=='club-overview-v1'||
      profile.clubKey!==clubKey||!base||!profile.club||
      profile.club.countryId!==selected.countryId||profile.club.clubId!==selected.clubId||
      !Array.isArray(profile.rivalries)||!['en','de','es','fr','it'].every(lang=>
       typeof profile.club.descriptions?.[lang]==='string')||
      ['city','primaryName','fullName','compactName','abbr','divisionId'].some(k=>profile.club[k]!==base[k])||
      profile.rivalries.some(r=>r.clubAId!==clubKey&&r.clubBId!==clubKey))
    throw Error('Invalid canonical Club Overview profile');
   manifest={...identity,clubs:identity.clubs.map(c=>
    c.countryId+'-'+c.clubId===clubKey?profile.club:c),
    rivalries:profile.rivalries};
  }
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
   // On narrow screens CSS displays native table rows as grids. Explicit roles
   // retain the table/row/header structure for Safari VoiceOver and other AT.
   for(const table of host.querySelectorAll('.club-history-table')){
    if(table.hasAttribute('role'))continue;
    table.setAttribute('role','table');
    table.tHead?.setAttribute('role','rowgroup');
    for(const body of table.tBodies)body.setAttribute('role','rowgroup');
    for(const row of table.rows)row.setAttribute('role','row');
    for(const cell of table.querySelectorAll('thead th'))cell.setAttribute('role','columnheader');
    for(const cell of table.querySelectorAll('tbody th'))cell.setAttribute('role','rowheader');
    for(const cell of table.querySelectorAll('tbody td'))cell.setAttribute('role','cell');
   }
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
   if(!nav||!nav.clientWidth)return; // Leave first-paint CSS fade until tab strip has real dimensions.
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
  // Share Player Stats' compact, accessible floating tooltip appearance.
  // Help is localized in the existing Roster render; sort remains independent.
  const hideRosterStatHelp=()=>{
   if(rosterStatActive)rosterStatActive.removeAttribute('aria-describedby');
   rosterStatActive=null;
   if(rosterStatTip)rosterStatTip.hidden=true;
  };
  const showRosterStatHelp=button=>{
   if(selected.view!=='roster'||!button||!host.contains(button))return;
   const description=button.dataset.rosterStatHelp;
   if(!description)return;
   if(!rosterStatTip){
    rosterStatTip=document.createElement('div');
    rosterStatTip.id='club-roster-stat-tooltip';
    rosterStatTip.className='app-players-nationality-tooltip';
    rosterStatTip.setAttribute('role','tooltip');
    rosterStatTip.hidden=true;
    document.body.append(rosterStatTip);
   }
   if(rosterStatActive&&rosterStatActive!==button)
    rosterStatActive.removeAttribute('aria-describedby');
   rosterStatActive=button;rosterStatTip.textContent=description;
   rosterStatTip.hidden=false;button.setAttribute('aria-describedby',rosterStatTip.id);
   const bounds=button.getBoundingClientRect();
   const width=rosterStatTip.offsetWidth||200,height=rosterStatTip.offsetHeight||40;
   rosterStatTip.style.left=Math.round(Math.max(8,Math.min(window.innerWidth-width-8,bounds.left+bounds.width/2-width/2)))+'px';
   const above=bounds.top-height-8,below=bounds.bottom+8;
   rosterStatTip.style.top=Math.round(above>=8?above:Math.max(8,Math.min(window.innerHeight-height-8,below)))+'px';
  };
  host.addEventListener('pointerover',e=>{
   const button=e.target.closest?.('[data-roster-stat-help]');
   if(button&&e.pointerType!=='touch')showRosterStatHelp(button);
  });
  host.addEventListener('pointerout',e=>{
   if(rosterStatActive&&(e.target===rosterStatActive||rosterStatActive.contains(e.target))&&
    !rosterStatActive.contains(e.relatedTarget))hideRosterStatHelp();
  });
  host.addEventListener('focusin',e=>{
   const button=e.target.closest?.('[data-roster-stat-help]');
   if(button)showRosterStatHelp(button);
  });
  host.addEventListener('focusout',e=>{if(e.target===rosterStatActive)hideRosterStatHelp()});
  host.addEventListener('keydown',e=>{if(e.key==='Escape')hideRosterStatHelp()});
  document.addEventListener('scroll',hideRosterStatHelp,true);
  window.addEventListener('resize',hideRosterStatHelp);
  const paint=(preserveCrest=false,preserveFocus=false)=>{
   hideRosterStatHelp();
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
   staging.innerHTML=model.render(manifest,selected,language(),location.search,competitionSnapshot,competitionSeason(),historySnapshot,rosterSnapshot,
    competitionSnapshot?.source==='dev'&&Number.isSafeInteger(competitionSnapshot.season)?competitionSnapshot.season:currentWorldSeason());
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
    if(title&&nextTitle){
     if(title.innerHTML!==nextTitle.innerHTML)title.innerHTML=nextTitle.innerHTML;
     title.setAttribute('aria-label',nextTitle.getAttribute('aria-label'));
    }
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
   for(const slot of host.querySelectorAll('[data-club-record-portrait]'))
    slot.replaceWith(window.faHistoryPlayerUI.portrait(slot.dataset.clubRecordPortrait));
   if(Number.isFinite(historyTableScroll)){const tableWrap=host.querySelector('.club-history-table-wrap');if(tableWrap)tableWrap.scrollLeft=historyTableScroll;}
   if(Number.isFinite(rosterTableScroll)){const rosterWrap=host.querySelector('.club-roster-table-scroll');if(rosterWrap)rosterWrap.scrollLeft=rosterTableScroll;}
   rosterMenuEvents?.abort();
   const control=host.querySelector('[data-club-roster-control]');
   if(control){
    rosterMenuEvents=new AbortController();
    const trigger=control.querySelector('button'),menu=control.querySelector('[role=listbox]');
    const group=control.dataset.clubRosterControl==='group';
    const binding=window.faBindCompetitionMenu(trigger,menu,[...menu.children],value=>{
     const query=group?model.rosterViewQuery(location.search,value):new URLSearchParams(location.search);
     if(!group){if(value==='all')query.delete('competition');else query.set('competition',value);}
     const next=location.pathname+'?'+query+location.hash;
     if(next!==location.pathname+location.search+location.hash)history.pushState(null,'',next);
     paint(true);host.querySelector('[data-club-roster-control] button')?.focus({preventScroll:true});
    },control,{signal:rosterMenuEvents.signal});
    const params=new URLSearchParams(location.search);
    binding.sync(group?model.rosterView(params):model.rosterCompetition(params));
   }
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
    // First hydration must prefer the stored manual scroll, not the transient
    // parser-time scrollLeft=0. Later paints preserve the current DOM offset.
    let restored=false;
    if(tabs.dataset.clubInteractionsBound!=='true')try{
     const saved=sessionStorage.getItem(key),n=Number(saved);
     if(saved!==null&&Number.isFinite(n)&&n>=0){tabs.scrollLeft=n;restored=true}
    }catch{}
    if(!restored&&Number.isFinite(tabScrollLeft))tabs.scrollLeft=tabScrollLeft;
    const syncTabEdges=()=>{
     const maximum=Math.max(0,tabs.scrollWidth-tabs.clientWidth);
     tabs.dataset.canScrollLeft=String(maximum>1&&tabs.scrollLeft>1);
     tabs.dataset.canScrollRight=String(maximum>1&&tabs.scrollLeft<maximum-1);
    };
    syncTabEdges();
    if(tabs.dataset.clubInteractionsBound!=='true'){
     tabs.dataset.clubInteractionsBound='true';
     tabs.addEventListener('scroll',()=>{syncTabEdges();try{sessionStorage.setItem(key,String(tabs.scrollLeft))}catch{}},{passive:true});
     window.addEventListener('pagehide',()=>{try{sessionStorage.setItem(key,String(tabs.scrollLeft))}catch{}});
     window.addEventListener('pageshow',event=>{
      if(!event.persisted)return;
      try{const saved=sessionStorage.getItem(key),n=Number(saved);if(saved!==null&&Number.isFinite(n)&&n>=0)tabs.scrollLeft=n}catch{}
      syncTabEdges();
     });
     // Overflow and fades must follow a desktop/mobile breakpoint change even
     // when scrollLeft stays at zero and therefore emits no scroll event.
     window.addEventListener('resize',syncTabEdges,{passive:true});
     tabs.addEventListener('click',event=>{
      const link=event.target.closest?.('a');
      if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const nextUrl=new URL(link.href),next=model.route(nextUrl.pathname);
      if(!next||next.base!==selected.base)return;
      // The full Overview biography is a separate immutable document read.
      // Follow its native link rather than painting an incomplete view.
      if(typeof identityOnly!=='undefined'&&identityOnly&&next.view==='overview')return;
      event.preventDefault();
      // An active tab is a no-op: keep the Roster snapshot, URL and scroll position.
      if(next.view===selected.view)return;
      history.pushState(null,'',nextUrl.pathname+nextUrl.search+nextUrl.hash);
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
   // The browser tab retains the primary name regardless of the viewport-specific H1.
   const titleName=manifest.clubs.find(club=>club.countryId===selected.countryId&&club.clubId===selected.clubId)?.primaryName?.trim();
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
   staging.innerHTML=model.render(manifest,selected,language(),location.search,competitionSnapshot,competitionSeason(),historySnapshot,rosterSnapshot,
    competitionSnapshot?.source==='dev'&&Number.isSafeInteger(competitionSnapshot.season)?competitionSnapshot.season:currentWorldSeason());
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
   if(window.faDebugEnabled!==true||!window.faDevPreviewMode&&window.faWorldState?.get?.().source==='authoritative')return;
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
  await import('/assets/competition-tabs.js');
  paint();
  host.addEventListener('click',event=>{
   if(selected.view!=='records')return;
   const trigger=event.target.closest?.('[data-club-record-detail]');
   if(trigger){
    const scope=host.querySelector('[data-record-scope][aria-pressed="true"]').dataset.recordScope;
    const record=window.faClubRecords.select(historySnapshot.seasons,scope).players.find(p=>p.key===trigger.dataset.clubRecordDetail);
    if(record){
     const club=manifest.clubs.find(c=>c.countryId+'-'+c.clubId===clubKey);
     window.faHistoryPlayerUI.openPlayers({value:record.value,holders:window.faClubRecords.playerHolders(record.sources,clubKey)},trigger,{name:club?.primaryName||clubKey});
    }
    return;
   }
   const button=event.target.closest?.('[data-record-scope]');
   if(!button||event.defaultPrevented||button.getAttribute('aria-pressed')==='true')return;
   const url=new URL(location.href);
   if(button.dataset.recordScope==='verified')url.searchParams.set('scope','all-time');
   else url.searchParams.delete('scope');
   url.searchParams.delete('season');
   history.pushState(null,'',url);
   paint(true);
   host.querySelector('[data-record-scope][aria-pressed="true"]')?.focus({preventScroll:true});
  });
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
   event.preventDefault();
   const params=model.rosterViewQuery(location.search,target==='attributes'?(control.closest('.club-roster').querySelector('[data-club-roster-control=group] button')?.value||'technical'):target);
   const next=location.pathname+'?'+params.toString()+location.hash;
   if(next===location.pathname+location.search+location.hash)return;
   history.pushState(null,'',next);
   refreshClubRoster();paint(true);
   host.querySelector('[data-club-roster-view="'+target+'"]')?.focus({preventScroll:true});
  });
  // Identical sort cycle to /players: descending, ascending, reset.
  // Sort the in-memory club snapshot without repeating its public API request.
  host.addEventListener('click',event=>{
   const button=event.target.closest?.('[data-club-roster-sort]');
   if(!button||selected.view!=='roster')return;
   const key=button.dataset.clubRosterSort;
   const params=new URLSearchParams(location.search);
   if(!model.rosterSortKeys(model.rosterView(params)).includes(key))return;
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
  const rosterReads=new Map();
  let rosterCacheClubKey=null;
  const canonicalRosterInfo=()=>{
   if(selected.view==='roster'&&rosterSnapshot.source==='ready'&&rosterSnapshot.count>0&&
    !new URLSearchParams(location.search).has('view')){
    const query=new URLSearchParams(location.search);query.set('view','info');
    history.replaceState(null,'',location.pathname+'?'+query+location.hash);
   }
  };
  refreshClubRoster=()=>{
   if(selected.view!=='roster')return;
   const clubKey=selected.countryId+'-'+selected.clubId;
   const query=new URLSearchParams(location.search),stats=query.get('view')==='stats';
   const season=query.get('season');
   const suffix=stats?'/stats'+(season!==null?'?season='+encodeURIComponent(season):''):'';
   const cacheKey=clubKey+suffix;
   // Reuse both completed and in-flight reads when revisiting this club.
   // An unavailable response can be retried on the next Roster entry.
   rosterCacheClubKey=cacheKey;
   const cached=rosterReads.get(cacheKey);
   if(cached){
    const changed=rosterSnapshot!==cached.snapshot;
    rosterSnapshot=cached.snapshot;canonicalRosterInfo();
    if(changed)paint(true);
    return;
   }
   const entry={controller:new AbortController(),snapshot:{source:'loading'}};
   rosterReads.set(cacheKey,entry);
   const needsPaint=rosterSnapshot.source!=='loading';
   rosterSnapshot=entry.snapshot;
   if(needsPaint)paint(true);
   const {signal}=entry.controller;
   void (async()=>{
    try{
     const response=await fetch('/api/clubs/'+clubKey+'/roster'+suffix,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',signal,headers:{Accept:'application/json'}});
     if(!response.ok){const error=Error('roster_http_'+response.status);error.status=response.status;throw error;}
     const data=await response.json();
     if(stats){
      const count=v=>Number.isSafeInteger(v)&&v>=0;
      const nullableCount=v=>v===null||count(v);
      const nullableRate=v=>v===null||typeof v==='number'&&Number.isFinite(v)&&v>=0;
      const validStats=s=>s===null||!!s&&
       ['appearances','starts','minutes','goals','ratedAppearances'].every(k=>count(s[k]))&&
       ['subAppearances','assists','cleanSheets','yellowCards','redCards'].every(k=>nullableCount(s[k]))&&
       ['averageRating','goalsAssistsPer90'].every(k=>nullableRate(s[k]));
      if(!Number.isSafeInteger(data?.season)||data.season<0||
       !Array.isArray(data?.competitions)||!data.competitions.every(id=>typeof id==='string')||
       !Array.isArray(data?.players)||!data.players.every(p=>validStats(p.stats)&&
        p.competitionStats&&typeof p.competitionStats==='object'&&
        data.competitions.every(id=>validStats(p.competitionStats[id]))))
       throw Error('invalid_roster_stats');
     }
     if(data?.clubKey!==clubKey||!Number.isSafeInteger(data.count)||data.count<0||
      !Array.isArray(data.players)||data.players.length!==data.count||
      data.players.some((p,i)=>!Number.isSafeInteger(p?.id)||p.id<1||
       i>0&&p.id<=data.players[i-1].id||typeof p.display_name!=='string'||
       typeof p.nationality!=='string'||typeof p.primary_position!=='string'))
      throw Error('invalid_roster_response');
     if(signal.aborted)return;
     entry.snapshot={source:'ready',...data};
    }catch(error){
     if(signal.aborted)return;
     rosterReads.delete(cacheKey);
     entry.snapshot={source:'unavailable',status:Number.isSafeInteger(error?.status)?error.status:0};
    }
    if(cacheKey!==rosterCacheClubKey)return;
    rosterSnapshot=entry.snapshot;
    if(selected.view==='roster'){canonicalRosterInfo();paint(true);}
   })();
  };
  const clearRosterReads=(statsOnly=false)=>{
   for(const [key,entry] of rosterReads){
    if(statsOnly&&!key.includes('/stats'))continue;
    entry.controller.abort();rosterReads.delete(key);
   }
   if(!statsOnly||rosterCacheClubKey?.includes('/stats'))rosterCacheClubKey=null;
  };
  window.addEventListener('pagehide',()=>clearRosterReads());
  // Contracts writes do not advance sporting-world revisions. A cross-tab
  // storage nonce invalidates only a previously loaded roster, not world data.
  const rosterSignalKey='fa:roster-affiliations:v1';
  const rosterSignal=()=>{try{return localStorage.getItem(rosterSignalKey)}catch{return null}};
  let lastRosterSignal=rosterSignal();
  const invalidateRoster=(statsOnly=false)=>{
   clearRosterReads(statsOnly);
   if(rosterCacheClubKey!==null)return;
   rosterSnapshot={source:'loading'};
   if(selected.view==='roster'){paint(true);refreshClubRoster()}
  };
  const checkRosterSignal=()=>{
   const current=rosterSignal();
   if(current===null||current===lastRosterSignal)return;
   lastRosterSignal=current;invalidateRoster();
  };
  window.addEventListener('storage',event=>{
   if(event.key===rosterSignalKey)checkRosterSignal();
  });
  window.addEventListener('fa:roster-affiliations-changed',checkRosterSignal);
  document.addEventListener('visibilitychange',()=>{
   if(!document.hidden)checkRosterSignal();
  });
  window.addEventListener('pageshow',event=>{
   if(!event.persisted)return;
   checkRosterSignal();
   if(selected.view==='roster'&&rosterCacheClubKey===null)refreshClubRoster();
  });
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
    let rosterWorld=state.get().world;
    state.subscribe(({world})=>{
     if(rosterWorld?.generation===world?.generation&&rosterWorld?.revision===world?.revision)return;
     const previous=rosterWorld;rosterWorld=world;
     if(previous)invalidateRoster(true);
    });
    const sameWorld=(a,b)=>['generation','revision','seasonNumber','day','phase'].every(k=>a?.[k]===b?.[k]);
    const refresh=()=>{
     // Other Club views have no competition overview panel. Keep a completed
     // or in-flight result for when the user returns instead of refetching.
     if(selected.view!=='overview')return;
     const current=state.get(),dev=current.source==='dev'&&window.faDebugEnabled===true;
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
    const publish=value=>{historySnapshot=value;if(['history','records'].includes(selected.view))paint(true)};
    // DEV-only preview arrives from the protected local client, never through
    // the public HTTP reader. Validate its provenance and current source/day.
    const devHistory=value=>{
     const current=state.get(),key=selected.countryId+'-'+selected.clubId;
     return window.faDevPreviewMode===true&&window.faDebugEnabled===true&&
      current.source==='dev'&&value?.schemaVersion===1&&value.source==='dev'&&
      value.clubKey===key&&value.currentSeason===current.current?.season&&
      value.worldDay===current.current?.day&&value.provenance?.kind==='fictional'&&
      value.provenance.sourceRef==='dev-fictional-preview'&&value.provenance.approved===false&&
      ['empty','complete'].includes(value.coverage)&&Array.isArray(value.seasons);
    };
    window.addEventListener('fa:club-history-preview',event=>{
     if(state.get().source!=='dev'||window.faDevPreviewMode!==true||window.faDebugEnabled!==true)return;
     if(devHistory(event.detail))publish(event.detail);
     else if(event.detail===null)publish({source:'unavailable'});
    });
    const refresh=()=>{
     // Switching tabs does not invalidate a verified world snapshot. Finish
     // in-flight History reads and reuse them when returning to this tab.
     if(!['history','records'].includes(selected.view))return;
     const current=state.get();
     if(current.source==='dev'){
      abort?.abort();abort=null;epoch++;lastKey=null;
      // Season 0 has no sporting fixtures by construction, even before the
      // protected DEV preview reader completes. Never expose stale season data.
      if(window.faDevPreviewMode===true&&window.faDebugEnabled===true&&current.current?.season===0){
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
   }catch{historySnapshot={source:'unavailable'};if(['history','records'].includes(selected.view))paint(true)}
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
    if(identityOnly&&next.view==='overview'){
     location.replace(location.href);return;
    }
    if(selected.view==='records'&&next.view==='records'){
     paint(true);
     host.querySelector('[data-record-scope][aria-pressed="true"]')?.focus({preventScroll:true});
     return;
    }
    const queryOnly=selected.view==='roster'&&next.view==='roster';
    selected=next;paint(true);refreshClubHistory();refreshClubOverview();
    refreshClubRoster();
    if(queryOnly){
     host.querySelector('.club-roster-tabs [aria-selected="true"]')?.focus({preventScroll:true});
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
