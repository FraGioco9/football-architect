/** PLY06: authoritative opt-in youth academy, retirement and promotions for the
 * original v1 career. Reuse the tested deterministic PLY06 domain model, but
 * retain the official numeric player IDs and the official season/save schema.
 * No mutation of legacy careers or historical results without explicit opt-in.
 */
import {createYouthWorld,advanceYouthSeason,validateYouthWorld,countryKey,auditYouthWorld} from '../addons/domain/player-youth.mjs';
import {toAddonPosition} from '../addons/career-bridge.mjs';
import {initialMedical} from '../addons/domain/player-medical.mjs';
import {initialDevelopment,DEVELOPMENT_PROGRAMS} from '../addons/domain/player-development.mjs';
import {makeDefaultLineup} from './lineups.js';
import {addMessage} from './history.js';
import {hasCareerTraining} from './career-training.js';

const fail=code=>{throw Error(`CAREER_YOUTH_${code}`);};
const country=w=>countryKey(w.countryId);
const squadCap=32, academyCap=18, minimum=18;
const nativePositions={GK:'POR',CB:'DC',RB:'TD',RWB:'TD',LB:'TS',LWB:'TS',CDM:'MED',CM:'CC',RM:'AD',LM:'AS',CAM:'COC',RW:'AD',LW:'AS',ST:'ATT'};
const finiteId=n=>Number.isSafeInteger(n)&&n>0;
const active=w=>w?.advancedV1?.enabled===true&&w.advancedV1?.youthV1?.schemaVersion===1;
export const hasCareerYouth=active;
const own=w=>w.advancedV1.youthV1;
const idSet=w=>new Set(w.players.map(p=>p.id));
const academyMembers=y=>Object.values(y.academy).flat();
const certifiedIds=w=>new Set([...w.players.map(p=>p.id),...academyMembers(own(w)).map(p=>p.id),...own(w).retired.map(p=>p.id),...own(w).departed.map(p=>p.id)]);
function asModel(w){
 const y=own(w), clubs=w.teams.map(t=>({id:String(t.id),countryId:country(w),academyQuality: t.id===w.clubId?4:3,squadLimit:squadCap,academyLimit:academyCap,
  players:w.players.filter(p=>p.clubId===t.id).map(p=>({...p,clubId:String(t.id),position:toAddonPosition(p.position)})),
  academy:structuredClone(y.academy[String(t.id)]??[])}));
 const model=createYouthWorld({clubs,seed:w.seed,season:w.season});
 model.nextYouthSerial=y.nextYouthSerial;
 model.usedPlayerIds=y.usedIds.map(String);
 for(const c of model.clubs){c.retired=structuredClone(y.retired.filter(r=>r.clubId===c.id));c.departed=structuredClone(y.departed.filter(r=>r.clubId===c.id));}
 validateYouthWorld(model);return model;
}
function assignNumericIds(model,y){
 const mapping=new Map();
 const nextId=()=>{if(!finiteId(y.nextPlayerId)||y.nextPlayerId>=Number.MAX_SAFE_INTEGER)fail('ID_EXHAUSTED');return y.nextPlayerId++;};
 for(const c of model.clubs)for(const p of [...c.players,...c.academy]){
  if(!finiteId(Number(p.id))||String(p.id).startsWith('fa-y:')){
   if(!mapping.has(String(p.id)))mapping.set(String(p.id),nextId());
   p.id=mapping.get(String(p.id));
  }else p.id=Number(p.id);
 }
 for(const evt of model.events)if(mapping.has(evt.playerId))evt.playerId=String(mapping.get(evt.playerId));
 model.usedPlayerIds=model.usedPlayerIds.map(id=>String(mapping.get(id)??id));
 return mapping;
}
function toOfficialProspect(p,w){
 const position=nativePositions[p.position]??'CC';
 const id=Number(p.id);if(!finiteId(id))fail('INVALID_ID');
 const ovr=Math.min(94,Math.max(25,Math.round(p.ovr)));
 const value=Math.max(50000,Math.round((Math.max(1,ovr-40)**2*4800)*(p.age<=20?1.12:1)/50000)*50000);
 const full={...p,id,clubId:Number(p.clubId),position,nationality:country(w),
  foot:p.preferredFoot==='left'?'Sinistro':'Destro',fitness:92,morale:72,form:6.8,
  ovr,potential:Math.min(98,Math.max(ovr,p.potential)),value,
  wage:Math.max(500,Math.round((1500+ovr*ovr*.95)/100)*100),contract:3,injury:0,
  apps:0,goals:0,assists:0,yellow:0,cleanSheets:0,history:[]};
 delete full.contractV1;delete full.careerStats;
 if(w.advancedV1?.enabled)full.medicalV1=initialMedical(full,{day:w.advancedV1.clockDay});
 // Existing PLY03 integration requires the first active season to begin at
 // lastSeason=season-1, not at the academy's previous development epoch.
 if(hasCareerTraining(w)){
  full.developmentV1=initialDevelopment({...full,position:toAddonPosition(full.position)},
   {seed:w.seed,countryId:w.countryId,startSeason:w.season});
 }
 return full;
}
/** Explicit academy opt-in. No legacy squad ages, fixtures, scores or financials change. */
export function enableCareerYouth(w){
 if(!w?.clubId||w.advancedV1?.enabled!==true||!hasCareerTraining(w))fail('REQUIRES_TRAINING');
 if(active(w))return w;
 if(w.advancedV1.youthV1!==undefined)fail('UNKNOWN_VERSION');
 const candidate=structuredClone(w);
 const ids=new Set(candidate.players.map(p=>p.id));if(ids.size!==candidate.players.length||![...ids].every(finiteId))fail('PLAYER_IDS');
 const y={schemaVersion:1,season:w.season,nextPlayerId:Math.max(0,...ids)+1,nextYouthSerial:1,
  academyProgram:'balanced',usedIds:[...ids],academy:Object.fromEntries(w.teams.map(t=>[String(t.id),[]])),retired:[],departed:[],events:[],lastCompletedSeason:w.season-1};
 candidate.advancedV1.youthV1=y;
 const seedModel=asModel(candidate);
 // Use PLY06 intake generator without advancing the official squad's age.
 const preview=advanceYouthSeason(seedModel,{season:w.season+1,intakePerClub:4,minimumPlayers:minimum});
 assignNumericIds(preview,y);
 for(const c of preview.clubs){
  y.academy[c.id]=c.academy.map(p=>({...p,bornSeason:w.season}));
 }
 y.nextYouthSerial=preview.nextYouthSerial;
 y.usedIds=[...new Set([...y.usedIds,...Object.values(y.academy).flat().map(p=>p.id)])];
 if(!validateCareerYouth(candidate))fail('INITIALIZATION');
 Object.assign(w,candidate);return w;
}
export function validateCareerYouth(w){
 if(!w?.advancedV1?.youthV1)return true;
 const y=own(w);
 if(!w.advancedV1.enabled||y.schemaVersion!==1||y.season!==w.season||!Number.isSafeInteger(y.nextPlayerId)||!Number.isSafeInteger(y.nextYouthSerial))return false;
 if(!DEVELOPMENT_PROGRAMS.includes(y.academyProgram)||!Array.isArray(y.usedIds)||!Array.isArray(y.retired)||!Array.isArray(y.departed)||!Array.isArray(y.events)||!y.academy||typeof y.academy!=='object')return false;
 if(y.events.length>350||y.retired.length>3500||y.departed.length>3500||y.usedIds.length>100000)return false;
 try{
  const all=certifiedIds(w),used=new Set(y.usedIds);
  if(used.size!==y.usedIds.length||all.size!==w.players.length+academyMembers(y).length+y.retired.length+y.departed.length)return false;
  if([...all].some(id=>!finiteId(id)||!used.has(id)||id>=y.nextPlayerId))return false;
  if(y.usedIds.some(id=>!finiteId(id)||id>=y.nextPlayerId))return false;
  if(Object.keys(y.academy).length!==w.teams.length)return false;
  for(const t of w.teams){const pupils=y.academy[String(t.id)];if(!Array.isArray(pupils)||pupils.length>academyCap)return false;
   if(!w.players.some(p=>p.clubId===t.id&&p.position==='POR')||w.players.filter(p=>p.clubId===t.id).length<minimum)return false;
   for(const p of pupils){if(String(p.clubId)!==String(t.id)||p.age<15||p.age>22||p.ovr<1||p.ovr>100||!p.attributeProfile)return false;}
  }
  const m=asModel(w);validateYouthWorld(m);
 }catch{return false;}
 return true;
}
/** Explicit promotion, validating space and keeping the same ID from academy. */
export function promoteCareerProspect(w,playerId){
 if(!active(w))fail('INACTIVE');const candidate=structuredClone(w),y=own(candidate),club=y.academy[String(w.clubId)];
 if(!club)fail('CLUB');const idx=club.findIndex(p=>p.id===Number(playerId));if(idx<0)fail('NOT_FOUND');
 if(candidate.players.filter(p=>p.clubId===w.clubId).length>=squadCap)fail('ROSTER_FULL');
 const p=club[idx];if(p.age<16)fail('TOO_YOUNG');club.splice(idx,1);
 candidate.players.push(toOfficialProspect(p,candidate));
 y.events.push({season:w.season,type:'promotion',clubId:String(w.clubId),playerId:p.id});y.events=y.events.slice(-350);
 if(!validateCareerYouth(candidate))fail('PROMOTION_VALIDATION');
 Object.assign(w,candidate);return Number(p.id);
}
/** Called once after official PLY03 annual reconciliation but BEFORE the
 * legacy +1 age loop. All incoming prospects are adapted to official format.
 * The caller must then skip legacy age increments in this opt-in mode. */
