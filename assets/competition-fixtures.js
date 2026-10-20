/* Competition fixtures: display supplied schedules only; never generate sporting data. */
(() => {
  "use strict";
  const model=window.faCompetitionModel;
  const {capacity}=model.profile;
  const {rounds:roundCount,matches:matchCount,matchesPerRound}=model.schedule;
  const division=window.faCompetitionDivision;
  const fields=Object.fromEntries(["toolbar","current","round","previous","next","list","empty","summary"]
    .map(key=>[key,document.getElementById("app-fixtures-"+key)]));
  if(!division||Object.values(fields).some(field=>!field))return;
  const clubs=new Map(division.clubs.map(club=>[club.clubId,club]));
  if(clubs.size!==capacity)return;
  const navigation=window.faCompetitionRoute;
  const devSeasons=(document.documentElement.dataset.faDevSeasons||"").split(",").filter(value=>/^[1-9]\d*$/.test(value));
  const availableSeasons=new Set(["1",...devSeasons]);
  const picker=document.getElementById("app-fixtures-picker");
  const number=document.getElementById("app-fixtures-round-number");
  if(!navigation||!picker||!number)return;
  const choices=[...picker.querySelectorAll("[data-fixture-round-choice]")];
  if(choices.length!==roundCount)return;
  const stage=division.tier===1?'playout':'playoffs';
  const stageKey=division.tier===1?'competitionTabPlayout':'competitionTabPlayoffs';
  let currentMatchday=null,rounds=null,postseason=[],selected=navigation.get().matchday;
  let menuHasPostseason=false;
  const roundMenu=window.faBindCompetitionMenu(fields.round,picker,choices,value=>select(value),
    document.querySelector(".app-fixtures-select"));
  const element=(tag,cls="",text="")=>{
    const item=document.createElement(tag);item.className=cls;item.textContent=text;return item;
  };
  const word=(key,text,cls="")=>{
    const item=element("span",cls,text);item.dataset.appI18n=key;return item;
  };
  const postChoice=element('div','language-option');
  postChoice.id='app-fixtures-round-option-'+stage;postChoice.dataset.menuValue=stage;
  postChoice.dataset.fixtureRoundChoice=stage;postChoice.setAttribute('role','option');
  postChoice.append(word(stageKey,division.tier===1?'Playout':'Playoffs'));
  postChoice.hidden=false;picker.append(postChoice);
  function validatePostseason(games){
    if(!Array.isArray(games))throw Error('Invalid post-season fixtures');
    if(!games.length)return [];
    const size=division.tier===1?1:2;
    if(![size*2,...(division.tier===2?[5]:[])].includes(games.length))throw Error('Incomplete post-season fixtures');
    const seen=new Set();
    const next=games.map(g=>{
      if(!g||![31,32,...(division.tier===2?[33]:[])].includes(g.round)||
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
  function identity(id,home){
    const club=clubs.get(id),item=element("span","app-fixture-club"+(home?" app-fixture-home":""));
    if(!club){item.append(word(home?"fixturesHome":"fixturesAway",home?"Home":"Away","sr-only"),element("span","app-world-club-crest-placeholder"),element("span","app-fixture-name","TBD"));return item;}
    const crest=element("span","app-world-club-crest-placeholder");
    crest.dataset.clubCrest=club.countryId+"-"+id;crest.setAttribute("aria-hidden","true");
    item.append(word(home?"fixturesHome":"fixturesAway",home?"Home":"Away","sr-only"),crest,
      element("span","app-fixture-name",club.primaryName||club.abbr));
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
    const hasPostseason=available;
    if(menuHasPostseason!==hasPostseason){
      menuHasPostseason=hasPostseason;postChoice.hidden=!hasPostseason;
      roundMenu.update(hasPostseason?[...choices,postChoice]:choices);
    }
    if(rounds!==null&&!model.validRound(selected)&&(!hasPostseason||selected!==stage)){
      navigation.set({matchday:roundCount},{replace:true});return;
    }
    const isPostseason=selected===stage;
    fields.toolbar.hidden=!available;
    fields.current.hidden=!available||currentMatchday===null||selected===currentMatchday;
    fields.round.value=String(selected);fields.round.disabled=!available;
    const label=document.getElementById('app-fixtures-round-label');
    if(label)label.hidden=isPostseason;
    number.replaceChildren(isPostseason?word(stageKey,division.tier===1?'Playout':'Playoffs'):element('span','',String(selected)));
    roundMenu.sync(String(selected));
    if(!available)roundMenu.close();
    fields.previous.disabled=!available||selected===1;
    fields.next.disabled=!available||isPostseason||selected===roundCount&&!hasPostseason;
    fields.empty.hidden=available;fields.list.hidden=!available;fields.summary.hidden=!available;
    const matches=[];
    if(available){
      if(isPostseason)for(const round of [31,32,33]){
        const games=postseason.filter(g=>g.round===round);
        if(round===33&&division.tier===1)continue;
        const count=round===33?1:division.tier===1?1:2;
        const display=games.length?games:Array.from({length:count},()=>({round,homeId:null,awayId:null,homeGoals:null,awayGoals:null,kickoff:null}));
        const heading=element('li','app-fixture-stage');
        const title=element('h3');title.append(word(round===31?'postseasonFirstLeg':round===32?'postseasonSecondLeg':'postseasonFinal',round===31?'First leg':round===32?'Second leg':'Final'));
        heading.append(title);matches.push(heading,...display.map(matchRow));
      }
      else matches.push(...rounds.get(selected).map(matchRow));
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
    if(typeof fields.list.insertBefore==="function"){
      for(let i=0;i<next.length;i++)if(fields.list.children[i]!==next[i])fields.list.insertBefore(next[i],fields.list.children[i]||null);
      while(fields.list.children.length>next.length)fields.list.lastElementChild.remove();
    }else fields.list.replaceChildren(...matches);
    fields.summary.replaceChildren(...(isPostseason?[word(stageKey,division.tier===1?'Playout':'Playoffs')]:[word("fixturesMatchday","Matchday"),element("strong","",String(selected))]),
      ...(isPostseason?[element('strong','',String(postseason.length|| (division.tier===1?2:5))),word('fixturesMatches','matches')]:[word("fixturesMatchCount","8 matches")]));
    window.faAppRenderLanguage?.();
  }
  function select(value){
    const round=value===stage?stage:Number(value);
    if(rounds&&(model.validRound(round)||round===stage)){
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
  fields.previous.addEventListener("click",()=>select(selected===stage?roundCount:selected-1));
  fields.next.addEventListener("click",()=>{if(!fields.next.disabled)select(selected===roundCount?stage:selected+1)});
  // Validate before returning a commit function; rejected input leaves the view intact.
  window.faFixtures={
    prepare(fixtures,{currentMatchday:current=null,postseason:games=[]}={}){
      const next=validate(fixtures);
      const post=validatePostseason(games);
      if(!next&&post.length)throw Error('Post-season requires a league schedule');
      if(current!==null&&!model.validRound(current)&&current!==stage)throw Error("Invalid current matchday");
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
  render();
})();
