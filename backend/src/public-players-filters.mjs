/** Canonical read-only Players filter allowlist. Shared by Worker and DEV bridge. */
const COUNTRIES=new Set('ALG ARG AUS AUT BEL BRA CAN CHI CIV CMR COD COL CRO DEN ECU EGY ENG ESP FRA GER GRE HUN IRN ITA JPN KOR MAR MEX MLI NED NGA NOR PAN PAR POL POR RSA RUS SCO SEN SRB SUI SVK SWE TUR UKR URU USA VEN WAL'.split(' '));
const POSITIONS=new Set('GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' '));
const ATTRIBUTES=new Set('passing technique dribbling shooting crossing tackling marking heading vision positioning decisions composure speed strength stamina agility gk_reflexes gk_handling gk_positioning gk_aerial'.split(' '));
const nameValue=raw=>{
 let value;
 try{value=decodeURIComponent(raw.replaceAll('+',' '));}catch{throw new TypeError('invalid_public_request');}
 if(value!==value.normalize('NFC')||value.trim()!==value||!/^[\p{L}\p{M}0-9 .'’\-]{1,80}$/u.test(value)||
    encodeURIComponent(value).replace(/%20/g,'+').replace(/[!'()~*]/g,ch=>'%'+ch.charCodeAt(0).toString(16).toUpperCase())!==raw)throw new TypeError('invalid_public_request');
 return value;
};
const attributeValue=value=>{
 const selected=value.split(',');
 if(selected.length>ATTRIBUTES.size)throw new TypeError('invalid_public_request');
 const used=new Set();
 return selected.map(item=>{
  const match=/^([a-z_]+)_(x|[1-9][0-9]?)_(x|[1-9][0-9]?)$/.exec(item);
  if(!match||!ATTRIBUTES.has(match[1])||used.has(match[1]))throw new TypeError('invalid_public_request');
  used.add(match[1]);
  const min=match[2]==='x'?undefined:Number(match[2]),max=match[3]==='x'?undefined:Number(match[3]);
  if((min===undefined&&max===undefined)||(min!==undefined&&min>99)||(max!==undefined&&max>99)||
     (min!==undefined&&max!==undefined&&min>max))throw new TypeError('invalid_public_request');
  return {key:match[1],...(min===undefined?{}:{min}),...(max===undefined?{}:{max})};
 });
};
const integer=(value,min,max)=>/^(?:0|[1-9][0-9]{0,2})$/.test(value)&&Number(value)>=min&&Number(value)<=max;
const selected=(value,allowed)=>{
 const codes=value.split(',');
 return codes.length>0&&codes.length<=allowed.size&&new Set(codes).size===codes.length&&codes.every(code=>allowed.has(code));
};
const validators=Object.freeze({
 page:value=>/^[1-9][0-9]{0,3}$/.test(value),
 name:value=>{try{nameValue(value);return true}catch{return false}},
 attributes:value=>{try{attributeValue(value.replaceAll('%2C',','));return true}catch{return false}},
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
 if(typeof raw!=='string'||!/^\?(?:[A-Za-z]+=[^&=#]+)(?:&[A-Za-z]+=[^&=#]+)*$/.test(raw))
  throw new TypeError('invalid_public_request');
 const pairs=raw.slice(1).split('&');
 if(pairs.length>Object.keys(validators).length)throw new TypeError('invalid_public_request');
 const seen=new Set(),values={};
 for(const pair of pairs){
  const [key,rawValue]=pair.split('=');
  if(!Object.hasOwn(validators,key)||seen.has(key))throw new TypeError('invalid_public_request');
  const value=key==='name'?rawValue:rawValue.replaceAll('%2C',',');
  if((key!=='name'&&!/^[A-Za-z0-9_,]+$/.test(value))||!validators[key](key==='attributes'?rawValue:value))
   throw new TypeError('invalid_public_request');
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
 if(values.name!==undefined)filters.name=nameValue(values.name);
 if(values.attributes!==undefined)filters.attributes=attributeValue(values.attributes);
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
