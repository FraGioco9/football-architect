import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
 GIVEN_CATALOG_PATH,loadPlayerNamePools,sampleGivenName,sampleSurname
} from '../tools/players-name-pools.mjs';
import {COUNTRIES,generateTrial,summarize,selectDualNameOrigins} from '../tools/players-generation-trial.mjs';

function withFixture(fn){
 const root=mkdtempSync(join(tmpdir(),'fa-name-pools-'));
 const write=(path,data)=>{
  const full=join(root,path);mkdirSync(join(full,'..'),{recursive:true});
  writeFileSync(full,JSON.stringify(data)+'\n');return full;
 };
 try{return fn({root,write});}finally{rmSync(root,{recursive:true,force:true});}
}
function catalogs(ctx){
 const {write}=ctx;
 const countries=['ITA','ENG'];
 write('given/countries/ITA.json',{code:'ITA',given_names:[
  {value:'Giorgio',weight:9},{value:'Luigi',weight:1}
 ]});
 write('given/countries/ENG.json',{code:'ENG',given_names:[
  {value:'John',weight:2},{value:'David',weight:8}
 ]});
 const givenCatalogPath=write('given/catalog-v1.json',{countries:
  countries.map(code=>({code,external_file:'countries/'+code+'.json',given_name_count:2}))});
 return {countries,givenCatalogPath,surnameCatalogPath:join(ctx.root,'surname/catalog-v1.json')};
}
test('PLAYERS-03 real catalog: 50 national pools, 300 weighted names each',()=>{
 const pools=loadPlayerNamePools({expectedCodes:COUNTRIES.map(c=>c.code)});
 assert.equal(pools.given.size,50);
 for(const c of COUNTRIES){
  const bank=pools.given.get(c.code);
  assert.equal(bank.values.length,300);
  assert.ok(bank.total>=300);
  assert.ok(bank.cumulative.every((weight,i)=>weight>0&&(i===0||weight>bank.cumulative[i-1])));
  assert.ok(bank.values.includes(sampleGivenName(pools,c.code,()=>0.5)));
 }
 assert.ok(GIVEN_CATALOG_PATH.endsWith('data/players/names/catalog-v1.json'));
});
test('weighted given names and uniform compound surnames from synthetic 439 contract',()=>withFixture(ctx=>{
 const cfg=catalogs(ctx);
 ctx.write('surname/countries/ITA.json',{code:'ITA',kind:'surnames',selection_policy:'uniform',
  surnames:[{value:'Rossi'},{value:"van 't Hof"}]});
 ctx.write('surname/countries/ENG.json',{code:'ENG',kind:'surnames',selection_policy:'uniform',
  surnames:[{value:'Smith'},{value:'Davis'}]});
 ctx.write('surname/catalog-v1.json',{kind:'surnames',selection_policy:'uniform',countries:
  cfg.countries.map(code=>({code,path:'data/players/surnames/countries/'+code+'.json',actual_count:2}))});
 const pools=loadPlayerNamePools({...cfg,expectedCodes:cfg.countries});
 assert.equal(pools.surnameSource,'SURNAMES-01 uniform catalog');
 assert.equal(sampleGivenName(pools,'ITA',()=>0.00),'Giorgio');
 assert.equal(sampleGivenName(pools,'ITA',()=>0.89),'Giorgio');
 assert.equal(sampleGivenName(pools,'ITA',()=>0.91),'Luigi');
 assert.equal(sampleSurname(pools,'ITA',()=>0.00,['DEMO']),'Rossi');
 assert.equal(sampleSurname(pools,'ITA',()=>0.99,['DEMO']),"van 't Hof");
 assert.equal(sampleGivenName(pools,'ENG',()=>0.15),'John');
 assert.equal(sampleGivenName(pools,'ENG',()=>0.50),'David');
}));
test('archived uppercase surname tokens are display-cased without changing sampling order',()=>withFixture(ctx=>{
 const cfg=catalogs(ctx);
 const source=['MCDONALD','ABDALLAH','van der PLAAT','GALLI-McROSTIE',"O'BRIEN",
  'K-A','da Silva','I'];
 ctx.write('surname/countries/ITA.json',{code:'ITA',kind:'surnames',selection_policy:'uniform',
  surnames:source.map(value=>({value}))});
 ctx.write('surname/countries/ENG.json',{code:'ENG',kind:'surnames',selection_policy:'uniform',
  surnames:[{value:'Smith'}]});
 ctx.write('surname/catalog-v1.json',{kind:'surnames',selection_policy:'uniform',countries:[
  {code:'ITA',path:'data/players/surnames/countries/ITA.json',actual_count:source.length},
  {code:'ENG',path:'data/players/surnames/countries/ENG.json',actual_count:1}
 ]});
 const pools=loadPlayerNamePools({...cfg,expectedCodes:cfg.countries});
 assert.deepEqual(pools.surnames.get('ITA'),['McDonald','Abdallah','van der Plaat',
  'Galli-McRostie',"O'Brien",'K-A','da Silva','I']);
 assert.equal(sampleSurname(pools,'ITA',()=>0),'McDonald');
 assert.equal(sampleSurname(pools,'ITA',()=>0.99),'I');
 assert.deepEqual(source,['MCDONALD','ABDALLAH','van der PLAAT','GALLI-McROSTIE',
  "O'BRIEN",'K-A','da Silva','I'],'source records are not mutated');
}));

