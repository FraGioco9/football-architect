/**
 * Generic two-step handoff. Step 1 exports image-only descriptions.
 * No repository/QA/connector/image-target instructions enter the first message.
 * Frozen V4.1 canonical identity is reconstructed from verified initial stats.
 * Image generation still occurs only through a user-operated ChatGPT chat.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildDiverseV4PortraitSnapshotForPlayer,renderDiverseV4PortraitPromptFromSnapshot}
 from '../backend/src/player-portrait-diversity-v41.mjs';

export const IMAGE_ONLY_PROMPT_EXPORT_VERSION='image-only-chat-v2';

function verify(row){
 if(!row||typeof row!=='object'||Array.isArray(row)||
    !Number.isSafeInteger(row.id)||row.id<1||
    typeof row.name!=='string'||!row.name.trim()||row.name.length>200||
    /[\r\n<>]/.test(row.name)||row.initial_verified!==true)
   throw new TypeError('invalid_or_unverified_initial_player');
 return row;
}
function filename(row){
 const part=row.name.normalize('NFC').replace(/[^A-Za-z0-9 -]/g,'').trim().replace(/\s+/g,'-')||'player';
 return row.id+'-'+part+'.md';
}
function extractGenerationContent(canonical){
 const required=[
  /IMMUTABLE CANONICAL FACIAL DESCRIPTION:[\s\S]*?(?=\n\nPHYSIQUE:)/,
  /PHYSIQUE:[\s\S]*?(?=\n\nLook like an ordinary real adult male)/,
  /Look like an ordinary real adult male[\s\S]*?(?=\n\nExactly one subject)/,
  /Exactly one subject[\s\S]*?(?=\n\nPlain PURE WHITE)/,
  /Plain PURE WHITE[\s\S]*?(?=\n\nSource image)/,
  /Source image vertical 3:4[\s\S]*?(?=\n\nFinal downstream)/
 ];
 const parts=required.map(pattern=>canonical.match(pattern)?.[0]);
 if(parts.some(x=>!x))throw new Error('unexpected_v41_canonical_structure');
 // The immutable V4.1 source keeps the ID-derived face exactly as frozen.
 // Presentation-only age cue is independently versioned by image-only-chat-v2;
 // never infer an age from gameplay attributes or re-seed facial descriptors.
 const youngAppearance=parts[2].replace(
  'Look like an ordinary real adult male,',
  'Look like an ordinary real young male, approximately 21–25 years old,');
 if(youngAppearance===parts[2])throw new Error('unexpected_v41_age_wording');
 return [
  'Create exactly one NEW original ultra-photorealistic studio media-day portrait of a fictional young male footballer, approximately 21–25 years old. This is a new image generated solely from the following written visual description.',
  parts[0],parts[1],youngAppearance,...parts.slice(3),
  'Maintain the described facial details precisely. One person only. Photographic realism, natural soft lighting, direct camera gaze, full hair and head through hip level. No typography, graphics or collage.'
 ].join('\n\n')+'\n';
}
/**
 * Text of first image-only message; excludes player ID, name, metadata, QA
 * steps, connectors, legacy portraits and any edit/target-image instructions.
 */
export async function createImageOnlyPortraitPrompt(row){
 const player=verify(row);
 const snapshot=await buildDiverseV4PortraitSnapshotForPlayer(player);
 const canonical=await renderDiverseV4PortraitPromptFromSnapshot(snapshot);
 const content=extractGenerationContent(canonical);
 if(!content.includes('young male')||!content.includes('21–25 years old')||content.includes('adult male'))
   throw new Error('wrong_image_only_age_cue');
 if(/GitHub|Cloudflare|QA|WebP|existing image|reference image|ImageGen|GENERATION_UNAVAILABLE|input_image|Canva/i.test(content))
   throw new Error('nonvisual_instruction_in_image_only_prompt');
 return Object.freeze({
  id:player.id,name:player.name.trim(),bodyProfile:snapshot.body_profile,
  fingerprint:snapshot.appearance_fingerprint,fileName:filename(player),content
 });
}
/** Export one clean first-message file per verified player, no overwrite. */
export async function exportImageOnlyPortraitPrompts(rows,outputDirectory){
 if(!Array.isArray(rows)||rows.length===0||!outputDirectory)
   throw new TypeError('invalid_player_export_input');
 const ids=new Set(),out=[];
 for(const row of rows){
  verify(row);
  if(ids.has(row.id))throw new TypeError('duplicate_player_export_id');
  ids.add(row.id);
  out.push(await createImageOnlyPortraitPrompt(row));
 }
 const dir=resolve(outputDirectory);
 await mkdir(dir,{recursive:true});
 for(const x of out)
  await writeFile(join(dir,x.fileName),x.content,{encoding:'utf8',flag:'wx'});
 return out.map(({id,name,bodyProfile,fingerprint,fileName})=>({id,name,bodyProfile,fingerprint,fileName}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),i=args.indexOf('--input'),o=args.indexOf('--out');
 if(args.length!==4||i<0||o<0||!args[i+1]||!args[o+1]){
  console.error('Usage: node tools/export-player-image-prompts.mjs --input verified-initial-players.json --out image-only-prompts');
  process.exitCode=2;
 }else try{
  const rows=JSON.parse(await readFile(args[i+1],'utf8'));
  console.log(JSON.stringify(await exportImageOnlyPortraitPrompts(rows,args[o+1]),null,2));
 }catch(error){
  console.error(JSON.stringify({status:'FAIL',error:error.message}));
  process.exitCode=1;
 }
}
