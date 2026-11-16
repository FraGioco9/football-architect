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
  let publishedSeason=null,publishedKey=null,pendingKey=null,fetchSequence=0,publishedIds=new Set(),publishedLookup=null;
  let menuHasPostseason=false;
  // Preserve each club crest host (and its loaded image) when the matchday changes.
  const crestHosts=new Map();
  const roundMenu=window.faBindCompetitionMenu(fields.round,picker,choices,value=>select(value),
    document.querySelector(".app-fixtures-select"));
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
  function identity(id,home){
    const club=clubs.get(id),item=element("span","app-fixture-club"+(home?" app-fixture-home":""));
    if(!club){item.append(word(home?"fixturesHome":"fixturesAway",home?"Home":"Away","sr-only"),element("span","app-world-club-crest-placeholder"),element("span","app-fixture-name","TBD"));return item;}
    const crest=element("span","app-world-club-crest-placeholder fa-crest-loading");
    crest.dataset.clubCrest=rules.clubKey(club);crest.setAttribute("aria-hidden","true");
    item.append(word(home?"fixturesHome":"fixturesAway",home?"Home":"Away","sr-only"),crest,
      (()=>{const link=element("a","app-fixture-name app-world-standing-club-link",club.primaryName||club.abbr);link.href=window.faRoutesRegistry.buildRoute({kind:"club",country:club.countryId.toLowerCase(),id:club.clubId,view:"overview"});return link})());
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
    else if(game.kickoff===null)status=word("fixturesTimingUnknown","Date TBD","app-fixture-status");
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
    // Match identity comes from the official public collection, never a pairing.
    let scoreContent=score,publicId=null;
    // A confirmed public ID belongs to one exact world revision only.
    // Never surface IDs from an earlier world after advancing/resetting it.
    const liveSource=window.faWorldState?.get?.();
    const liveWorld=liveSource?.world;
    const liveKey=[navigation.get().season,definition.id,liveWorld?.generation,liveWorld?.revision].join(':');
    if(liveSource?.source==='authoritative'&&liveSource?.worldStatus==='ready'&&
       publishedSeason===navigation.get().season&&publishedKey===liveKey&&publishedLookup){
      if(game.matchId&&publishedIds.has(game.matchId))publicId=game.matchId;
      else if(game.phaseId==='league'&&typeof game.sourceFixtureId==='string'){
        const official=publishedLookup.bySource[game.sourceFixtureId];
        if(official&&official.phaseId==='league'&&official.round===game.round&&
           official.day===game.day&&official.marker===game.marker)publicId=official.matchId;
      }else if(game.phaseId!=='league'&&typeof game.tieId==='string'&&
               Number.isSafeInteger(game.leg)){
        const official=publishedLookup.bySlot[[game.phaseId,game.tieId,game.leg].join(':')];
        if(official&&official.day===game.day&&official.marker===game.marker)publicId=official.matchId;
      }
    }
    if(publicId){
      item.className+=' is-match-link';
      const link=element('a','app-fixture-score-link');
      link.href='/matches/'+publicId;
      const action={en:'Open match',de:'Spiel öffnen',es:'Abrir partido',fr:'Ouvrir le match',it:'Apri partita'};
      const locale=document.documentElement.lang||'en';
      link.setAttribute('aria-label',(action[locale]||action.en)+': '+
        (clubs.get(game.homeId)?.primaryName||'Home')+' – '+(clubs.get(game.awayId)?.primaryName||'Away'));
      link.append(score);scoreContent=link;
    }
    result.append(status,scoreContent,
      element("span","app-fixture-stadium",clubs.get(game.homeId)?.stadiumName||"—"));
    item.append(identity(game.homeId,true),result,identity(game.awayId,false));
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
    const hasSchedule=available&&([...rounds.values()].some(games=>games.length)||postseason.length>0);
    fields.toolbar.hidden=!loading&&!hasSchedule;
    fields.current.hidden=!available||currentMatchday===null||selected===currentMatchday;
    fields.round.value=String(selected);fields.round.disabled=false;
    const label=document.getElementById('app-fixtures-round-label');
    if(label)label.hidden=isPostseason;
    const selectedLabel=isPostseason?element('span','',window.faCompetitionRulesView?.fixturesChoiceLabel?.(definition,selectedChoice,document.documentElement.lang)||selectedChoice.labelKey):element('span','',String(selected));
    if(isPostseason)selectedLabel.dataset.competitionFixtureChoice=String(selectedChoice.value);
    window.faFixturesShell?.select(selected);
    if(!number.firstElementChild?.isEqualNode?.(selectedLabel))number.replaceChildren(selectedLabel);
    roundMenu.sync(String(selected));
    if(!available)roundMenu.close();
    const choiceIndex=configured.findIndex(c=>c.value===selected);
    fields.previous.disabled=choiceIndex===0;
    fields.next.disabled=choiceIndex===configured.length-1;
    fields.empty.hidden=available;fields.list.hidden=!available;fields.summary.hidden=!available;
    const matches=[];
    if(available){
      if(international&&isPostseason){
        const phase=definition.rules.phases.find(p=>p.id===selectedChoice.phaseId),legs=Math.max(...phase.ties.map(t=>t.legs));
        for(let leg=1;leg<=legs;leg++){
          const games=postseason.filter(g=>g.phaseId===phase.id&&g.leg===leg);
          if(!games.length)continue;
          if(legs>1){const heading=element('li','app-fixture-stage'),title=element('h3');title.append(word(leg===1?'postseasonFirstLeg':'postseasonSecondLeg',leg===1?'First leg':'Second leg'));heading.append(title);matches.push(heading);}
          matches.push(...games.map(matchRow));
        }
      }
      else if(isPostseason)for(const round of [31,32,33]){
        const games=postseason.filter(g=>g.round===round);
        if(round===33&&!hasFinal)continue;
        const count=round===33?1:firstTies.length;
        const display=games.length?games:Array.from({length:count},(_,index)=>({
          round,homeId:null,awayId:null,homeGoals:null,awayGoals:null,kickoff:null,
          fixtureSlot:round===33?'final':firstTies[index].id
        }));
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
      if(!previous)return item;
      // Club identities are immutable for a given match key; only results change.
      const oldResult=previous.querySelector?.(".app-fixture-result");
      const newResult=item.querySelector?.(".app-fixture-result");
      if(oldResult&&newResult&&!oldResult.isEqualNode?.(newResult))oldResult.replaceWith(newResult);
      // Reused crest rows must also gain/lose the full-card link affordance
      // when their official match identity changes.
      previous.className=item.className;
      return previous;
    });
    if(international){const hasMatches=next.some(item=>item.dataset.fixtureMatch);fields.empty.hidden=hasMatches;fields.list.hidden=!hasMatches;fields.summary.hidden=!hasMatches;}
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
    const absent=matching&&data.fixtures===null;
    const emptyRound=available&&((international&&!next.some(item=>item.dataset.fixtureMatch))||
      (!international&&!isPostseason&&matches.length===0));
    const panel=document.getElementById('competition-panel-fixtures');
    if(panel){
      panel.dataset.faContentState=absent||emptyRound?'empty':available?'available':'unknown';
      panel.dataset.faContentSeason=String(context?.selectedSeason??'');
      panel.dataset.faContentRevision=String(context?.revision??'');
    }
    if(absent||emptyRound){fields.empty.hidden=false;fields.list.hidden=true;fields.summary.hidden=true;}
    window.faAppRenderLanguage?.();
  }
  function select(value){
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
    if(route.view==='fixtures'||route.view==='postseason')void readPublishedFixtures();
  });
  // Knockout bracket scores represent *different matches* for each leg.
  // Use the already-verified public competition collection, not club IDs or
  // inferred pairings. Score cells are separate native links; single-leg
  // finals may additionally use the whole bracket card as a click target.
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
    const liveKey=[route.season,definition.id,world?.generation,world?.revision].join(':');
    const authorized=source?.source==='authoritative'&&source.worldStatus==='ready'&&
      route.season===publishedSeason&&publishedKey===liveKey&&!!publishedLookup;
    const lang=bracketLabels[document.documentElement.lang]||bracketLabels.en;
    for(const score of root.querySelectorAll('[data-postseason-score]')){
      const cell=score.parentElement,card=score.closest?.('[data-bracket-tie]');
      if(!cell||!card)continue;
      const tieId=card.dataset.bracketTie;
      const phase=definition.rules.phases.find(p=>p.type==='knockout'&&
        p.ties.some(tie=>tie.id===tieId));
      const metric=score.dataset.postseasonScore?.split(':').at(-1);
      const leg=metric==='first'?1:metric==='second'?2:metric==='final'?1:null;
      const registered=phase?.ties.find(t=>t.id===tieId);
      const id=authorized&&leg&&registered&&leg<=registered.legs
        ?publishedLookup.bySlot[[phase.id,tieId,leg].join(':')]?.matchId:null;
      const existing=cell.querySelector?.('.fa-bracket-leg-link');
      if(!id){
        existing?.remove();
        cell.classList?.remove('is-match-link');
        card.classList?.remove('is-single-match-link');
        continue;
      }
      let anchor=existing;
      if(!anchor){
        anchor=document.createElement('a');
        anchor.className='fa-bracket-leg-link';
        cell.append(anchor);
      }
      anchor.href='/matches/'+id;
      anchor.setAttribute('aria-label',lang[0]+': '+(leg===1&&registered.legs===1?lang[3]:lang[leg]));
      cell.classList?.add('is-match-link');
      if(registered.legs===1)card.classList?.add('is-single-match-link');
    }
  }
  // The bracket is recreated when season rules change. Defer sync until the
  // last synchronous context listener has completed its DOM commit.
  const bracketAfterContext=()=>void Promise.resolve().then(syncKnockoutLinks);
  window.addEventListener('fa:competition-context-change',bracketAfterContext);
  window.addEventListener('fa:source-change',bracketAfterContext);
  window.addEventListener('fa:published-match-links-change',syncKnockoutLinks);
  window.addEventListener('fa:competition-route-change',bracketAfterContext);
  document.getElementById('app-postseason-bracket')?.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||
       event.altKey||event.shiftKey)return;
    const target=event.target;
    if(!target?.closest||target.closest('a,button,input,select,textarea,[role="button"]'))return;
    const cell=target.closest('.fa-bracket-score.is-match-link');
    if(cell){cell.querySelector('.fa-bracket-leg-link')?.click();return;}
    const card=target.closest('.fa-bracket-card.is-single-match-link');
    card?.querySelector('.fa-bracket-leg-link')?.click();
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
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||
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
    const data=window.faCompetitionContext?.seasonData;
    if(!international&&data&&data.provenance?.kind!=='authoritative')return; // The protected domestic adapter commits transactionally through prepare().
    // The existing published IDs remain valid when this world's results hydrate.
    if(!data){rounds=null;postseason=[];currentMatchday=null;publishedSeason=null;publishedIds.clear();publishedLookup=null;render();void readPublishedFixtures();return;}
    const previous=clubs;
    try{
      clubs=new Map(data.participants.map(club=>[international?rules.clubKey(club):club.clubId,club]));
      if(clubs.size!==capacity)throw Error('Invalid cup participants');
      const calendar=window.faWorldCalendarModel?.projectCompetition(window.faCompetitionContext.selectedSeason,definition.id);
      const current=data.provenance?.kind==='authoritative'?data.currentMatchday:calendar?rules.currentFixtureChoice(definition,calendar,window.faDevWorldClockSnapshot||window.faWorldClockSnapshot):null;
      window.faFixtures.prepare(data.fixtures,{currentMatchday:current,postseason:data.postseason||[],definition})();
      if(data.provenance?.kind==='authoritative')void readPublishedFixtures();
    }catch{clubs=previous;rounds=null;postseason=[];currentMatchday=null;render();}
  }

  /** Read only the officially committed draw, even before worldwide publication. */
  async function readPublishedFixtures(){
    const context=window.faCompetitionContext,source=window.faWorldState?.get?.();
    const route=navigation.get(),season=Number(route.season);
    if(!['fixtures','postseason'].includes(route.view)||source?.source!=='authoritative'||source?.worldStatus!=='ready'||!source.world||
       !Number.isSafeInteger(season)||season<1||context?.selectedSeason!==season||
       season>source.world.seasonNumber)return;
    const key=[season,definition.id,source.world.generation,source.world.revision].join(':');
    if(key===publishedKey||key===pendingKey)return;
    pendingKey=key;const seq=++fetchSequence;
    try{
      const response=await fetch('/api/matches/seasons/'+season+'/competitions/'+definition.id,
       {credentials:'omit',cache:'no-store',redirect:'error'});
      if(response.status===404){if(seq===fetchSequence)publishedKey=key;return;}
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
      const latest=window.faWorldState?.get?.();
      if(seq!==fetchSequence||key!==[season,definition.id,latest?.world?.generation,latest?.world?.revision].join(':')||
         navigation.get().season!==String(season))return;
      const hasOfficialScores=window.faCompetitionContext?.seasonData?.provenance?.kind==='authoritative';
      // Keep real sporting results: never overwrite them with a zero-score draw.
      const commit=hasOfficialScores||navigation.get().view!=='fixtures'?null:window.faFixtures.prepare(games,{currentMatchday:null,postseason:[],definition});
      publishedSeason=String(season);publishedKey=key;publishedIds=new Set(league.map(f=>f.matchId));
      publishedLookup=lookup;
      if(commit)commit();else render();
      syncKnockoutLinks();
    }catch{
      if(seq===fetchSequence){publishedSeason=null;publishedKey=null;publishedIds.clear();publishedLookup=null;syncKnockoutLinks();}
    }finally{if(pendingKey===key)pendingKey=null;}
  }

  // The world can become ready AFTER Fixtures mounted. Source-change is not
  // emitted on every initial /api/world completion, so subscribe directly.
  // The published-key fence prevents duplicate requests on repeated updates.
  window.faWorldState?.subscribe?.(snapshot=>{
    if(snapshot?.source!=='authoritative'||snapshot.worldStatus!=='ready'||!snapshot.world){
      if(publishedKey!==null||pendingKey!==null||publishedLookup!==null){
        publishedSeason=null;publishedKey=null;pendingKey=null;
        publishedLookup=null;publishedIds.clear();fetchSequence++;render();syncKnockoutLinks();
      }
      return;
    }
    if(['fixtures','postseason'].includes(navigation.get().view))void readPublishedFixtures();
  });
  window.addEventListener('fa:competition-context-change',contextChanged);
  window.addEventListener('fa:source-change',()=>{publishedSeason=null;publishedIds.clear();publishedLookup=null;publishedKey=null;pendingKey=null;fetchSequence++;syncKnockoutLinks();if(window.faCompetitionContext?.seasonData?.provenance?.kind!=='dev')void readPublishedFixtures();});
  window.addEventListener('fa:world-clock-snapshot',event=>{
    if(!international||window.faCompetitionContext?.seasonData?.provenance?.kind==='authoritative')return;
    const calendar=window.faWorldCalendarModel?.projectCompetition(window.faCompetitionContext.selectedSeason,definition.id);
    currentMatchday=calendar?displayValue(rules.currentFixtureChoice(definition,calendar,event.detail)):null;render();
  });
  contextChanged();
  render();
  syncKnockoutLinks();
})();
