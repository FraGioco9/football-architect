/** #629 — repository-only, offline portrait prompt manifest.
 * Canonical snapshots are ID-keyed and append-only. No Cloudflare, image API
 * or GitHub network operations are performed by this module or CLI.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildPortraitPrompt,buildPortraitSpecificationForPlayer,appearanceTraitsForPlayerId,COUNTRY_NAMES,PORTRAIT_SCHEMA_VERSION,PORTRAIT_PROMPT_VERSION} from './players-portrait-profiles.mjs';
import {describeAthleticBody} from './players-portrait-body.mjs';

const root=new URL('../',import.meta.url);
const manifestUrl=new URL('data/players/portrait-manifest.json',root);
const promptsUrl=new URL('data/players/portrait-prompts.json',root);
const templateUrl=new URL('data/players/portrait-templates/v3.txt',root);
const keys=['player_id','display_name','nationality','secondary_nationality','appearance_traits',
 'appearance_fingerprint','body_profile','body_conditioning','status','portrait_asset','appearance_profile'];
const outputKeys=['player_id','display_name','nationality','secondary_nationality','appearance_fingerprint',
 'appearance_profile','body_profile','body_conditioning','status','portrait_asset','portrait_prompt'];
const tokens=['NATIONALITY_BLOCK','APPEARANCE_PROFILE','BODY_DESCRIPTION'];

function object(value){
 return value!==null&&typeof value==='object'&&!Array.isArray(value);
}
function validateRoot(manifest){
 if(!object(manifest)||manifest.schema_version!==PORTRAIT_SCHEMA_VERSION||
    manifest.prompt_version!==PORTRAIT_PROMPT_VERSION||!object(manifest.players)||
    Object.keys(manifest).sort().join(',')!=='players,prompt_version,schema_version')
  throw new TypeError('invalid_portrait_manifest');
 return manifest;
}
function cleanId(id){
 if(typeof id!=='string'||!/^[1-9][0-9]*$/.test(id)||!Number.isSafeInteger(Number(id)))
  throw new TypeError('invalid_permanent_player_id');
 return Number(id);
}
function snapshotTraitsSentence(t){
 return `A ${t.face}, ${t.complexion}, ${t.hairColor} with ${t.hairTexture} in a ${t.hairStyle}, ${t.eyes}, ${t.eyebrows}, ${t.nose}, ${t.jaw}, ${t.facialHair}, and ${t.detail}.`;
}
function validateEntry(id,entry){
 if(!object(entry)||Object.keys(entry).sort().join(',')!==[...keys].sort().join(','))
  throw new TypeError('invalid_portrait_entry_shape');
 if(entry.player_id!==id||typeof entry.display_name!=='string'||!entry.display_name.trim()||
    entry.display_name.length>160||/[\x00-\x1f]/.test(entry.display_name))
  throw new TypeError('invalid_portrait_player');
 if(!Object.hasOwn(COUNTRY_NAMES,entry.nationality)||
    (entry.secondary_nationality!==null&&(!Object.hasOwn(COUNTRY_NAMES,entry.secondary_nationality)||
      entry.secondary_nationality===entry.nationality)))
  throw new TypeError('invalid_portrait_nationality');
 if(!object(entry.appearance_traits))throw new TypeError('invalid_portrait_traits');
 try{assert.deepStrictEqual(entry.appearance_traits,appearanceTraitsForPlayerId(id));}
 catch{throw new TypeError('noncanonical_portrait_traits');}
 if(entry.appearance_profile!==snapshotTraitsSentence(entry.appearance_traits))
  throw new TypeError('noncanonical_portrait_sentence');
 if(entry.status!=='approved'&&entry.status!=='pending')
  throw new TypeError('invalid_portrait_status');
 if(entry.status==='approved'){
  if(entry.portrait_asset!==`assets/players/portraits/${id}.webp`)
   throw new TypeError('invalid_approved_portrait_asset');
 }else if(entry.portrait_asset!==null)throw new TypeError('unapproved_portrait_asset');
 // This validates the ID-keyed facial fingerprint, identity sentence,
 // body descriptors and nationality against the canonical #609 planner.
 buildPortraitPrompt(entry);
 return entry;
}
function renderFromTemplate(template,entry){
 if(typeof template!=='string'||!template.length)throw new TypeError('missing_portrait_template');
 const nationalities=`Primary nationality: ${COUNTRY_NAMES[entry.nationality]}. `+
  (entry.secondary_nationality?`Secondary nationality: ${COUNTRY_NAMES[entry.secondary_nationality]}. `:'')+
  'These are citizenship/background context, NOT ethnicity or physical-feature rules. Secondary nationality does not imply mixed ancestry.';
 const values={NATIONALITY_BLOCK:nationalities,APPEARANCE_PROFILE:entry.appearance_profile,
  BODY_DESCRIPTION:describeAthleticBody(entry)};
 for(const token of tokens){
  if(template.split(`{{${token}}}`).length!==2)throw new TypeError('invalid_portrait_template_token_'+token);
 }
 let count=0;
 const rendered=template.trimEnd().replace(/{{([A-Z_]+)}}/g,(_,token)=>{
  if(!Object.hasOwn(values,token))throw new TypeError('unknown_portrait_template_token');
  count++;
  return values[token];
 });
 if(count!==tokens.length||rendered.includes('{{'))throw new TypeError('unresolved_portrait_template');
 return rendered;
}
export function compilePortraitPrompts(manifest,template){
 validateRoot(manifest);
 const players={};
 for(const key of Object.keys(manifest.players).sort((a,b)=>cleanId(a)-cleanId(b))){
  const id=cleanId(key),entry=validateEntry(id,manifest.players[key]);
  const portrait_prompt=renderFromTemplate(template,entry);
  if(portrait_prompt!==buildPortraitPrompt(entry))
   throw new TypeError('portrait_template_v3_drift');
  const output={};
  for(const field of outputKeys)output[field]=field==='portrait_prompt'?portrait_prompt:entry[field];
  players[key]=output;
 }
 return {schema_version:PORTRAIT_SCHEMA_VERSION,prompt_version:PORTRAIT_PROMPT_VERSION,players};
}
/** Extend a frozen manifest with ONLY previously unseen, committed numeric IDs
 * from an authorized read-only public export. Existing snapshots are untouched.
 */
