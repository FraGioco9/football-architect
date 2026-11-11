import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {generateTrial,summarize} from '../tools/players-generation-trial.mjs';
import {loadPlayerNamePools} from '../tools/players-name-pools.mjs';
import {generateTrialWithCatalog,summarize as summarizeWorker} from '../backend/src/players-generator-core.mjs';
import {loadRuntimePlayerCatalog} from '../backend/src/players-catalog.mjs';

test('Worker player engine source is regenerated from the canonical Node generator',()=>{
 const output=execFileSync(process.execPath,['tools/build-players-runtime.mjs','--check'],{encoding:'utf8'});
 assert.match(output,/matches canonical Node generator/);
});
test('Worker and CLI player previews match exactly across countries, options, roles and seeds',()=>{
 const workerPools=loadRuntimePlayerCatalog();
 const localPools=loadPlayerNamePools({expectedCodes:[
  'ESP','ARG','FRA','ENG','POR','BRA','MAR','BEL','NED','MEX','COL','SUI','GER','CRO','ITA','USA','JPN','SEN','NOR','URU','DEN','AUT','IRN','ECU','EGY','AUS','CAN','ALG','CIV','NGA','TUR','KOR','PAR','SWE','RUS','UKR','POL','HUN','WAL','COD','GRE','CMR','SCO','SRB','SVK','PAN','MLI','RSA','VEN','CHI'
 ]});
 assert.equal(workerPools.given.size,50);assert.equal(workerPools.surnames.size,50);
 assert.equal(workerPools.surnameSource,localPools.surnameSource);
 for(const code of workerPools.given.keys()){
  assert.deepEqual(workerPools.given.get(code),localPools.given.get(code),'Given names '+code);
  assert.deepEqual(workerPools.surnames.get(code),localPools.surnames.get(code),'Surnames '+code);
 }
 for(const options of [
  {count:6,seed:'parity-1'},{count:65,seed:'parity-2'},{count:1,seed:'it-striker',primaryNationality:'ITA',primaryPosition:'ST',age:18,primarySuitability:75},
  {count:10,seed:'korean-keeper',primaryNationality:'KOR',primaryPosition:'GK',height:[175,190]},
  {count:12,seed:'manual-names',firstName:'Luigi',lastName:'De Luca',secondaryNationality:'none'},
  {count:4,seed:'french-suitability',primaryNationality:'FRA',preferredFoot:'left',attributes:{shooting:[65,80]},developmentAptitude:[50,90]}
 ]){
  const expected=generateTrial(options),actual=generateTrialWithCatalog(options,workerPools);
  assert.deepEqual(actual,expected,'All generated candidates must match canonical Node output');
  assert.deepEqual(summarizeWorker(actual),summarize(expected));
 }
});
