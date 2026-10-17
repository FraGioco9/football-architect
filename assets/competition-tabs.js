/* Competition URL state: one season/view/round, restored without reloading. */
(() => {
  "use strict";
  // Match the Settings language combobox interaction and shared CSS classes.
  window.faBindCompetitionMenu=(trigger,menu,options,choose,control)=>{
    let active=0;
    function highlight(){
      options.forEach((option,index)=>option.dataset.active=String(index===active));
      trigger.setAttribute("aria-activedescendant",options[active].id);
      options[active].scrollIntoView?.({block:"nearest"});
    }
    function close(focus=false){
      menu.hidden=true;trigger.setAttribute("aria-expanded","false");
      trigger.removeAttribute("aria-activedescendant");
      options.forEach(option=>delete option.dataset.active);
      if(focus)trigger.focus();
    }
    function open(){
      if(trigger.disabled)return;
      active=Math.max(0,options.findIndex(option=>option.dataset.menuValue===trigger.value));
      menu.hidden=false;trigger.focus();trigger.setAttribute("aria-expanded","true");highlight();
    }
    function select(){choose(options[active].dataset.menuValue);close(true)}
    trigger.addEventListener("click",()=>menu.hidden?open():close());
    trigger.addEventListener("keydown",event=>{
      const key=event.key;
      if(["ArrowDown","ArrowUp","Home","End"].includes(key)){
        event.preventDefault();if(trigger.disabled)return;if(menu.hidden)open();
        active=key==="Home"?0:key==="End"?options.length-1:
          (active+(key==="ArrowDown"?1:-1)+options.length)%options.length;
        highlight();
      }else if(key==="Enter"||key===" "){
        event.preventDefault();if(trigger.disabled)return;if(menu.hidden)open();else select();
      }else if(key==="Escape"&&!menu.hidden){event.preventDefault();close(true)}
      else if(key==="Tab")close();
    });
    options.forEach((option,index)=>{
      option.addEventListener("click",()=>{active=index;select()});
      option.addEventListener("pointermove",()=>{if(!menu.hidden){active=index;highlight()}});
    });
    document.addEventListener("pointerdown",event=>{
      if(control.contains(event.target))return;
      if(!menu.hidden)close();
      if(document.activeElement===trigger)trigger.blur();
    },true);
    document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!menu.hidden)close(true)});
    return {close,sync(value){trigger.value=value;options.forEach(option=>option.setAttribute("aria-selected",String(option.dataset.menuValue===value)))}};
  };
  const tablist=document.querySelector(".app-competition-tabs");
  if(!tablist)return;
  const views=["standings","fixtures","stats","history","rules","awards"];
  const tabs=[...tablist.querySelectorAll('[role="tab"]')];
  // Safari may briefly restore touch focus to the active tab when a modal closes.
  for(const tab of tabs)if(tab.style)tab.style.webkitTapHighlightColor="transparent";
  const panels=tabs.map(tab=>document.getElementById(tab.getAttribute("aria-controls")));
  const season=document.getElementById("app-competition-season");
  const seasonMenu=document.getElementById("app-competition-season-menu");
  const seasonValue=document.getElementById("app-competition-season-value");
  const unavailable=document.getElementById("app-competition-season-unavailable");
  if(tabs.length!==6||panels.some(panel=>!panel)||!season||!unavailable||!seasonMenu||!seasonValue)return;
  const listeners=new Set();let state;
  function syncTabOverflow(){
    const maximum=Math.max(0,tablist.scrollWidth-tablist.clientWidth);
    tablist.dataset.canScrollLeft=String(maximum>1&&tablist.scrollLeft>1);
    tablist.dataset.canScrollRight=String(maximum>1&&tablist.scrollLeft<maximum-1);
  }
  function revealSelectedTab(){
    const tab=tabs[views.indexOf(state?.view||"standings")];
    const bounds=tablist.getBoundingClientRect(),rect=tab.getBoundingClientRect();
    if(rect.left<bounds.left+16)tablist.scrollLeft+=rect.left-bounds.left-16;
    else if(rect.right>bounds.right-16)tablist.scrollLeft+=rect.right-bounds.right+16;
    syncTabOverflow();
  }
  const tabScrollKey="football-architect:competition-tabs-scroll:"+new URL(window.location.href).pathname;
  let restoringTabScroll=true;
  let savedTabScroll=null;
  try{const raw=sessionStorage.getItem(tabScrollKey);if(raw!==null&&Number.isFinite(Number(raw)))savedTabScroll=Math.max(0,Number(raw))}catch{}
  tablist.addEventListener("scroll",()=>{syncTabOverflow();if(restoringTabScroll)return;try{sessionStorage.setItem(tabScrollKey,String(tablist.scrollLeft))}catch{}},{passive:true});
  window.addEventListener("pagehide",()=>{if(restoringTabScroll)return;try{sessionStorage.setItem(tabScrollKey,String(tablist.scrollLeft))}catch{}});
  // Keep the selected view visible when viewport size or tab layout changes.
  window.addEventListener("resize",revealSelectedTab);
  if(typeof ResizeObserver!=="undefined")new ResizeObserver(revealSelectedTab).observe(tablist);
  let pendingDefaultMatchday=!new URL(window.location.href).searchParams.has("matchday");
  // Seasons 2–4 are isolated DEV previews, never public competition seasons.
  const devSeasons=(document.documentElement.dataset.faDevSeasons||"").split(",").filter(x=>/^[1-9]\d*$/.test(x));
  const availableSeasons=[...new Set(["1",...devSeasons])];
  const latestSeason=availableSeasons.reduce((a,b)=>Number(a)>Number(b)?a:b);
  // Season 1 is a provisional display context, not an official calendar/history.
  function read(){
    const params=new URL(window.location.href).searchParams;
    const id=params.get("season"),round=params.get("matchday");
    return {season:/^[1-9]\d{0,8}$/.test(id||"")?id:latestSeason,
      view:views.includes(params.get("view"))?params.get("view"):"standings",
      matchday:/^(?:[1-9]|[12]\d|30)$/.test(round||"")?Number(round):1};
  }
  function apply(next,{replace=false,focus=false}={}){
    state={...next};
    const url=new URL(window.location.href);
    url.pathname=url.pathname.replace(/\/index\.html$/,"").replace(/\/+$/,"");
    url.search="";url.hash="";
    url.searchParams.set("season",state.season);url.searchParams.set("view",state.view);
    if(state.view==="fixtures")url.searchParams.set("matchday",String(state.matchday));
    if(url.href!==window.location.href)window.history[replace?"replaceState":"pushState"](null,"",url.href);
    const index=views.indexOf(state.view),available=availableSeasons.includes(state.season);
    document.documentElement.dataset.competitionView=state.view;
    document.documentElement.dataset.competitionSeasonUnavailable=String(!available);
    seasonPicker.sync(available?state.season:"");seasonPicker.close();unavailable.hidden=available;
    seasonValue.textContent=available?state.season:unavailable.textContent;
    if(available)seasonValue.removeAttribute("data-app-i18n");
    else seasonValue.setAttribute("data-app-i18n","competitionSeasonUnavailable");
    for(let i=0;i<tabs.length;i++){
      const active=i===index;
      tabs[i].setAttribute("aria-selected",String(active));tabs[i].tabIndex=active?0:-1;
      tabs[i].classList.toggle("is-active",active);panels[i].hidden=!active||!available;
    }
    if(focus)tabs[index].focus({preventScroll:true});
    if(focus||!restoringTabScroll)revealSelectedTab();
    for(const listener of listeners)listener({...state});
    // Notify DEV enhancements even when they initialize before this router.
    window.dispatchEvent(new CustomEvent("fa:competition-route-change",{detail:{...state}}));
  }
  function set(patch,options){
    if(Object.hasOwn(patch,"matchday"))pendingDefaultMatchday=false;
    const next={...state,...patch};
    if(!views.includes(next.view)||!/^[1-9]\d{0,8}$/.test(next.season)||
      !Number.isInteger(next.matchday)||next.matchday<1||next.matchday>30)return;
    apply(next,options);
  }
  window.faCompetitionRoute={get:()=>({...state}),set,
    defaultMatchday(round){
      if(!pendingDefaultMatchday||state.view!=="fixtures"||!(availableSeasons.includes(state.season)))return;
      pendingDefaultMatchday=false;
      if(Number.isInteger(round)&&round>=1&&round<=30)apply({...state,matchday:round},{replace:true});
    },
    subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn)}};
  tabs.forEach((tab,index)=>{
    tab.addEventListener("click",()=>set({view:views[index]}));
    tab.addEventListener("keydown",event=>{
      let next=index;
      if(event.key==="ArrowRight")next=(index+1)%tabs.length;
      else if(event.key==="ArrowLeft")next=(index-1+tabs.length)%tabs.length;
      else if(event.key==="Home")next=0;
      else if(event.key==="End")next=tabs.length-1;
      else return;
      event.preventDefault();set({view:views[next]},{focus:true});
    });
  });
  // The checked-in competition markup has the season 1 option only.
  // Add available DEV seasons without duplicating the menu in all generated pages.
  for(const value of availableSeasons.filter(value=>!seasonMenu.querySelector(`[data-menu-value="${value}"]`))){
    const option=document.createElement("div");
    option.id="app-competition-season-option-"+value;
    option.className="language-option";
    option.setAttribute("role","option");
    option.dataset.menuValue=value;
    option.setAttribute("aria-selected","false");
    option.textContent=value;
    seasonMenu.append(option);
  }
  // Show the newest available season first, including DEV-only seasons.
  [...seasonMenu.querySelectorAll("[data-menu-value]")]
    .sort((a,b)=>Number(b.dataset.menuValue)-Number(a.dataset.menuValue))
    .forEach(option=>seasonMenu.append(option));
  const seasonPicker=window.faBindCompetitionMenu(season,seasonMenu,
    [...seasonMenu.querySelectorAll("[data-menu-value]")],value=>set({season:value}),
    document.getElementById("app-competition-season-control"));
  window.addEventListener("popstate",()=>{
    pendingDefaultMatchday=false;
    apply(read(),{replace:true});
  });
  apply(read(),{replace:true});
  const restoreTabScroll=()=>{
    if(savedTabScroll!==null)tablist.scrollLeft=Math.min(savedTabScroll,Math.max(0,tablist.scrollWidth-tablist.clientWidth));
    syncTabOverflow();
  };
  const scheduleFrame=typeof window.requestAnimationFrame==="function"?window.requestAnimationFrame.bind(window):callback=>callback();
  restoreTabScroll();
  scheduleFrame(()=>{
    restoreTabScroll();
    scheduleFrame(()=>{
      restoreTabScroll();
      restoringTabScroll=false;
      // Keep the route-selected tab visible after restoring the previous strip offset.
      revealSelectedTab();
      if(document.documentElement.dataset.faDevSeasons)document.documentElement.dataset.faTabsRestored="true";
    });
  });
})();

