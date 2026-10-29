# FadeLoop V2 implementation plan and live status

Last updated: 2026-10-29 (Asia/Calcutta).

This is the authoritative development tracker. Read it with the [architecture](../architecture/fadeloop-v2-architecture.md), [engineering guardrails](../engineering/guardrails-and-anti-patterns.md), and root [AGENTS.md](../../AGENTS.md). A proposal, source file, successful local test, and verified deployment are different states.

## Current handoff

| Field | Current state |
|---|---|
| Product stage | P03 owner/session/storage slice locally verified; full P03 and live providers remain pending |
| Current phase | P00/P01 DONE; P02 IN_PROGRESS; P03 IN_PROGRESS |
| Authentication decision | User selected Supabase Auth email/password; no Worker password hashing or owner-key fallback |
| Application/runtime | /login form, configured Supabase adapter, hashed cookie sessions/logout, atomic OAuth-state store, encrypted workspace-owned account storage and metadata API |
| Provider verification | Supabase mocked in tests; no live Supabase/Meta calls or account grants verified |
| Database | Migration 0001 applied to local D1 only. Test datasets are isolated Miniflare instances. No real owner provisioned. |
| Performance evidence | Local indexed session/account queries each read 2 rows and write 0 with 1500 unrelated rows; live CPU/quotas NOT_MEASURED |
| Tests/builds/deployment | pnpm check PASS, 35 tests; local workerd and mocked browser smoke PASS; no cloud deployment |
| Branch / remote | dev; https://github.com/arshadakl/FadeLoop-v2.git |
| Remote/commit/push | P02 source b92b29b and handoff 71a0482 on origin/dev; P03 commit/push pending |
| Active owner | Codex: P03 owner/storage slice |
| Immediate next action | Configure Supabase project/publishable key/confirmed owner UUID locally, provision owner workspace, and prove live sign-in. Then wire Meta OAuth and V2 callback; continue remaining P03 campaign/delivery schema and ownership. |
| Current blockers | Default sandbox fails; approved execution works. Supabase configuration and live provider/CPU evidence are absent. |
| Secrets/resources | Existing Meta credentials untouched and ignored. No passwords/provider tokens stored in frontend or committed; no Supabase project or remote D1 provisioned. |
| Evidence | [P03 local verification](evidence/p03-owner-storage.md), [owner setup](owner-auth-setup.md), earlier P01/P02 evidence retained below |

The ignored research report is local supporting material. Future contributors must be able to work from tracked documents without needing that file.

## Status and evidence rules