test('all national runtime surname pools avoid two-or-more-letter ALL-CAPS tokens',()=>{
 const pools=loadPlayerNamePools({expectedCodes:COUNTRIES.map(c=>c.code)});
 assert.equal(pools.surnames.size,50);
 for(const c of COUNTRIES){
  const values=pools.surnames.get(c.code);
  assert.ok(values.length>0,c.code);
  assert.equal(new Set(values.map(v=>v.toLocaleLowerCase('und'))).size,values.length,c.code);
  for(const value of values){
   for(const [token] of value.matchAll(/[\p{L}\p{M}]+/gu))
    assert.ok([...token].length<2 || token!==token.toLocaleUpperCase('und') ||
     token===token.toLocaleLowerCase('und'),c.code+': '+value);
  }
 }
});

test('missing 439 catalog only: explicit test/demo fallback',()=>withFixture(ctx=>{
 const cfg=catalogs(ctx),pools=loadPlayerNamePools({...cfg,expectedCodes:cfg.countries});
 assert.equal(pools.surnameSource,'temporary-demo-fallback');
 assert.equal(sampleSurname(pools,'ITA',()=>0.99,['Rossi','Bianchi']),'Bianchi');
 assert.throws(()=>sampleSurname(pools,'ITA',()=>0,[]),/No temporary demo surname/);
}));
test('corrupt present 439 bank fails instead of silently using demo',()=>withFixture(ctx=>{
 const cfg=catalogs(ctx);
 ctx.write('surname/countries/ITA.json',{code:'ITA',kind:'surnames',selection_policy:'uniform',
  surnames:[{value:'Rossi',weight:5}]});
 ctx.write('surname/countries/ENG.json',{code:'ENG',kind:'surnames',selection_policy:'uniform',
  surnames:[{value:'Smith'}]});
 ctx.write('surname/catalog-v1.json',{kind:'surnames',selection_policy:'uniform',countries:
  cfg.countries.map(code=>({code,path:'data/players/surnames/countries/'+code+'.json',actual_count:1}))});
 assert.throws(()=>loadPlayerNamePools({...cfg,expectedCodes:cfg.countries}),/Invalid unweighted surname entry/);
}));
test('malformed given weights and invalid code coverage fail fast',()=>withFixture(ctx=>{
 const cfg=catalogs(ctx);
 ctx.write('given/countries/ITA.json',{code:'ITA',given_names:[{value:'Giorgio',weight:0},{value:'Luigi',weight:1}]});
 assert.throws(()=>loadPlayerNamePools({...cfg,expectedCodes:cfg.countries}),/Invalid positive source name weight/);
 assert.throws(()=>loadPlayerNamePools({...cfg,expectedCodes:['ITA','ITA']}),/unique nonempty/);
}));
test('seeded generator uses catalog given names and does not affect attribute contract',()=>{
 const trial=generateTrial({count:100,seed:'catalog-identity-qa'});
 const same=generateTrial({count:100,seed:'catalog-identity-qa'});
 assert.deepEqual(trial,same);
 assert.equal(trial.identity_sources.given_names,'PLAYERS-03 weighted catalog');
 assert.ok(['SURNAMES-01 uniform catalog','temporary-demo-fallback'].includes(trial.identity_sources.surnames));
 const pools=loadPlayerNamePools({expectedCodes:COUNTRIES.map(c=>c.code)});
 for(const p of trial.candidates){
  const eligible=[p.nationality,...(p.secondary_nationality?[p.secondary_nationality]:[])];
  assert.ok(eligible.some(code=>pools.given.get(code).values.includes(p.first_name)));
  assert.equal(Object.hasOwn(p,'known_as'),false);
  assert.equal(p.display_name,`${p.first_name} ${p.last_name}`);
  assert.equal(Array.from(p.first_name)[0],Array.from(p.first_name)[0].toLocaleUpperCase('und'),
   p.nationality+' generated name starts uppercase');
  assert.ok(eligible.some(code=>(pools.surnames.get(code)??
   COUNTRIES.find(c=>c.code===code).demoLast).includes(p.last_name)));
 }
 const manual=generateTrial({count:1,primaryNationality:'ITA',firstName:'Manual',lastName:'Override'}).candidates[0];
 assert.equal(manual.first_name,'Manual');assert.equal(manual.last_name,'Override');
 assert.equal(manual.display_name,'Manual Override');
 assert.equal(Object.hasOwn(manual,'known_as'),false);
 assert.equal(Object.hasOwn(summarize(trial),'known_as'),false);
});


