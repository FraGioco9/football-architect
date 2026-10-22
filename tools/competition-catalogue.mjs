import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve,dirname} from "node:path";
import rules from "../assets/competition-rules.js";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const load=name=>JSON.parse(readFileSync(resolve(root,"data",name),"utf8"));
export function loadCompetitionCatalogue(){
  const domestic=load("divisions.json");
  const international=load("international-competitions.json");
  if(domestic.length!==16||international.length!==2)throw new Error("Expected 16 domestic and 2 international competitions");
  const definitions=[...domestic,...international].map(rules.normalizeCompetition);
  const ids=new Set(),slugs=new Set();
  for(const competition of definitions){
    if(ids.has(competition.id)||slugs.has(competition.slug))throw new Error("Duplicate competition identity: "+competition.id);
    ids.add(competition.id);slugs.add(competition.slug);
    if(competition.category==="domestic"&&(competition.capacity!==16||competition.metrics.phases.league.rounds!==30||competition.metrics.phases.league.matches!==240))throw new Error("Unsupported domestic baseline: "+competition.id);
    if(competition.category==="international"&&(competition.capacity!==24||competition.metrics.phases.league.rounds!==6||competition.metrics.phases.league.matches!==72||competition.metrics.totalMatches!==93))throw new Error("Unsupported INT-24 baseline: "+competition.id);
  }
  return Object.freeze(definitions);
}
