import model from '../assets/world-calendar-model.js';

// Resolve presentation-only state before styles paint. No world-clock state is read.
export const calendarBootstrap=`(()=>{let day=1,view=window.matchMedia('(max-width:620px), (hover:none) and (pointer:coarse)').matches?'week':'season';try{const url=new URL(location.href),q=url.searchParams.get('calendarView');if(q==='week'||q==='season')view=q;const limit=window.faDevCalendarClockSnapshot?.source?.kind==='dev'?(Number(sessionStorage.getItem('football-architect:standings-dev-season'))||1):1;const requested=Number(url.searchParams.get('season'));const season=url.searchParams.has('season')&&Number.isInteger(requested)&&requested>=1&&requested<=limit?requested:limit;url.search='?'+new URLSearchParams({season:String(season),calendarView:view});history.replaceState(history.state,'',url)}catch{}if(view==='week'&&window.faDevCalendarClockSnapshot?.source?.kind==='dev'){try{const q=new URL(location.href).searchParams;const currentSeason=Number(sessionStorage.getItem('football-architect:standings-dev-season'))||1;const selectedSeason=Number(q.get('season'))||currentSeason;const worldDay=Number(sessionStorage.getItem('football-architect:calendar-dev-world-day'));if(selectedSeason===currentSeason&&Number.isInteger(worldDay)&&worldDay>=1&&worldDay<=56)day=worldDay}catch{}}const d=document.documentElement.dataset;d.calendarView=view;d.calendarDay=String(day);d.calendarWeek=String(Math.ceil(day/7));d.calendarSeason=new URL(location.href).searchParams.get('season')||'1';if(window.faDevCalendarClockSnapshot?.source?.kind==='dev'&&sessionStorage.getItem('football-architect:standings-dev-season')!=='0'){const st=Number(sessionStorage.getItem('football-architect:standings-dev-season'))||1;if(Number(d.calendarSeason)===st){const worldDay=Number(sessionStorage.getItem('football-architect:calendar-dev-world-day'))||1;if(worldDay>=1&&worldDay<=56){const style=document.createElement('style');style.dataset.calendarDevHighlight='';style.textContent='#world-calendar .calendar-day[data-calendar-day="'+worldDay+'"]{border:2px solid var(--focus)!important;background:rgba(91,142,121,.14)!important;box-shadow:inset 0 0 0 1px var(--focus)!important}';document.head.append(style)}}}})();`;

