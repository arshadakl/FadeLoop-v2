# FadeLoop V2

Event-driven Instagram comment-to-DM automation on Cloudflare Workers Free.

**Current stage: P02 local Meta integration preparation; P01 foundation is complete. No Instagram connection or message delivery is enabled.** See the [live implementation tracker](docs/implementation/implementation-plan.md) for verified progress and next steps.

## Local development

Requirements: Node 22.23 or newer and pnpm 10.34.6.

```sh
pnpm install --frozen-lockfile
pnpm hooks:install
pnpm dev:api
```

In another terminal, run `pnpm dev`. Open the Vite URL; `/api` is proxied to the local API Worker on port 8787. The initial screen displays real health-request state, not sample campaign data.

```sh
pnpm check
```

This runs lint/boundary checks, TypeScript, tests, Vite production build, and separate Wrangler dry-run builds. It does not deploy or provision resources. No D1/Queue bindings or Cron triggers exist yet; add them only in their planned phases after resource and provider verification.

## Repository map

- `apps/web`: React, Tailwind, shadcn-style primitives, TanStack Query, lazy page routing.
- `apps/api`, `apps/ingress`, `apps/consumer`: independently bundled Worker entry points.
- `packages/contracts`: browser-safe Zod schemas and inferred transport types.
- `packages/domain`: pure delivery types and clock seam.
- `packages/worker-common`: narrowly exported server-only HTTP/logging helpers.
- [Documentation](docs/README.md): architecture, design, permanent guardrails, and development handoff.

Worker configs separate local, test, and production names; public workers.dev/preview URLs are disabled. The ingress returns 503 for webhooks until authentication and durable enqueueing exist. The unbound consumer never sends or acknowledges work and must not be attached to a production queue during this phase.

Work and push only on `dev`. Every commit follows Conventional Commits; install local hooks and keep CI enabled. Do not commit local research or credentials. See [AGENTS.md](AGENTS.md).

For P02, see [local Meta setup](docs/integrations/meta-local-setup.md). `pnpm meta:check` validates configuration names/shape without contacting Meta or printing secrets; successful local validation is not a live integration check.
