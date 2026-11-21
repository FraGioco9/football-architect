/* Competition fixtures: display supplied schedules only; never generate sporting data. */
(() => {
  "use strict";
  const model=window.faCompetitionModel;
  const rules=window.faCompetitionRules;let definition=window.faCompetitionContext?.definition;
  if(!definition||!rules)return;
  let {capacity}=definition;
  let league=definition.rules.phases.find(p=>p.rankOutcomes);
  let {rounds:roundCount,matches:matchCount,matchesPerRound}=definition.metrics.phases[league.id];
  const division=window.faCompetitionDivision;
  const fields=Object.fromEntries(["toolbar","current","round","previous","next","list","empty","summary"]
    .map(key=>[key,document.getElementById("app-fixtures-"+key)]));
  if(Object.values(fields).some(field=>!field))return;
  const international=definition.category==='international';
  let clubs=new Map((division?.clubs||[]).map(club=>[international?rules.clubKey(club):club.clubId,club]));
  const navigation=window.faCompetitionRoute;
  const devSeasons=(document.documentElement.dataset.faDevSeasons||"").split(",").filter(value=>/^[1-9]\d*$/.test(value));
  const availableSeasons=new Set(["1",...devSeasons]);
  const picker=document.getElementById("app-fixtures-picker");
  const number=document.getElementById("app-fixtures-round-number");
  if(!navigation||!picker||!number)return;
  let choices=[...picker.querySelectorAll("[data-fixture-round-choice]")];
  const displayChoices=d=>window.faCompetitionRulesView.fixturesDisplayChoices(d);
  const displayValue=value=>window.faCompetitionRulesView.fixturesDisplayValue(definition,value);
  let configured=displayChoices(definition),stage=international?null:configured.find(c=>typeof c.value==='string')?.value;
  let stageKey=stage==='playout'?'competitionTabPlayout':'competitionTabPlayoffs';
  const validRound=value=>Number.isInteger(value)&&value>=1&&value<=roundCount;
  const validChoice=value=>configured.some(c=>c.value===displayValue(value));
  let knockoutPhases=definition.rules.phases.filter(p=>p.type==='knockout');
  let firstTies=knockoutPhases[0]?.ties.filter(t=>t.legs===2)||[];
  let hasFinal=knockoutPhases.some(p=>p.ties.some(t=>t.legs===1));
  let currentMatchday=null,rounds=null,postseason=[],selected=navigation.get().matchday;
  let publishedSeason=null,publishedKey=null,pendingKey=null,fetchSequence=0,publishedIds=new Set(),publishedLookup=null,publishedAbort=null;
  // Verified published match IDs are scoped by competition, season, source
  // revision and public world revision. Switching back within one unchanged
  // world must not fetch the same collection again.
  const publishedCache=new Map();
  const publishedWorldKey=(season,snapshot)=>[season,definition.id,
    snapshot?.sourceRevision,snapshot?.world?.generation,snapshot?.world?.revision].join(':');
  const rememberPublished=(key,value)=>{
    publishedCache.delete(key);publishedCache.set(key,value);
    while(publishedCache.size>8)publishedCache.delete(publishedCache.keys().next().value);
  };
  // Match navigation requires both finished UI hydration and a fully read
  // official collection. A pending request must not expose old verified IDs.
  const matchLinksReady=()=>document.documentElement.dataset.faStandingsLoading!=='true'&&pendingKey===null;
  let menuHasPostseason=false;
  // The same official list powers Fixtures, Postseason and Standings forms.
  // A reference must belong to this exact selected season and world revision.
  function officialMatchId(game,expectedSeason=Number(navigation.get().season)){
    const source=window.faWorldState?.get?.(),world=source?.world;
    if(!game||!matchLinksReady()||!Number.isSafeInteger(expectedSeason)||expectedSeason<1||
       source?.source!=='authoritative'||source.worldStatus!=='ready'||!world||
       expectedSeason!==Number(navigation.get().season)||
       publishedSeason!==String(expectedSeason)||
       publishedKey!==publishedWorldKey(expectedSeason,source)||
       !publishedLookup)return null;
    if(game.phaseId==='league'&&typeof game.sourceFixtureId==='string'){
      const official=publishedLookup.bySource[game.sourceFixtureId];
      return official&&official.phaseId==='league'&&official.round===game.round&&
        official.day===game.day&&official.marker===game.marker?official.matchId:null;
    }
    if(game.phaseId!=='league'&&typeof game.tieId==='string'&&Number.isSafeInteger(game.leg)){
      const official=publishedLookup.bySlot[[game.phaseId,game.tieId,game.leg].join(':')];
      const reserved=game.fixtureSlot===game.tieId&&game.homeId===null&&game.awayId===null;
      return official&&(reserved||official.day===game.day&&official.marker===game.marker)
        ?official.matchId:null;
    }
    // Never accept an invented numeric ID: it must occur in the committed list.
    return typeof game.matchId==='string'&&publishedIds.has(game.matchId)?game.matchId:null;
  }
  window.faCompetitionMatchLinks=Object.freeze({forFixture:officialMatchId});
  function notifyPublishedMatchLinks(){
    if(typeof window.dispatchEvent==='function'&&typeof Event==='function')
      window.dispatchEvent(new Event('fa:published-match-links-change'));
  }
  // Preserve each club crest host (and its loaded image) when the matchday changes.
  const crestHosts=new Map();
  // Reuse the viewport-aware menu placement for all 30 matchday options.
  // DOM-only unit stubs have no layout primitives and keep their original path.
  const fixtureScrollBoundary=document.querySelector('.fa-shell-content-scroll');
  const roundMenu=window.faBindCompetitionMenu(fields.round,picker,choices,value=>select(value),
    document.querySelector(".app-fixtures-select"),{
      fitViewport:Boolean(fixtureScrollBoundary&&typeof picker.getBoundingClientRect==='function'),
      boundary:fixtureScrollBoundary
    });
  const element=(tag,cls="",text="")=>{
    const item=document.createElement(tag);item.className=cls;item.textContent=text;return item;
  };
  const word=(key,text,cls="")=>{
    const item=element("span",cls,text);item.dataset.appI18n=key;return item;
  };
  let postChoice=choices.find(choice=>choice.dataset.fixtureRoundChoice===stage)||element('div','language-option');
  if(stage&&!choices.includes(postChoice)){
  postChoice.id='app-fixtures-round-option-'+stage;postChoice.dataset.menuValue=stage;
  postChoice.dataset.fixtureRoundChoice=stage;postChoice.setAttribute('role','option');
  postChoice.append(word(stageKey,stage==='playout'?'Playout':'Playoffs'));
  postChoice.hidden=false;picker.append(postChoice);
  }
  function updateDefinition(next){
    if(!next||next.id!==definition.id||JSON.stringify(next.rules)===JSON.stringify(definition.rules))return;
    definition=next;capacity=next.capacity;league=next.rules.phases.find(p=>p.rankOutcomes);
    ({rounds:roundCount,matches:matchCount,matchesPerRound}=next.metrics.phases[league.id]);
    configured=displayChoices(next);stage=international?null:configured.find(c=>typeof c.value==='string')?.value;
    stageKey=stage==='playout'?'competitionTabPlayout':'competitionTabPlayoffs';
    knockoutPhases=next.rules.phases.filter(p=>p.type==='knockout');firstTies=knockoutPhases[0]?.ties.filter(t=>t.legs===2)||[];
    hasFinal=knockoutPhases.some(p=>p.ties.some(t=>t.legs===1));
    choices=configured.map(choice=>{
      const option=element('div','language-option');option.id='app-fixtures-round-option-'+choice.value;
      option.dataset.menuValue=String(choice.value);option.dataset.fixtureRoundChoice=String(choice.value);option.setAttribute('role','option');
      if(typeof choice.value==='number')option.append(word('fixturesMatchday','Matchday'),element('span','',' '+choice.round));
      else{const label=element('span','',window.faCompetitionRulesView?.fixturesChoiceLabel?.(definition,choice,document.documentElement.lang)||choice.labelKey);label.dataset.competitionFixtureChoice=String(choice.value);option.append(label);}
      return option;
    });
    picker.replaceChildren(...choices);postChoice=choices.find(choice=>choice.dataset.fixtureRoundChoice===stage)||element('div','language-option');
    postChoice.hidden=!Boolean(stage);menuHasPostseason=false;roundMenu.update(choices);
  }
  function validatePostseason(games){
    if(!Array.isArray(games))throw Error('Invalid post-season fixtures');
    if(!games.length)return [];
    const size=firstTies.length;
    if(![size*2,...(hasFinal?[size*2+1]:[])].includes(games.length))throw Error('Incomplete post-season fixtures');
    const seen=new Set();
    const next=games.map(g=>{
      if(!g||![roundCount+1,roundCount+2,...(hasFinal?[roundCount+3]:[])].includes(g.round)||
         !clubs.has(g.homeId)||!clubs.has(g.awayId)||g.homeId===g.awayId||!validKickoff(g.kickoff)||
         (g.homeGoals===null?g.awayGoals!==null:!Number.isSafeInteger(g.homeGoals)||g.homeGoals<0||!Number.isSafeInteger(g.awayGoals)||g.awayGoals<0))throw Error('Invalid post-season fixture');
      const key=g.round+':'+g.homeId+':'+g.awayId;
      if(seen.has(key)||typeof g.afterExtraTime!=='boolean'||(g.round===31&&g.afterExtraTime)||
         (g.homeGoals===null&&g.afterExtraTime))throw Error('Invalid post-season result');
      seen.add(key);
      const p=g.penalties;
      if(p!==null&&(!p||!g.afterExtraTime||p.homeId!==g.homeId||p.awayId!==g.awayId||
         !Number.isSafeInteger(p.homeGoals)||p.homeGoals<0||!Number.isSafeInteger(p.awayGoals)||p.awayGoals<0||p.homeGoals===p.awayGoals))throw Error('Invalid post-season penalties');
      return {...g,penalties:p?{...p}:null};
    });
    const legs=[31,32].map(round=>next.filter(g=>g.round===round));
    if(legs.some(games=>games.length!==size||new Set(games.flatMap(g=>[g.homeId,g.awayId])).size!==size*2)||
       legs[0].some(g=>!legs[1].some(r=>r.homeId===g.awayId&&r.awayId===g.homeId))||
       (next.length===5&&next.filter(g=>g.round===33).length!==1))throw Error('Invalid post-season pairing');
    const final=next.find(g=>g.round===33);
    const winners=legs[0].map(first=>{
      const second=legs[1].find(g=>g.homeId===first.awayId&&g.awayId===first.homeId);
      if(second.homeGoals!==null&&first.homeGoals===null)throw Error('Unplayed first leg');
      if(second.homeGoals===null)return null;
      const home=first.awayGoals+second.homeGoals,away=first.homeGoals+second.awayGoals;
      if(home!==away){if(second.penalties)throw Error('Unneeded post-season penalties');return home>away?second.homeId:second.awayId}
      if(!second.penalties)throw Error('Unresolved post-season tie');
      return second.penalties.homeGoals>second.penalties.awayGoals?second.homeId:second.awayId;
    });
    if(final&&(winners.includes(null)||!winners.includes(final.homeId)||!winners.includes(final.awayId)))throw Error('Unknown post-season finalists');
    return next.sort((a,b)=>a.round-b.round);
  }
  function validKickoff(value){
    if(value===null)return true;
    if(typeof value!=="string")return false;
    const parts=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
    if(!parts||!Number.isFinite(Date.parse(value)))return false;
    const [year,month,day,hour,minute,second]=parts.slice(1).map(Number);
    const leap=year%4===0&&(year%100!==0||year%400===0);
    const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
    return month>=1&&month<=12&&day>=1&&day<=days[month-1]&&hour<24&&minute<60&&second<60;
  }
  function validate(fixtures){
    if(fixtures===null)return null;
    if(international)return validateInternational(fixtures);
    if(!Array.isArray(fixtures)||fixtures.length!==matchCount)throw Error("Incomplete competition schedule");
    const byRound=new Map(Array.from({length:roundCount},(_,i)=>[i+1,[]])),pairs=new Set();
    for(const game of fixtures){
      if(!game||!Number.isInteger(game.round)||!byRound.has(game.round)||
         !clubs.has(game.homeId)||!clubs.has(game.awayId)||game.homeId===game.awayId)
        throw Error("Invalid fixture identity");
        const pair=game.homeId+":"+game.awayId;
      if(pairs.has(pair))throw Error("Repeated home/away pairing");
      pairs.add(pair);
      const played=game.homeGoals!==null;
      if(played?(!Number.isSafeInteger(game.homeGoals)||game.homeGoals<0||
          !Number.isSafeInteger(game.awayGoals)||game.awayGoals<0):game.awayGoals!==null)
        throw Error("Invalid fixture result");
      if(!validKickoff(game.kickoff))throw Error("Invalid fixture kickoff");
      byRound.get(game.round).push({round:game.round,phaseId:'league',homeId:game.homeId,awayId:game.awayId,
        homeGoals:game.homeGoals,awayGoals:game.awayGoals,kickoff:game.kickoff,
        sourceFixtureId:game.sourceFixtureId??null,marker:game.marker??null,day:game.day??null,
         matchId:typeof game.matchId==='string'&&/^[1-9][0-9]*$/.test(game.matchId)&&
          Number.isSafeInteger(Number(game.matchId))?game.matchId:null});
    }
    for(const matches of byRound.values()){
      if(matches.length!==matchesPerRound||new Set(matches.flatMap(game=>[game.homeId,game.awayId])).size!==capacity)
        throw Error("Incomplete competition round");
      matches.sort((a,b)=>a.homeId-b.homeId||a.awayId-b.awayId);
    }
    return byRound;
  }
  function validateInternational(fixtures){
    if(!Array.isArray(fixtures)||clubs.size!==capacity)throw Error('Invalid supplied cup schedule');
    const byRound=new Map(Array.from({length:roundCount},(_,i)=>[i+1,[]])),post=[],seen=new Set(),pairs=new Set(),tieLegs=new Set();
    for(const g of fixtures){
      const phase=definition.rules.phases.find(p=>p.id===g?.phaseId);
      if(!phase||!clubs.has(g.homeId)||!clubs.has(g.awayId)||g.homeId===g.awayId||!validKickoff(g.kickoff)||
        (g.homeGoals===null?g.awayGoals!==null:!Number.isSafeInteger(g.homeGoals)||g.homeGoals<0||!Number.isSafeInteger(g.awayGoals)||g.awayGoals<0))throw Error('Invalid supplied fixture');
      const key=[g.phaseId,g.round,g.tieId,g.leg,g.homeId,g.awayId].join(':');if(seen.has(key))throw Error('Duplicate fixture');seen.add(key);
      if(phase.type!=='knockout'){
        if(!byRound.has(g.round))throw Error('Invalid league round');
        const pair=[g.homeId,g.awayId].sort().join(':');
        if(pairs.has(pair)||clubs.get(g.homeId).countryId===clubs.get(g.awayId).countryId)throw Error('Invalid cup opponent');pairs.add(pair);
        byRound.get(g.round).push({...g});
      }else{
        const tie=phase.ties.find(t=>t.id===g.tieId);
        if(!tie||!Number.isInteger(g.leg)||g.leg<1||g.leg>tie.legs)throw Error('Invalid knockout fixture');
        const identity=phase.id+':'+tie.id+':'+g.leg;
        if(tieLegs.has(identity))throw Error('Duplicate configured tie leg');tieLegs.add(identity);
        const data=window.faCompetitionContext?.seasonData,table=data?.statistics?.standings;
        if(!Array.isArray(table)||table.length!==capacity||table.some(row=>row.played!==roundCount))throw Error('Unresolved knockout qualification');
        const participants=rules.tieParticipants(definition,tie.id,table,(data.results||[]).filter(r=>r?.id||r?.tieId));
        const first=rules.homeOrder(definition,tie.id,participants,table),order=g.leg===2?[...first].reverse():first;
        if(order.some(club=>!club)||g.homeId!==rules.clubKey(order[0])||g.awayId!==rules.clubKey(order[1]))throw Error('Invalid configured knockout participants or home order');
        post.push({...g,round:phase.id+':'+g.leg});
      }
    }
    for(const games of byRound.values())if(games.length&&(games.length!==matchesPerRound||new Set(games.flatMap(g=>[g.homeId,g.awayId])).size!==capacity))throw Error('Incomplete cup round');
    byRound.postseason=post;return byRound;
  }

  // The same rank/tie wording and compact ordinals as the #732 Matches directory.
  // Use configured references only: no participant is inferred from a future result.
  const participantCopy={
    en:{rank:'Rank',tbc:'To be confirmed',winner:'Winner',playoff:'Winner of playoff',semifinal:'Winner of semifinal',quarterfinal:'Winner of quarter-final',qf:'QF',sf:'SF'},
    it:{rank:'Posizione',tbc:'Da definire',winner:'Vincente',playoff:'Vincente playoff',semifinal:'Vincente semifinale',quarterfinal:'Vincente quarto di finale',qf:'QF',sf:'SF'},
    de:{rank:'Rang',tbc:'Noch offen',winner:'Sieger',playoff:'Sieger aus Playoff',semifinal:'Sieger des Halbfinals',quarterfinal:'Sieger des Viertelfinals',qf:'VF',sf:'HF'},
    es:{rank:'Puesto',tbc:'Por confirmar',winner:'Ganador',playoff:'Ganador del playoff',semifinal:'Ganador de semifinal',quarterfinal:'Ganador de cuarto de final',qf:'CF',sf:'SF'},
    fr:{rank:'Rang',tbc:'À déterminer',winner:'Vainqueur',playoff:'Vainqueur du barrage',semifinal:'Vainqueur de demi-finale',quarterfinal:'Vainqueur du quart de finale',qf:'QF',sf:'DF'}
  };
  const winnerPairings={
    p512:{ranks:[5,12],stage:'playoff'},p611:{ranks:[6,11],stage:'playoff'},
    p710:{ranks:[7,10],stage:'playoff'},p89:{ranks:[8,9],stage:'playoff'},
    semi36:{ranks:[3,6],stage:'semifinal'},semi45:{ranks:[4,5],stage:'semifinal'}
  };
  function pendingName(game,home){
    const lang=document.documentElement.lang,words=participantCopy[lang]||participantCopy.en;
    const tie=knockoutPhases.flatMap(phase=>phase.ties).find(t=>t.id===game.tieId);
    if(!tie||!Array.isArray(tie.participants)||tie.participants.length!==2)
      return {full:words.tbc,compact:words.tbc};
    // As in #732, leg 1 of a two-leg tie has participant B at home;
    // leg 2 reverses it. Neutral single-leg finals retain A/B ordering.
    const reverse=tie.legs===2&&game.leg===1&&tie.homePolicy!=='neutral';
    const index=(home?0:1)^(reverse?1:0),ref=tie.participants[index];
    if(ref?.phaseId==='league'&&Number.isSafeInteger(ref.rank))
      return {full:words.rank+' '+ref.rank,compact:words.rank+' '+ref.rank};
    if(typeof ref?.tieId==='string'){
      const id=ref.tieId.toLowerCase(),pair=winnerPairings[id];
      if(pair)return {full:words[pair.stage]+' '+pair.ranks.join(' vs '),
        compact:words.winner+' '+pair.ranks.join('–')};
      const q=/^q([1-4])$/.exec(id);
      if(q)return {full:words.quarterfinal+' '+q[1],compact:words.winner+' '+words.qf+' '+q[1]};
      const s=/^s([1-2])$/.exec(id);
      if(s)return {full:words.semifinal+' '+s[1],compact:words.winner+' '+words.sf+' '+s[1]};
    }
    return {full:words.tbc,compact:words.tbc};
  }
  function participantName(id,game,home){
    const club=clubs.get(id);
    if(!club){
      const pending=pendingName(game,home);
      return pending;
    }
    const full=club.primaryName||club.abbr;
    return {full,compact:club.compactName||full};
  }
  function nameSpans(name){
    return [
      element('span','app-fixture-name-full',name.full),
      element('span','app-fixture-name-compact',name.compact)
    ];
  }
  function identity(id,home,game){
    const club=clubs.get(id),name=participantName(id,game,home);
    const item=element('span','app-fixture-club'+(home?' app-fixture-home':'')+(!club?' app-fixture-club-pending':''));
    const crest=element('span','app-world-club-crest-placeholder'+(club?' fa-crest-loading':''));
    if(club){crest.dataset.clubCrest=rules.clubKey(club);crest.setAttribute('aria-hidden','true');}
    const label=element(club?'a':'span','app-fixture-name'+(club?' app-world-standing-club-link':''));
    label.setAttribute('aria-label',name.full);
    label.append(...nameSpans(name));
    if(club)label.href=window.faRoutesRegistry.buildRoute({kind:'club',country:club.countryId.toLowerCase(),id:club.clubId,view:'overview'});
    item.append(word(home?'fixturesHome':'fixturesAway',home?'Home':'Away','sr-only'),crest,label);
    return item;
  }
  function matchRow(game){
    const item=element("li","app-fixture-match");
    // Unresolved knockout ties share unknown participants. Their configured
    // tie slot, not null/null club IDs, is the stable DOM reconciliation key.
    item.dataset.fixtureMatch=game.fixtureSlot
      ?'pending:'+game.round+':'+game.fixtureSlot
      :game.round+':'+game.homeId+':'+game.awayId;
    item.dataset.fixtureRound=String(game.round);
    const result=element("div","app-fixture-result"),played=game.homeGoals!==null;
    let status;
    if(played){
      status=word(game.afterExtraTime?(game.penalties?'postseasonPenalties':'postseasonExtraTime'):"fixturesFullTime",game.afterExtraTime?(game.penalties?'Penalties':'After extra time'):"Full time","app-fixture-status");
      if(game.penalties){
        status=element('span','app-fixture-status');
        status.append(word('postseasonPenalties','Penalties'),element('strong','', ' '+game.penalties.homeGoals+'–'+game.penalties.awayGoals));
      }
    }
    else if(game.kickoff===null)status=word("fixturesTimingUnknown","To be confirmed","app-fixture-status");
    else{
      status=element("time","app-fixture-status");status.dateTime=game.kickoff;
      status.textContent=new Intl.DateTimeFormat(document.documentElement.lang||"en",
        {dateStyle:"medium",timeStyle:"short"}).format(new Date(game.kickoff));
    }
    const score=element("strong","app-fixture-score");
    if(played)score.append(
      element("span","app-fixture-goals",String(game.homeGoals)),
      element("span","app-fixture-separator"," – "),
      element("span","app-fixture-goals",String(game.awayGoals)));
    else score.append(element("span","app-fixture-pending","—"));
    // Standings forms use this same verified resolver.
    let scoreContent=score,publicId=officialMatchId(game);
    if(publicId){
      item.className+=' is-match-link';
      const link=element('a','app-fixture-score-link');
      link.href='/matches/'+publicId;
      const action={en:'Open match',de:'Spiel öffnen',es:'Abrir partido',fr:'Ouvrir le match',it:'Apri partita'};
      const locale=document.documentElement.lang||'en';
      link.setAttribute('aria-label',(action[locale]||action.en)+': '+
        participantName(game.homeId,game,true).full+' – '+participantName(game.awayId,game,false).full);
      link.append(score);scoreContent=link;
    }
    result.append(status,scoreContent,
      element("span","app-fixture-stadium",clubs.get(game.homeId)?.stadiumName||"—"));
    if(publicId){
      // Native full-card anchor supports the browser's new-tab context menu
      // and middle/Ctrl/Cmd-click without scripting. The score remains the
      // keyboard link and club names retain independent destinations.
      // Nest under result so reused match rows replace this link atomically.
      const hit=element('a','app-fixture-native-link');
      hit.href='/matches/'+publicId;
      hit.setAttribute('tabindex','-1');
      hit.setAttribute('aria-hidden','true');
      result.append(hit);
    }
    item.append(identity(game.homeId,true,game),result,identity(game.awayId,false,game));
    return item;
  }
  function render(){
    const supplied=window.faCompetitionContext?.seasonData;
    const authoritative=supplied?.provenance?.kind==='authoritative'&&String(supplied.season)===navigation.get().season;
    const available=rounds!==null&&(authoritative||availableSeasons.has(navigation.get().season)||
      publishedSeason===navigation.get().season);
    const hasPostseason=Boolean(stage);
    if(menuHasPostseason!==hasPostseason){
      menuHasPostseason=hasPostseason;postChoice.hidden=!hasPostseason;
      roundMenu.update(hasPostseason&&!choices.includes(postChoice)?[...choices,postChoice]:choices);
    }
    const grouped=displayValue(selected);
    if(grouped!==selected){navigation.set({matchday:grouped},{replace:true});return;}
    if(!validChoice(selected)){
      navigation.set({matchday:roundCount},{replace:true});return;
    }
    const isPostseason=typeof selected==='string';
    const selectedChoice=configured.find(c=>c.value===selected);
    const loading=document.documentElement.dataset.faStandingsLoading==='true';
    // The published draw may still be in flight after global bootstrap settles.
    const source=window.faWorldState?.get?.();
    const waitingForWorld=source?.source==='authoritative'&&
      ['pending','loading'].includes(source.worldStatus)&&!available;
    const unresolved=loading||pendingKey!==null||waitingForWorld;
    const hasSchedule=available&&([...rounds.values()].some(games=>games.length)||postseason.length>0);
    fields.toolbar.hidden=!unresolved&&!hasSchedule;
    fields.current.hidden=!available||currentMatchday===null||selected===currentMatchday;
    fields.round.value=String(selected);fields.round.disabled=!hasSchedule||unresolved;
    const label=document.getElementById('app-fixtures-round-label');
    if(label)label.hidden=isPostseason;
    const selectedLabel=isPostseason?element('span','',window.faCompetitionRulesView?.fixturesChoiceLabel?.(definition,selectedChoice,document.documentElement.lang)||selectedChoice.labelKey):element('span','',String(selected));
    if(isPostseason)selectedLabel.dataset.competitionFixtureChoice=String(selectedChoice.value);
    window.faFixturesShell?.select(selected);
    if(!number.firstElementChild?.isEqualNode?.(selectedLabel))number.replaceChildren(selectedLabel);
    roundMenu.sync(String(selected));
    if(fields.round.disabled)roundMenu.close();
    const choiceIndex=configured.findIndex(c=>c.value===selected);
    fields.previous.disabled=fields.round.disabled||choiceIndex===0;
    fields.next.disabled=fields.round.disabled||choiceIndex===configured.length-1;
    fields.empty.hidden=true;fields.list.hidden=!available;fields.summary.hidden=!available;
    const matches=[];
    if(available){
      if(international&&isPostseason){
        const phase=definition.rules.phases.find(p=>p.id===selectedChoice.phaseId),legs=Math.max(...phase.ties.map(t=>t.legs));
        const publishedWorld=window.faWorldState?.get?.();
        const reservedKey=publishedWorldKey(navigation.get().season,publishedWorld);
        const showPublishedReservations=publishedWorld?.source==='authoritative'&&
          publishedWorld.worldStatus==='ready'&&publishedSeason===navigation.get().season&&
          publishedKey===reservedKey&&!!publishedLookup;
        for(let leg=1;leg<=legs;leg++){
          const games=postseason.filter(g=>g.phaseId===phase.id&&g.leg===leg);
          // DEV and unpublished international phases remain empty exactly as
          // before. An unresolved match row exists only for an official published slot.
          const pending=games.length?games:showPublishedReservations?
            phase.ties.filter(tie=>publishedLookup.bySlot[[phase.id,tie.id,leg].join(':')]).map(tie=>({
            phaseId:phase.id,tieId:tie.id,leg,round:phase.id+':'+leg,
            homeId:null,awayId:null,homeGoals:null,awayGoals:null,kickoff:null,
            fixtureSlot:tie.id
          })): [];
          if(!pending.length)continue;
          if(legs>1){const heading=element('li','app-fixture-stage'),title=element('h3');title.append(word(leg===1?'postseasonFirstLeg':'postseasonSecondLeg',leg===1?'First leg':'Second leg'));heading.append(title);matches.push(heading);}
          matches.push(...pending.map(matchRow));
        }
      }
      else if(isPostseason)for(const round of [31,32,33]){
        const games=postseason.filter(g=>g.round===round);
        if(round===33&&!hasFinal)continue;
        const count=round===33?1:firstTies.length;
        const display=games.length?games:Array.from({length:count},(_,index)=>{
          const tie=round===33?knockoutPhases.flatMap(p=>p.ties).find(t=>t.legs===1):firstTies[index];
          const phase=knockoutPhases.find(p=>p.ties.includes(tie));
          return {round,phaseId:phase?.id,tieId:tie?.id,leg:round===32?2:1,
            homeId:null,awayId:null,homeGoals:null,awayGoals:null,kickoff:null,
            fixtureSlot:tie?.id};
        });
        const heading=element('li','app-fixture-stage');
        const title=element('h3');title.append(word(round===31?'postseasonFirstLeg':round===32?'postseasonSecondLeg':'postseasonFinal',round===31?'First leg':round===32?'Second leg':'Final'));
        heading.append(title);matches.push(heading,...display.map(matchRow));
      }
      else matches.push(...(rounds.get(selected)||[]).map(matchRow));
    }
    // Reuse match identity nodes (and their loaded crest images) across Debug updates.
    const existing=new Map([...fields.list.children]
      .filter(item=>item.dataset.fixtureMatch)
      .map(item=>[item.dataset.fixtureMatch,item]));
    const next=matches.map(item=>{
      const previous=existing.get(item.dataset.fixtureMatch);
      // Pending participants are language-sensitive: rebuild their tiny text
      // hosts when the locale changes, without replacing known-club crest hosts.
      if(!previous||item.dataset.fixtureMatch.startsWith('pending:'))return item;
      // Resolved club identities are immutable for a given match key.
      const oldResult=previous.querySelector?.(".app-fixture-result");
      const newResult=item.querySelector?.(".app-fixture-result");
      if(oldResult&&newResult&&!oldResult.isEqualNode?.(newResult))oldResult.replaceWith(newResult);
      // Reused crest rows must also gain/lose the full-card link affordance
      // when their official match identity changes.
      previous.className=item.className;
      return previous;
    });
    if(international&&available){const hasMatches=next.some(item=>item.dataset.fixtureMatch);fields.empty.hidden=hasMatches;fields.list.hidden=!hasMatches;fields.summary.hidden=!hasMatches;}
    // Move existing crest hosts into new match rows instead of creating new images.
    // A club appears once per league round, but can appear in multiple postseason legs.
    const usedCrests=new Set();
    for(const item of next){
      for(const placeholder of [...item.querySelectorAll?.("[data-club-crest]")||[]]){
        const id=placeholder.dataset.clubCrest;
        let hosts=crestHosts.get(id);
        if(!hosts){hosts=[];crestHosts.set(id,hosts)}
        if(!hosts.includes(placeholder) && !usedCrests.has(placeholder)){
          const cached=hosts.find(host=>!usedCrests.has(host));
          if(cached){placeholder.replaceWith(cached);usedCrests.add(cached);continue}
          hosts.push(placeholder);
        }
        usedCrests.add(placeholder);
      }
    }
    if(window.faCompetitionRenderDOM?.reorder)window.faCompetitionRenderDOM.reorder(fields.list,next);
    else if(typeof fields.list.insertBefore==="function"){
      for(let i=0;i<next.length;i++)if(fields.list.children[i]!==next[i])fields.list.insertBefore(next[i],fields.list.children[i]||null);
      while(fields.list.children.length>next.length)fields.list.lastElementChild.remove();
    }else fields.list.replaceChildren(...matches);
    fields.summary.replaceChildren(element('span','',selectedLabel.textContent),element('strong','',String(matches.filter(item=>item.dataset.fixtureMatch).length)),word('fixturesMatchUnit','matches'));
    // Do not interpret missing or stale season data as an empty schedule.
    const context=window.faCompetitionContext,data=context?.seasonData;
    const matching=data&&String(data.season)===String(context.selectedSeason)&&String(context.selectedSeason)===String(navigation.get().season);
    // The entrants-only sporting projection intentionally has fixtures:null
    // until the world calendar is published. A separately verified, already
    // published match collection is authoritative for Fixtures, so that null
    // must not hide eight real round matches behind an "empty" panel.
    const absent=matching&&data.fixtures===null&&!hasSchedule;
    const emptyRound=available&&((international&&!next.some(item=>item.dataset.fixtureMatch))||
      (!international&&!isPostseason&&matches.length===0));
    const panel=document.getElementById('competition-panel-fixtures');
    const confirmedEmpty=Boolean(absent||emptyRound||(!available&&!unresolved));
    if(panel){
      panel.dataset.faContentState=confirmedEmpty?'empty':available?'available':'unknown';
      panel.dataset.faContentSeason=String(context?.selectedSeason??'');
      panel.dataset.faContentRevision=String(context?.revision??'');
    }
    if(confirmedEmpty){fields.empty.hidden=false;fields.list.hidden=true;fields.summary.hidden=true;}
    window.faAppRenderLanguage?.();
  }
  function select(value){
    if(fields.round.disabled)return;
    const round=/^[1-9]\d*$/.test(String(value))?Number(value):value;
    if(validChoice(round)){
      navigation.set({matchday:displayValue(round)});
    }
  }
  navigation.subscribe(route=>{
    selected=route.matchday;
    if(route.view==="fixtures"&&rounds!==null){
      navigation.defaultMatchday(currentMatchday??1);
      selected=navigation.get().matchday;
    }
    roundMenu.close();render();
    if(['standings','fixtures','postseason'].includes(route.view))void readPublishedFixtures();
  });
  // Knockout bracket scores represent *different matches* for each leg.
  // Use the already-verified public competition collection, not club IDs or
  // inferred pairings. Both single- and two-leg ties expose only score-box
  // click targets; the enclosing card remains non-interactive.
  const bracketLabels={
    en:['Open match','First leg','Second leg','Single match'],
    de:['Spiel öffnen','Hinspiel','Rückspiel','Einzelspiel'],
    es:['Abrir partido','Ida','Vuelta','Partido único'],
    fr:['Ouvrir le match','Aller','Retour','Match unique'],
    it:['Apri partita','Andata','Ritorno','Partita unica']
  };
  function syncKnockoutLinks(){
    const root=document.getElementById('app-postseason-bracket');
    if(!root?.querySelectorAll)return;
    const source=window.faWorldState?.get?.(),world=source?.world,route=navigation.get();
    const liveKey=publishedWorldKey(route.season,source);
    const authorized=matchLinksReady()&&source?.source==='authoritative'&&source.worldStatus==='ready'&&
      route.season===publishedSeason&&publishedKey===liveKey&&!!publishedLookup;
    const lang=bracketLabels[document.documentElement.lang]||bracketLabels.en;
    // One card represents up to two DIFFERENT matches. Give first and
    // second leg their own native score-box targets, even with TBD clubs.
    // A one-leg tie uses its single rightmost score column only.
    for(const card of root.querySelectorAll('[data-bracket-tie]')){
      const tieId=card.dataset.bracketTie;
      const phase=definition.rules.phases.find(p=>p.type==='knockout'&&
        p.ties.some(tie=>tie.id===tieId));
      const tie=phase?.ties.find(t=>t.id===tieId);
      const existing=Array.from(card.querySelectorAll('.fa-bracket-match-link'));
      const expected=new Set();
      if(authorized&&tie)for(let leg=1;leg<=tie.legs;leg++){
        const match=publishedLookup.bySlot[[phase.id,tieId,leg].join(':')];
        if(!match)continue;
        // Safari does not reliably re-hit-test pseudo-element-only anchors
        // after Back/Forward restoration. Use two real native 26x28px anchors
        // per leg, precisely over the two visible score boxes (never the gap).
        // Only the first participates in keyboard/screen-reader navigation.
        for(let row=1;row<=2;row++){
          const identity=leg+':'+row;expected.add(identity);
          let anchor=existing.find(a=>a.dataset.faMatchLeg===String(leg)&&
            a.dataset.faMatchRow===String(row));
          if(!anchor){
            anchor=document.createElement('a');anchor.className='fa-bracket-match-link';
            anchor.dataset.faMatchLeg=String(leg);
            anchor.dataset.faMatchRow=String(row);
            card.append(anchor);
          }
          anchor.href='/matches/'+match.matchId;
          if(row===1){
            anchor.removeAttribute('tabindex');anchor.removeAttribute('aria-hidden');
            anchor.setAttribute('aria-label',lang[0]+': '+(tie.legs===1?lang[3]:lang[leg]));
          }else{
            anchor.setAttribute('tabindex','-1');anchor.setAttribute('aria-hidden','true');
            anchor.removeAttribute('aria-label');
          }
          // Never expose native First/Second leg hover title tooltips.
          anchor.removeAttribute('title');
        }
      }
      for(const link of existing)
        if(!expected.has(link.dataset.faMatchLeg+':'+link.dataset.faMatchRow))link.remove();
      if(expected.size){
        card.classList.add('is-match-link');
        card.dataset.faMatchLegs=String(tie.legs);
      }else{
        card.classList.remove('is-match-link');
        delete card.dataset.faMatchLegs;
      }
    }
  }
  // The bracket is recreated when season rules change. Defer sync until the
  // last synchronous context listener has completed its DOM commit.
  const bracketAfterContext=()=>void Promise.resolve().then(syncKnockoutLinks);
  window.addEventListener('fa:competition-context-change',bracketAfterContext);
  window.addEventListener('fa:source-change',bracketAfterContext);
  window.addEventListener('fa:published-match-links-change',syncKnockoutLinks);
  window.addEventListener('fa:competition-route-change',bracketAfterContext);
  // Locale changes do not replace the bracket itself; update the link's
  // accessible leg label in place without fetching the match list again.
  new MutationObserver(syncKnockoutLinks).observe(document.documentElement,{
    attributes:true,attributeFilter:['lang','data-fa-standings-loading']
  });
  // Keep the score as the native focusable anchor, but let a primary click
  // elsewhere in a verified match card activate it. Existing club links take
  // precedence; no navigation for unpublished/TBD/DEV rows or modifier clicks.
  // A stationary mouse must not keep a stale :hover highlight while a
  // scrolling container moves fixture cards underneath it. A genuine pointer
  // displacement (not a scroll-generated pointermove at the same coordinates)
  // restores hover. Keyboard focus highlighting is independent.
  let hoverPointerX=null,hoverPointerY=null;
  window.addEventListener('scroll',()=>{
    document.documentElement.dataset.faFixtureHoverSuspended='true';
  },{capture:true,passive:true});
  window.addEventListener('pointermove',event=>{
    if(event.pointerType!=='mouse'||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return;
    if(hoverPointerX!==null&&
       (Math.abs(event.clientX-hoverPointerX)>1||Math.abs(event.clientY-hoverPointerY)>1))
      delete document.documentElement.dataset.faFixtureHoverSuspended;
    hoverPointerX=event.clientX;hoverPointerY=event.clientY;
  },{capture:true,passive:true});
  fields.list.addEventListener('click',event=>{
    if(!matchLinksReady()||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||
       event.shiftKey||event.altKey)return;
    const target=event.target;
    if(!target?.closest||target.closest('a,button,input,select,textarea,[role="button"]'))return;
    const card=target.closest('.app-fixture-match.is-match-link');
    card?.querySelector('.app-fixture-score-link')?.click();
  });
  fields.current.addEventListener("click",()=>{if(!fields.current.hidden){select(currentMatchday);fields.round.focus()}});
  fields.previous.addEventListener("click",()=>{if(!fields.previous.disabled)select(configured[configured.findIndex(c=>c.value===selected)-1].value)});
  fields.next.addEventListener("click",()=>{if(!fields.next.disabled)select(configured[configured.findIndex(c=>c.value===selected)+1].value)});
  // Validate before returning a commit function; rejected input leaves the view intact.
  window.faFixtures={
    prepare(fixtures,{currentMatchday:current=null,postseason:games=[],definition:applicable=window.faCompetitionContext?.definition,participants=null}={}){
      updateDefinition(applicable);
      // Future domestic seasons can promote clubs outside the inaugural 16.
      // Validate against the selected season's supplied membership, not the
      // Season 1 DOM catalogue. Rejected preparation must not mutate live UI.
      const context=window.faCompetitionContext;
      const scoped=participants??(context?.seasonData&&context.selectedSeason===context.seasonData.season?context.seasonData.participants:null);
      const nextClubs=Array.isArray(scoped)?new Map(scoped.map(club=>[international?rules.clubKey(club):club.clubId,club])):clubs;
      if(Array.isArray(scoped)&&(nextClubs.size!==capacity||scoped.some(club=>!club||!Number.isInteger(club.clubId)||!club.primaryName)))throw Error('Invalid season participants');
      const previousClubs=clubs;
      let next,post;
      try{
        clubs=nextClubs;
        next=validate(fixtures);
        post=international?next?.postseason||[]:validatePostseason(games);
        if(!next&&post.length)throw Error('Post-season requires a league schedule');
        if(current!==null&&!validChoice(current))throw Error("Invalid current matchday");
      }finally{clubs=previousClubs;}
      // The stage is selectable before participating clubs are known.
      return ()=>{
        clubs=nextClubs;rounds=next;postseason=post;currentMatchday=next&&current!==null?displayValue(current):null;selected=navigation.get().matchday;
        navigation.defaultMatchday(currentMatchday??1);
        render();
      };
    },
    snapshot(){const previous=rounds,current=currentMatchday,post=postseason,previousClubs=clubs;return ()=>{
      clubs=previousClubs;rounds=previous;postseason=post;currentMatchday=current;selected=navigation.get().matchday;render()};}
  };
  new MutationObserver(render).observe(document.documentElement,
    {attributes:true,attributeFilter:["lang","data-fa-standings-loading"]});
  function contextChanged(){
    updateDefinition(window.faCompetitionContext?.definition);
    const context=window.faCompetitionContext,data=context?.seasonData;
    if(!international&&data&&data.provenance?.kind!=='authoritative')return; // The protected domestic adapter commits transactionally through prepare().
    // The existing published IDs remain valid when this world's results hydrate.
    if(!data){
      // The full sporting-season endpoint is intentionally unavailable until
      // world-calendar publication. A verified, independently published draw
      // must survive an unrelated empty/late season-read notification.
      const source=window.faWorldState?.get?.();
      const key=publishedWorldKey(context?.selectedSeason,source);
      if(source?.source==='authoritative'&&source.worldStatus==='ready'&&
         publishedLookup&&publishedKey===key&&publishedSeason===String(context?.selectedSeason)&&rounds){
        render();return;
      }
      rounds=null;postseason=[];currentMatchday=null;
      publishedSeason=null;publishedIds.clear();publishedLookup=null;
      render();void readPublishedFixtures();return;
    }
    const previous=clubs;
    try{
      clubs=new Map(data.participants.map(club=>[international?rules.clubKey(club):club.clubId,club]));
      if(clubs.size!==capacity)throw Error('Invalid cup participants');
      // The entrants-only projection can arrive after an independently published
      // draw. Preserve that valid draw for this exact world revision.
      const source=window.faWorldState?.get?.();
      const key=publishedWorldKey(context.selectedSeason,source);
      if(data.entrantsOnly===true&&publishedLookup&&publishedKey===key&&rounds){
        render();return;
      }
      const calendar=window.faWorldCalendarModel?.projectCompetition(window.faCompetitionContext.selectedSeason,definition.id);
      const current=data.provenance?.kind==='authoritative'?data.currentMatchday:calendar?rules.currentFixtureChoice(definition,calendar,window.faDevWorldClockSnapshot||window.faWorldClockSnapshot):null;
      window.faFixtures.prepare(data.fixtures,{currentMatchday:current,postseason:data.postseason||[],definition})();
      if(data.provenance?.kind==='authoritative')void readPublishedFixtures();
    }catch{clubs=previous;rounds=null;postseason=[];currentMatchday=null;render();}
  }

  // An officially published INT24 league draw already identifies all 24
  // participants, even while the aggregate season projection is unpublished.
  // Resolve only those exact club keys against the validated public catalogue;
  // never generate entrants, results or team names from fixture positions.
  async function publishedCupParticipants(games){
    const manifest=await window.faCompetitionManifestPromise;
    if(!model?.validManifest?.(manifest))throw Error('Missing verified cup catalogue');
    const catalogue=new Map(manifest.divisions.flatMap(d=>d.clubs).map(club=>[rules.clubKey(club),club]));
    const appearances=new Map();
    for(const game of games){
      if(!validRound(game.round)||typeof game.homeId!=='string'||typeof game.awayId!=='string'||
         game.homeId===game.awayId)throw Error('Invalid published cup fixture');
      for(const key of [game.homeId,game.awayId]){
        if(!catalogue.has(key))throw Error('Unknown published cup participant');
        appearances.set(key,(appearances.get(key)||0)+1);
      }
    }
    if(appearances.size!==capacity||[...appearances.values()].some(n=>n!==roundCount))
      throw Error('Incomplete published cup membership');
    return [...appearances.keys()].map(key=>catalogue.get(key));
  }

  // Season 2 domestic promotions can replace inaugural division clubs.
  // Resolve actual published entrants from the public immutable draw and
  // verified catalogue, even when the separate entrants read is still pending.
  // Never fall back to the Season 1 division map or invent a participant.
  async function publishedDomesticParticipants(games){
    const manifest=await window.faCompetitionManifestPromise;
    if(!model?.validManifest?.(manifest))throw Error('Missing verified domestic catalogue');
    const countryId=definition.id.split('-')[0];
    const catalogue=new Map(manifest.divisions.filter(d=>d.countryId===countryId)
      .flatMap(d=>d.clubs).map(club=>[club.clubId,club]));
    const appearances=new Map();
    for(const game of games){
      if(!validRound(game.round)||!Number.isSafeInteger(game.homeId)||
         !Number.isSafeInteger(game.awayId)||game.homeId===game.awayId)
        throw Error('Invalid published domestic fixture');
      for(const clubId of [game.homeId,game.awayId]){
        if(!catalogue.has(clubId))throw Error('Unknown published domestic entrant');
        appearances.set(clubId,(appearances.get(clubId)||0)+1);
      }
    }
    if(appearances.size!==capacity||[...appearances.values()].some(n=>n!==roundCount))
      throw Error('Incomplete published domestic membership');
    return [...appearances.keys()].map(id=>catalogue.get(id));
  }

  /** Read only the officially committed draw, even before worldwide publication. */
  async function readPublishedFixtures(){
    const context=window.faCompetitionContext,source=window.faWorldState?.get?.();
    const route=navigation.get(),season=Number(route.season);
    if(!['standings','fixtures','postseason'].includes(route.view)||source?.source!=='authoritative'||source?.worldStatus!=='ready'||!source.world||
       !Number.isSafeInteger(season)||season<1||context?.selectedSeason!==season||
       season>source.world.seasonNumber)return;
    const key=publishedWorldKey(season,source);
    if(key===publishedKey||key===pendingKey)return;
    const cacheKey=[source.sourceRevision,key].join(':');
    const cached=publishedCache.get(cacheKey);
    if(cached){
      // A previous season request may still be in flight. Fence it before
      // restoring the validated collection, keeping native link IDs exact.
      fetchSequence++;pendingKey=null;
      if(cached.missing){
        publishedSeason=null;publishedKey=key;publishedIds.clear();publishedLookup=null;
        render();syncKnockoutLinks();notifyPublishedMatchLinks();
        return;
      }
      try{
        const scored=window.faCompetitionContext?.seasonData;
        const hasOfficialScores=scored?.provenance?.kind==='authoritative'&&scored.season===season&&scored.entrantsOnly!==true;
        const commit=hasOfficialScores?null:window.faFixtures.prepare(cached.games,{
          currentMatchday:null,postseason:[],definition,participants:cached.participants
        });
        publishedSeason=String(season);publishedKey=key;
        publishedIds=new Set(cached.ids);publishedLookup=cached.lookup;
        if(commit)commit();else render();
        notifyPublishedMatchLinks();syncKnockoutLinks();
        return;
      }catch{
        // A changed presentation contract cannot reuse a stored collection;
        // retry its authoritative endpoint rather than displaying stale IDs.
        publishedCache.delete(cacheKey);
        publishedKey=null;publishedLookup=null;publishedIds.clear();
      }
    }
    pendingKey=key;const seq=++fetchSequence;
    const requestController=typeof AbortController==='function'?new AbortController():null;
    publishedAbort=requestController;
    // Preserve the fixture boxes, but revoke old Fixtures/knockout and
    // Standings native links while this exact-world lookup is unresolved.
    render();syncKnockoutLinks();notifyPublishedMatchLinks();
    try{
      const response=await fetch('/api/matches/seasons/'+season+'/competitions/'+definition.id,
       {credentials:'omit',cache:'no-store',redirect:'error',signal:requestController?.signal});
      if(response.status===404){
        if(seq===fetchSequence){publishedKey=key;rememberPublished(cacheKey,{missing:true});}
        return;
      }
      if(!response.ok)throw Error('Published fixtures unavailable');
      const data=await response.json(),count=international?72:240;
      if(data?.schemaVersion!==1||data.providerId!=='authoritative-world'||data.status!=='published'||
         data.season!==season||data.competitionId!==definition.id||
         data.provenance?.kind!=='authoritative'||!Array.isArray(data.fixtures))throw Error('Invalid public fixtures');
      const league=data.fixtures.filter(f=>f.phaseId==='league');
      // One authoritative lookup for the selected competition; no per-row probes.
      const bySource=Object.create(null),bySlot=Object.create(null);
      for(const f of data.fixtures){
        if(!f||!/^[1-9][0-9]*$/.test(f.matchId)||!Number.isSafeInteger(Number(f.matchId))||
           !Number.isSafeInteger(f.day)||f.day<1||f.day>56||
           typeof f.marker!=='string'||!f.marker)throw Error('Invalid published match reference');
        const item={matchId:f.matchId,phaseId:f.phaseId,marker:f.marker,day:f.day,round:f.round};
        if(f.phaseId==='league'){
          if(typeof f.sourceFixtureId!=='string'||
             !f.sourceFixtureId.startsWith('season:'+season+':'+definition.id+':')||
             Object.hasOwn(bySource,f.sourceFixtureId))throw Error('Invalid published source fixture');
          bySource[f.sourceFixtureId]=item;
        }else{
          if(typeof f.phaseId!=='string'||!f.phaseId||
             f.sourceFixtureId!==null||typeof f.tieId!=='string'||!f.tieId||
             !Number.isSafeInteger(f.leg)||f.leg<1||f.leg>2)throw Error('Invalid published bracket slot');
          const slot=[f.phaseId,f.tieId,f.leg].join(':');
          if(Object.hasOwn(bySlot,slot))throw Error('Duplicate published bracket slot');
          bySlot[slot]=item;
        }
      }
      const lookup={bySource,bySlot};
      if(league.length!==count||new Set(data.fixtures.map(f=>f.matchId)).size!==data.fixtures.length||
         league.some(f=>!f||!/^[1-9][0-9]*$/.test(f.matchId)||!Number.isSafeInteger(f.round)||
          f.round<1||f.round>roundCount||!Number.isSafeInteger(f.day)||f.day<1||f.day>56))throw Error('Invalid published league');
      const games=league.map(f=>{
        const home=international?f.homeClubId:Number(f.homeClubId?.split('-')[1]);
        const away=international?f.awayClubId:Number(f.awayClubId?.split('-')[1]);
        if(!international&&(!f.homeClubId?.startsWith(definition.id.split('-')[0]+'-')||
           !f.awayClubId?.startsWith(definition.id.split('-')[0]+'-')))throw Error('Invalid club scope');
        return {matchId:f.matchId,sourceFixtureId:f.sourceFixtureId,day:f.day,marker:f.marker,round:f.round,homeId:home,awayId:away,phaseId:'league',
          tieId:null,leg:null,neutral:false,homeGoals:null,awayGoals:null,kickoff:null,
          afterExtraTime:false,penalties:null};
      });
      const initialData=window.faCompetitionContext?.seasonData;
      const hasInitialScores=initialData?.provenance?.kind==='authoritative'&&initialData.season===season&&initialData.entrantsOnly!==true;
      const confirmed=initialData?.provenance?.kind==='authoritative'&&initialData.season===season&&initialData.entrantsOnly===true;
      // Reuse an already verified roster without an extra catalogue await.
      // Season 2 promotions require canonical lookup if this is still
      // the inaugural division map (the entrant response can arrive later).
      const knownDomesticClubs=!international&&games.every(g=>clubs.has(g.homeId)&&clubs.has(g.awayId));
      const participants=hasInitialScores?null:confirmed?
        initialData.participants:international?
        await publishedCupParticipants(games):knownDomesticClubs?null:
        await publishedDomesticParticipants(games);
      // The catalogue read can outlive an admin advance, source toggle, or
      // route change. Fence the commit AFTER every awaited dependency.
      const latest=window.faWorldState?.get?.();
      if(seq!==fetchSequence||latest?.source!=='authoritative'||latest.worldStatus!=='ready'||
         key!==publishedWorldKey(season,latest)||
         navigation.get().season!==String(season)||
         window.faCompetitionContext?.selectedSeason!==season)return;
      // Keep real sporting results: never overwrite them with a zero-score draw.
      // Keep the league draw in the shared Fixtures store even when the
      // published collection was first requested from the Postseason tab.
      // Otherwise switching tabs sees the deduplicated key but no schedule.
      // Already scored official seasons are never overwritten, even if the
      // authoritative season hydrated while the manifest request was pending.
      const scored=window.faCompetitionContext?.seasonData;
      const hasOfficialScores=scored?.provenance?.kind==='authoritative'&&scored.season===season&&scored.entrantsOnly!==true;
      const commit=hasOfficialScores?null:window.faFixtures.prepare(games,{currentMatchday:null,postseason:[],definition,participants});
      publishedSeason=String(season);publishedKey=key;publishedIds=new Set(league.map(f=>f.matchId));
      publishedLookup=lookup;
      if(commit)commit();else render();
      rememberPublished(cacheKey,{
        ids:league.map(f=>f.matchId),games,lookup,participants
      });
      notifyPublishedMatchLinks();
      syncKnockoutLinks();
    }catch{
      if(seq===fetchSequence){publishedSeason=null;publishedKey=null;publishedIds.clear();publishedLookup=null;notifyPublishedMatchLinks();syncKnockoutLinks();}
    }finally{if(seq===fetchSequence&&pendingKey===key){
      pendingKey=null;publishedAbort=null;render();syncKnockoutLinks();
      // In the combined #656/#659 source, resolve Standings native links
      // only after pendingKey is cleared; otherwise W/D/L stays inert.
      notifyPublishedMatchLinks();
    }}
  }

  // The world can become ready AFTER Fixtures mounted. Source-change is not
  // emitted on every initial /api/world completion, so subscribe directly.
  // The published-key fence prevents duplicate requests on repeated updates.
  window.faWorldState?.subscribe?.(snapshot=>{
    if(snapshot?.source!=='authoritative'||snapshot.worldStatus!=='ready'||!snapshot.world){
      if(publishedKey!==null||pendingKey!==null||publishedLookup!==null){
        publishedSeason=null;publishedKey=null;pendingKey=null;
        publishedLookup=null;publishedIds.clear();fetchSequence++;notifyPublishedMatchLinks();syncKnockoutLinks();
      }
      render();
      return;
    }
    // Remove old world identities from every consumer before the next read.
    const activeKey=publishedWorldKey(navigation.get().season,snapshot);
    if(publishedKey!==null&&publishedKey!==activeKey){
      publishedSeason=null;publishedKey=null;publishedLookup=null;
      publishedIds.clear();fetchSequence++;
      notifyPublishedMatchLinks();
    }
    syncKnockoutLinks();
    if(['standings','fixtures','postseason'].includes(navigation.get().view))void readPublishedFixtures();
  });
  // Safari may keep this document alive in its Back/Forward cache while a
  // published-match fetch is suspended. Retire only the unfinished request;
  // already verified same-world IDs remain cached, with no extra list read.
  window.addEventListener('pagehide',()=>{
    if(pendingKey!==null){
      fetchSequence++;pendingKey=null;publishedAbort?.abort();publishedAbort=null;
    }
  });
  window.addEventListener('pageshow',event=>{
    if(!event.persisted)return;
    delete document.documentElement.dataset.faFixtureHoverSuspended;
    render();syncKnockoutLinks();notifyPublishedMatchLinks();
    void readPublishedFixtures();
  });
  window.addEventListener('fa:competition-context-change',contextChanged);
  window.addEventListener('fa:source-change',()=>{
    publishedCache.clear();
    publishedSeason=null;publishedIds.clear();publishedLookup=null;publishedKey=null;pendingKey=null;
    fetchSequence++;notifyPublishedMatchLinks();syncKnockoutLinks();
    if(window.faCompetitionContext?.seasonData?.provenance?.kind!=='dev')void readPublishedFixtures();
  });
  window.addEventListener('fa:world-clock-snapshot',event=>{
    if(!international||window.faCompetitionContext?.seasonData?.provenance?.kind==='authoritative')return;
    const calendar=window.faWorldCalendarModel?.projectCompetition(window.faCompetitionContext.selectedSeason,definition.id);
    currentMatchday=calendar?displayValue(rules.currentFixtureChoice(definition,calendar,event.detail)):null;render();
  });
  contextChanged();
  render();
  syncKnockoutLinks();
})();
