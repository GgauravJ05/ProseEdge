# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

"""Verified snapshots in, the post-time features pairing needs out (spec §5.2, ADR 0005).

Every feature here is knowable when the post is made: its 6-hour bucket and its
author's number of *earlier* submissions. Nothing reads another post's score.
"""

from bisect import bisect_right
from collections import defaultdict
from collections.abc import Iterable, Sequence
from datetime import datetime
from itertools import groupby
from pathlib import Path

from proseedge_training.data.schema import Post
from proseedge_training.manifest import Manifest, verify

BUCKET_SECONDS = 6 * 60 * 60
DECILES = 10

type PostKey = tuple[str, str]


class CorpusError(ValueError):
    """Snapshots that cannot be trusted as pairing input."""


def key(post: Post) -> PostKey:
    return (post.source, post.id)


def load(manifests: Iterable[Path], root: Path) -> list[Post]:
    """Every post in the snapshots the manifests describe, ordered by time.

    Refuses a snapshot that no longer matches its manifest, and a post that
    appears in two snapshots.
    """
    posts: dict[PostKey, Post] = {}
    for path in sorted(manifests):
        manifest = Manifest.from_json(path.read_text(encoding="utf-8"))
        if problems := verify(manifest, root):
            raise CorpusError("; ".join(problems))
        with (root / manifest.file).open(encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                post = Post.from_json(line)
                if key(post) in posts:
                    raise CorpusError(f"{post.source} post {post.id} appears in two snapshots")
                posts[key(post)] = post
    return sorted(posts.values(), key=lambda p: (p.created_at, p.source, p.id))


def bucket_of(when: datetime) -> int:
    """The 6-hour UTC bucket containing `when`, as an index from the Unix epoch."""
    return int(when.timestamp()) // BUCKET_SECONDS


def bucket(post: Post) -> int:
    return bucket_of(post.created_at)


def prior_counts(posts: Iterable[Post]) -> dict[PostKey, int]:
    """Each post's author's number of submissions strictly earlier than it.

    Posts by one author in the same second see the same count: neither is
    "before" the other.
    """
    seen: defaultdict[tuple[str, str], int] = defaultdict(int)
    counts: dict[PostKey, int] = {}
    ordered = sorted(posts, key=lambda p: p.created_at)
    for _, group in groupby(ordered, key=lambda p: p.created_at):
        batch = list(group)
        for post in batch:
            counts[key(post)] = seen[post.source, post.author]
        for post in batch:
            seen[post.source, post.author] += 1
    return counts


def quantile_edges(values: Sequence[int], bins: int = DECILES) -> tuple[int, ...]:
    """Edges for `bins` equal-frequency bins over `values`.

    Tied values cannot be split, so heavily tied data yields fewer distinct
    strata than `bins`. Most authors have no earlier submissions, which is
    exactly this case; the effective count is reported, not hidden.
    """
    if not values:
        raise CorpusError("cannot compute quantiles of no values")
    if bins < 1:
        raise ValueError(f"bins must be positive: {bins}")
    ordered = sorted(values)
    return tuple(sorted({ordered[len(ordered) * i // bins] for i in range(1, bins)}))


def stratum(value: int, edges: Sequence[int]) -> int:
    """The bin of `value`: the number of edges at or below it."""
    return bisect_right(edges, value)
