# Account app entry and registration profile design

Issue #170, PR #329. User selected unique usernames on 30 October 2026.

## Intent and requirements
Bring account entry into the established Football Architect visual style and app subdomain. Preserve selected interface language, expose a five-language selector, and collect a unique required username plus optional nationality and city during registration.

## Approach
Reuse existing brand assets, landing/app design tokens and theme behavior, with a focused account layout shared by login, register, recovery, verification and account home. This follows the requested site style. A separate visual system adds divergence; putting the full career sidebar on anonymous forms adds unnecessary navigation. Use one compact branded account header, language control and centered form.

## Behavior
- Canonical account entry uses app.<domain>; local example http://app.localhost:2000/account/login/. Existing site links and direct site-host account URLs lead to app entry.
- No production domain is invented. Use trusted app-origin configuration and existing host conventions; do not derive a redirect from a user-provided origin or return URL.
- Supported languages EN/DE/ES/FR/IT. Carry explicit language on trusted site-to-app links, then persist using football-architect:language on the destination origin. Same-origin navigation uses the saved preference, with EN fallback. Changing language must preserve form values, in-flight status and one-time token state.
- Use established dark/light styles and visible keyboard focus. All account pages share consistent form/error/loading presentation and mobile layout.
- New registration requires email, password and username. Login remains email/password.
- Proposed implementation rule: username is 3–24 ASCII letters, digits or underscores; case-insensitive uniqueness. Preserve entered spelling for display and use a normalized key for uniqueness.
- Nationality is optional, stored as a validated ISO country code selected from the full country list, localized for display. City is optional free text, trimmed, maximum 100 Unicode characters. Empty optional values become null. Neither field is a location permission or inferred from IP.
- Add an additive D1 migration. Existing Player identities remain intact with null profile fields; require username for all new self-service registrations. No automatic invented usernames or email-derived public names.
- Enforce username uniqueness atomically in D1, including case variants and simultaneous requests. A collision asks the user to choose another username; duplicate-email responses retain anti-enumeration behavior.
- Profile data remains private to the account boundary, not world/public projections. Unknown registration properties, including permissions, remain rejected.

## Constraints and acceptance
Keep safe post-login destinations, mandatory email verification, session/CSRF/origin protections and provider-off fail-closed behavior. Keep historical Admin identity links and sporting state intact. No remote migrations, email provider setup, outbound mail, merge or deployment.
Use focused local tests while implementing and consolidate full exact-head CI acceptance at the final gate. Issue remains 12/15 until original acceptance requirements are satisfied.
