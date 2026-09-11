# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

"""Stratified pairwise labels (spec §5.2, ADR 0006).

Two posts are compared only when they competed under the same conditions: same
source and community, same 6-hour bucket, same decile of prior submissions. A
pair is labelled only when the gap means something: the winner has at least
`WINNER_FLOOR` points and at least `MARGIN` times the loser's. On Hacker News
most stories never leave /newest, and 1 point against 4 is noise, not signal.
"""

import json
import random
import re
import unicodedata
from collections import Counter, defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Self

from proseedge_training._json import as_object, expect
from proseedge_training.data.corpus import bucket, key, prior_counts, quantile_edges, stratum
from proseedge_training.data.schema import Post
from proseedge_training.data.splits import Boundaries, Split

MARGIN = 4
WINNER_FLOOR = 10
# Without a cap, one breakout story in a busy bucket anchors dozens of
# near-identical pairs and the model learns that story, not titles.
MAX_PAIRS_PER_POST = 3
PAIRED_SPLITS: tuple[Split, ...] = ("train", "validation", "test")
_HALF = 0.5

_NOT_WORD = re.compile(r"[\W_]+")


class PairError(ValueError):
    """Pairing input or a pair row that breaks the pairing rules."""


def normalize_title(title: str) -> str:
    """The form in which two titles count as the same post: NFKC, case-folded,
    punctuation and spacing collapsed. A title with no word characters falls
    back to its case-folded self, so two different emoji titles stay different."""
    folded = unicodedata.normalize("NFKC", title).casefold()
    return _NOT_WORD.sub(" ", folded).strip() or folded


@dataclass(frozen=True, slots=True, kw_only=True)
class Criteria:
    margin: float = MARGIN
    winner_floor: int = WINNER_FLOOR
    max_pairs_per_post: int = MAX_PAIRS_PER_POST
    seed: int = 0

    def __post_init__(self) -> None:
        # A margin above 1 makes "beats" strict, so no pair can be labelled both ways.
        if self.margin <= 1:
            raise PairError(f"margin must be greater than 1: {self.margin}")
        if self.winner_floor < 1:
            raise PairError(f"winner_floor must be at least 1: {self.winner_floor}")
        if self.max_pairs_per_post < 1:
            raise PairError(f"max_pairs_per_post must be at least 1: {self.max_pairs_per_post}")

    def separates(self, winner: int, loser: int) -> bool:
        """Whether scores `winner` and `loser` differ enough to label. A loser at or
        below 1 point is treated as 1, so the margin still means something."""
        return winner >= self.winner_floor and winner >= self.margin * max(loser, 1)


def _timestamp(when: datetime) -> str:
    return when.isoformat().replace("+00:00", "Z")


def _utc(fields: dict[str, object], name: str) -> datetime:
    try:
        when = datetime.fromisoformat(expect(fields, name, str, PairError))
    except ValueError as e:
        if isinstance(e, PairError):
            raise
        raise PairError(f"invalid {name}: {e}") from e
    return when


@dataclass(frozen=True, slots=True, kw_only=True)
class Pair:
    split: Split
    source: str
    community: str
    bucket: int
    stratum: int
    first_id: str
    first_title: str
    first_created_at: datetime
    second_id: str
    second_title: str
    second_created_at: datetime
    # Kept to audit the margin. Never a model input: they are the label.
    first_score: int
    second_score: int
    # 1 when the first post received more engagement, else 0.
    label: int

    def __post_init__(self) -> None:
        if self.split not in PAIRED_SPLITS:
            raise PairError(f"split must be one of {PAIRED_SPLITS}: {self.split!r}")
        if self.first_id == self.second_id:
            raise PairError(f"a post cannot be paired with itself: {self.first_id}")
        if self.label not in {0, 1}:
            raise PairError(f"label must be 0 or 1: {self.label}")
        if (self.first_score > self.second_score) != (self.label == 1):
            raise PairError(
                f"label {self.label} contradicts scores {self.first_score}/{self.second_score}"
            )
        for when in (self.first_created_at, self.second_created_at):
            if when.utcoffset() != timedelta(0):
                raise PairError(f"timestamps must be UTC: {when!r}")

    def to_json(self) -> str:
        row = {
            "split": self.split,
            "source": self.source,
            "community": self.community,
            "bucket": self.bucket,
            "stratum": self.stratum,
            "first_id": self.first_id,
            "first_title": self.first_title,
            "first_created_at": _timestamp(self.first_created_at),
            "first_score": self.first_score,
            "second_id": self.second_id,
            "second_title": self.second_title,
            "second_created_at": _timestamp(self.second_created_at),
            "second_score": self.second_score,
            "label": self.label,
        }
        return json.dumps(row, ensure_ascii=False, sort_keys=True)

    @classmethod
    def from_json(cls, line: str) -> Self:
        fields = as_object(json.loads(line), "pair", PairError)
        split = expect(fields, "split", str, PairError)
        if split not in PAIRED_SPLITS:
            raise PairError(f"split must be one of {PAIRED_SPLITS}: {split!r}")
        return cls(
            split=split,
            source=expect(fields, "source", str, PairError),
            community=expect(fields, "community", str, PairError),
            bucket=expect(fields, "bucket", int, PairError),
            stratum=expect(fields, "stratum", int, PairError),
            first_id=expect(fields, "first_id", str, PairError),
            first_title=expect(fields, "first_title", str, PairError),
            first_created_at=_utc(fields, "first_created_at"),
            first_score=expect(fields, "first_score", int, PairError),
            second_id=expect(fields, "second_id", str, PairError),
            second_title=expect(fields, "second_title", str, PairError),
            second_created_at=_utc(fields, "second_created_at"),
            second_score=expect(fields, "second_score", int, PairError),
            label=expect(fields, "label", int, PairError),
        )


