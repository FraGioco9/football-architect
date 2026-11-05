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
  const reuseCrests=(previous,next)=>{
   const available=[...previous.querySelectorAll('[data-club-crest]')];
   for(const incoming of [...next.querySelectorAll('[data-club-crest]')]){
    const index=available.findIndex(old=>old.dataset.clubCrest===incoming.dataset.clubCrest
     &&old.className===incoming.className);
    if(index<0)continue;
    const old=available.splice(index,1)[0];
    if(old.querySelector('.app-club-crest-image'))incoming.replaceWith(old);
   }
  };
  // SAF-03: explicit same-origin league navigation for primary Safari taps.
  // Modified clicks and middle clicks remain native links.
  const bindDivisionLinks=root=>{
   for(const link of root.querySelectorAll('a[data-club-division-link]')){
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
   const tabScrollLeft=host.querySelector('.club-tabs')?.scrollLeft;
   const markup=model.render(manifest,selected,language(),location.search,competitionSnapshot,competitionSeason());
   const staging=document.createElement('div');staging.innerHTML=markup;
   // The header is unchanged across tabs, but locale switches need a translated
   // header; in both cases existing loaded crest nodes must survive.
   if(preserveCrest&&host.querySelector('.club-header')&&host.dataset.clubBase===selected.base){
    staging.querySelector('.club-header')?.replaceWith(host.querySelector('.club-header'));
   }
   reuseCrests(host,staging);
   host.replaceChildren(...staging.childNodes);
   host.dataset.clubBase=selected.base;
   // SAF-04: preserve the same first-paint scroll position and edge fade after each render.
   const newTabs=host.querySelector('.club-tabs');
   if(newTabs){
    const key='football-architect:club-tabs-scroll:'+selected.base;
    if(Number.isFinite(tabScrollLeft))newTabs.scrollLeft=tabScrollLeft;
    else try{const saved=Number(sessionStorage.getItem(key));if(Number.isFinite(saved)&&saved>=0)newTabs.scrollLeft=saved}catch{}
    const syncTabEdges=()=>{
     const maximum=Math.max(0,newTabs.scrollWidth-newTabs.clientWidth);
     newTabs.dataset.canScrollLeft=String(maximum>1&&newTabs.scrollLeft>1);
     newTabs.dataset.canScrollRight=String(maximum>1&&newTabs.scrollLeft<maximum-1);
    };
    syncTabEdges();
    newTabs.addEventListener('scroll',()=>{syncTabEdges();try{sessionStorage.setItem(key,String(newTabs.scrollLeft))}catch{}},{passive:true});
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
   // Native links preserve standard Tab/Enter behavior; arrows, Home and End move focus.
   const links=[...host.querySelectorAll('.club-tabs a')];
   for(const link of links)link.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const nextUrl=new URL(link.href);
    const next=model.route(nextUrl.pathname);
    if(!next||next.base!==selected.base)return;
    event.preventDefault();
    history.pushState(null,'',nextUrl.pathname+nextUrl.search+nextUrl.hash);
    selected=next;
    paint(true);
    host.querySelector('.club-tabs [aria-current="page"]').focus({preventScroll:true});
   });
   for(const link of links)link.addEventListener('keydown',event=>{
    const i=links.indexOf(link),n=links.length;
    const next={ArrowRight:(i+1)%n,ArrowLeft:(i+n-1)%n,Home:0,End:n-1}[event.key];
    if(next!==undefined){event.preventDefault();links[next].focus();}
   });
   if(active){
    const replacement=activeTranslate?host.querySelector('[data-translate-club]')
     :activeHref?[...host.querySelectorAll('a')].find(link=>link.getAttribute('href')===activeHref)
     :null;
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
  host.replaceChildren();const message=document.createElement('p');
  message.setAttribute('role','alert');message.textContent=model.copies[language()].error;host.append(message);
 }
})();
