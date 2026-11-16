/** Unwired #613 pure simulation candidate. No DB reads, writes or official result side effects. */
import {ATTRIBUTES,calculatePositionSuitability} from './players-generator-core.mjs';

export const LINEUP_SIMULATOR_VERSION='temporary-lineup-v1';
export const LINEUP_V1_SLOTS=Object.freeze(['GK','RB','CB','CB','LB','CM','DM','CM','RW','ST','LW']);
const VALID_ROLES=new Set('GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' '));
const BASELINE_STRENGTH=61;
const OFF_POSITION_COST=12;
const error=(reason)=>{throw new TypeError('Invalid match simulation input: '+reason)};
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

function eligiblePlayers(roster){
 if(!Array.isArray(roster))error('roster');
 const seen=new Set(),active=[];
 for(const player of roster){
  if(!player||typeof player!=='object'||!Number.isSafeInteger(player.id)||player.id<=0||seen.has(player.id))error('player identity');
  seen.add(player.id);
  if(!['active','retired'].includes(player.career_status))error('career status');
  if(player.career_status==='retired')continue;
  if(!VALID_ROLES.has(player.primary_position)||!Array.isArray(player.secondary_positions))error('positions');
  const positions=[player.primary_position,...player.secondary_positions];
  if(positions.some(role=>!VALID_ROLES.has(role))||new Set(positions).size!==positions.length)error('duplicate/unknown position');
  if(!player.attributes||typeof player.attributes!=='object'||
    ATTRIBUTES.some(key=>!Number.isInteger(player.attributes[key])||player.attributes[key]<1||player.attributes[key]>99))error('attributes');
  active.push({id:player.id,primary_position:player.primary_position,
   secondary_positions:[...player.secondary_positions],attributes:Object.fromEntries(ATTRIBUTES.map(key=>[key,player.attributes[key]]))});
 }
 return active.sort((a,b)=>a.id-b.id);
}

/** Rectangular minimum-cost assignment; all 11 slots, no duplicate real player IDs. */
function assign(slots,players){
 const n=slots.length,m=players.length;
 const keeperPresent=players.some(p=>p.primary_position==='GK'||p.secondary_positions.includes('GK'));
 const costs=slots.map(role=>players.map(p=>{
  const listed=p.primary_position===role||p.secondary_positions.includes(role);
  if(role==='GK'&&keeperPresent&&!listed)return 1e8;
  return Math.round((100-calculatePositionSuitability(p.attributes,role)+(listed?0:OFF_POSITION_COST))*400);
 }));
 const u=new Array(n+1).fill(0),v=new Array(m+1).fill(0),p=new Array(m+1).fill(0),way=new Array(m+1).fill(0);
 for(let i=1;i<=n;i++){
  p[0]=i;let j0=0;
  const minv=new Array(m+1).fill(Infinity),used=new Array(m+1).fill(false);
  do{
   used[j0]=true;
   const i0=p[j0];let delta=Infinity,j1=0;
   for(let j=1;j<=m;j++)if(!used[j]){
    const cur=costs[i0-1][j-1]-u[i0]-v[j];
    if(cur<minv[j]){minv[j]=cur;way[j]=j0;}
    if(minv[j]<delta){delta=minv[j];j1=j;}
   }
   for(let j=0;j<=m;j++)if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else minv[j]-=delta;
   j0=j1;
  }while(p[j0]!==0);
  do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0!==0);
 }
 const chosen=new Array(n);
 for(let j=1;j<=m;j++)if(p[j])chosen[p[j]-1]=players[j-1];
 return chosen;
}

export function selectAutomaticXiV1(roster){
 const eligible=eligiblePlayers(roster);
 if(eligible.length<11)return {kind:'team_fallback',strength:BASELINE_STRENGTH,starters:null};
 const assignments=assign(LINEUP_V1_SLOTS,eligible);
 const starters=assignments.map((player,index)=>{
  const role=LINEUP_V1_SLOTS[index];
  return {playerId:player.id,role,suitability:calculatePositionSuitability(player.attributes,role),
   emergencyGoalkeeper:role==='GK'&&player.primary_position!=='GK'&&!player.secondary_positions.includes('GK'),
   attributes:{...player.attributes},primaryPosition:player.primary_position,secondaryPositions:[...player.secondary_positions]};
 });
 return {kind:'real_xi',formation:'4-3-3',strength:starters.reduce((a,p)=>a+p.suitability,0)/11,starters};
}

