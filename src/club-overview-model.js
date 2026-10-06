/** UX2-03: read-only selectors for the currently managed club.
 * Never seed trophies, reconstruct matches, persist UI state or reveal scouts.
 */
import {table} from './domain/standings.js';
import {clubPlayers} from './domain/selectors.js';
import {facilityEnabled} from './domain/career-facilities.js';
import {boardEnabled} from './domain/career-board.js';
import {financeEnabled} from './domain/career-finance.js';
import {officialClubHistory,officialHonours,officialRivalries,officialClubNarrative} from './domain/career-history.js';
import {cupHonours} from './domain/career-cups.js';
import {continentalHonours} from './domain/career-continental.js';

const validNumber=v=>Number.isFinite(v)?v:null;
export function clubOverview(w){
  const club=w?.teams?.find(team=>team.id===w.clubId);
  if(!club)return null;
  const rows=table(w),index=rows.findIndex(r=>r.id===w.clubId),row=index<0?null:rows[index];
  const players=clubPlayers(w,w.clubId);
  // Records exist only after completed seasons in the official WRD05 archive.
  const seasons=officialClubHistory(w,w.countryId,w.clubId).slice().sort((a,b)=>b.season-a.season);
  const leagueHonours=officialHonours(w,w.countryId,w.clubId);
  const nationalHonours=cupHonours(w,w.countryId).filter(r=>r.championId===w.clubId);
  const continental=continentalHonours(w).filter(r=>r.championKey===`${w.countryId}:${w.clubId}`);
  const opponents=new Map(w.teams.map(t=>[t.id,t]));
  const rivals=officialRivalries(w,w.countryId,{limit:40}).filter(r=>r.a===w.clubId||r.b===w.clubId).slice(0,4).map(r=>({
    name:opponents.get(r.a===w.clubId?r.b:r.a)?.name??null,kind:r.kind,meetings:r.meetings,
    wins:r.a===w.clubId?r.winsA:r.winsB,draws:r.draws,losses:r.a===w.clubId?r.winsB:r.winsA
  })).filter(r=>r.name);
  const facilities=facilityEnabled(w)?w.advancedV1.facilitiesV1:null;
  const board=boardEnabled(w)?w.advancedV1.boardV1:null;
  const finance=financeEnabled(w)?w.advancedV1.financeV1:null;
  const managedTier=w.advancedV1?.divisionsV1?.managedTier??1;
  return {
    club,season:w.season,round:w.round,totalRounds:w.fixtures?.length??0,competition:w.competition,
    country:w.country,countryEn:w.countryEn,flag:w.countryFlag,tier:managedTier,
    manager:w.manager,position:index<0?null:index+1,table:row,
    squadSize:players.length,averageOverall:players.length?Math.round(players.reduce((sum,p)=>sum+p.ovr,0)/players.length):null,
    history:seasons,leagueHonours,nationalHonours,continentalHonours:continental,rivals,
    narrative:officialClubNarrative(w,w.countryId,w.clubId,'it'),
    narrativeEn:officialClubNarrative(w,w.countryId,w.clubId,'en'),
    facilities:facilities?{
      buildings:Object.fromEntries(Object.entries(facilities.buildings??{}).map(([type,v])=>[type,v.level])),
      staffCount:Object.keys(facilities.staff??{}).length,
      underway:(facilities.projects??[]).filter(p=>p.status==='building').length
    }:null,
    board:board?{status:board.status,trust:validNumber(board.trust),fans:validNumber(board.fans),plan:board.plan,leagueTarget:board.targets?.leaguePosition??null}:null,
    finance:finance?{cashEUR:validNumber(finance.cashEUR),debtEUR:validNumber(finance.debtEUR),budgetEUR:validNumber(club.transferBudget)}:null,
    balances:{cash:validNumber(club.balance),budget:validNumber(club.transferBudget)},
    // Live catalog identity: avoid inventing unavailable stadium expansions or past trophies.
  };
}
