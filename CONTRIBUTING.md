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

### Training (Python)

`training/` is a separate uv project. Requirements: [uv](https://docs.astral.sh/uv/)
0.12.2 (pinned in `training/pyproject.toml`); uv installs Python 3.13 itself.

```sh
cd training
uv sync                # creates .venv from uv.lock
uv run ruff format --check && uv run ruff check && uv run pyright && uv run pytest
```

Like pnpm, uv refuses releases younger than a day. Hypothesis runs 200 examples
per property; `HYPOTHESIS_PROFILE=deep uv run pytest` runs 20,000.

Collect Hacker News stories month by month ([ADR 0005](docs/adr/0005-hacker-news-collection-and-author-strata.md)).
Snapshots go to `training/data/raw/`, which is ignored; commit the manifests
written to `training/data/manifests/`. Months already collected and intact are
skipped, so an interrupted run can simply be repeated.

```sh
uv run proseedge-data hn 2024-01 2024-12
```

## Workflow

1. Branch from `main`: `feat/short-name`, `fix/short-name`.
2. Open a pull request. `main` accepts nothing else — no direct pushes.
3. The PR title must follow [Conventional Commits](https://www.conventionalcommits.org/):
   `type(scope): lowercase subject`. It becomes the squash commit and drives
   the changelog. Scopes: `document`, `analysis`, `runtime`, `ui`, `app`,
   `training`, `eval`, `bench`, `docs`, `ci`, `deps`.
4. Merge only when the **CI OK** and **Conventional PR title** checks are
   green, and only by squash. The repository is public, so `main`'s branch
   ruleset (`.github/rulesets/main.json`) enforces this
   ([ADR 0012](docs/adr/0012-public-repository.md)).

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
