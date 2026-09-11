# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import json
import re
import urllib.error
from datetime import UTC, date, datetime
from email.message import Message
from pathlib import Path
from typing import cast
from urllib.parse import parse_qs, urlsplit

import pytest

from proseedge_training.data import hn
from proseedge_training.data.schema import Post
from proseedge_training.manifest import verify

TODAY = date(2026, 9, 11)


def _epoch(*args: int) -> int:
    return int(datetime(*args, tzinfo=UTC).timestamp())


def _hit(object_id: str, created: int, **changes: object) -> dict[str, object]:
    hit: dict[str, object] = {
        "objectID": object_id,
        "title": f"Story {object_id}",
        "author": "pg",
        "points": 10,
        "num_comments": 2,
        "created_at_i": created,
        "_tags": ["story", "author_pg", f"story_{object_id}"],
    }
    return hit | changes


class FakeAlgolia:
    """Filters and caps synthetic hits the way the real endpoint does."""

    def __init__(self, hits: list[dict[str, object]]) -> None:
        self.hits = hits
        self.windows: list[tuple[int, int]] = []

    def __call__(self, url: str) -> bytes:
        [filters] = parse_qs(urlsplit(url).query)["numericFilters"]
        lo, hi = (int(re.findall(r"\d+", part)[-1]) for part in filters.split(","))
        self.windows.append((lo, hi))
        matching = [h for h in self.hits if lo <= cast("int", h["created_at_i"]) < hi]
        return json.dumps({"nbHits": len(matching), "hits": matching[: hn.MAX_HITS]}).encode()


def _client(fetch: hn.Fetch) -> hn.Client:
    return hn.Client(fetch, sleep=lambda _: None)


