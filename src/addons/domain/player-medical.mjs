/** Football Architect PLY04.01–03 — pure, opt-in, versioned medical state.
 * Does not overwrite legacy player.fitness/ovr/injury; every update returns a copy.
 * Days are career-local integers, not wall clock dates. Match operations are idempotent.
 */
export const MEDICAL_SCHEMA_VERSION = 1;
export const INJURY_KINDS = Object.freeze(['muscle','ligament','ankle','knee','bruise','concussion','illness']);
export const MEDICAL_EVENT_LIMIT = 96;
const MAX_MATCHES = 120;
const fail = code => {throw new Error(`PLY04_${code}`);};
const object = x => x && typeof x==='object' && !Array.isArray(x);
const round = x => Math.round(x*100)/100;
const clamp = (x,min,max) => Math.max(min,Math.min(max,x));
const finite = (v,min,max,code) => {if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(code);return v;};
const integer = (v,min,max,code) => {if(!Number.isSafeInteger(v)||v<min||v>max)fail(code);return v;};
const identifier = v => typeof v==='string'&&v.trim()!=='' || Number.isSafeInteger(v)&&v>0;
const copy = v => structuredClone(v);
const numeric = (obj,key,fallback,min=0,max=100) => finite(obj?.[key]??fallback,min,max,key.toUpperCase());
const positionKey = p => String(p??'CM').toUpperCase();
function validateInjury(injury,lastDay){
 if(injury===null)return;
 if(!object(injury)||!INJURY_KINDS.includes(injury.kind)||!['recovering','returning','cleared'].includes(injury.stage))fail('INJURY');
 integer(injury.startDay,0,10000000,'INJURY_START');
 integer(injury.totalDays,1,365,'INJURY_DURATION');
 integer(injury.daysRemaining,0,365,'INJURY_REMAINING');
 if(injury.daysRemaining>injury.totalDays||injury.startDay>lastDay)fail('INJURY_TIMELINE');
 if(injury.stage==='recovering'&&injury.daysRemaining===0 || injury.stage!=='recovering'&&injury.daysRemaining!==0)fail('INJURY_STAGE');
 finite(injury.returnProgress,0,100,'INJURY_PROGRESS');
 if(injury.stage==='recovering'&&injury.returnProgress!==0 || injury.stage==='cleared'&&injury.returnProgress!==100)fail('INJURY_PROGRESS_STAGE');
 if(injury.matchId!==null&&!identifier(injury.matchId))fail('INJURY_MATCH');
}
export function validateMedical(state){
 if(!object(state)||state.schemaVersion!==MEDICAL_SCHEMA_VERSION||!identifier(state.playerId))fail('SCHEMA');
 for(const k of ['matchForm','freshness','fatigue','overload'])finite(state[k],0,100,`STATE_${k.toUpperCase()}`);
 integer(state.lastDay,0,10000000,'LAST_DAY');
 if(typeof state.legacyUnavailable!=='boolean')fail('LEGACY_FLAG');
 if(!['none','recovering','returning','cleared'].includes(state.recoveryStatus))fail('RECOVERY_STATUS');
 validateInjury(state.injury,state.lastDay);
 if(state.recoveryStatus!==(state.injury?.stage??'none'))fail('RECOVERY_MISMATCH');
 if(!Array.isArray(state.loadHistory)||state.loadHistory.length>40 || !Array.isArray(state.events)||state.events.length>MEDICAL_EVENT_LIMIT)fail('HISTORY');
 if(!Array.isArray(state.processedMatchIds)||state.processedMatchIds.length>MAX_MATCHES||new Set(state.processedMatchIds.map(String)).size!==state.processedMatchIds.length || state.processedMatchIds.some(x=>!identifier(x)))fail('MATCH_IDS');
 let previous=-1;
 for(const row of state.loadHistory){
  if(!object(row)||!identifier(row.matchId)||!Number.isSafeInteger(row.day)||row.day<0||row.day>state.lastDay||row.day<previous)fail('HISTORY_ROW');
  integer(row.seconds,0,8100,'HISTORY_SECONDS');finite(row.load,0,100,'HISTORY_LOAD');previous=row.day;
 }
 for(const e of state.events){if(!object(e)||typeof e.type!=='string'||!Number.isSafeInteger(e.day)||e.day<0||e.day>state.lastDay)fail('EVENT');}
 return true;
}
/** Deterministic projection, old player remains untouched. Unknown legacy absences are *not* invented injuries. */
export function initialMedical(player,{day=0}={}){
 if(!object(player)||!identifier(player.id))fail('PLAYER');integer(day,0,10000000,'DAY');
 const freshness=numeric(player,'fitness',100);
 const state={schemaVersion:MEDICAL_SCHEMA_VERSION,playerId:String(player.id),matchForm:50,
  freshness, fatigue:round(100-freshness), overload:0, injury:null, recoveryStatus:'none',
  legacyUnavailable:Boolean(player.unavailable),lastDay:day,loadHistory:[],processedMatchIds:[],events:[]};
 validateMedical(state);return state;
}
export function readMedical(player,options={}){
 if(!object(player)||!identifier(player.id))fail('PLAYER');
 if(player.medicalV1!=null){validateMedical(player.medicalV1);if(String(player.id)!==String(player.medicalV1.playerId))fail('PLAYER_MISMATCH');return copy(player.medicalV1);}
 return initialMedical(player,options);
}
export function copyPlayerWithMedical(player,options={}){return {...copy(player),medicalV1:readMedical(player,options)};}
function pushEvent(s,event){s.events.push(event);s.events=s.events.slice(-MEDICAL_EVENT_LIMIT);}
/** Legacy unavailable can only be explicitly released after verifying the old data. */
export function resolveLegacyAbsence(state,{day,cleared}={}){
 validateMedical(state);integer(day,0,10000000,'DAY');if(day!==state.lastDay)fail('DAY_MISMATCH');
 if(typeof cleared!=='boolean')fail('CLEARANCE_REQUIRED');const out=copy(state);
 if(cleared&&out.legacyUnavailable){out.legacyUnavailable=false;pushEvent(out,{type:'legacy_clearance',day});}
 validateMedical(out);return out;
}
/** Rates are game-design estimates, not clinical predictions. */
export function medicalAvailability(state){
 validateMedical(state);
 let status='available',reasons=[];
 if(state.legacyUnavailable){status='unavailable';reasons.push('legacy_unavailable');}
 if(state.injury?.stage==='recovering'){status='unavailable';reasons.push('injured');}
 if(status!=='unavailable'&&state.injury?.stage==='returning'){status='restricted';reasons.push('rehabilitation');}
 if(state.overload>=75)reasons.push('overload');
 if(state.freshness<30)reasons.push('low_freshness');
 if(state.fatigue>=82)reasons.push('fatigue');
 // Return-to-play restrictions are applicable to substitutes; starters remain prohibited.
 const minutesLimit=status==='unavailable'?0:status==='restricted'?Math.min(75,Math.max(15,Math.round(15+state.injury.returnProgress*0.65))):135;
 const selectionStatus=status==='restricted'?'bench_only':status;
 return {status,selectionStatus,eligible:status!=='unavailable',canStart:status==='available',minutesLimit,reasons,
  estimatedDays:state.injury?.stage==='recovering'?state.injury.daysRemaining:0};
}
export function medicalMatchLoad(state,{matchId,day,seconds,pressing=50,position='CM',age=25,stamina=50,recovery=50,injuredThisMatch=false}={}){
 validateMedical(state);if(!identifier(matchId))fail('MATCH_ID');integer(day,0,10000000,'DAY');integer(seconds,0,8100,'SECONDS');
 finite(pressing,0,100,'PRESSING');integer(age,15,110,'AGE');finite(stamina,1,100,'STAMINA');finite(recovery,1,100,'RECOVERY');
 if(typeof injuredThisMatch!=='boolean')fail('INJURY_FLAG');
 // A checkpoint may retry a previously settled fixture after the medical clock has
 // advanced. Retained match IDs must be no-ops, not invalid backward-day updates.
 if(state.processedMatchIds.some(x=>String(x)===String(matchId)))return copy(state);
 if(day<state.lastDay)fail('DAY');
 if(day!==state.lastDay)fail('RECOVERY_REQUIRED');
 const avail=medicalAvailability(state);
 if(seconds>0&&avail.status==='unavailable'&&!(injuredThisMatch&&state.injury?.matchId!==null&&String(state.injury.matchId)===String(matchId)))fail('PLAYED_UNAVAILABLE');
 if(seconds>avail.minutesLimit*60&&!(injuredThisMatch&&state.injury?.matchId!==null&&String(state.injury.matchId)===String(matchId)))fail('MINUTES_LIMIT');
 const pos=positionKey(position);
 const roleFactor=pos==='GK'?0.58:['ST','CF','RW','LW','RM','LM','RWB','LWB'].includes(pos)?1.12:1;
 const endurance=clamp(1.25-(stamina-50)*0.004-(recovery-50)*0.002,0.82,1.45);
 const ageFactor=age<=28?1:Math.min(1.22,1+(age-28)*0.013);
 const load=round(clamp(seconds/5400*(8+14*pressing/100)*roleFactor*endurance*ageFactor,0,100));
 const previousWeek=state.loadHistory.filter(e=>day-e.day<=6).reduce((t,e)=>t+e.load,0);
 const pressure=round(clamp((previousWeek+load-26)*0.75,0,16));
 const next=copy(state);
 next.fatigue=round(clamp(next.fatigue+load*0.80,0,100));
 next.freshness=round(clamp(next.freshness-load*0.84,0,100));
 next.overload=round(clamp(next.overload+pressure+load*0.16,0,100));
 if(seconds>0)next.matchForm=round(clamp(next.matchForm+(seconds>=2700?0.45:0.15)-(next.fatigue>=90?0.6:0),0,100));
 next.loadHistory.push({matchId,day,seconds,load});next.loadHistory=next.loadHistory.slice(-40);
 next.processedMatchIds.push(matchId);next.processedMatchIds=next.processedMatchIds.slice(-MAX_MATCHES);
 pushEvent(next,{type:'match_load',day,matchId,seconds,load,pressing,position:pos});
 if(next.overload>=65)pushEvent(next,{type:'overload_warning',day,level:next.overload});
 validateMedical(next);return next;
}
export function startInjury(state,{day,kind='muscle',durationDays=7,matchId=null}={}){
 validateMedical(state);integer(day,0,10000000,'DAY');if(day!==state.lastDay)fail('DAY_MISMATCH');
 if(!INJURY_KINDS.includes(kind))fail('INJURY_KIND');integer(durationDays,1,365,'DURATION');
 if(matchId!==null&&!identifier(matchId))fail('MATCH_ID');
 if(state.injury&&state.injury.stage!=='cleared')fail('ALREADY_INJURED');
 const next=copy(state);next.injury={kind,stage:'recovering',startDay:day,totalDays:durationDays,daysRemaining:durationDays,returnProgress:0,matchId};
 next.recoveryStatus='recovering';next.matchForm=round(clamp(next.matchForm-3,0,100));
 pushEvent(next,{type:'injury',day,kind,durationDays,matchId});validateMedical(next);return next;
}
/** Daily tick: consecutive days only or grouped deterministic replay; same day returns same record. */
export function recoverMedical(state,{day,rest=70,training=20,recovery=50}={}){
 validateMedical(state);integer(day,state.lastDay,10000000,'DAY');if(day-state.lastDay>1096)fail('RECOVERY_SPAN');
 finite(rest,0,100,'REST');finite(training,0,100,'TRAINING');finite(recovery,1,100,'RECOVERY');
 if(day===state.lastDay)return copy(state);
 const next=copy(state);for(let d=state.lastDay+1;d<=day;d++){
  const recoveryFactor=clamp(0.65+recovery/100,0.66,1.65);
  const restFactor=0.7+rest/100*0.9;
  const trainingLoad=training/100*2.4;
  next.fatigue=round(clamp(next.fatigue-(5.3*restFactor*recoveryFactor-trainingLoad),0,100));
  next.freshness=round(clamp(next.freshness+(4.1*restFactor*recoveryFactor-trainingLoad*0.55),0,100));
  next.overload=round(clamp(next.overload-(2.8*restFactor*recoveryFactor-trainingLoad),0,100));
  if(next.injury?.stage==='recovering'){
   next.injury.daysRemaining--;
   if(next.injury.daysRemaining===0){next.injury.stage='returning';next.injury.returnProgress=0;next.recoveryStatus='returning';pushEvent(next,{type:'medical_clearance',day:d});}
  } else if(next.injury?.stage==='returning'){
   const p=round(clamp(next.injury.returnProgress+8+rest*0.06+recovery*0.06-training*0.035,0,100));
   next.injury.returnProgress=p;
   if(p>=100){next.injury.stage='cleared';next.recoveryStatus='cleared';pushEvent(next,{type:'full_return',day:d});}
  }
  next.lastDay=d;
  next.loadHistory=next.loadHistory.filter(e=>d-e.day<=13);
 }
 validateMedical(next);return next;
}
/** Explicitly stable and bounded; seed-based event detection does not use Math.random. */
export function evaluateInjuryRisk(state,{matchId,minutes=90,pressing=50,age=25,seed=0}={}){
 validateMedical(state);if(!identifier(matchId))fail('MATCH_ID');finite(minutes,0,135,'MINUTES');finite(pressing,0,100,'PRESSING');integer(age,15,110,'AGE');integer(seed,0,0xffffffff,'SEED');
 const allowed=medicalAvailability(state);if(!allowed.eligible||minutes===0)return {risk:0,occurred:false,kind:null,durationDays:0};
 const relapse=state.injury?.stage==='returning'?0.045*(1-state.injury.returnProgress/130):0;
 const risk=Math.round(clamp((0.004+0.014*state.fatigue/100+0.015*state.overload/100+0.004*pressing/100+Math.max(0,age-29)*0.00035+relapse)*minutes/90,0,0.20)*10000)/10000;
 const hash=s=>{let h=2166136261>>>0;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;}return h/4294967296;};
 const key=`PLY04|${seed}|${state.playerId}|${String(matchId)}`;
 const occurred=hash(key)<risk;
 const kind=occurred?INJURY_KINDS[Math.floor(hash(key+'|kind')*INJURY_KINDS.length)]:null;
 const durationDays=occurred?Math.min(90,1+Math.floor(hash(key+'|duration')*25*(1+state.overload/120))):0;
 return {risk,occurred,kind,durationDays};
}
