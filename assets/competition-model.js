/* Shared static/preview contract. This does not approve sports rules or allocations. */
((root,factory)=>{
  const model=factory();
  root.faCompetitionModel=model;
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
  const countries=["IT","ENG","ES","DE","FR","PT","NL","BR"];
  const tiers=[1,2];
  const profile={
    id:"domestic-league-v1",
    capacity:16,
    participants:{status:"provisional",approved:false,source:"data/division-allocations.provisional.json"},
    format:{type:"double-round-robin",status:"preview",legs:2,phases:[{id:"league",type:"round-robin"}]},
    rules:{status:"undefined",points:null,tiebreakers:null,promotion:null,relegation:null}
  };
  const roundsPerLeg=profile.capacity-1;
  const schedule={legs:profile.format.legs,roundsPerLeg,rounds:roundsPerLeg*profile.format.legs,
    matchesPerRound:profile.capacity/2,matches:profile.capacity*roundsPerLeg,
    pairings:profile.capacity*roundsPerLeg/2};
  const views=[
    {id:"standings",key:"competitionTabStandings",label:"Standings"},
    {id:"postseason",key:"competitionTabPostseason",label:"Playoffs / Playout"},
    {id:"fixtures",key:"competitionTabFixtures",label:"Fixtures"},
    {id:"stats",key:"competitionTabStats",label:"Stats"},
    {id:"history",key:"competitionTabHistory",label:"History"},
    {id:"rules",key:"competitionTabRules",label:"Rules"},
    {id:"awards",key:"competitionTabAwards",label:"Awards"}
  ];
  const divisionCount=countries.length*tiers.length;
  const participantCount=divisionCount*profile.capacity;
  const firstClubId=tier=>(tier-1)*profile.capacity+1;
  const validRound=round=>Number.isInteger(round)&&round>=1&&round<=schedule.rounds;
  function same(a,b){
    if(a===b)return true;
    if(!a||!b||typeof a!=="object"||typeof b!=="object"||Array.isArray(a)!==Array.isArray(b))return false;
    const keys=Object.keys(a);
    return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&same(a[key],b[key]));
  }
  function validManifest(data){
    if(data?.schemaVersion!==2||data.approved!==false||!same(data.profile,profile)||
      !Array.isArray(data.divisions)||data.divisions.length!==divisionCount)return false;
    if(!data.clubCrests||typeof data.clubCrests!=="object"||Array.isArray(data.clubCrests))return false;
    for(const [id,path] of Object.entries(data.clubCrests)){
      const match=id.match(/^([A-Z]{2,3})-([1-9]\d*)$/);
      if(!match||!countries.includes(match[1])||Number(match[2])>40||
        path!==`assets/clubs/${match[1]}/${match[2]}/crest.svg`)return false;
    }
    const ids=new Set(),clubs=new Set();
    for(const d of data.divisions){
      if(!d||!countries.includes(d.countryId)||!tiers.includes(d.tier)||
        d.id!==d.countryId+"-"+d.tier||ids.has(d.id)||
        typeof d.name!=="string"||!d.name.trim()||
        typeof d.countryName!=="string"||!d.countryName.trim()||
        d.flagAsset!=="assets/flags/"+(d.countryId==="ENG"?"gb-eng":d.countryId.toLowerCase())+".svg"||
        d.capacity!==profile.capacity||!Array.isArray(d.clubs)||d.clubs.length!==profile.capacity)return false;
      ids.add(d.id);
      let previous=firstClubId(d.tier)-1;
      for(const club of d.clubs){
        if(!club)return false;
        const key=club.countryId+":"+club.clubId;
        if(club.countryId!==d.countryId||!Number.isInteger(club.clubId)||
          club.clubId!==previous+1||clubs.has(key)||
          [club.fullName,club.abbr,club.stadiumName].some(value=>typeof value!=="string"||!value.trim())||
          !(club.primaryName===null||(typeof club.primaryName==="string"&&!!club.primaryName.trim())))return false;
        clubs.add(key);previous=club.clubId;
      }
    }
    if(ids.size!==divisionCount||clubs.size!==participantCount||!Array.isArray(data.competitions)||data.competitions.length!==18)return false;
    const names=new Set(),slugs=new Set();
    for(const x of data.competitions){
      if(!x||typeof x.id!=="string"||!x.id||typeof x.slug!=="string"||!x.slug||names.has(x.id)||slugs.has(x.slug)||!x.rules||x.rules.schemaVersion!==1||!Array.isArray(x.rules.phases)||!x.metrics||!x.metrics.phases||typeof x.metrics.phases!=="object"||Array.isArray(x.metrics.phases)||!x.capabilities||!Array.isArray(x.capabilities.phaseIds)||!Array.isArray(x.capabilities.awardIds)||!Array.isArray(x.rules.awards))return false;
      const phaseIds=new Set();
      let total=0;
      for(const phase of x.rules.phases){
        if(!phase||typeof phase.id!=="string"||!phase.id||phaseIds.has(phase.id)||!Array.isArray(phase.calendarEvents)||!phase.calendarEvents.length)return false;
        phaseIds.add(phase.id);
        let rounds,perRound,matches;
        if(phase.type==="roundRobin"){
          if(!Number.isSafeInteger(phase.meetingsPerPair)||phase.meetingsPerPair<1)return false;
          rounds=(x.capacity-1)*phase.meetingsPerPair;perRound=x.capacity/2;matches=rounds*perRound;
        }else if(phase.type==="leaguePhase"){
          if(!Number.isSafeInteger(phase.rounds)||!Number.isSafeInteger(phase.matchesPerClub)||phase.homeMatchesPerClub+phase.awayMatchesPerClub!==phase.matchesPerClub)return false;
          rounds=phase.rounds;perRound=x.capacity/2;matches=x.capacity*phase.matchesPerClub/2;
        }else if(phase.type==="knockout"){
          if(!Array.isArray(phase.ties))return false;
          rounds=phase.calendarEvents.length;perRound=null;
          matches=phase.ties.reduce((sum,t)=>sum+(Number.isSafeInteger(t?.legs)?t.legs:NaN),0);
        }else return false;
        if((phase.type==="roundRobin"||phase.type==="leaguePhase")&&(
          !phase.points||["win","draw","loss"].some(k=>!Number.isSafeInteger(phase.points[k])||phase.points[k]<0)||
          !Array.isArray(phase.rankOutcomes)||!Array.isArray(phase.tiebreakers)||!phase.tiebreakers.length||
          phase.rankOutcomes.some(b=>!b||!Number.isSafeInteger(b.from)||!Number.isSafeInteger(b.to)||b.from<1||b.to<b.from||b.to>x.capacity)||
          phase.rankOutcomes.reduce((n,b)=>n+(b.to-b.from+1),0)!==x.capacity||
          new Set(phase.rankOutcomes.flatMap(b=>Array.from({length:b.to-b.from+1},(_,i)=>b.from+i))).size!==x.capacity))return false;
        if(!Number.isSafeInteger(matches)||phase.calendarEvents.length!==rounds||!same(x.metrics.phases?.[phase.id],{rounds,matchesPerRound:perRound,matches}))return false;
        total+=matches;
      }
      if(!same(x.capabilities.phaseIds,x.rules.phases.map(p=>p.id))||!same(x.capabilities.awardIds,x.rules.awards)||Object.keys(x.metrics.phases).length!==phaseIds.size||x.metrics.totalMatches!==total)return false;
      if(x.slug!==x.id.toLowerCase())return false;
      names.add(x.id);slugs.add(x.slug);
      if(x.category==="domestic"){
        const d=data.divisions.find(y=>y.id===x.id);
        if(!d||x.name!==d.name||x.countryId!==d.countryId||x.countryName!==d.countryName||x.tier!==d.tier||x.capacity!==16||x.rules.version!==(x.tier===1?"domestic-top-v1":"domestic-second-v1")||x.metrics.phases?.league?.matches!==240)return false;
      }else if(x.category!=="international"||!["sovereign-cup","federation-cup"].includes(x.id)||x.capacity!==24||x.rules.version!=="international-int24-v1"||x.metrics.phases?.league?.matches!==72||x.metrics.totalMatches!==93)return false;
    }
    return data.divisions.every(d=>names.has(d.id))&&names.has("sovereign-cup")&&names.has("federation-cup");
  }
  const competitionById=(manifest,id)=>validManifest(manifest)?manifest.competitions.find(x=>x.id===id)||null:null;
  return freeze({countries,tiers,profile,schedule,views,divisionCount,participantCount,firstClubId,validRound,validManifest,competitionById});
});
