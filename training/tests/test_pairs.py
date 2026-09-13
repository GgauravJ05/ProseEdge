# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import dataclasses
import random
from datetime import UTC, datetime, timedelta

import pytest
from hypothesis import given
from hypothesis import strategies as st

from proseedge_training.data import leaks
from proseedge_training.data.pairs import Criteria, Pair, PairError, make_pairs, normalize_title
from proseedge_training.data.schema import Post
from proseedge_training.data.splits import Boundaries

START = datetime(2026, 7, 1, tzinfo=UTC)
HOUR = timedelta(hours=1)
# Buckets: warmup [0, 6h), train [6h, 18h), validation [18h, 24h), test [24h, 30h).
BOUNDS = Boundaries(
    warmup=START,
    train=START + 6 * HOUR,
    validation=START + 18 * HOUR,
    test=START + 24 * HOUR,
    end=START + 30 * HOUR,
)
TRAIN, VALIDATION, TEST = 7, 19, 25


def _post(  # noqa: PLR0913 - one keyword per field a test varies
    post_id: str,
    score: int,
    *,
    hours: float = TRAIN,
    author: str | None = None,
    title: str | None = None,
    community: str = "story",
) -> Post:
    return Post(
        source="hacker-news",
        id=post_id,
        community=community,
        author=author or f"author-{post_id}",
        title=title or f"Story {post_id}",
        created_at=START + timedelta(hours=hours),
        score=score,
        comments=0,
    )


def _unordered(pairs: list[Pair]) -> set[frozenset[str]]:
    return {frozenset((p.first_id, p.second_id)) for p in pairs}


def test_pairs_need_both_the_margin_and_the_floor() -> None:
    posts = [_post("a", 40), _post("b", 10), _post("c", 3), _post("d", 9), _post("e", 2)]
    result = make_pairs(posts, BOUNDS, Criteria(max_pairs_per_post=10))
    # b/c fails the margin (10 < 12); d is under the floor, so it never wins.
    assert _unordered(result.pairs["train"]) == {
        frozenset(ids) for ids in ["ab", "ac", "ad", "ae", "be"]
    }


def test_labels_agree_with_scores() -> None:
    result = make_pairs([_post("a", 40), _post("b", 1)], BOUNDS, Criteria())
    [pair] = result.pairs["train"]
    assert pair.label == int(pair.first_score > pair.second_score)


def test_posts_are_paired_only_within_community_and_bucket() -> None:
    posts = [
        _post("winner", 40),
        _post("other-community", 1, community="show_hn"),
        _post("other-bucket", 1, hours=TRAIN + 6),
    ]
    assert make_pairs(posts, BOUNDS, Criteria()).pairs["train"] == []


def test_posts_are_paired_only_within_a_prior_activity_stratum() -> None:
    veteran = [_post(f"old-{i}", 1, hours=1, author="veteran") for i in range(5)]
    posts = [
        *veteran,
        _post("veteran-winner", 40, author="veteran"),
        _post("newcomer-loser", 1),
        _post("newcomer-winner", 40, hours=TRAIN + 6),
        _post("newcomer-loser-2", 1, hours=TRAIN + 6),
    ]
    result = make_pairs(posts, BOUNDS, Criteria())
    assert _unordered(result.pairs["train"]) == {frozenset(["newcomer-winner", "newcomer-loser-2"])}


def test_identical_titles_are_never_paired() -> None:
    posts = [_post("a", 40, title="Rust is fast"), _post("b", 1, title="rust is FAST!")]
    assert make_pairs(posts, BOUNDS, Criteria()).pairs["train"] == []


def test_each_post_is_paired_at_most_the_cap() -> None:
    posts = [_post("star", 100), *(_post(f"quiet-{i}", 1) for i in range(10))]
    result = make_pairs(posts, BOUNDS, Criteria(max_pairs_per_post=3))
    assert len(result.pairs["train"]) == 3


