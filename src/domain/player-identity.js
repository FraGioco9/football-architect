// PLY-REBUILD PLYR-01 — deterministic player identity v2 foundation.
// This module owns observable identity only. It contains no potential,
// body-type classification, special traits or future-development information.
import {getLeagueClubs} from '../leagues.js';
import {isCareerDate} from './career-date.js';

export const PLAYER_IDENTITY_VERSION=1;
export const PLAYER_IDENTITY_COUNTRIES=Object.freeze(['IT','ENG','ES','DE','FR','NL','PT','BR']);

const aliases=Object.freeze({
 IT:'IT',ITA:'IT',ITALY:'IT',
 ENG:'ENG',EN:'ENG',GB:'ENG',UK:'ENG',ENGLAND:'ENG',
 ES:'ES',ESP:'ES',SPAIN:'ES',
 DE:'DE',GER:'DE',GERMANY:'DE',
 FR:'FR',FRA:'FR',FRANCE:'FR',
 NL:'NL',NED:'NL',NETHERLANDS:'NL',
 PT:'PT',POR:'PT',PORTUGAL:'PT',
 BR:'BR',BRA:'BR',BRAZIL:'BR'
});
const labels=Object.freeze({
 IT:{it:'Italia',en:'Italy'},ENG:{it:'Inghilterra',en:'England'},ES:{it:'Spagna',en:'Spain'},DE:{it:'Germania',en:'Germany'},
 FR:{it:'Francia',en:'France'},NL:{it:'Paesi Bassi',en:'Netherlands'},PT:{it:'Portogallo',en:'Portugal'},BR:{it:'Brasile',en:'Brazil'}
});
const legacyPositionFamily=Object.freeze({
 POR:'gk',GK:'gk',
 DC:'cb',CB:'cb',
 TD:'fullback',RB:'fullback',RWB:'fullback',
 TS:'fullback',LB:'fullback',LWB:'fullback',
 MED:'mid',CDM:'mid',CC:'mid',CM:'mid',COC:'mid',CAM:'mid',
 AD:'wide',AS:'wide',RM:'wide',LM:'wide',RW:'wide',LW:'wide',
 ATT:'striker',ST:'striker'
});
const physical=Object.freeze({
 gk:{height:190,spread:9,weightBias:4},
 cb:{height:187,spread:9,weightBias:5},
 fullback:{height:178,spread:9,weightBias:-1},
 mid:{height:180,spread:10,weightBias:0},
 wide:{height:177,spread:9,weightBias:-2},
 striker:{height:184,spread:11,weightBias:3}
});
const numberPreferences=Object.freeze({
 POR:[1,12,22,30,31,40],
 TD:[2,13,14,24,32],RB:[2,13,14,24,32],RWB:[2,7,14,24,32],
 TS:[3,15,16,25,33],LB:[3,15,16,25,33],LWB:[3,11,16,25,33],
 DC:[4,5,13,14,15,19,23,24],CB:[4,5,13,14,15,19,23,24],
 MED:[6,8,16,18,20,21,24],CDM:[6,8,16,18,20,21,24],
 CC:[8,6,10,14,16,18,20,21],CM:[8,6,10,14,16,18,20,21],
 COC:[10,8,14,18,20,21],CAM:[10,8,14,18,20,21],
 AD:[7,11,17,19,21,22,27],RW:[7,11,17,19,21,22,27],RM:[7,11,17,19,21,22,27],
 AS:[11,7,17,19,21,22,27],LW:[11,7,17,19,21,22,27],LM:[11,7,17,19,21,22,27],
 ATT:[9,10,11,17,18,19,20,23],ST:[9,10,11,17,18,19,20,23]
});

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const hash=(text)=>{let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const rng=(seed)=>{let n=seed>>>0;return()=>{n=(n+0x6D2B79F5)>>>0;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};};
const gaussianish=roll=>((roll()+roll()+roll()+roll()+roll()+roll())-3)/3;
const pad=n=>String(n).padStart(2,'0');
const daysInMonth=(year,month)=>new Date(Date.UTC(year,month,0)).getUTCDate();

export function canonicalIdentityCountry(value){
 const key=String(value??'').trim().toUpperCase();
 const code=aliases[key];
 if(!code)throw new Error('PLAYER_IDENTITY_COUNTRY');
 return code;
}
export function identityCountryLabel(value,lang='it'){
 const code=canonicalIdentityCountry(value);
 return labels[code][lang==='en'?'en':'it'];
}
export function playerAgeOnDate(birthDate,referenceDate){
 if(!isCareerDate(birthDate)||!isCareerDate(referenceDate))throw new Error('PLAYER_IDENTITY_DATE');
 const [by,bm,bd]=birthDate.split('-').map(Number),[ry,rm,rd]=referenceDate.split('-').map(Number);
 let age=ry-by;
 if(rm<bm||(rm===bm&&rd<bd))age--;
 if(age<0||age>110)throw new Error('PLAYER_IDENTITY_AGE');
 return age;
}
export function birthDateForAge(age,referenceDate,roll){
 if(!Number.isSafeInteger(age)||age<14||age>70||!isCareerDate(referenceDate)||typeof roll!=='function')throw new Error('PLAYER_IDENTITY_BIRTH_INPUT');
 const [ry,rm,rd]=referenceDate.split('-').map(Number);
 const month=1+Math.floor(roll()*12);
 const day=1+Math.floor(roll()*daysInMonth(ry-age,month));
 const birthdayPassed=month<rm||(month===rm&&day<=rd);
 const year=ry-age-(birthdayPassed?0:1);
 return `${year}-${pad(month)}-${pad(Math.min(day,daysInMonth(year,month)))}`;
}
function cityPool(countryCode){
 const code=canonicalIdentityCountry(countryCode);
 const cities=getLeagueClubs(code).map(club=>String(club.city||'').trim()).filter(Boolean);
 if(!cities.length)throw new Error('PLAYER_IDENTITY_CITY_POOL');
 return cities;
}
function physicalProfile(position,age,roll){
 const family=legacyPositionFamily[String(position??'').toUpperCase()]??'mid';
 const config=physical[family];
 const youthHeightAdjustment=age<18?-(18-age)*.8:0;
 const height=clamp(Math.round(config.height+youthHeightAdjustment+gaussianish(roll)*config.spread),160,204);
 // Weight remains a raw physical measurement, not a synthetic body-type class.
 const ageAdjustment=age<20?-2:age>30?1:0;
 const base=height-105+config.weightBias+ageAdjustment;
 const weight=clamp(Math.round(base+gaussianish(roll)*5),54,108);
 return {heightCm:height,weightKg:weight};
}
function preferredFoot(position,roll){
 const pos=String(position??'').toUpperCase();
 let leftChance=.225;
 if(['TS','LB','LWB','AS','LW','LM'].includes(pos))leftChance=.57;
 else if(['TD','RB','RWB','AD','RW','RM'].includes(pos))leftChance=.12;
 return roll()<leftChance?'left':'right';
}
function secondaryNationality(primary,home,roll){
 if(primary!==home&&roll()<.38)return home;
 if(primary===home&&roll()<.08){
   const others=PLAYER_IDENTITY_COUNTRIES.filter(code=>code!==primary);
   return others[Math.floor(roll()*others.length)]??null;
 }
 return null;
}
function birthplaceCountry(primary,secondary,home,roll){
 if(secondary===home&&primary!==home&&roll()<.48)return home;
 if(secondary&&roll()<.12)return secondary;
 return primary;
}

export function createPlayerIdentity({
 seed=0,id,globalId,homeCountry,nationalityCode,firstName,lastName,displayName,age,referenceDate,position,originClubId=null
}={}){
 if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw new Error('PLAYER_IDENTITY_SEED');
 if(!['number','string'].includes(typeof id)||!String(id).trim())throw new Error('PLAYER_IDENTITY_ID');
 if(!isCareerDate(referenceDate))throw new Error('PLAYER_IDENTITY_REFERENCE_DATE');
 const home=canonicalIdentityCountry(homeCountry),primary=canonicalIdentityCountry(nationalityCode??home);
 const roll=rng(hash(`${seed}|${globalId??id}|PLYR01/identity-v1`));
 const secondary=secondaryNationality(primary,home,roll);
 const bornIn=birthplaceCountry(primary,secondary,home,roll);
 const cities=cityPool(bornIn);
 const birthDate=birthDateForAge(age,referenceDate,roll);
 const {heightCm,weightKg}=physicalProfile(position,age,roll);
 const foot=preferredFoot(position,roll);
 const identity={
   schemaVersion:PLAYER_IDENTITY_VERSION,
   firstName:String(firstName??'').trim(),
   lastName:String(lastName??'').trim(),
   displayName:String(displayName??`${firstName??''} ${lastName??''}`).trim(),
   birthDate,
   birthPlace:{city:cities[Math.floor(roll()*cities.length)],countryCode:bornIn},
   nationality:{primary,secondary},
   heightCm,
   weightKg,
   preferredFoot:foot,
   shirtNumber:null,
   originClubId:originClubId===undefined?null:originClubId
 };
 validatePlayerIdentity(identity,{referenceDate,expectedAge:age});
 return identity;
}
export function validatePlayerIdentity(identity,{referenceDate=null,expectedAge=null}={}){
 if(!identity||typeof identity!=='object'||identity.schemaVersion!==PLAYER_IDENTITY_VERSION)throw new Error('PLAYER_IDENTITY_VERSION');
 for(const key of ['firstName','lastName','displayName'])if(typeof identity[key]!=='string'||!identity[key].trim()||identity[key].length>120)throw new Error('PLAYER_IDENTITY_NAME');
 if(!isCareerDate(identity.birthDate))throw new Error('PLAYER_IDENTITY_BIRTHDATE');
 if(!identity.birthPlace||typeof identity.birthPlace.city!=='string'||!identity.birthPlace.city.trim())throw new Error('PLAYER_IDENTITY_BIRTHPLACE');
 canonicalIdentityCountry(identity.birthPlace.countryCode);
 canonicalIdentityCountry(identity.nationality?.primary);
 if(identity.nationality?.secondary!==null&&identity.nationality?.secondary!==undefined){
   const secondary=canonicalIdentityCountry(identity.nationality.secondary);
   if(secondary===canonicalIdentityCountry(identity.nationality.primary))throw new Error('PLAYER_IDENTITY_SECONDARY');
 }
 if(!Number.isSafeInteger(identity.heightCm)||identity.heightCm<150||identity.heightCm>215)throw new Error('PLAYER_IDENTITY_HEIGHT');
 if(!Number.isSafeInteger(identity.weightKg)||identity.weightKg<45||identity.weightKg>125)throw new Error('PLAYER_IDENTITY_WEIGHT');
 if(!['left','right'].includes(identity.preferredFoot))throw new Error('PLAYER_IDENTITY_FOOT');
 if(identity.shirtNumber!==null&&(!Number.isSafeInteger(identity.shirtNumber)||identity.shirtNumber<1||identity.shirtNumber>99))throw new Error('PLAYER_IDENTITY_SHIRT');
 if(referenceDate){
   const age=playerAgeOnDate(identity.birthDate,referenceDate);
   if(expectedAge!==null&&expectedAge!==undefined&&age!==expectedAge)throw new Error('PLAYER_IDENTITY_AGE_MISMATCH');
 }
 return true;
}
export function assignSquadNumbers(players){
 if(!Array.isArray(players))throw new Error('PLAYER_IDENTITY_ROSTER');
 const used=new Set();
 const fallback=()=>{for(let n=1;n<=99;n++)if(!used.has(n))return n;throw new Error('PLAYER_IDENTITY_NUMBERS');};
 for(const player of players){
   if(!player?.identity)throw new Error('PLAYER_IDENTITY_MISSING');
   const prefs=numberPreferences[String(player.position??'').toUpperCase()]??[];
   const number=prefs.find(n=>!used.has(n))??fallback();
   used.add(number);
   player.identity.shirtNumber=number;
   player.shirtNumber=number; // temporary compatibility mirror
 }
 return players;
}
