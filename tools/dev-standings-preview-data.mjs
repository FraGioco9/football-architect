// Deterministic fictional league fixtures for isolated local DEV preview only.
// This module is NOT on the publication-guard allowlist. Never use as sports data.
import "../assets/competition-model.js";
import "../assets/world-calendar-model.js";
import "../assets/competition-rules.js";
import domesticDefinitions from "../data/divisions.json" with {type:'json'};
const configuredRules=globalThis.faCompetitionRules;
const previewDefinition=division=>configuredRules.normalizeCompetition({...domesticDefinitions.find(d=>d.id===division.id),...(division.rules?{rules:division.rules}:{}),capacity:division.capacity});
export const competitionModel=globalThis.faCompetitionModel;
const {capacity}=competitionModel.profile;
const {rounds,roundsPerLeg,matchesPerRound,matches,pairings:pairingCount}=competitionModel.schedule;
// Fictional scoring only. Official rules remain undefined in the shared profile.
export const PREVIEW_RULES=Object.freeze({win:3,draw:1,loss:0});
export const comparePreviewRows=(a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.club.clubId-b.club.clubId;
export const PREVIEW_SCHEMA_VERSION = 1;
export const DEBUG_MAX_MATCHDAY = competitionModel.schedule.rounds + 3;
const DIVISION_ID = /^(IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$/;

function assertDivision(division) {
  if (!division || !DIVISION_ID.test(division.id) ||
      !Array.isArray(division.clubs) || division.clubs.length !== capacity || division.capacity !== capacity ||
      ![1,2].includes(division.tier) || division.id !== division.countryId + "-" + division.tier) {
    throw Error("Invalid DEV division");
  }
  const ids = new Set();
  const start = competitionModel.firstClubId(division.tier);
  for (const club of division.clubs) {
    if (!Number.isInteger(club.clubId) || club.clubId !== start + ids.size ||
        club.countryId !== division.countryId ||
        typeof club.primaryName !== "string" || !club.primaryName.trim() ||
        ids.has(club.clubId)) throw Error("Invalid or repeated DEV club identity");
    ids.add(club.clubId);
  }
}

function randomSource(key) {
  let state = 2166136261;
  for (const letter of key) {
    state ^= letter.codePointAt(0);
    state = Math.imul(state, 16777619) >>> 0;
  }
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPreviewStandings(division, matchdays = 15, season = 1) {
  if (!Number.isInteger(season) || season < 1 || season > 4) throw Error("Invalid DEV season");
  assertDivision(division);
  const definition=previewDefinition(division),phase=definition.rules.phases.find(p=>p.type==='roundRobin');
  const {rounds,matchesPerRound,matches}=definition.metrics.phases[phase.id];
  const capacity=definition.capacity,roundsPerLeg=capacity-1,pairingCount=capacity*(capacity-1)/2;
  if (!Number.isInteger(matchdays) || matchdays < 0 || matchdays > rounds) throw Error("Invalid DEV matchday count");
  const clubs = [...division.clubs].sort((a, b) => a.clubId - b.clubId);
  const random = randomSource("FA-STANDINGS-DEV-v" + PREVIEW_SCHEMA_VERSION + ":" +
    division.id + (season === 1 ? ":" : ":season-" + season + ":") + clubs.map(c => c.clubId).join(","));
  const rotation = clubs.map(c => c.clubId);
  const fixtures = [];
  const byId = new Map(clubs.map(club => [club.clubId, {
    club, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0,
    gd: 0, pts: 0, recent: []
  }]));
  const pairings = new Set();

  for (let round = 1; round <= roundsPerLeg; round++) {
    for (let index = 0; index < matchesPerRound; index++) {
      const a = rotation[index], b = rotation[capacity-1-index];
      const homeId = (round + index) % 2 === 0 ? a : b;
      const awayId = homeId === a ? b : a;
      const pair = [a, b].sort((x, y) => x - y).join(":");
      if (a === b || pairings.has(pair)) throw Error("Invalid DEV schedule pairing");
      pairings.add(pair);
      const homeGoals = Math.floor(random() * 5);
      const awayGoals = Math.floor(random() * 5);
      const fixture = { round, homeId, awayId, homeGoals, awayGoals };
      fixtures.push(fixture);
      fixtures.push({round:round+roundsPerLeg,homeId:awayId,awayId:homeId,
        homeGoals:Math.floor(random()*5),awayGoals:Math.floor(random()*5)});
    }
    rotation.splice(1, 0, rotation.pop());
  }
  for (const fixture of fixtures.filter(game=>game.round<=matchdays)) {
      const {homeId,awayId,homeGoals,awayGoals}=fixture;
      const h = byId.get(homeId), v = byId.get(awayId);
      h.played++; v.played++;
      h.gf += homeGoals; h.ga += awayGoals;
      v.gf += awayGoals; v.ga += homeGoals;
      const homeForm = homeGoals > awayGoals ? "W" : homeGoals < awayGoals ? "L" : "D";
      const awayForm = homeForm === "W" ? "L" : homeForm === "L" ? "W" : "D";
      if (homeForm === "W") { h.won++; v.lost++; }
      else if (homeForm === "L") { v.won++; h.lost++; }
      else { h.drawn++; v.drawn++; }
      h.recent.push({ ...fixture, result: homeForm, isHome: true });
      v.recent.push({ ...fixture, result: awayForm, isHome: false });
  }
  const rows = [...byId.values()].map(row => {
    row.gd = row.gf - row.ga;
    row.pts = phase.points.win*row.won+phase.points.draw*row.drawn+phase.points.loss*row.lost;
    row.recent = row.recent.slice(-5).reverse();
    if (row.played !== matchdays || row.won + row.drawn + row.lost !== matchdays ||
        row.recent.length !== Math.min(5,matchdays)) throw Error("Incomplete DEV club results");
    return row;
  }).sort(comparePreviewRows);
  if (fixtures.length !== matches || pairings.size !== pairingCount || rows.length !== capacity ||
      rows.reduce((n, x) => n + x.gf, 0) !== rows.reduce((n, x) => n + x.ga, 0) ||
      rows.reduce((n, x) => n + x.won, 0) !== rows.reduce((n, x) => n + x.lost, 0)) {
    throw Error("Unbalanced DEV fixture model");
  }
  return { divisionId: division.id, season, rows, fixtures:fixtures.filter(game=>game.round<=matchdays), clubs };
}

// The selected season/day is a progress boundary, never a catalogue of future results.
export function createPreviewHistory(division, season, matchdays) {
  const leagueDays=previewSeasonMatchdays(season,{season,matchdays});
  const current=createPreviewStandings(division,leagueDays,season);
  const completed=[];
  for(let previous=1;previous<season;previous++)
    completed.push(createPreviewStandings(division,rounds,previous));
  const played=[...completed];
  if(matchdays>0)played.push(current);
  if(leagueDays===rounds)completed.push(current);
  return {completed,played};
}

export function readPreviewProgress(storage) {
  const read=(key,min,max,fallback)=>{
    try{const raw=storage.getItem(key),value=raw===null||raw.trim()===""?NaN:Number(raw);
      return Number.isInteger(value)&&value>=min&&value<=max?value:fallback;
    }catch{return fallback}
  };
  const season=read("football-architect:standings-dev-season",0,4,1);
  return {season,matchdays:season===0?0:read("football-architect:standings-dev-matchdays",0,DEBUG_MAX_MATCHDAY,0)};
}
// A completed or not-yet-reached season has no upcoming matchday shortcut.
// The league calendar still ends at 30; days 31–33 belong only to post-season brackets.
export function previewCurrentMatchday(season,progress) {
  const played=previewSeasonMatchdays(season,progress);
  return season>progress.season || played===rounds ? null : played+1;
}

export function previewSeasonProgress(season,progress) {
  if(!Number.isInteger(season)||season<1||season>4||
    !Number.isInteger(progress?.season)||progress.season<0||progress.season>4||
    !Number.isInteger(progress.matchdays)||progress.matchdays<0||progress.matchdays>DEBUG_MAX_MATCHDAY)
    throw Error("Invalid DEV progress");
  return season<progress.season?DEBUG_MAX_MATCHDAY:season===progress.season?progress.matchdays:0;
}


// Keep league tables, fixture navigation and statistics bounded independently of Debug progress.
export function previewSeasonMatchdays(season,progress) {
  return Math.min(rounds,previewSeasonProgress(season,progress));
}

// Fictional post-season results are private, deterministic and revealed only at their played stage.
export function createPreviewPostseason(division,matchday,season=1) {
  assertDivision(division);
  const definition=previewDefinition(division),phase=definition.rules.phases.find(p=>p.type==='knockout');
  previewSeasonProgress(season,{season,matchdays:matchday});
  const result={divisionId:division.id,season,matchday,ties:[],final:null,winnerId:null};
  if(matchday<rounds)return result;
  const rows=createPreviewStandings(division,rounds,season).rows;
  const clubAt=position=>rows[position-1].club.clubId;
  const random=id=>randomSource("FA-POSTSEASON-DEV-v1:"+division.id+":"+season+":"+id);
  const game=(homeId,awayId,rng)=>({homeId,awayId,homeGoals:Math.floor(rng()*5),awayGoals:Math.floor(rng()*5),afterExtraTime:false,penalties:null});
  function resolve(game,rng,homeBase=0,awayBase=0) {
    if(homeBase+game.homeGoals!==awayBase+game.awayGoals)return;
    game.afterExtraTime=true;
    game.homeGoals+=Math.floor(rng()*2);game.awayGoals+=Math.floor(rng()*2);
    if(homeBase+game.homeGoals===awayBase+game.awayGoals){
      const homeWins=rng()<.5,winnerGoals=3+Math.floor(rng()*3);
      game.penalties={homeId:game.homeId,awayId:game.awayId,
        homeGoals:homeWins?winnerGoals:winnerGoals-1,awayGoals:homeWins?winnerGoals-1:winnerGoals};
    }
  }
  function tie(id,betterPosition,lowerPosition) {
    const better=clubAt(betterPosition),lower=clubAt(lowerPosition),rng=random(id);
    const first=game(lower,better,rng),second=game(better,lower,rng);
    resolve(second,rng,first.awayGoals,first.homeGoals);
    const aggregate=[first.awayGoals+second.homeGoals,first.homeGoals+second.awayGoals];
    const winner=aggregate[0]!==aggregate[1]?(aggregate[0]>aggregate[1]?better:lower):
      second.penalties.homeGoals>second.penalties.awayGoals?better:lower;
    return {id,seedPositions:[betterPosition,lowerPosition],clubIds:[better,lower],
      legs:[matchday>=31?first:null,matchday>=32?second:null],
      aggregate:matchday>=32?aggregate:matchday>=31?[first.awayGoals,first.homeGoals]:null,
      winnerId:matchday>=32?winner:null};
  }
  const legacyTieId=id=>({semi36:'semi-one',semi45:'semi-two'}[id]||id);
  result.ties=phase.ties.filter(t=>t.participants.every(ref=>ref.rank)).map(t=>{
    const homeFirst=configuredRules.homeOrder(definition,t.id,configuredRules.tieParticipants(definition,t.id,rows,[]),rows);
    const positions=[...homeFirst].reverse().map(club=>rows.findIndex(row=>row.club.clubId===club.clubId)+1);
    return tie(legacyTieId(t.id),...positions);
  });
  const finalConfig=phase.ties.find(t=>t.legs===1);
  if(!finalConfig){
    result.winnerId=result.ties[0].winnerId;
    return result;
  }
  if(matchday>=32){
    const completed=result.ties.map(t=>({...t,id:phase.ties.find(config=>legacyTieId(config.id)===t.id).id}));
    const finalists=configuredRules.homeOrder(definition,finalConfig.id,configuredRules.tieParticipants(definition,finalConfig.id,rows,completed),rows).map(club=>club.clubId);
    const rng=random("final"),final=game(finalists[0],finalists[1],rng);
    resolve(final,rng);
    const winner=final.homeGoals!==final.awayGoals?(final.homeGoals>final.awayGoals?final.homeId:final.awayId):
      final.penalties.homeGoals>final.penalties.awayGoals?final.homeId:final.awayId;
    result.final=matchday>=33?{...final,winnerId:winner}:{homeId:final.homeId,awayId:final.awayId,homeGoals:null,awayGoals:null,afterExtraTime:false,penalties:null,winnerId:null};
    result.winnerId=result.final.winnerId;
  }
  return result;
}

// Read-only club projection: reuse league/post-season engines and expose no future scores.
export function createPreviewClubSummary(division,clubId,progress){
 if(progress?.season===0)return null;
 const played=previewSeasonMatchdays(progress.season,progress);
 const table=createPreviewStandings(division,played,progress.season);
 const position=table.rows.findIndex(row=>row.club.clubId===clubId);
 if(position<0)throw Error("Unknown DEV club");
 let nextMatch=null;
 if(progress.matchdays<30){
  const fixture=createPreviewStandings(division,30,progress.season).fixtures.find(game=>
   game.round===played+1&&(game.homeId===clubId||game.awayId===clubId));
  if(fixture)nextMatch={round:fixture.round,homeId:fixture.homeId,awayId:fixture.awayId};
 }else{
  const bracket=createPreviewPostseason(division,progress.matchdays,progress.season);
  if(progress.matchdays<32){
   const tie=bracket.ties.find(tie=>tie.clubIds.includes(clubId));
   if(tie){const [better,lower]=tie.clubIds;nextMatch={round:progress.matchdays+1,
    homeId:progress.matchdays===30?lower:better,awayId:progress.matchdays===30?better:lower};}
  }else if(progress.matchdays===32&&bracket.final&&[bracket.final.homeId,bracket.final.awayId].includes(clubId))
   nextMatch={round:33,homeId:bracket.final.homeId,awayId:bracket.final.awayId};
 }
 return {source:'dev',divisionId:division.id,clubId,season:progress.season,
  position:played===0?null:position+1,points:table.rows[position].pts,nextMatch};
}
export function readPreviewClubProgress(storage){
 const progress=readPreviewProgress(storage);
 if(progress.season===0)return progress;
 try{
  const day=Number(storage.getItem('football-architect:calendar-dev-world-day'));
  if(Number.isInteger(day)&&day>=1&&day<=56)
   progress.matchdays=globalThis.faWorldCalendarModel.createSeason(progress.season).days
    .filter(item=>item.day<=day&&item.events.some(event=>event.family==='national')).length;
 }catch{}
 return progress;
}
