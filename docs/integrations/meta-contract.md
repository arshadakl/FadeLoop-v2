# Meta integration contract — P02 in progress

Reviewed: 2026-10-29. This is a partial contract register, **not a verified live integration**. App and professional test account readiness are user-reported. The root ignored `.env` contains the names `APP_ID`, `APP_SECRET`, and `WEBHOOK_VERIFY_TOKEN`; values are not included here or in logs.

## Evidence levels

| Area | Status | Evidence / next action |
|---|---|---|
| Login path | Selected: Instagram Login | Keep Facebook Login tokens/hosts/scopes separate |
| API version | Legacy baseline pinned to v23.0 | Read from old wrangler.toml; current provider support still UNVERIFIED |
| Permissions | Candidate scopes documented | Basic, comment management, messaging management; prove actual grants/access level on test account |
| Credentials | Local names found; legacy signing mapping inspected | Old OAuth and webhook code both use APP_SECRET; provider validity still UNVERIFIED |
| OAuth state | Locally tested helper only | Random state, digest-only record, owner-session binding, expiry, single-use storage contract; no callback route or DB adapter yet |
| Token protection | Locally tested helper only | AES-GCM authenticated encryption bound to caller-supplied workspace/account context; no token storage or provider exchange yet |
| Webhook signature | Locally tested helper only | HMAC over raw bytes; ingress remains 503 until P04 authentication/enqueue integration |
| Subscriptions / real event fixtures | NOT_RUN | Verify app and account subscriptions, then capture sanitized signed test events |
| Private reply / continuation | NOT_RUN | Prove one reply and qualifying continuation with test accounts before any automated sends |
| Token lifecycle / revocation | NOT_RUN | Code exchange, expiry, refresh, reconnect, deauthorization/deletion contract pending |
| Rate limits | UNVERIFIED | Complete per-operation matrix with official sources and observed codes/headers; no universal DM allowance |

## Sources and remaining contract checks

Meta's official Instagram Login collection lists the candidate permissions `instagram_business_basic`, `instagram_business_manage_comments`, and `instagram_business_manage_messages`; content publishing is not needed for the MVP. Its presence in a collection does not prove this app has access. [Official Meta collection](https://www.postman.com/meta/instagram/folder/1z5vxzu/instagram-api-with-instagram-login)

Meta's official messaging collection states that ordinary messaging requires the recipient to have contacted the professional account. Private-reply eligibility is a separate contract and must be verified before continuation logic is enabled. [Messaging prerequisites](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-3fe78620-2258-44b6-893f-42d76c7200d7)

Business Login, private-reply, and API-version documentation could not be reliably read through the research tool in this session. The old repository provides the explicit v23.0 baseline, not proof of current support. The initial scopes are candidates, and private-reply timing/count limits remain release gates. Record exact version, source retrieval date, access tier, numeric scope/window, sanitized error codes, and observed usage feedback when live checks run.

## Old repository findings

Inspected public reference commit: `4b7e49a0df2f6b49d978c1f117eaa4a8ab3eb520`. The clone is kept under ignored `.artifacts/reference/fadeloop` and is not a dependency.

- [Configuration](https://github.com/arshadakl/FadeLoop/blob/4b7e49a0df2f6b49d978c1f117eaa4a8ab3eb520/wrangler.toml): `GRAPH_VERSION=v23.0`, callback path `/auth/callback`. Its checked-in hostname belongs to V1 and must not be used as the V2 target without an intentional cutover.
- [OAuth implementation](https://github.com/arshadakl/FadeLoop/blob/4b7e49a0df2f6b49d978c1f117eaa4a8ab3eb520/src/auth/oauth.ts): Instagram authorization endpoint, form-encoded code exchange, and unversioned long-lived token exchange. [Refresh implementation](https://github.com/arshadakl/FadeLoop/blob/4b7e49a0df2f6b49d978c1f117eaa4a8ab3eb520/src/api/client.ts) uses an unversioned refresh endpoint.
- [Credential guide](https://github.com/arshadakl/FadeLoop/blob/4b7e49a0df2f6b49d978c1f117eaa4a8ab3eb520/.env.example) and [webhook route](https://github.com/arshadakl/FadeLoop/blob/4b7e49a0df2f6b49d978c1f117eaa4a8ab3eb520/src/routes/webhook.ts): APP_ID/APP_SECRET are Instagram Login credentials, and APP_SECRET verifies webhook HMAC. V2 now supports that legacy mapping with an explicit signing override.

V2's request layer is tested with injected mock fetch for authorize URL, code exchange, long-token exchange, and refresh. It fixes unsafe numeric-ID acceptance, bounds responses, disables redirects/retries, and emits sanitized failures. No requests using real credentials have been made; this is source-contract parity, not provider acceptance evidence.

The local crypto implementation uses standard Web Crypto operations available in Workers; target-plan CPU remains unmeasured. [Cloudflare Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/). State and session binding follow OAuth security principles; provider-specific PKCE support still requires verification. [OWASP OAuth guidance](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)

## Atomic state-store contract

Before exposing OAuth routes, implement owner authentication and a durable state store. Creation persists only `{digest, ownerSessionId, expiresAt}`. Callback consumption is one atomic conditional mutation matching digest, current authenticated owner session, and unexpired deadline, returning success once only. Tests currently use a deterministic fake to exercise helper behavior; they do **not** establish D1 concurrency correctness. Do not use in-memory state, KV, or read-then-delete in production.

Bind token encryption context to the actual authorized workspace/account resolved server-side. Never use a client-supplied account claim as the context without ownership validation. The v1 envelope identifies the format, not a rotation policy: do not replace the encryption key while encrypted records remain unless an explicit old-key recovery/re-encryption path exists.

## Phase dependency clarification

P02 live OAuth persistence depends on P03's minimal owner session, state-store, and credential-storage implementation. Build those prerequisites before wiring public connect/callback routes. A focused provider test harness may be used for controlled contract checks, but must not expose an unauthenticated production onboarding endpoint. No D1 task queue or scheduler is needed for OAuth.
