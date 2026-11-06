// Shared club controller: passive data loading, native page links, no career state.
(async()=>{
 'use strict';
 const model=window.faClubModel,host=document.getElementById('club-page');
 let selected=model.route(location.pathname),competitionSnapshot=null;
 const language=()=>Object.hasOwn(model.copies,document.documentElement.lang)?document.documentElement.lang:'en';
 const competitionSeason=()=>{
  const explicit=new URLSearchParams(location.search).get('season');
  if(/^[1-9]\d{0,8}$/.test(explicit||''))return Number(explicit);
  if(window.faDevPreviewMode===true&&window.faDebugEnabled!==false){
   try{const raw=sessionStorage.getItem('football-architect:standings-dev-season'),n=raw===null?NaN:Number(raw);
    if(Number.isInteger(n)&&n>=1&&n<=4)return n}catch{}
  }
  const current=Number(window.faWorldState?.get?.().current?.season);
  return Number.isInteger(current)&&current>=1?current:1;
 };
 try{
  if(!selected)throw Error('Unknown club route');
  const params=new URLSearchParams(location.search);
  params.delete('view');
  if(['overview','history'].includes(selected.view)){params.delete('season');params.delete('matchday');}
  const query=params.size?'?'+params:'';
  if(query!==location.search)history.replaceState(null,'',location.pathname+query+location.hash);
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
  const paint=(preserveCrest=false,preserveFocus=false)=>{
   const active=preserveFocus&&host.contains(document.activeElement)?document.activeElement:null;
   const activeHref=active?.getAttribute('href');
   const activeTranslate=active?.hasAttribute('data-translate-club');
   const scrollX=window.scrollX,scrollY=window.scrollY;
   const previousTabs=host.querySelector(':scope > .club-tabs');
   const tabScrollLeft=previousTabs?.scrollLeft;
   const staging=document.createElement('div');
   staging.innerHTML=model.render(manifest,selected,language(),location.search,competitionSnapshot,competitionSeason());
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
    for(const selector of ['.club-location','.club-header-division']){
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
   for(const child of [...host.childNodes])if(child!==header&&child!==tabs)child.remove();
   for(const child of [...staging.childNodes])if(child!==stagedHeader&&child!==stagedTabs)host.append(child);
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
     tabs.addEventListener('click',event=>{
      const link=event.target.closest?.('a');
      if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const nextUrl=new URL(link.href),next=model.route(nextUrl.pathname);
      if(!next||next.base!==selected.base)return;
      event.preventDefault();history.pushState(null,'',nextUrl.pathname+nextUrl.search+nextUrl.hash);
      selected=next;paint(true);
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
   document.title=host.querySelector('h1').textContent+' · '+model.copies[language()][selected.view]+' — Football Architect';
   document.querySelector('.skip-link').textContent=model.copies[language()].skip;
   for(const link of host.querySelectorAll('a'))if(window.faAppHref)link.href=window.faAppHref(link.getAttribute('href'));
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
     :activeHref?[...host.querySelectorAll('a')].find(link=>link.getAttribute('href')===activeHref):null;
    replacement?.focus({preventScroll:true});
    if(window.scrollX!==scrollX||window.scrollY!==scrollY)window.scrollTo(scrollX,scrollY);
   }
   document.documentElement.dataset.clubReady='true';
  };
  window.addEventListener('fa:club-competition-summary',event=>{
   // Provider envelopes are selected explicitly; legacy summary payloads keep
   // their established rendering path until the producer migrates.
   const incoming=event.detail;
   const previousSnapshot=JSON.stringify(competitionSnapshot);
   if(incoming?.schemaVersion===1){
    const selectors=window.faProviderSelectors;
    if(!selectors)return;
    const chosen=incoming.scope==='history'
      ?selectors.selectHistoryData(incoming,incoming.competitionId,incoming.selectedSeason)
      :selectors.selectSeasonData(incoming,incoming.competitionId,incoming.selectedSeason);
    if(!chosen)return;
    competitionSnapshot=chosen;
   }else {
    if(incoming!==null&&window.faDevPreviewMode!==true&&!document.querySelector('script[data-fa-dev-club-summary]'))return;
    competitionSnapshot=incoming;
   }
   if(JSON.stringify(competitionSnapshot)===previousSnapshot)return;
   const panel=host.querySelector('.club-competition');if(!panel)return;
   const focused=panel.contains(document.activeElement),href=focused?document.activeElement.getAttribute('href'):null;
   const staging=document.createElement('div');staging.innerHTML=model.render(manifest,selected,language(),location.search,competitionSnapshot,competitionSeason());
   const replacement=staging.querySelector('.club-competition');
   for(const link of replacement.querySelectorAll('a'))if(window.faAppHref)link.href=window.faAppHref(link.getAttribute('href'));
   bindDivisionLinks(replacement);
   reuseCrests(panel,replacement);
   panel.replaceWith(replacement);
   if(focused){const target=[...replacement.querySelectorAll('a')].find(link=>link.getAttribute('href')===href);
    if(target)target.focus({preventScroll:true});else{replacement.tabIndex=-1;replacement.focus({preventScroll:true});}}
  });
  paint();
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
   if(next&&next.base===selected.base){selected=next;paint(true);host.querySelector('.club-tabs [aria-current="page"]').focus({preventScroll:true});}
  });
  const crests=document.createElement('script');crests.src='/assets/club-crests.js';document.head.append(crests);
 }catch{
  // Manifest failure is confirmed, but permanent catalog identity and navigation remain valid.
  for(const child of [...host.children])if(!child.matches('.club-header,.club-tabs'))child.remove();
  const message=document.createElement('p');message.className='app-panel club-load-error';
  message.setAttribute('role','alert');message.textContent=model.copies[language()].error;host.append(message);
 }
})();
