# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

from datetime import UTC, datetime, timedelta, timezone

import pytest

from proseedge_training.data.corpus import bucket_of
from proseedge_training.data.splits import Boundaries, SplitError

START = datetime(2026, 7, 1, tzinfo=UTC)
HOUR = timedelta(hours=1)


def _boundaries(**changes: datetime) -> Boundaries:
    edges = {
        "warmup": START,
        "train": START + 6 * HOUR,
        "validation": START + 18 * HOUR,
        "test": START + 24 * HOUR,
        "end": START + 30 * HOUR,
    }
    return Boundaries(**(edges | changes))


def test_split_of_bucket_follows_the_boundaries() -> None:
    b = _boundaries()
    expected = {
        -1: None,
        0: "warmup",
        6: "train",
        17: "train",
        18: "validation",
        24: "test",
        29: "test",
        30: None,
    }
    for hours, split in expected.items():
        assert b.split_of_bucket(bucket_of(START + hours * HOUR)) == split, hours


def test_warmup_may_be_empty() -> None:
    assert _boundaries(warmup=START + 6 * HOUR).split_of_bucket(bucket_of(START)) is None


@pytest.mark.parametrize(
    "changes",
    [
        {"train": START + HOUR},
        {"end": START + 24 * HOUR},
        {"validation": START + 30 * HOUR},
        {"warmup": START + 12 * HOUR},
        {"test": (START + 24 * HOUR).astimezone(timezone(timedelta(hours=6)))},
    ],
)
def test_boundaries_reject_misaligned_unordered_or_non_utc_edges(
    changes: dict[str, datetime],
) -> None:
    with pytest.raises(SplitError):
        _boundaries(**changes)
