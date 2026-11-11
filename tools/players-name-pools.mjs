// Trial-only read adapter for national first-name (PLAYERS-03) and surname
// (SURNAMES-01) catalogs. No runtime database/API use and no dataset copies.
import {existsSync,readFileSync} from 'node:fs';
import {dirname,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO_ROOT=fileURLToPath(new URL('../',import.meta.url));
export const GIVEN_CATALOG_PATH=join(REPO_ROOT,'data/players/names/catalog-v1.json');
export const SURNAME_CATALOG_PATH=join(REPO_ROOT,'data/players/surnames/catalog-v1.json');

function readJson(path,label){
 try{return JSON.parse(readFileSync(path,'utf8'));}
 catch(error){throw new Error('Cannot load '+label+' at '+path+': '+error.message);}
}
function countryFile(catalogPath,path,label){
 if(typeof path!=='string'||!/^countries\/[A-Z]{3}\.json$/.test(path))
  throw new Error(label+' must point to a countries/CODE.json file');
 const root=dirname(catalogPath),full=resolve(root,path),sub=relative(root,full);
 if(sub.startsWith('..'+sep)||sub==='..'||sub.startsWith(sep))
  throw new Error('Country file outside catalog directory');
 return full;
}
function validateCountries(rows,expectedCodes,label){
 if(!Array.isArray(rows)||rows.length!==expectedCodes.length)
  throw new Error(label+' must contain exactly '+expectedCodes.length+' countries');
 const actual=rows.map(row=>row?.code),expected=new Set(expectedCodes);
 if(new Set(actual).size!==expected.size||actual.some(code=>!expected.has(code)))
  throw new Error(label+' country codes do not match generator ranking');
}
function weightedBank(bank,code){
 if(bank?.code!==code||!Array.isArray(bank.given_names)||!bank.given_names.length)
  throw new Error('Invalid given-name bank: '+code);
 const values=[],cumulative=[];let total=0;
 for(const entry of bank.given_names){
  if(typeof entry?.value!=='string'||!entry.value||
    !Number.isSafeInteger(entry.weight)||entry.weight<=0)
   throw new Error('Invalid positive source name weight: '+code);
  total+=entry.weight;
  if(!Number.isSafeInteger(total))throw new Error('Name weight total overflow: '+code);
  values.push(entry.value);cumulative.push(total);
 }
 if(new Set(values).size!==values.length)
  throw new Error('Duplicate given name: '+code);
 return Object.freeze({values:Object.freeze(values),cumulative:Object.freeze(cumulative),total});
}
// Keep the historical source values (and their verified Git blobs) unchanged.
// Some surname sources encode entire names or individual tokens in uppercase.
// Normalize only those tokens when preparing the runtime sampling pool; retain
// genuine one-letter surnames and existing mixed/lowercase particles verbatim.
function displayCaseSurname(value){
 const title=word=>{
  const lower=word.toLocaleLowerCase('und');
  return [...lower][0].toLocaleUpperCase('und')+[...lower].slice(1).join('');
 };
 return value.replace(/[\p{L}\p{M}]+/gu,word=>{
  if([...word].length<2)return word;
  if(/^Mc\p{Lu}{2,}$/u.test(word))return 'Mc'+title(word.slice(2));
  if(word!==word.toLocaleUpperCase('und')||word===word.toLocaleLowerCase('und'))
   return word;
  if(/^MC\p{Lu}{2,}$/u.test(word))return 'Mc'+title(word.slice(2));
  return title(word);
 });
}

function uniformBank(bank,code){
 if(bank?.code!==code||bank.kind!=='surnames'||bank.selection_policy!=='uniform'||
   !Array.isArray(bank.surnames)||!bank.surnames.length)
  throw new Error('Invalid uniform surname bank: '+code);
 const values=bank.surnames.map(entry=>{
  if(!entry||Object.keys(entry).length!==1||typeof entry.value!=='string'||
    !entry.value||entry.value!==entry.value.normalize('NFC'))
   throw new Error('Invalid unweighted surname entry: '+code);
  return displayCaseSurname(entry.value);
 });
 if(new Set(values.map(value=>value.toLocaleLowerCase('und'))).size!==values.length)
  throw new Error('Duplicate surname: '+code);
 return Object.freeze(values);
}

/**
 * Surname catalog missing: transparent demo fallback, never a publication gate.
 * Surname catalog present but invalid: fail explicitly instead of masking it.
 * In either mode this adapter reads local repository files only.
 */
export function loadPlayerNamePools({
 expectedCodes,givenCatalogPath=GIVEN_CATALOG_PATH,
 surnameCatalogPath=SURNAME_CATALOG_PATH
}={}){
 if(!Array.isArray(expectedCodes)||!expectedCodes.length||
   new Set(expectedCodes).size!==expectedCodes.length||
   expectedCodes.some(code=>!/^[A-Z]{3}$/.test(code)))
  throw new Error('Expected a unique nonempty list of three-letter nationality codes');
 const givenCatalog=readJson(givenCatalogPath,'PLAYERS-03 catalog');
 validateCountries(givenCatalog.countries,expectedCodes,'PLAYERS-03');
 const given=new Map();
 for(const row of givenCatalog.countries){
  const full=countryFile(givenCatalogPath,row.external_file,'Given-name source');
  const bank=readJson(full,'given-name bank '+row.code);
  if(row.given_name_count!==bank.given_names?.length)
   throw new Error('Given-name catalog count mismatch: '+row.code);
  given.set(row.code,weightedBank(bank,row.code));
 }
 let surnameSource='temporary-demo-fallback',surnames=new Map();
 if(existsSync(surnameCatalogPath)){
  const catalog=readJson(surnameCatalogPath,'SURNAMES-01 catalog');
  if(catalog.kind!=='surnames'||catalog.selection_policy!=='uniform')
   throw new Error('SURNAMES-01 catalog must use uniform selection');
  validateCountries(catalog.countries,expectedCodes,'SURNAMES-01');
  for(const row of catalog.countries){
   // A 439 row has a repository-relative path. Read the nation file relative
   // to the selected local catalog root (including isolated test fixtures).
   if(row.path!=='data/players/surnames/countries/'+row.code+'.json')
    throw new Error('Surname catalog path mismatch: '+row.code);
   const full=countryFile(surnameCatalogPath,'countries/'+row.code+'.json','Surname source');
   const bank=readJson(full,'surname bank '+row.code);
   if(row.actual_count!==bank.surnames?.length)
    throw new Error('Surname catalog count mismatch: '+row.code);
   surnames.set(row.code,uniformBank(bank,row.code));
  }
  surnameSource='SURNAMES-01 uniform catalog';
 }
 return Object.freeze({given,surnames,surnameSource});
}

export function sampleGivenName(pools,code,rng){
 const bank=pools.given.get(code);
 if(!bank)throw new Error('Missing PLAYERS-03 given-name bank: '+code);
 const draw=rng()*bank.total;
 let lo=0,hi=bank.cumulative.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(draw<bank.cumulative[mid])hi=mid;else lo=mid+1;}
 return bank.values[lo];
}
export function sampleSurname(pools,code,rng,demoSurnames){
 const bank=pools.surnames.get(code);
 if(!pools.given.has(code))throw new Error('Unknown nationality: '+code);
 if(bank)return bank[Math.floor(rng()*bank.length)];
 if(pools.surnameSource!=='temporary-demo-fallback')
  throw new Error('Missing SURNAMES-01 surname bank: '+code);
 if(!Array.isArray(demoSurnames)||!demoSurnames.length)
  throw new Error('No temporary demo surname for '+code);
 return demoSurnames[Math.floor(rng()*demoSurnames.length)];
}
