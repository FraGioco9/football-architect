/**
 * #635 — ChatGPT handoff for an already-frozen player portrait snapshot.
 *
 * Pure text/metadata only. This module NEVER generates images, reads D1, uploads
 * assets, writes player data or calls any AI service. The V3 canonical renderer
 * remains the sole authority for facial and body descriptions.
 */
import {renderPortraitPromptFromSnapshot,renderV4PortraitPromptFromSnapshot} from './player-portrait-core.mjs';
import {renderDiverseV4PortraitPromptFromSnapshot} from './player-portrait-diversity-v41.mjs';

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


/** #646 Step C: independent V4 handoff. V3 exports and prompt remain untouched. */
export const CHATGPT_V4_PORTRAIT_EXECUTION_VERSION='chatgpt-portrait-execution-v2';

const V4_BEFORE=[
 'CHATGPT IMAGE GENERATION — V4 — SINGLE PLAYER / SINGLE IMAGE.',
 'Generate exactly ONE photographic portrait using the ChatGPT image-generation tool.',
 'The subject is always one fictional adult male football player, regardless of gameplay age.',
 'Treat the entire V4 canonical appearance below as BINDING; never paraphrase, shorten or substitute the specified traits.',
 'Run a single independent image invocation per player. No group, collage, triptych or contact sheet.',
 'Never reuse another player or an approved composition benchmark as a facial reference.'
].join('\n');

const V4_AFTER=[
 'CHATGPT-SPECIFIC V4 EXECUTION GUARDS:',
 '- Exactly ONE ordinary-looking fictional adult male. Do not infer face, maturity or physical appearance from gameplay age, name, nationality, surname, position or club.',
 '- Match the frozen V4 facial traits: complexion, face structure, eyes, brows, nose, jaw, ears, hairline, hair colour/texture/style, facial hair and natural skin detail.',
 '- Natural human asymmetry, realistic pores and ordinary imperfections. No fashion/fitness model styling, cosmetic retouching, beauty lighting, carved jawline, sculpted cheekbones, smoothing or idealized face.',
 '- Match the canonical V4 body profile. Do not add bulk or muscle definition based on stamina, football role or athletic stereotype.',
 '- Plain pure-white unbranded short-sleeved jersey with comfortable regular match fit. No body-sculpting fabric, logos, text, sponsorship, stripes, numbers or colored trims.',
 '- Front-facing, neutral expression, direct gaze, level shoulders, relaxed arms at sides, complete hair/head, both shoulders and arms, torso and hips visible. Centered 3:4 source framing.',
 '- For QA of the final 320 x 362 WebP, target 3–8 px top silhouette margin; absolute allowance 0–12 px only if hair is intact. Never impose derivative pixel counts on the original source image.',
 '- Request genuine native transparent PNG RGBA ALPHA, not white/grey backdrop, painted checkerboard, scenery, cast shadow, object or colored halo/fringing.',
 '- No player name, ID, text, label, caption or watermark inside the generated image.',
 '- A generated candidate is NOT approved until actual alpha/pixel QA, visual QA and owner acceptance.'
].join('\n');

/** Pure version-checked tool handoff; does not call an AI provider, D1 or filesystem. */
export async function buildChatGptV4PortraitExecutionFromSnapshot(snapshot){
 // Fail closed before assembling the execution prompt.
 const canonicalPrompt=await renderV4PortraitPromptFromSnapshot(snapshot);
 return Object.freeze({
  playerId:snapshot.player_id,
  portraitPromptVersion:snapshot.prompt_version,
  executionVersion:CHATGPT_V4_PORTRAIT_EXECUTION_VERSION,
  renderer:'chatgpt-image-generation',
  onePlayerPerInvocation:true,
  toolOptions:CHATGPT_PORTRAIT_TOOL_OPTIONS,
  desiredAspectRatio:'3:4',
  prompt:V4_BEFORE+'\n\n--- CANONICAL V4 PROMPT (VERBATIM) ---\n'+
   canonicalPrompt+'\n--- END CANONICAL V4 PROMPT ---\n\n'+V4_AFTER
 });
}


/**
 * Opt-in V4.1 diversified ChatGPT handoff.
 * V3 and approved V4 v4:0 handoff functions above are unchanged.
 */
export const CHATGPT_DIVERSE_V4_EXECUTION_VERSION='chatgpt-portrait-execution-v3';

export async function buildChatGptDiverseV4PortraitExecutionFromSnapshot(snapshot){
 const canonicalPrompt=await renderDiverseV4PortraitPromptFromSnapshot(snapshot);
 return Object.freeze({
  playerId:snapshot.player_id,
  portraitPromptVersion:snapshot.prompt_version,
  executionVersion:CHATGPT_DIVERSE_V4_EXECUTION_VERSION,
  renderer:'chatgpt-image-generation',
  onePlayerPerInvocation:true,
  requireQaBeforeNextInvocation:true,
  toolOptions:CHATGPT_PORTRAIT_TOOL_OPTIONS,
  desiredAspectRatio:'3:4',
  prompt:[
   'CHATGPT IMAGE GENERATION V4.1 — EXACTLY ONE INDIVIDUAL IMAGE FOR THIS PLAYER ONLY.',
   'ORIGINAL TEXT-TO-IMAGE CREATION ONLY: create from scratch without an input photo, image ID, existing portrait, mask or image reference. This is not editing, variation or restoration.',
   'The immutable written identity below is the ONLY authority for facial appearance. Never use an earlier player or existing image as a visual reference. Never produce a collage.',
   '--- CANONICAL V4.1 PROMPT (VERBATIM) ---',
   canonicalPrompt,
   '--- END CANONICAL V4.1 PROMPT ---',
   'EXECUTION GUARDS: Generate a single fictional adult male, never an age-specific subject or an idealized model. One image invocation only; do not batch or automatically generate a second.',
   'Use a genuinely transparent RGBA PNG cutout, not an opaque checkerboard. Follow all binding traits, especially complexion, hair texture, hair length, hairstyle and ordinary facial proportions.',
   'The output is a local candidate until real PNG alpha, final WebP geometry, trait consistency and visual QA are evaluated. Complete QA before considering another generation. PASS or PASS_WITH_NOTE may be locally accepted; FAIL must not be published. Publishing and D1 updates require separate authorization.'
  ].join('\n\n')
 });
}
