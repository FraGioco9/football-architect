// Domain logic: no DOM, browser storage or UI dependencies.
import {getLeagueClubs,leagueById} from '../leagues.js';
import {syntheticName} from '../names.js';
import {clamp} from './rules.js';
import {randomFactory,worldSeed} from './rng.js';
import {createFixtures} from './fixtures.js';
import {initializeCareerCalendar,todayISO,careerCampaignYear,careerPreseasonStart} from './career-date.js';
import {createPlayerIdentity,assignSquadNumbers,validatePlayerIdentity} from './player-identity.js';

export function makeWorld(seed=260126,countryId='IT'){
  const league=leagueById(countryId);
  const clubs=getLeagueClubs(league.id);
  const rand=randomFactory(worldSeed(seed,league.id));
  const referenceDate=careerPreseasonStart(league.id,careerCampaignYear(todayISO(),league.id));
  let nextId=1;
  const distribution=['POR','POR','TD','TD','DC','DC','DC','DC','TS','TS','MED','MED','CC','CC','CC','CC','COC','COC','AD','AD','AS','AS','ATT','ATT','ATT'];
  const players=[];
  const usedNames=new Set();
  for(const club of clubs){
    const roster=[];
    for(const position of distribution){
      const {name:fullname,firstName,lastName,nationality,nationalityCode}=syntheticName(rand,league.id,usedNames);
      const ovr=clamp(Math.round(club.reputation-8+(rand()-.5)*18+(position==='POR'?-1:0)),52,90);
      const age=18+Math.floor(rand()*16);
      const potential=clamp(ovr+Math.round(rand()*14-(age>29?4:0)),ovr,94);
      const value=Math.round((Math.pow(ovr-45,2)*6200)*(age>30?.7:age<23?1.25:1)*(.86+rand()*.28)/50000)*50000;
      rand(); // Preserve the legacy foot RNG draw; identity now owns preferred foot.
      const id=nextId++,globalId=`${league.id}:${id}`;
      const identity=createPlayerIdentity({
        seed,id,globalId,homeCountry:league.id,nationalityCode,firstName,lastName,displayName:fullname,
        age,referenceDate,position,originClubId:null
      });
      validatePlayerIdentity(identity,{referenceDate,expectedAge:age});
      roster.push({
        id,globalId,identity,name:identity.displayName,position,clubId:club.id,ovr,potential,age,nationality,
        foot:identity.preferredFoot==='left'?'Sinistro':'Destro',
        fitness:90+Math.round(rand()*10),morale:65+Math.round(rand()*25),form:clamp(Math.round(6.6+rand()*.8),5,10),
        value,wage:Math.round((2500+ovr*ovr*1.65+(rand()*3400))/100)*100,contract:1+Math.floor(rand()*4),
        injury:0,apps:0,goals:0,assists:0,yellow:0,cleanSheets:0,history:[]
      });
    }
    assignSquadNumbers(roster);
    players.push(...roster);
  }
  const teams=clubs.map(c=>({...c,balance:Math.round((13500000+(c.reputation-65)*1300000)/100000)*100000,transferBudget:Math.round((7000000+(c.reputation-65)*690000)/100000)*100000,history:[]}));
  const fixtures=createFixtures(clubs.map(c=>c.id));
  const world={version:1,seed,countryId:league.id,country:league.country.it,countryEn:league.country.en,countryFlag:league.flag,competition:league.competition,season:1,round:0,teams,players,fixtures,clubId:null,manager:'Allenatore',formation:'4-3-3',lineup:[],tactic:'Equilibrata',pressing:'Normale',tempo:'Normale',width:'Bilanciata',training:'Equilibrato',inbox:[],unread:0,watchlist:[],transfers:[],financeHistory:[],lastMatchId:null,startedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  return initializeCareerCalendar(world);
}
