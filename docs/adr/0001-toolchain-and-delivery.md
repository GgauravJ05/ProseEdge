# 0001 — Toolchain and delivery process

- **Status:** Accepted
- **Date:** 2026-09-10

## Context

The spec (§8.3) requires that every number in `docs/RESULTS.md` is reproducible
and that CI runs tests, benchmarks and parity checks on every push. The project
has two languages — TypeScript for the browser app and document model, Python
for training and evaluation — and one maintainer, so the process must be strict
without depending on anyone remembering to follow it.

## Decision

### TypeScript

| Concern         | Choice                                                                                       | Note                                                                             |
| :-------------- | :------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------- |
| Runtime         | Node 24 (`.node-version`)                                                                    | Active LTS                                                                       |
| Package manager | pnpm, version pinned via `packageManager`                                                    | Strict dependency isolation, lockfile enforced in CI                             |
| Compiler        | TypeScript **6.0.x**, `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` | TypeScript 7 is out, but typescript-eslint supports `<6.1`; revisit when it does |
| Lint / format   | ESLint `strictTypeChecked` + Prettier                                                        | Zero warnings allowed                                                            |
| Tests           | Vitest, `fast-check`, V8 coverage                                                            | Property tests are load-bearing (§4.2)                                           |
| Dependencies    | Exact versions, updated by Dependabot                                                        | No silent drift between a green PR and a red main                                |

### Python (`training/`, `eval/`)

uv for environments and the lockfile, Python 3.13, ruff for lint and format,
pyright for types, pytest. GPU training does not run in CI; CI runs unit tests,
a CPU smoke-train on a tiny model, and the ONNX parity check (§6.1).

### Delivery

- **Repository:** public on GitHub. Required so branch rulesets are enforced
  without a paid plan; the code is AGPL and the spec commits neither data nor
  weights, so nothing is lost by it.
- **Branching:** trunk-based. `main` accepts changes only through pull requests
  that pass the required checks; squash merge, linear history.
- **Commits:** Conventional Commits, enforced on the PR title (which becomes the
  squash commit). release-please turns them into versions and a changelog.
- **CI hardening:** every third-party action pinned to a full commit SHA,
  workflow `permissions` default to read-only, workflows linted by zizmor.
- **Property-test budget:** 200 runs per property on PRs; a nightly job runs
  20,000 so rare shrinks are found without slowing review.
- **Deployment:** the static Next.js export deploys to Cloudflare Pages — a
  preview URL per PR, production on merge to `main`. Model weights are too large
  for Pages' per-file limit and are served from object storage (R2) with
  immutable, content-hashed URLs.

## Consequences

- Contributors need Node 24 with Corepack and uv; `CONTRIBUTING.md` lists the
  exact commands.
- Pinning to SHAs means Dependabot opens more PRs; that is the intended price
  of not running unreviewed action code.
- TypeScript is one major behind latest until typescript-eslint catches up.
