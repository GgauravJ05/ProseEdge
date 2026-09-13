# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import json
from datetime import UTC, datetime, timedelta, timezone

import pytest
from hypothesis import given
from hypothesis import strategies as st

from proseedge_training.data.schema import Post, RowError

WHEN = datetime(2026, 7, 1, 12, 0, tzinfo=UTC)
nonempty = st.text(min_size=1)


@st.composite
def posts(draw: st.DrawFn) -> Post:
    return Post(
        source=draw(nonempty),
        id=draw(nonempty),
        community=draw(nonempty),
        author=draw(nonempty),
        title=draw(nonempty),
        created_at=draw(st.datetimes(timezones=st.just(UTC))),
        score=draw(st.integers()),
        comments=draw(st.integers(min_value=0)),
    )


def _post(**changes: object) -> Post:
    fields: dict[str, object] = {
        "source": "hacker-news",
        "id": "1",
        "community": "story",
        "author": "pg",
        "title": "A title",
        "created_at": WHEN,
        "score": 10,
        "comments": 2,
    }
    return Post(**(fields | changes))  # pyright: ignore[reportArgumentType]


@given(posts())
def test_json_round_trips(post: Post) -> None:
    line = post.to_json()
    assert "\n" not in line
    assert Post.from_json(line) == post


def test_timestamps_serialize_as_utc() -> None:
    assert json.loads(_post().to_json())["created_at"] == "2026-07-01T12:00:00Z"


@pytest.mark.parametrize(
    ("changes", "message"),
    [
        ({"title": ""}, "title must not be empty"),
        ({"author": ""}, "author must not be empty"),
        ({"created_at": datetime(2026, 7, 1, 12, 0)}, "UTC"),  # noqa: DTZ001 - the naive case under test
        ({"created_at": WHEN.astimezone(timezone(timedelta(hours=5)))}, "UTC"),
        ({"comments": -1}, "comments"),
    ],
)
def test_rejects_inconsistent_fields(changes: dict[str, object], message: str) -> None:
    with pytest.raises(RowError, match=message):
        _post(**changes)


@pytest.mark.parametrize(
    ("changes", "message"),
    [
        ({"created_at": "yesterday"}, "invalid created_at"),
        ({"created_at": "2026-07-01T12:00:00"}, "UTC"),
        ({"score": "10"}, "score must be int"),
        ({"comments": False}, "comments must be int"),
    ],
)
def test_from_json_rejects_malformed_rows(changes: dict[str, object], message: str) -> None:
    row = json.loads(_post().to_json()) | changes
    with pytest.raises(RowError, match=message):
        Post.from_json(json.dumps(row))
