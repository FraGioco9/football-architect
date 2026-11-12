/** Canonical anonymous Players filter allowlist. Shared by Worker and local/shared DEV bridge. */
const COUNTRIES=new Set('ALG ARG AUS AUT BEL BRA CAN CHI CIV CMR COD COL CRO DEN ECU EGY ENG ESP FRA GER GRE HUN IRN ITA JPN KOR MAR MEX MLI NED NGA NOR PAN PAR POL POR RSA RUS SCO SEN SRB SUI SVK SWE TUR UKR URU USA VEN WAL'.split(' '));
const POSITIONS=new Set('GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' '));
const validators=Object.freeze({
 page:value=>/^[1-9][0-9]{0,3}$/.test(value),
 nationality:value=>COUNTRIES.has(value),
 position:value=>POSITIONS.has(value),
 ageMin:value=>/^(?:0|[1-9][0-9]{0,2})$/.test(value)&&Number(value)<=120,
 ageMax:value=>/^(?:0|[1-9][0-9]{0,2})$/.test(value)&&Number(value)<=120,
 foot:value=>value==='left'||value==='right'
});
/** Accept plain ASCII query pairs only. Reject duplicates, aliases, encoding and unknown fields. */
export function parsePublicPlayerQuery(raw=''){
 if(raw===''||raw===undefined)return {page:1,filters:{}};
 if(typeof raw!=='string'||!/^(?:\?[A-Za-z][A-Za-z]*=[A-Za-z0-9]+)(?:&[A-Za-z][A-Za-z]*=[A-Za-z0-9]+)*$/.test(raw))
  throw new TypeError('invalid_public_request');
 const pairs=raw.slice(1).split('&');
 if(pairs.length>Object.keys(validators).length)throw new TypeError('invalid_public_request');
 const seen=new Set(),values={};
 for(const pair of pairs){
  const [key,value]=pair.split('=');
  if(seen.has(key)||!Object.hasOwn(validators,key)||!validators[key](value))
   throw new TypeError('invalid_public_request');
  seen.add(key);values[key]=value;
 }
 const ageMin=values.ageMin===undefined?undefined:Number(values.ageMin);
 const ageMax=values.ageMax===undefined?undefined:Number(values.ageMax);
 if(ageMin!==undefined&&ageMax!==undefined&&ageMin>ageMax)
  throw new TypeError('invalid_public_request');
 const filters={};
 if(values.nationality!==undefined)filters.nationality=values.nationality;
 if(values.position!==undefined)filters.position=values.position;
 if(ageMin!==undefined)filters.ageMin=ageMin;
 if(ageMax!==undefined)filters.ageMax=ageMax;
 if(values.foot!==undefined)filters.foot=values.foot;
 return {page:values.page===undefined?1:Number(values.page),filters};
}
export function isAllowedPublicPlayersPath(raw){
 if(typeof raw!=='string'||!raw.startsWith('/api/players'))return false;
 const path='/api/players';
 if(raw===path)return true;
 if(!raw.startsWith(path+'?'))return false;
 try{parsePublicPlayerQuery(raw.slice(path.length));return true}
 catch{return false}
}