// History record scope is shared by the public empty state and the DEV preview.
(() => {
 const panel=document.getElementById("competition-panel-history");if(!panel?.querySelectorAll)return;
 const sync=()=>{
  const scope=panel.dataset.historyRecordScope==="all-time"?"all-time":"season";
  panel.dataset.historyRecordScope=scope;
  for(const button of panel.querySelectorAll('[data-history-record-scope]'))button.setAttribute("aria-pressed",String(button.dataset.historyRecordScope===scope));
  for(const element of panel.querySelectorAll('[data-history-scope]'))element.hidden=element.dataset.historyScope!==scope;
 };
 panel.addEventListener("click",event=>{
  const button=event.target.closest('[data-history-record-scope]');if(!button||!panel.contains(button))return;
  const scroller=panel.closest?.(".fa-shell-content-scroll"),top=scroller?.scrollTop,left=scroller?.scrollLeft;
  // Keep the scroll range while old cards disappear and a shorter group replaces them.
  for(const grid of panel.querySelectorAll('.app-competition-stat-grid')){
   const height=grid.getBoundingClientRect().height;if(height>0)grid.style.minHeight=height+"px";
  }
  panel.dataset.historyRecordScope=button.dataset.historyRecordScope;sync();
  if(scroller){scroller.scrollTop=top;scroller.scrollLeft=left;}
 });
 window.addEventListener?.("resize",()=>{
  for(const grid of panel.querySelectorAll('.app-competition-stat-grid'))grid.style.minHeight="";
 });
 window.faSyncHistoryRecords=sync;sync();
})();


