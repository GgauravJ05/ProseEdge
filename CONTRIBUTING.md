# Contributing

Start with [`docs/architecture-spec.md`](docs/architecture-spec.md). It defines
what gets built, in what order, and what counts as done. Decisions that refine
it live in [`docs/adr/`](docs/adr/).

## Setup

Requirements: Node 24 (see `.node-version`) with Corepack.

```sh
corepack enable        # provides the pnpm version pinned in package.json
pnpm install           # also installs git hooks via lefthook
pnpm check             # typecheck, lint, format check, tests with coverage
```

| Command                     | Does                                    |
| :-------------------------- | :-------------------------------------- |
| `pnpm dev`                  | Next.js dev server                      |
| `pnpm build`                | Static export to `out/`                 |
| `pnpm e2e`                  | Playwright against `out/` (build first) |
| `pnpm test:watch`           | Vitest in watch mode                    |
| `pnpm test:coverage`        | Full test run with coverage report      |
| `pnpm lint` / `pnpm format` | ESLint (zero warnings) / Prettier write |
| `pnpm fixtures:unicode`     | Regenerate the UnicodeData excerpt      |

## Workflow

1. Branch from `main`: `feat/short-name`, `fix/short-name`.
2. Open a pull request. `main` accepts nothing else — no direct pushes.
3. The PR title must follow [Conventional Commits](https://www.conventionalcommits.org/):
   `type(scope): lowercase subject`. It becomes the squash commit and drives
   the changelog. Scopes: `document`, `analysis`, `runtime`, `ui`, `app`,
   `training`, `eval`, `bench`, `docs`, `ci`, `deps`.
4. Merge only when the **CI OK** and **Conventional PR title** checks are
   green, and only by squash. The repository is private on a free plan, so the
   ruleset is not enforced and this is on you
   ([ADR 0003](docs/adr/0003-private-repository.md)).

Releases are automatic: release-please keeps a release PR open with the next
version and changelog; merging it tags the release.

## Property tests

The §4.2 invariants are checked by `fast-check` with 200 runs per property on
PRs and 20,000 nightly. When a property fails, fast-check prints a seed and a
shrink path. Reproduce exactly with:

```sh
FC_SEED=<seed> FC_PATH=<path> pnpm test src/document/invariants.test.ts
```

Fix the bug, then add the shrunk counterexample as an example test so it can
never regress silently.

## Evidence rule

Numbers in `README.md` or `docs/` must come from a committed script in `eval/`
or `bench/`. Never estimate a number into the docs (spec §0).
