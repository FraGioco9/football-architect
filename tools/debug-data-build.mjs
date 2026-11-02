#!/usr/bin/env node
// DEBUG-DATA-01 I02: explicit local-only operator entry point.
// Default: IN-MEMORY plan only. No dataset is written unless --write-private.
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {dirname,join} from "node:path";
import {buildFiveSeasonCorpusCandidate} from "./debug-data-five-season-corpus.mjs";
import {planProtectedDebugExport} from "./debug-data-export-plan.mjs";
import {writeProtectedCandidate} from "./debug-data-protected-writer.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const allowTemporaryCiQa=()=>process.env.GITHUB_ACTIONS==="true"&&process.env.DEBUG_I02_PRIVATE_CI_QA==="1"&&Boolean(process.env.RUNNER_TEMP);
const args=process.argv.slice(2);
const known=new Set(["--seed","--dataset-id","--private-root","--write-private"]);
const options=new Map();
for(let i=0;i<args.length;i++){
 const name=args[i];
 if(!known.has(name)||options.has(name))throw Error("unknown or duplicate option: "+name);
 if(name==="--write-private"){options.set(name,true);continue;}
 const value=args[++i];
 if(!value||value.startsWith("--"))throw Error("missing option value: "+name);
 options.set(name,value);
}
if(options.has("--private-root")&&!options.has("--write-private"))throw Error("--private-root requires --write-private");
if(options.has("--write-private")&&(!options.get("--private-root")||(process.env.CI==="true"&&!allowTemporaryCiQa())||process.env.NODE_ENV==="production"))throw Error("explicit private root and local DEV required");
const seed=options.get("--seed")??"debug-data-v1-fresh",datasetId=options.get("--dataset-id")??"debug-corpus-v1";
const read=async path=>JSON.parse(await readFile(join(root,path),"utf8"));
const [baseline,divisions,cupCatalog]=await Promise.all([
 read("backend/catalogues/season-1.participants.json"),read("data/divisions.json"),read("data/international-competitions.json")]);
const corpus=buildFiveSeasonCorpusCandidate({baseline,divisions,cupCatalog,seed,datasetId});
const plan=planProtectedDebugExport(corpus);
const summary={kind:"debug-data-i02-unsealed-plan",datasetId,seasonNumbers:corpus.seasons.map(s=>s.seasonNumber),competitionFragments:plan.files.length,manifestHash:plan.manifestHash,status:corpus.status,activated:false};
if(options.has("--write-private")){
 const result=await writeProtectedCandidate({corpus,protectedRoot:resolve(options.get("--private-root")),explicitDevApproval:true});
 process.stdout.write(JSON.stringify({...summary,privateOutput:result.directory})+"\n");
}else process.stdout.write(JSON.stringify(summary)+"\n");
