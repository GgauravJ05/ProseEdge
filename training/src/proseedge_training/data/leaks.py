# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

"""Independent checks on a finished pair set (spec §5.2).

`pairs.py` is written so none of these can fail. They re-derive each property
from the pair rows alone, so a regression there shows up here instead of as a
suspiciously good test score.
"""

from collections import Counter, defaultdict
from typing import TYPE_CHECKING

from proseedge_training.data.corpus import bucket_of
from proseedge_training.data.pairs import PAIRED_SPLITS, Pair, PairSet, normalize_title

if TYPE_CHECKING:
    from proseedge_training.data.splits import Split


def check(pair_set: PairSet) -> list[str]:
    """Every leak or labelling rule the pair set breaks; empty if it is clean."""
    return [
        *_row_problems(pair_set),
        *_posts_in_several_splits(pair_set),
        *_overused_posts(pair_set),
        *_title_overlap(pair_set),
    ]


def _row_problems(pair_set: PairSet) -> list[str]:
    problems: list[str] = []
    boundaries, criteria = pair_set.boundaries, pair_set.criteria
    for split in PAIRED_SPLITS:
        for pair in pair_set.pairs.get(split, []):
            where = f"{split} pair {pair.first_id}/{pair.second_id}"
            if pair.split != split:
                problems.append(f"{where}: row says {pair.split}")
            buckets = {bucket_of(pair.first_created_at), bucket_of(pair.second_created_at)}
            if buckets != {pair.bucket}:
                problems.append(
                    f"{where}: posts from buckets {sorted(buckets)}, row says {pair.bucket}"
                )
            problems.extend(
                f"{where}: a post belongs to {found}"
                for found in {boundaries.split_of_bucket(b) for b in buckets} - {split}
            )
            winner, loser = sorted((pair.first_score, pair.second_score), reverse=True)
            if not criteria.separates(winner, loser):
                problems.append(f"{where}: scores {winner}/{loser} do not clear the margin")
            if normalize_title(pair.first_title) == normalize_title(pair.second_title):
                problems.append(f"{where}: both posts have the same title")
    return problems


def _post_ids(pair: Pair) -> tuple[tuple[str, str], tuple[str, str]]:
    return (pair.source, pair.first_id), (pair.source, pair.second_id)


def _posts_in_several_splits(pair_set: PairSet) -> list[str]:
    splits: defaultdict[tuple[str, str], set[Split]] = defaultdict(set)
    for split in PAIRED_SPLITS:
        for pair in pair_set.pairs.get(split, []):
            for post in _post_ids(pair):
                splits[post].add(split)
    return [
        f"{source} post {post_id} is paired in {sorted(found)}"
        for (source, post_id), found in sorted(splits.items())
        if len(found) > 1
    ]


def _overused_posts(pair_set: PairSet) -> list[str]:
    uses: Counter[tuple[str, str]] = Counter()
    for split in PAIRED_SPLITS:
        for pair in pair_set.pairs.get(split, []):
            uses.update(_post_ids(pair))
    cap = pair_set.criteria.max_pairs_per_post
    return [
        f"{source} post {post_id} is in {count} pairs, cap is {cap}"
        for (source, post_id), count in sorted(uses.items())
        if count > cap
    ]


def _title_overlap(pair_set: PairSet) -> list[str]:
    problems: list[str] = []
    earlier: set[str] = set()
    for split in PAIRED_SPLITS:
        titles = {
            normalize_title(title)
            for pair in pair_set.pairs.get(split, [])
            for title in (pair.first_title, pair.second_title)
        }
        if overlap := titles & earlier:
            problems.append(f"{split}: {len(overlap)} titles already appear in an earlier split")
        earlier |= titles
    return problems
