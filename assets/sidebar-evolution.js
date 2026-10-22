/* NAV-01: initialize static navigation before first paint; no career writes. */
(()=>{'use strict';const nav=document.querySelector('.fa-shell-nav[data-nav01-static]');if(!nav)return;
if(nav.dataset.nav01Bound==='true'){for(const link of nav.querySelectorAll('a[href]'))if(window.faAppHref)link.href=window.faAppHref(link.getAttribute('href'));window.faSidebarPaint?.();return;}
const lang={en:['Competitions','Domestic','International','Football World','Clubs','Guide'],de:['Wettbewerbe','National','International','Fußballwelt','Vereine','Handbuch'],es:['Competiciones','Nacionales','Internacionales','Mundo del fútbol','Clubes','Guía'],fr:['Compétitions','Nationales','Internationales','Monde du football','Clubs','Guide'],it:['Competizioni','Nazionali','Internazionali','Mondo del calcio','Club','Guida']};
const baseLabels={en:['Home','Dashboard','Calendar','Settings','Career pages'],de:['Start','Dashboard','Kalender','Einstellungen','Karriereseiten'],es:['Inicio','Panel','Calendario','Ajustes','Páginas de carrera'],fr:['Accueil','Tableau de bord','Calendrier','Paramètres','Pages de carrière'],it:['Inizio','Dashboard','Calendario','Impostazioni','Pagine della carriera']};
const expandLabels={en:'Expand competitions',de:'Wettbewerbe aufklappen',es:'Expandir competiciones',fr:'Développer les compétitions',it:'Espandi competizioni'};
const collapseLabels={en:'Collapse competitions',de:'Wettbewerbe zuklappen',es:'Contraer competiciones',fr:'Réduire les compétitions',it:'Comprimi competizioni'};
const button=nav.querySelector('.nav01-expand'),submenu=nav.querySelector('#nav01-children');
try{const saved=localStorage.getItem('football-architect:language');if(Object.hasOwn(lang,saved))document.documentElement.lang=saved;}catch{}
function paint(){
 const locale=Object.hasOwn(lang,document.documentElement.lang)?document.documentElement.lang:'en';
 nav.querySelectorAll('[data-nav01]').forEach(el=>el.textContent=lang[locale][+el.dataset.nav01]);
 const labels=baseLabels[locale];
 ['navHome','dashboard','calendar','settings'].forEach((key,i)=>nav.querySelectorAll('[data-app-i18n="'+key+'"]').forEach(el=>el.textContent=labels[i]));
 ['dashboard','calendar','settings'].forEach((key,i)=>nav.querySelector('[data-app-aria="'+key+'"]')?.setAttribute('aria-label',labels[i+1]));
 nav.querySelectorAll('[data-app-i18n="navCompetitions"]').forEach(el=>el.textContent=lang[locale][0]);
 nav.setAttribute('aria-label',labels[4]);nav.querySelector('#app-nav-divisions').setAttribute('aria-label',lang[locale][0]);
 button.setAttribute('aria-label',(button.getAttribute('aria-expanded')==='true'?collapseLabels:expandLabels)[locale]);
}
const path=location.pathname.replace(/^\/app(?=\/)/,'').replace(/\/+$/,'');
const onCompetition=path==='/competitions'||path.startsWith('/competitions/');
const onClubs=path==='/clubs'||path.startsWith('/clubs/');
const selected=onClubs?nav.querySelector('[data-nav01-clubs]'):nav.querySelector('#app-nav-'+(onCompetition?'divisions':path==='/calendar'?'calendar':path==='/settings'?'settings':'dashboard'));
for(const link of nav.querySelectorAll('.fa-shell-link')){const active=link===selected;link.classList.toggle('is-active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
let opened=false;try{opened=sessionStorage.getItem('fa-nav01-expanded')==='true';}catch{}
function expand(state){button.setAttribute('aria-expanded',String(state));submenu.hidden=!state;try{sessionStorage.setItem('fa-nav01-expanded',String(state));}catch{}paint();}
button.addEventListener('click',()=>expand(button.getAttribute('aria-expanded')!=='true'));
button.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();expand(button.getAttribute('aria-expanded')!=='true');}});
expand(onCompetition||opened);
const brand=document.querySelector('.fa-shell-sidebar .app-brand-symbol');if(brand){const source=brand.getAttribute('src');if(source)brand.setAttribute('src',source.replace(/-(?:dark|light)\.svg$/,'-'+(document.documentElement.dataset.theme==='light'?'light':'dark')+'.svg'));}
window.faSidebarPaint=paint;nav.dataset.nav01Bound='true';
new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});paint();
})();
