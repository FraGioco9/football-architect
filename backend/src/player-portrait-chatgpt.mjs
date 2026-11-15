/**
 * #635 — ChatGPT handoff for an already-frozen player portrait snapshot.
 *
 * Pure text/metadata only. This module NEVER generates images, reads D1, uploads
 * assets, writes player data or calls any AI service. The V3 canonical renderer
 * remains the sole authority for facial and body descriptions.
 */
import {renderPortraitPromptFromSnapshot} from './player-portrait-core.mjs';

export const CHATGPT_PORTRAIT_EXECUTION_VERSION='chatgpt-portrait-execution-v1';

// Tool arguments, not content for the image model. One tool invocation per ID;
// intentionally omit "n": no multi-image/batch request.
export const CHATGPT_PORTRAIT_TOOL_OPTIONS=Object.freeze({
 transparent_background:true
});

const BEFORE=[
 'CHATGPT IMAGE GENERATION — SINGLE PLAYER / SINGLE IMAGE.',
 'Generate this photograph directly with the ChatGPT image-generation tool.',
 'This request concerns exactly ONE fictional player. Run ONE independent image generation for this snapshot;',
 'never combine this request with another player into one collage or contact sheet.',
 'The canonical player description below is binding. Do not paraphrase, shorten, reinterpret or replace the specified traits.'
].join('\n');

const AFTER=[
 'CHATGPT-SPECIFIC EXECUTION GUARDS:',
 '- Produce exactly ONE standalone photographic portrait, not a graphic design, gallery, poster or multipanel image.',
 '- No names, player IDs, labels, captions, logos or text of any kind INSIDE the image.',
 '- Do not infer physical appearance from citizenship, surname, team, age or position; only the binding appearance description applies.',
 '- Never substitute a generic athlete, a previous generated face, or details from a different player.',
 '- Keep the specified face structure, complexion, eyes, eyebrows, nose, jaw, hair colour/texture/style, facial hair and natural detail.',
 '- Plain pure-white, unbranded short-sleeved football jersey; relaxed arms at sides, front-facing neutral expression and direct eye contact.',
 '- Show the ENTIRE head through the HIPS with both sides of torso/arms visible, centered, evenly lit, consistent vertical 3:4 crop.',
 '- Request real alpha transparency, NOT a drawn checkerboard or a white/grey painted backdrop. No background pixels outside the silhouette.',
 '- Leave transparent padding around hair, shoulders and arms; avoid halos/fringing, shadows and extraneous objects.',
 '- If the generator cannot supply correct transparent PNG RGBA, do not describe its opaque output as approved.'
].join('\n');

/**
 * Return an explicit ChatGPT-only handoff: identity stays in the immutable
 * snapshot; ID stays in review metadata rather than being rendered as text.
 * Callers must independently invoke the ChatGPT image tool for each player.
 */
export async function buildChatGptPortraitExecutionFromSnapshot(snapshot){
 // Validation, version pinning and fingerprint verification live in the
 // canonical V3 renderer and MUST happen before returning anything.
 const canonicalPrompt=await renderPortraitPromptFromSnapshot(snapshot);
 return Object.freeze({
  playerId:snapshot.player_id,
  portraitPromptVersion:snapshot.prompt_version,
  executionVersion:CHATGPT_PORTRAIT_EXECUTION_VERSION,
  renderer:'chatgpt-image-generation',
  onePlayerPerInvocation:true,
  toolOptions:CHATGPT_PORTRAIT_TOOL_OPTIONS,
  desiredAspectRatio:'3:4',
  prompt:`${BEFORE}\n\n--- CANONICAL V3 PROMPT (VERBATIM) ---\n${canonicalPrompt}\n--- END CANONICAL V3 PROMPT ---\n\n${AFTER}`
 });
}
