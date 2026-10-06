/** PLY06.01–05: deterministic, opt-in youth & retirement world.
 * Separate from legacy saves: no implicit migration, match result or financial mutation.
 */
import {canonicalPosition,POSITION_WEIGHTS,rawPositionRating} from './player-ratings.mjs';
import {createAttributes} from './player-attributes.mjs';
import {generatePlayerAttributes} from './player-generator.mjs';
import {readPersonality} from './player-personality.mjs';
import {initialDevelopment,simulateDevelopmentSeason,validateDevelopment} from './player-development.mjs';
import {makeContract,makeTerms,validateContract} from './player-contract.mjs';

export const YOUTH_SCHEMA_VERSION=1;
const err=code=>{throw new Error(`PLY06_${code}`);};
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const int=(x,a,b,code)=>{if(!Number.isSafeInteger(x)||x<a||x>b)err(code);return x;};
const id=x=>{if(!['string','number'].includes(typeof x)||!String(x).trim()||String(x)==='__proto__')err('ID');return String(x);};
const clone=x=>structuredClone(x);
const cap=(x,a,b)=>Math.max(a,Math.min(b,x));
export function hashYouth(text){let h=2166136261;for(let i=0;i<String(text).length;i++){h=Math.imul(h^String(text).charCodeAt(i),16777619);}return h>>>0;}
export function drawYouth(...parts){let n=(hashYouth(parts.join('|'))+0x6D2B79F5)>>>0;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;}
const NAMES={
 IT:{first:['Luca','Marco','Matteo','Alessio','Davide','Pietro','Federico','Tommaso'],last:['Bellandi','Ferrante','Moretti','Rinaldi','Sartori','Valli','Contini','Mariani']},
 ENG:{first:['Oliver','Harry','George','Jack','Ethan','Oscar','Arthur','Noah'],last:['Parker','Bennett','Cooper','Fletcher','Turner','Hughes','Walker','Carter']},
 ESP:{first:['Pablo','Diego','Hugo','Álvaro','Mateo','Iker','Sergio','Adrián'],last:['Navarro','Salcedo','Varela','Morales','Serrano','Molina','Cordero','Delgado']},
 GER:{first:['Lukas','Felix','Jonas','Leon','Finn','Moritz','Emil','Maximilian'],last:['Becker','Vogel','Krüger','Schulz','Ritter','Albrecht','Keller','Wagner']},
 FRA:{first:['Hugo','Lucas','Mathis','Enzo','Théo','Nathan','Louis','Alexis'],last:['Moreau','Lefèvre','Dubois','Laurent','Garnier','Roux','Petit','Lambert']},
 NED:{first:['Daan','Sem','Luuk','Milan','Bram','Jesse','Niels','Thijs'],last:['De Vries','Van Dijk','Bakker','Visser','Smit','Bos','Mulder','Meijer']},
 POR:{first:['João','Miguel','Diogo','Tiago','Rafael','Afonso','Gonçalo','Duarte'],last:['Silva','Pereira','Ferreira','Sousa','Costa','Almeida','Carvalho','Teixeira']},
 BR:{first:['Gabriel','João','Pedro','Lucas','Rafael','Bruno','Matheus','Caio'],last:['Oliveira','Santos','Almeida','Ferreira','Costa','Nascimento','Ribeiro','Barbosa']},
 BEL:{first:['Jules','Louis','Noah','Arthur','Thibaut','Niels','Pieter','Milan'],last:['Peeters','Vermeulen','Dubois','Martens','De Smet','Lambert','Janssens','Wouters']},
};
const alias={IT:'IT',ITA:'IT',ITALY:'IT',EN:'ENG',ENG:'ENG',GB:'ENG',UK:'ENG',ES:'ESP',ESP:'ESP',DE:'GER',GER:'GER',FR:'FRA',FRA:'FRA',NL:'NED',NED:'NED',PT:'POR',POR:'POR',BE:'BEL',BEL:'BEL',BELGIUM:'BEL',BR:'BR',BRA:'BR',BRAZIL:'BR'};
export const YOUTH_COUNTRIES=Object.freeze(Object.keys(NAMES));
export function countryKey(value){const v=String(value??'IT').trim().toUpperCase();if(!Object.hasOwn(alias,v))err('UNKNOWN_COUNTRY');return alias[v];}
const mix=['GK','CB','CM','ST','RB','LW','CDM','CB','CAM','LB','RW','CM','ST','RWB','LM','CF'];
export function youthName(country,seed,clubId,season,serial){const names=NAMES[countryKey(country)],i=drawYouth(seed,clubId,season,serial,'first'),j=drawYouth(seed,clubId,season,serial,'last');return `${names.first[Math.floor(i*names.first.length)]} ${names.last[Math.floor(j*names.last.length)]}`;}
function createProspect({id:playerId,countryId,clubId,season,seed,serial,emergency=false,position}={}){
 const role=canonicalPosition(position??mix[(serial+season+Math.floor(drawYouth(seed,clubId,season,serial,'pos')*4))%mix.length]);
 const age=emergency?17+Math.floor(drawYouth(seed,serial,'age')*3):15+Math.floor(drawYouth(seed,serial,'age')*4);
 const potential=cap(Math.round(54+drawYouth(seed,serial,'potential')*39),50,94);
 const ovr=cap(Math.round((emergency?40:32)+drawYouth(seed,serial,'ovr')*19+Math.max(0,age-16)*1.5),25,emergency?65:62);
 const player={id:playerId,clubId:String(clubId),nationality:countryKey(countryId),name:youthName(countryId,seed,clubId,season,serial),position:role,age,ovr,potential,origin:'PLY06-v1',bornSeason:season,preferredFoot:drawYouth(seed,serial,'foot')<0.18?'left':'right',careerStats:{apps:0,starts:0,minutes:0,goals:0,assists:0}};
 player.attributeProfile=generatePlayerAttributes(player,{seed,countryId:player.nationality});
 player.personalityProfile=readPersonality(player,{seed,countryId:player.nationality});
 return player;
}
function summaryRetired(player,season,clubId,reason){return {id:id(player.id),name:String(player.name??player.fullName??`#${player.id}`),clubId:String(clubId),countryId:String(player.nationality??''),position:canonicalPosition(player.position??player.pos),retiredSeason:season,age:player.age,ovr:player.ovr??player.overall??null,reason,careerStats:clone(player.careerStats??player.stats??{}),contractHistory:clone(player.contractV1?.history??[])};}
export function retirementChance(player,{season=1,seed=0,minutes=1200,fitness=65}={}){
 int(season,1,500,'SEASON');int(seed,0,0xffffffff,'SEED');int(minutes,0,6000,'MINUTES');
 if(!Number.isFinite(fitness)||fitness<0||fitness>100)err('FITNESS');
 const age=int(player.age,15,100,'AGE');
 if(age<30)return 0;
 if(age>=44)return 1;
 const traits=readPersonality(player,{seed}).traits;
 const p=cap((age-29)**1.55*0.009+(50-fitness)*0.0009+(900-minutes)*0.000022-(traits.determination-50)*0.0006-(traits.professionalism-50)*0.0004,0,0.96);
 return Math.round(p*10000)/10000;
}
export function retirementDecision(player,{season=1,seed=0,minutes=1200,fitness=65}={}){
 const probability=retirementChance(player,{season,seed,minutes,fitness});return {retire:drawYouth('retire',seed,season,player.id)<probability,probability,reasons:['age','fitness','personality','minutes']};
}
export function validateYouthWorld(world){
 if(!object(world)||world.schemaVersion!==1)err('SCHEMA');int(world.seed,0,0xffffffff,'SEED');int(world.season,1,500,'SEASON');int(world.revision,0,100000,'REVISION');int(world.nextYouthSerial,1,10000000,'SERIAL');
 if(!Array.isArray(world.clubs)||world.clubs.length<1||world.clubs.length>250||!Array.isArray(world.usedPlayerIds)||!Array.isArray(world.events))err('SHAPE');
 const clubIds=new Set(),activeIds=new Set(),seen=new Set();
 for(const c of world.clubs){
  if(!object(c)||clubIds.has(id(c.id)))err('CLUB_DUPLICATE');clubIds.add(id(c.id));
  if(!YOUTH_COUNTRIES.includes(c.countryId))err('COUNTRY');int(c.academyQuality,1,5,'ACADEMY_QUALITY');int(c.squadLimit,11,50,'SQUAD_LIMIT');int(c.academyLimit,1,50,'ACADEMY_LIMIT');
  if(!Array.isArray(c.players)||!Array.isArray(c.academy)||!Array.isArray(c.retired)||!Array.isArray(c.departed))err('CLUB_SHAPE');
  if(c.players.length>c.squadLimit||c.academy.length>c.academyLimit)err('CAPACITY');
  for(const [array,label] of [[c.players,'squad'],[c.academy,'academy']])for(const p of array){
   if(!object(p)||String(p.clubId??c.id)!==String(c.id))err('PLAYER_CLUB');const key=id(p.id);if(activeIds.has(key))err('PLAYER_DUPLICATE');activeIds.add(key);
   int(p.age,15,100,'PLAYER_AGE');canonicalPosition(p.position??p.pos);if(typeof p.ovr!=='number'||p.ovr<1||p.ovr>100)err('PLAYER_OVR');
   if(p.contractV1!=null){validateContract(p.contractV1);if(p.contractV1.playerId!==key||p.contractV1.clubId!==String(c.id))err('CONTRACT_OWNER');}
  }
  for(const r of [...c.retired,...c.departed]){if(!object(r)||!id(r.id))err('HISTORY_RECORD');if(seen.has(id(r.id)))err('HISTORY_DUPLICATE');seen.add(id(r.id));}
 }
 if(new Set(world.usedPlayerIds.map(id)).size!==world.usedPlayerIds.length)err('USED_IDS_DUPLICATE');
 const known=new Set(world.usedPlayerIds.map(id));for(const p of activeIds)if(!known.has(p))err('UNTRACKED_PLAYER');for(const h of seen)if(!known.has(h)||activeIds.has(h))err('ARCHIVE_CONFLICT');
 for(const event of world.events)if(!object(event)||!Number.isInteger(event.season)||!['retirement','promotion','release','intake','emergency'].includes(event.type))err('EVENT');
 return true;
}
export function createYouthWorld({clubs,seed=0,season=1}={}){
 int(seed,0,0xffffffff,'SEED');int(season,1,500,'SEASON');if(!Array.isArray(clubs)||!clubs.length||clubs.length>250)err('CLUBS');
 const observed=new Set();let nextYouthSerial=1;
 const prepared=clubs.map(c=>{
  const members=clone(c.players??c.squad??[]),academy=clone(c.academy??[]);if(!Array.isArray(members)||!Array.isArray(academy))err('ROSTER');
  for(const p of [...members,...academy]){const key=id(p.id);if(observed.has(key))err('DUPLICATE_PLAYER');observed.add(key);if(p.clubId==null)p.clubId=String(c.id);}
  return {id:id(c.id),countryId:countryKey(c.countryId??c.country??c.nation),academyQuality:c.academyQuality??3,squadLimit:c.squadLimit??30,academyLimit:c.academyLimit??20,players:members,academy,retired:[],departed:[]};
 });
 const world={schemaVersion:1,seed,season,revision:0,nextYouthSerial,clubs:prepared,usedPlayerIds:[...observed],events:[]};validateYouthWorld(world);return world;
}
function freshYouth(world,club,season,options={},knownIds=null){
 let key,serial;
 const used=knownIds??new Set(world.usedPlayerIds);
 do {serial=world.nextYouthSerial++;key=`fa-y:${world.seed}:${serial}`;}while(used.has(key));
 world.usedPlayerIds.push(key);used.add(key);
 return createProspect({id:key,serial,clubId:club.id,countryId:club.countryId,season,seed:world.seed,...options});
}
function log(world,club,season,type,playerId,detail={}){world.events.push({season,type,clubId:club.id,playerId:String(playerId),...detail});}
export function createYouthContract(player,{season,clubId,annualWage}={}){
 const wage=annualWage??(Math.round((player.ovr??40)*12/50)*50);
 return makeContract({playerId:player.id,clubId,terms:makeTerms({startSeason:season,years:3,annualWage:wage,promisedRole:'prospect'})});
}
function promoteInPlace(world,club,player,season,kind='promotion'){
 if(club.players.length>=club.squadLimit)err('SQUAD_FULL');if(player.age<16)err('TOO_YOUNG');
 player.clubId=String(club.id);player.contractV1=createYouthContract(player,{season,clubId:club.id});
 club.players.push(player);log(world,club,season,kind,player.id);return player;
}
/** Explicit and atomic promotion, with concurrency guard, no double promotion. */
export function promoteProspect(world,{clubId,playerId,season=world.season,expectedRevision}={}){
 validateYouthWorld(world);if(expectedRevision!==undefined&&expectedRevision!==world.revision)err('STALE_REVISION');
 if(season!==world.season)err('SEASON_MISMATCH');const next=clone(world),club=next.clubs.find(c=>c.id===id(clubId));if(!club)err('CLUB_UNKNOWN');
 const index=club.academy.findIndex(p=>String(p.id)===id(playerId));if(index<0)err('PROSPECT_UNKNOWN');
 if(club.players.length>=club.squadLimit)err('SQUAD_FULL');const player=club.academy[index];if(player.age<16)err('TOO_YOUNG');
 club.academy.splice(index,1);promoteInPlace(next,club,player,season);next.revision++;validateYouthWorld(next);return next;
}
/** PLY06.04; existing legacy player OVR is untouched unless explicitly projected as a youth. */
export function developProspect(player,{season,seed=0,academyQuality=3,minutes=0,program='balanced'}={}){
 if(!object(player)||player.origin!=='PLY06-v1')err('NOT_YOUTH');int(academyQuality,1,5,'QUALITY');int(minutes,0,6000,'MINUTES');int(season,1,500,'SEASON');
 const d=player.developmentV1?clone(player.developmentV1):initialDevelopment(player,{seed,startSeason:season,countryId:player.nationality});
 if(d.lastSeason===season)return clone(player);
 if(d.lastSeason!==season-1)err('DEVELOPMENT_SEASON');
 const qualityWorkload=cap(43+(academyQuality-3)*9,20,80);
 const next=simulateDevelopmentSeason(d,player,{season,minutes,workload:qualityWorkload,program,form:50});
 // Dedicated coaching effect, *not* fictitious first-team minutes: invest in
 // positional training attributes with a capped +1 bonus per skill/year.
 const values={...next.attributes.values};
 const leading=Object.entries(POSITION_WEIGHTS[next.position]).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k])=>k);
 const changes=next.history.at(-1).changes;
 for(const key of leading){
  if(drawYouth('academy-coaching',seed,player.id,season,key)<0.08+0.07*(academyQuality-1)&&values[key]<100){
   const old=values[key];values[key]++;
   const previous=changes.find(x=>x.attribute===key);
   if(previous){previous.to++;previous.delta++;}else changes.push({attribute:key,from:old,to:old+1,delta:1});
  }
 }
 next.attributes=createAttributes(values,next.attributes.metadata);
 next.history.at(-1).rating=Math.round(rawPositionRating(values,next.position)*100)/100;
 next.history.at(-1).delta=Math.round((next.history.at(-1).rating-rawPositionRating(d.attributes.values,d.position))*100)/100;
 next.history.at(-1).reasons.push('academy_quality');
 validateDevelopment(next);
 const ovr=cap(Math.round(next.history.at(-1).rating),1,Math.max(player.ovr,player.potential));
 return {...clone(player),age:next.age,ovr,developmentV1:next,attributeProfile:clone(next.attributes)};
}
/** PLY06.02/03/05: all-club annual transition, no official world mutation. */
export function advanceYouthSeason(world,{season=world.season+1,minutesByPlayer={},fitnessByPlayer={},trainingByPlayer={},intakePerClub=4,minimumPlayers=18}={}){
 validateYouthWorld(world);if(season===world.season)return clone(world);if(season!==world.season+1)err('SEASON_SEQUENCE');
 int(intakePerClub,0,12,'INTAKE');int(minimumPlayers,11,40,'MINIMUM');const next=clone(world);const knownIds=new Set(next.usedPlayerIds);
 for(const club of next.clubs){
  if(minimumPlayers>club.squadLimit)err('MINIMUM_OVER_CAP');
  const keep=[];
  for(const original of club.players){
   const p=clone(original),minutes=minutesByPlayer[String(p.id)]??1200,fitness=fitnessByPlayer[String(p.id)]??65;
   const retiring=retirementDecision(p,{season,seed:next.seed,minutes,fitness});
   if(retiring.retire){club.retired.push(summaryRetired(p,season,club.id,'age_health_minutes'));log(next,club,season,'retirement',p.id,{chance:retiring.probability});}
   else {p.age=Math.min(100,p.age+1);keep.push(p);}
  }
  club.players=keep;
  const academy=[];
  for(const original of club.academy){
   const p=developProspect(original,{season,seed:next.seed,academyQuality:club.academyQuality,minutes:minutesByPlayer[String(original.id)]??0,program:trainingByPlayer[String(original.id)]??'balanced'});
   if(p.age>21){club.departed.push(summaryRetired(p,season,club.id,'academy_age_out'));log(next,club,season,'release',p.id);}
   else academy.push(p);
  }
  club.academy=academy;
  // Prepare first team before adding the year's intake. Prefer older academy graduates.
  const rank=(a,b)=>b.age-a.age||b.ovr-a.ovr||String(a.id).localeCompare(String(b.id));
  const promoteOne=(onlyKeeper=false)=>{
   const candidates=club.academy.filter(p=>p.age>=16&&(!onlyKeeper||p.position==='GK')).sort(rank);
   if(!candidates.length)return false;const p=candidates[0];club.academy.splice(club.academy.findIndex(x=>x.id===p.id),1);promoteInPlace(next,club,p,season);return true;
  };
  const hasGK=()=>club.players.some(p=>canonicalPosition(p.position)==='GK');
  if(!hasGK())promoteOne(true);
  while(club.players.length<minimumPlayers&&club.academy.some(p=>p.age>=16))promoteOne(false);
  let emergency=0;
  while(!hasGK()||club.players.length<minimumPlayers){
   if(emergency++>=minimumPlayers+2)err('EMERGENCY_LIMIT');
   const p=freshYouth(next,club,season,{emergency:true,position:hasGK()?mix[(emergency+season)%mix.length]:'GK'},knownIds);
   promoteInPlace(next,club,p,season,'emergency');
  }
  // Annual influx. No silent overwrites when academy is full.
  const openings=Math.min(intakePerClub,club.academyLimit-club.academy.length);
  for(let i=0;i<openings;i++){
   const p=freshYouth(next,club,season,{position:mix[(i+season+Number(hashYouth(club.id)%mix.length))%mix.length]},knownIds);
   club.academy.push(p);log(next,club,season,'intake',p.id);
  }
 }
 next.season=season;next.revision++;
 validateYouthWorld(next);
 return next;
}
export function auditYouthWorld(world,{minPlayers=11}={}){
 validateYouthWorld(world);int(minPlayers,11,50,'MINIMUM');
 const problems=[];for(const c of world.clubs){if(c.players.length<minPlayers)problems.push(`${c.id}:players`);if(!c.players.some(p=>p.position==='GK'))problems.push(`${c.id}:goalkeeper`);}
 return {season:world.season,clubs:world.clubs.length,firstTeam:world.clubs.reduce((n,c)=>n+c.players.length,0),academy:world.clubs.reduce((n,c)=>n+c.academy.length,0),retired:world.clubs.reduce((n,c)=>n+c.retired.length,0),departed:world.clubs.reduce((n,c)=>n+c.departed.length,0),ids:world.usedPlayerIds.length,approxJsonBytes:new TextEncoder().encode(JSON.stringify(world)).length,problems};
}
export function saveYouthJson(world){validateYouthWorld(world);return JSON.stringify(world);}
export function readYouthJson(text){if(typeof text!=='string'||text.length>60_000_000)err('IMPORT_SIZE');let data;try{data=JSON.parse(text);}catch{err('JSON');}validateYouthWorld(data);return data;}
