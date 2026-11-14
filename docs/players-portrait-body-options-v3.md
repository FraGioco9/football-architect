# PLAYER-PORTRAITS-02 — Body archetypes, conditioning and photographic prompt V3

**Status:** Specification and read-only DEV/Preview audit; PR [#609](https://github.com/FraGioco9/football-architect/pull/609) is **Draft/HOLD**. This document is descriptive, not a deployment, database migration, image-generation request or acceptance of generated photos.

**Code authority:** `tools/players-portrait-body.mjs` and `tools/players-portrait-profiles.mjs`. Schema `player-portraits-v2`, prompt `player-portrait-v3`.

## Inputs and invariants

| Input | Use | Exposed as a raw numeric value in image prompt? |
| --- | --- | --- |
| Numeric player ID | Stable SHA-256-based fictional facial identity and image association | No |
| Primary nationality | Citizenship/background context (does **not** establish ethnicity) | Country name only |
| Optional secondary nationality | Additional citizenship/background context, not presumed mixed ancestry | Country name only, if present |
| Appearance profile | Individual facial descriptor, stable for an approved player ID | Descriptive text only |
| Strength (1–99) | Modest volume/build adjustments | No |
| Speed (1–99) | Mobility contribution | No |
| Agility (1–99) | Mobility contribution | No |
| Stamina (1–99) | Subtle tone/conditioning adjustment only | No |
| Age, height, primary/secondary position, aptitude, technical skills | **Not used** | No |

`mobility = (speed + agility) / 2`. All four physical metrics must be integers in the inclusive **1–99** range. Invalid inputs fail closed.

## Body archetypes — first matching rule wins

| Priority | Key | Exact condition | Intended visual build | **Exact English fragment injected into the prompt** |
| --- | --- | --- | --- | --- |
| 1 | `power-athletic` | `strength >= 72 && strength - mobility >= 8` | Slightly sturdier shoulders/arms, no overmuscular physique | A slightly sturdier footballer build, with modestly broader shoulders and somewhat fuller arms, never bulky. |
| 2 | `lean` | `mobility >= 72 && strength <= 47` | Slimmer torso/arms | A naturally slim footballer build with a relatively narrow upper body and relaxed, modestly developed arms. |
| 3 | `lean-athletic` | `mobility >= 67 && strength < 72` | Slim and toned | A lean footballer build with gentle athletic definition and proportionate shoulders and arms. |
| 4 | `balanced-athletic` | Otherwise | Proportionate natural build | A balanced footballer build with average athletic shoulders, torso and arms, without pronounced bulk. |

Always append the global constraint, **verbatim**:

> Every build remains a plausible lean-to-moderate footballer physique, not a bodybuilder, fitness model or caricature.

These are modest visual cues, **not** scientific inferences of muscle mass from player ratings. No class implies a caricature.

### Illustrative synthetic combinations

| Strength | Speed | Agility | Stamina | Mobility | Body profile | Conditioning |
| ---: | ---: | ---: | ---: | ---: | --- | --- |
| 88 | 50 | 50 | 90 | 50.0 | power-athletic | endurance |
| 35 | 90 | 90 | 30 | 90.0 | lean | subtle |
| 58 | 85 | 83 | 55 | 84.0 | lean-athletic | natural |
| 58 | 58 | 58 | 70 | 58.0 | balanced-athletic | natural |

## Conditioning — determined only by Stamina

| Key | Stamina | Physical effect | **Exact English fragment injected into the prompt** |
| --- | --- | --- | --- |
| `subtle` | 1–34 | Understated natural definition | Keep muscle definition understated and natural. |
| `natural` | 35–74 | Normal football-trained tone | Show natural, moderate football-trained muscle tone without pronounced definition. |
| `endurance` | 75–99 | Slightly clearer tone, **without additional bulk** | Use slightly clearer but still subtle muscle tone, without increasing bulk or implying a different physique. |

The composite body paragraph is: `{BODY_ARCHETYPE_FRAGMENT} {CONDITIONING_FRAGMENT} {GLOBAL_CONSTRAINT} Natural facial asymmetry, skin texture and imperfections.`

## Complete prompt V3 — structured template

The following text follows the output of `buildPortraitPrompt`. Dynamic placeholders are replaced for each player, **not** sent literally to the image model:

```text
Create an ultra-photorealistic official club media-day photograph of EXACTLY ONE fictional adult male association football player.

Primary nationality: {PRIMARY_NATIONALITY}. {OPTIONAL_SECONDARY_NATIONALITY}These are citizenship/background context, NOT ethnicity or physical-feature rules. Secondary nationality does not imply mixed ancestry.
Individual appearance reference: {APPEARANCE_PROFILE}

{BODY_ARCHETYPE_FRAGMENT} {CONDITIONING_FRAGMENT} Every build remains a plausible lean-to-moderate footballer physique, not a bodybuilder, fitness model or caricature. Natural facial asymmetry, skin texture and imperfections.

Wear a completely plain pure-white short-sleeved football jersey with a regular, comfortable match fit, realistic lightweight fabric, subtle seams and natural folds. No logos, crests, sponsors, numbers, stripes, colored trim, or text.

Stand upright, head and torso facing directly forward, level shoulders, relaxed arms resting naturally beside the body, neutral expression and direct eye contact. Show the entire head, shoulders, torso and waist DOWN TO HIP LEVEL, including both sides of the body. Keep a consistent camera distance and centered vertical 3:4 framing.

Authentic professional football media-day photography, soft balanced studio lighting, accurate anatomy and facial details, natural colors, not a CGI render or fashion advertisement.

CRITICAL IMAGE COMPOSITION: Render exactly ONE individual portrait for this player. Never make a group portrait, collage, triptych, contact sheet or multiple panels. Treat the individual appearance reference as binding: keep the specified complexion, eye color, hair color, hair texture, haircut, facial hair and face structure. Do not replace these traits with a generic athlete's face, and do not reuse a previous player's face. Maintain comfortable transparent padding around all hair, shoulders and arms and a consistent bottom crop at hip level.

GENUINELY TRANSPARENT BACKGROUND WITH ALPHA CHANNEL and clean, naturally antialiased hair edges, transparent RGBA PNG. No scenery, floor, colored backdrop, checkerboard texture or painted transparency, cast shadow, watermark or extra objects. NO CHROMATIC EDGE FRINGING: no red, yellow, magenta, blue or green outlines, colored halos, edge glow, matte spill or color contamination around the subject. Outside the silhouette must be completely transparent; partially transparent edges must blend only with the local subject color.
```

For a player without secondary nationality, omit the entire optional sentence. With a secondary nationality, inject `Secondary nationality: {SECONDARY_NATIONALITY}.` and a trailing space. Never instruct the model to resemble a named real footballer.

## Read-only Cloudflare DEV/Preview audit — 2026-11-14

**Database verified:** `football-architect-dev` (not Production). The query read `generated_players` only and was run as `SELECT`: **0 rows written; `changed_db=false`**. This is a dated snapshot; do not mistake it for a permanent player distribution.

| Profile | Real persisted players | Share |
| --- | ---: | ---: |
| balanced-athletic | 91 | 60.7% |
| lean-athletic | 36 | 24.0% |
| power-athletic | 20 | 13.3% |
| lean | 3 | 2.0% |
| **Total** | **150** | **100.0%** |

| Conditioning | Real persisted players |
| --- | ---: |
| natural | 108 |
| endurance | 33 |
| subtle | 9 |
| **Total** | **150** |

All 150 persisted player records had four valid physical metrics in the configured range. IDs span 44–193. No Admin drafts, private data, or direct Production DB queries were needed.

## Acceptance and limits

- All generated subjects must be **fictional adult men**, no intentional likeness to actual professional footballers.
- Every image must show the complete head **down to the hips**, arms at sides, **normal-fit pure-white short-sleeved jersey** without marks.
- Use consistent framing, neutral direct gaze, soft media-day light, **vertical 3:4 transparent PNG** with a true alpha channel (not a checkerboard painted into RGB).
- Keep the face stable for each permanent ID. Athletic attributes affect the **body descriptor only**, not the face seed.
- A stored approved image/manifest is a snapshot: attribute changes do **not** silently regenerate the approved photo.
- Vary facial appearance individually without treating nationalities as a phenotype or guaranteeing visible mixed heritage.
- Verify anatomical realism, image diversity, alpha and clipping **on actual generated photos**; unique text descriptors do not establish visual uniqueness.
- No merge, deploy, Cloudflare writes, D1 schema modification, paid image-generation, storage rollout or feature release has been authorized by this documentation.

## Reproducible offline use

```powershell
node --test tests/players-portrait-profiles.test.mjs
node --test tests/export-public-players-for-portraits.test.mjs

node tools/export-public-players-for-portraits.mjs --source https://preview.football-architect.workers.dev/ --output .\players-public.json
node tools/players-portrait-profiles.mjs --input .\players-public.json --output .\players-appearance-manifest.json
```

The offline CLI does **not** overwrite existing manifests. The anonymous public API may differ from the current DB; direct read-only DEV D1 access was verified separately for this audit.


## Image pilot QA — follow-up (2026-11-14)

The initial 3-photo test did **not** pass visual QA: similar facial structures and visible red/yellow segmentation fringe were observed. A separate attempted regeneration also failed to consistently honor single-player identity; some outputs repeated the #44 face and some returned multi-person composites or checkerboard-like backdrops. Those outputs are **NOT approved or published**, and this prompt update is not evidence of a successful image-generation rerun.

Acceptance for any future pilot requires **three individual 3:4 PNG images**, one each for real DEV player ID 44 (Giacinto Lello), 98 (Arthur Kiesel), and 145 (Steven Sellen), with faithful persistent `appearance_profile`, distinct faces, restrained build class, plain white jersey, head-to-hips framing, *real RGBA transparency* and no chromatic edge fringe. Reject repeated player identities, collages, explicit checkerboards, visible red/yellow halos, clipping and exaggerated physiques. Do not add assets or persist identity mappings until human review.
