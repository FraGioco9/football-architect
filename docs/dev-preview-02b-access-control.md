# DEV-PREVIEW-02B — Deferred

Status: **Deferred by owner decision (2026-10-17).**

The owner explicitly chose to skip DEV-PREVIEW-02B (Debug authentication and individual access-control implementation) for now. Do not propose GitHub OAuth, Cloudflare Access, Supabase Auth, or another Debug login as the next step.

This deferral does **not** authorize publishing an unprotected Debug artifact. Keep the existing `protected_debug` publication rejection and G10 gate in place. No protected Debug deployment, DNS change, or live configuration change is permitted by this decision.

Public player login is separately deferred to issue #170; the public site remains freely accessible.

**Next work in issue #149:** DEV-PREVIEW-02C — verify deterministic artifact manifests, byte-level separation from public artifacts, and fail-closed behavior. Then 02D automated checks that do not depend on a deployed authenticated gateway; postpone gateway-specific cases until 02B resumes. 02E/G10 remains blocked.