export function renderWorldCalendar(){
  const days=model.createSeason(1).days;
  const kind=d=>d.kind==='official'?'Official events':d.kind[0].toUpperCase()+d.kind.slice(1);
  const label=e=>e.marker==='FEDERATION-FINAL'?'Federation Cup final':e.marker==='SOVEREIGN-FINAL'?'Sovereign Cup final':(e.family==='national'?'Domestic round ':'International round ')+e.round;
  const button=d=>{
    const events=d.events.map(e=>'<span class="calendar-event calendar-event--'+(e.phase==='final'?'final':e.family)+'" data-calendar-marker="'+e.marker+'">'+(e.phase==='final'?'F':e.marker)+'</span>').join('');
    return '                  <button class="calendar-day" id="calendar-day-'+d.day+'" type="button" data-calendar-day="'+d.day+'" data-kind="'+d.kind+'" aria-pressed="false" aria-label="Day '+d.day+' · '+kind(d)+(d.events.length?' · '+d.events.map(label).join(' · '):'')+'" tabindex="'+(d.day===1?'0':'-1')+'" disabled>\n'+
      '                    <span class="calendar-day-number" aria-hidden="true">'+String(d.day).padStart(2,'0')+'</span>\n'+
      '                    <span class="calendar-day-kind" aria-hidden="true">'+kind(d)+'</span>\n'+
      '                    <span class="calendar-day-events" aria-hidden="true">'+(events||'<span class="calendar-day-mark">'+(d.kind==='transition'?'T':'—')+'</span>')+'</span>\n'+
      '                  </button>';
  };
  const rows=Array.from({length:8},(_,i)=>'                <div class="calendar-week-row" role="group" data-week="'+(i+1)+'" aria-label="Days '+(i*7+1)+'–'+(i*7+7)+'">\n'+days.slice(i*7,i*7+7).map(button).join('\n')+'\n                </div>').join('\n');
  return `          <section class="world-calendar" id="world-calendar" aria-labelledby="calendar-plan-label">
            <header class="calendar-heading">
              <h2 id="calendar-plan-label">Season plan</h2>
              <span class="calendar-cycle" id="calendar-cycle">56 days · 8 weeks</span>
            </header>
            <div class="calendar-toolbar">
              <div class="calendar-modes" role="group" aria-label="Calendar view" id="calendar-mode-label">
                <button class="calendar-mode" id="calendar-season" type="button" aria-pressed="true" aria-controls="calendar-days" disabled>Season</button>
                <button class="calendar-mode" id="calendar-week" type="button" aria-pressed="false" aria-controls="calendar-days" disabled>Week</button>
              </div>
              
            </div>
            <div class="calendar-controls app-fixtures-navigation" id="calendar-controls" role="group" aria-label="Week navigation">
                <button id="calendar-previous" class="calendar-arrow language-trigger app-fixtures-arrow" type="button" aria-label="Previous week" aria-controls="calendar-days" disabled><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button>
                <span id="calendar-week-label" hidden>Week 1 / 8</span>
                <div class="language-control app-fixtures-select"><button type="button" class="language-trigger app-fixtures-trigger" id="calendar-week-trigger" role="combobox" aria-haspopup="listbox" aria-controls="calendar-week-menu" aria-expanded="false"><span id="calendar-week-value">Week 1</span><svg class="language-chevron" width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="language-menu" id="calendar-week-menu" role="listbox" aria-labelledby="calendar-week-trigger" hidden></div></div>
                <button id="calendar-next" class="calendar-arrow language-trigger app-fixtures-arrow" type="button" aria-label="Next week" aria-controls="calendar-days" disabled><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></button>
                <button type="button" id="calendar-current-week" class="language-trigger app-fixtures-current" aria-label="Current week" hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6"/></svg><span>Current week</span></button>
              </div>
            <script data-calendar-arrows-first-paint>(()=>{const week=Number(document.documentElement.dataset.calendarWeek)||1;const prev=document.getElementById('calendar-previous'),next=document.getElementById('calendar-next');if(prev)prev.disabled=week<=1;if(next)next.disabled=week>=8})();</script>
            <script data-calendar-week-first-paint>(()=>{const week=document.documentElement.dataset.calendarWeek||'1';const node=document.getElementById('calendar-week-value');if(node)node.textContent='Week '+week})();</script>
            <section class="calendar-clock" id="calendar-clock" aria-label="World Clock">
              <strong id="calendar-clock-title">World Clock</strong>
              <span id="calendar-clock-value" role="status" aria-live="polite">Current world day unavailable</span>
              <span id="calendar-clock-source">No authoritative world clock</span>
              <label for="calendar-dev-world-day" id="calendar-dev-world-label" hidden>Fictional DEV world day</label>
              <input id="calendar-dev-world-day" type="range" min="1" max="56" value="1" hidden disabled>
            </section>
            <div class="calendar-filterbar">
              <label for="calendar-filter">Competition filter</label>
              <select id="calendar-filter" aria-label="Competition filter"><option value="all">All competitions</option><option value="national">National competitions</option><option value="international">International competitions</option><option value="sovereign">Sovereign Cup</option><option value="federation">Federation Cup</option></select>
              <label for="calendar-division">Domestic division</label>
              <select id="calendar-division" aria-label="Domestic division"><option value="">Choose a division</option><option value="it-1">IT-1</option><option value="it-2">IT-2</option><option value="eng-1">ENG-1</option><option value="eng-2">ENG-2</option><option value="es-1">ES-1</option><option value="es-2">ES-2</option><option value="de-1">DE-1</option><option value="de-2">DE-2</option><option value="fr-1">FR-1</option><option value="fr-2">FR-2</option><option value="pt-1">PT-1</option><option value="pt-2">PT-2</option><option value="nl-1">NL-1</option><option value="nl-2">NL-2</option><option value="br-1">BR-1</option><option value="br-2">BR-2</option></select>
              <button type="button" id="calendar-today" disabled>Today unavailable</button>
            </div>
            <div class="calendar-days" id="calendar-days" role="group" aria-label="Season days">
${rows}
            </div>
            <p class="calendar-selected" id="calendar-selected" role="status" aria-live="polite" aria-atomic="true">Selected: Day 1 · Preseason</p>
            <section class="calendar-details" id="calendar-details" data-day="1" aria-labelledby="calendar-details-heading">
              <h3 id="calendar-details-heading">Day 1 · Preseason</h3>
              <div class="calendar-details-content" id="calendar-details-content"><p class="calendar-details-empty">No official fixtures during preseason.</p></div>
            </section>

            <p class="calendar-note" id="calendar-note" data-app-i18n="calendarStatusText">Season structure only. No live fixtures or results are available.</p>
          </section>`;
}
