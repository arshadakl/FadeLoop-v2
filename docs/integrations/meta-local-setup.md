# Local Meta configuration

The app/test account is ready according to the owner. Existing credentials in root `.env` stay there and remain Git-ignored; do not paste their values into chat.

`pnpm meta:check` reads root `.env`, then optional `apps/api/.dev.vars` overrides (existing process environment takes precedence). It accepts `APP_ID`, `APP_SECRET`, and `WEBHOOK_VERIFY_TOKEN` as local aliases for the canonical `META_*` names. The old source confirms APP_SECRET also signs webhook HMAC; an explicit META_WEBHOOK_SIGNING_SECRET overrides that legacy mapping. The command only validates local configuration shape and never makes network calls.

Add the remaining values to your existing ignored `.env` once known:

```dotenv
META_GRAPH_VERSION=v23.0
META_REDIRECT_URI=https://your-v2-test-domain.example/auth/callback
TOKEN_ENCRYPTION_KEY=<32-byte-base64url-key>
```

Confirm the app ID/secret pair belongs to the selected Instagram Login setup. The v23.0 baseline comes from old FadeLoop configuration and still needs current-provider verification. The example callback path is reserved for future implementation; it is not currently served. Use the exact registered V2 HTTPS redirect URI. Do not reuse the old deployment hostname: it routes back into V1. No callback URL has been invented or written into your local credentials.

For this working copy, the encryption key was generated privately and the legacy version baseline added without changing the existing credentials. `pnpm meta:check` currently requires the V2 callback URL. Root `.env` is not committed.

To generate the encryption key **locally**, run:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Save its output directly into the ignored environment file and a secure backup. Keep the key stable; changing it makes existing encrypted tokens unreadable without a rotation plan. Do not commit it or include it in screenshots/logs. No token has been stored yet.

The readiness check returning success means configuration is present and correctly shaped, not that login, credentials, permissions, subscriptions, rate limits, or messaging work. An app secret alone is not an Instagram user access token. Do not generate or paste tokens into browser code.

Wrangler does not automatically use root `.env` as secret bindings. The local readiness command is intentionally separate from the health-only Worker runtime. When OAuth routes are ready, configure only their needed secrets in the owning Worker's ignored `.dev.vars` or Cloudflare secret bindings. No secret is placed in a Wrangler config or a `VITE_*` variable.
