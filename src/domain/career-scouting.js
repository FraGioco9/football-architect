/** MKT03 — Optional scouting knowledge, never a second authoritative player DB.
 * Exact abilities and potential stay in the game engine and are not copied to reports.
 * Reports store confidence only; estimates are non-exact and reproducible.
 */
import {marketEnabled,marketClubs} from './career-market.js';
import {addMessage} from './history.js';

const err=code=>{throw Error(`MKT03_${code}`);};
const int=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const clone=structuredClone;
export const scoutingEnabled=w=>marketEnabled(w)&&w.advancedV1.scoutingV1?.schemaVersion===1;
export const scoutingCountries=w=>marketClubs(w).map(c=>c.countryId).filter((c,i,a)=>a.indexOf(c)===i);
export function scoutingPlayers(w){
 if(!marketEnabled(w))return [];
 const players=w.players.filter(p=>p.clubId>0).map(p=>({id:p.globalId??`${w.countryId}:${p.id}`,player:p,countryId:w.countryId,clubKey:`${w.countryId}:club:${p.clubId}`,owned:p.clubId===w.clubId}));
 for(const [id,free] of Object.entries(w.advancedV1.calendarV1?.freeAgents??{})){
  const countryId=free.formerClubKey?.split(':')[0];
  players.push({id,player:free.player,countryId,clubKey:free.formerClubKey,owned:false});
 }
 for(const league of w.advancedV1.worldV1.leagues){if(league.locked)continue;
  for(const p of league.players)players.push({id:p.id,player:p,countryId:league.countryId,clubKey:`${league.countryId}:club:${p.clubId}`,owned:false});
 }
 return players;
}
export function scoutingPlayer(w,id){return scoutingPlayers(w).find(p=>p.id===id)??null;}
const limit=(v,a,b)=>Math.min(b,Math.max(a,v));
function hash(...parts){let h=2166136261;for(const c of parts.join('|')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function state(w){if(!scoutingEnabled(w))err('DISABLED');return w.advancedV1.scoutingV1;}
export function enableCareerScouting(w){
 if(!marketEnabled(w))err('REQUIRES_MARKET');if(scoutingEnabled(w))return w;
 if(w.advancedV1.scoutingV1!==undefined)err('UNSUPPORTED_SCHEMA');
 const coverage={};for(const code of scoutingCountries(w))coverage[code]=code===w.countryId?3:0;
 w.advancedV1.scoutingV1={schemaVersion:1,revision:0,lastDay:w.advancedV1.clockDay,season:w.season,staffLevel:2,coverage,missions:[],reports:{},shortlist:[],sequence:0};
 if(!validateCareerScouting(w))err('INITIAL_STATE');return w;
}
function edit(w,revision,cb){const s=state(w);if(revision!==s.revision)err('STALE_REVISION');const draft=clone(w),result=cb(draft.advancedV1.scoutingV1,draft);draft.advancedV1.scoutingV1.revision++;if(!validateCareerScouting(draft))err('INVALID_COMMIT');Object.assign(w,draft);return result;}
export function assignScoutingMission(w,{revision,countryId,position='ALL',ageMin=16,ageMax=38,contractMax=12,weeks=4}={}){
 return edit(w,revision,(s,draft)=>{
  if(!scoutingCountries(draft).includes(countryId)||!['ALL','POR','TD','DC','TS','MED','CC','COC','AD','AS','ATT'].includes(position)||!int(ageMin,15,39)||!int(ageMax,ageMin,45)||!int(contractMax,0,20)||!int(weeks,1,12))err('FILTER');
  if(s.missions.filter(m=>m.status==='active').length>=4)err('MISSION_LIMIT');
  const mission={id:`scout:${++s.sequence}`,countryId,position,ageMin,ageMax,contractMax,weeks,progress:0,startedDay:draft.advancedV1.clockDay,status:'active'};
  s.missions.push(mission);s.missions=s.missions.slice(-40);return mission.id;
 });
}
export function cancelScoutingMission(w,{revision,id}={}){return edit(w,revision,s=>{const m=s.missions.find(m=>m.id===id&&m.status==='active');if(!m)err('MISSION');m.status='cancelled';return id;});}
export function shortlistScoutedPlayer(w,{revision,playerId,add=true}={}){
 return edit(w,revision,(s,draft)=>{if(!scoutingPlayer(draft,playerId))err('UNKNOWN_PLAYER');if(add){if(!s.shortlist.includes(playerId)){if(s.shortlist.length>=40)err('SHORTLIST_FULL');s.shortlist.push(playerId);}}else s.shortlist=s.shortlist.filter(id=>id!==playerId);return playerId;});
}
// Explicit (free) review requires existing coverage or a mission report; weekly missions raise accuracy.
export function refreshScoutingReport(w,{revision,playerId}={}){
 return edit(w,revision,(s,draft)=>{const found=scoutingPlayer(draft,playerId);if(!found)err('UNKNOWN_PLAYER');const coverage=s.coverage[found.countryId]??0;if(!coverage&&!s.reports[playerId])err('NO_COVERAGE');const previous=s.reports[playerId]?.confidence??0;
  const confidence=limit(Math.max(previous,12+coverage*9+s.staffLevel*3),0,88);
  s.reports[playerId]={confidence,lastCheckedDay:draft.advancedV1.clockDay,countryId:found.countryId};return confidence;
 });
}
// Confidence represents precision, not the hidden actual statistic; minimum uncertainty remains.
export function scoutingEstimate(w,id){
 const found=scoutingPlayer(w,id);if(!found)return null;
 const s=scoutingEnabled(w)?w.advancedV1.scoutingV1:null;
 const r=s?.reports[id];const confidence=r?.confidence??0;const day=r?.lastCheckedDay??null;
 const effective=day===null?0:limit(confidence-Math.floor(Math.max(0,w.advancedV1.clockDay-day)/35)*4,0,88);
 const width=limit(Math.round(22-effective*.16),8,22);
 const mk=(value,kind)=>{
  if(!Number.isFinite(value))return null;
  const target=limit(Math.round(value),1,99);
  const shift=(hash(w.seed,id,kind)%9)-4;
  const center=limit(Math.round(target+shift*(1-effective/115)),1,99);
  let low=limit(center-width,1,99),high=limit(center+width,1,99);
  // Even at high confidence never output exact CA/PA; never show true as center guaranteed.
  if(high-low<8){low=limit(high-8,1,99);high=limit(low+8,1,99);}
  return {min:low,max:high};
 };
 // No report: no numerical estimate whatsoever (public name/age/position remain).
 return {id,countryId:found.countryId,known:effective>0,confidence:effective,lastCheckedDay:day,
   overall:effective?mk(found.player.ovr,'overall'):null,potential:effective?mk(found.player.potential,'potential'):null,
   valueEUR:effective?{min:Math.round((found.player.value??found.player.ovr**3*3)*(.50+effective/300)/1000)*1000,max:Math.round((found.player.value??found.player.ovr**3*3)*(1.5-effective/300)/1000)*1000}:null,
   attributes:effective>=58?Object.fromEntries(Object.entries(found.player.attributes??found.player.attributeProfile?.values??{}).slice(0,12).map(([k,v])=>[k,mk(v,k)])):null};
}
export function advanceCareerScouting(w){
 if(!scoutingEnabled(w))return;
 const s=w.advancedV1.scoutingV1,day=w.advancedV1.clockDay;
 if(day<=s.lastDay)return;
 const weeks=Math.min(52,Math.floor((day-s.lastDay)/7));
 for(let week=0;week<weeks;week++)for(const m of s.missions){if(m.status!=='active')continue;
  m.progress++;
  s.coverage[m.countryId]=limit(s.coverage[m.countryId]+(m.progress%2===0?1:0),0,5);
  const candidates=scoutingPlayers(w).filter(x=>x.countryId===m.countryId&&(m.position==='ALL'||x.player.position===m.position)&&x.player.age>=m.ageMin&&x.player.age<=m.ageMax&&x.player.contract<=m.contractMax);
  // deterministic rotation spreads work beyond the same high-rating players.
  const sample=candidates.length?Array.from({length:Math.min(3,candidates.length)},(_,i)=>candidates[(m.progress*3-3+i)%candidates.length]):[];
  for(const c of sample){const previous=s.reports[c.id]?.confidence??0;
   s.reports[c.id]={confidence:limit(Math.max(previous,24)+9+s.staffLevel*2,0,88),lastCheckedDay:day,countryId:m.countryId};
  }
  if(m.progress>=m.weeks){m.status='completed';addMessage(w,'Rapporto osservatori',`Missione completata: ${m.countryId}. I rapporti scouting sono aggiornati.`,'scouting',{type:'scouting.updated',params:{club:m.countryId}});}
 }
 s.staffLevel=Math.max(s.staffLevel,Math.min(5,2+Math.floor(s.missions.filter(m=>m.status==='completed').length/3)));
 s.lastDay=day;s.season=w.season;s.revision++;
 // Retain most recent reports, always including shortlists; bound save growth.
 const entries=Object.entries(s.reports).sort((a,b)=>b[1].lastCheckedDay-a[1].lastCheckedDay);
 if(entries.length>180){const keep=new Set([...s.shortlist,...entries.slice(0,180).map(([id])=>id)]);s.reports=Object.fromEntries(entries.filter(([id])=>keep.has(id)).slice(0,220));}
}
export function validateCareerScouting(w){
 const s=w?.advancedV1?.scoutingV1;if(s===undefined)return true;
 if(!marketEnabled(w)||s?.schemaVersion!==1||!int(s.revision,0,1e9)||!int(s.lastDay,0,w.advancedV1.clockDay)||!int(s.staffLevel,1,5)||!int(s.sequence,0,1e9)||!int(s.season,1,w.season)||!s.coverage||!Array.isArray(s.missions)||!Array.isArray(s.shortlist)||!s.reports||s.missions.length>40||s.shortlist.length>40||Object.keys(s.reports).length>220)return false;
 try{
  const countries=scoutingCountries(w),playerIds=new Set(scoutingPlayers(w).map(p=>p.id));
  if(Object.keys(s.coverage).length!==countries.length||countries.some(c=>!int(s.coverage[c],0,5)))return false;
  if(new Set(s.shortlist).size!==s.shortlist.length||s.shortlist.some(id=>!playerIds.has(id)))return false;
  if(s.missions.filter(m=>m.status==='active').length>4)return false;
  for(const m of s.missions)if(!/^scout:\d+$/.test(m.id)||!countries.includes(m.countryId)||!['ALL','POR','TD','DC','TS','MED','CC','COC','AD','AS','ATT'].includes(m.position)||!int(m.ageMin,15,39)||!int(m.ageMax,m.ageMin,45)||!int(m.contractMax,0,20)||!int(m.weeks,1,12)||!int(m.progress,0,m.weeks)||!int(m.startedDay,0,w.advancedV1.clockDay)||!['active','completed','cancelled'].includes(m.status))return false;
  for(const [id,r] of Object.entries(s.reports))if(!playerIds.has(id)||!countries.includes(r.countryId)||!int(r.confidence,1,88)||!int(r.lastCheckedDay,0,w.advancedV1.clockDay))return false;
  return true;
 }catch{return false;}
}

/** Remove stale live targets after retirement/intake; keep surviving IDs across transfers. */
export function settleCareerScoutingSeason(w){
 if(!scoutingEnabled(w))return;
 const s=w.advancedV1.scoutingV1,available=new Set(scoutingPlayers(w).map(p=>p.id));
 s.reports=Object.fromEntries(Object.entries(s.reports).filter(([id])=>available.has(id)).map(([id,r])=>[id,{...r,countryId:scoutingPlayer(w,id).countryId}]));
 s.shortlist=s.shortlist.filter(id=>available.has(id));
 s.lastDay=w.advancedV1.clockDay;s.season=w.season;s.revision++;
}
