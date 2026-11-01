# Gmail sender for hosted Preview — Draft/HOLD

Owner selected `footballarchitect.notifications@gmail.com` on 1 November 2026. This selects the proposed Gmail sender; it does not authorize any Google account change, credentials upload, deployment, real email, remote D1 write or Admin grant. The published Preview still runs the earlier approved package without this adapter or email activation.

## Prepared behavior

`gmail-email-delivery.ts` implements Gmail API `users.messages.send` with the existing verification/recovery lifecycle. It refreshes an owner-supplied OAuth token against Google's fixed HTTPS token endpoint, then sends a multipart UTF-8 text/HTML message through the **explicit configured mailbox**. Both calls reject redirects, have deadlines and bound response bodies. Provider errors are sanitized; sends are not automatically retried because a timeout can mean delivery was already accepted. Registration cleanup, reset-token cleanup, expiry, one-time use, throttling, Admin permissions and session revocation remain unchanged.

This transport is deliberately restricted to hosted Preview (`football-architect-preview.<account>.workers.dev`), trusted Cloudflare transport, `PLAYER_EMAIL_DELIVERY_ENABLED=gmail-preview`, a lowercase `@gmail.com` sender and **1–10 exact approved recipients**. It cannot activate in local or Production mode. No wildcard, suffix matching or public unrestricted registration. Dev can use the existing opt-in bridge to that Preview; sign-ins remain separate. Invalid/missing configuration disables the callbacks. No test or build sends a real message.

The existing Cloudflare transport remains available only under its original Production gates. There is no automatic fallback or binding change. This block does not provide Gmail sign-in for players: it authorizes only the site's dedicated outbound mailbox. Players keep email/password authentication and can use other email providers.

## Owner setup: Google account authorization

Do this while signed into the **dedicated sender account**. No password, client secret, refresh token, authorization code or token-bearing screenshot should be pasted into chat, issues, CI, browser code or repository files.

1. Open [Google Cloud Console](https://console.cloud.google.com/), create/select a dedicated nonproduction project (for example `Football Architect Preview`) and enable **Gmail API** in APIs & Services. Creating this project does not configure an email transport in Cloudflare.
2. Configure Google Auth Platform branding/audience and add the dedicated sender as an allowed test user if the project is in Testing. Select only `https://www.googleapis.com/auth/gmail.send` for mailbox authorization, not read/manage mail scopes. This is the sender's consent, not a consent flow for every player.
3. Create your own OAuth client of type **Web application**, with `https://developers.google.com/oauthplayground` as an authorized redirect URI. Keep the client ID and client secret private locally.
4. Open [Google's OAuth Playground](https://developers.google.com/oauthplayground/). In its settings select **Use your own OAuth credentials** and enter that project's client ID/secret there. Request only `https://www.googleapis.com/auth/gmail.send`, authorize the dedicated sender, then exchange the authorization code for tokens. Keep the refresh token locally and do not use the Playground's Step 3 to send a real message during preparation.
5. Default Playground credentials produce refresh tokens revoked after 24 hours; use your own client. An external OAuth project left in **Testing** normally issues a refresh token expiring after 7 days for Gmail scopes. Treat this as temporary test setup. Stable operation requires a separate Google policy/release review; changing OAuth publishing status is not part of this block. Revocation/expiry causes delivery to fail closed.

## Later activation: separate reviewed operation

Required server-only secrets: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`. These belong in the **selected Preview Worker's secret storage**, never a public asset, config committed to Git, D1 row, log or this document. Use interactive secret input under separate activation approval; do not pass tokens as command-line arguments. A ChatGPT Gmail connection would not automatically supply these credentials to the deployed Worker.

Reviewed nonsecret settings would be:

```text
PLAYER_MODE=preview
PLAYER_TRUSTED_SOURCE=cloudflare
PLAYER_ORIGIN=https://football-architect-preview.giocolifrancesco.workers.dev
PLAYER_EMAIL_DELIVERY_ENABLED=gmail-preview
PLAYER_EMAIL_FROM=footballarchitect.notifications@gmail.com
PLAYER_EMAIL_PREVIEW_RECIPIENTS=<exact approved recipient address(es), lowercase, comma-separated without spaces>
```

The owner must still name the recipient(s) and approve the exact new source/package, credential provisioning and bounded real-send smoke. The sender address does not imply the future Player/Admin account or a recipient choice. The existing package preparer intentionally emits **no email settings or secrets**; do not silently modify its output to activate Gmail. A separately reviewed activation package/config is required. Preserve the existing D1, Season 0 and recovery records; apply no migrations again. No Admin grant or world operation is part of email activation.

Gmail account sending limits and anti-abuse restrictions apply. This is a bounded initial Preview/test path, not a public transactional delivery guarantee. Keep Production isolated with its separately approved email configuration. Actual cutover and final live acceptance remain open: **#170 13/15 (86.7%)**, PR #329 Draft/HOLD.

References checked 1 November 2026: [send MIME messages](https://developers.google.com/workspace/gmail/api/guides/sending), [send scope](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send), [refresh and Testing expiry](https://developers.google.com/identity/protocols/oauth2), [Playground own credentials](https://developers.google.com/oauthplayground/).
