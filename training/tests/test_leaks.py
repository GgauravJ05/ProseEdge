# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

"""Each check must catch the leak it exists for. A clean result proves nothing
unless a planted leak makes it fail."""

import dataclasses
from datetime import UTC, datetime, timedelta

from proseedge_training.data import leaks
from proseedge_training.data.corpus import bucket_of
from proseedge_training.data.pairs import Criteria, Pair, PairSet
from proseedge_training.data.splits import Boundaries, Split

START = datetime(2026, 7, 1, tzinfo=UTC)
HOUR = timedelta(hours=1)
BOUNDS = Boundaries(
    warmup=START,
    train=START + 6 * HOUR,
    validation=START + 18 * HOUR,
    test=START + 24 * HOUR,
    end=START + 30 * HOUR,
)


def _pair(split: Split, first: str, second: str, hours: int, **changes: object) -> Pair:
    when = START + hours * HOUR
    pair = Pair(
        split=split,
        source="hacker-news",
        community="story",
        bucket=bucket_of(when),
        stratum=0,
        first_id=first,
        first_title=f"Story {first}",
        first_created_at=when,
        first_score=40,
        second_id=second,
        second_title=f"Story {second}",
        second_created_at=when,
        second_score=1,
        label=1,
    )
    return dataclasses.replace(pair, **changes)


def _set(
    *,
    train: list[Pair] | None = None,
    validation: list[Pair] | None = None,
    test: list[Pair] | None = None,
) -> PairSet:
    return PairSet(
        boundaries=BOUNDS,
        criteria=Criteria(),
        edges=(0,),
        pairs={"train": train or [], "validation": validation or [], "test": test or []},
        posts={},
        excluded_reposts={},
    )


def test_a_clean_set_passes() -> None:
    clean = _set(train=[_pair("train", "a", "b", 7)], test=[_pair("test", "c", "d", 25)])
    assert leaks.check(clean) == []


def test_catches_a_pair_filed_under_the_wrong_split() -> None:
    [problem] = leaks.check(_set(train=[_pair("train", "a", "b", 19)]))
    assert "belongs to validation" in problem


def test_catches_posts_from_different_buckets() -> None:
    pair = _pair("train", "a", "b", 7, second_created_at=START + 13 * HOUR)
    assert any("buckets" in p for p in leaks.check(_set(train=[pair])))


def test_catches_a_post_paired_in_two_splits() -> None:
    problems = leaks.check(
        _set(train=[_pair("train", "a", "b", 7)], test=[_pair("test", "a", "c", 25)])
    )
    assert any("post a is paired in ['test', 'train']" in p for p in problems)


def test_catches_a_title_seen_in_an_earlier_split() -> None:
    repost = _pair("validation", "c", "d", 19, first_title="STORY a")
    problems = leaks.check(_set(train=[_pair("train", "a", "b", 7)], validation=[repost]))
    assert problems == ["validation: 1 titles already appear in an earlier split"]


def test_catches_scores_under_the_margin_and_overused_posts() -> None:
    weak = _pair("train", "a", "b", 7, first_score=9)
    overused = [_pair("train", "x", f"y{i}", 8) for i in range(4)]
    problems = leaks.check(_set(train=[weak, *overused]))
    assert any("do not clear the margin" in p for p in problems)
    assert any("post x is in 4 pairs, cap is 3" in p for p in problems)


def test_catches_a_pair_of_identical_titles() -> None:
    pair = _pair("train", "a", "b", 7, second_title="story A")
    assert any("same title" in p for p in leaks.check(_set(train=[pair])))