def test_reposts_are_excluded_from_later_splits() -> None:
    posts = [
        _post("train", 5, title="Rust is fast"),
        _post("val-repost", 40, hours=VALIDATION, title="rust is FAST"),
        _post("val-loser", 1, hours=VALIDATION),
        _post("val-new", 40, hours=VALIDATION, title="Zig is fast"),
        _post("test-repost", 40, hours=TEST, title="Zig is fast."),
        _post("test-loser", 1, hours=TEST),
    ]
    result = make_pairs(posts, BOUNDS, Criteria())
    assert _unordered(result.pairs["validation"]) == {frozenset(["val-new", "val-loser"])}
    assert result.pairs["test"] == []
    assert result.excluded_reposts == {"train": 0, "validation": 1, "test": 1}


def test_decile_edges_come_from_training_posts_only() -> None:
    train = [_post(str(i), 1, author=f"a{i % 3}") for i in range(30)]
    busy = [_post(f"busy-{i}", 1, hours=VALIDATION, author="busy") for i in range(50)]
    assert (
        make_pairs(train, BOUNDS, Criteria()).edges
        == make_pairs(train + busy, BOUNDS, Criteria()).edges
    )


def test_position_carries_no_label_information() -> None:
    posts = [
        post
        for i in range(200)
        for post in (_post(f"w{i}", 40, community=f"c{i}"), _post(f"l{i}", 1, community=f"c{i}"))
    ]
    labels = [p.label for p in make_pairs(posts, BOUNDS, Criteria()).pairs["train"]]
    assert len(labels) == 200
    # About three standard deviations either side of a fair coin.
    assert 0.35 < sum(labels) / len(labels) < 0.65


def test_make_pairs_requires_training_posts() -> None:
    with pytest.raises(PairError, match="training"):
        make_pairs([_post("a", 40, hours=VALIDATION)], BOUNDS, Criteria())


@pytest.mark.parametrize("changes", [{"margin": 1}, {"winner_floor": 0}, {"max_pairs_per_post": 0}])
def test_criteria_reject_rules_that_cannot_label(changes: dict[str, int]) -> None:
    with pytest.raises(PairError):
        Criteria(**changes)


def test_normalize_title_keeps_symbol_only_titles_apart() -> None:
    assert normalize_title("  Show HN:  Foo—Bar! ") == "show hn foo bar"
    assert normalize_title("🚀") != normalize_title("🔥")


@st.composite
def corpora(draw: st.DrawFn) -> list[Post]:
    titles = st.sampled_from(["Alpha", "alpha!", "Beta", "Gamma", "Delta", "Epsilon"])
    rows = draw(
        st.lists(
            st.tuples(
                st.sampled_from(["story", "show_hn"]),
                st.sampled_from(["a", "b", "c", "d", "e"]),
                titles,
                st.integers(min_value=0, max_value=30 * 3600 - 1),
                st.integers(min_value=-1, max_value=200),
            ),
            max_size=80,
        )
    )
    posts = [
        Post(
            source="hacker-news",
            id=str(i),
            community=community,
            author=author,
            title=title,
            created_at=START + timedelta(seconds=seconds),
            score=score,
            comments=0,
        )
        for i, (community, author, title, seconds, score) in enumerate(rows)
    ]
    return [*posts, _post("anchor", 1)]


@given(corpora(), st.integers(min_value=0, max_value=2**32))
def test_pair_sets_pass_every_leak_check(posts: list[Post], seed: int) -> None:
    assert leaks.check(make_pairs(posts, BOUNDS, Criteria(seed=seed))) == []


@given(corpora(), st.randoms(use_true_random=False))
def test_pairing_ignores_input_order(posts: list[Post], rng: random.Random) -> None:
    shuffled = posts[:]
    rng.shuffle(shuffled)
    assert make_pairs(posts, BOUNDS, Criteria()) == make_pairs(shuffled, BOUNDS, Criteria())


def test_pair_rows_round_trip_and_reject_contradictions() -> None:
    [pair] = make_pairs([_post("a", 40), _post("b", 1)], BOUNDS, Criteria()).pairs["train"]
    assert Pair.from_json(pair.to_json()) == pair
    with pytest.raises(PairError, match="contradicts"):
        dataclasses.replace(pair, label=1 - pair.label)
    with pytest.raises(PairError, match="split"):
        Pair.from_json(pair.to_json().replace('"train"', '"warmup"'))
