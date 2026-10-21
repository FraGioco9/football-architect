// Shared club controller: passive data loading, native page links, no career state.
(async()=>{
 'use strict';
 const model=window.faClubModel,host=document.getElementById('club-page');
 let selected=model.route(location.pathname);
 const language=()=>Object.hasOwn(model.copies,document.documentElement.lang)?document.documentElement.lang:'en';
 try{
  if(!selected)throw Error('Unknown club route');
  const params=new URLSearchParams(location.search);
  params.delete('view');
  if(['overview','history'].includes(selected.view)){params.delete('season');params.delete('matchday');}
  const query=params.size?'?'+params:'';
  if(query!==location.search)history.replaceState(null,'',location.pathname+query+location.hash);
  const response=await fetch('/clubs/_shared/manifest.json',{credentials:'same-origin'});
  if(!response.ok)throw Error('Club manifest unavailable');
  const manifest=await response.json();
  window.faClubCrests=manifest.clubCrests;
  const paint=(preserveCrest=false)=>{
   const markup=model.render(manifest,selected,language(),location.search);
   // Keep the existing header (and its loaded crest image) when switching club tabs.
   if(preserveCrest&&host.querySelector('.club-header')&&host.dataset.clubBase===selected.base){
    const staging=document.createElement('div');staging.innerHTML=markup;
    const currentHeader=host.querySelector('.club-header');
    staging.querySelector('.club-header').replaceWith(currentHeader);
    host.replaceChildren(...staging.childNodes);
   }else host.innerHTML=markup;
   host.dataset.clubBase=selected.base;
   for(const crest of host.querySelectorAll('.club-crest[data-club-crest]')){
    if(!Object.hasOwn(manifest.clubCrests,crest.dataset.clubCrest))crest.dataset.clubCrestFallback='true';
   }
   document.title=host.querySelector('h1').textContent+' · '+model.copies[language()][selected.view]+' — Football Architect';
   document.querySelector('.skip-link').textContent=model.copies[language()].skip;
   for(const link of host.querySelectorAll('a'))if(window.faAppHref)link.href=window.faAppHref(link.getAttribute('href'));
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
   });
   for(const link of links)link.addEventListener('keydown',event=>{
    const i=links.indexOf(link),n=links.length;
    const next={ArrowRight:(i+1)%n,ArrowLeft:(i+n-1)%n,Home:0,End:n-1}[event.key];
    if(next!==undefined){event.preventDefault();links[next].focus();}
   });
   document.documentElement.dataset.clubReady='true';
  };
  paint();
  // The app shell observes the same lang attribute; paint last to preserve the club title.
  new MutationObserver(()=>paint()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  window.addEventListener('popstate',()=>{
   const next=model.route(location.pathname);
   if(next&&next.base===selected.base){selected=next;paint(true);}
  });
  const crests=document.createElement('script');crests.src='/assets/club-crests.js';document.head.append(crests);
 }catch{
  host.replaceChildren();const message=document.createElement('p');
  message.setAttribute('role','alert');message.textContent=model.copies[language()].error;host.append(message);
 }
})();
