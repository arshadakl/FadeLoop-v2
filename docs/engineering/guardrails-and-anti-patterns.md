# Free-tier guardrails and anti-patterns

Last reviewed: 2026-10-29. Applies to every implementation phase and future feature. Read before editing execution paths, persistence, provider calls, retry policy, or deployment configuration. Update this guide when limits/contracts change; keep implementation status in the [live tracker](../implementation/implementation-plan.md).

## 1. Limits, targets, and daily budgeting

Free-tier deployment is the requirement. **Preferred active CPU is under 5 ms per invocation; the project ceiling is 10 ms and normal work must stay below it with margin.** Apply this project policy to HTTP, Queue, and scheduled work. It is stricter than any invocation type that might offer more platform CPU; verify actual plan/trigger behavior rather than assuming paid defaults apply. The published Workers Free HTTP and Cron CPU limits are 10 ms. Network waiting is wall time, not active CPU. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

Splitting a file/function, adding `await`, or calling `waitUntil()` does not reset invocation CPU. A durable Queue handoff creates a later invocation, but costs operations and introduces duplicate/concurrency/recovery obligations. Profile first.

### Current platform allowances

| Resource | Free allowance / constraint | 30-day planning interpretation |
|---|---|---|
| Worker requests | 100,000/day | 3,000,000 only if each day fits; verify request accounting by trigger |
| Worker memory / outgoing connections | 128 MB / 6 simultaneous per invocation | Not monthly pools |
| Worker external subrequests | 50 per invocation | Not a per-day allowance |
| D1 rows read | 5,000,000/day | 150,000,000 arithmetic projection |
| D1 rows written | 100,000/day | 3,000,000 arithmetic projection |
| D1 storage | 5 GB total; 500 MB per database | Stored capacity, not reset monthly |
| D1 databases / queries | 10 databases; 50 queries per invocation | Batching does not eliminate metered rows |
| Queues operations | 10,000/day | 300,000 arithmetic projection |
| Queue retention | 24 hours on Free | No indefinite outage/replay buffer |
| Queue payload | 128 KB maximum; operations in 64 KB chunks | Keep normalized events well below one chunk |

