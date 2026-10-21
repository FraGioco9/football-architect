/* CAL-IMP-01: read-only WORLD-TIME QA-06 projection. Not a live clock or fixture engine. */
((root,factory)=>{
  const model=factory();
  root.faWorldCalendarModel=model;
  if(typeof module!=="undefined"&&module.exports)module.exports=model;
})(typeof window!=="undefined"?window:globalThis,()=>{
  "use strict";
  const freeze=value=>{
    if(value&&typeof value==="object"){
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  const nationalDays=[13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,
    34,35,37,39,40,42,44,45,47,49,50,52,53,54];
  const internationalDays=[16,19,22,25,28,31,36,38,41,43,46,48];
  const divisions=["IT","ENG","ES","DE","FR","PT","NL","BR"].flatMap(country=>[country+"-1",country+"-2"]);
  // Calendar identity keys, not URL slugs or an implemented international catalogue.
  const cups=["sovereign-cup","federation-cup"];
  const validSeason=value=>Number.isSafeInteger(value)&&value>0;
  const object=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
  const keys=(value,allowed)=>object(value)&&Object.keys(value).every(key=>allowed.includes(key));
  const assert=(condition,message)=>{if(!condition)throw new TypeError(message)};
  const number=round=>String(round).padStart(2,"0");

  function createSeason(season){
    assert(validSeason(season),"Invalid calendar season");
    const days=Array.from({length:56},(_,i)=>({
      id:"season:"+season+":day:"+(i+1),day:i+1,
      kind:i<12?"preseason":i===55?"transition":"pause",pairing:null,events:[]
    }));
    function add(day,marker,family,phase,round,competitionIds){
      days[day-1].kind="official";
      days[day-1].events.push({id:"season:"+season+":"+marker,marker,family,phase,round,competitionIds:[...competitionIds]});
    }
    // Insert international markers first: their label precedes the national label.
    internationalDays.forEach((day,i)=>add(day,"I"+number(i+1),"international",
      i<6?"league":i<8?"playoffs":i<10?"quarterfinals":"semifinals",i+1,cups));
    add(53,"FEDERATION-FINAL","international","final",null,["federation-cup"]);
    add(54,"SOVEREIGN-FINAL","international","final",null,["sovereign-cup"]);
    nationalDays.forEach((day,i)=>add(day,"N"+number(i+1),"national",i<30?"league":"postseason",i+1,divisions));
    for(const day of days)if(day.events.length===2)day.pairing=day.day>=53?"final":"double";
    return freeze({schemaVersion:1,model:"WORLD-TIME-QA-06",season,
      provenance:{kind:"design",reference:"CAL-01 #236 / WORLD-TIME QA-06"},days});
  }

  function projectSeason(season,options={}){
    const calendar=createSeason(season);
    assert(keys(options,["current","source","eventStates"]),"Invalid calendar projection options");
    const {current=null,source={kind:"unavailable",reference:null},eventStates=[]}=options;
    assert(keys(source,["kind","reference"])&&["unavailable","dev","authoritative"].includes(source.kind),"Invalid calendar source");
    assert(source.kind==="unavailable"?source.reference===null:
      typeof source.reference==="string"&&source.reference.trim().length>0,"Calendar source needs explicit provenance");
    assert(current===null||(keys(current,["season","day"])&&validSeason(current.season)&&
      Number.isInteger(current.day)&&current.day>=1&&current.day<=56),"Invalid calendar progress");
    assert(Array.isArray(eventStates),"Invalid calendar event states");
    assert(source.kind!=="unavailable"||(current===null&&eventStates.length===0),"Unavailable source cannot supply progress or states");
    const events=new Map(calendar.days.flatMap(day=>day.events).map(event=>[event.id,event]));
    const states=new Map();
    for(const state of eventStates){
      assert(keys(state,["eventId","competitionId","status"]),"Invalid event state shape");
      const event=events.get(state.eventId);
      assert(event&&event.competitionIds.includes(state.competitionId)&&
        ["scheduled","live","completed"].includes(state.status),"Invalid event state identity or lifecycle");
      const key=state.eventId+"/"+state.competitionId;
      assert(!states.has(key),"Duplicate event state");
      states.set(key,state.status);
    }
    const relative=day=>{
      if(current===null)return null;
      if(season!==current.season)return season<current.season?"past":"future";
      return day===current.day?"current":day<current.day?"past":"future";
    };
    return freeze({...calendar,source:{kind:source.kind,reference:source.reference},
      days:calendar.days.map(day=>({...day,relative:relative(day.day),
        events:day.events.map(event=>({...event,competitions:event.competitionIds.map(competitionId=>({
          competitionId,status:states.get(event.id+"/"+competitionId)??null
        }))}))}))});
  }
  return freeze({createSeason,projectSeason});
});
