# P03 owner/storage slice evidence

Date: 2026-10-29 (Asia/Calcutta). Status: locally verified slice; **P03 remains in progress**.

## Verified

- `pnpm check`: PASS, 10 test files / 35 tests, strict types, lint/import guard, frontend production build, and separate Worker dry-run builds.
- Real local D1 via the same Miniflare version as Wrangler: one winner across five concurrent OAuth-state consumers; mismatched/expired states rejected; revoked sessions cascade pending states.
- Account ownership: another workspace cannot read, overwrite, or disconnect a credential. Tokens are encrypted and public account metadata excludes ciphertext/token values. Disconnect clears ciphertext and changes generation.
- Supabase adapter with fake provider responses + real D1: only the configured, email-confirmed owner gets a local session; another user, malformed response, wrong Origin, rate rejection, and provider failure do not create a session. No live Supabase call occurred.
- Session tests: Secure/HttpOnly/SameSite flags, duplicate-cookie rejection, one-hour expiry, no writes on reads, and logout revocation. Provider MFA challenges are not bypassed.
- Local migration `0001_owner_and_accounts.sql` applied successfully with `--local`; no remote database created or migrated.
- Browser smoke: actual local workerd on port 8791 returned health 200 and protected endpoints 401. Mocked UI responses exercised empty-field validation, 503/401 errors, sign-in, logout/cache clearing, and 390px layout with no page exceptions. Local screenshot visually inspected. This is not live Supabase/browser-cookie proof.

## D1 evidence

With 1,500 unrelated session rows and 1,500 unrelated account rows, local D1 metadata reported:

| Query ID | Rows read | Rows written | Plan |
|---|---:|---:|---|
| owner.session_find | 2 | 0 | Session primary key + workspace lookup |
| accounts.list | 2 | 0 | idx_instagram_accounts_workspace |

Captured with `pnpm exec vitest run apps/api/src/features/owner/storage.test.ts --reporter=verbose --disableConsoleIntercept`. These are local measurements of these exact fixture/query shapes, not a daily capacity guarantee or production quota observation. Index maintenance adds writes during creation/deletion; budget that before rollout.

## Bundle and CPU

The API dry-run is approximately 56 KiB (14 KiB gzip); a shared auth Zod Mini schema reduced an initial approximately 786 KiB bundle. Ingress/consumer remain approximately 1.24/1.60 KiB and import no owner/provider stack. These are bundle measurements, **not CPU profiling**. Target-plan authentication/SQL/crypto CPU remains NOT_MEASURED.

## Remaining work

Live Supabase owner project/configuration, signup/recovery/MFA policy, production rate binding, target-plan CPU, and live browser cookies are not verified. Campaign/revision/delivery schema and atomic send ownership are not implemented. Retention cleanup and its write budget are not implemented. Credential refresh persistence needs its own concurrent-refresh fencing before the real Meta lifecycle is wired.

Guardrails reviewed: CPU-01/05/06 (password hashing external, CPU claim withheld), DB-01/03/07/10 (indexed scoped queries, atomic state consume, no second queue), Q-02/10 (no send path enabled), META-06/07 (server-only encrypted credentials, no live account assumptions). Root `.env` values remain ignored and no filled credentials are part of this change.

Source revision: 0a8145c5af4d421070c60b7dccec2ff308d6f97f, pushed to origin/dev. Remote GitHub Actions must be checked independently; all verification above was local.
