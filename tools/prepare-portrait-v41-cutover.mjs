#!/usr/bin/env node
/** #646 — OFFLINE ONLY. Prepare (do not execute) a guarded V4.1 profile cutover.
 * User must provide a separately reviewed READ-ONLY export containing the
 * approved frozen INITIAL physical stats; current gameplay stats are not safe.
 * Outputs local SQL artifacts for later explicit owner-authorised D1 operations.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {
 prepareV41PortraitCutover,renderV41PortraitCutoverSQL,renderV41PortraitRollbackSQL
} from '../backend/src/player-portrait-v41-cutover.mjs';

async function main(){
 const args=process.argv.slice(2);
 if(args.length!==4||args[0]!=='--input'||args[2]!=='--out-prefix'){
  process.stderr.write('Usage: node tools/prepare-portrait-v41-cutover.mjs --input frozen-23-private.json --out-prefix ./private/portrait-v41\nNo D1 writes or remote calls.\n');
  process.exitCode=2;return;
 }
 const original=JSON.parse(readFileSync(args[1],'utf8'));
 const plan=await prepareV41PortraitCutover(original);
 const prefix=args[3];
 writeFileSync(prefix+'-apply.sql',renderV41PortraitCutoverSQL(plan),{flag:'wx',mode:0o600});
 writeFileSync(prefix+'-rollback.sql',renderV41PortraitRollbackSQL(plan),{flag:'wx',mode:0o600});
 writeFileSync(prefix+'-audit.json',JSON.stringify(plan.map(row=>({
  id:row.player_id,name:row.name,body:row.body_profile,
  fingerprint:row.appearance_fingerprint,asset_key:row.asset_key
 })),null,2)+'\n',{flag:'wx',mode:0o600});
 process.stdout.write('Prepared 23 guarded V4.1 replacement plans OFFLINE. Nothing applied.\n');
}
await main().catch(e=>{process.stderr.write('ABORT: '+e.message+'\n');process.exitCode=1;});
