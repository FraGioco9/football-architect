# Player registration profile and app entry

New registrations require `email`, `password` and `username`; optionally accept `nationality` and `city`. Unknown properties remain rejected. Username: trimmed 3–24 ASCII letters/digits/underscore, unique without case distinctions; display casing is retained. A D1 NOCASE unique index enforces concurrent collisions. A taken name returns 409 `username_unavailable` independently of email existence; unused-name requests for an existing email retain the generic 202 response. No email-existence or username-availability endpoint is added.

Nationality is an optional ISO 3166-1 two-letter code from the shared 249-country list, displayed with localized names. City is optional trimmed text of at most 100 Unicode code points with control characters rejected. Empty optional values become NULL. Profile fields are private account data and never enter public world projections, logs or Admin permission grants.

`0016_player_profile.sql` is additive. Existing Player IDs, passwords, permissions and audit links remain unchanged; historical accounts may have NULL profile fields. It must be applied to the local D1 database before testing new registration. No remote migration is authorized.

Account entry uses `app.<domain>` and local `http://app.localhost:2000/account/login/`. The shared bootstrap transfers only approved account paths, safe return values, supported language and necessary verification/recovery tokens; site-host forms redirect before account API calls. Host selection is derived from the current trusted host, never a query-supplied origin. Existing loopback IP and unconfigured Vercel/Pages preview fallbacks remain usable; production host provisioning is still separately gated.

The selected EN/DE/ES/FR/IT language is carried on trusted site-to-app links and persisted separately at the app origin. The selector repaints labels/status without replacing inputs or replaying verification/reset requests. One-time tokens are removed from the address bar. Account pages reuse the site brand, Graphite & Petrol theme tokens and theme preference.

The opt-in local API bridge now forwards only explicit Player endpoints from app.localhost, validates method/body limits, and preserves the validated Host for the Worker's exact-origin check. It does not forward arbitrary destinations or source-identity headers.

Registration and recovery still fail closed without the separately approved delivery provider. No outbound messages, remote D1, release, merge or deployment are part of this change.
