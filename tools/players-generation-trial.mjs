#!/usr/bin/env node
// PLAYERS-01 isolated in-memory generation trial; NO database, API or production writes.
// Run: node tools/players-generation-trial.mjs --count 1000 --seed fa-trial-01
// Validation: node tools/players-generation-trial.mjs --self-test
// Optional local-only JSON export: --out ./players-trial.json
// Target-first primary suitability (maximum 90): --primary-suitability 75 or 65:80 or auto.
// FIFA Men's World Ranking snapshot: 2026-10-07 (ranks 1-50).
// Source: https://inside.fifa.com/fifa-rankings/world-ranking/men?dateId=id121
// This temporary coverage fixture is NOT a production nationality probability distribution.
import {writeFileSync} from 'node:fs';
import {loadPlayerNamePools,sampleGivenName,sampleSurname} from './players-name-pools.mjs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const rawCountries = `
ESP|Spain|García,Ruiz,Fernández
ARG|Argentina|Fernández,Rodríguez,González
FRA|France|Laurent,Moreau,Dubois
ENG|England|Smith,Walker,Hughes
POR|Portugal|Silva,Costa,Ferreira
BRA|Brazil|Souza,Santos,Oliveira
MAR|Morocco|El Amrani,Benali,Idrissi
BEL|Belgium|Peeters,Janssens,De Smet
NED|Netherlands|De Vries,Van Dijk,Bakker
MEX|Mexico|Hernández,Martínez,Ramírez
COL|Colombia|Rodríguez,Restrepo,Gómez
SUI|Switzerland|Müller,Keller,Meier
GER|Germany|Müller,Schmidt,Weber
CRO|Croatia|Kovačić,Horvat,Babić
ITA|Italy|Rossi,Esposito,Conti
USA|United States|Johnson,Miller,Davis
JPN|Japan|Sato,Tanaka,Kobayashi
SEN|Senegal|Ndiaye,Diop,Sarr
NOR|Norway|Hansen,Berg,Nilsen
URU|Uruguay|Pereira,Silva,Olivera
DEN|Denmark|Nielsen,Jensen,Andersen
AUT|Austria|Gruber,Huber,Bauer
IRN|Iran|Hosseini,Rezaei,Mohammadi
ECU|Ecuador|Caicedo,Quintero,Valencia
EGY|Egypt|Hassan,Mahmoud,Ibrahim
AUS|Australia|Brown,Wilson,Taylor
CAN|Canada|Tremblay,Martin,Wong
ALG|Algeria|Benali,Boumediene,Mansouri
CIV|Côte d'Ivoire|Koné,Traoré,Kouassi
NGA|Nigeria|Okafor,Adeyemi,Obi
TUR|Türkiye|Yılmaz,Demir,Çelik
KOR|South Korea|Kim,Lee,Park
PAR|Paraguay|González,Rojas,Benítez
SWE|Sweden|Andersson,Lindberg,Eriksson
RUS|Russia|Ivanov,Smirnov,Petrov
UKR|Ukraine|Shevchenko,Kovalenko,Bondarenko
POL|Poland|Kowalski,Nowak,Zieliński
HUN|Hungary|Nagy,Kovács,Szabó
WAL|Wales|Jones,Thomas,Davies
COD|DR Congo|Mbuyi,Kabongo,Ilunga
GRE|Greece|Papadopoulos,Nikolaou,Georgiou
CMR|Cameroon|N'Koulou,Nkam,Aboubakar
SCO|Scotland|MacDonald,McGregor,Robertson
SRB|Serbia|Petrović,Jovanović,Marković
SVK|Slovakia|Novák,Kováč,Horváth
PAN|Panama|Rodríguez,Pérez,Castillo
MLI|Mali|Traoré,Coulibaly,Keita
RSA|South Africa|Mokoena,Ndlovu,Khumalo
VEN|Venezuela|González,Rodríguez,Hernández
CHI|Chile|González,Rojas,Muñoz`;
export const FIFA_SNAPSHOT = '2026-10-07';
export const COUNTRIES = Object.freeze(rawCountries.trim().split('\n').map((line,i)=>{
  const [code,name,demoLast] = line.trim().split('|');
  return Object.freeze({rank:i+1,code,name,demoLast:Object.freeze(demoLast.split(','))});
}));
const byCountry = new Map(COUNTRIES.map(c=>[c.code,c]));
// PLAYERS-03 is in main; SURNAMES-01 is loaded only if its catalog exists in this checkout.
// This module runs local research previews only, with no production-data writes.
const nationalNamePools=loadPlayerNamePools({expectedCodes:COUNTRIES.map(c=>c.code)});
const POSITIONS = 'GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' ');
export const ATTRIBUTES = 'speed strength stamina agility passing technique dribbling shooting crossing tackling marking heading vision positioning decisions composure gk_reflexes gk_handling gk_positioning gk_aerial'.split(' ');
const keeperAttributes = ATTRIBUTES.slice(16);
const profiles={
 RB:['speed stamina tackling crossing','marking positioning agility passing'],
 CB:['marking tackling heading strength','positioning composure decisions passing'],
 LB:['speed stamina tackling crossing','marking positioning agility passing'],
 RWB:['speed stamina crossing agility','tackling passing positioning dribbling'],
 LWB:['speed stamina crossing agility','tackling passing positioning dribbling'],
 DM:['tackling marking positioning passing','strength stamina decisions vision'],
 CM:['passing technique vision stamina','decisions positioning dribbling composure'],
 AM:['technique vision passing dribbling','shooting decisions agility composure'],
 RM:['speed crossing stamina dribbling','agility passing technique positioning'],
 LM:['speed crossing stamina dribbling','agility passing technique positioning'],
 RW:['speed dribbling agility technique','crossing shooting passing vision'],
 LW:['speed dribbling agility technique','crossing shooting passing vision'],
 ST:['shooting positioning composure heading','speed strength technique agility']
};
const positionCompatibility={
 GK:['','', ''],
 RB:['RWB','CB RM','LB LWB DM CM RW'],
 CB:['DM','RB LB','RWB LWB CM ST'],
 LB:['LWB','CB LM','RB RWB DM CM LW'],
 RWB:['RB RM','RW CM DM','LB LWB LM CB'],
 LWB:['LB LM','LW CM DM','RB RWB RM CB'],
 DM:['CM CB','RB LB AM','RWB LWB RM LM'],
 CM:['DM AM','RM LM','CB RB LB RWB LWB RW LW'],
 AM:['CM ST','RM LM RW LW','DM'],
 RM:['RWB RW','RB CM AM','DM LM LW ST'],
 LM:['LWB LW','LB CM AM','DM RM RW ST'],
 RW:['RM LW','AM ST','RWB CM LM RB'],
 LW:['LM RW','AM ST','LWB CM RM LB'],
 ST:['AM','RW LW','RM LM']
};
const footLeftPct={GK:20,RB:10,CB:20,LB:75,RWB:10,LWB:75,DM:20,CM:20,AM:25,RM:15,LM:65,RW:35,LW:45,ST:25};
const heightMeans={GK:189,RB:179,CB:186,LB:179,RWB:178,LWB:178,DM:182,CM:179,AM:176,RM:176,LM:176,RW:175,LW:175,ST:183};
const positionWeights={GK:9,RB:7,CB:15,LB:7,RWB:3,LWB:3,DM:9,CM:10,AM:7,RM:5,LM:5,RW:5,LW:5,ST:10};
const bands=[[1,29],[30,49],[50,69],[70,84],[85,99]];
const bandPercents={A:[4,16,42,30,8],B:[10,28,42,17,3],C:[22,39,30,8,1],D:[50,36,13,1,0]};
// Experimental V2 smoothing of output distributions; no persisted overall/ability field.
// Keep original role-conditioned draws but reduce same-player attribute scatter.
const coherenceMix=.60; // PLAYERS-02 proposed mild variety increase; pending owner numeric approval.
// PLAYERS-02: proposed stronger role-specific attribute tiers (A > B > C).
// Change role priorities, not statistical correlation coefficients; pending approval.
const coherenceOffsets={A:15,B:5,C:-8,D:-13};
const previousCoherenceOffsets={A:12,B:4,C:-5,D:-13}; // exact V6/prior 60% replay only
// PLAYERS-02 trial: the owner requests 5-10% of secondary-position players
// to have a better derived secondary fit. Test a 45/55 specialist/versatile
// population split against the historical approved 80/20 split; no third type.
// 55% is the lowest share tested with 5-10% exceptions in ALL THREE seeds.
const versatileShare=.55; // proposed, not numerically approved; Draft/HOLD
// Provisional continuous role-expression distribution, never a third category.
// This applies to skill VALUES, not to the derived suitability classification.
const roleExpression={mean:15,sd:12,maxAbs:35,maxAttributeShift:25};
const GENERATION_PROFILES=Object.freeze({
 specialist:Object.freeze({primary:.70,secondary:.30}),
 versatile:Object.freeze({primary:.50,secondary:.50})
});
const correlations=[['speed','agility',.30],['passing','vision',.35],['tackling','marking',.30],['dribbling','technique',.40],['shooting','composure',.25]];
// Explicit conservative automatic pair allowlist; every unlisted pair has 0% probability.
// The V6 trial includes high-confidence diaspora/migration links supported by
// official statistics (Istat, Destatis, ONS, Italian Ministry of Labour).
// Pair eligibility is NOT an assertion about citizenship law; numerical probabilities remain provisional.
const relatedPairs=[
 'ESP-POR','ESP-ARG','ESP-MEX','ESP-CHI','ESP-COL','ESP-URU','ESP-VEN','ESP-PAR','ESP-ECU','ESP-PAN','ESP-MAR','ARG-URU','ARG-PAR','ARG-ITA','ARG-CHI','BRA-POR','BRA-ITA','BRA-JPN','FRA-BEL','FRA-SUI','FRA-SEN','FRA-CMR','FRA-CIV','FRA-ALG','FRA-MAR','FRA-MLI','FRA-COD','FRA-POR','ENG-WAL','ENG-SCO','ENG-USA','ENG-AUS','ENG-CAN','ENG-RSA','ENG-NGA','GER-AUT','GER-SUI','GER-TUR','GER-POL','GER-GRE','NED-BEL','NED-TUR','MAR-ALG','MAR-BEL','SEN-MLI','NGA-CMR','KOR-JPN','KOR-USA','JPN-USA','SWE-NOR','SWE-DEN','RUS-UKR','CRO-SRB','POL-SVK','POL-UKR','AUS-GRE','CAN-USA','CAN-UKR','ITA-SUI','ITA-USA','ITA-URU','USA-MEX','USA-GRE','USA-IRN','USA-EGY','USA-PAN','IRN-GER','IRN-CAN','AUT-HUN','HUN-SVK','BEL-COD','COL-VEN','COL-ECU','TUR-AUT','TUR-BEL','ITA-GER','ITA-FRA','ITA-ENG','ITA-AUS','ITA-CAN','ITA-ESP','ITA-BEL','GER-CRO','ENG-POL','FRA-ESP','MAR-ITA','NGA-ITA','SEN-ITA','EGY-ITA','GER-SRB'
];
const related=new Set(relatedPairs.flatMap(pair=>{const [a,b]=pair.split('-');return [`${a}:${b}`,`${b}:${a}`]}));

// Deterministic random stream. NOT for security tokens or permanent database identifiers.
function seededRandom(seed){
 let h=2166136261;for(const ch of String(seed)){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}
 return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296};
}
function pick(items,rng){return items[Math.floor(rng()*items.length)]}
function weighted(items,weights,rng){
 if(!items.length||items.length!==weights.length||weights.some(w=>!(w>=0))||weights.every(w=>w===0))throw Error('Empty or invalid weighted choices');
 const total=weights.reduce((a,b)=>a+b,0),threshold=rng()*total;
 let running=0;for(let i=0;i<items.length;i++){running+=weights[i];if(threshold<running)return items[i]}
 return items.at(-1);
}
function gaussian(rng){return Math.sqrt(-2*Math.log(1-rng()))*Math.cos(2*Math.PI*rng())}
function normalCdf(x){
 const z=Math.abs(x),t=1/(1+0.2316419*z);
 const phi=Math.exp(-z*z/2)/Math.sqrt(2*Math.PI);
 const tail=phi*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
 return x>=0?1-tail:tail;
}
function normalWeights(lo,hi,mean,sd){return Array.from({length:hi-lo+1},(_,i)=>Math.exp(-.5*((lo+i-mean)/sd)**2))}
function validRange(spec,lo,hi){
 if(spec===undefined)return [lo,hi];
 if(Number.isInteger(spec)&&spec>=lo&&spec<=hi)return [spec,spec];
 if(Array.isArray(spec)&&spec.length===2&&spec.every(Number.isInteger)&&spec[0]>=lo&&spec[1]<=hi&&spec[0]<=spec[1])return spec;
 throw Error(`Invalid fixed value or inclusive range within ${lo}..${hi}`);
}
function discrete(rng,lo,hi,weights){return weighted(Array.from({length:hi-lo+1},(_,i)=>lo+i),weights,rng)}
function bandValue(priority,u,restriction){
 const [lo,hi]=validRange(restriction,1,99);
 const perValue=[];for(let x=lo;x<=hi;x++){
  const i=bands.findIndex(([a,b])=>x>=a&&x<=b);
  perValue.push(bandPercents[priority][i]/(bands[i][1]-bands[i][0]+1));
 }
 const total=perValue.reduce((a,b)=>a+b,0);let cumulative=0,threshold=u*total;
 for(let i=0;i<perValue.length;i++){cumulative+=perValue[i];if(threshold<cumulative)return lo+i}
 return hi;
}
// Mix the approved position-conditioned DISCRETE probability distributions.
// A player's 70/30 or 50/50 specialization applies consistently to all skills.
// Do not average generated attribute values.
function mixedRoleBandValue(primary,secondaries,primaryWeight,attr,u,restriction){
 const [lo,hi]=validRange(restriction,1,99);
 if(lo===hi)return lo;
 if(restriction!==undefined)
  return Math.min(hi,lo+Math.floor(u*(hi-lo+1))); // manual ranges uniformly sampled
 const components=[[primary,primaryWeight],...secondaries.map(p=>[p,
  (1-primaryWeight)/secondaries.length])];
 const probs=[];
 for(let x=lo;x<=hi;x++){
  const index=bands.findIndex(([a,b])=>x>=a&&x<=b);
  const width=bands[index][1]-bands[index][0]+1;
  probs.push(components.reduce((sum,[role,w])=>
   sum+w*bandPercents[attributePriority(role,attr)][index]/width,0));
 }
 const total=probs.reduce((sum,p)=>sum+p,0);
 let acc=0,threshold=u*total;
 for(let i=0;i<probs.length;i++){
  acc+=probs[i];
  if(threshold<acc)return lo+i;
 }
 return hi;
}
function attributePriority(role,attribute){
 if(role==='GK')return keeperAttributes.includes(attribute)?'A':(['agility','positioning','decisions','composure'].includes(attribute)?'B':'D');
 if(keeperAttributes.includes(attribute))return 'D';
 const [a,b]=profiles[role].map(s=>s.split(' '));return a.includes(attribute)?'A':b.includes(attribute)?'B':'C';
}
// The user-facing primary-position suitability contract. It is always derived
// from the final attributes; the selected target is trial-only generation input.
export function calculatePositionSuitability(attributes,position){
 if(!POSITIONS.includes(position))throw Error('Invalid suitability position');
 const essential=position==='GK'?keeperAttributes:profiles[position][0].split(' ');
 const support=position==='GK'?
  ['agility','positioning','decisions','composure']:profiles[position][1].split(' ');
 const average=keys=>keys.reduce((sum,key)=>sum+attributes[key],0)/keys.length;
 return .70*average(essential)+.30*average(support);
}
const PRIMARY_SUITABILITY_MAX=90; // approved hard cap on generated primary fit, NOT on skills
function choosePrimarySuitabilityTarget(spec,seed,index){
 const rng=seededRandom('primary-suitability:'+seed+':'+index);
 if(spec===undefined||spec==='automatic'||spec==='auto')
  // Match the measured previous trial scale (mean 60.5, SD 6.4) rather
  // than injecting an artificially wide new population-ability range.
  return Math.max(1,Math.min(PRIMARY_SUITABILITY_MAX,Math.round(61+7*gaussian(rng))));
 const [min,max]=validRange(spec,1,PRIMARY_SUITABILITY_MAX);
 return min===max?min:min+Math.floor(rng()*(max-min+1));
}
// Seed the desired ability BEFORE generating a player's numerical attributes.
// Then condition their role-specific attribute distribution by the *same*
// bounded additive offset on every automatic non-GK field attribute (or all
// attributes for goalkeepers). This preserves individual A/B/C contrasts,
// correlations, secondary role aptitude gaps and height tendencies as much as
// possible, instead of flattening the eight role-important traits.
// All the final numbers remain integers. Exact manual attributes and explicit
// attribute ranges stay locked, as they are in the legacy generator.
function conditionAttributesToPrimarySuitability(attributes,role,target,overrides){
 const original={...attributes};
 const free=ATTRIBUTES.filter(a=>
  !Object.prototype.hasOwnProperty.call(overrides??{},a)&&
  // GK heading is intentionally independent of height and of GK suitability.
  (role==='GK'?a!=='heading':!keeperAttributes.includes(a)));
 const clamp=x=>Math.max(1,Math.min(99,x));
 let best=null;
 for(let delta=-99;delta<=99;delta++){
  const trial={...original};
  for(const a of free)trial[a]=clamp(original[a]+delta);
  const result=calculatePositionSuitability(trial,role);
  const error=Math.abs(result-target);
  if(!best||error<best.error-1e-9||
   (Math.abs(error-best.error)<=1e-9&&Math.abs(delta)<Math.abs(best.delta)))
   best={delta,error,result,attributes:trial};
  if(error<1e-9)break;
 }
 if(!best||best.error>.500001)
  throw Error('Unattainable primary suitability '+target+' for '+role+
   ' with the requested manual attribute constraints');
 Object.assign(attributes,best.attributes);
 return best.result;
}
// Bounded height tendency: an exact or ranged custom attribute always wins.
function heightDelta(heightCm,center,pointsPerCm,limit){
 return Math.max(-limit,Math.min(limit,Math.round((heightCm-center)*pointsPerCm)));
}
// Emphasize existing role-specific skills with a continuous player-level latent
// style; do not force a given player into any suitability bucket. A separate
// RNG protects identity reproducibility. Preserve existing outfield skill spread.
function applyRoleExpression(role,roleMix,attributes,overrides){
 if(!roleMix?.secondaries?.length||roleMix.expressionEnabled===false)return;
 const field=ATTRIBUTES.slice(0,16);
 const automatic=field.filter(a=>!Object.prototype.hasOwnProperty.call(overrides??{},a));
 const roleWeight=(position,a)=>{
  const tier=attributePriority(position,a);
  return tier==='A'?0.70/4:tier==='B'?0.30/4:0;
 };
 const delta=Object.fromEntries(automatic.map(a=>[a,
  roleWeight(role,a)-roleMix.secondaries.reduce((sum,p)=>sum+roleWeight(p,a),0)/
   roleMix.secondaries.length
 ]));
 const norm=automatic.reduce((sum,a)=>sum+delta[a]**2,0);
 if(norm<1e-8)return; // Mirrored profiles with the same weights are genuinely equal.
 const rnd=seededRandom('positional-expression:'+roleMix.expressionSeed);
 const latent=Math.max(-roleExpression.maxAbs,Math.min(roleExpression.maxAbs,
  roleExpression.mean+roleExpression.sd*gaussian(rnd)));
 const initial=field.map(a=>attributes[a]);
 const originalSpread=Math.max(...initial)-Math.min(...initial);
 const temporary={};
 for(const a of automatic){
  const shift=Math.max(-roleExpression.maxAttributeShift,
   Math.min(roleExpression.maxAttributeShift,latent*delta[a]/norm));
  temporary[a]=Math.max(1,Math.min(99,attributes[a]+shift));
 }
 const newField=field.map(a=>temporary[a]??attributes[a]);
 const currentSpread=Math.max(...newField)-Math.min(...newField);
 const scale=currentSpread>originalSpread&&currentSpread>0?
  originalSpread/currentSpread:1;
 const mean=automatic.reduce((sum,a)=>sum+temporary[a],0)/automatic.length;
 for(const a of automatic)
  attributes[a]=Math.max(1,Math.min(99,Math.round(mean+scale*(temporary[a]-mean))));
}
// A-tier skills should rank among a footballer's strongest skills, relative to
// their own A+B values, not an absolute skill minimum or a suitability quota.
// Keep more variation where secondary roles contribute to the footballer's build.
const roleCoreFloorMargins=Object.freeze({primary_only:6,specialist:10,versatile:12});
function reinforceEssentialRoleAttributes(role,attributes,overrides,roleMix){
 if(!roleMix?.coreFloorEnabled)return;
 const essential=role==='GK'?keeperAttributes:profiles[role][0].split(' ');
 const supporting=role==='GK'?
  ['agility','positioning','decisions','composure']:profiles[role][1].split(' ');
 const sorted=[...essential,...supporting].map(a=>attributes[a]).sort((a,b)=>a-b);
 const median=(sorted[3]+sorted[4])/2;
 const profile=roleMix.secondaries.length?
  (roleMix.primaryWeight>.5?'specialist':'versatile'):'primary_only';
 const minimum=Math.max(1,Math.min(99,Math.round(median-roleCoreFloorMargins[profile])));
 for(const attribute of essential){
  if(Object.prototype.hasOwnProperty.call(overrides??{},attribute))continue;
  attributes[attribute]=Math.max(attributes[attribute],minimum);
 }
}
function smoothAutomaticAttributes(role,attributes,overrides,heightCm,trialCoherenceMix=coherenceMix,roleOffsets=coherenceOffsets,roleMix=null){
 const field=ATTRIBUTES.slice(0,16);
 const fieldMean=field.reduce((sum,a)=>sum+attributes[a],0)/field.length;
 const keeperMean=keeperAttributes.reduce((sum,a)=>sum+attributes[a],0)/keeperAttributes.length;
 for(const a of ATTRIBUTES){
  // Explicit exact values or inclusive ranges must always win.
  if(Object.prototype.hasOwnProperty.call(overrides??{},a))continue;
  const raw=attributes[a];
  if(keeperAttributes.includes(a)){
   if(role!=='GK'){
    // Outfield footballers receive strictly low auto-generated keeper attributes (1–15).
    attributes[a]=1+Math.floor((raw-1)*14/98);
   }else{
    // GK specialties are A-tier too; keep old V6/prior-60% replay unchanged
    // and add only the proposed A-tier increase for newly generated keepers.
    const goalkeeperTierDelta=trialCoherenceMix*(roleOffsets.A-previousCoherenceOffsets.A);
    attributes[a]=Math.max(1,Math.min(99,
     Math.round((1-trialCoherenceMix)*raw+trialCoherenceMix*keeperMean+goalkeeperTierDelta)));
   }
  }else{
   const primaryOffset=roleOffsets[attributePriority(role,a)];
   const secondaryOffset=roleMix?.secondaries.length?
    roleMix.secondaries.reduce((sum,p)=>sum+roleOffsets[attributePriority(p,a)],0)/
     roleMix.secondaries.length:primaryOffset;
   const center=fieldMean+(roleMix?roleMix.primaryWeight*primaryOffset+
    (1-roleMix.primaryWeight)*secondaryOffset:primaryOffset);
   attributes[a]=Math.max(1,Math.min(99,Math.round((1-trialCoherenceMix)*raw+trialCoherenceMix*center)));
  }
 }
 applyRoleExpression(role,roleMix,attributes,overrides);
 // Preserve height-dependent heading and GK aerial effects after this step.
 reinforceEssentialRoleAttributes(role,attributes,overrides,roleMix);
 // A moderate height effect on heading for outfield players; skill still depends on
 // the position-conditioned draw. GK heading is deliberately unaffected.
 if(role!=='GK'&&!Object.prototype.hasOwnProperty.call(overrides??{},'heading')){
  const modifier=heightDelta(heightCm,180,.4,10);
  attributes.heading=Math.max(1,Math.min(99,attributes.heading+modifier));
 }
 // Moderate height-to-aerial-reach influence only for actual goalkeepers.
 if(role==='GK'&&!Object.prototype.hasOwnProperty.call(overrides??{},'gk_aerial')){
  attributes.gk_aerial=Math.max(1,Math.min(99,
   attributes.gk_aerial+heightDelta(heightCm,189,.5,10)));
 }
 // Weak height-to-strength influence for all positions.
 if(!Object.prototype.hasOwnProperty.call(overrides??{},'strength')){
  attributes.strength=Math.max(1,Math.min(99,
   attributes.strength+heightDelta(heightCm,180,.15,4)));
 }
 return attributes;
}
function attributeUniforms(rng){
 const result={};for(const [a,b,spearman] of correlations){
  const latent=2*Math.sin(Math.PI*spearman/6),z=gaussian(rng),v=gaussian(rng);
  result[a]=normalCdf(z);result[b]=normalCdf(latent*z+Math.sqrt(1-latent*latent)*v);
 }
 for(const a of ATTRIBUTES)if(result[a]===undefined)result[a]=rng();
 return result;
}
function invertedFootTarget(role,foot){
 return ({'LB:right':'RB','RB:left':'LB','LWB:right':'RWB','RWB:left':'LWB'})[`${role}:${foot}`];
}
function secondaryWeight(role,secondary,foot){
 const triple=positionCompatibility[role];let weight=0;
 for(const [idx,w] of [4,2,1].entries())if(triple[idx].split(' ').includes(secondary))weight=w;
 if(weight>0&&secondary===invertedFootTarget(role,foot))weight*=3;
 return weight;
}
function secondaryPositions(role,foot,rng,options){
 if(role==='GK'&&options.secondaryCount!==undefined&&options.secondaryCount!==0)throw Error('Secondary-position count impossible with role restrictions');
 const all=POSITIONS.filter(s=>s!==role&&secondaryWeight(role,s,foot)>0&&(options.allowedSecondaries===undefined||options.allowedSecondaries.includes(s)));
 if(options.secondaryPositions!==undefined){
  if(!Array.isArray(options.secondaryPositions)||new Set(options.secondaryPositions).size!==options.secondaryPositions.length||options.secondaryPositions.length>5||options.secondaryPositions.some(s=>!all.includes(s)))throw Error('Invalid manually requested secondary positions');
  return [...options.secondaryPositions];
 }
 const count=role==='GK'?0:(options.secondaryCount===undefined?
  weighted([0,1,2,3,4,5].filter(n=>n<=all.length),[25,35,25,11,3.5,.5].slice(0,Math.min(5,all.length)+1),rng):options.secondaryCount);
 if(!Number.isInteger(count)||count<0||count>5||count>all.length)throw Error('Secondary-position count impossible with role restrictions');
 const candidates=[...all],out=[];
 for(let i=0;i<count;i++){
  const selected=weighted(candidates,candidates.map(s=>secondaryWeight(role,s,foot)),rng);
  out.push(selected);candidates.splice(candidates.indexOf(selected),1);
 }
 return out;
}
function secondaryNationality(country,rng,options){
 if(options.secondaryNationality==='none')return null;
 // An explicit nonempty allowed set always provides one secondary country.
 if(Array.isArray(options.secondaryNationality)){
  const allowed=options.secondaryNationality;
  if(!allowed.length||new Set(allowed).size!==allowed.length||
    allowed.some(code=>!byCountry.has(code)||code===country))
   throw Error('Invalid allowed secondary nationalities');
  return pick(allowed,rng);
 }
 if(options.secondaryNationality&&options.secondaryNationality!=='automatic'){
  if(!byCountry.has(options.secondaryNationality)||options.secondaryNationality===country)throw Error('Invalid exact secondary nationality');
  return options.secondaryNationality;
 }
 if(rng()>=.10)return null;
 // Explicit allowlist only: unlisted secondary nationalities have zero probability.
 const choices=COUNTRIES.filter(c=>c.code!==country&&related.has(`${country}:${c.code}`));
 return choices.length?pick(choices,rng).code:null;
}
/**
 * PLAYERS-GEN-DUAL-NAME-01, conditional on a second nationality:
 * both automatic: PP 50%, SP 15%, PS 25%, SS 10%.
 * only first automatic: 25% secondary; only surname automatic: 35% secondary.
 */
export function selectDualNameOrigins(hasSecondary,firstManual,lastManual,draw){
 const primary={first:'primary',last:'primary'};
 if(!hasSecondary||(firstManual&&lastManual))return primary;
 if(typeof draw!=='number'||!Number.isFinite(draw)||draw<0||draw>=1)
  throw Error('Invalid dual-nationality name draw');
 if(firstManual)return {first:'primary',last:draw<.35?'secondary':'primary'};
 if(lastManual)return {first:draw<.25?'secondary':'primary',last:'primary'};
 if(draw<.50)return primary;
 if(draw<.65)return {first:'secondary',last:'primary'};
 if(draw<.90)return {first:'primary',last:'secondary'};
 return {first:'secondary',last:'secondary'};
}
function generateCandidate(rng,index,options,trialSeed){
 const eligible=options.allowedPositions||POSITIONS;
 if(!Array.isArray(eligible)||!eligible.length||eligible.some(p=>!POSITIONS.includes(p)))throw Error('Invalid allowed primary positions');
 const position=options.primaryPosition??weighted(eligible,eligible.map(p=>positionWeights[p]),rng);
 if(!eligible.includes(position))throw Error('Primary position not in allowed set');
 // Round-robin across the frozen top 50 is a TEST COVERAGE PLAN, not an approved sampling distribution.
 const country=options.primaryNationality??COUNTRIES[index%COUNTRIES.length].code;
 if(!byCountry.has(country))throw Error('Primary nationality outside test top 50');
 const bank=byCountry.get(country);
 // Preserve the original RNG draws and choose final name sources after the
 // second nationality is known, with a separate seeded per-player stream.
 const primaryFirst=options.firstName??sampleGivenName(nationalNamePools,country,rng);
 const primaryLast=options.lastName??sampleSurname(nationalNamePools,country,rng,bank.demoLast);
 if(!primaryFirst||!primaryLast||typeof primaryFirst!=='string'||typeof primaryLast!=='string')
  throw Error('First and last names required');
 const [ageLo,ageHi]=validRange(options.age,16,19);
 const age=discrete(rng,ageLo,ageHi,[30,35,20,15].slice(ageLo-16,ageHi-15));
 const foot=options.preferredFoot??(rng()*100<footLeftPct[position]?'left':'right');
 if(!['left','right'].includes(foot))throw Error('Invalid preferred foot');
 const secondaries=secondaryPositions(position,foot,rng,options);
 // Assign one stable per-footballer model, not a new role for each attribute.
 // A separate deterministic PRNG preserves the old candidate identity stream.
 const legacy=options.experimentalLegacySecondaryModel===true;
 const profile=secondaries.length?
  (seededRandom('secondary-affinity:'+trialSeed+':'+index)()<
   (options.experimentalVersatileShare??versatileShare)?'versatile':'specialist'):
  'primary_only';
 const primaryWeight=secondaries.length?GENERATION_PROFILES[profile].primary:1;
 // A selected target exists before any numerical football attribute is drawn.
 const useSuitabilityTarget=!legacy&&options.experimentalPrimarySuitabilityModel!==false;
 const primarySuitabilityTarget=useSuitabilityTarget?
  choosePrimarySuitabilityTarget(options.primarySuitability,trialSeed,index):null;
 const [hlo,hhi]=validRange(options.height,160,205);
 const height=discrete(rng,hlo,hhi,normalWeights(hlo,hhi,heightMeans[position],position==='ST'?8:7));
 const [dlo,dhi]=validRange(options.developmentAptitude,1,99);
 const aptitude=discrete(rng,dlo,dhi,normalWeights(dlo,dhi,47,21));
 const u=attributeUniforms(rng),attributes={};
 for(const a of ATTRIBUTES){
  // Consume old RNG draws so names/nationalities stay exactly replayable.
  const legacyRole=secondaries.length&&rng()>=.65?pick(secondaries,rng):position;
  if(legacy)attributes[a]=bandValue(attributePriority(legacyRole,a),u[a],options.attributes?.[a]);
  else{
   attributes[a]=mixedRoleBandValue(position,secondaries,primaryWeight,
    a,u[a],options.attributes?.[a]);
  }
 }
 const roleMix=legacy?null:{primaryWeight,secondaries,
  expressionSeed:trialSeed+':'+index,
  expressionEnabled:options.experimentalRoleExpression!==false,
  coreFloorEnabled:options.experimentalRoleCoreFloor!==false};
 smoothAutomaticAttributes(position,attributes,options.attributes,height,
  options.experimentalCoherenceMix,options.experimentalRoleOffsets??coherenceOffsets,roleMix);
 const actualPrimarySuitability=useSuitabilityTarget?
  conditionAttributesToPrimarySuitability(attributes,position,
   primarySuitabilityTarget,options.attributes):null;
 const secondary=secondaryNationality(country,rng,options);
 const nameRng=seededRandom('dual-name:'+trialSeed+':'+index);
 const firstManual=options.firstName!=null,lastManual=options.lastName!=null;
 const origins=selectDualNameOrigins(Boolean(secondary),firstManual,lastManual,
  secondary&&(!firstManual||!lastManual)?nameRng():0);
 const first=origins.first==='secondary'?
  sampleGivenName(nationalNamePools,secondary,nameRng):primaryFirst;
 const last=origins.last==='secondary'?
  sampleSurname(nationalNamePools,secondary,nameRng,byCountry.get(secondary).demoLast):primaryLast;
 const candidate={
  preview_id:`trial-${String(index+1).padStart(4,'0')}`,
  // Permanent id and authoritative entry_season exist only after final confirmation; this tool never persists.
  first_name:first,last_name:last,display_name:`${first} ${last}`,
  initial_age:age,nationality:country,secondary_nationality:secondary,
  height_cm:height,preferred_foot:foot,primary_position:position,secondary_positions:secondaries,
  attributes,development_aptitude:aptitude,career_status:'active'
 };
 // Calibration metrics remain readable for QA in memory, but are deliberately
 // non-enumerable: no specialist/versatile classification or trial target ever
 // appears in JSON.stringify(candidate) or the generator's --out JSON.
 if(!legacy)Object.defineProperty(candidate,'trial_role_profile',{value:profile});
 if(useSuitabilityTarget)Object.defineProperties(candidate,{
  trial_primary_suitability_target:{value:primarySuitabilityTarget},
  trial_primary_suitability_actual:{value:Math.round(actualPrimarySuitability*100)/100}
 });
 return candidate;
}
export function generateTrial(options={}){
 const count=options.count??100,seed=options.seed??'fa-players-01';
 if(!Number.isInteger(count)||count<1||count>1000)throw Error('Count must be an integer from 1 to 1000');
 if(typeof seed!=='string'||!seed.length)throw Error('Seed must be a nonempty string');
 if(options.attributes&&(typeof options.attributes!=='object'||Object.keys(options.attributes).some(k=>!ATTRIBUTES.includes(k))))throw Error('Invalid attribute override');
 if(options.primarySuitability!==undefined&&options.primarySuitability!=='auto'&&
  options.primarySuitability!=='automatic')validRange(options.primarySuitability,1,PRIMARY_SUITABILITY_MAX);
 if(options.experimentalPrimarySuitabilityModel!==undefined&&
   typeof options.experimentalPrimarySuitabilityModel!=='boolean')
  throw Error('Invalid experimentalPrimarySuitabilityModel: expected boolean');
 if(options.primarySuitability!==undefined&&
   (options.experimentalPrimarySuitabilityModel===false||
    options.experimentalLegacySecondaryModel===true))
  throw Error('Primary suitability cannot be specified in legacy replay mode');
 // Explicit old-V6 replay is for in-memory diagnostics only; CLI never exposes it.
 if(options.experimentalCoherenceMix!==undefined&&
    (typeof options.experimentalCoherenceMix!=='number'||!Number.isFinite(options.experimentalCoherenceMix)||
      options.experimentalCoherenceMix<0||options.experimentalCoherenceMix>1))
   throw Error('Invalid experimental coherence mix: expected finite 0..1');
 if(options.experimentalLegacySecondaryModel!==undefined &&
   typeof options.experimentalLegacySecondaryModel!=='boolean')
   throw Error('Invalid experimentalLegacySecondaryModel: expected boolean');
 if(options.experimentalVersatileShare!==undefined &&
   (typeof options.experimentalVersatileShare!=='number' ||
    !Number.isFinite(options.experimentalVersatileShare) ||
    options.experimentalVersatileShare<0 || options.experimentalVersatileShare>1))
   throw Error('Invalid experimentalVersatileShare: expected finite 0..1');
 if(options.experimentalRoleExpression!==undefined &&
    typeof options.experimentalRoleExpression!=='boolean')
   throw Error('Invalid experimentalRoleExpression: expected boolean');
 if(options.experimentalRoleCoreFloor!==undefined &&
    typeof options.experimentalRoleCoreFloor!=='boolean')
   throw Error('Invalid experimentalRoleCoreFloor: expected boolean');
 // This override exists only for seeded in-memory comparison, never production/CLI input.
 if(options.experimentalRoleOffsets!==undefined){
  const offsets=options.experimentalRoleOffsets;
  if(!offsets||typeof offsets!=='object'||Array.isArray(offsets)||
   Object.keys(offsets).sort().join(',')!=='A,B,C,D'||
   Object.values(offsets).some(v=>!Number.isInteger(v)||v < -30||v > 30))
   throw Error('Invalid experimentalRoleOffsets: expected A/B/C/D integer values between -30 and 30');
 }
 const rng=seededRandom(seed),candidates=[];
 for(let i=0;i<count;i++)candidates.push(generateCandidate(rng,i,options,seed));
 return {trial_only:true,persisted:false,ranking_snapshot:FIFA_SNAPSHOT,seed,count,
  identity_sources:{given_names:'PLAYERS-03 weighted catalog',
   surnames:nationalNamePools.surnameSource},candidates};
}
export function summarize(trial){
 const groups={countries:{},positions:{},ages:{},secondaryCounts:{},secondNationalities:0};
 for(const p of trial.candidates){
  for(const [key,value] of [['countries',p.nationality],['positions',p.primary_position],['ages',p.initial_age],['secondaryCounts',p.secondary_positions.length]])groups[key][value]=(groups[key][value]||0)+1;
  if(p.secondary_nationality)groups.secondNationalities++;
 }
 return {count:trial.count,seed:trial.seed,snapshot:trial.ranking_snapshot,distinct_countries:Object.keys(groups.countries).length,secondary_nationalities:groups.secondNationalities,countries:groups.countries,positions:groups.positions,ages:groups.ages,secondary_counts:groups.secondaryCounts};
}
function spearman(xs,ys){
 const rank=a=>{const indexed=a.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),r=[];let i=0;while(i<indexed.length){let j=i+1;while(j<indexed.length&&indexed[j][0]===indexed[i][0])j++;const mid=(i+j+1)/2;for(let k=i;k<j;k++)r[indexed[k][1]]=mid;i=j;}return r;};
 const x=rank(xs),y=rank(ys),mx=x.reduce((a,b)=>a+b,0)/x.length,my=y.reduce((a,b)=>a+b,0)/y.length;
 let xy=0,xx=0,yy=0;for(let i=0;i<x.length;i++){xy+=(x[i]-mx)*(y[i]-my);xx+=(x[i]-mx)**2;yy+=(y[i]-my)**2;}return xy/Math.sqrt(xx*yy);
}
export function selfTest(){
 assert.equal(COUNTRIES.length,50);assert.equal(new Set(COUNTRIES.map(c=>c.code)).size,50);
 assert.equal(COUNTRIES[0].code,'ESP');assert.equal(COUNTRIES.at(-1).code,'CHI');
 assert.equal(ATTRIBUTES.length,20);assert.equal(Object.values(positionWeights).reduce((a,b)=>a+b),100);
 for(const p of POSITIONS){
  const fields=POSITIONS.filter(q=>q!==p);
  for(const q of fields){const w=secondaryWeight(p,q,'right');assert.ok([0,1,2,3,4,6,12].includes(w));}
  assert.equal(secondaryWeight(p,p,'right'),0);
 }
 for(const [p,q] of [['RWB','AM'],['LWB','AM'],['AM','RWB'],['AM','LWB'],['ST','CM'],['CM','ST']])assert.equal(secondaryWeight(p,q,'right'),0);
 assert.equal(secondaryWeight('LB','RB','right'),3);assert.equal(secondaryWeight('LB','LWB','right'),4);
 assert.equal(secondaryWeight('GK','ST','left'),0);
 const sample=generateTrial({count:1000,seed:'fa-official-trial-01'});
 assert.deepEqual(sample,generateTrial({count:1000,seed:'fa-official-trial-01'}));
 assert.notDeepEqual(sample,generateTrial({count:1000,seed:'fa-official-trial-02'}));
 // Same RNG sequence, player identities and approved hard caps; only smoothed values differ.
 const oldV6=generateTrial({count:1000,seed:'fa-official-trial-01',
  experimentalCoherenceMix:.65,experimentalRoleOffsets:previousCoherenceOffsets,experimentalLegacySecondaryModel:true});
 const prior60=generateTrial({count:1000,seed:'fa-official-trial-01',
  experimentalRoleOffsets:previousCoherenceOffsets,experimentalLegacySecondaryModel:true});
 const previousTiers=generateTrial({count:1000,seed:'fa-official-trial-01',
  experimentalLegacySecondaryModel:true});
 const spread=t=>{
  const field=ATTRIBUTES.slice(0,16);
  return t.candidates.reduce((sum,p)=>{
   const values=field.map(k=>p.attributes[k]);return sum+Math.max(...values)-Math.min(...values);
  },0)/t.count;
 };
 assert.ok(spread(sample)>spread(oldV6),'New role tiers should remain more varied than V6');
 assert.ok(spread(previousTiers)>spread(prior60),'Old tier offsets are more differentiated');
 assert.ok(spread(sample)<50,'New mixture must not lose all within-player coherence');
 assert.throws(()=>generateTrial({experimentalLegacySecondaryModel:'yes'}),
  /Invalid experimentalLegacySecondaryModel/);
 assert.throws(()=>generateTrial({experimentalRoleOffsets:{A:12,B:4,C:-5}}),/Invalid experimentalRoleOffsets/);
 assert.throws(()=>generateTrial({experimentalRoleOffsets:{A:12,B:4,C:-5,D:42}}),/Invalid experimentalRoleOffsets/);
 for(let i=0;i<sample.count;i++){
  const {attributes:newAttributes,trial_role_profile,
   trial_primary_suitability_target:target,trial_primary_suitability_actual:actual,
   ...newIdentity}=sample.candidates[i];
  assert.ok(Number.isInteger(target)&&target>=1&&target<=90);
  assert.ok(Math.abs(calculatePositionSuitability(newAttributes,newIdentity.primary_position)-target)<=.500001);
  assert.ok(Math.abs(actual-target)<=.500001);
  const {attributes:oldAttributes,...oldIdentity}=oldV6.candidates[i];
  assert.deepEqual(newIdentity,oldIdentity,'Only generated attributes and trial-only profile may differ');
  const {attributes:old60Attributes,...priorIdentity}=prior60.candidates[i];
  assert.deepEqual(newIdentity,priorIdentity,'Legacy 60% and new profiles must share identities');
  const {attributes:olderTierAttributes,...olderTierIdentity}=previousTiers.candidates[i];
  assert.deepEqual(newIdentity,olderTierIdentity,'Old role-tier trial has matching nonattribute data');
  assert.ok(newIdentity.secondary_positions.length?
   ['specialist','versatile'].includes(trial_role_profile):trial_role_profile==='primary_only');
  assert.ok(Object.values(newAttributes).every(v=>Number.isInteger(v)&&v>=1&&v<=99));
  if(newIdentity.primary_position!=='GK')
   for(const k of keeperAttributes)assert.ok(newAttributes[k]<=15);
 }
 assert.throws(()=>generateTrial({experimentalCoherenceMix:1.1}),/Invalid experimental coherence mix/);
 assert.throws(()=>generateTrial({experimentalCoherenceMix:NaN}),/Invalid experimental coherence mix/);
 const withSecondaries=sample.candidates.filter(p=>p.secondary_positions.length);
 const versatileShare=withSecondaries.filter(p=>p.trial_role_profile==='versatile').length/withSecondaries.length;
 assert.ok(versatileShare>.48&&versatileShare<.64,
  'Versatile share should be close to provisional 55%');
 const oldProfileRatio=generateTrial({count:1000,seed:'fa-official-trial-01',
  experimentalVersatileShare:.20});
 const old20=oldProfileRatio.candidates.filter(p=>p.secondary_positions.length);
 const oldShare=old20.filter(p=>p.trial_role_profile==='versatile').length/old20.length;
 assert.ok(oldShare>.12&&oldShare<.28,'Explicit old 20% share must remain replayable');
 for(let i=0;i<sample.count;i++){
  const {attributes:ignoredA,trial_role_profile:ignoredProfileA,
   trial_primary_suitability_target:targetA,trial_primary_suitability_actual:actualA,
   ...newIdentity}=sample.candidates[i];
  const {attributes:ignoredB,trial_role_profile:ignoredProfileB,
   trial_primary_suitability_target:targetB,trial_primary_suitability_actual:actualB,
   ...oldIdentity}=oldProfileRatio.candidates[i];
  assert.equal(targetA,targetB);
  assert.deepEqual(newIdentity,oldIdentity,'Versatility tuning must change only attributes and trial profile');
 }
 assert.throws(()=>generateTrial({experimentalVersatileShare:-.1}),
  /Invalid experimentalVersatileShare/);
 assert.throws(()=>generateTrial({experimentalVersatileShare:1.01}),
  /Invalid experimentalVersatileShare/);
 assert.throws(()=>generateTrial({experimentalVersatileShare:NaN}),
  /Invalid experimentalVersatileShare/);
 const priorCohort=generateTrial({count:1000,seed:'fa-official-trial-01',
  experimentalPrimarySuitabilityModel:false});
 const priorProfile=generateTrial({count:1000,seed:'fa-official-trial-01',
  experimentalRoleExpression:false,experimentalPrimarySuitabilityModel:false});
 for(let i=0;i<sample.count;i++){
  const {attributes:newSkills,...newMeta}=priorCohort.candidates[i];
  const {attributes:oldSkills,...oldMeta}=priorProfile.candidates[i];
  assert.deepEqual(newMeta,oldMeta,
   'Role expression must not change player identity or profile membership');
 }
 assert.notDeepEqual(priorCohort,priorProfile);
 assert.throws(()=>generateTrial({experimentalRoleExpression:'yes'}),
  /Invalid experimentalRoleExpression/);
 // Compare the exact same 1,000 player identities with/without the A-core
 // floor: only essential auto-generated attributes may rise, for every role.
 const noCoreFloor=generateTrial({count:1000,seed:'fa-official-trial-01',
  experimentalRoleCoreFloor:false,experimentalPrimarySuitabilityModel:false});
 const adjustedRoles=new Set();
 for(let i=0;i<sample.count;i++){
  const p=priorCohort.candidates[i],q=noCoreFloor.candidates[i];
  const {attributes:newSkills,...identityNew}=p;
  const {attributes:oldSkills,...identityOld}=q;
  assert.deepEqual(identityNew,identityOld,'Core floor must not change candidate identity or type');
  const core=p.primary_position==='GK'?keeperAttributes:profiles[p.primary_position][0].split(' ');
  for(const a of ATTRIBUTES){
   if(core.includes(a)){
    assert.ok(p.attributes[a]>=q.attributes[a],'Essential skills must never decrease');
    if(p.attributes[a]>q.attributes[a])adjustedRoles.add(p.primary_position);
   }else assert.equal(p.attributes[a],q.attributes[a],
    'Core balancing must not alter support/peripheral or outfield GK skills');
  }
 }
 assert.equal(adjustedRoles.size,POSITIONS.length,'Core balancing must affect all 14 roles');
 assert.equal(priorCohort.candidates[142].preview_id,'trial-0143');
 assert.equal(priorCohort.candidates[142].primary_position,'ST');
 assert.ok(priorCohort.candidates[142].attributes.shooting>=62,
  'Pure ST with high relevant values must no longer have shooting 48');
 const manualShooting=generateTrial({count:1,seed:'manual-A-control',
  primaryPosition:'ST',secondaryCount:0,attributes:{shooting:48}});
 assert.equal(manualShooting.candidates[0].attributes.shooting,48,
  'Manual exact attributes override any automatic role-core balancing');
 assert.throws(()=>generateTrial({experimentalRoleCoreFloor:'yes'}),
  /Invalid experimentalRoleCoreFloor/);
 const exact=generateTrial({count:20,seed:'exact-75',primaryPosition:'ST',
  primarySuitability:75});
 const maximum=generateTrial({count:10,seed:'exact-90',primaryPosition:'ST',
  primarySuitability:90});
 assert.ok(maximum.candidates.every(p=>p.trial_primary_suitability_target===90));
 assert.ok(exact.candidates.every(p=>
  p.trial_primary_suitability_target===75&&
  Math.abs(calculatePositionSuitability(p.attributes,'ST')-75)<=.500001));
 const ranged=generateTrial({count:50,seed:'range-65-80',
  primarySuitability:[65,80]});
 assert.ok(ranged.candidates.every(p=>
  p.trial_primary_suitability_target>=65&&p.trial_primary_suitability_target<=80&&
  Math.abs(calculatePositionSuitability(p.attributes,p.primary_position)-
   p.trial_primary_suitability_target)<=.500001));
 for(const role of POSITIONS){
  for(const target of [1,40,75,90]){
   const x=generateTrial({count:1,seed:'extreme-'+role+'-'+target,
    primaryPosition:role,primarySuitability:target}).candidates[0];
   assert.ok(Math.abs(calculatePositionSuitability(x.attributes,role)-target)<=.500001,
    'Exact '+target+' failed for '+role);
   if(role!=='GK')for(const a of keeperAttributes)assert.ok(x.attributes[a]<=15);
  }
 }
 assert.throws(()=>generateTrial({primarySuitability:0}),/Invalid fixed/);
 assert.throws(()=>generateTrial({primarySuitability:91}),/Invalid fixed/);
 assert.throws(()=>generateTrial({primarySuitability:99}),/Invalid fixed/);
 assert.throws(()=>generateTrial({primarySuitability:[89,91]}),/Invalid fixed/);
 assert.throws(()=>generateTrial({primarySuitability:[90,90.5]}),/Invalid fixed/);
 assert.throws(()=>generateTrial({primarySuitability:[80,65]}),/Invalid fixed/);
 assert.throws(()=>generateTrial({primarySuitability:'75'}),/Invalid fixed/);
 assert.throws(()=>generateTrial({experimentalPrimarySuitabilityModel:'yes'}),
  /Invalid experimentalPrimarySuitabilityModel/);
 assert.throws(()=>generateTrial({primarySuitability:75,
  experimentalPrimarySuitabilityModel:false}),/cannot be specified/);
 assert.throws(()=>generateTrial({count:1,primaryPosition:'ST',primarySuitability:90,
  attributes:{shooting:1,positioning:1,composure:1,heading:1}}),
  /Unattainable primary suitability/);
 const manualValue=generateTrial({count:1,seed:'manual-fit',primaryPosition:'ST',
  primarySuitability:75,attributes:{shooting:48}}).candidates[0];
 assert.equal(manualValue.attributes.shooting,48);
 assert.ok(Math.abs(calculatePositionSuitability(manualValue.attributes,'ST')-75)<=.500001);
 const oldCohort=generateTrial({count:1000,seed:'fa-official-trial-01',
  experimentalPrimarySuitabilityModel:false});
 assert.deepEqual(oldCohort,priorCohort,'The previous generator must replay exactly');
 assert.ok(withSecondaries.every(p=>['specialist','versatile'].includes(p.trial_role_profile)));
 assert.ok(generateTrial({count:10,primaryPosition:'GK'}).candidates.every(
  p=>p.trial_role_profile==='primary_only'));
 const forced=generateTrial({count:100,seed:'secondary-role-smoke',
  primaryPosition:'ST',secondaryPositions:['AM']});
 assert.ok(forced.candidates.every(p=>p.primary_position==='ST'&&p.secondary_positions[0]==='AM'));
 assert.ok(forced.candidates.some(p=>p.trial_role_profile==='versatile'));
 assert.deepEqual(generateTrial({count:20,seed:'secondary-determinism'}),
  generateTrial({count:20,seed:'secondary-determinism'}));
 assert.equal(new Set(sample.candidates.map(p=>p.preview_id)).size,1000);
 assert.equal(Object.keys(summarize(sample).countries).length,50);
 for(const [country,n] of Object.entries(summarize(sample).countries))assert.equal(n,20,`test-only coverage ${country}`);
 for(const p of sample.candidates){
  assert.equal('id' in p,false);assert.equal('entry_season' in p,false);assert.equal(p.career_status,'active');
  assert.ok(p.initial_age>=16&&p.initial_age<=19);
  assert.ok(p.height_cm>=160&&p.height_cm<=205);
  assert.ok(p.development_aptitude>=1&&p.development_aptitude<=99);
  assert.equal(Object.keys(p.attributes).length,20);
  for(const a of ATTRIBUTES)assert.ok(Number.isInteger(p.attributes[a])&&p.attributes[a]>=1&&p.attributes[a]<=99);
  assert.ok(p.secondary_positions.length<=5);
  assert.equal(new Set(p.secondary_positions).size,p.secondary_positions.length);
  for(const q of p.secondary_positions)assert.ok(secondaryWeight(p.primary_position,q,p.preferred_foot)>0);
  if(p.primary_position==='GK')assert.equal(p.secondary_positions.length,0);
  else for(const a of keeperAttributes)assert.ok(p.attributes[a]<=15,'Outfield automatic goalkeeper attribute above 15');
  if(p.secondary_nationality){
   assert.notEqual(p.secondary_nationality,p.nationality);
   assert.ok(related.has(`${p.nationality}:${p.secondary_nationality}`),
    'Automatic secondary nationality must use an eligible country pair');
  }
 }
 assert.throws(()=>generateTrial({count:1001}),/1 to 1000/);
 assert.throws(()=>generateTrial({count:0}),/1 to 1000/);
 assert.throws(()=>generateTrial({count:1,primaryPosition:'GK',secondaryCount:1}),/Secondary-position count impossible/); // GK hard-zero count handled below
 assert.throws(()=>generateTrial({count:1,primaryPosition:'ST',secondaryPositions:['CM']}),/Invalid manually requested/);
 assert.throws(()=>generateTrial({count:1,age:20}),/Invalid fixed/);
 assert.throws(()=>generateTrial({count:1,primaryNationality:'CVP'}),/outside test top 50/);
 for(const [a,b] of [['MLI','RUS'],['AUS','URU'],['ESP','JPN']])
  assert.equal(related.has(`${a}:${b}`),false,'Weak pair must have zero automatic probability');
 for(const [a,b] of [['ITA','GER'],['ITA','FRA'],['ITA','ENG'],['ITA','AUS'],
                     ['GER','CRO'],['GER','SRB'],['ENG','POL'],['FRA','ESP'],
                     ['ITA','MAR'],['ITA','NGA'],['ITA','SEN'],['ITA','EGY']]){
  assert.ok(related.has(`${a}:${b}`)&&related.has(`${b}:${a}`),
   'Documented diaspora pair missing from automatic allowance');
 }
 assert.equal(relatedPairs.length,90,'V6 trial allowlist should contain 90 unique unordered pairs');
 assert.equal(new Set(relatedPairs.map(pair=>pair.split('-').sort().join('-'))).size,relatedPairs.length,
  'Duplicate symmetric country pairs in trial allowlist');
 // A deliberate manual value is allowed even when the automatic probability is zero.
 assert.equal(generateTrial({count:1,primaryNationality:'MLI',secondaryNationality:'RUS'}).candidates[0].secondary_nationality,
  'RUS','Manual country override remains available');
 for(const primaryNationality of ['MLI','AUS','ESP','ITA','COD','GRE']){
  const forced=generateTrial({count:200,seed:'allowlist-'+primaryNationality,primaryNationality});
  for(const candidate of forced.candidates)
   if(candidate.secondary_nationality)
    assert.ok(related.has(`${primaryNationality}:${candidate.secondary_nationality}`),
     'Unexpected unrelated secondary country');
 }
 const manual=generateTrial({count:1,primaryNationality:'BRA',primaryPosition:'LB',preferredFoot:'right',secondaryPositions:['RB'],age:19,height:[160,160],developmentAptitude:[99,99],attributes:{shooting:[70,72]}}).candidates[0];
 assert.deepEqual(manual.secondary_positions,['RB']);assert.equal(manual.height_cm,160);assert.equal(manual.development_aptitude,99);assert.ok(manual.attributes.shooting>=70&&manual.attributes.shooting<=72);
 const highManualGK=generateTrial({count:1,primaryPosition:'ST',attributes:{gk_reflexes:95}}).candidates[0];
 assert.equal(highManualGK.attributes.gk_reflexes,95,'Manual exact goalkeeper attribute must be preserved');
 const heightTrial={count:1,seed:'heading-height-smoke',primaryPosition:'ST'};
 const lowHeight=generateTrial({...heightTrial,height:160}).candidates[0];
 const highHeight=generateTrial({...heightTrial,height:205}).candidates[0];
 assert.ok(highHeight.attributes.heading>lowHeight.attributes.heading,'Taller striker should have higher automatically generated heading under matched seed');
 const manualHeading=generateTrial({...heightTrial,height:205,attributes:{heading:42}}).candidates[0];
 assert.equal(manualHeading.attributes.heading,42,'Explicit manual heading must override height adjustment');
 const rangedHeading=generateTrial({...heightTrial,height:205,attributes:{heading:[40,41]}}).candidates[0];
 assert.ok(rangedHeading.attributes.heading>=40&&rangedHeading.attributes.heading<=41,'Manual heading range must override height adjustment');
 const keeperHeightTrial={count:1,seed:'keeper-heading-height-smoke',primaryPosition:'GK'};
 const shortKeeper=generateTrial({...keeperHeightTrial,height:160}).candidates[0];
 const tallKeeper=generateTrial({...keeperHeightTrial,height:205}).candidates[0];
 assert.equal(shortKeeper.attributes.heading,tallKeeper.attributes.heading,'GK heading must not change based on height');
 assert.ok(tallKeeper.attributes.gk_aerial>shortKeeper.attributes.gk_aerial,
  'Taller keeper should have higher automatic aerial skill under matched seed');
 assert.ok(highHeight.attributes.strength>lowHeight.attributes.strength,
  'Taller outfielder should have mildly higher automatic strength under matched seed');
 assert.ok(tallKeeper.attributes.strength>shortKeeper.attributes.strength,
  'Mild height-to-strength influence should also apply to keepers');
 const manuallyAerial=generateTrial({...keeperHeightTrial,height:205,attributes:{gk_aerial:45}}).candidates[0];
 assert.equal(manuallyAerial.attributes.gk_aerial,45,'Manual GK aerial must override height influence');
 const rangedAerial=generateTrial({...keeperHeightTrial,height:160,attributes:{gk_aerial:[30,31]}}).candidates[0];
 assert.ok(rangedAerial.attributes.gk_aerial>=30&&rangedAerial.attributes.gk_aerial<=31,
  'Manual GK aerial range must override height influence');
 const manuallyStrong=generateTrial({...heightTrial,height:205,attributes:{strength:20}}).candidates[0];
 assert.equal(manuallyStrong.attributes.strength,20,'Manual strength must override height influence');
 const rangedStrength=generateTrial({...heightTrial,height:160,attributes:{strength:[21,22]}}).candidates[0];
 assert.ok(rangedStrength.attributes.strength>=21&&rangedStrength.attributes.strength<=22,
  'Manual strength range must override height influence');
 const field=ATTRIBUTES.slice(0,16);
 const meanFieldSpread=sample.candidates.reduce((sum,p)=>{
  const values=field.map(a=>p.attributes[a]);return sum+Math.max(...values)-Math.min(...values);
 },0)/sample.count;
 assert.ok(meanFieldSpread<40,'Automatic field attributes still excessively variable');
 const correlationsObserved=Object.fromEntries(correlations.map(([a,b,t])=>[`${a}:${b}`,{target:t,observed:spearman(sample.candidates.map(p=>p.attributes[a]),sample.candidates.map(p=>p.attributes[b]))}]));
 // Narrower within-player ranges raise cross-attribute associations. Report old targets
 // for calibration transparently; do not claim those historical numeric targets are met.
 for(const observed of Object.values(correlationsObserved))assert.ok(observed.observed>0&&observed.observed<.9,'Unexpected attribute correlation');
 return {passed:true,count:sample.count,countries:50,summary:summarize(sample),
  mean_field_attribute_spread:meanFieldSpread,automatic_outfield_gk_max:15,
  correlations:correlationsObserved,correlation_calibration_pending:true};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2);const get=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1]};
  if(args.includes('--help')){console.log('Usage: node tools/players-generation-trial.mjs [--self-test] [--count 100|1000] [--seed NAME] [--primary-suitability 75|65:80|auto] (maximum 90) [--options-base64 BASE64URL] [--out LOCAL_JSON_PATH]\nNo D1/Worker/remote writes. Output is a preview fixture, never persisted players.');process.exit(0)}
  if(args.includes('--self-test'))console.log(JSON.stringify(selfTest(),null,2));
  else{
   const encoded=get('--options-base64');
   let trialOptions;
   if(encoded!==undefined){
    if(args.some(a=>['--count','--seed','--primary-suitability','--self-test'].includes(a)))throw Error('Do not mix --options-base64 with individual generation flags');
    if(typeof encoded!=='string'||!(/^[A-Za-z0-9_-]{1,8192}$/).test(encoded))throw Error('Invalid encoded generation options');
    const bytes=Buffer.from(encoded,'base64url');
    if(bytes.toString('base64url')!==encoded)throw Error('Noncanonical encoded generation options');
    const opts=JSON.parse(bytes.toString('utf8'));
    const allowed=['count','seed','firstName','lastName','primaryNationality','secondaryNationality','age','height','preferredFoot','primaryPosition','allowedPositions','secondaryCount','secondaryPositions','allowedSecondaries','developmentAptitude','primarySuitability','attributes'];
    if(!opts||Array.isArray(opts)||typeof opts!=='object'||Object.keys(opts).some(k=>!allowed.includes(k)))throw Error('Unsupported generation option');
    trialOptions=opts;
   }else{
    const n=get('--count')??'100';if(!/^\d+$/.test(n))throw Error('Count must be a positive integer');
    const rawSuitability=get('--primary-suitability');
    const primarySuitability=rawSuitability===undefined?undefined:
     /^\d+$/.test(rawSuitability)?Number(rawSuitability):
     /^\d+:\d+$/.test(rawSuitability)?rawSuitability.split(':').map(Number):
     ['auto','automatic'].includes(rawSuitability)?'auto':
     (()=>{throw Error('Invalid --primary-suitability: use 75, 65:80 or auto')})();
    trialOptions={count:Number(n),seed:get('--seed')??'fa-official-trial-01',primarySuitability};
   }
   const trial=generateTrial(trialOptions);
   const output=get('--out');if(output){writeFileSync(resolve(output),JSON.stringify(trial,null,2)+'\n',{flag:'w'});}
   console.log(JSON.stringify({summary:summarize(trial),sample:trial.candidates.slice(0,3),output:output?resolve(output):null},null,2));
  }
 }catch(error){console.error(error.message);process.exitCode=1}
}
