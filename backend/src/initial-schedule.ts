/** Real Season1 initial fixtures. No DEV imports, results or future qualifiers. */
import {canonicalHash,requireApprovedSnapshot,type ApprovedSnapshot} from './catalogue-snapshot.ts';
import {buildSeasonCalendarEvidence} from './season-calendar-evidence.ts';
import {ApiError} from './errors.ts';
import {qualificationPots} from './season-qualification-pots.ts';
import type {Database} from './database.ts';
import {loadApprovedSnapshot} from './approved-season-one.ts';
import {readSeasonTwoCandidate} from './season-two-candidate-read.ts';
export interface Fixture {id:string;competitionId:string;marker:string;day:number;round:number;homeClubId:string;awayClubId:string}
export interface InitialSchedule {
 schemaVersion:1;season:number;scope:'initial-leagues';algorithmVersion:'initial-leagues-v1';seed:string;
 participantsHash:string;rulesHash:string;calendarHash:string;fixtures:Fixture[];
 pendingPhases:{competitionId:string;reason:'sporting-results-required'}[];
}
const fail=():never=>{throw new ApiError(422,'schedule_invalid')};
const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
/** SHA-256 counter stream: runtime-independent seed mixing and unbiased Fisher-Yates. */
async function shuffle<T>(input:readonly T[],seed:string):Promise<T[]>{
 const result=[...input];let counter=0;
 for(let i=result.length-1;i>0;i--){
  const range=i+1,limit=Math.floor(0x100000000/range)*range;let n:number;
  do{n=parseInt((await canonicalHash({seed,counter:counter++})).slice(0,8),16)}while(n>=limit);
  const j=n%range;[result[i],result[j]]=[result[j],result[i]];
 }return result;
}
type SchedulingSnapshot=Pick<ApprovedSnapshot,'participantsHash'|'rulesHash'|'bindings'>;
async function generate(trusted:SchedulingSnapshot,seed:string,season:number):Promise<InitialSchedule>{
 if(typeof seed!=='string'||!/^[A-Za-z0-9._:-]{16,256}$/.test(seed))return fail();
 const calendar=await buildSeasonCalendarEvidence(season);
 const days=JSON.parse(calendar.calendarJson).days as {day:number;events:{marker:string}[]}[];
 const dayFor=new Map(days.flatMap(d=>d.events.map(e=>[e.marker,d.day] as const)));
 const fixtures:Fixture[]=[];
 const add=(competitionId:string,round:number,homeClubId:string,awayClubId:string,cup=false)=>{
  const marker=(cup?'I':'N')+String(round).padStart(2,'0'),day=dayFor.get(marker);if(!day)return fail();
  fixtures.push({id:`season:${season}:${competitionId}:${marker}:${homeClubId}:${awayClubId}`,competitionId,marker,day,round,homeClubId,awayClubId});
 };
 for(const binding of trusted.bindings){
  const id=binding.competitionId;
  if(!id.startsWith('int-')){
   const ring=await shuffle(binding.clubIds,seed+':'+id);
   for(let r=0;r<15;r++){
    for(let i=0;i<8;i++){
     const [home,away]=(r+i)%2===0?[ring[i],ring[15-i]]:[ring[15-i],ring[i]];
     add(id,r+1,home,away);add(id,r+16,away,home);
    }
    ring.splice(1,0,ring.pop()!);
   }
  }else{
   // Approved constructive fallback: one common seeded country cycle across all pots.
   // Alternating cycle edges split each pot into two perfect matchings. Every
   // cross-pot direction is a perfect matching at offset +1; reverse opponents
   // have offset -1, so no country match or repeated opponent is possible (n=8).
   const order=await shuffle(countries,seed+':'+id);
   // Pot positions are league-derived qualification order, not fixed club IDs.
   // Season 1 retains the identical selection; later seasons can promote new clubs.
   const pots=qualificationPots(binding.clubIds,order);
   const rounds=await shuffle([0,1,2,3,4,5],seed+':rounds:'+id);
   const layouts=[[0,1,2],[0,2,1],[1,2,0],[1,0,2],[2,0,1],[2,1,0]];
   for(let r=0;r<6;r++){
    const [intra,homePot,awayPot]=layouts[r],round=rounds[r]+1;
    for(let i=r%2;i<8;i+=2)add(id,round,pots[intra][i],pots[intra][(i+1)%8],true);
    for(let i=0;i<8;i++)add(id,round,pots[homePot][i],pots[awayPot][(i+1)%8],true);
   }
  }
 }
 fixtures.sort((a,b)=>a.day-b.day||a.marker.localeCompare(b.marker,'en')||a.competitionId.localeCompare(b.competitionId,'en')||a.id.localeCompare(b.id,'en'));
 return {schemaVersion:1,season,scope:'initial-leagues',algorithmVersion:'initial-leagues-v1',seed,
  participantsHash:trusted.participantsHash,rulesHash:trusted.rulesHash,calendarHash:calendar.calendarHash,fixtures,
  pendingPhases:trusted.bindings.map(b=>({competitionId:b.competitionId,reason:'sporting-results-required'}))};
}
/** Structural validation is independent of the generation traversal. */
function checkInvariants(schedule:InitialSchedule,snapshot:SchedulingSnapshot):void{
 if(schedule.fixtures.length!==3984||new Set(schedule.fixtures.map(g=>g.id)).size!==3984)return fail();
 for(const binding of snapshot.bindings){
  const cup=binding.competitionId.startsWith('int-'),games=schedule.fixtures.filter(g=>g.competitionId===binding.competitionId);
  if(games.length!==(cup?72:240))return fail();
  for(let r=1;r<=(cup?6:30);r++){
   const round=games.filter(g=>g.round===r),ids=round.flatMap(g=>[g.homeClubId,g.awayClubId]);
   if(round.length!==(cup?12:8)||new Set(ids).size!==binding.clubIds.length||ids.some(id=>!binding.clubIds.includes(id)))return fail();
  }
  for(const club of binding.clubIds){
   const home=games.filter(g=>g.homeClubId===club),away=games.filter(g=>g.awayClubId===club);
   const opponents=[...home.map(g=>g.awayClubId),...away.map(g=>g.homeClubId)];
   if(home.length!==(cup?3:15)||away.length!==(cup?3:15)||new Set(opponents).size!==(cup?6:15))return fail();
   if(cup){
    if(opponents.some(id=>id.split('-')[0]===club.split('-')[0]))return fail();
    const pots=qualificationPots(binding.clubIds,countries);
    for(let p=0;p<3;p++){
     const pot=new Set(pots[p]);
     if(home.filter(g=>pot.has(g.awayClubId)).length!==1||away.filter(g=>pot.has(g.homeClubId)).length!==1)return fail();
    }
   }else for(const opponent of binding.clubIds.filter(id=>id!==club))if(home.filter(g=>g.awayClubId===opponent).length!==1||away.filter(g=>g.homeClubId===opponent).length!==1)return fail();
  }
 }
}
export async function buildInitialSchedule(snapshot:ApprovedSnapshot,seed:string):Promise<InitialSchedule>{
 const trusted=requireApprovedSnapshot(snapshot);
 const result=await generate(trusted,seed,1);checkInvariants(result,trusted);return result;
}
/** A status/hash supplied by stored data cannot certify itself. Reconstruct from
 * server-approved inputs and require exact canonical equality, including no scores. */
