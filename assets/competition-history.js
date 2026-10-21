// History record scope is shared by the public empty state and the DEV preview.
(() => {
 const panel=document.getElementById("competition-panel-history");if(!panel?.querySelectorAll)return;
 const sync=()=>{
  const scope=panel.dataset.historyRecordScope==="all-time"?"all-time":"season";
  panel.dataset.historyRecordScope=scope;
  for(const button of panel.querySelectorAll('[data-history-record-scope]'))button.setAttribute("aria-pressed",String(button.dataset.historyRecordScope===scope));
  for(const element of panel.querySelectorAll('[data-history-scope]'))element.hidden=element.dataset.historyScope!==scope;
  // When no verified records exist for the selected scope, replace an entire
  // empty grid with a single localized status. This also covers public History.
  for(const group of panel.querySelectorAll('[data-history-team-records]')){
   const grid=group.querySelector?.('.app-competition-stat-grid');if(!grid)continue;
   const records=[...grid.querySelectorAll('.app-competition-stat-card[data-history-scope]')];
   const hasRecords=records.some(card=>card.dataset.historyScope===scope&&
    card.querySelector('.app-competition-stat-value'));
   let empty=group.querySelector('[data-history-team-empty]');
   if(!empty){
    empty=document.createElement('p');empty.className='app-competition-status app-history-record-empty-state';
    empty.dataset.appI18n='historyNoData';empty.dataset.historyTeamEmpty='';
    group.append(empty);
   }
   grid.hidden=!hasRecords;empty.hidden=hasRecords;
  }
 };
 panel.addEventListener("click",event=>{
  const button=event.target.closest('[data-history-record-scope]');if(!button||!panel.contains(button))return;
  const scroller=panel.closest?.(".fa-shell-content-scroll"),top=scroller?.scrollTop,left=scroller?.scrollLeft;
  // Use the selected scope's natural grid height: Player records must directly
  // follow Team records instead of inheriting the taller scope's empty space.
  panel.dataset.historyRecordScope=button.dataset.historyRecordScope;sync();
  if(scroller){scroller.scrollTop=top;scroller.scrollLeft=left;}
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
    en:{many:"Multiple clubs",seasons:"Multiple seasons",holder:"record holder",holders:"record holders",
      close:"Close",details:"View record details",season:"Season",unknown:"Club unavailable"},
    de:{many:"Mehrere Vereine",seasons:"Mehrere Saisons",holder:"Rekordhalter",holders:"Rekordhalter",
      close:"Schließen",details:"Rekorddetails anzeigen",season:"Saison",unknown:"Verein unbekannt"},
    es:{many:"Varios clubes",seasons:"Varias temporadas",holder:"titular del récord",holders:"titulares del récord",
      close:"Cerrar",details:"Ver detalles del récord",season:"Temporada",unknown:"Club no disponible"},
    fr:{many:"Plusieurs clubs",seasons:"Plusieurs saisons",holder:"détenteur du record",holders:"détenteurs du record",
      close:"Fermer",details:"Voir les détails du record",season:"Saison",unknown:"Club indisponible"},
    it:{many:"Più club",seasons:"Più stagioni",holder:"detentore del record",holders:"detentori del record",
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
        plus.setAttribute("aria-label",locale().details+": "+record.holders.length+" "+(record.holders.length===1?locale().holder:locale().holders));
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
    // In the absence of approved player data, one message replaces seven
    // identical empty cards. Preserve the cards for later canonical hydration.
    for(const group of panel.querySelectorAll('[data-history-player-records]')){
      const grid=group.querySelector('.app-competition-stat-grid');
      if(!grid)continue;
      const filled=[...group.querySelectorAll('[data-history-player-record]')]
        .some(card=>card.dataset.historyFilled==='true');
      let empty=group.querySelector('[data-history-player-empty]');
      if(!empty){
        empty=element('p','app-competition-status app-history-record-empty-state','No historical player data available yet.');
        empty.dataset.appI18n='historyPlayerNoData';
        empty.dataset.historyPlayerEmpty='';
        group.append(empty);
      }
      grid.hidden=!filled;empty.hidden=filled;
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
        const line=element("li","");
        const name=clubName(clubId),division=window.faCompetitionDivision;
        if(name&&division?.countryId){
          const link=element("a","app-world-standing-club-link",name);
          link.href="/clubs/"+division.countryId.toLowerCase()+"/"+clubId+"/overview";
          line.append(link);
        }else line.append(element("span","",name||locale().unknown));
        for(const season of [...seasons].sort((a,b)=>a-b)){
          line.append(document.createTextNode(" · "));
          const link=element("a","app-world-standing-club-link",locale().season+" "+season);
          link.href=location.pathname+"?season="+encodeURIComponent(season);
          line.append(link);
        }
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
