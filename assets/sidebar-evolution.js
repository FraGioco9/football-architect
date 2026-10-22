/* NAV-01: initialize static navigation before first paint; no career writes. */
(()=>{'use strict';const nav=document.querySelector('.fa-shell-nav[data-nav01-static]');if(!nav)return;
if(nav.dataset.nav01Bound==='true'){
 // The first-paint inline bootstrap has already bound an immediate click handler.
 // Capture user input before it reaches that handler, while preserving its static DOM.
 const button=nav.querySelector('.nav01-expand'),submenu=nav.querySelector('#nav01-children');
 if(button&&submenu&&!button.dataset.nav01Animated){
  button.dataset.nav01Animated='true';
  let motion=null;
  const toggle=()=>{
   const opening=button.getAttribute('aria-expanded')!=='true';
   const from=submenu.hidden?0:submenu.getBoundingClientRect().height;
   if(motion){motion.cancel();motion=null;submenu.classList.remove('nav01-is-animating');}
   button.setAttribute('aria-expanded',String(opening));
   const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
   if(reduced||!submenu.animate){submenu.hidden=!opening;submenu.classList.remove('nav01-is-animating');}
   else{
    submenu.hidden=false;
    const to=opening?submenu.scrollHeight:0;
    submenu.classList.add('nav01-is-animating');
    motion=submenu.animate([{height:from+'px',opacity:opening?0:1},{height:to+'px',opacity:opening?1:0}],{duration:320,easing:'cubic-bezier(.2,.75,.25,1)'});
    const current=motion;
    current.onfinish=()=>{if(motion!==current)return;submenu.hidden=!opening;submenu.classList.remove('nav01-is-animating');motion=null;};
   }
   try{sessionStorage.setItem('fa-nav01-expanded',String(opening));}catch{}
   window.faSidebarPaint?.();
  };
  button.addEventListener('click',event=>{event.stopImmediatePropagation();toggle();},true);
  // Native button click handles Enter and Space; do not synthesize a second activation.
 }
 for(const link of nav.querySelectorAll('a[href]'))if(window.faAppHref)link.href=window.faAppHref(link.getAttribute('href'));
 window.faSidebarPaint?.();return;
}
const lang={en:['World','Domestic','International','Explore','Clubs','Guide','Competitions'],de:['Welt','National','International','Entdecken','Vereine','Handbuch','Wettbewerbe'],es:['Mundo','Nacionales','Internacionales','Explorar','Clubes','Guía','Competiciones'],fr:['Monde','Nationales','Internationales','Explorer','Clubs','Guide','Compétitions'],it:['Mondo','Nazionali','Internazionali','Esplora','Club','Guida','Competizioni']};
const baseLabels={en:['Home','Dashboard','Calendar','Settings','Career pages'],de:['Start','Dashboard','Kalender','Einstellungen','Karriereseiten'],es:['Inicio','Panel','Calendario','Ajustes','Páginas de carrera'],fr:['Accueil','Tableau de bord','Calendrier','Paramètres','Pages de carrière'],it:['Inizio','Dashboard','Calendario','Impostazioni','Pagine della carriera']};
const expandLabels={en:'Expand world navigation',de:'Weltnavigation aufklappen',es:'Expandir navegación del mundo',fr:'Développer la navigation du monde',it:'Espandi navigazione del mondo'};
const collapseLabels={en:'Collapse world navigation',de:'Weltnavigation zuklappen',es:'Contraer navegación del mundo',fr:'Réduire la navigation du monde',it:'Comprimi navigazione del mondo'};
const button=nav.querySelector('.nav01-expand'),submenu=nav.querySelector('#nav01-children');
try{const saved=localStorage.getItem('football-architect:language');if(Object.hasOwn(lang,saved))document.documentElement.lang=saved;}catch{}
function paint(){
 const locale=Object.hasOwn(lang,document.documentElement.lang)?document.documentElement.lang:'en';
 nav.querySelectorAll('[data-nav01]').forEach(el=>el.textContent=lang[locale][+el.dataset.nav01]);
 document.querySelectorAll('[data-nav01-section]').forEach(el=>el.textContent=lang[locale][+el.dataset.nav01Section]);
 const pending={en:'International competition pages are being prepared.',de:'Die Seiten der internationalen Wettbewerbe werden vorbereitet.',es:'Las páginas de las competiciones internacionales están en preparación.',fr:'Les pages des compétitions internationales sont en préparation.',it:'Le pagine delle competizioni internazionali sono in preparazione.'};
 document.querySelectorAll('[data-nav01-pending]').forEach(el=>el.textContent=pending[locale]);
 const labels=baseLabels[locale];
 ['navHome','dashboard','calendar','settings'].forEach((key,i)=>nav.querySelectorAll('[data-app-i18n="'+key+'"]').forEach(el=>el.textContent=labels[i]));
 ['dashboard','calendar','settings'].forEach((key,i)=>nav.querySelector('[data-app-aria="'+key+'"]')?.setAttribute('aria-label',labels[i+1]));
 nav.setAttribute('aria-label',labels[4]);nav.querySelector('#app-nav-divisions').setAttribute('aria-label',lang[locale][6]);
 button.setAttribute('aria-label',(button.getAttribute('aria-expanded')==='true'?collapseLabels:expandLabels)[locale]);
}
const path=location.pathname.replace(/^\/app(?=\/)/,'').replace(/\/+$/,'');
const onCompetition=path==='/competitions'||path.startsWith('/competitions/');
const onClubs=path==='/clubs'||path.startsWith('/clubs/');
const selected=onClubs?nav.querySelector('[data-nav01-clubs]'):nav.querySelector('#app-nav-'+(onCompetition?'divisions':path==='/calendar'?'calendar':path==='/settings'?'settings':'dashboard'));
for(const link of nav.querySelectorAll('.fa-shell-link')){const active=link===selected;link.classList.toggle('is-active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
let opened=false;try{opened=sessionStorage.getItem('fa-nav01-expanded')==='true';}catch{}
let submenuMotion=null;
function expand(state,animate=false){
 const from=submenu.hidden?0:submenu.getBoundingClientRect().height;
 if(submenuMotion){submenuMotion.cancel();submenuMotion=null;submenu.classList.remove('nav01-is-animating');}
 button.setAttribute('aria-expanded',String(state));
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 if(!animate||reduced||!submenu.animate){
  submenu.hidden=!state;
 }else{
  submenu.hidden=false;
  const to=state?submenu.scrollHeight:0;
  submenu.classList.add('nav01-is-animating');
  submenuMotion=submenu.animate([
   {height:from+'px',opacity:state?0:1},
   {height:to+'px',opacity:state?1:0}
  ],{duration:260,easing:'cubic-bezier(.2,.75,.25,1)'});
  const current=submenuMotion;
  current.onfinish=()=>{if(submenuMotion!==current)return;submenu.hidden=!state;submenu.classList.remove('nav01-is-animating');submenuMotion=null;};
 }
 try{sessionStorage.setItem('fa-nav01-expanded',String(state));}catch{}
 paint();
}
button.addEventListener('click',()=>expand(button.getAttribute('aria-expanded')!=='true',true));
button.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();expand(button.getAttribute('aria-expanded')!=='true',true);}});
expand(onCompetition||opened);
const brand=document.querySelector('.fa-shell-sidebar .app-brand-symbol');if(brand){const source=brand.getAttribute('src');if(source)brand.setAttribute('src',source.replace(/-(?:dark|light)\.svg$/,'-'+(document.documentElement.dataset.theme==='light'?'light':'dark')+'.svg'));}
// Fragment targets live in the central scroll pane, not in the document viewport.
let fragmentFrame=0;
function alignFragment(){
 let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}if(!id)return;
 const pane=document.querySelector('.fa-shell-content-scroll'),target=document.getElementById(id);
 if(!pane||!target||!pane.contains(target))return;
 const padding=parseFloat(getComputedStyle(pane).scrollPaddingTop)||0;
 pane.scrollTo({top:pane.scrollTop+target.getBoundingClientRect().top-pane.getBoundingClientRect().top-pane.clientTop-padding,behavior:'instant'});
}
function syncFragment(){cancelAnimationFrame(fragmentFrame);fragmentFrame=requestAnimationFrame(alignFragment);}
window.faSidebarAlignFragment=alignFragment;
window.addEventListener('hashchange',syncFragment);
window.addEventListener('load',syncFragment,{once:true});window.addEventListener('pageshow',syncFragment);
document.addEventListener('DOMContentLoaded',syncFragment,{once:true});
nav.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link)return;const url=new URL(link.href,location.href);if(url.pathname===location.pathname&&url.hash)syncFragment();});
window.faSidebarPaint=paint;nav.dataset.nav01Bound='true';
new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});paint();
})();