/* HISTORY-UI-11 player record contract: no fictional or incomplete data. */
(() => {
  "use strict";
  const panel=document.getElementById("competition-panel-history");
  if(!panel)return;
  const competitionId=document.querySelector('meta[name="fa-division"]')?.content;
  const fields={
    seasonGoals:["goals",true],seasonAssists:["assists",true],
    seasonCleanSheets:["cleanSheets",true],
    totalGoals:["goals",false],totalAssists:["assists",false],
    totalAppearances:["appearances",false],totalCleanSheets:["cleanSheets",false]
  };
  const translations={
    en:{many:"Multiple clubs",seasons:"Multiple seasons",holders:"record holders",
      close:"Close",details:"View record details",season:"Season",unknown:"Club unavailable"},
    de:{many:"Mehrere Vereine",seasons:"Mehrere Saisons",holders:"Rekordhalter",
      close:"Schließen",details:"Rekorddetails anzeigen",season:"Saison",unknown:"Verein unbekannt"},
    es:{many:"Varios clubes",seasons:"Varias temporadas",holders:"récord compartido",
      close:"Cerrar",details:"Ver detalles del récord",season:"Temporada",unknown:"Club no disponible"},
    fr:{many:"Plusieurs clubs",seasons:"Plusieurs saisons",holders:"détenteurs du record",
      close:"Fermer",details:"Voir les détails du record",season:"Saison",unknown:"Club indisponible"},
    it:{many:"Più club",seasons:"Più stagioni",holders:"detentori del record",
      close:"Chiudi",details:"Mostra i dettagli del record",season:"Stagione",unknown:"Club non disponibile"}
  };
  const locale=()=>translations[document.documentElement.lang]||translations.en;
  const key=id=>String(id);
  const safeInt=value=>Number.isSafeInteger(value)&&value>=0;
  const compare=(a,b)=>a.name.localeCompare(b.name,"en",{sensitivity:"base"})||
    key(a.id).localeCompare(key(b.id),"en");
  let results=null,dialog=null,returnFocus=null,lockedScroll=null,oldOverflow="";
  function compute(payload){
    if(!payload||payload.source!=="canonical"||payload.competitionId!==competitionId||
      payload.coverage!=="complete"||!payload.provenance?.approved||
      !Array.isArray(payload.seasons))throw Error("Unapproved or incomplete player history");
    const seenSeasons=new Set(),individual=new Map(),totals=new Map();
    for(const season of payload.seasons){
      if(!safeInt(season.seasonId)||!season.seasonId||seenSeasons.has(season.seasonId)||
        season.status!=="completed"||season.dataStatus!=="approved"||
        season.playerStatsComplete!==true||!Array.isArray(season.playerStats))
        throw Error("Invalid completed player season");
      seenSeasons.add(season.seasonId);
      const seenRows=new Set();
      for(const row of season.playerStats){
        if(!(typeof row.playerId==="string"&&row.playerId.trim()||
             Number.isSafeInteger(row.playerId))||
           typeof row.playerName!=="string"||!row.playerName.trim()||
           !Number.isSafeInteger(row.clubId)||row.clubId<1||
           Object.keys(fields).some(metric=>!safeInt(row[fields[metric][0]])))
          throw Error("Incomplete player statistics");
        const rowId=JSON.stringify([row.playerId,row.clubId]);
        if(seenRows.has(rowId))throw Error("Duplicate player/club/season");
        seenRows.add(rowId);
        const personId=key(row.playerId),seasonKey=JSON.stringify([personId,season.seasonId]);
        const add=(map,id)=>{
          if(!map.has(id))map.set(id,{id:personId,name:row.playerName,goals:0,assists:0,
            appearances:0,cleanSheets:0,clubs:[]});
          const entry=map.get(id);
          if(entry.name!==row.playerName)throw Error("Conflicting player identity");
          for(const stat of ["goals","assists","appearances","cleanSheets"])
            entry[stat]+=row[stat];
          entry.clubs.push({clubId:row.clubId,season:season.seasonId});
        };
        add(individual,seasonKey);add(totals,personId);
      }
    }
    const output={};
    for(const [metric,[field,seasonal]] of Object.entries(fields)){
      const entries=[...(seasonal?individual:totals).values()];
      if(!entries.length){output[metric]=null;continue;}
      const value=Math.max(...entries.map(row=>row[field]));
      const tied=new Map();
      for(const row of entries.filter(row=>row[field]===value)){
        if(!tied.has(row.id))tied.set(row.id,{id:row.id,name:row.name,clubs:[]});
        const holder=tied.get(row.id),seen=new Set(holder.clubs.map(
          item=>JSON.stringify([item.clubId,item.season])));
        for(const club of row.clubs){
          const id=JSON.stringify([club.clubId,club.season]);
          if(!seen.has(id)){holder.clubs.push(club);seen.add(id);}
        }
      }
      const holders=[...tied.values()].sort(compare);
      for(const holder of holders)holder.clubs.sort((a,b)=>a.season-b.season||a.clubId-b.clubId);
      output[metric]={value,holders};
    }
    return output;
  }
  function element(tag,className,text){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=String(text);
    return node;
  }
  function clubName(id){
    return window.faCompetitionDivision?.clubs?.find(club=>club.clubId===id)?.primaryName||null;
  }
  function details(holder){
    const label=locale(),ids=[...new Set(holder.clubs.map(item=>item.clubId))];
    if(ids.length>1)return label.many;
    const club=ids.length===1?clubName(ids[0]):null;
    const seasons=[...new Set(holder.clubs.map(item=>item.season))];
    return [club,seasons.length===1?label.season+" "+seasons[0]:seasons.length>1?label.seasons:null]
      .filter(Boolean).join(" · ");
  }
  function render(){
    for(const card of panel.querySelectorAll("[data-history-player-record]")){
      const metric=card.dataset.historyPlayerRecord;
      const record=results?.[metric]||null;
      const title=card.querySelector("h5");
      if(!title)continue;
      card.replaceChildren(title);
      card.classList.add("app-history-player-card");
      card.dataset.historyFilled=String(!!record);
      if(!record){
        const empty=element("span","app-competition-empty","No historical player data available yet.");
        empty.dataset.appI18n="historyPlayerNoData";card.append(empty);continue;
      }
      card.append(element("strong","app-competition-stat-value",record.value));
      const holder=record.holders[0];
      const footer=element("div","app-history-player-footer");
      const line=element("div","app-history-player-name-row");
      line.append(element("span","app-history-player-name",holder.name));
      if(record.holders.length>1){
        const plus=element("button","app-history-player-detail","+"+(record.holders.length-1));
        plus.type="button";plus.dataset.historyDetail=metric;
        plus.setAttribute("aria-label",locale().details+": "+record.holders.length+" "+locale().holders);
        line.append(plus);
      }
      footer.append(line);
      const context=details(holder);
      if(context){
        if(new Set(holder.clubs.map(item=>item.clubId)).size>1&&record.holders.length===1){
          const button=element("button","app-history-player-context app-history-player-context-button",context);
          button.type="button";button.dataset.historyDetail=metric;
          button.setAttribute("aria-label",locale().details);
          footer.append(button);
        }else footer.append(element("span","app-history-player-context",context));
      }
      card.append(footer);
    }
    window.faAppRenderLanguage?.();
  }
  function close(){
    if(dialog?.open)dialog.close();
  }
  function open(metric,source){
    const record=results?.[metric];if(!record)return;
    if(!dialog){
      dialog=element("dialog","app-history-player-dialog");
      dialog.addEventListener("click",event=>{if(event.target===dialog)close();});
      dialog.addEventListener("close",()=>{
        if(lockedScroll){lockedScroll.style.overflow=oldOverflow;lockedScroll=null;}
        returnFocus?.focus({preventScroll:true});returnFocus=null;
      });
      document.body.append(dialog);
    }
    const card=source.closest("[data-history-player-record]");
    const title=card?.querySelector("h5")?.textContent||"";
    dialog.replaceChildren();
    const header=element("div","app-history-player-dialog-header");
    const heading=element("h3","",title);heading.id="app-history-player-dialog-title";
    dialog.setAttribute("aria-labelledby",heading.id);
    const exit=element("button","app-history-player-close","×");
    exit.type="button";exit.setAttribute("aria-label",locale().close);exit.addEventListener("click",close);
    header.append(heading,exit);dialog.append(header);
    const summary=element("div","app-history-player-dialog-value");
    summary.append(element("strong","",record.value),
      element("span","",record.holders.length+" "+locale().holders));
    dialog.append(summary);
    const list=element("ol","app-history-player-holders");
    for(const holder of record.holders){
      const li=element("li","");
      li.append(element("strong","",holder.name));
      const groups=new Map();
      for(const item of holder.clubs){
        if(!groups.has(item.clubId))groups.set(item.clubId,new Set());
        groups.get(item.clubId).add(item.season);
      }
      const clubs=element("ul","app-history-player-clubs");
      for(const [clubId,seasons] of groups){
        const line=element("li","",clubName(clubId)||locale().unknown);
        line.append(element("span","", " · "+[...seasons].sort((a,b)=>a-b)
          .map(season=>locale().season+" "+season).join(", ")));
        clubs.append(line);
      }
      li.append(clubs);list.append(li);
    }
    dialog.append(list);
    returnFocus=source;
    lockedScroll=document.querySelector(".fa-shell-content-scroll");
    if(lockedScroll){oldOverflow=lockedScroll.style.overflow;lockedScroll.style.overflow="hidden";}
    dialog.showModal();exit.focus({preventScroll:true});
  }
  panel.addEventListener("click",event=>{
    const trigger=event.target.closest("[data-history-detail]");
    if(trigger&&panel.contains(trigger))open(trigger.dataset.historyDetail,trigger);
  });
  const previous=window.faSyncHistoryRecords;
  window.faSyncHistoryRecords=()=>{previous?.();render();};
  window.faHistoryPlayerRecords=Object.freeze({
    // The caller must supply approved, complete canonical player statistics.
    // The existing DEV fixture generator contains no player-level statistics.
    applyCanonicalHistory(payload){const checked=compute(payload);results=checked;render();},
    clear(){results=null;render();}
  });
  render();
})();