export async function validateInitialSchedule(input:unknown,snapshot:ApprovedSnapshot):Promise<void>{
 try{
  if(!input||typeof input!=='object'||Array.isArray(input))return fail();
  const value=input as InitialSchedule,expected=await buildInitialSchedule(snapshot,value.seed);
  if(await canonicalHash(input)!==await canonicalHash(expected))return fail();
 }catch{return fail()}
}

/** Read-only fixture generation from a *persisted* approved Season 2 catalog.
 * No client-provided participant list is trusted, and no fixture is persisted.
 * The existing sporting executor remains restricted to Season 1 until its
 * result/knockout/archive machinery has been made season-aware.
 */
export async function buildApprovedSeasonTwoInitialSchedule(db:Database,seed:string):Promise<InitialSchedule>{
 const review=await readSeasonTwoCandidate(db);
 const approved=await db.prepare('SELECT generation,source_archive_hash,snapshot_hash,snapshot_json FROM season_two_approvals WHERE target_season=2').first<{
  generation:string;source_archive_hash:string;snapshot_hash:string;snapshot_json:string
 }>();
 if(!approved||approved.generation!==review.world.generation||approved.source_archive_hash!==review.sourceArchiveHash||
  approved.snapshot_hash!==review.snapshot.snapshotHash)return fail();
 const {snapshotHash,status,readyForActivation,...manifest}=review.snapshot;
 let stored:unknown;
 try{stored=JSON.parse(approved.snapshot_json)}catch{return fail()}
 if(await canonicalHash(manifest)!==snapshotHash||await canonicalHash(stored)!==snapshotHash)return fail();
 const seasonOne=await loadApprovedSnapshot();
 const versions=new Map(seasonOne.bindings.map(b=>[b.competitionId,b.rulesVersion]));
 const bindings=manifest.bindings.map(b=>{
  const rulesVersion=versions.get(b.competitionId);if(!rulesVersion)return fail();
  return {competitionId:b.competitionId,rulesVersion,clubIds:b.clubIds};
 });
 const participantsHash=await canonicalHash([...bindings].sort((a,b)=>a.competitionId.localeCompare(b.competitionId,'en'))
  .map(b=>({competitionId:b.competitionId,clubIds:[...b.clubIds].sort()})));
 const trusted:SchedulingSnapshot={bindings,participantsHash,rulesHash:seasonOne.rulesHash};
 const result=await generate(trusted,seed,2);checkInvariants(result,trusted);return result;
}
