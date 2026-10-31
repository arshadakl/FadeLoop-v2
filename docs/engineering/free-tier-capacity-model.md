# Free-Tier Capacity Model and P07 Reliability Proof

**Last Updated**: 2026-10-31  
**Target Environment**: Cloudflare Workers Free Tier  
**Empirically Verified Via**: `apps/consumer/src/metered-quotas.test.ts`, `apps/consumer/src/failure-injection.test.ts`, `apps/consumer/src/concurrency.test.ts`.

---

## 1. Measured Physical Operations per Workload Class

Based on physical measurements from `meta.rows_read` and `meta.rows_written` in D1:

| Workload Class | Trigger | D1 Rows Read | D1 Rows Written | Queue Ops | Meta API Calls |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Class A: Non-matching Comment** | Comment contains no trigger keywords | 2 (campaign + revision JOIN) | 0 | 3 (ingress, consume, ack) | 0 |
| **Class B: Matching Delivery** | Comment matches keyword; private reply sent | 4 (campaign JOIN + account + FK check) | 6 (claim + 2 indexes, outcome + 2 indexes) | 3 (ingress, consume, ack) | 1 (private reply) |
| **Class C: Duplicate / Replay** | Same comment webhook delivered again | 2 (campaign JOIN) | 0 (UNIQUE constraint blocks claim) | 3 (ingress, consume, ack) | 0 |
| **Class D: Dashboard Campaign List** | Creator opens campaigns page | 1–20 (bounded cursor) | 0 | 0 | 0 |
| **Class E: Campaign Create** | Creator publishes new post automation | 0 | 2 (campaign + revision) | 0 | 0 |

---

## 2. Daily & 30-Day Free-Tier Capacity Calculations

Cloudflare Workers Free Daily Allowances:
- **D1 Daily Writes**: 100,000 writes / day
- **Cloudflare Queues Daily Operations**: 10,000 operations / day
- **D1 Daily Reads**: 5,000,000 reads / day
- **Worker Active CPU**: < 10 ms hard ceiling, < 5 ms project target

### Bottleneck Analysis
Each message in a 1-stage queue uses ~3 operations:
1. `queue.sendBatch` at Ingress (1 operation)
2. Queue message delivery to Consumer (1 operation)
3. `message.ack()` settlement (1 operation)

At 10,000 Queue operations/day:
$$\text{Max Queue Capacity} = \frac{10,000}{3} \approx 3,333 \text{ messages/day}$$

Reserving a **25% safety headroom** for transient retries, network hiccups, and bursts:
$$\text{Safe Daily Ingress Envelope} = 3,333 \times 0.75 \approx 2,500 \text{ webhook comments/day}$$

### D1 Write Capacity Check
At 2,500 matching deliveries per day:
$$\text{Daily D1 Writes} = 2,500 \times 6 = 15,000 \text{ writes/day}$$
This represents only **15.0% of the 100,000 daily write allowance**, leaving 85,000 writes/day of headroom!

### D1 Read Capacity Check
At 2,500 matching deliveries + 2,500 non-matching comments:
$$\text{Daily D1 Reads} = (2,500 \times 4) + (2,500 \times 2) = 15,000 \text{ reads/day}$$
This represents only **0.3% of the 5,000,000 daily read allowance**!

---

## 3. Operational Warning & Backpressure Thresholds

Per project policy:
- **50% Warning Level (1,250 comments/day)**: Log warning notification in dashboard metrics.
- **75% Urgent Action Level (1,875 comments/day)**: Operator alert; consider pausing high-volume non-essential campaigns.
- **100% Platform Limit (2,500–3,333 comments/day)**: Ingress returns HTTP 503 (`QUEUE_CAPACITY_REACHED`), causing Meta to back off and buffer webhooks upstream without dropping events.

---

## 4. Anti-Pattern Verification Checklist

| ID | Anti-Pattern Description | Status | Verification Evidence |
| :--- | :--- | :---: | :--- |
| **CPU-01** | Running ingress, matching, and sending in 1 request | **PASS** | Strict separation: Ingress validates HMAC & enqueues; Consumer processes off queue. |
| **CPU-03** | Unbounded envelope parsing or body sizes | **PASS** | 64 KB ceiling on Ingress; max 8 KB JSON on API routes; cached WebCrypto AES key in Consumer. |
| **CPU-06** | Password hashing in hot paths | **PASS** | Supabase Auth handles owner authentication; zero bcrypt/argon2 hashing on Workers. |
| **DB-01** | Task table polling or discovery scans | **PASS** | Push-based Cloudflare Queue carries all work; zero background cron polling D1. |
| **DB-02** | Unbounded `SELECT *` or scans | **PASS** | All queries use explicit indexes (`idx_campaigns_published_media`, `idx_campaigns_workspace`, `idx_delivery_claims_comment`). |
| **DB-06** | Offset pagination over large history | **PASS** | Keyset / cursor pagination only (`WHERE updated_at < ? ORDER BY updated_at DESC LIMIT 20`). |
| **DB-07** | Read-then-write race conditions | **PASS** | Atomic constraints (`UNIQUE(account_id, comment_id)` and `DELETE FROM oauth_states ... RETURNING *`). |
| **Q-01** | Unbounded batch size exceeding CPU | **PASS** | Configured batch size 1 with per-message `try/catch` error boundaries. |
| **Q-03** | Acking before durable persistence | **PASS** | Outcome persisted in D1 before `message.ack()`; Ingress awaits queue send before 200 OK. |
| **Q-04** | Whole-batch retry after partial success | **PASS** | Per-message ack and retry isolation. |
| **Q-05** | Sleeping or blind immediate retry | **PASS** | Bounded exponential backoff with jitter (`delaySeconds: 5 * 3^(attempts-1)`), max 300s. |
| **Q-06** | Blind retries on ambiguous network timeout | **PASS** | Timeout classified as `unknown` with no blind retry; prevents duplicate customer messages. |
| **META-03** | Retrying during active throttle | **PASS** | HTTP 429 parses `Retry-After` header and delays message execution. |
| **META-04** | Expired message send attempts | **PASS** | 7-day reply window verified on every attempt; expired comments acked and dropped. |
| **META-07** | Tokens or secrets in frontend / logs | **PASS** | AES-256-GCM encrypted tokens at rest; frontend only receives public metadata. |