test('dual-name probability thresholds and manual-name marginal probabilities',()=>{
 const choose=(draw,firstManual=false,lastManual=false,hasSecondary=true)=>
  selectDualNameOrigins(hasSecondary,firstManual,lastManual,draw);
 const PP={first:'primary',last:'primary'},SP={first:'secondary',last:'primary'},
  PS={first:'primary',last:'secondary'},SS={first:'secondary',last:'secondary'};
 for(const [draw,want] of [[0,PP],[.499999,PP],[.5,SP],[.649999,SP],
  [.65,PS],[.899999,PS],[.9,SS],[.999999,SS]])
  assert.deepEqual(choose(draw),want);
 assert.deepEqual(choose(.9,false,false,false),PP);
 assert.deepEqual(choose(.9,true,true),PP);
 assert.deepEqual(choose(.3499,true,false),PS);
 assert.deepEqual(choose(.35,true,false),PP);
 assert.deepEqual(choose(.2499,false,true),SP);
 assert.deepEqual(choose(.25,false,true),PP);
 assert.throws(()=>choose(1),/Invalid dual-nationality name draw/);
 assert.throws(()=>choose(-.01),/Invalid dual-nationality name draw/);
 const counts={PP:0,SP:0,PS:0,SS:0};
 let secondarySurname=0,secondaryGiven=0;
 for(let i=0;i<10000;i++){
  const draw=(i+.5)/10000,o=choose(draw);
  const key=(o.first==='secondary'?'S':'P')+(o.last==='secondary'?'S':'P');
  counts[key]++;
  if(choose(draw,true,false).last==='secondary')secondarySurname++;
  if(choose(draw,false,true).first==='secondary')secondaryGiven++;
 }
 assert.deepEqual(counts,{PP:5000,SP:1500,PS:2500,SS:1000});
 assert.equal(secondarySurname,3500);
 assert.equal(secondaryGiven,2500);
});
test('dual names: forced/manual/allowed-set origin, manual precedence, seed and attribute isolation',()=>{
 const pools=loadPlayerNamePools({expectedCodes:COUNTRIES.map(c=>c.code)});
 const opts={count:240,seed:'dual-name-identity',primaryNationality:'ITA'};
 const plain=generateTrial({...opts,secondaryNationality:'none'}).candidates;
 const forced=generateTrial({...opts,secondaryNationality:'MAR'}).candidates;
 assert.deepEqual(forced,generateTrial({...opts,secondaryNationality:'MAR'}).candidates);
 const itaNames=new Set(pools.given.get('ITA').values),marNames=new Set(pools.given.get('MAR').values);
 const itaSurnames=new Set(pools.surnames.get('ITA')),marSurnames=new Set(pools.surnames.get('MAR'));
 let secondaryGiven=0,secondarySurname=0;
 const otherFields=({first_name,last_name,display_name,secondary_nationality,...other})=>other;
 for(let i=0;i<forced.length;i++){
  const p=forced[i],base=plain[i];
  assert.equal(p.nationality,'ITA');assert.equal(p.secondary_nationality,'MAR');
  assert.ok(itaNames.has(p.first_name)||marNames.has(p.first_name));
  assert.ok(itaSurnames.has(p.last_name)||marSurnames.has(p.last_name));
  if(marNames.has(p.first_name)&&!itaNames.has(p.first_name))secondaryGiven++;
  if(marSurnames.has(p.last_name)&&!itaSurnames.has(p.last_name))secondarySurname++;
  assert.deepEqual(otherFields(p),otherFields(base),'Name origin must not affect sports/age RNG');
  assert.equal(p.display_name,p.first_name+' '+p.last_name);
  assert.equal(Object.hasOwn(p,'known_as'),false);
 }
 assert.ok(secondaryGiven>10);
 assert.ok(secondarySurname>20);
 const manualFirst=generateTrial({...opts,count:90,secondaryNationality:'MAR',
  firstName:'Explicit'}).candidates;
 assert.ok(manualFirst.every(p=>p.first_name==='Explicit'&&
  (itaSurnames.has(p.last_name)||marSurnames.has(p.last_name))));
 const manualLast=generateTrial({...opts,count:90,secondaryNationality:'MAR',
  lastName:'Explicit'}).candidates;
 assert.ok(manualLast.every(p=>p.last_name==='Explicit'&&
  (itaNames.has(p.first_name)||marNames.has(p.first_name))));
 const manualBoth=generateTrial({...opts,count:5,secondaryNationality:'MAR',
  firstName:'Manual',lastName:'Surname'}).candidates;
 assert.ok(manualBoth.every(p=>p.first_name==='Manual'&&
  p.last_name==='Surname'&&p.display_name==='Manual Surname'));
 const allowed=generateTrial({...opts,count:120,secondaryNationality:['MAR','GER']}).candidates;
 assert.ok(allowed.every(p=>['MAR','GER'].includes(p.secondary_nationality)));
 for(const p of allowed){
  assert.ok(pools.given.get(p.nationality).values.includes(p.first_name)||
   pools.given.get(p.secondary_nationality).values.includes(p.first_name));
  assert.ok(pools.surnames.get(p.nationality).includes(p.last_name)||
   pools.surnames.get(p.secondary_nationality).includes(p.last_name));
 }
 const automatic=generateTrial({count:1000,seed:'dual-name-auto-integration'});
 for(const p of automatic.candidates){
  const eligible=[p.nationality,...(p.secondary_nationality?[p.secondary_nationality]:[])];
  assert.ok(eligible.some(code=>pools.given.get(code).values.includes(p.first_name)));
  assert.ok(eligible.some(code=>pools.surnames.get(code).includes(p.last_name)));
 }
 for(const invalid of [[],['MAR','MAR'],['ITA'],['UNKNOWN'],['MAR','ITA']])
  assert.throws(()=>generateTrial({...opts,count:1,secondaryNationality:invalid}),
   /Invalid allowed secondary nationalities/);
});

test('player JSON hides QA-only specialist and suitability diagnostics',()=>{
 const player=generateTrial({count:1,seed:'internal-json-visibility-01'}).candidates[0];
 assert.ok(['specialist','versatile','primary_only'].includes(player.trial_role_profile));
 assert.equal(typeof player.trial_primary_suitability_target,'number');
 assert.equal(typeof player.trial_primary_suitability_actual,'number');
 const json=JSON.stringify(player);
 const encoded=JSON.parse(json);
 for(const key of ['trial_role_profile','trial_primary_suitability_target','trial_primary_suitability_actual','known_as']){
  assert.equal(Object.hasOwn(encoded,key),false,'No internal/player JSON should contain '+key);
  assert.equal(Object.keys(player).includes(key),false);
 }
 assert.ok(Object.hasOwn(encoded,'attributes'));
 assert.equal(encoded.display_name,`${encoded.first_name} ${encoded.last_name}`);
});