Sources: [Workers](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/), [Queues limits](https://developers.cloudflare.com/queues/platform/limits/).

These are account allowances shared with other workloads, not an allocation reserved for FadeLoop. Free D1/Queue daily allowances do not become bankable monthly credits. Track daily utilization and month-to-date totals separately. Paid monthly allowances must not be used in the Free model. Recheck reset behavior and actual account usage in the dashboard before release.

D1 reads mean rows scanned, not rows returned. Inserts, updates, deletes, and affected indexes consume writes. Use `meta.rows_read` and `meta.rows_written`, not statement counts alone. [D1 accounting](https://developers.cloudflare.com/d1/platform/pricing/)

A normal sub-64-KB Queue message uses roughly three operations: enqueue, read, delete. Retries add reads; DLQ and extra stages add more operations. Batch publication does not make per-message operations free. Therefore 10,000 operations allows roughly 3,333 successful one-stage messages/day **before** retries, other queues, and safety headroom. [Queue accounting](https://developers.cloudflare.com/queues/platform/pricing/)

### Capacity worksheet required before deployment

Record actual workload classes: nonmatching comments, direct matches, duplicates, inbound interactions, public replies, dashboard requests, maintenance, invalid traffic, and other account projects. Count total ingress traffic rather than only successful matches.

```text
daily_read_rows  = sum(class_count * measured_read_rows_per_class) + maintenance + other_usage
daily_write_rows = sum(class_count * measured_write_rows_per_class) + maintenance + other_usage
queue_ops       = all stage writes + deliveries/reads + deletes + retries + DLQ/replay operations
30_day_usage    = sum(actual daily usage); projections are labeled estimates
storage         = retained records * measured average stored bytes, including indexes
```

Start operational warnings at 50% and urgent action at 75% of the available daily budget (project policy, not platform limits). Reserve at least 25% for traffic variation and recovery; headroom is not a guarantee against bursts. Define admission/backpressure behavior before limits exhaust; never acknowledge unpersisted accepted work as successful. Alerting itself must not create a high-frequency polling loop.

## 2. CPU and execution anti-patterns

| ID | Avoid | Required approach / proof |
|---|---|---|
| CPU-01 | Running ingress, matching, history search, and sending in one request | Ingress authenticates/normalizes/enqueues; consumer executes a bounded action. Profile both independently. |
| CPU-02 | Assuming helpers, promises, parallel fetches, or `waitUntil` reset CPU | Measure total invocation CPU. Only an actual later invocation is a new budget; do not move critical persistence after acknowledgment. |
| CPU-03 | Unbounded envelope parsing, loops, sorting, repeated hashes/serialization | Bound body/event/text sizes, prefer provider IDs, parse once, and test worst-supported payloads. |
| CPU-04 | Turning every internal step into a Queue task | Keep direct delivery one event-driven consumer when it fits. Split only measured expensive optional stages with durable typed messages and stable action IDs. Account for added operations. |
| CPU-05 | Treating local latency or `Date.now()` elapsed time as CPU proof | Store target-plan CPU trace evidence with p50/p95/max, sample size, bundle revision, and fixture/load conditions. Track wall latency separately. |
| CPU-06 | Expensive password hashing, reporting, migrations, or cleanup hidden in hot requests | Profile auth independently; select an authentication design that fits without weakening security. Use bounded maintenance and separate report work. Never create indexes per request. |
| CPU-07 | Arbitrary splitting that loses progress or repeats the external send | Define stage ownership, handoff failure recovery, immutable inputs, and idempotency before splitting. Measure both stages and total cost. |

Under 5 ms is the normal target across handlers; 5–10 ms requires optimization/review and documented headroom. At/above 10 ms fails the project gate. Do not rely on occasional platform tolerance above a limit.

## 3. Database anti-patterns

| ID | Avoid | Required approach / proof |
|---|---|---|
| DB-01 | D1 task table plus Queue notifications plus watchdog | Queue carries the work; D1 stores business state and compact delivery outcomes. No minute work-discovery scans. |
| DB-02 | Assuming `LIMIT 1` or one query means one row read | Capture query plans and metered rows with realistic history. Selective indexed lookup must stay bounded as unrelated history grows. |
| DB-03 | Missing compound tenant/account/media or pagination indexes | Design indexes from actual equality/range/order predicates; verify `EXPLAIN QUERY PLAN`, including joins and subqueries. |
| DB-04 | `COUNT/MAX` of send history for each authorization/rate check | Maintain small atomic scoped state. History is for bounded activity/reporting, not hot coordination. |
| DB-05 | Indexing every column or frequently changing status without a query need | Justify each index with a query and measured read/write tradeoff; index maintenance consumes writes/storage. |
| DB-06 | Offset pagination over long history, leading-wildcard scans, or JS sorting whole result sets | Bounded cursor pagination and appropriate indexed predicates; assess any search index separately. |
| DB-07 | Read-then-write ownership/counters, process-memory locks, or KV deduplication | Atomic conditional writes/unique constraints; optional account coordinator when justified. Test simultaneous claims. |
| DB-08 | Repeating writes for unchanged profiles/state or making direct flows create contacts | Persist only required business changes; advanced state exists only for advanced flows. |
| DB-09 | Bulk deletion/index rebuild without budgeting | Bounded retention and reviewed migrations; account for affected rows/index writes. Preserve deduplication through replay horizon. |
| DB-10 | Unbounded dashboard counts/refetch or one query per rendered row | Bounded API queries, scoped cache freshness and pagination. Include dashboard traffic in daily quota projections. |

Index review evidence should show stable query ID, predicates, dataset sizes, chosen index, query plan, and measured rows read/written. A single-column index may still scan many tenant records; use compound prefixes matching the hot query. Schema changes belong in migrations. [D1 index guidance](https://developers.cloudflare.com/d1/best-practices/use-indexes/)

## 4. Queue, retry, and conflict anti-patterns

| ID | Avoid | Required approach / proof |
|---|---|---|
| Q-01 | Default batch size silently exceeding the shared invocation CPU budget | Start configured batch size one. Handle every delivered message deliberately; do not retry extra messages as routine batching strategy. |
| Q-02 | Assuming one message/batch means account serialization or FIFO | Expect concurrent, duplicate, out-of-order work. Use account/action ownership and versioned flow transitions. |
| Q-03 | Acknowledging before durable enqueue or final processing state | Await publication at ingress; persist consumer outcome before ack. Partial publication/redelivery must be safe. |
| Q-04 | Whole-batch retries after some external actions succeeded | Use per-message ack/retry; avoid repeating confirmed completed actions. |
| Q-05 | Immediate retries, sleeping inside a handler, or independent adapter/UI/consumer retries | One business retry owner; delayed bounded exponential backoff with jitter and provider cooldowns. Track cumulative attempts/age. |
| Q-06 | Blind retry of timeout/5xx after possible external acceptance | Classify as unknown unless documented safe to retry; reconcile or inspect. Do not claim exactly-once external delivery. |
| Q-07 | Maximum retry count as the only stopping rule | Check provider messaging window, event age, Queue retention, campaign pause, account status, and attempt cap. |
| Q-08 | Republishing to reset attempt count or renewing work forever | Preserve logical attempt lineage and deadline across all stages/replays. Bound poison work and send it to review/DLQ. |
| Q-09 | DLQ with no alert/operator path or assumed permanent retention | Define alert, response owner, secure replay, and expiry handling. An unprocessed message can expire before DLQ processing. |
| Q-10 | Multiple workers racing the same send or old app and V2 both sending | Stable cross-revision action key and atomic attempt owner; one sending implementation per campaign. |
| Q-11 | Push/pull polling of an empty queue or a recovery Cron scanning all history | Push consumer activation on actual messages; maintenance only for specific bounded needs. |
| Q-12 | In-memory rate counters or one global lock | Coordinate at verified account/operation scope; isolate unrelated accounts while honoring shared app limits. |

Queue retries/acks are per-message decisions; messages share the consumer invocation's CPU budget. Queues supports explicit delayed retries and finite retry-to-DLQ configuration. A partial batch failure must not resend acknowledged successes. [Batching/retries](https://developers.cloudflare.com/queues/configuration/batching-retries/)

Suggested initial application retry parameters: base 5 seconds, exponential factor 2, jitter, 5-minute backoff cap, and at most 3 automatic retries after the initial attempt. These are provisional product settings, not Meta limits. A verified provider retry/cooldown longer than the local backoff takes precedence; if it exceeds the remaining deadline, expire/defer for review instead of sending too early. Persist logical attempt count across requeues. Unknown sends do not enter this automatic retry path.

## 5. Meta capability and rate-limit rules

Exact numerical Meta limits are **not verified in this session**: official messaging/private-reply/rate-limit pages returned access errors or HTTP 429. Do not import an internet-wide “DMs per day” number, assume every endpoint has one limit, or treat a conservative internal throttle as provider authorization. Complete this matrix in P02 before enabling live sends.

| Operation | Scope and numeric cap/window | Required verification |
|---|---|---|
| Comment private reply | UNVERIFIED | Login path/API version, account/app scope, allowed timing/count, error codes, usage feedback |
| Public comment reply | UNVERIFIED | Endpoint permission and operation-specific limit/window |
| Conversation send | UNVERIFIED | Messaging eligibility/window, operation rate, relevant routing constraints |
| Media/profile reads | UNVERIFIED | Read quotas, pagination, eligible identity/profile fields |
| OAuth/token refresh | UNVERIFIED | Expiry/refresh eligibility, refresh timing, failure and revocation handling |

Store the completed matrix and sanitized observations in `docs/integrations/meta-contract.md` when the spike is performed. It must include source URL, retrieval date, selected API version, access tier, scope, numeric units/window, observed headers/codes, and configuration mapping. Do not create a fabricated completed contract file now.

| ID | Avoid | Required approach / proof |
|---|---|---|
| META-01 | Universal send allowance or hardcoded undocumented threshold | Verified per-operation configuration; scope-aware rate reservation and documented conservative headroom. Respect app-wide constraints as well as account limits. |
| META-02 | HTTP status alone deciding retry safety | Inspect documented provider code/subcode and operation semantics; rate limits may arrive in Graph error responses. Capture safe correlation/trace IDs and usage headers when provided. |
| META-03 | Continuing traffic during throttle or revoked permissions | Share cooldown at applicable scope; pause invalid connections and surface reconnect action. Avoid repeated token failures per queued event. |
| META-04 | Private reply treated as unlimited DM consent | Verify one-reply/timing contract and qualifying continuation. Enforce eligibility at execution time, including delayed retries. |
| META-05 | Follow check scraping or unavailable field treated as false | Verify relationship capability for this login path; represent unknown explicitly and keep feature disabled if unsupported. |
| META-06 | Mixing comment actors, IGSIDs, account IDs, tokens, or API hosts | Typed identity mapping and fixture tests; credentials/version/host belong to the selected provider adapter. |
| META-07 | Tokens/full messages/email contents in logs or frontend | Server-only protected credentials and sanitized minimal operational metadata. |

Official references to reverify: [Instagram messaging](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/), [private replies](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/private-replies/), [Graph rate limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/). These links identify the verification targets, not evidence of a successful read in this session.

## 6. Permanent change-review gate

For every execution/data/provider change, record applicable IDs and proof in the implementation tracker. At minimum answer:

- What actual invocation runs this work, and what are CPU p95/max for its supported payload/batch?
- What happens when the process crashes on either side of the Meta call or durable handoff?
- How do duplicate, concurrent, stale, and out-of-order events behave?
- What metered rows, index writes, Queue stages/retries, storage, and maintenance does it add per day?
- Which index and provider contract support the operation? Are they measured/verified or still assumed?
- What prevents unsafe retry, deadline extension, token-failure loops, and quota exhaustion?
- Are current status, evidence, next action, migration level, and deployment state updated for the next contributor?

An unverified critical contract or failed hard budget blocks live sending for that path. Record the gap precisely and continue independent work. Changes to product policy/guardrails need an explicit documented rationale; do not silently weaken them to make a test pass.
