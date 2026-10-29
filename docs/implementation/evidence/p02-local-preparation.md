# P02 local integration preparation

Date: 2026-10-29. Owner: Codex. Result: local preparation verified; **P02 is not complete**.

## Checks

- `pnpm check`: PASS, including lint/import guard, strict type checks, 8 test files / 21 tests, frontend build, and independent Worker dry-run builds.
- Tests exercise raw-byte HMAC verification, changed-body/wrong-secret rejection, AES-GCM fresh nonces and tamper/account/key rejection, malformed key rejection, and OAuth owner/expiry/replay behavior with a fake store.
- Mocked OAuth request tests cover exact endpoints/callback, no secret in authorize URLs, unsafe numeric-ID rejection, unversioned token lifecycle endpoints, bounded responses, sanitized failures, and no automatic retry.
- `pnpm meta:check`: expected incomplete-configuration result, without provider calls or secret output. Existing `APP_ID`, `APP_SECRET`, and `WEBHOOK_VERIFY_TOKEN` aliases are recognized.
- Root `.env` is ignored; only variable names were displayed. A 32-byte encryption key was generated into that ignored file without printing its value or overwriting existing credentials.
- Old reference commit 4b7e49a confirms v23.0, /auth/callback, and APP_SECRET signing. Its version baseline was appended locally; current provider support remains unverified. The V1 callback hostname was not copied.
- No application routes were enabled, no tokens exchanged, no subscriptions changed, no messages sent, and no resources deployed.

## Interpretation

The OAuth test store is a fake and does not prove atomic D1 consumption. Encryption helpers are not credential persistence. The signature helper is not a functioning ingress pipeline. Helpers have narrow server-only exports and are not imported by current production entry points; existing Worker dry-run sizes remain unchanged. Production/Free-plan CPU is NOT_MEASURED.

P02-01 through P02-06 remain open for real provider evidence. Supply/register the V2 callback URI and verify v23.0 support and actual account grants. Implement the minimal P03 owner session and durable state/token storage before exposing OAuth routes. See the [partial Meta contract](../../integrations/meta-contract.md) and [local setup](../../integrations/meta-local-setup.md).

The first test run after cloning the legacy reference also discovered its ignored tests. Test discovery is now explicitly restricted to this workspace's apps/packages, and the corrected run passes all 21 project tests. The legacy tests are not used as V2 proof.

Relevant guardrails: CPU-01/03/05 (bounded helpers; no CPU claim), DB-07 (explicit atomic-state-store requirement), Q-03/06 (no acknowledgment/sending path enabled), META-01/04/06/07 (no guessed rate, no assumed consent/identity mapping, no secret disclosure).

Source revision: b92b29bb4e2511a036744ae2ba88480b54365b87, pushed to origin/dev. Final readiness check reports only META_REDIRECT_URI missing; it did not contact Meta. Remote CI is separate from local verification and should be checked on GitHub.
