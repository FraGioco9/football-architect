/** Unwired #613 pure simulation candidate. No DB reads, writes or official result side effects. */
import {ATTRIBUTES,calculatePositionSuitability} from './players-generator-core.mjs';

export const LINEUP_SIMULATOR_VERSION='temporary-lineup-v1';
// #650: versioned test-only evidence, not a realistic player evaluation model.
export const TEST_RATING_VERSION='test-rating-v1';
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


/** Standalone match-context candidate. Same aggregate/extra-time/shootout semantics as temporary-score-v1.
 * Still unwired: callers must supply authenticated/verified fixture and roster snapshots later.
 */
function checkedContextV1(value){
 if(!value||typeof value!=='object'||Array.isArray(value))error('match context');
 const keys=Object.keys(value).sort().join(',');
 if(value.mode==='regulation'&&keys==='mode')return {mode:'regulation'};
 if(value.mode==='single-knockout'&&keys==='mode')return {mode:'single-knockout'};
 if(value.mode==='single-knockout'&&keys==='mode,neutral'&&value.neutral===true)
  return {mode:'single-knockout',neutral:true};
 if(value.mode==='second-leg'&&keys==='firstLegAwayGoals,firstLegHomeGoals,mode'&&
  [value.firstLegHomeGoals,value.firstLegAwayGoals].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=100))
  return {mode:'second-leg',firstLegHomeGoals:value.firstLegHomeGoals,firstLegAwayGoals:value.firstLegAwayGoals};
 return error('match context');
}
const CLUB_KEY_PATTERN=/^(?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40)$/;
function checkedClubs(homeClubId,awayClubId){
 if(!CLUB_KEY_PATTERN.test(homeClubId)||!CLUB_KEY_PATTERN.test(awayClubId)||homeClubId===awayClubId)
  error('match clubs');
}
function countExtraTimeGoals(lambda,u){
 let mass=Math.exp(-lambda/3),total=mass;
 for(let goals=0;goals<2;goals++){
  if(u<total)return goals;
  mass*=lambda/3/(goals+1);total+=mass;
 }
 return 2;
}
function mergedAppearanceSide(side,events,playedExtraTime,goals){
 if(side.kind==='team_fallback')return {
  ...side,unattributedGoals:goals,appearances:[]
 };
 const minutes=playedExtraTime?120:90;
 return {...side,unattributedGoals:0,
  appearances:side.starters.map(starter=>({
   playerId:starter.playerId,started:true,minutes,
   goals:events.filter(event=>event.playerId===starter.playerId).length
  }))};
}
async function sha256(value){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

/** No player IDs can appear on both teams, even if provided through two mistaken source lists. */
export async function simulateMatchV1({homeRoster,awayRoster,matchKey,seed,homeClubId,awayClubId,context}){
 checkedClubs(homeClubId,awayClubId);
 const verified=checkedContextV1(context);
 if(!Array.isArray(homeRoster)||!Array.isArray(awayRoster))error('rosters');
 const homeIds=new Set(homeRoster.map(p=>p?.id));
 if(awayRoster.some(p=>homeIds.has(p?.id)))error('player affiliated to both clubs');
 const neutral=verified.mode==='single-knockout'&&verified.neutral===true;
 const base=await simulateRegulationV1({homeRoster,awayRoster,matchKey,seed,neutral});
 const {homeGoals:regHome,awayGoals:regAway}=base.regulation;
 let homeGoals=regHome,awayGoals=regAway,extraTime=null,penalties=null;
 let resolution='regulation',playedExtraTime=false;
 const difference=()=>verified.mode==='second-leg'
  ?homeGoals+verified.firstLegAwayGoals-awayGoals-verified.firstLegHomeGoals
  :homeGoals-awayGoals;
 let delta=difference();
 const extraEvents=[];
 if(verified.mode!=='regulation'&&delta===0){
  playedExtraTime=true;
  const drawKey=JSON.stringify([LINEUP_SIMULATOR_VERSION,matchKey,seed,verified,base]);
  const [eh,ea]=await Promise.all([
   unit(drawKey,'home-extra-time').then(u=>countExtraTimeGoals(base.expectedGoals.home,u)),
   unit(drawKey,'away-extra-time').then(u=>countExtraTimeGoals(base.expectedGoals.away,u))
  ]);
  extraTime={home:eh,away:ea};
  homeGoals+=eh;awayGoals+=ea;delta=difference();resolution='extra-time';
  const [homeEvents,awayEvents]=await Promise.all([
   buildEvents(base.home,eh,drawKey+':et-home'),
   buildEvents(base.away,ea,drawKey+':et-away')
  ]);
  extraEvents.push(...homeEvents.map(event=>({...event,minute:91+((event.minute-1)%30),side:'home',period:'extra-time'})),
   ...awayEvents.map(event=>({...event,minute:91+((event.minute-1)%30),side:'away',period:'extra-time'})));
  if(delta===0){
   const scoreKey=JSON.stringify([LINEUP_SIMULATOR_VERSION,matchKey,seed,verified,base,extraTime]);
   const [winnerU,sizeU]=await Promise.all([
    unit(scoreKey,'penalties-winner'),unit(scoreKey,'penalties-size')
   ]);
   const winner=3+Math.floor(sizeU*4),loser=winner-1;
   penalties=winnerU<.5?{home:winner,away:loser}:{home:loser,away:winner};
   delta=penalties.home-penalties.away;resolution='penalties';
  }
 }
 const events=[...base.events.map(event=>({...event,period:'regulation'})),...extraEvents]
  .sort((a,b)=>a.minute-b.minute||(a.side<b.side?-1:a.side>b.side?1:0)||a.playerId-b.playerId);
 const homeEvents=events.filter(event=>event.side==='home');
 const awayEvents=events.filter(event=>event.side==='away');
 const home=mergedAppearanceSide(base.home,homeEvents,playedExtraTime,homeGoals);
 const away=mergedAppearanceSide(base.away,awayEvents,playedExtraTime,awayGoals);
 return attachTestRatingsV1({
  algorithmVersion:LINEUP_SIMULATOR_VERSION,mode:base.mode,matchKey,homeClubId,awayClubId,
  sourceSeedHash:await sha256([LINEUP_SIMULATOR_VERSION,seed]),context:verified,neutral,
  expectedGoals:base.expectedGoals,regulation:{home:regHome,away:regAway},
  extraTime,penalties,homeGoals,awayGoals,
  resolution,winnerClubId:delta===0?null:delta>0?homeClubId:awayClubId,
  home,away,events
 });
}
// Frozen match identity, seed digest and player identity produce a stable draw.
// Historic receipts can validate it without consulting current player data.
function testRatingV1(result,sideName,appearance){
 const key=JSON.stringify([TEST_RATING_VERSION,result.matchKey,result.sourceSeedHash,appearance.playerId]);
 let hash=2166136261;
 for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);
 hash^=hash>>>16;hash=Math.imul(hash,0x7feb352d);
 hash^=hash>>>15;hash=Math.imul(hash,0x846ca68b);hash^=hash>>>16;
 const unit=(hash>>>0)/4294967296;
 // Extra-time goals count, penalty kicks never count as goals. Apply the
 // winner adjustment to penalties only when a shootout actually occurred.
 const own=sideName==='home'?result.homeGoals:result.awayGoals;
 const other=sideName==='home'?result.awayGoals:result.homeGoals;
 const club=sideName==='home'?result.homeClubId:result.awayClubId;
 const won=result.penalties?result.winnerClubId===club:own>other;
 const lost=result.penalties?result.winnerClubId!==club:own<other;
 const raw=6.5+(unit-.5)*4.8+Math.min(appearance.goals,3)*.8+(won?.2:lost?-.1:0);
 return Math.round(clamp(raw,4,10)*10)/10;
}
function attachTestRatingsV1(result){
 result.ratingVersion=TEST_RATING_VERSION;
 for(const name of ['home','away']){
  const side=result[name];
  if(side.kind==='real_xi')side.appearances=side.appearances.map(appearance=>({
   ...appearance,rating:testRatingV1(result,name,appearance)
  }));
 }
 return result;
}
function deepFreeze(value){
 if(value&&typeof value==='object'&&!Object.isFrozen(value)){
  Object.values(value).forEach(deepFreeze);Object.freeze(value);
 }
 return value;
}
const DIGEST=/^[0-9a-f]{64}$/;
const COMPETITION=/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/;

