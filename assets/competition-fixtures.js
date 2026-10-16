/* Competition fixtures: display supplied schedules only; never generate sporting data. */
(() => {
  "use strict";
  const division=window.faCompetitionDivision;
  const fields=Object.fromEntries(["toolbar","current","round","previous","next","list","empty","summary"]
    .map(key=>[key,document.getElementById("app-fixtures-"+key)]));
  if(!division||Object.values(fields).some(field=>!field))return;
  const clubs=new Map(division.clubs.map(club=>[club.clubId,club]));
  if(clubs.size!==16)return;
  const navigation=window.faCompetitionRoute;
  const picker=document.getElementById("app-fixtures-picker");
  const number=document.getElementById("app-fixtures-round-number");
  if(!navigation||!picker||!number)return;
  const choices=[...picker.querySelectorAll("[data-fixture-round-choice]")];
  if(choices.length!==30)return;
  let currentMatchday=null,rounds=null,selected=navigation.get().matchday;
  const roundMenu=window.faBindCompetitionMenu(fields.round,picker,choices,value=>select(value),
    document.querySelector(".app-fixtures-select"));
  const element=(tag,cls="",text="")=>{
    const item=document.createElement(tag);item.className=cls;item.textContent=text;return item;
  };
  const word=(key,text,cls="")=>{
    const item=element("span",cls,text);item.dataset.appI18n=key;return item;
  };
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
    if(!Array.isArray(fixtures)||fixtures.length!==240)throw Error("Incomplete competition schedule");
    const byRound=new Map(Array.from({length:30},(_,i)=>[i+1,[]])),pairs=new Set();
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
      if(matches.length!==8||new Set(matches.flatMap(game=>[game.homeId,game.awayId])).size!==16)
        throw Error("Incomplete competition round");
      matches.sort((a,b)=>a.homeId-b.homeId||a.awayId-b.awayId);
    }
    return byRound;
  }
  function identity(id,home){
    const club=clubs.get(id),item=element("span","app-fixture-club"+(home?" app-fixture-home":""));
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
    const meta=element("div","app-fixture-meta");
    if(game.kickoff===null)meta.append(word("fixturesTimingUnknown","Date/time to be confirmed"));
    else{
      const time=element("time");time.dateTime=game.kickoff;
      time.textContent=new Intl.DateTimeFormat(document.documentElement.lang||"en",
        {dateStyle:"medium",timeStyle:"short"}).format(new Date(game.kickoff));
      meta.append(time);
    }
    const played=game.homeGoals!==null;
    meta.append(word(played?"fixturesFullTime":"fixturesScheduled",played?"Full time":"Scheduled","app-fixture-status"));
    const score=element("strong","app-fixture-score",played?game.homeGoals+" – "+game.awayGoals:"—");
    item.append(identity(game.homeId,true),score,identity(game.awayId,false),meta);
    return item;
  }
  function render(){
    const available=rounds!==null&&["1","2"].includes(navigation.get().season);
    fields.toolbar.hidden=!available;
    fields.current.hidden=!available||currentMatchday===null||selected===currentMatchday;
    fields.round.value=String(selected);fields.round.disabled=!available;
    number.textContent=String(selected);
    roundMenu.sync(String(selected));
    if(!available)roundMenu.close();
    fields.previous.disabled=!available||selected===1;
    fields.next.disabled=!available||selected===30;
    fields.empty.hidden=available;fields.list.hidden=!available;fields.summary.hidden=!available;
    const matches=available?rounds.get(selected).map(matchRow):[];
    fields.list.replaceChildren(...matches);
    fields.summary.replaceChildren(word("fixturesMatchday","Matchday"),element("strong","",String(selected)),
      word("fixturesMatchCount","8 matches"));
    window.faAppRenderLanguage?.();
  }
  function select(value){
    const round=Number(value);
    if(rounds&&Number.isInteger(round)&&round>=1&&round<=30){
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
  fields.previous.addEventListener("click",()=>select(selected-1));
  fields.next.addEventListener("click",()=>select(selected+1));
  // Validate before returning a commit function; rejected input leaves the view intact.
  window.faFixtures={
    prepare(fixtures,{currentMatchday:current=null}={}){
      const next=validate(fixtures);
      if(current!==null&&(!Number.isInteger(current)||current<1||current>30))throw Error("Invalid current matchday");
      return ()=>{
        rounds=next;currentMatchday=next?current:null;
        navigation.defaultMatchday(currentMatchday??1);
        render();
      };
    },
    snapshot(){const previous=rounds,current=currentMatchday;return ()=>{
      rounds=previous;currentMatchday=current;selected=navigation.get().matchday;render()};}
  };
  new MutationObserver(()=>{if(rounds)render()}).observe(document.documentElement,
    {attributes:true,attributeFilter:["lang"]});
  render();
})();
