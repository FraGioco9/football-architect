import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
 GIVEN_CATALOG_PATH,loadPlayerNamePools,sampleGivenName,sampleSurname
} from '../tools/players-name-pools.mjs';
import {COUNTRIES,generateTrial,summarize} from '../tools/players-generation-trial.mjs';

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
  assert.ok(pools.given.get(p.nationality).values.includes(p.first_name));
  assert.equal(Object.hasOwn(p,'known_as'),false);
  assert.equal(p.display_name,`${p.first_name} ${p.last_name}`);
  const surname=pools.surnames.get(p.nationality);
  if(surname)assert.ok(surname.includes(p.last_name));
  else assert.ok(COUNTRIES.find(c=>c.code===p.nationality).demoLast.includes(p.last_name));
 }
 const manual=generateTrial({count:1,primaryNationality:'ITA',firstName:'Manual',lastName:'Override'}).candidates[0];
 assert.equal(manual.first_name,'Manual');assert.equal(manual.last_name,'Override');
 assert.equal(manual.display_name,'Manual Override');
 assert.equal(Object.hasOwn(manual,'known_as'),false);
 assert.equal(Object.hasOwn(summarize(trial),'known_as'),false);
});

test('all 300 Brazilian generated first names retain uppercase initials',()=>{
 const pools=loadPlayerNamePools({expectedCodes:COUNTRIES.map(c=>c.code)});
 const values=pools.given.get('BRA').values;
 assert.equal(values.length,300);
 assert.ok(values.every(n=>Array.from(n)[0]===Array.from(n)[0].toLocaleUpperCase('und')));
 assert.equal(values[0],'Jose');
 assert.equal(values[1],'Joao');
 const trial=generateTrial({count:50,seed:'brazil-uppercase-qa',primaryNationality:'BRA'});
 for(const p of trial.candidates){
  assert.equal(p.first_name[0],p.first_name[0].toLocaleUpperCase('und'));
  assert.equal(p.display_name,p.first_name+' '+p.last_name);
  assert.equal(Object.hasOwn(p,'known_as'),false);
 }
});

test('Brazil, Portugal and Spain never generate aliases',()=>{
 for(const code of ['BRA','POR','ESP']){
  const rows=generateTrial({count:8,seed:'canonical-name-'+code,primaryNationality:code}).candidates;
  for(const p of rows){
   assert.equal(Object.hasOwn(p,'known_as'),false);
   assert.equal(p.display_name,`${p.first_name} ${p.last_name}`);
  }
 }
});
