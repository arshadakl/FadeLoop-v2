# Local foundation

Use the root README commands. API local development uses wrangler.local.jsonc with local D1 and a native login rate binding. Run pnpm db:migrate first. No remote resource IDs or credentials are invented. See [owner auth setup](owner-auth-setup.md) for Supabase configuration.

The API exposes owner login/session/logout and protected account metadata. Missing provider configuration fails closed; Meta connect/send routes remain disabled. Ingress still rejects webhooks. The consumer has no configured queue. Its fallback retries unexpected work without acknowledgment; this is not a production retry implementation and must be replaced in P05 before attaching real workloads.

Local `pnpm build` uses explicit test-environment Wrangler dry-runs and does not deploy. A successful build measures neither Cloudflare Free CPU nor provider behavior. Live performance remains a P07/P08 gate.

Git hooks enforce Conventional Commits and dev-to-dev pushes locally. Run `pnpm hooks:install` after cloning. The check script validates every commit in a supplied range, and CI runs it against newly introduced history. Local hooks are not remote branch protection; repository administrators can configure protection independently.

The boundary check is a conservative source guard for browser-safe directories; strict workspace dependencies and separate Worker builds provide further separation. Review new import paths and dependencies rather than treating a passing guard as a complete security proof.
