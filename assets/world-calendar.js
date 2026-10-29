// CAL-IMP-02: calendar selection is presentation state, never simulation progress.
(()=>{
  'use strict';
  const calendar=document.getElementById('world-calendar'),model=window.faWorldCalendarModel;
  if(!calendar||!model)return;
  const root=document.documentElement,days=model.createSeason(1).days;
  const clockAdapter=window.faWorldClockAdapter;
  let clockSnapshot=null,publicWorld=null;
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
  let manualWeekDay=null;
  let pendingInitialWeek=false;
  const rememberWeek=()=>{manualWeekDay=state.day;pendingInitialWeek=false};
  const currentWeekDay=()=>{
    const current=clockSnapshot?.current;
    const viewedSeason=window.faCalendarSelectedSeason?.()??1;
    return current&&current.season===viewedSeason&&Number.isInteger(current.day)&&current.day>=1&&current.day<=56?current.day:state.day;
  };
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
      button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',label(d,w));
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
    renderDetails();renderNav();renderClock();
    window.dispatchEvent(new CustomEvent('fa:calendar-selection-change'));
  }
  function change(patch,focus=false){
    state={...state,...patch};render();
    saveUrl(true);
    if(focus)buttons[state.day-1].focus();
  }
  for(const view of ['season','week'])get(view).addEventListener('click',()=>{
    const enteringWeek=view==='week'&&state.view!=='week';
    if(enteringWeek&&manualWeekDay===null){pendingInitialWeek=true;change({view,day:currentWeekDay()})}
    else change(enteringWeek?{view,day:manualWeekDay??state.day}:{view});
  });
  get('previous').addEventListener('click',()=>{if(state.day>7){const day=state.day-7;change({day},day<=7);rememberWeek()}});
  get('next').addEventListener('click',()=>{if(state.day<=49){const day=state.day+7;change({day},day>49);rememberWeek()}});
  for(const button of buttons){
    button.addEventListener('click',()=>{if(typeof window.faCalendarShowDay==='function')window.faCalendarShowDay(button);else change({day:Number(button.dataset.calendarDay)});if(state.view==='week')rememberWeek()});
    button.addEventListener('keydown',event=>{
      const day=state.day,start=Math.floor((day-1)/7)*7+1;
      const target={ArrowLeft:day-1,ArrowRight:day+1,ArrowUp:day-(state.view==='season'?7:1),ArrowDown:day+(state.view==='season'?7:1),PageUp:day-7,PageDown:day+7,
        Home:event.ctrlKey?1:start,End:event.ctrlKey?56:start+6}[event.key];
      if(target===undefined)return;
      event.preventDefault();change({day:Math.max(1,Math.min(56,target))},true);if(state.view==='week')rememberWeek();
    });
  }
  // CAL-IMP-03: read-only inline details derived only from the frozen calendar contract.
  const details=get('details'),heading=get('details-heading'),content=get('details-content');
  const detailWords={
    en:{day:'Day',events:'Official events',preseason:'Preseason',pause:'Pause',transition:'Transition',none:'No official events on this day.',preseasonText:'No official fixtures during preseason.',pauseText:'No official fixtures scheduled for this pause.',transitionText:'Season transition details are not defined.',national:'Domestic round',international:'International round',league:'League phase',playoffs:'Playoffs',quarterfinals:'Quarterfinals',semifinals:'Semifinals',postseason:'Postseason',final:'Final',show:'Show details',fixtures:'Fixtures unavailable',results:'Results unavailable',scope:'Competitions',unknown:'No authoritative fixtures or results are available.'},
    de:{day:'Tag',events:'Offizielle Ereignisse',preseason:'Saisonvorbereitung',pause:'Pause',transition:'Übergang',none:'Keine offiziellen Ereignisse an diesem Tag.',preseasonText:'Keine offiziellen Spiele in der Saisonvorbereitung.',pauseText:'Keine offiziellen Spiele während der Pause.',transitionText:'Der Saisonübergang ist noch nicht definiert.',national:'Nationaler Spieltag',international:'Internationale Runde',league:'Ligaphase',playoffs:'Playoffs',quarterfinals:'Viertelfinale',semifinals:'Halbfinale',postseason:'Endrunde',final:'Finale',show:'Details anzeigen',fixtures:'Spielplan nicht verfügbar',results:'Ergebnisse nicht verfügbar',scope:'Wettbewerbe',unknown:'Keine offiziellen Spiele oder Ergebnisse verfügbar.'},
    es:{day:'Día',events:'Eventos oficiales',preseason:'Pretemporada',pause:'Pausa',transition:'Transición',none:'No hay eventos oficiales este día.',preseasonText:'No hay partidos oficiales en pretemporada.',pauseText:'No hay partidos oficiales durante la pausa.',transitionText:'La transición de temporada aún no está definida.',national:'Jornada nacional',international:'Ronda internacional',league:'Fase de liga',playoffs:'Playoffs',quarterfinals:'Cuartos de final',semifinals:'Semifinales',postseason:'Fase final',final:'Final',show:'Ver detalles',fixtures:'Partidos no disponibles',results:'Resultados no disponibles',scope:'Competiciones',unknown:'No hay partidos ni resultados oficiales disponibles.'},
    fr:{day:'Jour',events:'Événements officiels',preseason:'Présaison',pause:'Pause',transition:'Transition',none:'Aucun événement officiel ce jour.',preseasonText:'Aucun match officiel en présaison.',pauseText:'Aucun match officiel pendant la pause.',transitionText:'La transition de saison reste à définir.',national:'Journée nationale',international:'Tour international',league:'Phase de ligue',playoffs:'Barrages',quarterfinals:'Quarts de finale',semifinals:'Demi-finales',postseason:'Phase finale',final:'Finale',show:'Afficher les détails',fixtures:'Matchs indisponibles',results:'Résultats indisponibles',scope:'Compétitions',unknown:'Aucun match ni résultat officiel disponible.'},
    it:{day:'Giorno',events:'Eventi ufficiali',preseason:'Prestagione',pause:'Pausa',transition:'Transizione',none:'Nessun evento ufficiale in questo giorno.',preseasonText:'Nessuna partita ufficiale in prestagione.',pauseText:'Nessuna partita ufficiale durante la pausa.',transitionText:'La transizione stagionale non è ancora definita.',national:'Giornata nazionale',international:'Turno internazionale',league:'Fase campionato',playoffs:'Playoff',quarterfinals:'Quarti di finale',semifinals:'Semifinali',postseason:'Postseason',final:'Finale',show:'Mostra dettagli',fixtures:'Partite non disponibili',results:'Risultati non disponibili',scope:'Competizioni',unknown:'Nessuna partita o risultato ufficiale disponibile.'}
  };
  const nameFor=(event,w)=>event.marker==='FEDERATION-FINAL'?'Federation Cup · '+w.final:event.marker==='SOVEREIGN-FINAL'?'Sovereign Cup · '+w.final:(event.family==='national'?w.national:w.international)+' '+event.round;
  let lastDetailsDay=null,lastDetailsLanguage=null;
  function renderDetails(){
    if(!details||!heading||!content)return; // Old lightweight DOM harnesses do not create details.
    if(lastDetailsDay===state.day&&lastDetailsLanguage===root.lang&&content.dataset.filter===filter&&content.dataset.division===division)return;
    lastDetailsDay=state.day;lastDetailsLanguage=root.lang;
    const w=detailWords[root.lang]||detailWords.en,d=days[state.day-1];
    details.dataset.day=String(state.day);content.dataset.filter=filter;content.dataset.division=division;
    heading.textContent=w.day+' '+d.day+' · '+(d.events.length?w.events:w[d.kind]);
    content.replaceChildren();
    const visible=d.events.filter(matches);
    if(!visible.length){
      const p=document.createElement('p');p.className='calendar-details-empty';p.textContent=w[d.kind+'Text']||w.none;content.append(p);return;
    }
    for(const e of visible){
      const article=document.createElement('article');article.className='calendar-detail-card';article.dataset.marker=e.marker;
      const h=document.createElement('h4');h.textContent=e.marker+' · '+nameFor(e,w);article.append(h);
      const summary=document.createElement('p');summary.className='calendar-detail-summary';summary.textContent=w[e.phase]||w.events;article.append(summary);
      const disclosure=document.createElement('details');disclosure.className='calendar-detail-disclosure';
      const label=document.createElement('summary');label.textContent=w.show;disclosure.append(label);
      const info=document.createElement('div');info.className='calendar-detail-more';
      const scope=document.createElement('p');scope.textContent=w.scope+': '+(e.family==='international'?e.competitionIds.map(id=>id==='int-1'?'Sovereign Cup':'Federation Cup').join(' · '):'16');info.append(scope);
      for(const value of [w.fixtures,w.results,w.unknown]){const p=document.createElement('p');p.textContent=value;info.append(p)}
      disclosure.append(info);article.append(disclosure);
      if(e.family==='national'&&division&&e.round<=30){const a=document.createElement('a');a.href=window.faRoutesRegistry.buildRoute({kind:'competition',id:division,view:'fixtures'})+'?season=1&matchday='+e.round+'&calendarReturn='+encodeURIComponent(returnPath());a.textContent='View fixtures';article.append(a)}
      content.append(article);
    }
  }
  // CAL-IMP-04: filter and navigation are presentation state, not sporting progress.
  // CAL-IMP-05A: only explicit DEV snapshots; public and missing sources remain unavailable.
  const clockValue=get('clock-value'),clockSource=get('clock-source'),todayButton=get('today');
  const devSlider=get('dev-world-day'),devLabel=get('dev-world-label');
  const clockText={
    en:['World day unavailable','Season','Day','Fictional DEV/Preview','No authoritative world clock','Today','Today unavailable'],
    de:['Welttag nicht verfügbar','Saison','Tag','Fiktive DEV/Vorschau','Keine autoritative Weltzeit','Heute','Heute nicht verfügbar'],
    es:['Día mundial no disponible','Temporada','Día','DEV/Vista previa ficticia','Sin reloj mundial oficial','Hoy','Hoy no disponible'],
    fr:['Jour mondial indisponible','Saison','Jour','DEV/Aperçu fictif','Aucune horloge mondiale officielle',"Aujourd’hui","Aujourd’hui indisponible"],
    it:['Giorno mondiale non disponibile','Stagione','Giorno','DEV/Anteprima fittizia','Orologio mondiale ufficiale non disponibile','Oggi','Oggi non disponibile']
  };
  for(const [lang,label] of Object.entries({en:'Authoritative world',it:'Mondo autorevole',de:'Verbindliche Welt',es:'Mundo oficial',fr:'Monde officiel'}))clockText[lang].push(label);
  // DEV presentation is enabled only by the isolated server-side HTML bootstrap.
  // Public pages must never accept a browser-dispatched fictional or authoritative clock.
  const devClockEnabled=window.faDevCalendarClockSnapshot?.source?.kind==='dev';
  function updateClock(raw){
    try{clockSnapshot=devClockEnabled&&raw?.source?.kind==='dev'?clockAdapter?.normalize(raw)??null:null}catch{clockSnapshot=null}
    if(pendingInitialWeek&&state.view==='week'&&manualWeekDay===null){
      const day=currentWeekDay();
      if(day!==state.day){state={...state,day};render();}
    }
    renderClock();
  }
  function renderClock(){
    if(!clockValue||!clockSource)return;
    const w=clockText[root.lang]||clockText.en;
    const valid=clockSnapshot?.current;
    const navigable=Boolean(valid&&valid.season===(window.faCalendarSelectedSeason?.()??1));
    const dev=clockSnapshot?.source.kind==='dev';
    clockValue.textContent=valid?w[1]+' '+valid.season+' · '+w[2]+' '+valid.day+'/56 · '+Math.round(valid.day/56*100)+'%':w[0];
    clockSource.textContent=dev?w[3]:clockSnapshot?.source.kind==='authoritative'?w[7]:w[4];
    if(todayButton){todayButton.disabled=!navigable;todayButton.textContent=navigable?w[5]:w[6]}
    if(devSlider&&devLabel){
      devSlider.hidden=devLabel.hidden=!dev;
      devSlider.disabled=!dev;
      if(dev)devSlider.value=String(valid.day);
      devLabel.textContent=w[3]+' · '+w[2];
    }
    if(clockAdapter){
      let projected;try{projected=clockAdapter.project(window.faCalendarSelectedSeason?.()??1,clockSnapshot)}catch{projected=clockAdapter.project(window.faCalendarSelectedSeason?.()??1,null)}
      for(const button of buttons){
        const day=Number(button.dataset.calendarDay),relative=projected.days[day-1].relative;
        if(relative)button.dataset.clockRelative=relative;
        else delete button.dataset.clockRelative;
      }
    }
  }
  if(todayButton)todayButton.addEventListener('click',()=>{if(clockSnapshot?.current?.season===(window.faCalendarSelectedSeason?.()??1))change({day:clockSnapshot.current.day})});
  if(devSlider)devSlider.addEventListener('input',()=>{
    if(clockSnapshot?.source.kind!=='dev')return;
    const day=Number(devSlider.value);
    if(!Number.isInteger(day)||day<1||day>56)return;
    // A DEV presentation fixture: this control does not touch fixtures, standings or global simulation state.
    updateClock({source:{kind:'dev',reference:'fictional calendar DEV control'},current:{season:1,day}});
  });
  window.addEventListener?.('fa:world-clock-snapshot',event=>updateClock(event.detail));
  updateClock(window.faDevCalendarClockSnapshot??null);
  const filterElement=get('filter'),divisionElement=get('division');
  const filters=['all','national','international','sovereign','federation'];
  const validDivision=v=>/^(it|eng|es|de|fr|pt|nl|br)-[12]$/.test(v);
  let filter='all',division='';
  const matches=e=>filter==='all'||filter===e.family||
    (filter==='sovereign'&&e.competitionIds.includes('int-1'))||
    (filter==='federation'&&e.competitionIds.includes('int-2'));
  const hasLocation=()=>Boolean(window.location?.href)&&typeof URL!=='undefined';
  const returnPath=()=>{
    const p=new URLSearchParams({season:String(window.faCalendarSelectedSeason?.()||1),calendarView:state.view});
    
    return '/calendar?'+p.toString();
  };
  const saveUrl=push=>{
    if(!hasLocation()||!window.history)return;
    const target=returnPath();
    if(window.location.pathname+window.location.search!==target)
      window.history[push?'pushState':'replaceState'](null,'',target);
  };
  const restoreUrl=()=>{
    if(!hasLocation())return;
    const p=new URL(window.location.href).searchParams;
    filter='all';division=''; // Missing or malformed history parameters cannot inherit stale filters.
    
    if(['season','week'].includes(p.get('calendarView')))state.view=p.get('calendarView');
    if(filters.includes(p.get('competition')))filter=p.get('competition');
    if(validDivision(p.get('division')||''))division=p.get('division');
  };
  const renderNav=()=>{
    if(!filterElement||!divisionElement)return;
    filterElement.value=filter;divisionElement.value=division;
    divisionElement.disabled=!['all','national'].includes(filter);
  };
  if(filterElement&&divisionElement){
    restoreUrl();
    filterElement.addEventListener('change',()=>{filter=filters.includes(filterElement.value)?filterElement.value:'all';lastDetailsDay=null;render();saveUrl(true)});
    divisionElement.addEventListener('change',()=>{division=validDivision(divisionElement.value)?divisionElement.value:'';lastDetailsDay=null;render();saveUrl(true)});
    window.addEventListener?.('popstate',()=>{restoreUrl();lastDetailsDay=null;render()});
  }
  window.faWorldCalendar=Object.freeze({getSelection:()=>Object.freeze({...state,filter,division}),getPublicWorld:()=>publicWorld,setWeek:n=>{if(!Number.isInteger(n)||n<1||n>8)return false;change({day:(n-1)*7+1,view:'week'});rememberWeek();return true}});
  new MutationObserver(render).observe(root,{attributes:true,attributeFilter:['lang']});
  render();
  if(!devClockEnabled&&window.faDevPreviewMode!==true){
    pendingInitialWeek=state.view==='week';
    import('/assets/authoritative-calendar.mjs').then(({mountAuthoritativeCalendar})=>mountAuthoritativeCalendar({root:calendar,onWorld:world=>{
      publicWorld=world?Object.freeze({...world}):null;
      try{clockSnapshot=world&&world.seasonNumber>0&&world.day>=1?clockAdapter.normalize({source:{kind:'authoritative',reference:'world:'+world.generation+':'+world.revision},current:{season:world.seasonNumber,day:world.day}}):null}catch{clockSnapshot=null}
      if(pendingInitialWeek&&state.view==='week'&&manualWeekDay===null){const day=currentWeekDay();if(day!==state.day)state={...state,day};if(world)pendingInitialWeek=false;}
      render();window.dispatchEvent(new CustomEvent('fa:public-calendar-change'));
    }})).catch(()=>{});
  }
})();
