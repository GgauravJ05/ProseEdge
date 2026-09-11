# 0006 — Stratified pairs and time-based splits

- **Status:** Accepted
- **Date:** 2026-09-12
- **Amends:** spec §5.2 (the pairing margin, and details the spec leaves open)
- **Builds on:** ADR 0005 (collection and the prior-activity stratum)

## Context

Spec §5.2 forms a pair only when both posts share a community, a 6-hour bucket
and an author stratum, keeps it only when the scores differ by a margin τ
(starting at 4×), and splits by time. Implementing it on the July 2026 Hacker
News snapshot (31,283 stories) raised questions the spec does not answer:

1. **The margin alone labels noise.** 42% of those stories have 1 or 2 points
   and 16% have 10 or more. A 1-point story against a 4-point story clears 4×,
   but neither left /newest; the label says nothing about the title.
2. **One story can dominate.** A busy bucket holds hundreds of stories (424 at
   most in July). A breakout story clears the margin against almost all of
   them, so without a cap it anchors most of the bucket's pairs.
3. **Reposts cross splits.** July alone repeats 1,582 titles. A title the model
   was trained on, reappearing at test time, measures memory, not ranking.
4. **Strata need edges.** Deciles computed over every split let later data move
   the training strata.
5. **Prior counts need history.** ADR 0005 noted that a corpus starting in
   month M undercounts authors active before M.

## Decision

- **Margin.** A pair is labelled when the winner has at least **4×** the
  loser's points **and at least 10 points**. A loser at or below 1 point counts
  as 1. Both thresholds are `Criteria` fields and are written into every pair
  manifest.
- **Cap.** Each post appears in at most **3 pairs**. Candidates in a group are
  shuffled with a generator seeded by the run seed and the group key, so a
  group's pairs depend only on that group's posts.
- **Order.** Each pair's first/second order is random, so position carries no
  label information. Scores are kept in the pair rows for audit and are never a
  model input.
- **Identical titles.** Two posts with the same normalized title (NFKC,
  case-folded, punctuation and spacing collapsed) are never paired.
- **Splits.** Five UTC boundaries on 6-hour edges: warm-up, train, validation,
  test, end. Warm-up posts only feed prior counts and are never paired. A
  pair's split is its bucket's, so no pair can straddle two.
- **Strata edges.** Prior-submission decile edges come from training-range posts
  only. Heavy ties (most authors have no earlier posts) collapse deciles; the
  edges are recorded, not padded to ten.
- **Reposts.** A validation post whose normalized title appears anywhere in the
  training range is excluded before pairing; a test post is excluded if its
  title appears in training or validation. The excluded count goes in the
  manifest.
- **Leak checks.** `leaks.py` re-derives every rule from the finished pair rows:
  split and bucket agreement, one split per post, the per-post cap, the margin,
  and zero title overlap between splits. The pipeline writes nothing if any
  check fails, and each check has a test that plants the leak it exists for.
- **History.** Collect Hacker News from its first month (2006-10), so prior
  counts are lifetime counts, rather than relying on a warm-up window.

## Consequences

- The task becomes "did this title get traction, against one that did not, in
  the same conditions", not "rank any two stories". Pairs between two
  moderately successful stories (say 12 against 40) are kept; pairs at the very
  bottom are not. Accuracy numbers only apply to that task.
- The floor and cap cut the pair count well below every eligible pair. That is
  the intent; the manifest records posts per split so the ratio is visible.
- Excluding reposts removes some of the easiest test items, which lowers
  reported accuracy compared with a naive split.
- Full-history collection is a one-time run of hours and leaves several hundred
  megabytes of uncommitted raw data. Algolia's own per-year counts were not
  reliable enough to estimate it more precisely.
- Community-holdout splits still wait for Reddit (ADR 0005).
