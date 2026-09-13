# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from proseedge_training.data import corpus
from proseedge_training.data.corpus import CorpusError
from proseedge_training.data.schema import Post
from proseedge_training.manifest import create

START = datetime(2026, 7, 1, tzinfo=UTC)


def _post(post_id: str, *, author: str = "pg", seconds: int = 0) -> Post:
    return Post(
        source="hacker-news",
        id=post_id,
        community="story",
        author=author,
        title=f"Story {post_id}",
        created_at=START + timedelta(seconds=seconds),
        score=1,
        comments=0,
    )


def _snapshot(root: Path, name: str, posts: list[Post]) -> Path:
    snapshot = root / "raw" / f"{name}.jsonl"
    snapshot.parent.mkdir(parents=True, exist_ok=True)
    snapshot.write_text("".join(p.to_json() + "\n" for p in posts), encoding="utf-8")
    manifest = create(
        snapshot,
        root / "raw",
        source="hacker-news",
        date_from=date(2026, 7, 1),
        date_to=date(2026, 7, 31),
    )
    path = root / "manifests" / f"{name}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(manifest.to_json(), encoding="utf-8")
    return path


def test_load_merges_snapshots_in_time_order(tmp_path: Path) -> None:
    late, early = _post("2", seconds=60), _post("1", seconds=0)
    paths = [_snapshot(tmp_path, "a", [late]), _snapshot(tmp_path, "b", [early])]
    assert corpus.load(paths, tmp_path / "raw") == [early, late]


def test_load_refuses_a_snapshot_that_no_longer_matches(tmp_path: Path) -> None:
    path = _snapshot(tmp_path, "a", [_post("1")])
    with (tmp_path / "raw" / "a.jsonl").open("a", encoding="utf-8") as f:
        f.write(_post("2").to_json() + "\n")
    with pytest.raises(CorpusError, match="rows"):
        corpus.load([path], tmp_path / "raw")


def test_load_refuses_a_post_in_two_snapshots(tmp_path: Path) -> None:
    paths = [_snapshot(tmp_path, "a", [_post("1")]), _snapshot(tmp_path, "b", [_post("1")])]
    with pytest.raises(CorpusError, match="two snapshots"):
        corpus.load(paths, tmp_path / "raw")


def test_buckets_are_six_hours() -> None:
    first = corpus.bucket(_post("1"))
    assert corpus.bucket(_post("2", seconds=6 * 3600 - 1)) == first
    assert corpus.bucket(_post("3", seconds=6 * 3600)) == first + 1


def test_prior_counts_are_strictly_earlier() -> None:
    posts = [
        _post("1", seconds=0),
        _post("2", seconds=10),
        _post("3", seconds=10),
        _post("4", seconds=20),
        _post("5", author="other", seconds=30),
    ]
    counts = corpus.prior_counts(posts)
    assert [counts["hacker-news", p.id] for p in posts] == [0, 1, 1, 3, 0]


@given(
    st.lists(
        st.tuples(st.sampled_from(["a", "b", "c"]), st.integers(min_value=0, max_value=50)),
        max_size=40,
    )
)
def test_prior_counts_match_a_brute_force_count(rows: list[tuple[str, int]]) -> None:
    posts = [_post(str(i), author=author, seconds=s) for i, (author, s) in enumerate(rows)]
    counts = corpus.prior_counts(reversed(posts))
    for post in posts:
        expected = sum(q.author == post.author and q.created_at < post.created_at for q in posts)
        assert counts[corpus.key(post)] == expected


def test_quantile_edges_split_distinct_values_evenly() -> None:
    values = list(range(100))
    edges = corpus.quantile_edges(values)
    assert edges == (10, 20, 30, 40, 50, 60, 70, 80, 90)
    sizes = [sum(corpus.stratum(v, edges) == s for v in values) for s in range(10)]
    assert sizes == [10] * 10


def test_quantile_edges_collapse_ties() -> None:
    # Most authors have no earlier submissions: the ties cannot be split.
    edges = corpus.quantile_edges([0] * 80 + [1] * 10 + [7] * 10)
    assert edges == (0, 1, 7)
    assert corpus.stratum(0, edges) == 1


@given(st.lists(st.integers(min_value=0, max_value=1000), min_size=1), st.integers(1, 20))
def test_quantile_edges_are_ordered_values_and_strata_are_monotone(
    values: list[int], bins: int
) -> None:
    edges = corpus.quantile_edges(values, bins)
    assert list(edges) == sorted(set(edges))
    assert set(edges) <= set(values)
    assert len(edges) <= bins - 1
    strata = [corpus.stratum(v, edges) for v in sorted(values)]
    assert strata == sorted(strata)


def test_quantile_edges_reject_bad_input() -> None:
    with pytest.raises(CorpusError):
        corpus.quantile_edges([])
    with pytest.raises(ValueError, match="bins"):
        corpus.quantile_edges([1], 0)
