/* Calendar UX simplification: presentation-only enhancements; no simulation writes. */
(()=>{
 'use strict';
 const root=document.getElementById('world-calendar');
 if(!root)return;
 const seasonKey='football-architect:standings-dev-season';
 const dev=window.faDevCalendarClockSnapshot?.source?.kind==='dev';
 const heading=root.querySelector('.calendar-heading');
 const selector=document.createElement('label');
 selector.className='calendar-season-picker';
 selector.textContent='Season ';
 const select=document.createElement('select');
 select.id='calendar-season-picker';
 select.setAttribute('aria-label','Season');
 selector.append(select);
 heading?.after(selector);
 const readDebugSeason=()=>{try{const n=Number(sessionStorage.getItem(seasonKey));return Number.isInteger(n)&&n>=1&&n<=4?n:1}catch{return 1}};
 let selectedSeason=1;
 const validSeason=n=>Number.isInteger(n)&&n>=1&&n<=(dev?readDebugSeason():1);
 function updateSeason(){
  const limit=dev?readDebugSeason():1;
  const params=new URL(location.href).searchParams;
  const requested=Number(params.get('season'));
  if(validSeason(requested))selectedSeason=requested;
  else if(selectedSeason>limit)selectedSeason=limit;
  else if(!params.has('season'))selectedSeason=limit;
  select.replaceChildren();
  for(let n=1;n<=limit;n++){const o=new Option('Season '+n,String(n));select.add(o)}
  select.value=String(selectedSeason);
  root.dataset.season=String(selectedSeason);
 }
 select.addEventListener('change',()=>{
  selectedSeason=Number(select.value);
  const url=new URL(location.href);url.searchParams.set('season',String(selectedSeason));
  history.replaceState(history.state,'',url);
  updateSeason();
 });
 window.addEventListener('fa:dev-progress-change',updateSeason);
 window.addEventListener('popstate',updateSeason);
 updateSeason();
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
 for(const marker of root.querySelectorAll('.calendar-event')){
  const code=marker.dataset.calendarMarker || marker.textContent.trim();
  const day=marker.closest('[data-calendar-day]');
  const d=Number(day?.dataset.calendarDay);
  const data=window.faWorldCalendarModel?.createSeason(1).days[d-1].events.find(e=>e.marker===code);
  if(!data)continue;
  const title=data.phase==='final'?(code==='FEDERATION-FINAL'?'Federation Cup final':'Sovereign Cup final'):(names[data.family]||data.family)+' '+data.round;
  const complete=code+' - '+title;
  marker.title=complete;
  marker.setAttribute('aria-label',complete);
  marker.addEventListener('click',event=>{
   event.preventDefault();event.stopPropagation();
   previousFocus=marker;
   dialog.querySelector('#calendar-event-dialog-title').textContent=complete;
   dialog.querySelector('#calendar-event-dialog-subtitle').textContent='Season '+selectedSeason+' · Day '+d;
   const body=dialog.querySelector('#calendar-event-dialog-details');body.replaceChildren();
   const p=document.createElement('p');p.textContent='Official calendar event · '+(data.phase==='final'?'Final':data.phase);
   body.append(p);
   const scope=document.createElement('p');scope.textContent='Competitions: '+data.competitionIds.join(', ');body.append(scope);
   const pending=document.createElement('p');pending.textContent='Fixtures and results are not yet available.';body.append(pending);
   dialog.showModal();
  });
  if(!day.dataset.calendarEventKeyboard){
   day.dataset.calendarEventKeyboard='true';
   day.addEventListener('keydown',event=>{if(event.target===day&&(event.key==='Enter'||event.key===' ')){event.preventDefault();marker.click()}});
  }
 }
})();