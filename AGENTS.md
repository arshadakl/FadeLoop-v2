# FadeLoop V2 repository instructions

## Git workflow

- Work and commit only on `dev`. Verify the current branch before editing or committing. Do not create feature branches unless the user explicitly changes this policy.
- Push only the local `dev` branch to the remote `dev` branch. Once the intended remote is configured, use an explicit refspec such as `git push origin dev:dev`.
- Do not push to `main`, `master`, other branches, or tags. Do not use `--all`, `--mirror`, or force pushes.
- Do not guess a remote URL or reuse the old FadeLoop repository as the V2 destination without user direction.
- The authorized V2 remote is `https://github.com/arshadakl/FadeLoop-v2.git`; use it as `origin` and push only `dev:dev`.
- Every commit must follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/): `<type>[optional scope][optional !]: <description>`, with optional body and footers separated by blank lines.
- Use `feat` for features and `fix` for bug fixes. Other appropriate types include `docs`, `refactor`, `perf`, `test`, `build`, `ci`, and `chore`. Use consistent lowercase types and concise, meaningful descriptions.
- Mark breaking changes with `!` before the colon or a `BREAKING CHANGE: <description>` footer. Explain the impact when needed.
- Keep commits focused, review the staged diff, and run checks appropriate to the change before committing. Do not include credentials or unrelated changes.

## Implementation references

- Owner sign-in uses Supabase Auth email/password (explicit user choice). Do not replace it with an owner access key or weaken password hashing to meet Worker CPU limits. See `docs/engineering/owner-authentication.md`; production CPU and live provider verification remain required.

- Before implementation, read `docs/implementation/implementation-plan.md` and `docs/engineering/guardrails-and-anti-patterns.md`.
- Keep the implementation tracker current in the same change as development: task status, owner, evidence, blockers, exact next action, and separate local/remote/deployed state. Do not mark untested or unverified work done.
- Deploy on Cloudflare Workers Free. Target under 5 ms active CPU per invocation and stay below the 10 ms project ceiling for HTTP, Queue, and scheduled paths. Respect daily account-wide D1/Queue allowances; measure metered rows and retries, not just successful events or query counts.
- Review applicable anti-pattern IDs on execution/data/provider changes. No D1 second queue, minute discovery scans, blind external-send retries, non-atomic claims/counters, or guessed Meta rate limits. Split only measured work with safe durable handoffs and accounted Queue cost.

- Follow the architecture and code standards in `docs/architecture/fadeloop-v2-architecture.md`, especially sections 10–13.
- Follow `docs/design/design-SKILL.md` with the explicit accessibility and responsive-layout adaptations recorded in architecture section 11.
- Local research belongs in `docs/research/`. Keep `deep-research-report.md` ignored and never force-add it.
