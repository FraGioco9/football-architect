/** WRD04 — fictional continental competition (8 leagues × 4 places). Opt-in,
 * independent match records, qualification from *finished* domestic seasons.
 * Never edits historical league fixtures or WRD03 cup results. */
import {LEAGUES} from '../leagues.js';
import {hasCareerWorld,careerWorldLeague} from './career-world.js';
import {cupForCountry} from './career-cups.js';
import {randomFactory,scopedSeed} from './rng.js';
import {hashYouth} from '../addons/domain/player-youth.mjs';
import {addMessage} from './history.js';
import {medicalMatchLoad,medicalAvailability} from '../addons/domain/player-medical.mjs';
import {toAddonPosition} from '../addons/career-bridge.mjs';
import {competitionGapSlots,competitionDateForGap,competitionKickoffTime,isCareerDate,isCareerKickoff} from './career-date.js';
const fail=x=>{throw Error(`WRD04_${x}`);};
const validInt=x=>Number.isSafeInteger(x)&&x>=0;
const copy=x=>structuredClone(x);
const current=w=>w?.advancedV1?.continentalV1;
export const continentalEnabled=w=>hasCareerWorld(w)&&current(w)?.schemaVersion===1;
export const continentalName={it:'Coppa delle Costellazioni',en:'Constellations Cup'};
const countryIds=LEAGUES.map(l=>l.id);
const key=(country,id)=>`${country}:club:${id}`;
const splitKey=k=>{const match=/^(IT|ENG|ES|DE|FR|NL|PT|BR):club:(\d+)$/.exec(k);return match?{country:match[1],id:Number(match[2])}:null;};
const label=(w,k)=>{const parsed=splitKey(k);if(!parsed)return k;return careerWorldLeague(w,parsed.country)?.clubs.find(c=>c.id===parsed.id)?.name??k;};
const shuffle=(a,seed)=>{const list=[...a],r=randomFactory(seed);for(let i=list.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;};
export function continentalDays(input,{seed=0,season=1}={}){
 if(Array.isArray(input)){
  if(input.length<16)fail('CALENDAR');
  const reserved=competitionGapSlots(input,5,{seed,season,label:'national-cup'});
  return competitionGapSlots(input,10,{reserved,seed,season,label:'continental'});
 }
 const roundCount=input;
 if(!validInt(roundCount)||roundCount<16)fail('CALENDAR');
 // Legacy schedule retained for existing saves created before CAL-17.
 const reserved=new Set(Array.from({length:5},(_,i)=>Math.round(roundCount*(i+1)/6)));
 const used=new Set(),days=[];
 for(let i=0;i<10;i++){
  const target=Math.max(1,Math.round(roundCount*(i+1)/11));let chosen=null;
  for(let delta=0;delta<=roundCount&&chosen===null;delta++)for(const candidate of delta?[target+delta,target-delta]:[target]){
   if(candidate<=0||candidate>roundCount||reserved.has(candidate)||used.has(candidate)||candidate<=(days.at(-1)??0))continue;
   chosen=candidate;break;
  }
  if(chosen===null)fail('CALENDAR_FULL');used.add(chosen);days.push(chosen);
 }
 return days;
}
/** Capture rankings BEFORE WRD01 archives and resets the authoritative leagues. */
export function captureContinentalQualifiers(w){
 if(!continentalEnabled(w))return null;
 if(w.round!==w.fixtures.length)fail('EARLY_QUALIFICATION');
 const entrants=[];
 for(const country of countryIds){
  const league=careerWorldLeague(w,country);if(!league||league.round!==league.fixtures.length)fail('INCOMPLETE_COUNTRY');
  const ordered=league.table.map(x=>key(country,x.id));
  const champion=cupForCountry(w,country)?.championId;
  const cupKey=champion===null||champion===undefined?null:key(country,champion);
  // Cup winner receives one place; remaining places come from the domestic table.
  const first=cupKey&&ordered.includes(cupKey)?[cupKey]:[];
  const picks=[...first,...ordered.filter(x=>!first.includes(x))].slice(0,4);
  if(picks.length!==4||new Set(picks).size!==4)fail('QUALIFICATION');
  entrants.push(...picks.map((clubKey,index)=>({clubKey,countryId:country,qualification:index===0&&cupKey===clubKey?'cup':'league',domesticRank:ordered.indexOf(clubKey)+1})));
 }
 return entrants;
}
const dayMatch=(w,stage,day,idx,home,away,group)=>({id:`continental:${w.season}:${stage}:${day}:${idx}`,home,away,group,result:null});
function scheduleContinentalRound(w,round,index){
 const date=competitionDateForGap(w.fixtures,round.day,{seed:w.seed,season:w.season,label:'continental',index});
 round.date=date;
 for(let i=0;i<round.matches.length;i++){
  const kickoff=competitionKickoffTime(w.countryId,{seed:w.seed,season:w.season,label:`continental-${index}`,index:i,continental:true});
  const m=round.matches[i];m.date=date;m.kickoff=kickoff;m.datetime=`${date}T${kickoff}:00`;
 }
 return round;
}
function startEdition(w,entrants){
 if(!Array.isArray(entrants)||entrants.length!==32||new Set(entrants.map(x=>x.clubKey)).size!==32)fail('ENTRANTS');
 const days=continentalDays(w.fixtures,{seed:w.seed,season:w.season}),perCountry=new Map(countryIds.map(c=>[c,shuffle(entrants.filter(e=>e.countryId===c).map(e=>e.clubKey),scopedSeed(w.seed,'wrd04-seeding',w.season,c))]));
 const groups=Array.from({length:8},(_,i)=>({id:String.fromCharCode(65+i),clubs:[]}));
 for(let i=0;i<8;i++)for(let offset=0;offset<4;offset++){
  const country=countryIds[(i+offset)%8];const clubKey=perCountry.get(country).shift();if(!clubKey)fail('COUNTRY_POOL');groups[i].clubs.push(clubKey);
 }
 // Berger pairing (three home and three away for every club).
 const groupRounds=Array.from({length:6},(_,i)=>({index:i+1,day:days[i],matches:[]}));
 let serial=0;
 for(const g of groups){const a=shuffle(g.clubs,scopedSeed(w.seed,'wrd04-group',w.season,g.id));let rotation=[...a];
  for(let r=0;r<3;r++){
   const pairs=[[rotation[0],rotation[3]],[rotation[1],rotation[2]]];
   for(const [j,[h,v]] of pairs.entries()){
    const home=r%2===0&&j===0||r%2===1&&j===1?h:v;
    const away=home===h?v:h;
    groupRounds[r].matches.push(dayMatch(w,'group',r+1,++serial,home,away,g.id));
    groupRounds[r+3].matches.push(dayMatch(w,'group',r+4,++serial,away,home,g.id));
   }
   rotation=[rotation[0],rotation[3],rotation[1],rotation[2]];
  }
 }
 for(let i=0;i<groupRounds.length;i++)scheduleContinentalRound(w,groupRounds[i],i+1);
 return {season:w.season,name:continentalName.it,entrants:copy(entrants),groups,days,groupRounds,knockout:[],championKey:null,scorers:[],awards:[],rankings:[],venue:'Stadio delle Costellazioni',revision:0};
}
export function enableCareerContinental(w){
 if(!hasCareerWorld(w))fail('REQUIRES_WORLD');if(continentalEnabled(w))return w;if(current(w)!==undefined)fail('UNKNOWN_SCHEMA');
 w.advancedV1.continentalV1={schemaVersion:1,season:w.season,round:w.round,deferred:true,edition:null,history:[],unpaidForeign:{},revision:0};
 if(!validateCareerContinental(w))fail('INIT');return w;
}
const players=(w,k)=>{const c=splitKey(k);const ours=c.country===w.countryId&&w.teams.some(t=>t.id===c.id);if(ours)return w.players.filter(p=>p.clubId===c.id);const upper=w.advancedV1.worldV1.leagues.find(l=>l.countryId===c.country&&!l.locked);const top=upper?.players.filter(p=>p.clubId===c.id)??[];return top.length?top:w.advancedV1.divisionsV1?.countries?.[c.country]?.lower?.players?.filter(p=>p.clubId===c.id)??[];};
function poisson(r,mean){let k=1,n=-1,limit=Math.exp(-Math.max(.12,mean));do{n++;k*=Math.max(1e-8,r());}while(k>limit&&n<7);return n;}
function scorer(list,r){const pool=list.filter(p=>p.position!=='POR');if(!pool.length)return null;const weights=pool.map(p=>(['ATT','AS','AD','COC'].includes(p.position)?3:1)*(.7+p.ovr/100));let v=r()*weights.reduce((s,a)=>s+a,0);return pool[weights.findIndex(weight=>(v-=weight)<=0)??0]??pool[0];}
function play(w,m,knockout,managedSimulator){
 const seed=scopedSeed(w.seed,'wrd04-match',w.season,m.id),r=randomFactory(seed);
 const home=players(w,m.home),away=players(w,m.away);if(home.length<11||away.length<11)fail('ROSTER');
 let hg,ag,goals=[],engine='WRD04';
 const managed=[m.home,m.away].some(k=>k===key(w.countryId,w.clubId));
 if(managed){
  if(typeof managedSimulator!=='function')fail('SIMULATOR');
  const h=splitKey(m.home),a=splitKey(m.away);
  // SIM01's club lookup is domestic-only. Cross-border matches use seeded
  // team-strength simulation with the official medical workload for the XI.
  if(h.country===w.countryId&&a.country===w.countryId){
   const before=w.players.map(p=>[p.id,p.apps,p.goals,p.assists,p.yellow,p.cleanSheets,p.form]);
   const res=managedSimulator(w,{id:m.id,home:h.id,away:a.id,result:null});
   hg=res.homeGoals;ag=res.awayGoals;engine='SIM01';
   goals=res.goals.map(g=>{const p=w.players.find(x=>x.id===g.scorerId);return {minute:g.minute,side:g.side,playerId:p?.globalId??`${w.countryId}:${p?.id}`,playerName:p?.name??''};});
   for(const p of w.players){const prev=before.find(x=>x[0]===p.id);if(prev)[p.apps,p.goals,p.assists,p.yellow,p.cleanSheets,p.form]=prev.slice(1);}
  }
 }
 if(hg===undefined){const quality=list=>list.reduce((s,p)=>s+p.ovr,0)/list.length;const diff=quality(home)-quality(away);
  hg=poisson(r,Math.max(.3,1.25+diff*.052));ag=poisson(r,Math.max(.3,1.08-diff*.052));
  for(const [count,list,side,country] of [[hg,home,'home',splitKey(m.home).country],[ag,away,'away',splitKey(m.away).country]])for(let i=0;i<count;i++){
   const p=scorer(list,r);if(p)goals.push({minute:1+Math.floor(r()*90),side,playerId:p.globalId??(typeof p.id==='string'?p.id:`${country}:${p.id}`),playerName:p.name});
  }
 }
 let extraTime=null,penalties=null,winnerKey=null;
 if(knockout){let finalH=hg,finalA=ag;if(hg===ag){
  const eh=poisson(r,.32),ea=poisson(r,.32);extraTime={homeGoals:eh,awayGoals:ea};finalH+=eh;finalA+=ea;
  for(const [count,list,side,country] of [[eh,home,'home',splitKey(m.home).country],[ea,away,'away',splitKey(m.away).country]])for(let i=0;i<count;i++){
   const p=scorer(list,r);if(p)goals.push({minute:91+Math.floor(r()*30),side,playerId:p.globalId??(typeof p.id==='string'?p.id:`${country}:${p.id}`),playerName:p.name});
  }
  if(finalH===finalA){const ph=3+Math.floor(r()*4),pa=3+Math.floor(r()*4);penalties={home:ph+(ph===pa&&r()<.5?1:0),away:pa+(ph===pa&&r()<.5?1:0)};if(penalties.home===penalties.away)penalties.home++;}
 }
 winnerKey=finalH>finalA?m.home:finalH<finalA?m.away:penalties.home>penalties.away?m.home:m.away;
 }
 goals.sort((a,b)=>a.minute-b.minute||a.playerId.localeCompare(b.playerId));
 if(managed&&engine!=='SIM01'){
  // Preserve the league-only apps/goals; continental participation costs fitness,
  // with unavailable players excluded from the selected rotation.
  const mine=w.players.filter(p=>p.clubId===w.clubId&&p.medicalV1&&medicalAvailability(p.medicalV1).eligible&&medicalAvailability(p.medicalV1).minutesLimit>=90)
    .sort((a,b)=>b.ovr-a.ovr).slice(0,11);
  for(const p of mine){
   const medical=medicalMatchLoad(p.medicalV1,{matchId:m.id,day:w.advancedV1.clockDay,seconds:5400,pressing:55,position:toAddonPosition(p.position),age:p.age,stamina:p.attributeProfile.values.stamina??50,recovery:p.attributeProfile.values.recovery??50});
   medical.events=medical.events.slice(-1);medical.processedMatchIds=medical.processedMatchIds.slice(-2);
   p.medicalV1=medical;p.fitness=Math.round(medical.freshness);
  }
 }
 const result={homeGoals:hg,awayGoals:ag,extraTime,penalties,winnerKey,goals,engine,season:w.season};
 result.digest=hashYouth(JSON.stringify(result));return result;
}
const account=(w,k)=>{const p=splitKey(k);return p.country===w.countryId&&w.teams.some(t=>t.id===p.id)?w.teams.find(t=>t.id===p.id):w.advancedV1.marketV1?.foreignFinances?.[k];};
function award(w,ed,clubKey,kind,amountEUR,reputation=0){
 const record={clubKey,kind,amountEUR,reputation};ed.awards.push(record);
 const c=account(w,clubKey);if(c){c.balance+=amountEUR;if(c.transferBudget!==undefined)c.transferBudget+=Math.round(amountEUR*.6);else if(c.budget!==undefined)c.budget+=Math.round(amountEUR*.6);}else{const s=current(w);s.unpaidForeign[clubKey]=(s.unpaidForeign[clubKey]??0)+amountEUR;}
 if(reputation){const p=splitKey(clubKey),league=careerWorldLeague(w,p.country),team=p.country===w.countryId&&w.teams.some(t=>t.id===p.id)?w.teams.find(t=>t.id===p.id):w.advancedV1.worldV1.leagues.find(l=>l.countryId===p.country)?.clubs?.find(c=>c.id===p.id);if(team)team.reputation=Math.min(100,Math.max(0,team.reputation+reputation));}
}
export function settleContinentalCredits(w){if(!continentalEnabled(w))return 0;let total=0;for(const [k,amount] of Object.entries(current(w).unpaidForeign)){
 const c=account(w,k);if(!c)continue;c.balance+=amount;if(c.transferBudget!==undefined)c.transferBudget+=Math.round(amount*.6);else if(c.budget!==undefined)c.budget+=Math.round(amount*.6);delete current(w).unpaidForeign[k];total++;
 }return total;
}
export function continentalGroupTable(ed,groupId){
 const group=ed.groups.find(g=>g.id===groupId);if(!group)return [];
 const rows=group.clubs.map(clubKey=>({clubKey,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0})),map=new Map(rows.map(x=>[x.clubKey,x]));
 for(const round of ed.groupRounds)for(const m of round.matches){if(m.group!==groupId||!m.result)continue;const a=map.get(m.home),b=map.get(m.away),r=m.result;a.p++;b.p++;a.gf+=r.homeGoals;a.ga+=r.awayGoals;b.gf+=r.awayGoals;b.ga+=r.homeGoals;if(r.homeGoals>r.awayGoals){a.pts+=3;a.w++;b.l++;}else if(r.homeGoals<r.awayGoals){b.pts+=3;b.w++;a.l++;}else{a.pts++;b.pts++;a.d++;b.d++;}}
 return rows.sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.clubKey.localeCompare(b.clubKey));
}
function makeKnockout(w,ed,index,winners){
 const count=index===0?16:winners.length,day=ed.days[6+index];if(count<2||count%2)fail('DRAW');
 const pairs=[];if(index===0){const ranked=ed.groups.map(g=>continentalGroupTable(ed,g.id));for(let i=0;i<8;i++)pairs.push([ranked[i][0].clubKey,ranked[(i+3)%8][1].clubKey]);}
 else{const draw=shuffle(winners,scopedSeed(w.seed,'wrd04-knockout',w.season,index));for(let i=0;i<draw.length;i+=2)pairs.push([draw[i],draw[i+1]]);}
 const matches=pairs.map(([home,away],i)=>dayMatch(w,'ko',index+1,i+1,home,away,null));
 const round={index:index+1,day,neutral:index===3,venue:index===3?ed.venue:null,matches};
 if(isCareerDate(ed.groupRounds[0]?.date))scheduleContinentalRound(w,round,7+index);
 ed.knockout.push(round);
}
function processDueContinental(w,{simulateManagedCup=null,fromRound=false}={}){
 const s=current(w);if(s.deferred)return false;const ed=s.edition;
 const dateAware=isCareerDate(ed.groupRounds[0]?.date);
 const due=round=>round&&round.matches.some(m=>!m.result)&&(dateAware?round.date<=w.currentDate:fromRound&&round.day===w.round);
 const group=ed.groupRounds.find(due),ko=ed.knockout.find(due);
 let changed=false;
 if(group){
  for(const m of group.matches){m.result=play(w,m,false,simulateManagedCup);for(const goal of m.result.goals){const p=ed.scorers.find(x=>x.id===goal.playerId);if(p)p.goals++;else ed.scorers.push({id:goal.playerId,name:goal.playerName,goals:1});}
   if(group.index===1){award(w,ed,m.home,'participation',200000);award(w,ed,m.away,'participation',200000);}
   const r=m.result;if(r.homeGoals>r.awayGoals)award(w,ed,m.home,'group_win',80000);else if(r.awayGoals>r.homeGoals)award(w,ed,m.away,'group_win',80000);else{award(w,ed,m.home,'group_draw',40000);award(w,ed,m.away,'group_draw',40000);}
  }
  if(group.index===6){for(const g of ed.groups){const standings=continentalGroupTable(ed,g.id);ed.rankings.push({group:g.id,table:copy(standings)});for(const club of standings.slice(0,2))award(w,ed,club.clubKey,'last16',450000,1);}makeKnockout(w,ed,0,[]);}
  changed=true;
 }
 if(ko){for(const m of ko.matches){m.result=play(w,m,true,simulateManagedCup);for(const goal of m.result.goals){const p=ed.scorers.find(x=>x.id===goal.playerId);if(p)p.goals++;else ed.scorers.push({id:goal.playerId,name:goal.playerName,goals:1});}award(w,ed,m.result.winnerKey,`ko_${ko.index}`,ko.index===4?4000000:ko.index*600000,ko.index===4?4:1);}
  const advancing=ko.matches.map(x=>x.result.winnerKey);if(advancing.length===1){ed.championKey=advancing[0];addMessage(w,'Coppa continentale conclusa',`${ed.name}: ${label(w,ed.championKey)} campione.`,'cup',{type:'continental.winner',params:{club:label(w,ed.championKey),season:w.season}});}else makeKnockout(w,ed,ko.index,advancing);
  changed=true;
 }
 if(changed){ed.revision++;s.revision++;settleContinentalCredits(w);}return changed;
}
export function advanceCareerContinentalDay(w,{simulateManagedCup=null}={}){
 if(!continentalEnabled(w))return false;const s=current(w);
 if(s.season!==w.season||s.round!==w.round)fail('SYNC');
 return processDueContinental(w,{simulateManagedCup,fromRound:false});
}
export function advanceCareerContinentalRound(w,{simulateManagedCup=null}={}){
 if(!continentalEnabled(w))return false;const s=current(w);
 if(s.season!==w.season||![w.round-1,w.round].includes(s.round))fail('SYNC');
 if(s.round===w.round-1)s.round=w.round;
 return processDueContinental(w,{simulateManagedCup,fromRound:true});
}
export function archiveCareerContinentalSeason(w){
 if(!continentalEnabled(w))return false;const s=current(w);if(s.season!==w.season||s.round!==w.fixtures.length)fail('SYNC');
 if(!s.deferred){if(!s.edition?.championKey)fail('INCOMPLETE');s.history.push(copy(s.edition));if(s.history.length>25)s.history.shift();}
 return true;
}
export function openCareerContinentalSeason(w,qualifiers){
 if(!continentalEnabled(w))return false;const s=current(w);if(!Array.isArray(qualifiers))fail('QUALIFIERS');s.season=w.season;s.round=0;s.deferred=false;s.edition=startEdition(w,qualifiers);s.revision++;return true;
}
export function continentalHonours(w){return continentalEnabled(w)?current(w).history.map(x=>({season:x.season,championKey:x.championKey})):[];}
export function continentalEdition(w){return continentalEnabled(w)?current(w).edition:null;}
function validateEdition(w,ed,archived=false){
 if(!ed||!validInt(ed.season)||!Array.isArray(ed.entrants)||ed.entrants.length!==32||new Set(ed.entrants.map(x=>x.clubKey)).size!==32||!Array.isArray(ed.groups)||ed.groups.length!==8||!Array.isArray(ed.days)||ed.days.length!==10||!Array.isArray(ed.groupRounds)||ed.groupRounds.length!==6||!Array.isArray(ed.knockout)||ed.knockout.length>4||!Array.isArray(ed.awards)||!Array.isArray(ed.scorers)||!Array.isArray(ed.rankings)||!validInt(ed.revision))return false;
 const dateAware=isCareerDate(ed.groupRounds[0]?.date);
 if(!archived&&!dateAware){const expected=continentalDays(w.fixtures.length);if(ed.days.join()!==expected.join())return false;}
 if(dateAware){
  if(new Set(ed.days).size!==ed.days.length||ed.days.some(day=>!Number.isSafeInteger(day)||day<1||day>=w.fixtures.length))return false;
  if(!archived){const leagueDates=new Set(w.fixtures.map(r=>r.date));if([...ed.groupRounds,...ed.knockout].some(r=>leagueDates.has(r.date)))return false;}
 }
 const keys=new Set(ed.entrants.map(x=>x.clubKey)),counts=new Map(countryIds.map(c=>[c,0]));
 for(const e of ed.entrants){const parsed=splitKey(e.clubKey);if(!parsed||parsed.country!==e.countryId||!validInt(e.domesticRank)||e.domesticRank<1||e.domesticRank>20||!['league','cup'].includes(e.qualification))return false;counts.set(e.countryId,counts.get(e.countryId)+1);}if([...counts.values()].some(x=>x!==4))return false;
 const grouped=ed.groups.flatMap(g=>g.clubs);if(new Set(grouped).size!==32||grouped.some(k=>!keys.has(k))||ed.groups.some((g,i)=>g.id!==String.fromCharCode(65+i)||g.clubs?.length!==4||new Set(g.clubs.map(k=>splitKey(k)?.country)).size!==4))return false;
 const allGames=[];for(const [i,r] of ed.groupRounds.entries()){if(r.index!==i+1||r.day!==ed.days[i]||r.matches?.length!==16||(dateAware&&!isCareerDate(r.date)))return false;allGames.push(...r.matches);}
 for(const [i,r] of ed.knockout.entries()){if(r.index!==i+1||r.day!==ed.days[i+6]||r.matches?.length!==8/2**i||r.neutral!==(i===3)||(dateAware&&!isCareerDate(r.date)))return false;allGames.push(...r.matches);}
 const unique=new Set();const progress=archived?w.fixtures.length:w.round;
 for(const m of allGames){
  const groupIndex=ed.groupRounds.findIndex(r=>r.matches.includes(m)),koIndex=ed.knockout.findIndex(r=>r.matches.includes(m));
  const stage=groupIndex>=0?ed.groupRounds[groupIndex]:ed.knockout[koIndex];
  const played=archived?true:dateAware?stage.date<=w.currentDate:(groupIndex>=0?ed.days[groupIndex]<=progress:ed.days[6+koIndex]<=progress);
  if(!/^continental:\d+:(group|ko):\d+:\d+$/.test(m.id)||unique.has(m.id)||!keys.has(m.home)||!keys.has(m.away)||m.home===m.away||Boolean(m.result)!==played||(dateAware&&(m.date!==stage.date||!isCareerKickoff(m.kickoff)||m.datetime!==`${m.date}T${m.kickoff}:00`)))return false;unique.add(m.id);
  if(!m.result)continue;const t=m.result,{digest,...unsigned}=t;if(!validInt(t.digest)||hashYouth(JSON.stringify(unsigned))!==digest||t.season!==ed.season||!validInt(t.homeGoals)||!validInt(t.awayGoals)||!Array.isArray(t.goals)||!['WRD04','SIM01'].includes(t.engine))return false;
  const eh=t.extraTime?.homeGoals??0,ea=t.extraTime?.awayGoals??0;if(!validInt(eh)||!validInt(ea)||t.goals.length!==t.homeGoals+t.awayGoals+eh+ea)return false;
  const isKO=m.id.includes(':ko:');if(!isKO&&(t.winnerKey!==null||t.extraTime||t.penalties))return false;
  if(isKO){const tie=t.homeGoals+eh===t.awayGoals+ea;if(Boolean(t.penalties)!==tie||(!tie&&t.penalties)||!([m.home,m.away].includes(t.winnerKey)))return false;const win=t.homeGoals+eh>t.awayGoals+ea?m.home:t.homeGoals+eh<t.awayGoals+ea?m.away:t.penalties.home>t.penalties.away?m.home:m.away;if(win!==t.winnerKey)return false;}
 }
 if(allGames.length>111||ed.awards.some(a=>!keys.has(a.clubKey)||!validInt(a.amountEUR)||!validInt(a.reputation)||typeof a.kind!=='string')||ed.scorers.some(s=>typeof s.id!=='string'||typeof s.name!=='string'||!validInt(s.goals)))return false;
 const finished=archived||progress===w.fixtures.length;
 if(finished&&(!ed.championKey||ed.knockout.length!==4||ed.groupRounds.some(r=>r.matches.some(m=>!m.result))||ed.knockout.some(r=>r.matches.some(m=>!m.result))))return false;
 if(ed.championKey!==null&&ed.knockout.at(-1)?.matches[0]?.result?.winnerKey!==ed.championKey)return false;
 return true;
}
export function validateCareerContinental(w){const s=current(w);if(s===undefined)return true;
 if(!hasCareerWorld(w)||s?.schemaVersion!==1||s.season!==w.season||s.round!==w.round||typeof s.deferred!=='boolean'||!validInt(s.revision)||!Array.isArray(s.history)||s.history.length>25||!s.unpaidForeign||typeof s.unpaidForeign!=='object'||Array.isArray(s.unpaidForeign))return false;
 if(s.deferred?s.edition!==null:!validateEdition(w,s.edition))return false;
 if(Object.entries(s.unpaidForeign).some(([k,v])=>!splitKey(k)||!validInt(v)))return false;
 return s.history.every((ed,i)=>ed.season<w.season&&(i===0||ed.season>s.history[i-1].season)&&validateEdition(w,ed,true));
}