export function settleCareerYouthSeason(w){
 if(!active(w))return false;
 if(w.round!==w.fixtures.length||w.advancedV1.youthV1.season!==w.season)fail('SEASON_NOT_FINISHED');
 const y=own(w),model=asModel(w);
 const minutes=Object.fromEntries(Object.entries(w.advancedV1.trainingV1?.seasonStats??{}).map(([id,s])=>[id,s.minutes]));
 const fitness=Object.fromEntries(w.players.map(p=>[String(p.id),Math.max(0,Math.min(100,p.fitness))]));
 const programmes=Object.fromEntries((y.academy[String(w.clubId)]??[]).map(p=>[String(p.id),y.academyProgram]));
 const next=advanceYouthSeason(model,{season:w.season+1,minutesByPlayer:minutes,fitnessByPlayer:fitness,trainingByPlayer:programmes,intakePerClub:4,minimumPlayers:minimum});
 assignNumericIds(next,y);
 const oldById=new Map(w.players.map(p=>[p.id,p]));const nextPlayers=[];let promotions=0;
 for(const club of next.clubs){
  for(const p of club.players){
   const old=oldById.get(p.id);
   if(old){old.age=p.age;nextPlayers.push(old);}
   else { // generated emergency or promoted academy prospect
    // Created for the *upcoming* season, so its PLY03 state starts there.
    const prepared=toOfficialProspect(p,{...w,season:w.season+1});nextPlayers.push(prepared);promotions++;
   }
  }
  y.academy[club.id]=club.academy;
 }
 const retired=next.clubs.flatMap(c=>c.retired),departed=next.clubs.flatMap(c=>c.departed);
 const freshRetired=retired.slice(y.retired.length);
 for(const rec of freshRetired){const original=oldById.get(Number(rec.id));if(original){
  rec.id=Number(rec.id);rec.clubId=String(original.clubId);
  rec.careerStats={apps:original.apps,goals:original.goals,assists:original.assists,cleanSheets:original.cleanSheets,previousSeasons:structuredClone(original.history??[])};
 }}
 // Archive records need numeric IDs just like official players.
 for(const rec of retired)rec.id=Number(rec.id);
 for(const rec of departed)rec.id=Number(rec.id);
 y.retired=retired;y.departed=departed;
 y.usedIds=next.usedPlayerIds.map(Number);
 y.nextYouthSerial=next.nextYouthSerial;
 y.season=w.season+1;
 y.lastCompletedSeason=w.season;
 const events=next.events.map(e=>({...e,playerId:Number(e.playerId)}));
 y.events.push(...events);y.events=y.events.slice(-350);
 w.players=nextPlayers;
 const current=new Set(nextPlayers.map(p=>p.id));
 w.watchlist=w.watchlist.filter(id=>current.has(id));
 for(const id of Object.keys(w.advancedV1.roles))if(!current.has(Number(id)))delete w.advancedV1.roles[id];
 for(const id of Object.keys(w.advancedV1.legacyInjuryRounds))if(!current.has(Number(id)))delete w.advancedV1.legacyInjuryRounds[id];
 if(hasCareerTraining(w)){
  const t=w.advancedV1.trainingV1;
  t.playerStates=Object.fromEntries(Object.entries(t.playerStates).filter(([id])=>current.has(Number(id))));
 }
 if(freshRetired.length||promotions)addMessage(w,'Ricambio generazionale',
  `${freshRetired.length} ritiri; ${promotions} nuovi calciatori promossi o reclutati. Il vivaio continua a produrre prospetti.`, 'training',{type:'youth.turnover',params:{retirements:freshRetired.length,promotions}});
 return {retirements:freshRetired.length,promotions,academy:academyMembers(y).length};
}
/** After medical off-season recovery has advanced the official clock, refresh
 * the first-team medical state of newcomers, without resetting veterans. */
