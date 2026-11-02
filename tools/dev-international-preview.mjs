/* DEV-only INT-24 simulation. Shared competition context remains the sole UI writer. */
import {createPreviewStandings,competitionModel} from './dev-standings-preview-data.mjs';
import {DAY_KEY} from './dev-world-clock.mjs';
const ROUND_DAYS=[16,19,22,25,28,31];
const COUNTRY_IDS=['IT','ENG','ES','DE','FR','PT','NL','BR'];
const key=club=>club.countryId+'-'+club.clubId;
const score=(season,round,home,away)=>{
 let h=2166136261;for(const ch of season+':'+round+':'+home+':'+away){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}
 return [h%4,Math.floor(h/13)%4];
};
export function buildCupPreview(manifest,definition,season,day){
 if(!competitionModel.validManifest(manifest)||definition?.category!=='international'||!['int-1','int-2'].includes(definition.id)||!Number.isInteger(season)||season<1||season>5||!Number.isInteger(day)||day<1||day>56)throw Error('Invalid international DEV request');
 const positions=definition.id==='int-1'?[0,1,2]:[3,4,5];
 const byCountry=COUNTRY_IDS.map(countryId=>{
  const division=manifest.divisions.find(d=>d.id===countryId+'-1');
  if(!division)throw Error('Incomplete international DEV catalogue');
  const complete=createPreviewStandings(division,30,Math.max(1,season-1));
  return positions.map(index=>complete.rows[index].club);
 });
 const participants=byCountry.flat();
 if(participants.length!==24||new Set(participants.map(key)).size!==24)throw Error('Invalid international DEV participants');
 const full=[];
 // XOR one-factorization of K8. Six non-opposite opponents, no same-country games.
 for(const mask of [1,2,3,5,6,7]){
  const round=[1,2,3,5,6,7].indexOf(mask)+1;
  for(let i=0;i<8;i++)for(let j=i+1;j<8;j++){
   if((i^j)!==mask)continue;
   const host=(j-i+8)%8<=3?i:j,visitor=host===i?j:i;
   for(let slot=0;slot<3;slot++){
    const home=byCountry[host][slot],away=byCountry[visitor][slot];
    const [hg,ag]=score(season,round,key(home),key(away));
    full.push({phaseId:'league',round,homeId:key(home),awayId:key(away),homeGoals:day>=ROUND_DAYS[round-1]?hg:null,awayGoals:day>=ROUND_DAYS[round-1]?ag:null,kickoff:null});
   }
  }
 }
 if(full.length!==72)throw Error('Incomplete international DEV schedule');
 const map=new Map(participants.map(club=>[key(club),{club,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,gd:0,pts:0,recent:[]}]));
 for(const game of full.filter(g=>g.homeGoals!==null)){
  const h=map.get(game.homeId),a=map.get(game.awayId);h.played++;a.played++;
  h.gf+=game.homeGoals;h.ga+=game.awayGoals;a.gf+=game.awayGoals;a.ga+=game.homeGoals;
  if(game.homeGoals>game.awayGoals){h.won++;a.lost++;h.pts+=3;}
  else if(game.homeGoals<game.awayGoals){a.won++;h.lost++;a.pts+=3;}
  else {h.drawn++;a.drawn++;h.pts++;a.pts++;}
  h.recent.unshift(game);a.recent.unshift(game);
 }
 const standings=[...map.values()].map(row=>({...row,gd:row.gf-row.ga,recent:row.recent.slice(0,5)}))
  .sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||b.won-a.won||key(a.club).localeCompare(key(b.club)));
 const completedTies=[];
 const knockoutDays={I07:36,I08:38,I09:41,I10:43,I11:46,I12:48,'FEDERATION-FINAL':53,'SOVEREIGN-FINAL':54};
 const rank=new Map(standings.map((row,index)=>[key(row.club),index]));
 const resolved=new Map();
 if(day>=ROUND_DAYS[5])for(const phase of definition.rules.phases.filter(p=>p.type==='knockout')){
  for(const tie of phase.ties){
   const pair=tie.participants.map(ref=>ref.tieId?resolved.get(ref.tieId)?.winner||null:standings[ref.rank-1]?.club||null);
   if(pair.some(club=>!club))continue;
   const ordered=tie.homePolicy==='neutral'?[...pair]:[...pair].sort((a,b)=>rank.get(key(b))-rank.get(key(a)));
   const legs=[];
   let winner=null;
   for(let leg=0;leg<tie.legs;leg++){
    const scheduledDay=knockoutDays[phase.calendarEvents[leg]];
    if(day<scheduledDay)break;
    const [home,away]=leg===1?[ordered[1],ordered[0]]:ordered;
    const [hg,ag]=score(season,phase.id+':'+tie.id+':'+leg,key(home),key(away));
    legs.push({phaseId:phase.id,tieId:tie.id,leg:leg+1,homeId:key(home),awayId:key(away),homeGoals:hg,awayGoals:ag,kickoff:null});
   }
   if(legs.length===tie.legs){
    const goals=club=>legs.reduce((n,g)=>n+(g.homeId===key(club)?g.homeGoals:g.awayGoals),0);
    const a=goals(pair[0]),b=goals(pair[1]);
    winner=a===b?[...pair].sort((a,b)=>rank.get(key(a))-rank.get(key(b)))[0]:a>b?pair[0]:pair[1];
   }
   resolved.set(tie.id,{winner});
   if(legs.length)completedTies.push({id:tie.id,legs,winnerId:winner?key(winner):null});
  }
 }
 return {season,rulesVersion:definition.rules.version,rulesSnapshot:definition.rules,participants,fixtures:full,
  results:[...full.filter(g=>g.homeGoals!==null),...completedTies],statistics:{standings},status:'partial'};
}
export function mountCupDebugPreview({getContext,commit,enabled,readSeason,readDay}){
 let epoch=0;
 async function refresh(){
  const ticket=++epoch;
  if(!enabled())return false;
  const context=getContext(),definition=context?.definition;
  if(definition?.category!=='international'||!context?.revision)return false;
  const season=Number(context.selectedSeason),day=readDay();
  try{
   const response=await fetch('/competitions/_shared/manifest.json',{cache:'no-store',credentials:'same-origin'});
   if(!response.ok)throw Error('International DEV manifest unavailable');
   const manifest=await response.json();
   const snapshot=buildCupPreview(manifest,definition,season,day);
   if(ticket!==epoch||!enabled()||readDay()!==day||readSeason()===0||getContext()?.revision!==context.revision)return false;
   return commit(snapshot,context.revision);
  }catch(error){console.error('International DEV preview rejected:',error);return false;}
 }
 return Object.freeze({refresh,invalidate(){epoch++;}});
}