@dataclass(frozen=True, slots=True, kw_only=True)
class PairSet:
    boundaries: Boundaries
    criteria: Criteria
    # Prior-submission decile edges, computed from training posts only.
    edges: tuple[int, ...]
    pairs: dict[Split, list[Pair]]
    # Posts whose bucket falls in each split, before repost exclusion.
    posts: dict[Split, int]
    # Posts left out of a split because their title already appeared in an earlier one.
    excluded_reposts: dict[Split, int]


type GroupKey = tuple[int, str, str, int]


def make_pairs(posts: Sequence[Post], boundaries: Boundaries, criteria: Criteria) -> PairSet:
    """Label pairs for every split. Output depends only on the posts and criteria,
    not on the order the posts arrive in."""
    counts = prior_counts(posts)
    by_split: dict[Split, list[Post]] = {split: [] for split in PAIRED_SPLITS}
    for post in posts:
        split = boundaries.split_of_bucket(bucket(post))
        if split is not None and split != "warmup":
            by_split[split].append(post)
    if not by_split["train"]:
        raise PairError("no posts fall in the training range")
    # Edges from training posts only: later splits must not shape the strata.
    edges = quantile_edges([counts[key(post)] for post in by_split["train"]])

    earlier_titles: set[str] = set()
    pairs: dict[Split, list[Pair]] = {}
    excluded: dict[Split, int] = {}
    for split in PAIRED_SPLITS:
        pool = [p for p in by_split[split] if normalize_title(p.title) not in earlier_titles]
        excluded[split] = len(by_split[split]) - len(pool)
        groups: defaultdict[GroupKey, list[Post]] = defaultdict(list)
        for post in pool:
            strat = stratum(counts[key(post)], edges)
            groups[bucket(post), post.source, post.community, strat].append(post)
        pairs[split] = [
            pair
            for group in sorted(groups)
            for pair in _pair_group(split, group, groups[group], criteria)
        ]
        earlier_titles.update(normalize_title(p.title) for p in by_split[split])

    return PairSet(
        boundaries=boundaries,
        criteria=criteria,
        edges=edges,
        pairs=pairs,
        posts={split: len(by_split[split]) for split in PAIRED_SPLITS},
        excluded_reposts=excluded,
    )


def _pair_group(
    split: Split, group: GroupKey, members: list[Post], criteria: Criteria
) -> list[Pair]:
    bucket_index, source, community, strat = group
    # Seeded per group, so adding posts to one bucket never reshuffles another.
    rng = random.Random(f"{criteria.seed}/{bucket_index}/{source}/{community}/{strat}")  # noqa: S311 - sampling, not security
    ordered = sorted(members, key=lambda p: p.id)
    titles = {p.id: normalize_title(p.title) for p in ordered}
    candidates = [
        (winner, loser)
        for winner in ordered
        for loser in ordered
        if winner.id != loser.id
        and criteria.separates(winner.score, loser.score)
        and titles[winner.id] != titles[loser.id]
    ]
    rng.shuffle(candidates)

    uses: Counter[str] = Counter()
    out: list[Pair] = []
    for winner, loser in candidates:
        if max(uses[winner.id], uses[loser.id]) >= criteria.max_pairs_per_post:
            continue
        uses[winner.id] += 1
        uses[loser.id] += 1
        # Random order, so position carries no information about the label.
        first, second = (winner, loser) if rng.random() < _HALF else (loser, winner)
        out.append(
            Pair(
                split=split,
                source=source,
                community=community,
                bucket=bucket_index,
                stratum=strat,
                first_id=first.id,
                first_title=first.title,
                first_created_at=first.created_at,
                first_score=first.score,
                second_id=second.id,
                second_title=second.title,
                second_created_at=second.created_at,
                second_score=second.score,
                label=int(first is winner),
            )
        )
    return out
