/* NAV-01: initialize static navigation before first paint; no career writes. */
(()=>{'use strict';const nav=document.querySelector('.fa-shell-nav[data-nav01-static]');if(!nav)return;
if(nav.dataset.nav01Bound==='true'){for(const link of nav.querySelectorAll('a[href]'))if(window.faAppHref)link.href=window.faAppHref(link.getAttribute('href'));window.faSidebarPaint?.();return;}
const lang={en:['World','Domestic','International','Explore','Clubs','Guide','Competitions','Players','Matches','History'],de:['Welt','National','International','Entdecken','Vereine','Handbuch','Wettbewerbe','Spieler','Spiele','Geschichte'],es:['Mundo','Nacionales','Internacionales','Explorar','Clubes','Guía','Competiciones','Jugadores','Partidos','Historia'],fr:['Monde','Nationales','Internationales','Explorer','Clubs','Guide','Compétitions','Joueurs','Matchs','Histoire'],it:['Mondo','Nazionali','Internazionali','Esplora','Club','Guida','Competizioni','Giocatori','Partite','Storia']};
const baseLabels={en:['Home','Dashboard','Calendar','Settings','Career pages'],de:['Start','Dashboard','Kalender','Einstellungen','Karriereseiten'],es:['Inicio','Panel','Calendario','Ajustes','Páginas de carrera'],fr:['Accueil','Tableau de bord','Calendrier','Paramètres','Pages de carrière'],it:['Inizio','Dashboard','Calendario','Impostazioni','Pagine della carriera']};
const expandLabels={en:'Expand world navigation',de:'Weltnavigation aufklappen',es:'Expandir navegación del mundo',fr:'Développer la navigation du monde',it:'Espandi navigazione del mondo'};
const collapseLabels={en:'Collapse world navigation',de:'Weltnavigation zuklappen',es:'Contraer navegación del mundo',fr:'Réduire la navigation du monde',it:'Comprimi navigazione del mondo'};
const button=nav.querySelector('.nav01-expand'),submenu=nav.querySelector('#nav01-children');
try{const saved=window.faAccountUI?.language||localStorage.getItem('football-architect:language');if(Object.hasOwn(lang,saved))document.documentElement.lang=saved;}catch{}
function paint(){
 const locale=Object.hasOwn(lang,document.documentElement.lang)?document.documentElement.lang:'en';
 nav.querySelectorAll('[data-nav01]').forEach(el=>el.textContent=lang[locale][+el.dataset.nav01]);
 document.querySelectorAll('[data-nav01-section]').forEach(el=>el.textContent=lang[locale][+el.dataset.nav01Section]);
 const pending={en:'International competition pages are being prepared.',de:'Die Seiten der internationalen Wettbewerbe werden vorbereitet.',es:'Las páginas de las competiciones internacionales están en preparación.',fr:'Les pages des compétitions internationales sont en préparation.',it:'Le pagine delle competizioni internazionali sono in preparazione.'};
 document.querySelectorAll('[data-nav01-pending]').forEach(el=>el.textContent=pending[locale]);
 const labels=baseLabels[locale];
 const profileLabels={en:'Profile',de:'Profil',es:'Perfil',fr:'Profil',it:'Profilo'};
 nav.querySelectorAll('[data-nav01-profile]').forEach(el=>el.textContent=profileLabels[locale]);
 nav.querySelector('#app-nav-profile')?.setAttribute('aria-label',profileLabels[locale]);
 ['navHome','dashboard','calendar','settings'].forEach((key,i)=>nav.querySelectorAll('[data-app-i18n="'+key+'"]').forEach(el=>el.textContent=labels[i]));
 ['dashboard','calendar','settings'].forEach((key,i)=>nav.querySelector('[data-app-aria="'+key+'"]')?.setAttribute('aria-label',labels[i+1]));
 nav.setAttribute('aria-label',labels[4]);nav.querySelector('#app-nav-divisions').setAttribute('aria-label',lang[locale][6]);
 button.setAttribute('aria-label',(button.getAttribute('aria-expanded')==='true'?collapseLabels:expandLabels)[locale]);
}
// Admin menu visibility is a same-tab UI hint, not privileged authorization.
function prepaintAdmin(){
 let expected=false;
 try{
  expected=sessionStorage.getItem('fa:admin:nav-visible:v1')==='1';
  if(!expected){
   const cached=JSON.parse(sessionStorage.getItem('fa:admin:permissions:v1')||'null');
   const p=cached?.permissions;
   expected=cached?.version===1&&Array.isArray(p)&&p.length<=64&&
    p.every(v=>typeof v==='string'&&/^[a-z][a-z0-9.-]{0,79}$/.test(v))&&
    p.includes('admin.access')&&p.includes('admin.world.read');
  }
 }catch{/* unknown state: no navigation hint */}
 if(!expected||nav.querySelector('#app-nav-admin'))return;
 const settings=nav.querySelector('#app-nav-settings');if(!settings)return;
 const link=document.createElement('a');link.id='app-nav-admin';link.className='fa-shell-link';link.href='/admin';
 link.innerHTML='<svg class="fa-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3 3 7v5c0 5 4 8 9 10 5-2 9-5 9-10V7Z M8 12l3 3 5-6"/></svg><span>Admin</span>';
 settings.after(link);
}
prepaintAdmin();
const path=location.pathname.replace(/^\/app(?=\/)/,'').replace(/\/+$/,'');
const onCompetition=path==='/competitions'||path.startsWith('/competitions/');
const onClubs=path==='/clubs'||path.startsWith('/clubs/');
const onPlayers=path==='/players'||/^\/players\/[1-9][0-9]*$/.test(path);
const selected=path==='/history'?nav.querySelector('[data-nav01-history]'):onPlayers?nav.querySelector('[data-nav01-players]'):path==='/matches'?nav.querySelector('[data-nav01-matches]'):onClubs?nav.querySelector('[data-nav01-clubs]'):nav.querySelector('#app-nav-'+(onCompetition?'divisions':path==='/calendar'?'calendar':path==='/settings'?'settings':(path==='/admin'||path.startsWith('/admin/'))?'admin':(path==='/account'||path.startsWith('/account/'))?'profile':'dashboard'));
for(const link of nav.querySelectorAll('.fa-shell-link')){const active=link===selected;link.classList.toggle('is-active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
let opened=false;try{opened=sessionStorage.getItem('fa-nav01-expanded')==='true';}catch{}
function expand(state){button.setAttribute('aria-expanded',String(state));submenu.hidden=!state;try{sessionStorage.setItem('fa-nav01-expanded',String(state));}catch{}paint();}
button.addEventListener('click',()=>expand(button.getAttribute('aria-expanded')!=='true'));
button.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();expand(button.getAttribute('aria-expanded')!=='true');}});
expand(opened);
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