def _http_error(code: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError(hn.API, code, "error", Message(), None)


def test_parse_maps_fields() -> None:
    post = hn.parse(_hit("42", _epoch(2026, 7, 1, 12), points=99, num_comments=7))
    assert post == Post(
        source="hacker-news",
        id="42",
        community="story",
        author="pg",
        title="Story 42",
        created_at=datetime(2026, 7, 1, 12, tzinfo=UTC),
        score=99,
        comments=7,
    )


@pytest.mark.parametrize("kind", ["ask_hn", "show_hn"])
def test_parse_uses_post_kind_as_community(kind: str) -> None:
    post = hn.parse(_hit("1", 0, _tags=["story", "author_pg", kind]))
    assert post is not None
    assert post.community == kind


@pytest.mark.parametrize(
    "changes",
    [
        {"title": None},
        {"title": "  "},
        {"author": None},
        {"points": None},
        {"points": True},
        {"num_comments": -1},
        {"created_at_i": "1"},
    ],
)
def test_parse_skips_unusable_hits(changes: dict[str, object]) -> None:
    assert hn.parse(_hit("1", 0, **changes)) is None


def test_stories_splits_windows_over_the_cap() -> None:
    start = _epoch(2026, 7, 1)
    hits = [_hit(str(i), start + i * 30) for i in range(2500)]
    fake = FakeAlgolia(hits)
    found = [h["objectID"] for h in hn.stories(_client(fake), start, start + 86_400)]
    assert len(found) == len(hits)
    assert set(found) == {h["objectID"] for h in hits}
    assert len(fake.windows) > 3


def test_stories_rejects_more_than_the_cap_in_one_second() -> None:
    hits = [_hit(str(i), 100) for i in range(hn.MAX_HITS + 1)]
    with pytest.raises(hn.CollectionError, match="in the second starting at 100"):
        list(hn.stories(_client(FakeAlgolia(hits)), 100, 200))


def test_stories_rejects_a_hit_count_mismatch() -> None:
    def short(_url: str) -> bytes:
        return json.dumps({"nbHits": 3, "hits": [_hit("1", 0)]}).encode()

    with pytest.raises(hn.CollectionError, match="nbHits is 3 but 1 hits"):
        list(hn.stories(_client(short), 0, 10))


def test_client_retries_rate_limits_and_server_errors() -> None:
    failures = iter([_http_error(503), _http_error(429)])
    sleeps: list[float] = []

    def flaky(_url: str) -> bytes:
        if (error := next(failures, None)) is not None:
            raise error
        return b'{"nbHits": 0, "hits": []}'

    client = hn.Client(flaky, sleep=sleeps.append, clock=lambda: 1000.0 + 10 * len(sleeps))
    assert client.search(0, 10) == {"nbHits": 0, "hits": []}
    assert sleeps == [1.0, 2.0]


def test_client_does_not_retry_client_errors() -> None:
    calls: list[str] = []

    def bad_request(url: str) -> bytes:
        calls.append(url)
        raise _http_error(400)

    with pytest.raises(urllib.error.HTTPError):
        _client(bad_request).search(0, 10)
    assert len(calls) == 1


def test_client_spaces_requests() -> None:
    times = iter([0.0, 0.1])
    sleeps: list[float] = []
    client = hn.Client(FakeAlgolia([]), sleep=sleeps.append, clock=lambda: next(times))
    client.search(0, 10)
    client.search(10, 20)
    assert sleeps == [pytest.approx(hn.MIN_INTERVAL - 0.1)]


def test_http_fetch_refuses_other_urls() -> None:
    with pytest.raises(ValueError, match="refusing"):
        hn.http_fetch("file:///etc/passwd")


def _store(tmp_path: Path) -> hn.Store:
    return hn.Store(raw=tmp_path / "raw", manifests=tmp_path / "manifests")


def test_collect_month_writes_a_sorted_deduplicated_snapshot(tmp_path: Path) -> None:
    hits = [
        _hit("3", _epoch(2024, 2, 29, 23, 59)),
        _hit("1", _epoch(2024, 2, 1, 0, 0)),
        _hit("2", _epoch(2024, 2, 14, 8)),
        _hit("2", _epoch(2024, 2, 14, 8)),
        _hit("4", _epoch(2024, 2, 20), title=None),
        _hit("5", _epoch(2024, 3, 1)),
    ]
    store = _store(tmp_path)
    manifest = hn.collect_month(_client(FakeAlgolia(hits)), date(2024, 2, 1), store, today=TODAY)

    lines = store.snapshot(date(2024, 2, 1)).read_text(encoding="utf-8").splitlines()
    assert [Post.from_json(line).id for line in lines] == ["1", "2", "3"]
    assert manifest.rows == 3
    assert (manifest.date_from, manifest.date_to) == (date(2024, 2, 1), date(2024, 2, 29))
    assert manifest.filters["skipped_hits"] == "1"
    assert manifest.filters["collected_on"] == "2026-09-11"
    assert store.manifest(date(2024, 2, 1)).read_text(encoding="utf-8") == manifest.to_json()
    assert verify(manifest, store.raw) == []


def test_collect_month_refuses_a_month_whose_scores_are_still_moving(tmp_path: Path) -> None:
    with pytest.raises(hn.CollectionError, match="not settled until 2026-09-15"):
        hn.collect_month(_client(FakeAlgolia([])), date(2026, 8, 1), _store(tmp_path), today=TODAY)


def test_collect_keeps_intact_months_and_recollects_damaged_ones(tmp_path: Path) -> None:
    hits = [_hit("1", _epoch(2024, 1, 10)), _hit("2", _epoch(2024, 2, 10))]
    store = _store(tmp_path)
    first = hn.collect(
        _client(FakeAlgolia(hits)), date(2024, 1, 1), date(2024, 2, 1), store, today=TODAY
    )
    assert [m.rows for m in first] == [1, 1]

    untouched = FakeAlgolia(hits)
    again = hn.collect(_client(untouched), date(2024, 1, 1), date(2024, 2, 1), store, today=TODAY)
    assert again == first
    assert untouched.windows == []

    store.snapshot(date(2024, 1, 1)).write_text("", encoding="utf-8")
    repair = FakeAlgolia(hits)
    hn.collect(_client(repair), date(2024, 1, 1), date(2024, 2, 1), store, today=TODAY)
    assert repair.windows
    assert all(hi <= _epoch(2024, 2, 1) for _, hi in repair.windows)
    assert (
        verify(
            hn.collect(_client(repair), date(2024, 1, 1), date(2024, 1, 1), store, today=TODAY)[0],
            store.raw,
        )
        == []
    )


@pytest.mark.parametrize("text", ["2024-13", "2024", "Jan 2024"])
def test_month_start_rejects_other_formats(text: str) -> None:
    with pytest.raises(ValueError, match="expected YYYY-MM"):
        hn.month_start(text)