/** Validated, fingerprinted, frozen *candidate* receipt; a later authorized D1 transaction
 * must enforce actual persistence uniqueness, source-revision checks and idempotence.
 */
export async function buildCandidateMatchReceiptV1(match,outcome){
 if(!match||typeof match!=='object'||Array.isArray(match)||!outcome||outcome.algorithmVersion!==LINEUP_SIMULATOR_VERSION)
  error('receipt inputs');
 const {matchId,season,day,generation,competitionId,fixtureId,homeClubId,awayClubId,sourceHash}=match;
 if(!Number.isSafeInteger(matchId)||matchId<1||!Number.isSafeInteger(season)||season<1||
  !Number.isInteger(day)||day<1||day>56||typeof generation!=='string'||!generation||
  !COMPETITION.test(competitionId)||typeof fixtureId!=='string'||
  !fixtureId.startsWith(`season:${season}:${competitionId}:`)||
  !fixtureId.endsWith(`:${homeClubId}:${awayClubId}`)||
  !DIGEST.test(sourceHash))error('receipt fixture evidence');
 checkedClubs(homeClubId,awayClubId);
 if(outcome.matchKey!==fixtureId||outcome.homeClubId!==homeClubId||outcome.awayClubId!==awayClubId)
  error('receipt match identity');
 const {homeGoals,awayGoals,regulation,extraTime,penalties,context,resolution,events}=outcome;
 checkedContextV1(context);
 if(!Number.isInteger(homeGoals)||!Number.isInteger(awayGoals)||homeGoals<0||awayGoals<0||
  !regulation||![regulation.home,regulation.away].every(n=>Number.isInteger(n)&&n>=0&&n<=6)||
  !['regulation','extra-time','penalties'].includes(resolution)||
  !DIGEST.test(outcome.sourceSeedHash)||!Array.isArray(events))error('receipt result');
 const playedExtraTime=extraTime!==null;
 if(playedExtraTime&&(!extraTime||![extraTime.home,extraTime.away].every(n=>Number.isInteger(n)&&n>=0&&n<=2)))error('extra time goals');
 if(homeGoals!==regulation.home+(extraTime?.home??0)||awayGoals!==regulation.away+(extraTime?.away??0))
  error('receipt score reconciliation');
 if((resolution==='regulation'&&(extraTime!==null||penalties!==null))||
  (resolution!=='regulation'&&context.mode==='regulation')||
  (resolution==='extra-time'&&(extraTime===null||penalties!==null))||
  (resolution==='penalties'&&(extraTime===null||!penalties||
   ![penalties.home,penalties.away].every(n=>Number.isInteger(n)&&n>=2&&n<=6)||
   Math.abs(penalties.home-penalties.away)!==1)))error('receipt knockout resolution');
 const aggregate=context.mode==='second-leg'
  ?homeGoals+context.firstLegAwayGoals-awayGoals-context.firstLegHomeGoals
  :homeGoals-awayGoals;
 const winnerDelta=resolution==='penalties'?penalties.home-penalties.away:aggregate;
 if(outcome.winnerClubId!==(winnerDelta===0?null:winnerDelta>0?homeClubId:awayClubId)||
  (context.mode!=='regulation'&&winnerDelta===0)||
  (resolution==='penalties'&&aggregate!==0)||
  (resolution==='extra-time'&&aggregate===0)||
  (context.mode==='regulation'&&playedExtraTime))error('receipt winner');
 // Preserve unchanged pre-rating V2 receipts. New receipts must use a single
 // explicit version; never infer a rating when that version is absent.
 if(outcome.ratingVersion!==undefined&&outcome.ratingVersion!==TEST_RATING_VERSION)
  error('receipt rating version');
 if(outcome.mode!==(outcome.home.kind==='real_xi'
  ?outcome.away.kind==='real_xi'?'xi_vs_xi':'xi_vs_fallback'
  :outcome.away.kind==='real_xi'?'fallback_vs_xi':'fallback_vs_fallback'))error('receipt mode');
 if(events.some(event=>event.type!=='goal'||!['home','away'].includes(event.side)||
  !Number.isInteger(event.minute)||event.minute<1||event.minute>(playedExtraTime?120:90)||
  (event.period==='regulation'&&event.minute>90)||
  (event.period==='extra-time'&&(event.minute<91||!playedExtraTime))||
  !['regulation','extra-time'].includes(event.period)))error('receipt events');
 for(const sideName of ['home','away']){
  const side=outcome[sideName],goals=sideName==='home'?homeGoals:awayGoals;
  if(!side||!Array.isArray(side.appearances)||!Number.isInteger(side.unattributedGoals)||
   side.unattributedGoals<0)error('receipt player record');
  const recorded=events.filter(event=>event.side===sideName);
  if(recorded.length+side.unattributedGoals!==goals)error('receipt scorer reconciliation');
  if(side.kind==='team_fallback'){
   if(side.starters!==null||side.appearances.length!==0||side.unattributedGoals!==goals||recorded.length)
    error('fallback player attribution');
  }else if(side.kind==='real_xi'){
   if(!Array.isArray(side.starters)||side.starters.length!==11||side.appearances.length!==11||
    side.unattributedGoals!==0)error('receipt XI size');
   const ids=side.starters.map(p=>p.playerId),unique=new Set(ids);
   if(unique.size!==11||ids.some(id=>!Number.isSafeInteger(id)||id<=0)||
    side.appearances.some(p=>!unique.has(p.playerId)||p.started!==true||
      p.minutes!==(playedExtraTime?120:90)||
      p.goals!==recorded.filter(event=>event.playerId===p.playerId).length)||
    new Set(side.appearances.map(p=>p.playerId)).size!==11||
    recorded.some(event=>!unique.has(event.playerId)))error('receipt player consistency');
  }else error('receipt side mode');
  const rated=outcome.ratingVersion===TEST_RATING_VERSION;
  if(side.appearances.some(p=>rated
   ?!Number.isFinite(p.rating)||p.rating<4||p.rating>10||
    Math.abs(p.rating*10-Math.round(p.rating*10))>1e-9||
    p.rating!==testRatingV1(outcome,sideName,p)
   :Object.hasOwn(p,'rating')))error('receipt test rating consistency');
 }
 const participantIds=new Set([...outcome.home.appearances,...outcome.away.appearances].map(p=>p.playerId));
 if(participantIds.size!==outcome.home.appearances.length+outcome.away.appearances.length)
  error('duplicate player across clubs');
 const fixture={matchId,season,day,generation,competitionId,fixtureId,homeClubId,awayClubId,sourceHash};
 const payload={schemaVersion:1,authority:'candidate-only',algorithmVersion:LINEUP_SIMULATOR_VERSION,
  fixture,result:outcome};
 // Copy before freeze, never freeze or mutate the caller's own input objects.
 const detached=JSON.parse(JSON.stringify(payload));
 return deepFreeze({...detached,receiptDigest:await sha256(detached)});
}
