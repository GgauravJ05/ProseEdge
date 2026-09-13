# 0005 — Hacker News collection and author strata

- **Status:** Accepted
- **Date:** 2026-09-11
- **Amends:** spec §5.1 (how Hacker News is accessed) and §5.2 (the author stratum)

## Context

Phase 3 (spec §11) starts with collection. The spec names Hacker News's
official Firebase API. That API serves one item per request, and stories share
an ID space with comments and polls: the newest item ID on 2026-09-11 was
49,656,922, so a full pass is about fifty million requests.

Spec §5.2 pairs posts only within the same author-karma decile. The Hacker News
API exposes only a user's current karma. Karma measured today includes points
earned after, and partly because of, the posts being compared, which is the
leak stratification exists to prevent.

Reddit, the second source, is needed for community-holdout splits, but Hacker
News alone is enough to build and test the pipeline.

## Decision

- **Source.** Collect stories from the Algolia HN Search API
  (`search_by_date`, `tags=story`). It returns at most 1,000 hits per query, so
  the collector asks for one UTC day at a time and halves any window that
  reports more, down to one second. Requests are spaced at least 0.4 s apart
  and retried with exponential backoff on network errors, HTTP 429 and 5xx.
- **Snapshots.** One JSON Lines file of source-agnostic `Post` rows per calendar
  month under `training/data/raw/` (never committed), with a manifest under
  `training/data/manifests/` (committed). A month whose manifest still verifies
  is not fetched again.
- **Settling.** Points and comment counts are snapshots. A month is collected
  only once 14 days have passed since it ended, and the collection date is
  recorded in its manifest.
- **Community.** For Hacker News, the community is the post kind from Algolia's
  tags: `ask_hn`, `show_hn` or `story`.
- **Author stratum.** Replace the author-karma decile with the decile of the
  author's number of earlier submissions in the corpus, counted strictly before
  the post's timestamp. Points on those earlier submissions are not used: they
  are snapshots too, and include votes cast after the post being ranked.
- **Order.** Hacker News first. Reddit is a later collector emitting the same
  rows; community-holdout splits wait for it.

## Consequences

- Collection depends on a third-party index of Hacker News rather than its own
  API. Stories removed before collection are absent, and a later re-collection
  would see different scores; manifests pin what was actually collected and
  when.
- Prior submission count is a weaker proxy for an author's reach than karma, but
  it is knowable at post time. A corpus that starts in month M undercounts
  authors active before M, so pairing must either collect from Hacker News's
  first month (2006-10) or treat early months as warm-up only.
- With three communities, "same community" controls only for post kind until
  Reddit is added.
