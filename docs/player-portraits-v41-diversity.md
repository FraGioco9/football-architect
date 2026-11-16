# Player portraits V4.1 — natural facial diversity and deterministic compatibility

**Issue:** #646. **PR:** #648 (Draft/HOLD). **Status:** new opt-in
identity contract, no migration, no image/asset/D1 edits or publication.

## Why V4.1 is a distinct version

The original V4 seed `football-architect:portrait-identity:v4:<id>:0`
and every historical V4 snapshot are permanent. Existing approved pilot
portraits #82, #147, #64, #137, #65 and #151 must retain their V4
fingerprints. Changing an old trait option list in place would silently
change those frozen faces. Therefore V4.1 uses:

- Schema `player-portraits-v4`
- Prompt `player-portrait-v4.1`
- Seed prefix `football-architect:portrait-identity:v4.1`
- Separate builder/renderer and a separate ChatGPT handoff contract.
- No automatic dispatch of old snapshots through the new renderer.

Old V3 and V4 generators, snapshots and handoff functions remain in place.

## Face/hair traits (independent and reproducible)

V4 originally used 13 fields. V4.1 uses 24 descriptors: 23 weighted identity
pools plus a haircut selected conditionally on hair length and texture.

| V4.1 characteristic | Variants |
| --- | ---: |
| Face contours | 16 |
| Cheek fullness | 6 |
| Complexion | 10 |
| Eye colour | 8 |
| Eye shape | 8 |
| Eye spacing | 5 |
| Eyebrows | 8 |
| Nasal bridge | 7 |
| Nose tip | 6 |
| Jaw | 7 |
| Chin | 6 |
| Forehead | 6 |
| Mouth width/symmetry | 5 |
| Lips | 5 |
| Ears | 7 |
| Hair length | 5 |
| Hair texture | 7 |
| Hair colour | 9 |
| Hair density | 5 |
| Hairline | 6 |
| Haircut | Conditional: hair length × hair texture |
| Facial hair | 9 |
| Skin texture | 5 |
| Skin mark / detail | 8 |

Additional conditional `body_variation` provides two or three natural
variants of each of the five V4 physics-derived physique classes. It cannot
override that body class or be changed by stamina.

Weights bias toward ordinary footballer looks: brown/dark-brown eyes and
hair occur more often than rarer colours; short/very-short hair is
more common than longer cuts; a facial mole or scar is not obligatory;
hair density varies realistically. These are artistic weights for
variation and not claims about real demographic distributions.

**Compatibility:** Choosing `bald` forces `no visible scalp hair`, no
visible hair texture/density/hairline and a bald scalp instead of an
impossible haircut. For other subjects, the selected haircut comes from a
texture-group- and length-specific pool (straight, wavy, curly, coily).
Prompts keep each feature separately visible so the image generator
receives explicit bindings rather than a vague composite face adjective.

Faces never depend on nationality, secondary nationality, name, position,
gameplay age or body stats. Every prompt always says **adult male**;
there are no age bands or age fields. Natural human imperfection, no
fashion-model beauty lighting and no cosmetic skin smoothing remain binding.

## How to use and preserve snapshots

```js
import {buildDiverseV4PortraitSnapshotForPlayer} from '../backend/src/player-portrait-diversity-v41.mjs';
import {buildChatGptDiverseV4PortraitExecutionFromSnapshot} from '../backend/src/player-portrait-chatgpt.mjs';

// Supply only verified FROZEN INITIAL physical stats.
const snapshot=await buildDiverseV4PortraitSnapshotForPlayer(player);
const handoff=await buildChatGptDiverseV4PortraitExecutionFromSnapshot(snapshot);
// handoff.onePlayerPerInvocation === true
// handoff.requireQaBeforeNextInvocation === true
// handoff.toolOptions === {transparent_background:true}
```

The returned snapshot is *ephemeral* until a separately authorised versioned
migration. Do not alter approved V4 snapshots or use old V4 face traits as
references for V4.1 subjects. One generated image at a time, finish PNG/WebP
technical and strict facial identity QA first. Record PASS or PASS_WITH_NOTE
and automatically accept local candidate, but preserve the notes; retry a
FAIL only after its QA is recorded. A failure due to the effective image tool
using the wrong player/person is an unconditional identity FAIL, regardless
of mathematically valid frame/alpha.

## QA and release gates

Run exact-head targeted tests together with the existing V3/V4 suites:

    node --test tests/player-portrait-core.test.mjs tests/player-portrait-v4.test.mjs tests/player-portrait-v41-diversity.test.mjs tests/player-portrait-chatgpt.test.mjs

Checks cover the six old V4 pilot fingerprints, stable seeded ID-only
identities, 150-player diversity, deterministic weighted traits,
bald/hair-style compatibility, original V3 regression, strict snapshot
field and trait validation, age independence, no hidden AI/API calls,
and one-image-at-a-time handoff.

For actual images, also run `node tools/portrait-v4-qa.mjs --png ... --webp ...`.
The offline alpha/framing tools validate pixels, **not** the real person's
identity. Photograph QA must still verify hair shape, complexion, face
proportions, body plausibility, ordinary appearance and no duplicated
faces across ID candidates.

No existing published assets, V3 or V4 snapshots, DEV D1 rows or
Production data are changed by this code. Merge/deploy require
separate owner authorisation.
