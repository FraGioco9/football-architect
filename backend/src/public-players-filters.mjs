/** Canonical read-only Players filter allowlist. Shared by Worker and DEV bridge. */
const COUNTRIES=new Set('ALG ARG AUS AUT BEL BRA CAN CHI CIV CMR COD COL CRO DEN ECU EGY ENG ESP FRA GER GRE HUN IRN ITA JPN KOR MAR MEX MLI NED NGA NOR PAN PAR POL POR RSA RUS SCO SEN SRB SUI SVK SWE TUR UKR URU USA VEN WAL'.split(' '));
const POSITIONS=new Set('GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' '));
const integer=(value,min,max)=>/^(?:0|[1-9][0-9]{0,2})$/.test(value)&&Number(value)>=min&&Number(value)<=max;
const selected=(value,allowed)=>{
 const codes=value.split(',');
 return codes.length>0&&codes.length<=allowed.size&&new Set(codes).size===codes.length&&codes.every(code=>allowed.has(code));
};
const validators=Object.freeze({
 page:value=>/^[1-9][0-9]{0,3}$/.test(value),
 nationality:value=>selected(value,COUNTRIES),
 nationalityScope:value=>value==='any',
 position:value=>selected(value,POSITIONS),
 positionScope:value=>value==='any',
 ageMin:value=>integer(value,0,120),
 ageMax:value=>integer(value,0,120),
 heightMin:value=>integer(value,100,250),
 heightMax:value=>integer(value,100,250),
 foot:value=>value==='left'||value==='right'
});
/** Strict query parser: one of each key, no aliases/encoded values or duplicate selected codes. */
export function parsePublicPlayerQuery(raw=''){
 if(raw===''||raw===undefined)return {page:1,filters:{}};
 if(typeof raw!=='string'||!/^(?:\?[A-Za-z]+=[A-Za-z0-9]+(?:(?:,|%2C)[A-Za-z0-9]+)*)(?:&[A-Za-z]+=[A-Za-z0-9]+(?:(?:,|%2C)[A-Za-z0-9]+)*)*$/.test(raw))
  throw new TypeError('invalid_public_request');
 const pairs=raw.slice(1).split('&');
 if(pairs.length>Object.keys(validators).length)throw new TypeError('invalid_public_request');
 const seen=new Set(),values={};
 for(const pair of pairs){
  const [key,rawValue]=pair.split('=');
  const value=rawValue.replaceAll('%2C',',');
  if(seen.has(key)||!Object.hasOwn(validators,key)||!validators[key](value))throw new TypeError('invalid_public_request');
  seen.add(key);values[key]=value;
 }
 if((values.nationalityScope&&!values.nationality)||(values.positionScope&&!values.position))
  throw new TypeError('invalid_public_request');
 const ageMin=values.ageMin===undefined?undefined:Number(values.ageMin);
 const ageMax=values.ageMax===undefined?undefined:Number(values.ageMax);
 const heightMin=values.heightMin===undefined?undefined:Number(values.heightMin);
 const heightMax=values.heightMax===undefined?undefined:Number(values.heightMax);
 if((ageMin!==undefined&&ageMax!==undefined&&ageMin>ageMax)||
    (heightMin!==undefined&&heightMax!==undefined&&heightMin>heightMax))
  throw new TypeError('invalid_public_request');
 const filters={};
 if(values.nationality!==undefined)filters.nationality=values.nationality.split(',');
 if(values.nationalityScope!==undefined)filters.nationalityScope='any';
 if(values.position!==undefined)filters.position=values.position.split(',');
 if(values.positionScope!==undefined)filters.positionScope='any';
 if(ageMin!==undefined)filters.ageMin=ageMin;
 if(ageMax!==undefined)filters.ageMax=ageMax;
 if(heightMin!==undefined)filters.heightMin=heightMin;
 if(heightMax!==undefined)filters.heightMax=heightMax;
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
