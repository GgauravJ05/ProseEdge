## What and why

<!-- One paragraph. Link the spec section (e.g. §4.2) or ADR this implements. -->

## How it was verified

<!-- Tests added, commands run, benchmark or eval output. "CI passes" alone is not verification. -->

## Checklist

- [ ] PR title follows Conventional Commits (`feat(document): …`); it becomes the squash commit
- [ ] Tests cover the change; property tests for anything touching §4.2 invariants
- [ ] Any new number in docs comes from `eval/` or `bench/` output, not estimated
- [ ] No datasets, model weights or secrets committed
- [ ] Decision worth recording? Added an ADR in `docs/adr/`
