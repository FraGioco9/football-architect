// History record scope is shared by the public empty state and the DEV preview.
(() => {
 const panel=document.getElementById("competition-panel-history");if(!panel?.querySelectorAll)return;
 const sync=()=>{
  const scope=panel.dataset.historyRecordScope==="all-time"?"all-time":"season";
  panel.dataset.historyRecordScope=scope;
  for(const button of panel.querySelectorAll('[data-history-record-scope]'))button.setAttribute("aria-pressed",String(button.dataset.historyRecordScope===scope));
  for(const element of panel.querySelectorAll('[data-history-scope]'))element.hidden=element.dataset.historyScope!==scope;
  // Hide empty record grids only once the selected scope is known; the
  // loading skeleton is managed separately until the provider settles.
  // Every populated team and player card owns a verified numeric value.
  for(const [groupSelector,emptySelector,translation] of [
   ['[data-history-team-records]','[data-history-team-empty]','historyNoData'],
   ['[data-history-player-records]','[data-history-player-empty]','historyPlayerNoData']
  ]){
   for(const group of panel.querySelectorAll(groupSelector)){
    const grid=group.querySelector?.('.app-competition-stat-grid');if(!grid)continue;
    let empty=group.querySelector(emptySelector);
    if(!empty){
     empty=document.createElement('p');
     empty.className='app-competition-status app-history-record-empty-state';
     empty.dataset.appI18n=translation;
     if(groupSelector==='[data-history-team-records]')empty.dataset.historyTeamEmpty='';
     else empty.dataset.historyPlayerEmpty='';
     group.append(empty);
    }
    const filled=[...group.querySelectorAll('[data-history-scope]')].some(card=>
     card.dataset.historyScope===scope&&!!card.querySelector('.app-competition-stat-value'));
    grid.hidden=!filled;empty.hidden=filled;
   }
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
  if(!panel&&!document.getElementById("club-page"))return;
  const competitionId=window.faCompetitionContext?.definition.id||document.querySelector('meta[name="fa-competition"]')?.content;
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
  function clubKey(row,definition){
    if(typeof row.clubId==='string'&&/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/.test(row.clubId))return row.clubId;
    const country=row.countryId||(definition?.category==='domestic'?definition.countryId:null);
    return window.faCompetitionModel.countries.includes(country)&&Number.isSafeInteger(row.clubId)&&row.clubId>=1&&row.clubId<=40?country+'-'+row.clubId:null;
  }
  const compare=(a,b)=>a.name.localeCompare(b.name,"en",{sensitivity:"base"})||
    key(a.id).localeCompare(key(b.id),"en");
  let partial=false;
  let results=null,dialog=null,returnFocus=null,lockedScroll=null,oldOverflow="",previousPresentation=null,previousCards=null;
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
      const definition=window.faCompetitionContext?.currentDefinition||window.faCompetitionContext?.definition;
      // The pre-snapshot canonical player-history contract is a known domestic
      // legacy format only after the provenance/completeness checks above.
      const record=definition?.category==='domestic'&&!Object.hasOwn(season,'rulesSnapshot')&&season.rulesVersion===undefined
        ?{...season,formatId:'domestic-league-v1'}:season;
      if(!window.faCompetitionModel?.resolveSeasonRules(definition,record))throw Error('Unavailable historical rules');
      const seenRows=new Set();
      for(const row of season.playerStats){
        const identity=clubKey(row,definition);
        if(!(typeof row.playerId==="string"&&row.playerId.trim()||
             Number.isSafeInteger(row.playerId))||
           typeof row.playerName!=="string"||!row.playerName.trim()||
           !identity||
           Object.keys(fields).some(metric=>!safeInt(row[fields[metric][0]])))
          throw Error("Incomplete player statistics");
        const rowId=JSON.stringify([row.playerId,identity]);
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
          entry.clubs.push({clubId:identity,season:season.seasonId});
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
      for(const holder of holders)holder.clubs.sort((a,b)=>a.season-b.season||a.clubId.localeCompare(b.clubId));
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
    const context=window.faCompetitionContext;
    const clubs=context?.seasonData?.participants||(context?.definition.category==='domestic'?window.faCompetitionDivision?.clubs:[])||[];
    return clubs.find(club=>club.countryId+'-'+club.clubId===id)?.primaryName||null;
  }
  function clubLink(id,name=clubName(id)){
    const [country,number]=id.split("-");
    const link=element("a","app-world-standing-club-link",name||id);
    link.href=window.faRoutesRegistry.buildRoute({kind:"club",country:country.toLowerCase(),id:number,view:"overview"});
    return link;
  }
  function seasonLink(season){
    const link=element("a","app-world-standing-club-link app-history-season",locale().season+" "+season);
    const id=competitionId.toLowerCase();
    const route=window.faRoutesRegistry.parseRoute("/competitions/"+id+"/standings");
    link.href=window.faRoutesRegistry.buildRoute({kind:route.kind,id,view:"standings"})+"?season="+season;
    return link;
  }
  function portrait(id){
    const slot=element("span","fa-dev-stats-player-portrait");
    slot.setAttribute("aria-hidden","true");
    slot.dataset.portraitState="missing";
    if(!/^[1-9]\d*$/.test(id))return slot;
    const image=element("img","");
    image.alt="";image.loading="lazy";image.decoding="async";
    slot.dataset.portraitState="loading";
    image.onload=()=>{slot.dataset.portraitState="ready";};
    image.onerror=()=>{slot.dataset.portraitState="missing";image.removeAttribute("src");};
    image.src="/assets/players/portraits/"+id+".webp";
    slot.append(image);return slot;
  }
  function responsivePlayerName(node){
    const full=node.textContent.trim();
    const parts=/^(\S+)\s+(.+)$/u.exec(full);
    if(!parts||/^\p{L}\.$/u.test(parts[1]))return node;
    const short=Array.from(parts[1])[0]+". "+parts[2];
    node.setAttribute("aria-label",full);
    node.replaceChildren(element("span","fa-player-full-name",full),element("span","fa-player-short-name",short));
    return node;
  }
  function playerLabel(holder,tag,cls){
    if(!/^[1-9]\d*$/.test(holder.id))return responsivePlayerName(element(tag,cls,holder.name));
    const link=element("a",(cls+" app-world-standing-club-link").trim(),holder.name);
    link.href=window.faRoutesRegistry.buildRoute({kind:"player",id:Number(holder.id)});
    return responsivePlayerName(link);
  }
  function render(){
    const context=window.faCompetitionContext;
    const clubs=context?.seasonData?.participants||(context?.definition?.category==='domestic'?window.faCompetitionDivision?.clubs:[])||[];
    const presentation=JSON.stringify([document.documentElement.lang,partial,results,clubs.map(c=>[c.countryId,c.clubId,c.primaryName])]);
    const cards=[...panel.querySelectorAll("[data-history-player-record]")];
    if(presentation===previousPresentation&&previousCards?.length===cards.length&&
      previousCards.every((card,index)=>card===cards[index])){window.faAppRenderLanguage?.();return;}
    previousPresentation=presentation;previousCards=cards;
    for(const card of cards){
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
      line.append(playerLabel(holder,"span","app-history-player-name"));
      const contexts=holder.clubs;
      if(record.holders.length>1||contexts.length>1){
        const plus=element("button","app-history-player-detail","+"+(record.holders.length>1?record.holders.length-1:contexts.length-1));
        plus.type="button";plus.dataset.historyDetail=metric;
        plus.setAttribute("aria-label",locale().details+": "+record.holders.length+" "+(record.holders.length===1?locale().holder:locale().holders));
        line.append(plus);
      }
      const labels=element("div","app-history-player-labels");
      labels.append(line);
      const item=contexts[0];
      if(item){
        const metadata=element("div","app-history-player-context");
        metadata.append(clubLink(item.clubId));
        labels.append(metadata);
      }
      footer.append(portrait(holder.id),labels);
      if(item){
        const season=seasonLink(item.season);
        season.classList.add("app-history-dev-season-link");
        footer.append(season);
      }
      card.append(footer);
    }
    // Keep the metric slots visible after an empty response.
    for(const group of panel.querySelectorAll('[data-history-player-records]')){
      const grid=group.querySelector('.app-competition-stat-grid');
      if(!grid)continue;
      let empty=group.querySelector('[data-history-player-empty]');
      if(!empty){
        empty=element('p','app-competition-status app-history-record-empty-state','No historical player data available yet.');
        empty.dataset.appI18n='historyPlayerNoData';
        empty.dataset.historyPlayerEmpty='';
        group.append(empty);
      }
      empty.dataset.appI18n=partial?"historyPlayerPartial":"historyPlayerNoData";
      const scope=panel.dataset.historyRecordScope==="all-time"?"all-time":"season";
      const filled=[...group.querySelectorAll('[data-history-player-record]')].some(card=>
       card.dataset.historyScope===scope&&card.dataset.historyFilled==="true");
      grid.hidden=!filled;empty.hidden=filled;
    }
    window.faAppRenderLanguage?.();
  }
  const animated=dialog=>typeof dialog.animate==="function"&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frames=[{opacity:0,transform:"translateY(6px)"},{opacity:1,transform:"translateY(0)"}];
  const closing=new WeakSet();
  function showDialog(node){
    node.showModal();
    if(animated(node))node.animate(frames,{duration:160,easing:"ease-out"});
  }
  function closeDialog(node){
    if(!node.open||closing.has(node))return;
    if(!animated(node)){node.close();return;}
    closing.add(node);
    node.animate(frames,{direction:"reverse",duration:130,easing:"ease-in",fill:"backwards"}).finished
      .catch(()=>{}).then(()=>{closing.delete(node);if(node.open)node.close();});
  }
  function dialogHeader(title){
    const header=element("div","app-history-player-dialog-header");
    const heading=element("h3","",title);
    const close=element("button","app-search-close app-history-player-close");
    close.type="button";
    close.setAttribute("aria-label",locale().close);
    close.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    header.append(heading,close);
    return {header,heading,close};
  }
  // Shared modal for verified club ties in both DEV previews and normal History.
  // Keep formatting, focus, modal animations and scroll handling identical.
  function openClubDialog({title,value,entries,trigger,identity,seasonLink}){
    if(!Array.isArray(entries)||!entries.length)return;
    const grouped=new Map();
    for(const {club,season} of entries){
      if(!club)continue;
      const key=String(club.countryId)+"-"+String(club.clubId);
      if(!grouped.has(key))grouped.set(key,{club,seasons:new Set()});
      if(Number.isSafeInteger(season))grouped.get(key).seasons.add(season);
    }
    if(!grouped.size)return;
    const node=element("dialog","app-history-player-dialog app-history-club-dialog");
    const {header,heading,close}=dialogHeader(title);
    heading.id="app-history-club-dialog-title";
    node.setAttribute("aria-labelledby",heading.id);
    node.append(header);
    const summary=element("div","app-history-player-dialog-value");
    const count=element("span");
    count.append(document.createTextNode(grouped.size+" "));
    const unit=element("span");
    unit.dataset.appI18n=grouped.size===1?"historyClubSingular":"rulesClubs";
    count.append(unit);
    summary.append(element("strong","",value),count);
    node.append(summary);
    const list=element("ol","app-history-player-holders app-history-club-holders");
    for(const {club,seasons} of grouped.values()){
      const li=element("li");
      const visual=identity(club);
      const row=element("div","app-history-dialog-club");
      const info=element("div","app-history-dialog-club-info");
      const name=visual.querySelector(".app-world-club-name");
      const crest=visual.querySelector(".app-world-club-crest-placeholder");
      if(name)info.append(name);
      if(seasons.size){
        const meta=element("div","app-history-dialog-club-seasons");
        for(const [index,season] of [...seasons].sort((a,b)=>a-b).entries()){
          if(index)meta.append(document.createTextNode(" · "));
          meta.append(seasonLink(season));
        }
        info.append(meta);
      }
      if(crest)row.append(crest);
      row.append(info);li.append(row);list.append(li);
    }
    node.append(list);
    const scroll=document.querySelector(".fa-shell-content-scroll");
    const previousOverflow=scroll?.style.overflow;
    const dismiss=()=>closeDialog(node);
    close.addEventListener("click",dismiss);
    node.addEventListener("cancel",event=>{event.preventDefault();dismiss();});
    node.addEventListener("click",event=>{if(event.target===node)dismiss();});
    node.addEventListener("close",()=>{
      if(scroll)scroll.style.overflow=previousOverflow;
      node.remove();trigger?.focus?.({preventScroll:true});
    },{once:true});
    document.body.append(node);
    window.faAppRenderLanguage?.();
    if(scroll)scroll.style.overflow="hidden";
    showDialog(node);close.focus({preventScroll:true});
  }
  window.faHistoryDialog={show:showDialog,close:closeDialog,header:dialogHeader,openClubs:openClubDialog};
  function close(){if(dialog)closeDialog(dialog);}
  function openPlayers(record,source,{showClub=true}={}){
    if(!record?.holders?.length)return;
    if(!dialog){
      dialog=element("dialog","app-history-player-dialog");
      dialog.addEventListener("cancel",event=>{event.preventDefault();close();});
      dialog.addEventListener("click",event=>{if(event.target===dialog)close();});
      dialog.addEventListener("close",()=>{
        if(lockedScroll){lockedScroll.style.overflow=oldOverflow;lockedScroll=null;}
        returnFocus?.focus({preventScroll:true});returnFocus=null;
      });
      document.body.append(dialog);
    }
    const card=source.closest("article")||source.closest("[data-history-player-record]");
    const title=card?.querySelector("h5")?.textContent||"";
    dialog.replaceChildren();
    const {header,heading,close:exit}=dialogHeader(title);
    heading.id="app-history-player-dialog-title";
    dialog.setAttribute("aria-labelledby",heading.id);
    exit.addEventListener("click",close);
    dialog.append(header);
    const summary=element("div","app-history-player-dialog-value");
    summary.append(element("strong","",record.value),
      element("span","",record.holders.length+" "+locale().holders));
    dialog.append(summary);
    const list=element("ol","app-history-player-holders");
    for(const holder of record.holders){
      const li=element("li","");
      const identity=element("div","app-history-dialog-player");
      const info=element("div","app-history-dialog-player-info");
      info.append(playerLabel(holder,"strong",""));
      const groups=new Map();
      for(const item of holder.clubs){
        if(!groups.has(item.clubId))groups.set(item.clubId,new Set());
        groups.get(item.clubId).add(item.season);
      }
      const clubs=element("ul","app-history-player-clubs");
      for(const [clubId,seasons] of groups){
        const line=element("li","");
        if(showClub)line.append(clubLink(clubId));
        for(const season of [...seasons].filter(Number.isSafeInteger).sort((a,b)=>a-b)){
          if(line.hasChildNodes())line.append(document.createTextNode(" · "));
          line.append(showClub?seasonLink(season):locale().season+" "+season);
        }
        if(line.hasChildNodes())clubs.append(line);
      }
      if(clubs.hasChildNodes())info.append(clubs);
      identity.append(portrait(holder.id),info);
      li.append(identity);list.append(li);
    }
    dialog.append(list);
    returnFocus=source;
    lockedScroll=document.querySelector(".fa-shell-content-scroll");
    if(lockedScroll){oldOverflow=lockedScroll.style.overflow;lockedScroll.style.overflow="hidden";}
    showDialog(dialog);exit.focus({preventScroll:true});
  }
  window.faHistoryPlayerUI={portrait,openPlayers,responsivePlayerName};
  if(!panel)return;
  panel.addEventListener("click",event=>{
    const trigger=event.target.closest("[data-history-detail]");
    if(trigger&&panel.contains(trigger))openPlayers(results?.[trigger.dataset.historyDetail],trigger);
  });
  const previous=window.faSyncHistoryRecords;
  window.faSyncHistoryRecords=()=>{previous?.();render();};
  window.faHistoryPlayerRecords=Object.freeze({
    // The caller must supply approved, complete canonical player statistics.
    // The existing DEV fixture generator contains no player-level statistics.
    applyCanonicalHistory(payload){const checked=compute(payload);results=checked;render();},
    applyRecordSeasons(seasons){
      results={};
      partial=seasons.some(s=>s.playerCoverage===false||!Array.isArray(s.players));
      for(const [field,suffix] of [["goals","Goals"],["appearances","Appearances"],["contributions","Contributions"],["redCards","RedCards"],["assists","Assists"],["cleanSheets","CleanSheets"]]){
        for(const cumulative of [false,true]){
          const entries=new Map();

          let verified=true;
          for(const season of seasons){
            for(const row of season.players||[]){
              if(row[field]==null&&field==="cleanSheets")continue;
              const amount=field==="contributions"&&safeInt(row.assists)&&safeInt(row.goals)?row.goals+row.assists:row[field];
              if(!safeInt(amount)){verified=false;break;}
              const key=cumulative?row.playerId:row.playerId+":"+season.season;
              const item=entries.get(key)||{id:row.playerId,name:null,value:0,clubs:[]};
              item.value+=amount;
              item.name=row.archivedName||item.name||"#"+row.playerId;
              item.clubs.push({clubId:row.clubKey,season:season.season});
              entries.set(key,item);
            }
          }
          if(!verified)continue;
          const value=Array.from(entries.values()).reduce((max,row)=>Math.max(max,row.value),0);
          if(value>0)results[(cumulative?"total":"season")+suffix]={verified:true,value,holders:[...entries.values()].filter(row=>row.value===value).sort(compare)};
        }
      }
      render();
    },
    clear(){partial=false;results=null;render();}
  });
  render();
})();
