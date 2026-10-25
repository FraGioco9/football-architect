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

`createProvider({id,getCompetition,load,validateData,sourceRef,approved})`
returns an immutable `{id,read}` adapter shell. `read(request)` validates and
snapshots the request before invoking the injected source, then validates the
returned envelope. Expected source failures must explicitly throw
`ProviderSourceError`; they become unavailable/source-unavailable. Unexpected
source or validator errors propagate. Invalid source payloads return
unavailable/invalid-data (or unapproved-source for forged verified provenance).
An unconfigured verified source is unavailable without invoking the loader.

The module performs no built-in I/O, publication or mutation of caller input.
Source-specific Static/DEV/historical adapters and consumer migration still
belong to subsequent integration lots. Empty and
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
end-to-end asynchronous consumer integration. Additional read tests exercise
held source promises, request/configuration snapshotting, actual historical
rule rejection, declared versus unexpected failures, unconfigured/forged
verified sources, and delayed success/error paired with the lease predicates.
The read operation does not choose the current request or publish by itself:
callers must enforce their current lease immediately before mutation.

The module is not in the public allowlist or any HTML script list. No
generated files, workflows, hosting rules, simulation or canonical data change.
Node/Chrome CI must run on the final PR SHA. Draft/HOLD; no merge/deploy/DB.

## A04-07 Static adapter (Draft/HOLD)

`assets/static-provider.mjs` introduces `createStaticProvider({catalog,rulesRegistry})`.
The host injects the canonical A01 World Catalog and A02 Rules Registry,
rather than a duplicate source of IDs or sports rules. Construction checks
all 18 competition IDs, capacity, canonical rules version and registry binding,
including the cup-specific final event, and fails closed on mismatches.
Requests use the existing A04 read/request validation. Every valid Static
season/history request currently returns immutable `empty/no-results` with
null data and none/unapproved provenance: there is no approved Static results
source. Empty does not mean a played zero, a completed season, or an approved
historical snapshot. The adapter does not mutate world time, historical rules,
membership, simulation, rendering or routes.

This is a Node-side first integration boundary, **not a consumer migration**.
The new adapter and the existing contract module remain outside the public
allowlist, HTML scripts, and generated pages; no publication exception is
requested. `tests/static-provider.test.mjs` covers all 18 identities for
both scopes, strict absence, invalid requests, rule drift, and staging
exclusion. Existing browser baselines remain the separate public-behavior
oracle. A04-08–12 (DEV, historical sources, selectors and consumer migration,
publication decisions and end-to-end CI) are not completed by this lot.

## A04-08 DEV fictional adapter (Draft/HOLD)

`tools/dev-fictional-provider.mjs` composes the existing A04 `createProvider`
with injected canonical competition lookup, current DEV eligibility/progress,
the existing season producer and historical-rule/domain validators. It introduces
no simulated results, seed, score, matchday or new source. Usable data has only
fictional/unapproved provenance; canonical validation rejects corrupt snapshots.
Season 0/Debug OFF return disabled/empty; a future viewed season is empty
(no invented results). Historical archive retrieval is explicitly unsupported
here and remains A04-09. Expected producer failures require the established
`ProviderSourceError` classification; unanticipated errors propagate.

This is a protected DEV-side composition boundary, not an HTML or consumer
migration: legacy DEV boot/render logic and its established race guards remain
unchanged. Producer-local leases are still the responsibility of the consumer
at commit time. The new file stays outside public staging. The narrow suite
`tests/dev-fictional-provider.test.mjs` checks provenance, disabled/Season 0,
out-of-range, historical isolation, actual rules rejection, producer failures
and publication exclusion. A04-09–12 remain open; no full-browser consumer
integration is claimed by these tests.
