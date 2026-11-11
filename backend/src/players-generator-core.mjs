// GENERATED from tools/players-generation-trial.mjs. Keep numerical and identity algorithms identical.
// Run: node tools/build-players-runtime.mjs (or --check).
// Pure name samplers from tools/players-name-pools.mjs; no node:fs in Worker runtime.
function sampleGivenName(pools,code,rng){
 const bank=pools.given.get(code);
 if(!bank)throw new Error('Missing PLAYERS-03 given-name bank: '+code);
 const draw=rng()*bank.total;
 let lo=0,hi=bank.cumulative.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(draw<bank.cumulative[mid])hi=mid;else lo=mid+1;}
 return bank.values[lo];
}
function sampleSurname(pools,code,rng,demoSurnames){
 const bank=pools.surnames.get(code);
 if(!pools.given.has(code))throw new Error('Unknown nationality: '+code);
 if(bank)return bank[Math.floor(rng()*bank.length)];
 if(pools.surnameSource!=='temporary-demo-fallback')throw new Error('Missing SURNAMES-01 surname bank: '+code);
 if(!Array.isArray(demoSurnames)||!demoSurnames.length)throw new Error('No temporary demo surname for '+code);
 return demoSurnames[Math.floor(rng()*demoSurnames.length)];
}

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
function generateCandidate(rng,index,options,trialSeed,nationalNamePools){
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
export function generateTrialWithCatalog(options={},nationalNamePools){
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
 for(let i=0;i<count;i++)candidates.push(generateCandidate(rng,i,options,seed,nationalNamePools));
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
