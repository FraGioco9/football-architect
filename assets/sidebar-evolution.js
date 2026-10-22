/* NAV-01: progressive sidebar extension; no career state writes. */(()=>{'use strict';const nav=document.querySelector('.fa-shell-nav');if(!nav)return;
const lang={en:['Competitions','Domestic','International','Football World','Clubs','Guide'],de:['Wettbewerbe','National','International','Fußballwelt','Vereine','Handbuch'],es:['Competiciones','Nacionales','Internacionales','Mundo del fútbol','Clubes','Guía'],fr:['Compétitions','Nationales','Internationales','Monde du football','Clubs','Guide'],it:['Competizioni','Nazionali','Internazionali','Mondo del calcio','Club','Guida']};
const world=nav.querySelector('#app-nav-world-title')?.closest('section');if(!world)return;
const old=world.querySelector('a');if(!old)return;old.classList.add('nav01-competition');
const submenu=document.createElement('div');submenu.className='nav01-children';submenu.id='nav01-children';submenu.innerHTML='<a href="/competitions#domestic" data-nav01="1"></a><a href="/competitions#international" data-nav01="2"></a>';
const row=document.createElement('div');row.className='nav01-row';old.before(row);row.append(old);
const button=document.createElement('button');button.type='button';button.className='nav01-expand';button.setAttribute('aria-controls','nav01-children');row.append(button);row.after(submenu);
const clubs=document.createElement('section');clubs.className='fa-shell-nav-group';clubs.innerHTML='<h2 class="fa-shell-nav-group-title" data-nav01="3"></h2><div class="fa-shell-nav-group-items"><a class="fa-shell-link" href="/clubs" data-nav01-clubs><svg class="fa-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"><path d="m12 2 8 4v6c0 5-3 8-8 10-5-2-8-5-8-10V6z"/></svg><span data-nav01="4"></span></a></div>';world.after(clubs);
const utility=nav.querySelector('.fa-shell-nav-secondary .fa-shell-nav-group-items');if(utility){const guide=document.createElement('a');guide.className='fa-shell-link';guide.href='/guide';guide.innerHTML='<svg class="fa-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"><path d="M12 6Q7 3 3 5v14q5-2 9 1 4-3 9-1V5q-5-2-9 1Zm0 0v14"/></svg><span data-nav01="5"></span>';utility.prepend(guide)}
const expandLabels={en:'Expand competitions',de:'Wettbewerbe aufklappen',es:'Expandir competiciones',fr:'Développer les compétitions',it:'Espandi competizioni'};
const collapseLabels={en:'Collapse competitions',de:'Wettbewerbe zuklappen',es:'Contraer competiciones',fr:'Réduire les compétitions',it:'Comprimi competizioni'};
function paint(){const words=lang[document.documentElement.lang]||lang.en;world.querySelector('h2').textContent=words[0];nav.querySelectorAll('[data-nav01]').forEach(el=>el.textContent=words[+el.dataset.nav01]);button.setAttribute('aria-label',(button.getAttribute('aria-expanded')==='true'?collapseLabels[document.documentElement.lang]||collapseLabels.en:expandLabels[document.documentElement.lang]||expandLabels.en));}
const onCompetition=/^\/(?:app\/)?competitions(?:\/|$)/.test(location.pathname);
const onClubs=/^\/(?:app\/)?clubs(?:\/|$)/.test(location.pathname);
const open=()=>{try{return sessionStorage.getItem('fa-nav01-expanded')==='true'}catch{return false}};
function expand(state){button.setAttribute('aria-expanded',String(state));submenu.hidden=!state;try{sessionStorage.setItem('fa-nav01-expanded',String(state))}catch{}paint()}
button.addEventListener('click',()=>expand(button.getAttribute('aria-expanded')!=='true'));expand(onCompetition||open());
const clubLink=clubs.querySelector('a');clubLink.classList.toggle('is-active',onClubs);if(onClubs)clubLink.setAttribute('aria-current','page');
if(onClubs){old.classList.remove('is-active');old.removeAttribute('aria-current')}
for(const a of nav.querySelectorAll('a[href]')){if(window.faAppHref)a.href=window.faAppHref(a.getAttribute('href'))}
new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});paint();})();