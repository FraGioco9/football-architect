import model from '../assets/world-calendar-model.js';

// Resolve the view and any verified local week before the calendar paints.
export const calendarBootstrap = `(${function bootCalendar() {
  const root = document.documentElement;
  const url = new URL(location.href);
  const requestedView = url.searchParams.get('calendarView');
  const requestedWeek = Number(url.searchParams.get('week'));
  const validWeek = Number.isInteger(requestedWeek) && requestedWeek >= 1 && requestedWeek <= 8;
  const mobile = window.matchMedia('(max-width:620px), (hover:none) and (pointer:coarse)').matches;
  const view = ['season', 'week'].includes(requestedView) ? requestedView : validWeek || mobile ? 'week' : 'season';
  const dev = window.faDebugEnabled === true &&
    (window.faDevPreviewMode === true || window.faDevCalendarClockSnapshot?.source?.kind === 'dev');
  let currentSeason = 1, worldDay = 1;
  if (dev) {
    try {
      const raw = sessionStorage.getItem('football-architect:standings-dev-season');
      const storedSeason = raw ? Number(raw) : 1;
      if (Number.isInteger(storedSeason) && storedSeason >= 0 && storedSeason <= 4) currentSeason = storedSeason;
      const storedDay = Number(sessionStorage.getItem('football-architect:calendar-dev-world-day'));
      if (Number.isInteger(storedDay) && storedDay >= 1 && storedDay <= 56) worldDay = storedDay;
    } catch {}
  }
  const requested = Number(url.searchParams.get('season'));
  const validSeason = Number.isInteger(requested) && requested >= 1 && requested <= 999999999;
  const season = validSeason && (!dev || requested <= Math.max(1, currentSeason))
    ? requested : dev ? Math.max(1, currentSeason) : null;
  const isCurrentDevSeason = dev && season === currentSeason;
  const explicitWeek = view === 'week' && validWeek;
  const day = explicitWeek ? (requestedWeek - 1) * 7 + 1 : view === 'week' && isCurrentDevSeason ? worldDay : 1;
  const week = Math.ceil(day / 7);

  const params = new URLSearchParams();
  // A missing query always means the current season. The first-paint bootstrap
  // must not synthesize an explicit Season 1 permalink before hydration.
  if (season !== null && validSeason && url.searchParams.has('season') &&
      (!dev || requested <= Math.max(1,currentSeason))) params.set('season', String(season));
  params.set('calendarView', view);
  if (view === 'week' && (explicitWeek || dev)) params.set('week', String(week));
  url.search = params;
  history.replaceState(history.state, '', url);

  if (explicitWeek) root.dataset.calendarWeekExplicit = 'true';
  if (!dev && !explicitWeek) root.dataset.calendarWeekPending = 'true';
  root.dataset.calendarView = view;
  root.dataset.calendarDay = String(day);
  root.dataset.calendarWeek = String(week);
  root.dataset.calendarSeason = season === null ? '' : String(season);
  if (isCurrentDevSeason) {
    const style = document.createElement('style');
    style.dataset.calendarDevHighlight = '';
    style.textContent = '#world-calendar .calendar-day[data-calendar-day="' + worldDay + '"]{border:2px solid var(--focus)!important;background:rgba(91,142,121,.14)!important;box-shadow:inset 0 0 0 1px var(--focus)!important}';
    document.head.append(style);
  }
}.toString()})();`;

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
  const weekPreview=Array.from({length:7},()=>
    '                <div class="calendar-day"><span class="app-skeleton-bar calendar-day-number"></span><span class="app-skeleton-bar calendar-day-kind"></span></div>').join('\n');
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
                <button id="calendar-previous" class="calendar-arrow language-trigger app-fixtures-arrow" type="button" aria-label="Previous week" aria-controls="calendar-days" disabled><svg class="site-chevron site-chevron-left" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                <span id="calendar-week-label" hidden>Week 1 / 8</span>
                <div class="language-control app-fixtures-select"><button type="button" class="language-trigger app-fixtures-trigger" id="calendar-week-trigger" role="combobox" aria-haspopup="listbox" aria-controls="calendar-week-menu" aria-expanded="false"><span id="calendar-week-value">Week</span><svg class="language-chevron" width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="language-menu" id="calendar-week-menu" role="listbox" aria-labelledby="calendar-week-trigger" hidden></div></div>
                <button id="calendar-next" class="calendar-arrow language-trigger app-fixtures-arrow" type="button" aria-label="Next week" aria-controls="calendar-days" disabled><svg class="site-chevron site-chevron-right" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                <button type="button" id="calendar-current-week" class="language-trigger app-fixtures-current" aria-label="Current week" hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6"/></svg><span>Current week</span></button>
              </div>
            <script data-calendar-arrows-first-paint>(()=>{const {calendarWeek,calendarWeekPending}=document.documentElement.dataset;if(calendarWeekPending)return;const week=Number(calendarWeek)||1;const prev=document.getElementById('calendar-previous'),next=document.getElementById('calendar-next');if(prev)prev.disabled=week<=1;if(next)next.disabled=week>=8})();</script>
            <script data-calendar-week-first-paint>(()=>{const {calendarWeek,calendarWeekPending}=document.documentElement.dataset;if(calendarWeekPending)return;const week=calendarWeek||'1';const node=document.getElementById('calendar-week-value');if(node)node.textContent='Week '+week})();</script>
            <section class="calendar-clock" id="calendar-clock" aria-label="World Clock">
              <strong id="calendar-clock-title">World Clock</strong>
              <span id="calendar-clock-value" role="status" aria-live="polite">Current world day unavailable</span>
              <span id="calendar-clock-source">No authoritative world clock</span>
              <label for="calendar-dev-world-day" id="calendar-dev-world-label" hidden>Fictional DEV world day</label>
              <input id="calendar-dev-world-day" type="range" min="1" max="56" value="1" hidden disabled>
            </section>
            <div class="calendar-days" id="calendar-days" role="group" aria-label="Season days">
              <div class="calendar-week-row calendar-week-preview" aria-hidden="true">
${weekPreview}
              </div>
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
