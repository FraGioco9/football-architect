#!/usr/bin/env node
// DEBUG-DATA-01 I02: explicit local-only operator entry point.
// Default: IN-MEMORY plan only. No dataset is written unless --write-private.
import {readFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {dirname,join} from "node:path";
import {buildFiveSeasonCorpusCandidate} from "./debug-data-five-season-corpus.mjs";
import {planProtectedDebugExport} from "./debug-data-export-plan.mjs";
import {writeProtectedCandidate} from "./debug-data-protected-writer.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const args=process.argv.slice(2);
const flag=(name)=>{const i=args.indexOf(name);return i===-1?null:args[i+1]};
if(args.some(a=>a.startsWith("--")&&!["--seed","--dataset-id","--private-root","--write-private"].includes(a)))throw Error("unexpected option");
if(args.includes("--write-private")&&(!flag("--private-root")||process.env.CI==="true"||process.env.NODE_ENV==="production"))throw Error("explicit private root and local DEV required");
const seed=flag("--seed")??"debug-data-v1-fresh",datasetId=flag("--dataset-id")??"debug-corpus-v1";
const read=async path=>JSON.parse(await readFile(join(root,path),"utf8"));
const [baseline,divisions,cupCatalog]=await Promise.all([
 read("backend/catalogues/season-1.participants.json"),read("data/divisions.json"),read("data/international-competitions.json")]);
const corpus=buildFiveSeasonCorpusCandidate({baseline,divisions,cupCatalog,seed,datasetId});
const plan=planProtectedDebugExport(corpus);
const summary={kind:"debug-data-i02-unsealed-plan",datasetId,seasonNumbers:corpus.seasons.map(s=>s.seasonNumber),competitionFragments:plan.files.length,manifestHash:plan.manifestHash,status:corpus.status,activated:false};
if(args.includes("--write-private")){
 const result=await writeProtectedCandidate({corpus,protectedRoot:resolve(flag("--private-root")),explicitDevApproval:true});
 process.stdout.write(JSON.stringify({...summary,privateOutput:result.directory})+"\n");
}else process.stdout.write(JSON.stringify(summary)+"\n");
