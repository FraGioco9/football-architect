#!/usr/bin/env node
// PLAYERS-01 isolated in-memory generation trial; NO database, API or production writes.
// Run: node tools/players-generation-trial.mjs --count 1000 --seed fa-trial-01
// Validation: node tools/players-generation-trial.mjs --self-test
// Optional local-only JSON export: --out ./players-trial.json
// FIFA Men's World Ranking snapshot: 2026-10-07 (ranks 1-50).
// Source: https://inside.fifa.com/fifa-rankings/world-ranking/men?dateId=id121
// This temporary coverage fixture is NOT a production nationality probability distribution.
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const rawCountries = `
ESP|Spain|Francisco,José,Álvaro|García,Ruiz,Fernández
ARG|Argentina|Mateo,Nicolás,Tomás|Fernández,Rodríguez,González
FRA|France|Lucas,Antoine,Théo|Laurent,Moreau,Dubois
ENG|England|Oliver,Jack,George|Smith,Walker,Hughes
POR|Portugal|João,Francisco,António|Silva,Costa,Ferreira
BRA|Brazil|João,Rafael,Pedro|Souza,Santos,Oliveira
MAR|Morocco|Youssef,Amine,Achraf|El Amrani,Benali,Idrissi
BEL|Belgium|Louis,Arthur,Thomas|Peeters,Janssens,De Smet
NED|Netherlands|Daan,Lars,Bram|De Vries,Van Dijk,Bakker
MEX|Mexico|Diego,Santiago,Luis|Hernández,Martínez,Ramírez
COL|Colombia|Juan,Santiago,Andrés|Rodríguez,Restrepo,Gómez
SUI|Switzerland|Luca,Noah,Marco|Müller,Keller,Meier
GER|Germany|Leon,Maximilian,Felix|Müller,Schmidt,Weber
CRO|Croatia|Luka,Ivan,Marko|Kovačić,Horvat,Babić
ITA|Italy|Lorenzo,Matteo,Riccardo|Rossi,Esposito,Conti
USA|United States|Ethan,Noah,Logan|Johnson,Miller,Davis
JPN|Japan|Haruto,Ren,Yuto|Sato,Tanaka,Kobayashi
SEN|Senegal|Mamadou,Ibrahima,Cheikh|Ndiaye,Diop,Sarr
NOR|Norway|Erik,Oskar,Magnus|Hansen,Berg,Nilsen
URU|Uruguay|Facundo,Matías,Joaquín|Pereira,Silva,Olivera
DEN|Denmark|Mikkel,Anders,Emil|Nielsen,Jensen,Andersen
AUT|Austria|Lukas,Jakob,Florian|Gruber,Huber,Bauer
IRN|Iran|Amir,Mehdi,Ali|Hosseini,Rezaei,Mohammadi
ECU|Ecuador|Jhon,Kevin,Andrés|Caicedo,Quintero,Valencia
EGY|Egypt|Omar,Ahmed,Mohamed|Hassan,Mahmoud,Ibrahim
AUS|Australia|Liam,Joshua,Jack|Brown,Wilson,Taylor
CAN|Canada|Liam,Noah,William|Tremblay,Martin,Wong
ALG|Algeria|Yacine,Amine,Riyad|Benali,Boumediene,Mansouri
CIV|Côte d'Ivoire|Jean,Kouadio,Serge|Koné,Traoré,Kouassi
NGA|Nigeria|Chinedu,Emeka,Tunde|Okafor,Adeyemi,Obi
TUR|Türkiye|Arda,Emre,Kerem|Yılmaz,Demir,Çelik
KOR|South Korea|Min-jun,Ji-hoon,Seung-woo|Kim,Lee,Park
PAR|Paraguay|Miguel,Derlis,Ángel|González,Rojas,Benítez
SWE|Sweden|Erik,Axel,Viktor|Andersson,Lindberg,Eriksson
RUS|Russia|Ivan,Artem,Dmitri|Ivanov,Smirnov,Petrov
UKR|Ukraine|Andriy,Oleksandr,Mykola|Shevchenko,Kovalenko,Bondarenko
POL|Poland|Jakub,Jan,Piotr|Kowalski,Nowak,Zieliński
HUN|Hungary|Bence,Ádám,Dániel|Nagy,Kovács,Szabó
WAL|Wales|Rhys,Dylan,Gareth|Jones,Thomas,Davies
COD|DR Congo|Jean,Patrick,Cédric|Mbuyi,Kabongo,Ilunga
GRE|Greece|Giorgos,Nikos,Dimitris|Papadopoulos,Nikolaou,Georgiou
CMR|Cameroon|Jean,Christian,André|N'Koulou,Nkam,Aboubakar
SCO|Scotland|Callum,Scott,Finlay|MacDonald,McGregor,Robertson
SRB|Serbia|Nikola,Marko,Stefan|Petrović,Jovanović,Marković
SVK|Slovakia|Martin,Jakub,Tomáš|Novák,Kováč,Horváth
PAN|Panama|José,Ricardo,Luis|Rodríguez,Pérez,Castillo
MLI|Mali|Moussa,Amadou,Boubacar|Traoré,Coulibaly,Keita
RSA|South Africa|Sipho,Thabo,Siyabonga|Mokoena,Ndlovu,Khumalo
VEN|Venezuela|José,Andrés,Miguel|González,Rodríguez,Hernández
CHI|Chile|Benjamín,Matías,Vicente|González,Rojas,Muñoz`;
export const FIFA_SNAPSHOT = '2026-10-07';
export const COUNTRIES = Object.freeze(rawCountries.trim().split('\n').map((line,i)=>{
  const [code,name,first,last] = line.trim().split('|');
  return Object.freeze({rank:i+1,code,name,first:Object.freeze(first.split(',')),last:Object.freeze(last.split(','))});
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
const coherenceMix=.65;
const coherenceOffsets={A:12,B:4,C:-5,D:-13};
const correlations=[['speed','agility',.30],['passing','vision',.35],['tackling','marking',.30],['dribbling','technique',.40],['shooting','composure',.25]];
const diminutives={BRA:{João:'Joãozinho',Rafael:'Rafinha',Pedro:'Pedrinho'},POR:{João:'Joãozinho',Francisco:'Chiquinho',António:'Toninho'},ESP:{Francisco:'Paco',José:'Pepe',Álvaro:'Alvarito'}};
const knownAsRates={BRA:.50,POR:.20,ESP:.15,CVP:.10}; // CVP is a future exception, outside the initial top 50.
// Explicit conservative automatic pair allowlist; every unlisted pair has 0% probability.
// The V6 trial includes high-confidence diaspora/migration links supported by
// official statistics (Istat, Destatis, ONS, Italian Ministry of Labour).
// Pair eligibility is NOT an assertion about citizenship law; numerical probabilities remain provisional.
const relatedPairs=[
 'ESP-POR','ESP-ARG','ESP-MEX','ESP-CHI','ESP-COL','ESP-URU','ESP-VEN','ESP-PAR','ESP-ECU','ESP-PAN','ESP-MAR','ARG-URU','ARG-PAR','ARG-ITA','ARG-CHI','BRA-POR','BRA-ITA','BRA-JPN','FRA-BEL','FRA-SUI','FRA-SEN','FRA-CMR','FRA-CIV','FRA-ALG','FRA-MAR','FRA-MLI','FRA-COD','FRA-POR','ENG-WAL','ENG-SCO','ENG-USA','ENG-AUS','ENG-CAN','ENG-RSA','ENG-NGA','GER-AUT','GER-SUI','GER-TUR','GER-POL','GER-GRE','NED-BEL','NED-TUR','MAR-ALG','MAR-BEL','SEN-MLI','NGA-CMR','KOR-JPN','KOR-USA','JPN-USA','SWE-NOR','SWE-DEN','RUS-UKR','CRO-SRB','POL-SVK','POL-UKR','AUS-GRE','CAN-USA','CAN-UKR','ITA-SUI','ITA-USA','ITA-URU','USA-MEX','USA-GRE','USA-IRN','USA-EGY','USA-PAN','IRN-GER','IRN-CAN','AUT-HUN','HUN-SVK','BEL-COD','COL-VEN','COL-ECU','TUR-AUT','TUR-BEL','ITA-GER','ITA-FRA','ITA-ENG','ITA-AUS','ITA-CAN','ITA-ESP','ITA-BEL','GER-CRO','ENG-POL','FRA-ESP','MAR-ITA','NGA-ITA','SEN-ITA','EGY-ITA','GER-SRB'
];
const related=new Set(relatedPairs.flatMap(pair=>{const [a,b]=pair.split('-');return [`${a}:${b}`,`${b}:${a}`]}));

// Deterministic random stream. NOT for security tokens or permanent UUIDs.
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
function attributePriority(role,attribute){
 if(role==='GK')return keeperAttributes.includes(attribute)?'A':(['agility','positioning','decisions','composure'].includes(attribute)?'B':'D');
 if(keeperAttributes.includes(attribute))return 'D';
 const [a,b]=profiles[role].map(s=>s.split(' '));return a.includes(attribute)?'A':b.includes(attribute)?'B':'C';
}
// Bounded height tendency: an exact or ranged custom attribute always wins.
function heightDelta(heightCm,center,pointsPerCm,limit){
 return Math.max(-limit,Math.min(limit,Math.round((heightCm-center)*pointsPerCm)));
}
function smoothAutomaticAttributes(role,attributes,overrides,heightCm){
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
    attributes[a]=Math.max(1,Math.min(99,Math.round((1-coherenceMix)*raw+coherenceMix*keeperMean)));
   }
  }else{
   const center=fieldMean+coherenceOffsets[attributePriority(role,a)];
   attributes[a]=Math.max(1,Math.min(99,Math.round((1-coherenceMix)*raw+coherenceMix*center)));
  }
 }
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
 if(options.secondaryNationality&&options.secondaryNationality!=='automatic'){
  if(!byCountry.has(options.secondaryNationality)||options.secondaryNationality===country)throw Error('Invalid exact secondary nationality');
  return options.secondaryNationality;
 }
 if(rng()>=.10)return null;
 // Explicit allowlist only: unlisted secondary nationalities have zero probability.
 const choices=COUNTRIES.filter(c=>c.code!==country&&related.has(`${country}:${c.code}`));
 return choices.length?pick(choices,rng).code:null;
}
function generateCandidate(rng,index,options){
 const eligible=options.allowedPositions||POSITIONS;
 if(!Array.isArray(eligible)||!eligible.length||eligible.some(p=>!POSITIONS.includes(p)))throw Error('Invalid allowed primary positions');
 const position=options.primaryPosition??weighted(eligible,eligible.map(p=>positionWeights[p]),rng);
 if(!eligible.includes(position))throw Error('Primary position not in allowed set');
 // Round-robin across the frozen top 50 is a TEST COVERAGE PLAN, not an approved sampling distribution.
 const country=options.primaryNationality??COUNTRIES[index%COUNTRIES.length].code;
 if(!byCountry.has(country))throw Error('Primary nationality outside test top 50');
 const bank=byCountry.get(country);
 const first=options.firstName??pick(bank.first,rng),last=options.lastName??pick(bank.last,rng);
 if(!first||!last||typeof first!=='string'||typeof last!=='string')throw Error('First and last names required');
 const [ageLo,ageHi]=validRange(options.age,16,19);
 const age=discrete(rng,ageLo,ageHi,[30,35,20,15].slice(ageLo-16,ageHi-15));
 const foot=options.preferredFoot??(rng()*100<footLeftPct[position]?'left':'right');
 if(!['left','right'].includes(foot))throw Error('Invalid preferred foot');
 const secondaries=secondaryPositions(position,foot,rng,options);
 const [hlo,hhi]=validRange(options.height,160,205);
 const height=discrete(rng,hlo,hhi,normalWeights(hlo,hhi,heightMeans[position],position==='ST'?8:7));
 const [dlo,dhi]=validRange(options.developmentAptitude,1,99);
 const aptitude=discrete(rng,dlo,dhi,normalWeights(dlo,dhi,47,21));
 const u=attributeUniforms(rng),attributes={};
 for(const a of ATTRIBUTES){
  const role=secondaries.length&&rng()>=.65?pick(secondaries,rng):position;
  attributes[a]=bandValue(attributePriority(role,a),u[a],options.attributes?.[a]);
 }
 smoothAutomaticAttributes(position,attributes,options.attributes,height);
 const rate=knownAsRates[country]||0;
 const knownAs=options.knownAs==='none'?null:(typeof options.knownAs==='string'&&options.knownAs!=='automatic'?options.knownAs:(rng()<rate?(diminutives[country]?.[first]??null):null));
 if(knownAs!==null&&knownAs===`${first} ${last}`)throw Error('known_as must not repeat full name');
 return {
  preview_id:`trial-${String(index+1).padStart(4,'0')}`,
  // Permanent id and authoritative entry_season exist only after final confirmation; this tool never persists.
  first_name:first,last_name:last,known_as:knownAs,display_name:knownAs||`${first} ${last}`,
  initial_age:age,nationality:country,secondary_nationality:secondaryNationality(country,rng,options),
  height_cm:height,preferred_foot:foot,primary_position:position,secondary_positions:secondaries,
  attributes,development_aptitude:aptitude,career_status:'active'
 };
}
export function generateTrial(options={}){
 const count=options.count??100,seed=options.seed??'fa-players-01';
 if(!Number.isInteger(count)||count<1||count>1000)throw Error('Count must be an integer from 1 to 1000');
 if(typeof seed!=='string'||!seed.length)throw Error('Seed must be a nonempty string');
 if(options.attributes&&(typeof options.attributes!=='object'||Object.keys(options.attributes).some(k=>!ATTRIBUTES.includes(k))))throw Error('Invalid attribute override');
 const rng=seededRandom(seed),candidates=[];
 for(let i=0;i<count;i++)candidates.push(generateCandidate(rng,i,options));
 return {trial_only:true,persisted:false,ranking_snapshot:FIFA_SNAPSHOT,seed,count,candidates};
}
export function summarize(trial){
 const groups={countries:{},positions:{},ages:{},secondaryCounts:{},knownAs:0,secondNationalities:0};
 for(const p of trial.candidates){
  for(const [key,value] of [['countries',p.nationality],['positions',p.primary_position],['ages',p.initial_age],['secondaryCounts',p.secondary_positions.length]])groups[key][value]=(groups[key][value]||0)+1;
  if(p.known_as)groups.knownAs++;if(p.secondary_nationality)groups.secondNationalities++;
 }
 return {count:trial.count,seed:trial.seed,snapshot:trial.ranking_snapshot,distinct_countries:Object.keys(groups.countries).length,known_as:groups.knownAs,secondary_nationalities:groups.secondNationalities,countries:groups.countries,positions:groups.positions,ages:groups.ages,secondary_counts:groups.secondaryCounts};
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
  if(p.known_as){assert.ok(['BRA','POR','ESP'].includes(p.nationality));assert.notEqual(p.known_as,`${p.first_name} ${p.last_name}`);}
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
 const manual=generateTrial({count:1,primaryNationality:'BRA',primaryPosition:'LB',preferredFoot:'right',secondaryPositions:['RB'],age:19,height:[160,160],developmentAptitude:[99,99],knownAs:'none',attributes:{shooting:[70,72]}}).candidates[0];
 assert.deepEqual(manual.secondary_positions,['RB']);assert.equal(manual.height_cm,160);assert.equal(manual.development_aptitude,99);assert.equal(manual.known_as,null);assert.ok(manual.attributes.shooting>=70&&manual.attributes.shooting<=72);
 const highManualGK=generateTrial({count:1,primaryPosition:'ST',attributes:{gk_reflexes:95}}).candidates[0];
 assert.equal(highManualGK.attributes.gk_reflexes,95,'Manual exact goalkeeper attribute must be preserved');
 const heightTrial={count:1,seed:'heading-height-smoke',primaryPosition:'ST',knownAs:'none'};
 const lowHeight=generateTrial({...heightTrial,height:160}).candidates[0];
 const highHeight=generateTrial({...heightTrial,height:205}).candidates[0];
 assert.ok(highHeight.attributes.heading>lowHeight.attributes.heading,'Taller striker should have higher automatically generated heading under matched seed');
 const manualHeading=generateTrial({...heightTrial,height:205,attributes:{heading:42}}).candidates[0];
 assert.equal(manualHeading.attributes.heading,42,'Explicit manual heading must override height adjustment');
 const rangedHeading=generateTrial({...heightTrial,height:205,attributes:{heading:[40,41]}}).candidates[0];
 assert.ok(rangedHeading.attributes.heading>=40&&rangedHeading.attributes.heading<=41,'Manual heading range must override height adjustment');
 const keeperHeightTrial={count:1,seed:'keeper-heading-height-smoke',primaryPosition:'GK',knownAs:'none'};
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
  if(args.includes('--help')){console.log('Usage: node tools/players-generation-trial.mjs [--self-test] [--count 100|1000] [--seed NAME] [--out LOCAL_JSON_PATH]\nNo D1/Worker/remote writes. Output is a preview fixture, never persisted players.');process.exit(0)}
  if(args.includes('--self-test'))console.log(JSON.stringify(selfTest(),null,2));
  else{
   const n=get('--count')??'100';if(!/^\d+$/.test(n))throw Error('Count must be a positive integer');
   const trial=generateTrial({count:Number(n),seed:get('--seed')??'fa-official-trial-01'});
   const output=get('--out');if(output){writeFileSync(resolve(output),JSON.stringify(trial,null,2)+'\n',{flag:'w'});}
   console.log(JSON.stringify({summary:summarize(trial),sample:trial.candidates.slice(0,3),output:output?resolve(output):null},null,2));
  }
 }catch(error){console.error(error.message);process.exitCode=1}
}