async function unit(seed,purpose){
 const bytes=new TextEncoder().encode(JSON.stringify([LINEUP_SIMULATOR_VERSION,seed,purpose]));
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return new DataView(digest).getUint32(0,false)/4294967296;
}
function poissonCappedSix(lambda,u){
 let p=Math.exp(-lambda),cumulative=p;
 for(let goals=0;goals<6;goals++){
  if(u<cumulative)return goals;
  p*=lambda/(goals+1);cumulative+=p;
 }
 return 6;
}
function scorerWeight(starter){
 const {role,attributes}=starter;
 return attributes.shooting*(role==='GK'?.05:['RB','CB','LB'].includes(role)?.5:['RW','LW','ST'].includes(role)?1.5:1);
}
async function buildEvents(side,goals,seed){
 if(side.kind==='team_fallback')return [];
 const weights=side.starters.map(scorerWeight),total=weights.reduce((a,b)=>a+b,0);
 const events=[];
 for(let i=0;i<goals;i++){
  let choice=(await unit(seed,'scorer:'+i))*total,index=weights.length-1;
  for(let j=0;j<weights.length;j++){choice-=weights[j];if(choice<0){index=j;break;}}
  const minute=1+Math.floor((await unit(seed,'minute:'+i))*90);
  events.push({minute,playerId:side.starters[index].playerId,type:'goal'});
 }
 return events.sort((a,b)=>a.minute-b.minute||a.playerId-b.playerId);
}

/** Only 90-minute regulation; callers must NOT publish as an official match result. */
export async function simulateRegulationV1({homeRoster,awayRoster,matchKey,seed,neutral=false}){
 if(typeof matchKey!=='string'||!matchKey||typeof seed!=='string'||seed.length<16||typeof neutral!=='boolean')error('match identity/seed');
 const home=selectAutomaticXiV1(homeRoster),away=selectAutomaticXiV1(awayRoster);
 const mode=home.kind==='real_xi'?(away.kind==='real_xi'?'xi_vs_xi':'xi_vs_fallback'):(away.kind==='real_xi'?'fallback_vs_xi':'fallback_vs_fallback');
 if(mode==='fallback_vs_fallback')return {kind:'use_existing_temporary_score_v1',mode};
 const delta=home.strength-away.strength;
 const lambdaHome=clamp((neutral?1.25:1.40)+delta/30,.40,2.80);
 const lambdaAway=clamp((neutral?1.25:1.10)-delta/30,.40,2.80);
 const snapshot=JSON.stringify([matchKey,home,away,neutral]);
 const key=JSON.stringify([matchKey,seed,snapshot]);
 const [homeGoals,awayGoals]=await Promise.all([
  unit(key,'home-regulation').then(u=>poissonCappedSix(lambdaHome,u)),
  unit(key,'away-regulation').then(u=>poissonCappedSix(lambdaAway,u))
 ]);
 const [homeEvents,awayEvents]=await Promise.all([
  buildEvents(home,homeGoals,key+':home'),buildEvents(away,awayGoals,key+':away')
 ]);
 const summarize=(side,goals,events)=>({
  kind:side.kind,strength:side.strength,starters:side.starters,
  unattributedGoals:side.kind==='team_fallback'?goals:0,
  appearances:side.kind==='team_fallback'?[]:side.starters.map(player=>({playerId:player.playerId,started:true,minutes:90,
   goals:events.filter(event=>event.playerId===player.playerId).length}))
 });
 return {algorithmVersion:LINEUP_SIMULATOR_VERSION,mode,matchKey,neutral,
  expectedGoals:{home:lambdaHome,away:lambdaAway},regulation:{homeGoals,awayGoals},
  home:summarize(home,homeGoals,homeEvents),away:summarize(away,awayGoals,awayEvents),
  events:[...homeEvents.map(event=>({...event,side:'home'})),...awayEvents.map(event=>({...event,side:'away'}))]
   .sort((a,b)=>a.minute-b.minute||a.side.localeCompare(b.side)||a.playerId-b.playerId)};
}