Allowed statuses: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IN_REVIEW`, `DONE`, and `DEFERRED`. `BLOCKED` means record the exact missing prerequisite and the action needed; it does not imply unrelated work must stop. `DEFERRED` needs a scope reason and a future entry condition.

- Before beginning work, verify `dev`, read this handoff, select a task ID, and record an owner. Keep only genuinely active tasks in progress.
- Update the task and current handoff in the same change as implementation. Use `[x]` only after the stated result has evidence; partial work stays `[ ]` with a note.
- `DONE` requires the exit gate, reviewed changes, relevant checks, and evidence links. Local verification does not establish target-plan CPU behavior or successful provider integration.
- Record exact commands and results, date, fixture/load conditions, and relevant commit SHA when available. Mark checks `NOT_RUN` with a reason rather than assuming a pass.
- Keep local, remote, deployed, and live-send status separate. Include pending migrations, flags, and replay hazards in handoffs.
- If a claim becomes stale after a contract/schema/config change, reopen its verification task. Never silently preserve a now-invalid green gate.

## Phase overview

| Phase | Outcome                                             | Dependency                   | Status      |
| ----- | --------------------------------------------------- | ---------------------------- | ----------- |
| P00   | Repository rules and reviewable plan                | None                         | DONE        |
| P01   | Typed application and Worker foundations            | P00                          | DONE |
| P02   | Verified Meta integration contract                  | P01; test account/app access | IN_PROGRESS |
| P03   | Indexed data, authorization, delivery ownership     | P01; relevant P02 identities | IN_PROGRESS |
| P04   | Authenticated webhook-to-Queue ingress              | P01, P02 event fixtures      | NOT_STARTED |
| P05   | Direct campaign consumer with safe retries          | P02, P03, P04                | NOT_STARTED |
| P06   | Creator dashboard and campaign management           | P03; P05 contracts           | NOT_STARTED |
| P07   | Failure, quota, concurrency, and performance proof  | P04–P06                      | NOT_STARTED |
| P08   | Free-tier deployment and controlled live validation | P07; credentials/resources   | NOT_STARTED |
| P09   | Optional stateful campaign modes                    | Verified direct release      | DEFERRED    |

P02–P04 can progress independently where contracts are known. Never mark a dependent gate complete using assumptions from an unfinished prerequisite.

## P00 — Repository and planning baseline

- [x] P00-01: Record event-driven architecture and bounded first release.
- [x] P00-02: Record React/Tailwind/shadcn/TanStack Query and shared code standards.
- [x] P00-03: Organize docs and ignore local research, secrets, dependencies, generated output.
- [x] P00-04: Record Conventional Commits and `dev`-only work/push rules in AGENTS.md.
- [x] P00-05: Create this tracker and permanent anti-patterns guide; distinguish verified limits from unknown Meta contracts.
- [x] P00-06: Inspected Git status/refs; local research is ignored and untracked.
- [x] P00-07: Configured authorized origin; remote contained only a README commit on main and no dev. Based local dev on that history without pushing main.
- [x] P00-08: Reviewed baseline, committed as bddada2 (`docs: establish architecture and implementation baseline`), pushed explicitly to origin/dev. Research excluded.

Exit gate: docs are internally linked, current Git state is known, and the reviewed baseline is on remote `dev`. Documentation creation alone does not complete P00.

## P01 — Foundations and tooling

- [x] P01-01: Scaffold pnpm workspace with web, API, ingress, consumer, contracts, domain, and narrowly imported Worker utilities as justified by actual code.
- [x] P01-02: Configure strict TypeScript, Biome, Vitest, Vite, and reproducible build commands with a committed lockfile.
- [x] P01-03: Add typed environment bindings, secret-free examples, separate local/test/production resource configuration, and runtime boundary checks.
- [x] P01-04: Establish browser-safe contracts, discriminated event/result unions, safe API errors, structured logging, and an injectable clock seam; provider injection is added with the actual adapter in P02/P05.
- [x] P01-05: Add CI for appropriate lint/type/test/build checks, commit-message validation, and a local pre-push guard for `dev` only. CI checks commit ranges, not merely the latest commit title.
- [x] P01-06: Configure the UI token baseline, shadcn primitives, providers, router, and TanStack Query client without feature scaffolding bloat.

Exit gate: empty feature shells build cleanly; frontend cannot import Worker secrets/modules; Worker bundles remain separate. Record command output in the evidence log. Local gates passed; see [P01 evidence](evidence/p01-foundation.md). Meta provider seams/credentials and real resource bindings are added in their owning phases, not fabricated here.

## P02 — Meta contract spike

Local preparation completed (these do not close the live gates below):

- [x] P02-PREP-01: Server-only raw HMAC validation, account-bound token vault, session-bound OAuth-state helper, atomic-store interface, and mock-tested OAuth request layer.
- [x] P02-PREP-02: Secret-safe aliases/readiness command and setup/contract docs; old source 4b7e49a inspected for paths, version, and signing mapping; existing secrets remain ignored.
- [ ] P02-PREP-03: Obtain/register V2 callback URL and confirm provider support/grants; wire actual OAuth only after P03 owner-session/state/token storage exists.

- [ ] P02-01: Pin supported API version/login path; document required scopes and access levels for owned test accounts versus external creators.
- [ ] P02-02: Prove OAuth state verification, callback, account identity, encrypted token storage, token expiry/refresh, revocation, and reconnect behavior.
- [ ] P02-03: Verify app-level and account-level subscriptions, capture sanitized signed comments/messages/quick replies/postbacks, and document identity mapping and timestamp units.
- [ ] P02-04: Prove one private reply and the qualifying interactions/windows needed for a continuation. Confirm no automation follows a mere URL click.
- [ ] P02-05: Complete the operation-specific rate-limit matrix in the guardrails using accessible official documentation and observed responses; record scope, units, error codes, and available usage headers.
- [ ] P02-06: Verify paginated media lookup, account ownership, invalid/expired token responses, private reply error outcomes, and supported deletion/deauthorization handling.

Exit gate: checked-in sanitized contract fixtures and a provider-contract note with sources, version, dates, observed results, and remaining uncertainties. No guessed throughput limit is accepted as verified. Follow gating stays out of the direct MVP.

## P03 — Data and access boundaries

Verified owner-storage subset (does not close the full phase gates below):

- [x] P03-OWNER-01: Local migration for workspaces, hashed sessions, OAuth states, encrypted accounts and supporting indexes; local-only provisioning command.
- [x] P03-OWNER-02: Supabase password adapter, confirmed owner allowlist, one-hour cookie session, exact-Origin mutation checks, native login rate gate, protected metadata and logout.
- [x] P03-OWNER-03: Atomic D1 OAuth consumption, cross-workspace negative tests, indexed-query metadata on 1500-row fixtures, and mocked UI flow.
- [ ] P03-OWNER-04: Configure and verify real Supabase sign-in/cookies, target-plan CPU, production bindings/revocation/recovery, and retention budgets.


- [ ] P03-01: Define minimal workspace/account/campaign revision/delivery schema and versioned migrations. Enforce one published campaign per account/media in the MVP.
- [ ] P03-02: Implement owner sessions, CSRF protection where needed, workspace authorization, and cross-account negative tests. Profile authentication CPU separately.
- [ ] P03-03: Implement focused parameterized access modules and atomic action claim/attempt ownership. Claim only account-owned work; private-reply uniqueness survives campaign edits.
- [ ] P03-04: Store sent/retryable/failed/unknown outcomes and sanitized provider metadata. Define safe stale-claim policy and retained deduplication horizon.
- [ ] P03-05: Verify hot query plans and actual D1 row metadata on realistic datasets. Record each query ID, index, frequency, and read/write budget, including index amplification.
- [ ] P03-06: Design bounded retention and indexed due-token maintenance; no minute task discovery or hot history scans.

Exit gate: scoped access is demonstrated; concurrent claims have one owner; hot access does not grow with unrelated history. Schema rollback/recovery is documented and deduplication cannot be erased before replay eligibility ends.

## P04 — Minimal ingress

- [ ] P04-01: Implement challenge verification and bounded raw-body HMAC validation before D1 or business processing.
- [ ] P04-02: Normalize all supported entries with deterministic event identities; ignore echoes/unsupported notifications intentionally.
- [ ] P04-03: Await Queue publication before HTTP success, handle partial publication safely, and bound event count, payload size, and batch chunks.
- [ ] P04-04: Configure push-based consumer batch size one initially, finite retries, DLQ, and observable queue errors. Ensure invalid signatures cause no D1 or Queue activity.
- [ ] P04-05: Profile representative and maximum-supported envelopes on the intended Free deployment. Record CPU separately from wall latency.

Exit gate: verified event acceptance, safe retries after publication failure, and ingress CPU evidence. Oversized legitimate payload handling is documented; dropping them silently is unacceptable.

## P05 — Direct delivery

- [ ] P05-01: Implement pure deterministic matching and one winning campaign revision for a valid comment.
- [ ] P05-02: Execute the atomic delivery lifecycle; recheck account/campaign eligibility and event age immediately before sending.
- [ ] P05-03: Add one Meta adapter and one business retry owner. Use bounded delayed retries with jitter; reject permanent/expired work and preserve ambiguous send outcomes.
- [ ] P05-04: Add account/operation scoped atomic rate reservation and cooldown behavior using verified P02 rules. Do not assume consumer batch size serializes an account.
- [ ] P05-05: Persist the final result before acknowledging. On Meta acceptance followed by D1 failure, prevent blind resend on redelivery.
- [ ] P05-06: Add optional public acknowledgment with a separate action key, only after direct delivery correctness is proven. Profile whether a durable separate action is needed rather than chaining unbounded work.
- [ ] P05-07: Add failure activity, poison-message handling, DLQ alert/recovery, and bounded eligibility-checked replay.

Exit gate: a matching test-account comment receives its resource; duplicates/concurrent messages do not resend; unknown outcomes are inspectable. Direct mode creates no conversation/contact state solely to deliver one reply.

## P06 — Creator dashboard

- [ ] P06-01: Build connection health and account management with verified status, reconnect action, and subscription diagnostics.
- [ ] P06-02: Add paginated media picker, keyword/any-comment campaign editor, accessible preview, publish/pause, and revision semantics.
- [ ] P06-03: Add paginated delivery history including sent, failed, retrying, and unknown outcomes without expensive history aggregation.
- [ ] P06-04: Apply feature-local API functions/query keys/hooks; scope keys by workspace/account and clear sensitive state on logout/removal.
- [ ] P06-05: Apply design reference adaptations, shared common components, page-level code splitting, and contextual loading/empty/error states.
- [ ] P06-06: Verify keyboard, focus, contrast, responsive layout, form errors, cache isolation, and mutation recovery.

Exit gate: an owner manages the direct workflow from the UI; tenant isolation, accessible interactions, and bounded dashboard database activity are demonstrated.

## P07 — Reliability and Free-tier gates

- [ ] P07-01: Test duplicate/partial/out-of-order deliveries, concurrent account activity, pause/edit/reconnect races, and stale events.
- [ ] P07-02: Inject crashes before claim, before send, after provider acceptance, after result persistence, and before Queue acknowledgment. Document the outcome and recovery for each.
- [ ] P07-03: Verify retry storms are bounded, provider cooldowns are shared at the correct scope, poison work terminates, and DLQ retention is understood.
- [ ] P07-04: Profile all invocation types with small, typical, and worst-supported payloads; verify preferred CPU below 5 ms and project ceiling below 10 ms. CPU outliers above target require investigation and recorded justification; at/above ceiling blocks deployment.
- [ ] P07-05: Measure metered D1 reads/writes per event, nonmatches, duplicate deliveries, invalid requests, auth/API actions, daily maintenance, and zero-event baseline.
- [ ] P07-06: Complete daily/30-day capacity model using measured operations, retry scenarios, retention, dashboard usage, and shared account usage; preserve headroom.
- [ ] P07-07: Review every applicable anti-pattern ID and store PASS/FAIL/NOT_APPLICABLE with evidence. Reverify platform limits before release.

Exit gate: evidence supports correctness and the declared workload on Free. If it does not fit, simplify, durably split measured work, or record a product capacity limit; do not silently upgrade or weaken correctness.

## P08 — Deployment and live validation

- [ ] P08-01: Provision least-required Free-tier resources and bindings; document actual account plan, quota sharing, selected API version, secrets names, and migrations without exposing secret values.
- [ ] P08-02: Deploy with sends disabled; verify auth, callback routing, subscriptions, logging, queue/DLQ alerting, and current CPU behavior.
- [ ] P08-03: Enable one controlled test campaign and validate real comments, duplicate behavior, pause, error display, and Meta rate feedback. No V1/V2 dual-send period.
- [ ] P08-04: Inspect observed traffic and idle periods, compare metered quotas with model, and document safe operating envelope and alert thresholds.
- [ ] P08-05: Record deployment/version SHA, resource names, migration level, active flags, rollback procedure, recovery owner, and replay restrictions.

Exit gate: live evidence matches the declared scope and the operator can stop sending and recover safely. Code and docs push to `dev` only; deployment does not require a `main` push.

## P09 — Optional flows (deferred)

Entry condition: P08 direct release is verified and a concrete product need justifies added state.

- [ ] P09-01: Tap-to-continue using verified qualifying interaction, opaque/authenticated payload, expiry, user/account/session binding, and compare-and-set step version.
- [ ] P09-02: Email collection with explicit UI/purpose, validation, protected storage, retention, and flow cancellation.
- [ ] P09-03: Follow gate only after proving the selected API exposes the needed eligible relationship field. Unknown lookup remains unknown.
- [ ] P09-04: Independently profile each new invocation and update quota/retry models; prove concurrency and stale interaction behavior.

Exit gate per mode: verified provider eligibility, idempotent transitions, accessible UI, and Free-tier budgets. A visual flow builder, teams, and billing are outside this plan.

## Evidence log and task handoff template

| Date       | Task/gate             | Result                 | Evidence                                                    | Revision/environment                |
| ---------- | --------------------- | ---------------------- | ----------------------------------------------------------- | ----------------------------------- |
| 2026-10-29 | P00-01 through P00-05 | Documentation prepared | Tracked-path artifacts linked above; runtime checks NOT_RUN | Local files; no verified remote SHA |
| 2026-10-29 | P00-06                | BLOCKED                | Process startup error: `setup refresh had errors`           | Local shell unavailable             |

Append an entry when a task changes materially. Capture evidence in `docs/implementation/evidence/` when needed; do not fabricate output or include secrets.

```text
Task ID / status / owner:
Last updated (date/time + zone):
Changes and affected paths:
Completed acceptance criteria:
Outstanding work / exact next action:
Checks run and results (or NOT_RUN + reason):
CPU p50/p95/max / wall time / sample count / payload/load:
D1 rows read/written / Queue operations / provider attempts:
Relevant guardrail IDs and evidence:
Local commit / remote dev SHA / deployment SHA (separate):
Migration level / flags / external side effects:
Blocker / recovery or rollback notes:
```

### Latest verification — 2026-10-29

P00 baseline pushed as bddada2. P01 local checks and browser smoke pass; see the evidence note. The earlier process-startup blocker is bypassed with approved outside-sandbox commands, not fixed globally. No live sends, migrations, D1/Queue bindings, or deployments occurred.

P01 implementation was committed as 37500388063c83ff487eeefaa2d92da0189f148c and pushed to origin/dev. All source changes are locally verified. This final documentation update records completion; deployment remains NOT_RUN.

### P02 preparation — 2026-10-29

Local security/configuration helpers pass all 21 tests and the full build gate. Existing root .env aliases are recognized; a private encryption key was appended without changing user credentials. Legacy source pin v23.0 and signing mapping are recorded. Provider checks, exact rates, current version support, real signed fixtures, real token exchange/refresh, and messaging remain NOT_RUN. See P02 evidence and Meta contract register.

P02 local preparation committed and pushed as b92b29bb4e2511a036744ae2ba88480b54365b87. All 21 project tests, type/lint checks, and dry-run builds passed. Local readiness now reports only META_REDIRECT_URI missing. P02 remains IN_PROGRESS until actual provider checks and required persistence are complete.

### P03 owner/storage slice — 2026-10-29

Supabase email/password selected by owner. Local D1 migration and owner/session/account storage are implemented; 35 tests and builds pass. A browser smoke test used fake auth responses and real unauthenticated local API checks; live Supabase is not verified. Campaign/revision/delivery schema, send claims, cleanup, and production CPU remain open. See P03 evidence and owner setup.
