/* Shared static/preview contract. This does not approve sports rules or allocations. */
((root,factory)=>{
  const model=factory(root,typeof module!=="undefined"&&module.exports?require("./competition-rules.js"):null);
  root.faCompetitionModel=model;
  if(typeof module!=="undefined"&&module.exports)module.exports=model;
})(typeof window!=="undefined"?window:globalThis,(root,commonRules)=>{
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
  // Immutable migration archive captured at 13a3a07. Never regenerate it from
  // editable current catalogues: old records without snapshots must not drift.
  const baselineRules=freeze({"domestic-top-v1":{"schemaVersion":1,"version":"domestic-top-v1","qualificationPolicyId":"none","phases":[{"id":"league","type":"roundRobin","labelKey":"league","calendarEvents":["N01","N02","N03","N04","N05","N06","N07","N08","N09","N10","N11","N12","N13","N14","N15","N16","N17","N18","N19","N20","N21","N22","N23","N24","N25","N26","N27","N28","N29","N30"],"meetingsPerPair":2,"points":{"win":3,"draw":1,"loss":0},"tiebreakers":["points","headToHeadPointsReapply","headToHeadGoalDifferenceReapply","headToHeadGoalsForReapply","goalDifference","goalsFor","wins","reproducibleDraw"],"rankOutcomes":[{"from":1,"to":1,"kind":"champion"},{"from":2,"to":12,"kind":"remain"},{"from":13,"to":14,"kind":"playout","targetPhaseId":"playout"},{"from":15,"to":16,"kind":"relegated"}]},{"id":"playout","type":"knockout","labelKey":"playout","calendarEvents":["N31","N32"],"ties":[{"id":"playout","participants":[{"phaseId":"league","rank":13},{"phaseId":"league","rank":14}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","winnerOutcome":"remain","loserOutcome":"relegated"}]}],"awards":["champion","manager","player","young","boot","assists","glove","defender","midfielder","forward","xi"]},"domestic-second-v1":{"schemaVersion":1,"version":"domestic-second-v1","qualificationPolicyId":"none","phases":[{"id":"league","type":"roundRobin","labelKey":"league","calendarEvents":["N01","N02","N03","N04","N05","N06","N07","N08","N09","N10","N11","N12","N13","N14","N15","N16","N17","N18","N19","N20","N21","N22","N23","N24","N25","N26","N27","N28","N29","N30"],"meetingsPerPair":2,"points":{"win":3,"draw":1,"loss":0},"tiebreakers":["points","headToHeadPointsReapply","headToHeadGoalDifferenceReapply","headToHeadGoalsForReapply","goalDifference","goalsFor","wins","reproducibleDraw"],"rankOutcomes":[{"from":1,"to":2,"kind":"promoted"},{"from":3,"to":6,"kind":"promotionPlayoffs","targetPhaseId":"promotionPlayoffs"},{"from":7,"to":16,"kind":"remain"}]},{"id":"promotionPlayoffs","type":"knockout","labelKey":"promotionPlayoffs","calendarEvents":["N31","N32","N33"],"ties":[{"id":"semi36","participants":[{"phaseId":"league","rank":3},{"phaseId":"league","rank":6}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"remain"},{"id":"semi45","participants":[{"phaseId":"league","rank":4},{"phaseId":"league","rank":5}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"remain"},{"id":"final","participants":[{"tieId":"semi36"},{"tieId":"semi45"}],"legs":1,"homePolicy":"higherOriginalTableRank","resolution":"singleExtraTimePenalties","loserOutcome":"remain","winnerOutcome":"promoted"}]}],"awards":["champion","promotion","playoff","manager","player","young","boot","assists","glove","defender","midfielder","forward","xi"]},"sovereign-cup":{"schemaVersion":1,"version":"international-int24-v1","qualificationPolicyId":"int24ChampionAwareV1","awards":["champion","manager","player","young","boot","assists","glove","defender","midfielder","forward","xi"],"phases":[{"id":"league","type":"leaguePhase","labelKey":"league","calendarEvents":["I01","I02","I03","I04","I05","I06"],"rounds":6,"matchesPerClub":6,"homeMatchesPerClub":3,"awayMatchesPerClub":3,"drawPolicyId":"int24SixOpponentsV1","points":{"win":3,"draw":1,"loss":0},"tiebreakers":["points","goalDifference","goalsFor","wins","awayGoals","awayWins","opponentsPoints","opponentsGoalDifference","opponentsGoalsFor","compositeClubId"],"rankOutcomes":[{"from":1,"to":4,"kind":"quarterfinals","targetPhaseId":"quarterfinals"},{"from":5,"to":12,"kind":"knockouts","targetPhaseId":"playoffs"},{"from":13,"to":24,"kind":"eliminated"}]},{"id":"playoffs","type":"knockout","labelKey":"knockouts","calendarEvents":["I07","I08"],"ties":[{"id":"p512","participants":[{"phaseId":"league","rank":5},{"phaseId":"league","rank":12}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"},{"id":"p611","participants":[{"phaseId":"league","rank":6},{"phaseId":"league","rank":11}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"},{"id":"p710","participants":[{"phaseId":"league","rank":7},{"phaseId":"league","rank":10}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"},{"id":"p89","participants":[{"phaseId":"league","rank":8},{"phaseId":"league","rank":9}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"}]},{"id":"quarterfinals","type":"knockout","labelKey":"quarterfinals","calendarEvents":["I09","I10"],"ties":[{"id":"q1","participants":[{"phaseId":"league","rank":1},{"tieId":"p89"}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"},{"id":"q2","participants":[{"phaseId":"league","rank":4},{"tieId":"p512"}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"},{"id":"q3","participants":[{"phaseId":"league","rank":2},{"tieId":"p710"}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"},{"id":"q4","participants":[{"phaseId":"league","rank":3},{"tieId":"p611"}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"}]},{"id":"semifinals","type":"knockout","labelKey":"semifinals","calendarEvents":["I11","I12"],"ties":[{"id":"s1","participants":[{"tieId":"q1"},{"tieId":"q2"}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"},{"id":"s2","participants":[{"tieId":"q3"},{"tieId":"q4"}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"}]},{"id":"final","type":"knockout","labelKey":"final","calendarEvents":["SOVEREIGN-FINAL"],"ties":[{"id":"final","participants":[{"tieId":"s1"},{"tieId":"s2"}],"legs":1,"homePolicy":"neutral","resolution":"singleExtraTimePenalties","loserOutcome":"eliminated","winnerOutcome":"champion"}]}]},"federation-cup":{"schemaVersion":1,"version":"international-int24-v1","qualificationPolicyId":"int24ChampionAwareV1","awards":["champion","manager","player","young","boot","assists","glove","defender","midfielder","forward","xi"],"phases":[{"id":"league","type":"leaguePhase","labelKey":"league","calendarEvents":["I01","I02","I03","I04","I05","I06"],"rounds":6,"matchesPerClub":6,"homeMatchesPerClub":3,"awayMatchesPerClub":3,"drawPolicyId":"int24SixOpponentsV1","points":{"win":3,"draw":1,"loss":0},"tiebreakers":["points","goalDifference","goalsFor","wins","awayGoals","awayWins","opponentsPoints","opponentsGoalDifference","opponentsGoalsFor","compositeClubId"],"rankOutcomes":[{"from":1,"to":4,"kind":"quarterfinals","targetPhaseId":"quarterfinals"},{"from":5,"to":12,"kind":"knockouts","targetPhaseId":"playoffs"},{"from":13,"to":24,"kind":"eliminated"}]},{"id":"playoffs","type":"knockout","labelKey":"knockouts","calendarEvents":["I07","I08"],"ties":[{"id":"p512","participants":[{"phaseId":"league","rank":5},{"phaseId":"league","rank":12}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"},{"id":"p611","participants":[{"phaseId":"league","rank":6},{"phaseId":"league","rank":11}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"},{"id":"p710","participants":[{"phaseId":"league","rank":7},{"phaseId":"league","rank":10}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"},{"id":"p89","participants":[{"phaseId":"league","rank":8},{"phaseId":"league","rank":9}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"}]},{"id":"quarterfinals","type":"knockout","labelKey":"quarterfinals","calendarEvents":["I09","I10"],"ties":[{"id":"q1","participants":[{"phaseId":"league","rank":1},{"tieId":"p89"}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"},{"id":"q2","participants":[{"phaseId":"league","rank":4},{"tieId":"p512"}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"},{"id":"q3","participants":[{"phaseId":"league","rank":2},{"tieId":"p710"}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"},{"id":"q4","participants":[{"phaseId":"league","rank":3},{"tieId":"p611"}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"}]},{"id":"semifinals","type":"knockout","labelKey":"semifinals","calendarEvents":["I11","I12"],"ties":[{"id":"s1","participants":[{"tieId":"q1"},{"tieId":"q2"}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"},{"id":"s2","participants":[{"tieId":"q3"},{"tieId":"q4"}],"legs":2,"homePolicy":"higherOriginalTableRank","resolution":"aggregateExtraTimePenalties","loserOutcome":"eliminated"}]},{"id":"final","type":"knockout","labelKey":"final","calendarEvents":["FEDERATION-FINAL"],"ties":[{"id":"final","participants":[{"tieId":"s1"},{"tieId":"s2"}],"legs":1,"homePolicy":"neutral","resolution":"singleExtraTimePenalties","loserOutcome":"eliminated","winnerOutcome":"champion"}]}]}});
  const engine=()=>commonRules||root.faCompetitionRules;
  const baselineFor=definition=>definition?.category==='domestic'&&countries.includes(definition.countryId)&&tiers.includes(definition.tier)&&definition.id===definition.countryId+'-'+definition.tier&&definition.capacity===16
    ?baselineRules[definition.tier===1?'domestic-top-v1':'domestic-second-v1']
    :definition?.category==='international'&&definition.capacity===24?baselineRules[definition.id]||null:null;
  function legacyRecord(definition,record){
    if(definition.category!=='domestic')return false;
    if(record.formatId==='domestic-league-v1')return true;
    if(record.divisionId!==definition.id||!Array.isArray(record.rows)||record.rows.length!==16||!Array.isArray(record.fixtures))return false;
    const ids=record.rows.map(row=>row?.club?.clubId),first=firstClubId(definition.tier);
    return new Set(ids).size===16&&record.rows.every(row=>row?.club?.countryId===definition.countryId&&Number.isInteger(row.club.clubId)&&row.club.clubId>=first&&row.club.clubId<first+16)&&
      record.fixtures.every(game=>game&&validRound(game.round)&&ids.includes(game.homeId)&&ids.includes(game.awayId)&&game.homeId!==game.awayId);
  }
  function resolveSeasonRules(definition,record){
    try{
      const baseline=baselineFor(definition),season=record?.season??record?.seasonId;
      if(!baseline||!record||!Number.isSafeInteger(season)||season<1||record.divisionId!==undefined&&record.divisionId!==definition.id||record.competitionId!==undefined&&record.competitionId!==definition.id)return null;
      let selected;
      if(Object.hasOwn(record,'rulesSnapshot')){
        selected=record.rulesSnapshot;
        const json=(value,seen=new Set())=>{
          if(value===null||typeof value==='string'||typeof value==='boolean')return true;
          if(typeof value==='number')return Number.isFinite(value);
          if(typeof value!=='object'||seen.has(value))return false;
          seen.add(value);const valid=Object.entries(value).every(([key,item])=>!['__proto__','constructor','prototype'].includes(key)&&json(item,seen));seen.delete(value);return valid;
        };
        if(!selected||!json(selected)||record.rulesVersion!==undefined&&record.rulesVersion!==selected.version||![baseline.version,definition.rules.version].includes(selected.version))return null;
      }else{
        if(record.rulesVersion!==undefined&&record.rulesVersion!==baseline.version)return null;
        if(record.rulesVersion===undefined&&!legacyRecord(definition,record))return null;
        selected=baseline;
      }
      const api=engine();
      return api?.validateCompetition({...definition,rules:selected}).valid?freeze(JSON.parse(JSON.stringify(selected))):null;
    }catch{return null;}
  }
  function resolveSeasonDefinition(definition,record){
    const rules=resolveSeasonRules(definition,record);
    if(!rules)return null;
    try{return engine().normalizeCompetition({...definition,rules})}catch{return null;}
  }
  return freeze({countries,tiers,profile,schedule,views,divisionCount,participantCount,firstClubId,validRound,validManifest,competitionById,resolveSeasonRules,resolveSeasonDefinition});
});
