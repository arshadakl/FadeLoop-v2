# Configure the first owner locally

The implementation is ready for configured testing; no Supabase project was created by this work.

1. Create or select your Supabase project and enable email/password Auth. Create the owner in Auth → Users and verify the email. Keep additional signup disabled for this single-owner release.
2. Put these values in ignored root `.env` for the provisioning script and in the API Worker's ignored `apps/api/.dev.vars` for local runtime. Copy only these auth fields for now; do not overwrite existing Meta secrets or duplicate unfilled Meta placeholders.

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-or-legacy-anon-key>
OWNER_SUPABASE_USER_ID=<the-confirmed-owner-user-uuid>
```

Use a publishable key (or legacy anon key), never a secret/service_role key. Do not put the owner password in environment files or commit any filled configuration.

3. Run:

```sh
pnpm db:migrate
pnpm owner:provision
pnpm dev:api
pnpm dev
```

The first two commands operate **only on local D1** using `wrangler.local.jsonc`. Provisioning validates the UUID and preserves an existing workspace for that owner. It writes no password, access token, or session cookie. Production provisioning requires a separately reviewed resource configuration in P08.

4. Open the Vite URL at `/login` and sign in. The local config permits Origin `http://127.0.0.1:5173`; if you intentionally change frontend origin, update APP_ORIGIN accordingly. Use HTTPS for shared/public environments and preserve Secure cookies. Verify session/logout behavior in the actual target browser; do not remove cookie protections to work around local setup.

5. Confirm `/api/session` identifies the expected owner/workspace and `/api/accounts` shows only that workspace's metadata. These endpoints never return credential ciphertext or raw provider tokens. Missing configuration yields 503 and unauthenticated access yields 401.

Local migrations currently contain workspaces, hashed owner sessions, single-use OAuth states, and encrypted account storage. Campaigns, delivery claims, retention jobs, and real Meta connection remain future work. See the [authentication decision](../engineering/owner-authentication.md).
