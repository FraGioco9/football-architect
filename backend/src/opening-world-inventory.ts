/** #791 private, read-only inventory for a disposable local D1 rehearsal.
 * Never expose through an HTTP route or use this as a remote inventory command.
 * The caller must exclude concurrent writers until global staging guards exist.
 */
import type {Database} from './database.ts';
import {readOpeningObservation,openingDigest} from './opening-world-store.ts';
import {ATTRIBUTES,COUNTRIES,calculatePositionSuitability} from './players-generator-core.mjs';
import {projectPublicFootballerDirectoryRecord} from './footballer-public-projection.ts';
import {marketValueIndexVersion} from './player-market-value-index.ts';
import {renderFamilyV42PortraitPromptFromSnapshot} from './player-portrait-family-v42.mjs';

const positions=new Set('GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' '));
const countries=new Set(COUNTRIES.map(c=>c.code));
const insist=(ok:unknown,message:string)=>{if(!ok)throw Error(message)};
type Rights={id:number;mandate:number;contract:number};
async function readRights(db:Database){
 // #800 contract-only cutover: any signed term or mandate history blocks reuse.
 // Uncontracted players have no club assignment.
 const rows:Rights[]=[];
 for(let id=0;;){
  const page=(await db.prepare(`SELECT p.id,
   EXISTS(SELECT 1 FROM player_agent_mandates m WHERE m.player_id=p.id) AS mandate,
   EXISTS(SELECT 1 FROM player_signed_contracts c WHERE c.player_id=p.id) AS contract
   FROM generated_players p WHERE p.id>? ORDER BY p.id LIMIT 100`).bind(id).all<Rights>()).results;
  rows.push(...page);if(page.length<100)break;id=page[page.length-1].id;
 }
 // Deliberately conservative: any retained sporting history prevents an
 // automatic fresh-world certification. Do not guess individual appearances.
 const history=!!(await db.prepare(`SELECT 1 WHERE EXISTS(SELECT 1 FROM seasons)
  OR EXISTS(SELECT 1 FROM season_archives) OR EXISTS(SELECT 1 FROM match_lineup_result_receipts)`).first());
 return {rows,history};
}
export async function readLocalOpeningInventory(db:Database){
 const observation=await readOpeningObservation(db),w=observation.world;
 insist(w.seasonNumber===0&&w.revision===0&&w.day===0&&w.phase==='unstarted','opening inventory requires Season 0');
 insist(!(await db.prepare('SELECT 1 FROM opening_world_runs WHERE world_generation=? AND batch_index=-1').bind(w.generation).first()),'opening inventory already frozen');
 const rights=await readRights(db),version=await marketValueIndexVersion();
 insist(rights.rows.length===observation.rawRows.length&&rights.rows.every((row,i)=>row.id===observation.rawRows[i].id),'opening inventory rights changed');
 const players=[];
 for(const [i,row] of observation.rawRows.entries()){
  const r=rights.rows[i],p=JSON.parse(row.payload_json),snapshot=JSON.parse(row.snapshot_json);
  // Malformed identities block the entire inventory rather than silently losing
  // a player. Canonical projection checks every public field/attribute.
  const publicRecord=projectPublicFootballerDirectoryRecord(p,{publicId:row.id,currentAge:p.age});
  insist(p.id===row.id&&Number.isSafeInteger(p.age)&&p.age>=16&&p.age<=40&&countries.has(p.nationality)&&positions.has(p.primary_position)&&['active','retired'].includes(p.career_status),'invalid existing player identity');
  insist(ATTRIBUTES.every(key=>Number.isInteger(p.attributes?.[key])&&p.attributes[key]>=1&&p.attributes[key]<=99),'invalid existing attributes');
  const primarySuitability=calculatePositionSuitability(publicRecord.attributes,p.primary_position);
  const hasSportingHistory=row.entry_season!==0||p.age!==p.initial_age;
  // A reset can erase prior official receipts. An older-generation identity
  // cannot prove absence of history here; retain it for explicit reconciliation.
  const currentGeneration=row.world_generation===w.generation;
  const lifecycle=Number.isSafeInteger(p.retirement_age)&&p.retirement_age>=33&&p.retirement_age<=40&&p.retirement_age>p.age;
  let portraitValid=false;
  try{
   if(row.schema_version==='player-portraits-v5'&&row.prompt_version==='player-portrait-v4.2'&&snapshot.player_id===row.id&&snapshot.nationality===p.nationality&&snapshot.secondary_nationality===(p.secondary_nationality??null)){
    await renderFamilyV42PortraitPromptFromSnapshot(snapshot);
    portraitValid=['pending','approved'].includes(row.status)&&(row.status==='approved'?typeof row.asset_key==='string'&&row.asset_key.length>0:row.asset_key===null);
   }
  }catch{/* require reconciliation; never overwrite the portrait */}
  const indexValid=row.config_version===version&&row.market_value_arc===publicRecord.market_value_arc;
  const readyForReuse=currentGeneration&&!rights.history&&!hasSportingHistory&&!r.mandate&&!r.contract&&p.career_status==='active'&&lifecycle&&portraitValid&&indexValid;
  players.push({id:row.id,age:p.age as number,primaryNationality:p.nationality as string,primaryPosition:p.primary_position as string,primarySuitability,clubKey:null,representation:r.mandate?'human':r.contract?'unknown':'ai',careerStatus:p.career_status as string,hasSignedContract:!!r.contract,hasSportingHistory,hasApprovedPortrait:portraitValid&&row.status==='approved',readyForReuse,fingerprint:observation.rows[i].fingerprint});
 }
 // Read both sources again to detect changes during the paginated read.
 // This is not a substitute for a future transactional cross-writer lock.
 const after=await readOpeningObservation(db),rightsAfter=await readRights(db);
 insist(JSON.stringify(after.world)===JSON.stringify(w)&&after.idHighWater===observation.idHighWater&&JSON.stringify(after.rows)===JSON.stringify(observation.rows)&&JSON.stringify(rightsAfter)===JSON.stringify(rights),'opening inventory changed');
 insist(!(await db.prepare('SELECT 1 FROM opening_world_runs WHERE world_generation=? AND batch_index=-1').bind(w.generation).first()),'opening inventory already frozen');
 const payload={worldGeneration:w.generation,worldRevision:w.revision,idHighWater:observation.idHighWater,players};
 return {schema:'opening-inventory-v1',...payload,snapshotId:await openingDigest(payload),complete:true};
}
