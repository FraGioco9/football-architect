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
  let configured=rules.fixtureChoices(definition),stage=international?null:configured.find(c=>typeof c.value==='string')?.value;
  let stageKey=stage==='playout'?'competitionTabPlayout':'competitionTabPlayoffs';
  const validRound=value=>Number.isInteger(value)&&value>=1&&value<=roundCount;
  const validChoice=value=>configured.some(c=>c.value===value);
  let knockoutPhases=definition.rules.phases.filter(p=>p.type==='knockout');
  let firstTies=knockoutPhases[0]?.ties.filter(t=>t.legs===2)||[];
  let hasFinal=knockoutPhases.some(p=>p.ties.some(t=>t.legs===1));
  let currentMatchday=null,rounds=null,postseason=[],selected=navigation.get().matchday;
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
    configured=rules.fixtureChoices(next);stage=international?null:configured.find(c=>typeof c.value==='string')?.value;
    stageKey=stage==='playout'?'competitionTabPlayout':'competitionTabPlayoffs';
    knockoutPhases=next.rules.phases.filter(p=>p.type==='knockout');firstTies=knockoutPhases[0]?.ties.filter(t=>t.legs===2)||[];
    hasFinal=knockoutPhases.some(p=>p.ties.some(t=>t.legs===1));
    choices=configured.map(choice=>{
      const option=element('div','language-option');option.id='app-fixtures-round-option-'+choice.value;
      option.dataset.menuValue=String(choice.value);option.dataset.fixtureRoundChoice=String(choice.value);option.setAttribute('role','option');
      if(typeof choice.value==='number')option.append(word('fixturesMatchday','Matchday'),element('span','',' '+choice.round));
      else{const label=element('span','',window.faCompetitionRulesView?.phaseLabel(choice.labelKey,document.documentElement.lang)||choice.labelKey);label.dataset.competitionPhase=choice.labelKey;option.append(label);if(choice.round)option.append(element('span','',' · '+choice.round));}
      return option;
    });
    picker.replaceChildren(...choices);postChoice=choices.find(choice=>choice.dataset.fixtureRoundChoice===stage)||element('div','language-option');
    postChoice.hidden=!Boolean(rounds&&stage);menuHasPostseason=false;roundMenu.update(choices);
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
      byRound.get(game.round).push({round:game.round,homeId:game.homeId,awayId:game.awayId,
        homeGoals:game.homeGoals,awayGoals:game.awayGoals,kickoff:game.kickoff});
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
    const crest=element("span","app-world-club-crest-placeholder");
    crest.dataset.clubCrest=rules.clubKey(club);crest.setAttribute("aria-hidden","true");
    item.append(word(home?"fixturesHome":"fixturesAway",home?"Home":"Away","sr-only"),crest,
      (()=>{const link=element("a","app-fixture-name app-world-standing-club-link",club.primaryName||club.abbr);link.href=window.faRoutesRegistry.buildRoute({kind:"club",country:club.countryId.toLowerCase(),id:club.clubId,view:"overview"});return link})());
    return item;
  }
  function matchRow(game){
    const item=element("li","app-fixture-match");
    item.dataset.fixtureMatch=game.round+":"+game.homeId+":"+game.awayId;
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
    result.append(status,score,
      element("span","app-fixture-stadium",clubs.get(game.homeId)?.stadiumName||"—"));
    item.append(identity(game.homeId,true),result,identity(game.awayId,false));
    return item;
  }
  function render(){
    const available=rounds!==null&&availableSeasons.has(navigation.get().season);
    const hasPostseason=available&&Boolean(stage);
    if(menuHasPostseason!==hasPostseason){
      menuHasPostseason=hasPostseason;postChoice.hidden=!hasPostseason;
      roundMenu.update(hasPostseason&&!choices.includes(postChoice)?[...choices,postChoice]:choices);
    }
    if(!validChoice(selected)){
      navigation.set({matchday:roundCount},{replace:true});return;
    }
    const isPostseason=typeof selected==='string';
    const selectedChoice=configured.find(c=>c.value===selected);
    fields.toolbar.hidden=!available;
    fields.current.hidden=!available||currentMatchday===null||selected===currentMatchday;
    fields.round.value=String(selected);fields.round.disabled=!available;
    const label=document.getElementById('app-fixtures-round-label');
    if(label)label.hidden=isPostseason;
    const selectedLabel=isPostseason?element('span','',window.faCompetitionRulesView?.phaseLabel(selectedChoice.labelKey,document.documentElement.lang)||selectedChoice.labelKey):element('span','',String(selected));
    if(isPostseason&&selectedChoice.round)selectedLabel.textContent+=' · '+selectedChoice.round;
    number.replaceChildren(selectedLabel);
    roundMenu.sync(String(selected));
    if(!available)roundMenu.close();
    const choiceIndex=configured.findIndex(c=>c.value===selected);
    fields.previous.disabled=!available||choiceIndex===0;
    fields.next.disabled=!available||choiceIndex===configured.length-1;
    fields.empty.hidden=available;fields.list.hidden=!available;fields.summary.hidden=!available;
    const matches=[];
    if(available){
      if(international&&isPostseason)matches.push(...(postseason.filter(g=>g.phaseId===selectedChoice.phaseId&&g.leg===selectedChoice.round).map(matchRow)));
      else if(isPostseason)for(const round of [31,32,33]){
        const games=postseason.filter(g=>g.round===round);
        if(round===33&&!hasFinal)continue;
        const count=round===33?1:firstTies.length;
        const display=games.length?games:Array.from({length:count},()=>({round,homeId:null,awayId:null,homeGoals:null,awayGoals:null,kickoff:null}));
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
      if(oldResult&&newResult)oldResult.replaceWith(newResult);
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
    if(typeof fields.list.insertBefore==="function"){
      for(let i=0;i<next.length;i++)if(fields.list.children[i]!==next[i])fields.list.insertBefore(next[i],fields.list.children[i]||null);
      while(fields.list.children.length>next.length)fields.list.lastElementChild.remove();
    }else fields.list.replaceChildren(...matches);
    fields.summary.replaceChildren(element('span','',selectedLabel.textContent),element('strong','',String(matches.filter(item=>item.dataset.fixtureMatch).length)),word('fixturesMatches','matches'));
    window.faAppRenderLanguage?.();
  }
  function select(value){
    const round=/^[1-9]\d*$/.test(String(value))?Number(value):value;
    if(rounds&&validChoice(round)){
      navigation.set({matchday:round});
    }
  }
  navigation.subscribe(route=>{
    selected=route.matchday;
    if(route.view==="fixtures"&&rounds!==null){
      navigation.defaultMatchday(currentMatchday??1);
      selected=navigation.get().matchday;
    }
    roundMenu.close();render();
  });
  fields.current.addEventListener("click",()=>{if(!fields.current.hidden){select(currentMatchday);fields.round.focus()}});
  fields.previous.addEventListener("click",()=>{if(!fields.previous.disabled)select(configured[configured.findIndex(c=>c.value===selected)-1].value)});
  fields.next.addEventListener("click",()=>{if(!fields.next.disabled)select(configured[configured.findIndex(c=>c.value===selected)+1].value)});
  // Validate before returning a commit function; rejected input leaves the view intact.
  window.faFixtures={
    prepare(fixtures,{currentMatchday:current=null,postseason:games=[],definition:applicable=window.faCompetitionContext?.definition}={}){
      updateDefinition(applicable);
      const next=validate(fixtures);
      const post=international?next?.postseason||[]:validatePostseason(games);
      if(!next&&post.length)throw Error('Post-season requires a league schedule');
      if(current!==null&&!validChoice(current))throw Error("Invalid current matchday");
       // The stage is selectable before participating clubs are known.
      return ()=>{
        rounds=next;postseason=post;currentMatchday=next?current:null;selected=navigation.get().matchday;
        navigation.defaultMatchday(currentMatchday??1);
        render();
      };
    },
    snapshot(){const previous=rounds,current=currentMatchday,post=postseason;return ()=>{
      rounds=previous;postseason=post;currentMatchday=current;selected=navigation.get().matchday;render()};}
  };
  new MutationObserver(()=>{if(rounds)render()}).observe(document.documentElement,
    {attributes:true,attributeFilter:["lang"]});
  function contextChanged(){
    updateDefinition(window.faCompetitionContext?.definition);
    const data=window.faCompetitionContext?.seasonData;
    if(!international&&data)return; // The protected domestic adapter commits transactionally through prepare().
    if(!data){rounds=null;postseason=[];currentMatchday=null;render();return;}
    const previous=clubs;
    try{
      clubs=new Map(data.participants.map(club=>[rules.clubKey(club),club]));
      if(clubs.size!==capacity)throw Error('Invalid cup participants');
      const calendar=window.faWorldCalendarModel?.projectCompetition(window.faCompetitionContext.selectedSeason,definition.id);
      const current=calendar?rules.currentFixtureChoice(definition,calendar,window.faDevWorldClockSnapshot||window.faWorldClockSnapshot):null;
      window.faFixtures.prepare(data.fixtures,{currentMatchday:current})();
    }catch{clubs=previous;rounds=null;postseason=[];currentMatchday=null;render();}
  }
  window.addEventListener('fa:competition-context-change',contextChanged);
  window.addEventListener('fa:world-clock-snapshot',event=>{
    if(!international)return;
    const calendar=window.faWorldCalendarModel?.projectCompetition(window.faCompetitionContext.selectedSeason,definition.id);
    currentMatchday=calendar?rules.currentFixtureChoice(definition,calendar,event.detail):null;render();
  });
  contextChanged();
  render();
})();
