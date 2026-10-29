# Owner email/password authentication

Decision: 2026-10-29. The owner selected **Supabase Auth** for email/password. Cloudflare Workers handles authorization, local sessions, and business data; Supabase performs password verification. No Worker password hashes, plaintext password storage, browser Supabase tokens, or service-role key are used.

## Request path

```text
Owner form → POST /api/login → origin/content/size checks → native rate gate
  → configured Supabase password endpoint → confirmed allowlisted user ID
  → indexed workspace lookup → random local session → hashed session row
  → Secure + HttpOnly + SameSite=Lax cookie
```

The server trusts the response from its configured HTTPS auth origin after password verification. It does not accept a browser-supplied user ID, decoded JWT claims, workspace ID, or arbitrary provider URL. Only `OWNER_SUPABASE_USER_ID` can sign in, and that identity must already own a provisioned D1 workspace. A different valid Supabase user receives the same generic sign-in failure.

The provider response is bounded and tokens discarded. Requests have a 10-second wall-time timeout with no automatic retry; this is not a CPU allowance. Native password verification happens at Supabase. Worker CPU remains subject to the under-5-ms target and below-10-ms project ceiling; live CPU has not been measured.

Reference: [Supabase password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [official request implementation](https://github.com/supabase/auth-js/blob/master/src/GoTrueClient.ts). The thin adapter uses the same password token endpoint and avoids importing unrelated Supabase client features.

## Sessions and revocation

FadeLoop sessions expire after one hour, without sliding renewal or refresh-token storage. D1 stores a domain-separated SHA-256 digest of a 32-byte random token. Session reads do not update timestamps or extend expiry. Logout deletes the session and cascades pending OAuth states. No raw session token is returned in JSON.

Supabase revocation/password changes do not immediately invalidate independently issued FadeLoop sessions: they remain valid until local logout, explicit D1 revocation, or the one-hour deadline. An operator changing owner identity must revoke that workspace's sessions. Production rollout must document this recovery path; do not promise instant identity-provider revocation propagation.

Every state-changing browser endpoint requires an exact configured Origin. HTTPS is required except loopback local development; cookies remain Secure even locally. No permissive CORS or missing-Origin fallback is used. OAuth's public callback has separate single-use state/session requirements and is not exposed by this slice.

## Abuse controls and limitations

Local config defines a native rate gate of five owner-password attempts per 60 seconds, keyed to this single-owner login route. Cloudflare's counters are per location and approximate; this is not a strict global limit. Use a unique namespace per deployment and retain Supabase's auth limits. [Cloudflare rate binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

Login fails closed when provider configuration, rate binding, or database binding is missing. No public signup or automatic workspace creation is exposed. The UI supports sign-in/out; password recovery and MFA challenge screens are not implemented. Confirmed MFA factors cause sign-in to be refused rather than silently bypassed.

Supabase project setup and live owner sign-in remain unverified. Its Free service has separate limits and inactivity pausing; check those before deployment. [Supabase pricing](https://supabase.com/pricing). No Supabase business database is introduced: application state stays in D1.
