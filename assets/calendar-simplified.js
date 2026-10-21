/* Calendar UX simplification: presentation-only enhancements; no simulation writes. */
(()=>{
 'use strict';
 const root=document.getElementById('world-calendar');
 if(!root)return;
 const seasonKey='football-architect:standings-dev-season';
 const dev=window.faDevCalendarClockSnapshot?.source?.kind==='dev';
 const heading=root.querySelector('.calendar-heading');
 const selector=document.createElement('div');
 selector.className='calendar-season-picker app-competition-season';
 selector.innerHTML='<span id="calendar-season-label">Season</span><div class="language-control" id="calendar-season-control"><button type="button" id="calendar-season-picker" class="language-trigger" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="calendar-season-menu" aria-labelledby="calendar-season-label calendar-season-value"><span id="calendar-season-value">1</span><svg class="language-chevron" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div id="calendar-season-menu" class="language-menu" role="listbox" aria-labelledby="calendar-season-label" hidden></div></div>';
 const trigger=selector.querySelector('#calendar-season-picker'),menu=selector.querySelector('#calendar-season-menu'),value=selector.querySelector('#calendar-season-value');
 document.getElementById('calendar-title')?.after(selector);
 function closeMenu(){menu.hidden=true;trigger.setAttribute('aria-expanded','false')}
 function chooseSeason(n){selectedSeason=n;queueMicrotask(updateCurrentDay);const url=new URL(location.href);url.searchParams.set('season',String(n));url.searchParams.delete('day');history.replaceState(history.state,'',url);updateSeason();closeMenu();trigger.focus()}
 trigger.addEventListener('click',()=>{menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden))});
 document.addEventListener('pointerdown',e=>{if(!selector.contains(e.target))closeMenu()});
 trigger.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();chooseSeason(Math.max(1,Math.min(dev?readDebugSeason():1,selectedSeason+(e.key==='ArrowDown'?1:-1))))}});
 menu.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();trigger.focus()}});
 const readDebugSeason=()=>{try{const n=Number(sessionStorage.getItem(seasonKey));return Number.isInteger(n)&&n>=1&&n<=4?n:1}catch{return 1}};
 let selectedSeason=1;
 window.faCalendarSelectedSeason=()=>selectedSeason;
 const validSeason=n=>Number.isInteger(n)&&n>=1&&n<=(dev?readDebugSeason():1);
 function syncCalendarLink(){const mode=document.documentElement.dataset.calendarView==="week"?"week":"season";const route="/calendar?season="+selectedSeason+"&calendarView="+mode;try{sessionStorage.setItem("football-architect:calendar-route",route)}catch{}document.getElementById("app-nav-calendar")?.setAttribute("href",window.faAppHref?.(route)||route)}
 function updateSeason(){
  const limit=dev?readDebugSeason():1;
  const params=new URL(location.href).searchParams;
  const requested=Number(params.get('season'));
  if(validSeason(requested))selectedSeason=requested;
  else if(params.has('season')||selectedSeason>limit){selectedSeason=limit;const url=new URL(location.href);url.searchParams.set('season',String(limit));url.searchParams.delete('day');history.replaceState(history.state,'',url)}
  else if(!params.has('season')&&!root.dataset.seasonInitialized)selectedSeason=limit;
  root.dataset.seasonInitialized='true';
  menu.replaceChildren();
  for(let n=limit;n>=1;n--){const option=document.createElement('div');option.className='language-option';option.role='option';option.dataset.menuValue=String(n);option.textContent=String(n);option.setAttribute('aria-selected',String(n===selectedSeason));option.tabIndex=0;option.addEventListener('click',()=>chooseSeason(n));option.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseSeason(n)}});menu.append(option)}
  value.textContent=String(selectedSeason);
  root.dataset.season=String(selectedSeason);
  syncCalendarLink();
  if(typeof updateCurrentDay==='function')updateCurrentDay();
 }

 window.addEventListener('fa:dev-progress-change',()=>{updateSeason();updateCurrentDay()});
 window.addEventListener('popstate',updateSeason);
 // A day is never a permanent route or selection.
 if(new URL(location.href).searchParams.has('day')){const url=new URL(location.href);url.searchParams.delete('day');history.replaceState(history.state,'',url)}
 updateSeason();
 // Fixtures-style week navigation: arrows, menu and current-week shortcut.
 const weekControls=document.getElementById('calendar-controls');
 if(weekControls){
  weekControls.classList.add('app-fixtures-navigation');
  const toolbar=root.querySelector('.calendar-toolbar');
  toolbar?.after(weekControls);
  const prev=document.getElementById('calendar-previous'),next=document.getElementById('calendar-next'),label=document.getElementById('calendar-week-label');
  for(const arrow of [prev,next]){arrow.classList.add('language-trigger','app-fixtures-arrow');arrow.classList.remove('app-fixtures-current');arrow.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(arrow===prev?'m14 6-6 6 6 6':'m10 6 6 6-6 6')+'"/></svg>'}
  const wrap=document.createElement('div');wrap.className='language-control app-fixtures-select';
  wrap.innerHTML='<button type="button" class="language-trigger app-fixtures-trigger" id="calendar-week-trigger" role="combobox" aria-haspopup="listbox" aria-controls="calendar-week-menu" aria-expanded="false"><span id="calendar-week-value">Week 1</span><svg class="language-chevron" width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="language-menu" id="calendar-week-menu" role="listbox" hidden></div>';
  const weekTrigger=wrap.querySelector('#calendar-week-trigger'),weekMenu=wrap.querySelector('#calendar-week-menu'),weekValue=wrap.querySelector('#calendar-week-value');
  const current=document.createElement('button');current.type='button';current.id='calendar-current-week';current.className='language-trigger app-fixtures-current';current.setAttribute('aria-label','Current week');current.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6"/></svg><span>Current week</span>';
  const currentWeek=()=>{try{const n=Number(sessionStorage.getItem('football-architect:calendar-dev-world-day'));return Math.ceil((Number.isInteger(n)&&n>=1&&n<=56?n:1)/7)}catch{return 1}};
  const jump=n=>{window.faWorldCalendar?.setWeek(n);closeWeek();syncWeek()};
  const closeWeek=()=>{weekMenu.hidden=true;weekTrigger.setAttribute('aria-expanded','false')};
  weekTrigger.addEventListener('click',()=>{weekMenu.hidden=!weekMenu.hidden;weekTrigger.setAttribute('aria-expanded',String(!weekMenu.hidden))});
  weekTrigger.addEventListener('keydown',e=>{if(e.key==='Escape')closeWeek()});
  document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))closeWeek()});
  for(let n=1;n<=8;n++){const option=document.createElement('div');option.className='language-option';option.role='option';option.dataset.menuValue=String(n);option.tabIndex=0;option.textContent='Week '+n;option.addEventListener('click',()=>jump(n));option.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();jump(n)}if(e.key==='Escape')closeWeek()});weekMenu.append(option)}
  current.addEventListener('click',()=>jump(currentWeek()));
  label.hidden=true;prev.after(wrap);next.after(current);
  const syncControls=()=>{const showing=document.documentElement.dataset.calendarView==='week';weekControls.hidden=!showing;weekControls.style.display=showing?'flex':'none';syncWeek()};
  new MutationObserver(()=>{syncControls();syncCalendarLink()}).observe(document.documentElement,{attributes:true,attributeFilter:['data-calendar-view','data-calendar-week']});
  for(const mode of ['calendar-season','calendar-week'])document.getElementById(mode)?.addEventListener('click',()=>queueMicrotask(syncControls));
  function syncWeek(){const n=Number(document.documentElement.dataset.calendarWeek)||1;weekValue.textContent='Week '+n;for(const o of weekMenu.children)o.setAttribute('aria-selected',String(Number(o.dataset.menuValue)===n));current.hidden=!dev||Number(root.dataset.season)!==readDebugSeason()||n===currentWeek();current.disabled=!dev}
  for(const a of [prev,next])a.addEventListener('click',()=>queueMicrotask(syncWeek));
  window.addEventListener('popstate',()=>queueMicrotask(()=>{syncWeek();syncCalendarLink()}));
  window.addEventListener('fa:dev-progress-change',()=>queueMicrotask(syncWeek));
  syncControls();
 }
 const dialog=document.createElement('dialog');
 dialog.id='calendar-event-dialog';
 dialog.className='calendar-event-dialog';
 dialog.setAttribute('aria-labelledby','calendar-event-dialog-title');
 dialog.innerHTML='<div class="calendar-event-panel"><button type="button" class="calendar-event-close" aria-label="Close">×</button><h2 id="calendar-event-dialog-title"></h2><p id="calendar-event-dialog-subtitle"></p><div id="calendar-event-dialog-details"></div></div>';
 document.body.append(dialog);
 const close=dialog.querySelector('.calendar-event-close');
 close.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
 let previousFocus;
 dialog.addEventListener('close',()=>previousFocus?.focus?.());
 const names={national:'Domestic round',international:'International round'};
 const tooltip=document.createElement('div');tooltip.className='calendar-marker-tooltip';tooltip.hidden=true;tooltip.setAttribute('role','tooltip');document.body.append(tooltip);
 const dayModel=window.faWorldCalendarModel?.createSeason(1).days||[];
 const displayMarker=e=>e.family==='national'&&e.phase==='postseason'?'P'+String(e.round-30).padStart(2,'0'):e.marker;
 const namesFor=e=>e.family==='national'&&e.phase==='postseason'?'Playoffs / playouts · leg '+(e.round-30):e.phase==='final'?(e.marker==='FEDERATION-FINAL'?'Federation Cup final':'Sovereign Cup final'):(names[e.family]||e.family)+' '+e.round;
 function showDay(day,focus){
  const n=Number(day.dataset.calendarDay),data=dayModel[n-1];if(!data)return;
  tooltip.hidden=true;previousFocus=focus||day;
  dialog.querySelector('#calendar-event-dialog-title').textContent='Day '+n;
  dialog.querySelector('#calendar-event-dialog-subtitle').textContent='Season '+selectedSeason;
  const body=dialog.querySelector('#calendar-event-dialog-details');body.replaceChildren();
  if(!data.events.length){const p=document.createElement('p');p.textContent=data.kind==='preseason'?'Preseason':data.kind==='transition'?'Season transition':'No official events.';body.append(p)}
  for(const event of data.events){
   const section=document.createElement('section'),heading=document.createElement('h3');
   heading.textContent=displayMarker(event)+' - '+namesFor(event);section.append(heading);
   const scope=document.createElement('p');scope.textContent='Competitions: '+event.competitionIds.join(', ');section.append(scope);
   const pending=document.createElement('p');pending.textContent='Fixtures and results are not yet available.';section.append(pending);
   body.append(section);
  }
  if(!dialog.open)dialog.showModal();
 }
 for(const day of root.querySelectorAll('[data-calendar-day]')){
  day.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();showDay(day,day)},true);
  day.addEventListener('keydown',e=>{if(e.target===day&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopImmediatePropagation();showDay(day,day)}},true);
 }
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
  marker.addEventListener('click',()=>{tooltip.hidden=true});
 }
 function currentDay(){try{const n=Number(sessionStorage.getItem('football-architect:calendar-dev-world-day'));return Number.isInteger(n)&&n>=1&&n<=56?n:1}catch{return 1}}
 function updateCurrentDay(){const n=dev&&selectedSeason===readDebugSeason()?currentDay():0;for(const cell of root.querySelectorAll('[data-calendar-day]')){const current=Number(cell.dataset.calendarDay)===n;if(current)cell.dataset.devCurrentDay='true';else delete cell.dataset.devCurrentDay}}
 window.addEventListener('fa:dev-world-day-change',updateCurrentDay);
 window.addEventListener('fa:dev-progress-change',updateCurrentDay);
 updateCurrentDay();
})();