export function alignCareerYouthMedical(w){
 if(!active(w))return;
 for(const p of w.players){if(!p.medicalV1||p.medicalV1.lastDay!==w.advancedV1.clockDay){
   if(p.medicalV1&&p.medicalV1.lastDay!==w.advancedV1.clockDay)fail('VETERAN_MEDICAL');
   p.medicalV1=initialMedical(p,{day:w.advancedV1.clockDay});
 }}
}
export function careerYouthSummary(w){
 if(!active(w))return null;const y=own(w),academy=y.academy[String(w.clubId)]??[];
 return {season:w.season,academyProgram:y.academyProgram,academy:structuredClone(academy).sort((a,b)=>a.age-b.age||String(a.name).localeCompare(String(b.name))||String(a.id).localeCompare(String(b.id))),
  retired:y.retired.filter(p=>String(p.clubId)===String(w.clubId)).slice(-14).reverse(),
  allRetired:y.retired.length,totalAcademy:academyMembers(y).length,
  events:y.events.filter(e=>String(e.clubId)===String(w.clubId)).slice(-12).reverse(),
  rosterSize:w.players.filter(p=>p.clubId===w.clubId).length,capacity:squadCap};
}

/** Academy-specific focus for the next youth intake/development cycle. */
export function configureCareerAcademy(w,program){
 if(!active(w))fail('INACTIVE');if(!DEVELOPMENT_PROGRAMS.includes(program))fail('PROGRAM');
 const candidate=structuredClone(w);candidate.advancedV1.youthV1.academyProgram=program;
 if(!validateCareerYouth(candidate))fail('PROGRAM_VALIDATION');
 Object.assign(w,candidate);return program;
}

/** Archived identity lookup only for history/reporting. Never use as an active
 * roster lookup for transfers, lineups, wages or match simulation. */
export function historicPlayerName(w,playerId){
 const key=Number(playerId);
 return w.players?.find(p=>p.id===key)?.name
  ??w.advancedV1?.youthV1?.retired?.find(p=>p.id===key)?.name
  ??w.advancedV1?.youthV1?.departed?.find(p=>p.id===key)?.name
  ??`#${key}`;
}
