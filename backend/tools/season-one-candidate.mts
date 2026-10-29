import {legacySeasonOneRules} from '../src/calendar-rules-compat.ts';
/** Offline review preparation only. Not imported by the Worker; no database or approval operation. */
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {validateSeasonOneSelection} from '../catalogues/season-one-selection.mjs';
import {snapshotHashes,validateApprovedSeasonOneSnapshot,type CanonicalCatalogue,type SnapshotBinding} from '../src/catalogue-snapshot.ts';

export const SOURCE_REVISION='c187d4ebfc0240515e79b4dbd9f3dceea3f293cc';
const root=fileURLToPath(new URL('../../',import.meta.url));
// Frozen review ancestry at SOURCE_REVISION; byte pins below track the approved calendar-compatible source layout.
// The reconstructed full rules and approval hashes remain those of that review; no new approval is granted.
const sourceChecksums:Readonly<Record<string,string>>={
 "data/clubs.json": "48a8e2ba8299ef49455630c052ac038b19bebafdab4ba134deb95da23dcf05b7",
 "data/divisions.json": "3a9de975a1916aefe19e0e85ba39dbec66a3cdb32fab6618a1e732976107d4b3",
 "data/international-competitions.json": "56ef86848e58010f31aeaba46fe5027dede3af2a33db4b558025cc8490f51f65",
 "backend/catalogues/season-1.participants.json": "f09cda2533f4cb8b77eac1fe5c5d96c992238530786ff49c7999715fc3770d93",
 "assets/world-calendar-model.js": "1d2461e0fff14afe0bd84b604ed7e75486710e8171abf710c446d4206f797f9b"
};
const sourcePaths=Object.keys(sourceChecksums);
const target='backend/catalogues/season-1.candidate.json';
const sha256=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');

/** Reject dirty/missing inputs: approval review is tied to these exact Git bytes, not HEAD labels. */
export async function readPinnedSeasonOneSources(repositoryRoot=root):Promise<Record<string,string>>{
 const sources:Record<string,string>={};
 for(const path of sourcePaths){
  const current=await readFile(resolve(repositoryRoot,path));
  if(sha256(current)!==sourceChecksums[path])throw Error(`Canonical source drift: ${path}`);
  sources[path]=current.toString('utf8');
 }
 return sources;
}

/** Reconcile real canonical inputs. A validation-only reference is discarded, never emitted as approval. */
export async function buildSeasonOneCandidate(sources:Record<string,string>){
 for(const path of sourcePaths){
  if(typeof sources[path]!=='string'||!sources[path].length)throw Error(`Missing canonical source: ${path}`);
  if(sha256(sources[path])!==sourceChecksums[path])throw Error(`Canonical source drift: ${path}`);
 }
 const selection=JSON.parse(sources['backend/catalogues/season-1.participants.json']);
 validateSeasonOneSelection(selection);
 const clubs=JSON.parse(sources['data/clubs.json']) as {countryId:string;clubId:string|number}[];
 const definitions=[...legacySeasonOneRules(JSON.parse(sources['data/divisions.json'])),...JSON.parse(sources['data/international-competitions.json'])];
 const catalogue:CanonicalCatalogue={
  clubIds:clubs.map(c=>`${c.countryId}-${c.clubId}`),
  competitions:definitions.map(c=>({id:c.id,rulesVersion:c.rules.version,rules:c.rules})),
 };
 const bindings:SnapshotBinding[]=selection.bindings.map((b:{competitionId:string;clubIds:string[]})=>({
  competitionId:b.competitionId,rulesVersion:catalogue.competitions.find(c=>c.id===b.competitionId)?.rulesVersion??'',clubIds:[...b.clubIds],
 }));
 const hashes=await snapshotHashes(bindings,catalogue);
 // Structural/hash reconciliation is not sporting-policy approval. Do not persist this branded result.
 await validateApprovedSeasonOneSnapshot({manifestVersion:1,approvalReference:'validation-only:pending-owner-review',bindings,...hashes},catalogue);
 return {
  schemaVersion:1,kind:'season-one-review-candidate',status:'pending-owner-review',productionApproval:false,
  sourceRevision:SOURCE_REVISION,
  sources:sourcePaths.map(path=>({path,sha256:sha256(sources[path])})),
  worldCalendar:{days:56,weeks:8,source:'assets/world-calendar-model.js',reference:'CAL-01 #236 / WORLD-TIME QA-06',status:'design-only-no-fixtures'},
  catalogue,
  manifest:{manifestVersion:1,approvalReference:null,bindings,...hashes},
 } as const;
}

/** Strict full-content comparison catches drift outside the two canonical manifest hashes as well. */
export async function verifySeasonOneCandidate(candidate:unknown,sources:Record<string,string>):Promise<void>{
 if(!isDeepStrictEqual(candidate,await buildSeasonOneCandidate(sources)))throw Error('Season 1 review candidate mismatch; candidate grants no production approval');
}

async function main(){
 const args=process.argv.slice(2);
 if(args.length>1||(args.length===1&&!['--check','--write'].includes(args[0])))throw Error('Usage: season-one-candidate.mts [--check | --write] (review only)');
 const sources=await readPinnedSeasonOneSources(),candidate=await buildSeasonOneCandidate(sources);
 if(args[0]==='--write')await writeFile(resolve(root,target),JSON.stringify(candidate,null,2)+'\n');
 else await verifySeasonOneCandidate(JSON.parse(await readFile(resolve(root,target),'utf8')),sources);
 process.stdout.write(`Season 1 candidate ${args[0]==='--write'?'written':'verified'}: pending-owner-review; candidate grants no production approval.\n`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 main().catch(error=>{process.stderr.write(`${error instanceof Error?error.message:'Candidate verification failed'}\n`);process.exitCode=1});
}
