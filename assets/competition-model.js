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
    if(data?.schemaVersion!==1||data.approved!==false||!same(data.profile,profile)||
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
    return ids.size===divisionCount&&clubs.size===participantCount;
  }
  return freeze({countries,tiers,profile,schedule,views,divisionCount,participantCount,firstClubId,validRound,validManifest});
});
