# Manual Vercel Preview — Football Architect

## Status and activation

The only event trigger is **workflow_dispatch**. No push, PR, schedule, merge or hook automatically publishes anything. The manual workflow was integrated into **main** in PR #122. Any future alias change must be reviewed and merged separately; configuring a new alias does not trigger a workflow run.

The workflow publishes **only Preview**, never Production. It uses the existing project `football-architect` (project ID `prj_qyveVyWJlBQ0y7MQGu9cELxPlKf9`) under the team `fra-gioco9` without linking Git for automatic deploys.

### Permanent hostname

The requested short, non-production Preview alias is:

`https://football-architect-preview.vercel.app`

**Not active yet.** Vercel allocates `.vercel.app` hostnames on a first-come basis. Its availability cannot be guaranteed or reserved before the first READY Preview deployment. The workflow checks an existing alias belongs to this project or receives a definitive 404 before it attempts assignment. Vercel may still reject an unavailable name. After assignment, the workflow verifies that the alias points to the exact READY Preview deployment and the expected project; otherwise it fails. The immutable Preview URL remains available if the alias fails, but no Production domain is changed.

The previously provisioned Git-branch alias `football-architect-git-ux-01a-mobile-responsi-4c0ec6-fra-gioco9.vercel.app` currently points to a **BLOCKED** deployment and is left untouched. The project Production domain is `project-55on0.vercel.app`, which must never be modified by this workflow.

### One-time preparation

1. In **Vercel Account Settings → Tokens**, create a dedicated access token with the narrowest team/project scope permitted. Do **not** put the token in chat or any GitHub issue/PR.
2. In **GitHub → FraGioco9/football-architect → Settings → Secrets and variables → Actions**, create a repository **Secret** named `VERCEL_TOKEN`. Paste the token there, not in a code file. The token cannot be read back from GitHub.
3. Vercel **Preview → Vercel CLI** stays enabled. **Production → REST API/Git/Deploy Hooks** stays disabled. Git and REST API may be disabled again for Preview after confirming CLI is enabled: this workflow requires only the Vercel CLI source.
4. Keep **Deployment Protection → Vercel Authentication** enabled. Safari may require Vercel login; a temporary share link can be generated separately for a person without access.
5. Restrict repository write permissions to trusted actors. This workflow only allows owner `FraGioco9` to dispatch, and GitHub runner secrets exist only in the publishing job.

### Running the installed manual workflow

Open **Actions → Manual Vercel Preview → Run workflow**, select **main**, enter an existing same-repository PR number (for example `100`) and its **exact 40-character HEAD SHA**.

The first job, **without** the Vercel token, confirms that the PR is open, its HEAD is unchanged and the exact-head `Site checks` run succeeded. It checks out the immutable SHA, reruns the site contracts, validates division assets, stages only files from `stagePublicArtifact`, verifies those bytes with `assertPublicArtifact` and uploads the isolated public artifact.

The second job downloads only that artifact, rechecks the PR HEAD, and uses `vercel deploy --target=preview`. The Vercel API must report the expected project ID, READY state and a Preview (not Production) target. Only then, and if the PR SHA still matches, it attempts to claim or reassign the approved short Preview alias (with strict project ownership checks), verifies the final project/deployment mapping and writes the links into the GitHub Actions run summary. **No PR code is executed while the Vercel token is present.**

### Fail-closed and limitations

- Invalid owner/PR/SHA, missing CI or token, changed HEAD, invalid allowlist, Vercel failure, wrong deployment target or wrong alias owner: **fail without updating the stable alias**.
- If the provider creates a Preview but the subsequent API or alias gate fails, its one-time deployment URL may still exist; the stable alias remains unchanged. Clean up or inspect that Preview manually.
- Vercel may reject the short `.vercel.app` name because it is already in use. If so, select a different unused non-production Preview alias through a reviewed change. Never move a Production domain.
- The stable URL remains protected by Vercel SSO. A share-link bypass may expire, but the alias does not.
- A passing Preview workflow is **not** approval to merge the PR or promote to Production. A physical iPhone Safari QA remains a separate acceptance step.
- Do not enable automatic Vercel Git Integration. Do not merge a new alias-configuration PR or manually trigger the Preview workflow without separate explicit authorization.
