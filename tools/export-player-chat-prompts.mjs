/**
 * #646 — Export stand-alone V4.1 prompts: one new ChatGPT chat per player.
 * Deliberately read-only with respect to D1, GitHub, providers and assets.
 * Only accepts caller-verified FROZEN INITIAL attributes; no silent fallback.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
 buildDiverseV4PortraitSnapshotForPlayer
} from '../backend/src/player-portrait-diversity-v41.mjs';
import {
 buildChatGptDiverseV4PortraitExecutionFromSnapshot
} from '../backend/src/player-portrait-chatgpt.mjs';

export const CHAT_PROMPT_EXPORT_VERSION='single-player-chat-v1';

function requireRow(row){
 if(!row||typeof row!=='object'||Array.isArray(row)||
    !Number.isSafeInteger(row.id)||row.id<1||
    typeof row.name!=='string'||!row.name.trim()||row.name.length>200||
    /[\r\n<>]/.test(row.name)||row.initial_verified!==true)
  throw new TypeError('invalid_or_unverified_initial_player');
 return row;
}
function filePart(value){
 const p=value.normalize('NFC').replace(/[^A-Za-z0-9 -]/g,'').trim().replace(/\s+/g,'-');
 return p||'player';
}

/** This text is the ONLY thing the owner needs to paste into a fresh chat. */
export async function createSinglePlayerChatPrompt(row){
 const player=requireRow(row);
 const snapshot=await buildDiverseV4PortraitSnapshotForPlayer(player);
 const handoff=await buildChatGptDiverseV4PortraitExecutionFromSnapshot(snapshot);
 const title=player.id+' — '+player.name.trim();
 const header=[
  '# FOOTBALL ARCHITECT — NEW INDIVIDUAL PORTRAIT CHAT',
  '',
  'This entire chat is ONLY for '+title+'.',
  'Metadata for QA (NEVER render as text in the image):',
  'Player ID: '+player.id,
  'Player name: '+player.name.trim(),
  'Immutable appearance version: '+snapshot.prompt_version,
  'Immutable appearance fingerprint: '+snapshot.appearance_fingerprint,
  'Frozen physical class: '+snapshot.body_profile,
  'Prompt export version: '+CHAT_PROMPT_EXPORT_VERSION,
  '',
  'Start by generating EXACTLY ONE original PNG portrait of this one player.',
  'No collage, no contact sheet, no other footballer, no caption and no second image in the same generation.',
  'Follow the exact canonical appearance below. Do not copy an old published portrait, previous generated face or another person.',
  'Treat nationality and name as bookkeeping metadata only; facial features come exclusively from the canonical snapshot.',
  '',
  '===== FULL VERSIONED IMAGE PROMPT — APPLY VERBATIM =====',
  handoff.prompt,
  '===== END IMAGE PROMPT =====',
  '',
  'AFTER THIS SINGLE IMAGE:',
  '- Complete the technical QA of the ACTUAL PNG bytes if tools are available: real RGBA alpha, no painted checkerboard, complete hair/anatomy, source vertical 3:4. If exact pixel data are unavailable, explicitly report technical QA as NOT VERIFIED; do not invent PASS or margin numbers.',
  '- Make a centered 320x362 transparent WebP QA derivative without altering the face, and check decoded alpha, 3–8 px top-margin target (0–12 px only with intact hair), >=20 px transparent side room, centering, and colored edge fringes. Never claim this was measured unless the actual pixels were inspected.',
  '- Perform strict visual identity QA: exactly the specified complexion, face geometry, eyes, haircut texture/length/color, natural mouth/nose/ears, realistic body type, ordinary non-model face, regular-fit plain-white jersey. Wrong person is always FAIL even when dimensions are valid.',
  '- Report PASS, PASS CON NOTA or FAIL with the exact deviations. When BOTH technical and visual QA pass, automatically accept the candidate (retain notes) but DO NOT publish or update a database.',
  '- If FAIL, record why before considering a retry. Any retry must be a NEW single image, never an additional image in this same invocation, and must receive its own complete QA. Stop repeated wrong-person contamination.',
  '- Preserve the original generated PNG. Do not overwrite existing approved WebPs, update D1, merge a PR, or deploy. GitHub asset publication requires separate explicit authorisation.',
  '',
  'The only permitted age wording is: adult male. Produce exactly one portrait first.',
  ''
 ];
 return Object.freeze({
  id:player.id,name:player.name.trim(),bodyProfile:snapshot.body_profile,
  fingerprint:snapshot.appearance_fingerprint,
  fileName:player.id+'-'+filePart(player.name)+'.md',
  content:header.join('\n')
 });
}

/** Sequentially export one separate, self-contained prompt per player. */
export async function exportSinglePlayerChatPrompts(rows,outputDirectory){
 if(!Array.isArray(rows)||rows.length===0||!outputDirectory)
  throw new TypeError('invalid_player_export_input');
 const ids=new Set(),out=[];
 const dir=resolve(outputDirectory);
 // Verify all source identities before making even the output directory.
 for(const row of rows){
  requireRow(row);
  if(ids.has(row.id))throw new TypeError('duplicate_player_export_id');
  ids.add(row.id);
  out.push(await createSinglePlayerChatPrompt(row));
 }
 await mkdir(dir,{recursive:true});
 // 'wx' deliberately prevents overwriting a prior exported prompt.
 for(const candidate of out){
  await writeFile(join(dir,candidate.fileName),candidate.content,{encoding:'utf8',flag:'wx'});
 }
 return out.map(({id,name,bodyProfile,fingerprint,fileName})=>
  ({id,name,bodyProfile,fingerprint,fileName}));
}
function usage(){
 return 'Usage: node tools/export-player-chat-prompts.mjs --input verified-initial-players.json --out new-chat-prompts';
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 const idx=args.indexOf('--input'),oi=args.indexOf('--out');
 if(args.length!==4||idx<0||oi<0||!args[idx+1]||!args[oi+1]){
  console.error(usage());process.exitCode=2;
 }else try{
  const rows=JSON.parse(await readFile(args[idx+1],'utf8'));
  const list=await exportSinglePlayerChatPrompts(rows,args[oi+1]);
  console.log(JSON.stringify({total:list.length,output:resolve(args[oi+1]),players:list},null,2));
 }catch(error){
  console.error(JSON.stringify({status:'FAIL',error:error.message}));
  process.exitCode=1;
 }
}
