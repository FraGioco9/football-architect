/** Read-only bridge between official save v1 and the additive modules.
 * A projection is NOT an authoritative upgrade of a player or save format.
 */
import {readPlayerAttributes} from './domain/player-generator.mjs';
import {ratePlayer,canonicalPosition} from './domain/player-ratings.mjs';
import {readMedical} from './domain/player-medical.mjs';
import {makeContract,makeTerms,contractTermSummary} from './domain/player-contract.mjs';
import {availableRoles,defaultRole,roleDetails} from './domain/player-roles.mjs';
import {assessRoleFit} from './domain/player-role-fit.mjs';

const originalRoles=Object.freeze({POR:'GK',DC:'CB',TD:'RB',TS:'LB',MED:'CDM',CC:'CM',COC:'CAM',AD:'RW',AS:'LW',ATT:'ST'});
export function toAddonPosition(original){
  return canonicalPosition(originalRoles[original]??original);
}
export function inspectCareerPlayer(player,world){
  if(!player||!world||!world.players?.some(p=>p.id===player.id)) throw Error('BRIDGE_UNKNOWN_PLAYER');
  const canonical=toAddonPosition(player.position);
  const normalized={...player,position:canonical};
  const options={seed:world.seed,countryId:world.countryId};
  const attributes=readPlayerAttributes(normalized,options);
  const rating=ratePlayer(normalized,attributes);
  const medical=readMedical(normalized,{day:world.round});
  const terms=makeTerms({startSeason:world.season,years:player.contract,annualWage:Math.round(player.wage*52),promisedRole:'rotation'});
  const contract=makeContract({playerId:player.id,clubId:player.clubId,terms});
  const recommended=availableRoles(canonical).map(role=>{
    const duty=role.id===defaultRole(canonical)?'support':'support';
    const fit=assessRoleFit(normalized,attributes,{position:canonical,role:role.id,duty});
    return {...fit,label:roleDetails(role.id,'it').label,labelEn:roleDetails(role.id,'en').label};
  }).sort((a,b)=>b.overall-a.overall||a.label.localeCompare(b.label));
  return {playerId:player.id,position:canonical,attributes,rating,medical,contract,remaining:contractTermSummary(contract,world.season),recommended,official:{ovr:player.ovr,fitness:player.fitness,injury:player.injury,weeklyWage:player.wage}};
}
export function currentSeasonStats(world){
  const games=world.fixtures.flatMap(r=>r.matches).filter(m=>m.result);
  const goals=games.reduce((n,m)=>n+m.result.homeGoals+m.result.awayGoals,0);
  const shots=games.reduce((n,m)=>n+m.result.shotsHome+m.result.shotsAway,0);
  const xg=games.reduce((n,m)=>n+m.result.xgHome+m.result.xgAway,0);
  return Object.freeze({games:games.length,goals,shots,xg:Math.round(xg*100)/100,round:world.round,season:world.season});
}
