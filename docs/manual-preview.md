# Manual Vercel Preview — Football Architect

## Status and activation

The only event trigger is **workflow_dispatch**. No push, PR, schedule, merge or hook automatically publishes anything. This workflow cannot be dispatched until its separate Draft PR is explicitly approved and merged into the default **main** branch (a GitHub Actions requirement). The configuration PR itself must **not** be merged without separate authorization.

The workflow publishes **only Preview**, never Production. It uses the existing project `football-architect` (project ID `prj_qyveVyWJlBQ0y7MQGu9cELxPlKf9`) under the team `fra-gioco9` without linking Git for automatic deploys.

### Permanent hostname

The fixed non-production alias is:

`https://football-architect-git-ux-01a-mobile-responsi-4c0ec6-fra-gioco9.vercel.app`

This alias already belongs to the project but currently points to a **BLOCKED** deployment; it is **not** a working preview yet. It is separate from the production project domain `project-55on0.vercel.app`. After a manual Preview reaches READY, the workflow updates this alias. For a future shorter hostname, first register and verify a separate project-owned, non-production alias and change the audited configuration in a reviewed PR. Never alias a Preview to the production domain.

### One-time preparation

1. In **Vercel Account Settings → Tokens**, create a dedicated access token with the narrowest team/project scope permitted. Do **not** put the token in chat or any GitHub issue/PR.
2. In **GitHub → FraGioco9/football-architect → Settings → Secrets and variables → Actions**, create a repository **Secret** named `VERCEL_TOKEN`. Paste the token there, not in a code file. The token cannot be read back from GitHub.
3. Vercel **Preview → Vercel CLI** stays enabled. **Production → REST API/Git/Deploy Hooks** stays disabled. Git and REST API may be disabled again for Preview after confirming CLI is enabled: this workflow requires only the Vercel CLI source.
4. Keep **Deployment Protection → Vercel Authentication** enabled. Safari may require Vercel login; a temporary share link can be generated separately for a person without access.
5. Restrict repository write permissions to trusted actors. This workflow only allows owner `FraGioco9` to dispatch, and GitHub runner secrets exist only in the publishing job.

### Running it after configuration PR activation

Open **Actions → Manual Vercel Preview → Run workflow**, select **main**, enter an existing same-repository PR number (for example `100`) and its **exact 40-character HEAD SHA**.

The first job, **without** the Vercel token, confirms that the PR is open, its HEAD is unchanged and the exact-head `Site checks` run succeeded. It checks out the immutable SHA, reruns the site contracts, validates division assets, stages only files from `stagePublicArtifact`, verifies those bytes with `assertPublicArtifact` and uploads the isolated public artifact.

The second job downloads only that artifact, rechecks the PR HEAD, and uses `vercel deploy --target=preview`. The Vercel API must report the expected project ID, READY state and a Preview (not Production) target. Only then, and if the PR SHA still matches, it remaps the pre-owned stable alias and writes both links into the GitHub Actions run summary. **No PR code is executed while the Vercel token is present.**

### Fail-closed and limitations

- Invalid owner/PR/SHA, missing CI or token, changed HEAD, invalid allowlist, Vercel failure, wrong deployment target or wrong alias owner: **fail without updating the stable alias**.
- If the provider creates a Preview but the subsequent API or alias gate fails, its one-time deployment URL may still exist; the stable alias remains unchanged. Clean up or inspect that Preview manually.
- Vercel may reject reassignment of a generated Git-branch alias. If so, create an explicitly owned dedicated non-production hostname in a separate reviewed change; the Preview itself need not be promoted.
- The stable URL remains protected by Vercel SSO. A share-link bypass may expire, but the alias does not.
- A passing Preview workflow is **not** approval to merge the PR or promote to Production. A physical iPhone Safari QA remains a separate acceptance step.
- Do not enable automatic Vercel Git Integration. Do not merge this configuration PR or manually trigger its workflow without explicit authorization.
