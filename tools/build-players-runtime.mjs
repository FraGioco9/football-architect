#!/usr/bin/env node
// Regenerate Worker-compatible core directly from the canonical Node trial algorithm.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const src=readFileSync(new URL('./players-generation-trial.mjs',import.meta.url),'utf8');
let core=src.slice(src.indexOf('const rawCountries ='),src.indexOf('function spearman('));
if(!core.startsWith('const rawCountries')||!core.includes('const nationalNamePools=loadPlayerNamePools'))throw Error('Generator markers changed');
core=core.replace(/\/\/ PLAYERS-03 is in main;[^\n]*\n\/\/ This module runs local research previews only,[^\n]*\nconst nationalNamePools=loadPlayerNamePools\(\{expectedCodes:COUNTRIES\.map\(c=>c\.code\)\}\);\n/,'');
core=core.replace('function generateCandidate(rng,index,options,trialSeed){','function generateCandidate(rng,index,options,trialSeed,nationalNamePools){')
 .replace('export function generateTrial(options={}){','export function generateTrialWithCatalog(options={},nationalNamePools){')
 .replace('generateCandidate(rng,i,options,seed)','generateCandidate(rng,i,options,seed,nationalNamePools)');
const sampler="// Pure name samplers from tools/players-name-pools.mjs; no node:fs in Worker runtime.\nfunction sampleGivenName(pools,code,rng){\n const bank=pools.given.get(code);\n if(!bank)throw new Error('Missing PLAYERS-03 given-name bank: '+code);\n const draw=rng()*bank.total;\n let lo=0,hi=bank.cumulative.length-1;\n while(lo<hi){const mid=(lo+hi)>>1;if(draw<bank.cumulative[mid])hi=mid;else lo=mid+1;}\n return bank.values[lo];\n}\nfunction sampleSurname(pools,code,rng,demoSurnames){\n const bank=pools.surnames.get(code);\n if(!pools.given.has(code))throw new Error('Unknown nationality: '+code);\n if(bank)return bank[Math.floor(rng()*bank.length)];\n if(pools.surnameSource!=='temporary-demo-fallback')throw new Error('Missing SURNAMES-01 surname bank: '+code);\n if(!Array.isArray(demoSurnames)||!demoSurnames.length)throw new Error('No temporary demo surname for '+code);\n return demoSurnames[Math.floor(rng()*demoSurnames.length)];\n}\n";
const output='// GENERATED from tools/players-generation-trial.mjs. Keep numerical and identity algorithms identical.\n// Run: node tools/build-players-runtime.mjs (or --check).\n'+sampler+'\n'+core;
const path=new URL('../backend/src/players-generator-core.mjs',import.meta.url);
if(process.argv.includes('--check')){
 if(readFileSync(path,'utf8')!==output)throw Error('Outdated Worker player core; regenerate with node tools/build-players-runtime.mjs');
 console.log('Worker player core matches canonical Node generator');
}else{writeFileSync(path,output);console.log('Regenerated Worker player core')}
