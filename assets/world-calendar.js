// CAL-IMP-02: calendar selection is presentation state, never simulation progress.
(()=>{
  'use strict';
  const calendar=document.getElementById('world-calendar'),model=window.faWorldCalendarModel;
  if(!calendar||!model)return;
  const root=document.documentElement,days=model.createSeason(1).days;
  const buttons=[...calendar.querySelectorAll('[data-calendar-day]')];
  const rows=[...calendar.querySelectorAll('[data-week]')];
  const get=id=>document.getElementById('calendar-'+id);
  const words={
    en:{season:'Season',week:'Week',plan:'Season plan',cycle:'56 days · 8 weeks',view:'Calendar view',navigation:'Week navigation',previous:'Previous week',next:'Next week',day:'Day',days:'Days',selected:'Selected',preseason:'Preseason',pause:'Pause',transition:'Transition',official:'Official events',national:'Domestic round',international:'International round',federationFinal:'Federation Cup final',sovereignFinal:'Sovereign Cup final',key:'N · National   I · International   FC / SC · Cup finals   — · Pause   T · Transition'},
    de:{season:'Saison',week:'Woche',plan:'Saisonplan',cycle:'56 Tage · 8 Wochen',view:'Kalenderansicht',navigation:'Wochennavigation',previous:'Vorherige Woche',next:'Nächste Woche',day:'Tag',days:'Tage',selected:'Ausgewählt',preseason:'Saisonvorbereitung',pause:'Pause',transition:'Übergang',official:'Offizielle Ereignisse',national:'Nationaler Spieltag',international:'Internationale Runde',federationFinal:'Finale des Federation Cup',sovereignFinal:'Finale des Sovereign Cup',key:'N · National   I · International   FC / SC · Pokalfinals   — · Pause   T · Übergang'},
    es:{season:'Temporada',week:'Semana',plan:'Plan de temporada',cycle:'56 días · 8 semanas',view:'Vista del calendario',navigation:'Navegación semanal',previous:'Semana anterior',next:'Semana siguiente',day:'Día',days:'Días',selected:'Seleccionado',preseason:'Pretemporada',pause:'Pausa',transition:'Transición',official:'Eventos oficiales',national:'Jornada nacional',international:'Ronda internacional',federationFinal:'Final de la Federation Cup',sovereignFinal:'Final de la Sovereign Cup',key:'N · Nacional   I · Internacional   FC / SC · Finales de copa   — · Pausa   T · Transición'},
    fr:{season:'Saison',week:'Semaine',plan:'Plan de saison',cycle:'56 jours · 8 semaines',view:'Vue du calendrier',navigation:'Navigation par semaine',previous:'Semaine précédente',next:'Semaine suivante',day:'Jour',days:'Jours',selected:'Sélection',preseason:'Présaison',pause:'Pause',transition:'Transition',official:'Événements officiels',national:'Journée nationale',international:'Tour international',federationFinal:'Finale de la Federation Cup',sovereignFinal:'Finale de la Sovereign Cup',key:'N · National   I · International   FC / SC · Finales de coupe   — · Pause   T · Transition'},
    it:{season:'Stagione',week:'Settimana',plan:'Piano stagionale',cycle:'56 giorni · 8 settimane',view:'Vista calendario',navigation:'Navigazione settimanale',previous:'Settimana precedente',next:'Settimana successiva',day:'Giorno',days:'Giorni',selected:'Selezionato',preseason:'Prestagione',pause:'Pausa',transition:'Transizione',official:'Eventi ufficiali',national:'Giornata nazionale',international:'Turno internazionale',federationFinal:'Finale Federation Cup',sovereignFinal:'Finale Sovereign Cup',key:'N · Nazionale   I · Internazionale   FC / SC · Finali di coppa   — · Pausa   T · Transizione'}
  };
  let state={day:Number(root.dataset.calendarDay),view:root.dataset.calendarView};
  if(!Number.isInteger(state.day)||state.day<1||state.day>56||!['season','week'].includes(state.view))state={day:1,view:'season'};
  const kind=(d,w)=>w[d.kind];
  const label=(d,w)=>w.day+' '+d.day+' · '+kind(d,w)+(d.events.length?' · '+d.events.map(e=>e.phase==='final'?w[e.marker==='FEDERATION-FINAL'?'federationFinal':'sovereignFinal']:w[e.family]+' '+e.round).join(' · '):'');
  function render(){
    const w=words[root.lang]||words.en,week=Math.ceil(state.day/7);
    root.dataset.calendarDay=String(state.day);root.dataset.calendarView=state.view;root.dataset.calendarWeek=String(week);
    for(const row of rows){
      const n=Number(row.dataset.week);row.hidden=state.view==='week'&&n!==week;
      row.setAttribute('aria-label',w.days+' '+((n-1)*7+1)+'–'+(n*7));
    }
    for(const button of buttons){
      const d=days[Number(button.dataset.calendarDay)-1],selected=d.day===state.day;
      button.disabled=false;button.tabIndex=selected?0:-1;
      button.setAttribute('aria-pressed',String(selected));button.setAttribute('aria-label',label(d,w));
      button.querySelector('.calendar-day-kind').textContent=kind(d,w);
    }
    for(const view of ['season','week']){get(view).textContent=w[view];get(view).disabled=false;get(view).setAttribute('aria-pressed',String(view===state.view))}
    for(const id of ['plan-label','cycle','key'])if(get(id))get(id).textContent=w[id==='plan-label'?'plan':id];
    get('mode-label')?.setAttribute('aria-label',w.view);
    get('controls').hidden=state.view!=='week';get('controls').setAttribute('aria-label',w.navigation);
    get('previous').setAttribute('aria-label',w.previous);get('next').setAttribute('aria-label',w.next);
    get('previous').disabled=week===1;get('next').disabled=week===8;
    get('week-label').textContent=w.week+' '+week+' / 8';
    get('days').setAttribute('aria-label',state.view==='season'?w.season+' · '+w.days+' 1–56':w.week+' '+week);
    get('selected').textContent=w.selected+': '+label(days[state.day-1],w);
    root.dataset.calendarReady='true';
  }
  function change(patch,focus=false){
    state={...state,...patch};render();
    try{sessionStorage.setItem('football-architect:calendar-selection',JSON.stringify({version:1,day:state.day,view:state.view}))}catch{}
    if(focus)buttons[state.day-1].focus();
  }
  for(const view of ['season','week'])get(view).addEventListener('click',()=>change({view}));
  get('previous').addEventListener('click',()=>{if(state.day>7){const day=state.day-7;change({day},day<=7)}});
  get('next').addEventListener('click',()=>{if(state.day<=49){const day=state.day+7;change({day},day>49)}});
  for(const button of buttons){
    button.addEventListener('click',()=>change({day:Number(button.dataset.calendarDay)}));
    button.addEventListener('keydown',event=>{
      const day=state.day,start=Math.floor((day-1)/7)*7+1;
      const target={ArrowLeft:day-1,ArrowRight:day+1,ArrowUp:day-(state.view==='season'?7:1),ArrowDown:day+(state.view==='season'?7:1),PageUp:day-7,PageDown:day+7,
        Home:event.ctrlKey?1:start,End:event.ctrlKey?56:start+6}[event.key];
      if(target===undefined)return;
      event.preventDefault();change({day:Math.max(1,Math.min(56,target))},true);
    });
  }
  window.faWorldCalendar=Object.freeze({getSelection:()=>Object.freeze({...state})});
  new MutationObserver(render).observe(root,{attributes:true,attributeFilter:['lang']});
  render();
})();