export function appendCommittedPlayers(manifest,exported){
 validateRoot(manifest);
 const data=Array.isArray(exported)?exported:exported?.players;
 if(!Array.isArray(data)||data.length===0)throw new TypeError('missing_committed_players');
 const players={...manifest.players},seen=new Set();
 for(const player of data){
  if(!object(player)||Object.keys(player).some(k=>!['id','display_name','nationality','secondary_nationality','attributes'].includes(k))||
     !Number.isSafeInteger(player.id)||player.id<1||typeof player.display_name!=='string'||!player.display_name.trim()||
     !object(player.attributes)||Object.keys(player.attributes).sort().join(',')!=='agility,speed,stamina,strength')
   throw new TypeError('invalid_public_committed_player');
  if(seen.has(player.id))throw new TypeError('duplicate_committed_player');
  seen.add(player.id);
  if(Object.hasOwn(players,String(player.id)))continue; // frozen, never regenerate
  const spec=buildPortraitSpecificationForPlayer(player);
  players[String(player.id)]={
   player_id:player.id,display_name:player.display_name,nationality:spec.nationality,
   secondary_nationality:spec.secondary_nationality,
   appearance_traits:appearanceTraitsForPlayerId(player.id),
   appearance_fingerprint:spec.appearance_fingerprint,
   body_profile:spec.body_profile,body_conditioning:spec.body_conditioning,
   status:'pending',portrait_asset:null,appearance_profile:spec.appearance_profile
  };
 }
 return {...manifest,players:Object.fromEntries(Object.entries(players).sort(([a],[b])=>Number(a)-Number(b)))};
}
export function assertExistingPromptsUnchanged(previous,next){
 if(!object(previous)||!object(previous.players))throw new TypeError('invalid_existing_prompts');
 for(const [id,record] of Object.entries(previous.players)){
  if(!Object.hasOwn(next.players,id)||JSON.stringify(next.players[id])!==JSON.stringify(record))
   throw new Error('existing_portrait_prompt_is_immutable_'+id);
 }
}
const encode=obj=>JSON.stringify(obj,null,2)+'\n';
async function readOptional(url){
 try{return await readFile(url,'utf8');}
 catch(error){if(error?.code==='ENOENT')return null;throw error;}
}
async function cli(){
 const [mode,flag,input]=process.argv.slice(2);
 if(!['--check','--write','--sync'].includes(mode)||((mode==='--sync')!==(flag==='--input'&&!!input))||
    (mode!=='--sync'&&(flag!==undefined||input!==undefined)))
  throw new Error('usage: node tools/build-player-portrait-prompts.mjs --check | --write | --sync --input ./authorized-public-players.json');
 const manifest=JSON.parse(await readFile(manifestUrl,'utf8'));
 const template=await readFile(templateUrl,'utf8');
 const existing=await readOptional(promptsUrl);
 const nextManifest=mode==='--sync'?appendCommittedPlayers(manifest,JSON.parse(await readFile(input,'utf8'))):manifest;
 const next=compilePortraitPrompts(nextManifest,template),nextText=encode(next);
 if(mode==='--check'){
  if(existing!==nextText||encode(nextManifest)!==await readFile(manifestUrl,'utf8'))
   throw new Error('portrait_repository_files_out_of_sync');
 }else{
  if(existing!==null)assertExistingPromptsUnchanged(JSON.parse(existing),next);
  if(mode==='--sync')await writeFile(manifestUrl,encode(nextManifest),'utf8');
  await writeFile(promptsUrl,nextText,'utf8');
 }
 process.stdout.write(`Portrait prompts: ${Object.keys(next.players).length} entries, ${mode.slice(2)} OK.\n`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 cli().catch(error=>{console.error(error.message);process.exitCode=1;});
