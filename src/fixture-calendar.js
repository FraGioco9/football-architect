/**
 * CAL-02.1: deterministic home/away pairings only.
 * No kick-off dates, scores, standings, match engine or persistent data.
 */
import {COMPETITIONS,getCompetitionClubs} from './leagues.js';

const CLUB_COUNT=20;
const HALF_ROUNDS=CLUB_COUNT-1;

function seedFor(competitionId,seasonYear){
  // FNV-1a over an ASCII-only key; stable across browsers and Node.
  let hash=2166136261;
  for(const char of competitionId+':'+seasonYear){
    hash^=char.charCodeAt(0);
    hash=Math.imul(hash,16777619);
  }
  return hash>>>0 || 0x9e3779b9;
}

function permute(clubIds,competitionId,seasonYear){
  const ids=[...clubIds].sort((a,b)=>a-b);
  let seed=seedFor(competitionId,seasonYear);
  const next=()=>{
    seed^=seed<<13;
    seed^=seed>>>17;
    seed^=seed<<5;
    return seed>>>0;
  };
  for(let i=ids.length-1;i>0;i--){
    const j=next()%(i+1);
    [ids[i],ids[j]]=[ids[j],ids[i]];
  }
  return ids;
}

function validateInputs({competitionId,seasonYear,clubIds}){
  if(typeof competitionId!=='string'||!/^[A-Z][A-Z0-9_-]{0,63}$/.test(competitionId))throw new Error('Invalid competition');
  if(!Number.isSafeInteger(seasonYear)||seasonYear<1900||seasonYear>9000)throw new Error('Invalid season year');
  if(!Array.isArray(clubIds)||clubIds.length!==CLUB_COUNT||
     clubIds.some(id=>!Number.isSafeInteger(id)||id<1)||
     new Set(clubIds).size!==CLUB_COUNT)throw new Error('A division requires 20 distinct club IDs');
}

/**
 * Return 38 matchdays, each containing ten fixtures.
 * The second leg keeps matchday order and reverses the venue of each pairing.
 * Date/time allocation and rest constraints belong to CAL-02.2.
 */
export function generateFixtureCalendar({competitionId,seasonYear,clubIds}={}){
  validateInputs({competitionId,seasonYear,clubIds});
  const ring=permute(clubIds,competitionId,seasonYear);
  const firstLeg=[];
  for(let round=0;round<HALF_ROUNDS;round++){
    const fixtures=[];
    for(let i=0;i<CLUB_COUNT/2;i++){
      const left=ring[i],right=ring[CLUB_COUNT-1-i];
      const homeLeft=i===0?round%2===0:(round+i)%2===0;
      fixtures.push(Object.freeze({
        homeClubId:homeLeft?left:right,
        awayClubId:homeLeft?right:left
      }));
    }
    firstLeg.push(fixtures);
    ring.splice(1,0,ring.pop());
  }

  const matchdays=Array.from({length:HALF_ROUNDS*2},(_,index)=>{
    const number=index+1;
    const returnLeg=index>=HALF_ROUNDS;
    const fixtures=firstLeg[index%HALF_ROUNDS].map(pair=>{
      const homeClubId=returnLeg?pair.awayClubId:pair.homeClubId;
      const awayClubId=returnLeg?pair.homeClubId:pair.awayClubId;
      return Object.freeze({
        id:`${competitionId}:${seasonYear}:${number}:${homeClubId}-${awayClubId}`,
        competitionId,seasonYear,matchday:number,homeClubId,awayClubId
      });
    });
    return Object.freeze({number,fixtures:Object.freeze(fixtures)});
  });
  return Object.freeze({competitionId,seasonYear,matchdays:Object.freeze(matchda/** Enumerated competition IDs (IT-1, ENG-1, etc.) come from the DIV-02 catalog. */
export function generateCompetitionFixtures(competitionId,seasonYear){
  if(!COMPETITIONS.some(competition=>competition.id===competitionId))throw new Error('Unknown competition');
  return generateFixtureCalendar({
    competitionId,seasonYear,
    clubIds:getCompetitionClubs(competitionId).map(club=>club.id)
  });
}
