// I03 prepare one coherent rendering model; no DOM side effects.
// Consumers must commit standings, fixtures and postseason together.
import {prepareProtectedPostseason} from "./protected-domestic-postseason.mjs";
const fail=message=>{throw new Error("Protected domestic view: "+message)};
export function createProtectedDomesticPresentation(payload){
 if(payload?.clubs?.length!==16||payload?.standings?.length!==16||payload?.fixtures?.length!==240)fail("wrong dimensions");
 const byId=new Map(payload.clubs.map(c=>[c.canonicalId,c]));
 if(byId.size!==16||[...byId].some(([id,club])=>id!==club.countryId+"-"+club.clubId))fail("club registry mismatch");
 const standings=payload.standings.map((row,position)=>{
  const club=byId.get(row.clubId);
  if(!club)fail("ranking references unknown club");
  return {position:position+1,club:{...club},played:row.played,
   won:row.won??row.wins??0,drawn:row.drawn??0,lost:row.lost??0,
   gf:row.gf??row.goalsFor??0,ga:row.ga??row.goalsAgainst??0,
   gd:row.gd??row.goalDifference??0,pts:row.pts??row.points??0};
 });
 const fixtures=payload.fixtures.map(game=>{
  if(!byId.has(game.homeId)||!byId.has(game.awayId)||game.homeId===game.awayId)fail("fixture identity mismatch");
  return {...game,home:{...byId.get(game.homeId)},away:{...byId.get(game.awayId)}};
 });
 const gamesPlayed=fixtures.filter(g=>g.homeGoals!==null&&g.awayGoals!==null).length;
 if(standings.reduce((n,row)=>n+row.played,0)!==gamesPlayed*2)fail("played totals disagree");
 const postseason=prepareProtectedPostseason(payload.postseason,{tier:payload.postseason.length===2?1:2,day:payload.worldDay,participants:payload.participants});
 return Object.freeze({season:payload.season,participants:payload.participants.slice(),standings,fixtures,postseason,
   status:payload.status,gameCount:gamesPlayed});
}
