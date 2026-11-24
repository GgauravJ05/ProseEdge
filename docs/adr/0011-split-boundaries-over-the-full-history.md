# 0011 — Split boundaries over the full Hacker News history

- **Status:** Accepted
- **Date:** 2026-09-15
- **Builds on:** ADR 0005 (collection) and ADR 0006 (pairing rules and the five boundaries)

## Context

ADR 0006 defines five UTC boundaries (warm-up, train, validation, test, end)
but not where they fall. With the full history collected (238 monthly
snapshots, 2006-10 to 2026-07, 4,727,774 stories) they can be chosen from the
data rather than from the July 2026 sample.

Measured over the snapshots:

| Period     | Stories | With ≥ 10 points | Share |
| :--------- | ------: | ---------------: | ----: |
| 2006-10–12 |      46 |                6 | 13.0% |
| 2009       |  88,327 |           20,699 | 23.4% |
| 2013       | 260,569 |           35,415 | 13.6% |
| 2022       | 299,091 |           59,910 | 20.0% |
| 2025       | 301,532 |           52,618 | 17.5% |
| 2026-01–07 | 217,145 |           31,784 | 14.6% |

The share of stories reaching the 10-point floor drifts by year (13–23%), and
fell again in 2026 while submissions rose. The last collected month is 2026-07,
collected 2026-09-12, well past the 14-day settling rule.

## Decision

| Edge       | Boundary (UTC) | Split covers       |
| :--------- | :------------- | :----------------- |
| warm-up    | 2006-10-01     | 2006-10 to 2006-12 |
| train      | 2007-01-01     | 2007-01 to 2024-07 |
| validation | 2024-08-01     | 2024-08 to 2025-07 |
| test       | 2025-08-01     | 2025-08 to 2026-07 |
| end        | 2026-08-01     | exclusive          |

- **Test is the most recent 12 months.** The model is used on posts written
  after it was trained, so the latest data is the honest proxy. Twelve months
  cover every season (holiday lulls, conference and launch cycles) once, so a
  test number is not a statement about one quarter.
- **Validation is the 12 months before test**, for the same seasonal reason.
  It sits directly after training, as test sits directly after validation, so
  model selection faces the same one-year step forward in time as the final
  number does.
- **Train is everything earlier.** Whether a model should use all 17½ years or
  a recent window is a modelling question for phase 4, answered on validation.
  The boundaries do not decide it.
- **Warm-up is HN's first three months**, 46 stories that could form almost no
  pairs. They still feed prior-submission counts. Every edge is a month start
  at midnight UTC, so it is also a 6-hour bucket edge.
- **Seed 0**, and the default `Criteria` from ADR 0006.
- **No embargo gap** between splits. Exact reposts are already excluded
  (ADR 0006); a gap is revisited only if per-month test accuracy shows the
  first weeks after a boundary scoring higher than the rest.

Reproduce from `training/`:

```sh
uv run proseedge-data pairs --warmup 2006-10-01 --train 2007-01-01 \
  --validation 2024-08-01 --test 2025-08-01 --end 2026-08-01 --seed 0
```

## Result

All leak checks passed. A second run with the same seed produced byte-identical
pair files (the manifests, which carry each file's SHA-256, matched).

| Split      |     Posts | Reposts excluded |     Pairs | First post wins |
| :--------- | --------: | ---------------: | --------: | --------------: |
| train      | 4,091,821 |                0 | 1,783,102 |           50.0% |
| validation |   288,765 |           11,565 |   134,626 |           50.1% |
| test       |   347,142 |           11,471 |   143,464 |           49.7% |

Prior-submission decile edges from training posts: 1, 4, 11, 24, 48, 99, 225,
598, 2067 (ten strata). The three pair manifests under
`training/data/manifests/pairs/` pin these numbers and the digest of every
input snapshot.

## Consequences

- About 4.0% of validation and 3.3% of test posts are dropped as reposts of
  earlier titles, which removes easy items and lowers reported accuracy
  compared with a naive split.
- 143k test pairs put a 95% interval on accuracy at roughly ±0.26 points, so
  baseline differences of a point are resolvable. Per-month and per-community
  breakdowns are smaller and should be reported with their own intervals.
- The test year includes 2026's lower share of 10-point stories. A model that
  learned the older distribution may lose accuracy there; that is a finding to
  report, not a reason to move the boundary.
- Training pairs are 752 MB of JSON Lines, uncommitted. Phase 4 either streams
  them or subsamples on the training side; validation and test stay whole.
- When a new month is collected, these boundaries stay fixed. Moving them is a
  new ADR, because it changes every reported number.
