/* Calendar UX simplification: presentation-only enhancements; no simulation writes. */
(()=>{
 'use strict';
 const root=document.getElementById('world-calendar');
 if(!root)return;
 const locales={
  en:{season:'Season',week:'Week',currentWeek:'Current week',day:'Day',national:'Domestic round',international:'International round',postseason:'Playoffs / playouts · leg',competitions:'Competitions',pending:'Fixtures and results are not yet available.',preseason:'Preseason',transition:'Season transition',empty:'No official events.'},
  de:{season:'Saison',week:'Woche',currentWeek:'Aktuelle Woche',day:'Tag',national:'Nationaler Spieltag',international:'Internationale Runde',postseason:'Playoffs / Playdowns · Spiel',competitions:'Wettbewerbe',pending:'Spielplan und Ergebnisse sind noch nicht verfügbar.',preseason:'Vorbereitung',transition:'Saisonübergang',empty:'Keine offiziellen Ereignisse.'},
  es:{season:'Temporada',week:'Semana',currentWeek:'Semana actual',day:'Día',national:'Jornada nacional',international:'Ronda internacional',postseason:'Playoffs / permanencia · partido',competitions:'Competiciones',pending:'Los partidos y resultados aún no están disponibles.',preseason:'Pretemporada',transition:'Transición de temporada',empty:'Sin eventos oficiales.'},
  fr:{season:'Saison',week:'Semaine',currentWeek:'Semaine actuelle',day:'Jour',national:'Journée nationale',international:'Tour international',postseason:'Playoffs / barrages · manche',competitions:'Compétitions',pending:'Rencontres et résultats pas encore disponibles.',preseason:'Pré-saison',transition:'Transition de saison',empty:'Aucun événement officiel.'},
  it:{season:'Stagione',week:'Settimana',currentWeek:'Settimana attuale',day:'Giorno',national:'Giornata nazionale',international:'Turno internazionale',postseason:'Playoff / playout · gara',competitions:'Competizioni',pending:'Calendario partite e risultati non ancora disponibili.',preseason:'Prestagione',transition:'Transizione di stagione',empty:'Nessun evento ufficiale.'}
 };
 const t=()=>locales[document.documentElement.lang]||locales.en;
 const seasonKey='football-architect:standings-dev-season';
 const dev=window.faDevCalendarClockSnapshot?.source?.kind==='dev';
 const heading=root.querySelector('.calendar-heading');
 const selector=document.querySelector('#app-calendar > .calendar-season-picker')||document.createElement('div');
 selector.className='calendar-season-picker app-competition-season';
 if(!selector.hasChildNodes())selector.innerHTML='<span id="calendar-season-label">Season</span><div class="language-control" id="calendar-season-control"><button type="button" id="calendar-season-picker" class="language-trigger" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="calendar-season-menu" aria-labelledby="calendar-season-label calendar-season-value"><span id="calendar-season-value">1</span><svg class="language-chevron" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div id="calendar-season-menu" class="language-menu" role="listbox" aria-labelledby="calendar-season-label" hidden></div></div>';
 const trigger=selector.querySelector('#calendar-season-picker'),menu=selector.querySelector('#calendar-season-menu'),value=selector.querySelector('#calendar-season-value');
 document.getElementById('calendar-title')?.after(selector);
 function closeMenu(){menu.hidden=true;trigger.setAttribute('aria-expanded','false')}
 function chooseSeason(n){selectedSeason=n;queueMicrotask(updateCurrentDay);const url=new URL(location.href);url.search='?'+new URLSearchParams({season:String(n),calendarView:document.documentElement.dataset.calendarView==='week'?'week':'season'});history.replaceState(history.state,'',url);updateSeason();closeMenu();trigger.focus()}
 trigger.addEventListener('click',()=>{menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden))});
 document.addEventListener('pointerdown',e=>{if(!selector.contains(e.target))closeMenu()});
 trigger.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();chooseSeason(Math.max(1,Math.min(dev?readDebugSeason():1,selectedSeason+(e.key==='ArrowDown'?1:-1))))}});
 menu.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();trigger.focus()}});
 const readDebugSeason=()=>{try{const n=Number(sessionStorage.getItem(seasonKey));return Number.isInteger(n)&&n>=1&&n<=4?n:1}catch{return 1}};
 let selectedSeason=1;
 window.faCalendarSelectedSeason=()=>selectedSeason;
 const validSeason=n=>Number.isInteger(n)&&n>=1&&n<=(dev?readDebugSeason():1);
 function syncCalendarLink(){const mode=document.documentElement.dataset.calendarView==="week"?"week":"season";const route="/calendar?season="+selectedSeason+"&calendarView="+mode;document.getElementById("app-nav-calendar")?.setAttribute("href",window.faAppHref?.(route)||route)}
 function updateSeason(){
  const limit=dev?readDebugSeason():1;
  const params=new URL(location.href).searchParams;
  const requested=Number(params.get('season'));
  if(params.has('season')&&validSeason(requested))selectedSeason=requested;
  else {selectedSeason=limit;const url=new URL(location.href);url.searchParams.set('season',String(limit));url.searchParams.delete('day');history.replaceState(history.state,'',url)}
  const canonical=new URL(location.href);canonical.search='?'+new URLSearchParams({season:String(selectedSeason),calendarView:document.documentElement.dataset.calendarView==='week'?'week':'season'});if(location.pathname+location.search!==canonical.pathname+canonical.search)history.replaceState(history.state,'',canonical);
  root.dataset.seasonInitialized='true';
  menu.replaceChildren();
  for(let n=limit;n>=1;n--){const option=document.createElement('div');option.className='language-option';option.role='option';option.dataset.menuValue=String(n);option.textContent=String(n);option.setAttribute('aria-selected',String(n===selectedSeason));option.tabIndex=0;option.addEventListener('click',()=>chooseSeason(n));option.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseSeason(n)}});menu.append(option)}
  value.textContent=String(selectedSeason);
  selector.querySelector('#calendar-season-label').textContent=t().season;
  root.dataset.season=String(selectedSeason);
  syncCalendarLink();
  if(typeof updateCurrentDay==='function')updateCurrentDay();
  window.faCalendarSyncWeek?.();
 }

 window.addEventListener('fa:dev-progress-change',updateSeason);
 window.addEventListener('popstate',updateSeason);
 // A day is never a permanent route or selection.
 if(new URL(location.href).searchParams.has('day')){const url=new URL(location.href);url.searchParams.delete('day');history.replaceState(history.state,'',url)}
 updateSeason();
 // Fixtures-style week navigation: arrows, menu and current-week shortcut.
 const weekControls=document.getElementById('calendar-controls');
 if(weekControls){
  weekControls.classList.add('app-fixtures-navigation');
  const toolbar=root.querySelector('.calendar-toolbar');
  if(toolbar&&weekControls.previousElementSibling!==toolbar)toolbar.after(weekControls);
  const prev=document.getElementById('calendar-previous'),next=document.getElementById('calendar-next'),label=document.getElementById('calendar-week-label');
  for(const arrow of [prev,next]){arrow.classList.add('language-trigger','app-fixtures-arrow');arrow.classList.remove('app-fixtures-current');arrow.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(arrow===prev?'m14 6-6 6 6 6':'m10 6 6 6-6 6')+'"/></svg>'}
  const wrap=weekControls.querySelector('.app-fixtures-select')||document.createElement('div');wrap.className='language-control app-fixtures-select';
  if(!wrap.querySelector('#calendar-week-trigger'))wrap.innerHTML='<button type="button" class="language-trigger app-fixtures-trigger" id="calendar-week-trigger" role="combobox" aria-haspopup="listbox" aria-controls="calendar-week-menu" aria-expanded="false"><span id="calendar-week-value">Week 1</span><svg class="language-chevron" width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="language-menu" id="calendar-week-menu" role="listbox" hidden></div>';
  const weekTrigger=wrap.querySelector('#calendar-week-trigger'),weekMenu=wrap.querySelector('#calendar-week-menu'),weekValue=wrap.querySelector('#calendar-week-value');
  const current=document.getElementById('calendar-current-week')||document.createElement('button');current.type='button';current.id='calendar-current-week';current.className='language-trigger app-fixtures-current';current.setAttribute('aria-label','Current week');current.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6"/></svg><span>Current week</span>';
  const currentWeek=()=>{try{const n=Number(sessionStorage.getItem('football-architect:calendar-dev-world-day'));return Math.ceil((Number.isInteger(n)&&n>=1&&n<=56?n:1)/7)}catch{return 1}};
  const jump=n=>{window.faWorldCalendar?.setWeek(n);closeWeek();syncWeek()};
  const closeWeek=()=>{weekMenu.hidden=true;weekTrigger.setAttribute('aria-expanded','false')};
  weekTrigger.addEventListener('click',()=>{weekMenu.hidden=!weekMenu.hidden;weekTrigger.setAttribute('aria-expanded',String(!weekMenu.hidden))});
  weekTrigger.addEventListener('keydown',e=>{
   if(e.key==='Escape'){closeWeek();return}
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();weekMenu.hidden=false;weekTrigger.setAttribute('aria-expanded','true');const entries=[...weekMenu.children];const active=entries.findIndex(o=>o.dataset.menuValue===String(Number(document.documentElement.dataset.calendarWeek)||1));entries[Math.max(0,Math.min(entries.length-1,active+(e.key==='ArrowDown'?1:-1)))].focus()}
  });
  document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))closeWeek()});
  for(let n=1;n<=8;n++){const option=document.createElement('div');option.className='language-option';option.role='option';option.dataset.menuValue=String(n);option.tabIndex=0;option.textContent='Week '+n;option.addEventListener('click',()=>jump(n));option.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();jump(n)}if(e.key==='Escape'){closeWeek();weekTrigger.focus()}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const focus=Number(option.dataset.menuValue)+(e.key==='ArrowDown'?1:-1);weekMenu.querySelector('[data-menu-value="'+Math.max(1,Math.min(8,focus))+'"]')?.focus()}});weekMenu.append(option)}
  current.addEventListener('click',()=>jump(currentWeek()));
  label.hidden=true;if(wrap.parentElement!==weekControls)prev.after(wrap);if(current.parentElement!==weekControls)next.after(current);
  const syncControls=()=>{const showing=document.documentElement.dataset.calendarView==='week';weekControls.hidden=!showing;weekControls.style.display=showing?'flex':'none';syncWeek()};
  new MutationObserver(()=>{syncControls();syncCalendarLink()}).observe(document.documentElement,{attributes:true,attributeFilter:['data-calendar-view','data-calendar-week']});
  for(const mode of ['calendar-season','calendar-week'])document.getElementById(mode)?.addEventListener('click',()=>queueMicrotask(syncControls));
  function syncWeek(){
   const state=window.faWorldCalendar?.getSelection?.();
   const shown=state?.view==='week';
   const week=shown?Math.ceil(state.day/7):(Number(document.documentElement.dataset.calendarWeek)||1);
   const showShortcut=shown&&dev&&selectedSeason===readDebugSeason()&&week!==currentWeek();
   weekValue.textContent=t().week+' '+week;
   current.querySelector('span').textContent=t().currentWeek;
   current.setAttribute('aria-label',t().currentWeek);
   current.hidden=!showShortcut;
   current.disabled=!showShortcut;
   for(const option of weekMenu.children){option.textContent=t().week+' '+option.dataset.menuValue;option.setAttribute('aria-selected',String(Number(option.dataset.menuValue)===week))}
  }
  window.faCalendarSyncWeek=syncWeek;
  for(const a of [prev,next])a.addEventListener('click',()=>queueMicrotask(syncWeek));
  window.addEventListener('popstate',()=>queueMicrotask(()=>{syncWeek();syncCalendarLink()}));
  window.addEventListener('fa:dev-progress-change',()=>queueMicrotask(syncWeek));
  syncControls();
 }
 document.documentElement.dataset.calendarUiReady='true';
 const dialog=document.createElement('dialog');
 dialog.id='calendar-event-dialog';
 dialog.className='calendar-event-dialog app-search-dialog';
 dialog.setAttribute('aria-labelledby','calendar-event-dialog-title');
 dialog.innerHTML='<div class="calendar-event-panel app-search-panel"><button type="button" class="calendar-event-close app-search-close" aria-label="Close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button><h2 id="calendar-event-dialog-title"></h2><p id="calendar-event-dialog-subtitle"></p><div id="calendar-event-dialog-details"></div></div>';
 document.body.append(dialog);
 const closeButton=dialog.querySelector('.calendar-event-close');
 let previousFocus=null,closingTimer=null,escapeReturn=false,backdropStart=null,validBackdropClick=false,keyboardOpen=false;
 const resetPointer=()=>{backdropStart=null;validBackdropClick=false};
 const finishClose=()=>{if(closingTimer!==null)clearTimeout(closingTimer);closingTimer=null;resetPointer();dialog.classList.remove('is-closing');if(dialog.open)dialog.close()};
 const requestClose=(fromEscape=false)=>{
  if(!dialog.open||closingTimer!==null)return;
  escapeReturn=fromEscape;
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){finishClose();return}
  dialog.classList.add('is-closing');closingTimer=setTimeout(finishClose,150);
 };
 closeButton.addEventListener('click',()=>requestClose());
 dialog.addEventListener('keydown',event=>{if(event.key!=='Escape')return;event.preventDefault();event.stopPropagation();requestClose(true)},true);
 dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose(true)});
 dialog.addEventListener('pointerdown',event=>{validBackdropClick=false;backdropStart=event.target===dialog?{id:event.pointerId,x:event.clientX,y:event.clientY}:null});
 dialog.addEventListener('pointermove',event=>{if(backdropStart&&(event.pointerId!==backdropStart.id||event.target!==dialog||Math.hypot(event.clientX-backdropStart.x,event.clientY-backdropStart.y)>8))backdropStart=null});
 dialog.addEventListener('pointerup',event=>{validBackdropClick=!!backdropStart&&event.target===dialog&&event.pointerId===backdropStart.id&&Math.hypot(event.clientX-backdropStart.x,event.clientY-backdropStart.y)<=8;backdropStart=null});
 dialog.addEventListener('pointercancel',resetPointer);
 dialog.addEventListener('click',event=>{const outside=event.target===dialog&&validBackdropClick;validBackdropClick=false;if(outside)requestClose()});
 dialog.addEventListener('close',()=>{resetPointer();if(closingTimer!==null)clearTimeout(closingTimer);closingTimer=null;dialog.classList.remove('is-closing');if(previousFocus?.isConnected){if(escapeReturn&&!keyboardOpen)previousFocus.classList.add('app-search-escape-return');else previousFocus.classList.remove('app-search-escape-return');previousFocus.focus({preventScroll:true})}escapeReturn=false});
 root.addEventListener('focusout',event=>event.target?.classList?.remove('app-search-escape-return'));
 const names=()=>({national:t().national,international:t().international});
 const tooltip=document.createElement('div');tooltip.className='calendar-marker-tooltip';tooltip.hidden=true;tooltip.setAttribute('role','tooltip');document.body.append(tooltip);
 const dayModel=window.faWorldCalendarModel?.createSeason(1).days||[];
 const displayMarker=e=>e.phase==='final'?'F':e.family==='national'&&e.phase==='postseason'?'P'+String(e.round-30).padStart(2,'0'):e.marker;
 const namesFor=e=>e.family==='national'&&e.phase==='postseason'?t().postseason+' '+(e.round-30):e.phase==='final'?(e.marker==='FEDERATION-FINAL'?'Federation Cup final':'Sovereign Cup final'):(names()[e.family]||e.family)+' '+e.round;
 function showDay(day,focus){
  const n=Number(day.dataset.calendarDay),data=dayModel[n-1];if(!data)return;
  tooltip.hidden=true;previousFocus=focus||day;keyboardOpen=Boolean(previousFocus?.matches?.(':focus-visible'));
  previousFocus?.classList?.remove('app-search-escape-return');
  dialog.querySelector('#calendar-event-dialog-title').textContent=t().day+' '+n;
  dialog.querySelector('#calendar-event-dialog-subtitle').hidden=true;
  const body=dialog.querySelector('#calendar-event-dialog-details');body.replaceChildren();
  if(!data.events.length){const p=document.createElement('p');p.textContent=data.kind==='preseason'?t().preseason:data.kind==='transition'?t().transition:t().empty;body.append(p)}
  for(const event of data.events){
   const row=document.createElement('div'),code=document.createElement('strong'),description=document.createElement('span');
   row.className='calendar-event-summary';code.className='calendar-event-code';code.dataset.eventType=event.phase==='final'?'final':event.phase==='postseason'?'postseason':event.family;description.className='calendar-event-description';
   code.textContent=displayMarker(event);description.textContent=namesFor(event);
   row.append(code,description);body.append(row);
  }
  if(!dialog.open&&closingTimer===null){dialog.showModal();if(keyboardOpen)closeButton.focus({preventScroll:true});else {dialog.tabIndex=-1;dialog.focus({preventScroll:true})}}
 }
 window.faCalendarShowDay=day=>showDay(day,day);
 new MutationObserver(()=>{updateSeason();window.faCalendarSyncWeek?.()}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 function placeTooltip(element){const bounds=element.getBoundingClientRect();tooltip.hidden=false;const w=tooltip.offsetWidth;tooltip.style.left=Math.max(10,Math.min(innerWidth-w-10,bounds.left+bounds.width/2-w/2))+'px';tooltip.style.top=(bounds.bottom+10+tooltip.offsetHeight<innerHeight?bounds.bottom+8:Math.max(8,bounds.top-tooltip.offsetHeight-8))+'px'}
 for(const marker of root.querySelectorAll('.calendar-event')){
  const day=marker.closest('[data-calendar-day]'),data=dayModel[Number(day?.dataset.calendarDay)-1];
  const event=data?.events.find(e=>e.marker===marker.dataset.calendarMarker);if(!event)continue;
  const description=namesFor(event);
  if(event.family==='national'&&event.phase==='postseason'){
   marker.textContent=displayMarker(event);
   marker.classList.add('calendar-event--postseason');
  }
  marker.removeAttribute('title');
  marker.setAttribute('aria-label',description);
  marker.addEventListener('pointerenter',()=>{tooltip.textContent=description;placeTooltip(marker)});
  marker.addEventListener('pointerleave',()=>{tooltip.hidden=true});
  marker.addEventListener('focusin',()=>{tooltip.textContent=namesFor(event);placeTooltip(marker)});
  marker.addEventListener('focusout',()=>{tooltip.hidden=true});
  marker.addEventListener('click',()=>{tooltip.hidden=true});
 }
 function currentDay(){try{const n=Number(sessionStorage.getItem('football-architect:calendar-dev-world-day'));return Number.isInteger(n)&&n>=1&&n<=56?n:1}catch{return 1}}
 function updateCurrentDay(){const n=dev&&selectedSeason===readDebugSeason()?currentDay():0;for(const cell of root.querySelectorAll('[data-calendar-day]')){const current=Number(cell.dataset.calendarDay)===n;if(current){cell.dataset.devCurrentDay='true';cell.setAttribute('aria-current','true')}else{delete cell.dataset.devCurrentDay;cell.removeAttribute('aria-current')}}document.querySelector('style[data-calendar-dev-highlight]')?.remove()}
 window.addEventListener('fa:dev-world-day-change',()=>{updateCurrentDay();window.faCalendarSyncWeek?.()});
 updateCurrentDay();
})();
