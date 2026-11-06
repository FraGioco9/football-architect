# Football Architect — Public footballer JSON contract (proposal / DRAFT)

This contract covers **fictional footballers**, not registered Player accounts.

## Trust boundary

The player generator's \`generateTrial\` export is an internal tool. Its output
contains seed/replay information, source notes, aptitude and full numerical
attributes, and MUST NOT be copied into publicly served JSON files or sent to
an anonymous browser client.

When a persistent footballer store and footballer endpoint are implemented, the
server must build allowlisted JSON responses using
\`projectPublicFootballerCard\` (roster lists) or
\`projectPublicFootballerProfile\` (player profiles), located at
\`backend/src/footballer-public-projection.ts\`. The projector is server-side;
hiding DOM elements or stripping fields after the response arrives is not safe.

## Default public fields (conservative)

| Field | Roster | Profile |
| --- | --- | --- |
| \`id\` | yes, from authoritative server context | yes |
| \`display_name\` | yes, computed as \`first_name + ' ' + last_name\` | yes |
| \`nationality\` | yes | yes |
| \`primary_position\` | yes | yes |
| \`age\` | only if computed at the viewed date/season | only if computed |
| \`career_status\` | yes, if present | yes |
| \`secondary_positions\` | no | yes |
| \`height_cm\`, \`preferred_foot\` | no | yes |

**Internal / never anonymously projected by default:** \`first_name\`,
\`last_name\` as separate raw fields, \`initial_age\`, \`known_as\`, any
\`attributes\` (all 20 for now), \`development_aptitude\`,
\`trial_primary_suitability_target\`, \`trial_primary_suitability_actual\`,
\`trial_role_profile\`, \`seed\`, \`ranking_snapshot\`, \`identity_sources\`,
\`preview_id\`, \`trial_only\`, \`persisted\`, original catalog weights,
and any unknown future field.

Public \`id\` MUST be an authoritative persistent ID, never \`trial-####\`.
The current public interfaces have no footballer read endpoint, and this
document does **not** create one. These defaults can be refined for a
role-based and scouting-visible profile later; never expose unpublished fields
by default.

## Contract enforcement

1. The server chooses the view and computes current age from canonical
   sporting state. Client query parameters must not request hidden fields.
2. Project before \`httpJson('public',...)\`; do not serialize full generated
   or database records.
3. Never ship source full-data JSON under public static assets.
4. Test exact output keys and inject unexpected private fields to verify
   they cannot pass through the allowlist.
5. Admin/research access, if ever needed, belongs to a separately
   authenticated endpoint with authorization and privacy audit.

The internal generator, research exports and protected persistence schema are
unchanged. No production endpoint, DB write or deploy is authorized.
