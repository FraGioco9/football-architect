# A04 provider contract foundation

Tracking: #268. Baseline: `68e2429a5c17430b7db25c4465f839edb3869ae3`.
The approved A04-02 and formalized A04-03/04 specifications are recorded in
the authoritative issue. This lot implements pure primitives only, with no
provider adapters, consumer integration, public asset or publication exception.

## API implemented

- `validateRequest(request, getCompetition)` returns a detached immutable
  request or throws TypeError. Inject the canonical catalogue lookup; do not
  establish a second identity table.
- `validateResponse(response, request, options)` returns a detached immutable
  accepted response or null. The request must already have passed request
  validation. Options bind the injected provider identity and, for verified
  sources, the trusted sourceRef/approval. They are host configuration, never
  copied from an untrusted response.
- Usable responses require `options.validateData(data, request) === true`.
  This is the source/domain boundary: adapters must supply the existing
  applicable domain validators. The helper does not pretend to implement
  Fixtures, Stats or canonical History validation. Validator programming
  errors propagate instead of being disguised as empty data.
- `captureLease(state)` snapshots request identity, provider, owner, slot and
  generation, plus protected DEV progress/eligibility and optional view/route
  binding. `isCurrentLease(lease, current)` rejects invalid or superseded
  states. Owner is a document/controller token; slot identifies the local
  writer, not a global cancellation namespace. Callers must invalidate tokens
  before async transitions and check immediately before their owned mutation.

The module performs no I/O, publication or mutation of caller input. It does
not implement `provider.read`: Static/DEV/historical adapters and their
failure-to-envelope mapping belong to subsequent integration lots. Empty and
unavailable require null data; partial and available require validated data.
There is no loading response. Static currently has no approved result source;
usable Static sports data is therefore not enabled by this foundation.

## Verification

`node --test tests/provider-contract.test.mjs` covers canonical requests,
envelope identity/status consistency, mandatory domain validation with actual
historical-rule rejection, source trust versus fictional flags, detached
snapshots, malformed/stale leases and public staging exclusion. Existing
`a04-provider-baseline-evidence.test.mjs` remains unchanged and covers the
accepted real consumer/DEV baseline. Pure lease tests do not claim new
end-to-end asynchronous consumer integration.

The module is not in the public allowlist or any HTML script list. No
generated files, workflows, hosting rules, simulation or canonical data change.
Node/Chrome CI must run on the final PR SHA. Draft/HOLD; no merge/deploy/DB.
