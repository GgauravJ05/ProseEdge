# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

"""Time-based splits (spec §5.2): train on earlier posts, evaluate on later ones.

Boundaries sit on 6-hour bucket edges. Both posts in a pair share a bucket, so
a pair can never straddle two splits; `leaks.py` checks that anyway.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from itertools import pairwise
from typing import Literal

from proseedge_training.data.corpus import BUCKET_SECONDS

type Split = Literal["warmup", "train", "validation", "test"]
SPLITS: tuple[Split, ...] = ("warmup", "train", "validation", "test")


class SplitError(ValueError):
    """Boundaries that do not describe ordered, bucket-aligned splits."""


@dataclass(frozen=True, slots=True, kw_only=True)
class Boundaries:
    # Inclusive start of the corpus. Posts from here to `train` only feed prior
    # submission counts; they are never paired (ADR 0005, early months undercount).
    warmup: datetime
    train: datetime
    validation: datetime
    test: datetime
    # Exclusive end.
    end: datetime

    def __post_init__(self) -> None:
        edges = self.edges()
        for when in edges:
            if when.utcoffset() != timedelta(0):
                raise SplitError(f"boundary must be UTC: {when!r}")
            if int(when.timestamp()) % BUCKET_SECONDS:
                raise SplitError(f"boundary must fall on a 6-hour bucket edge: {when.isoformat()}")
        if any(a > b for a, b in pairwise(edges)) or not (
            self.train < self.validation < self.test < self.end
        ):
            raise SplitError(f"boundaries must be ordered with non-empty splits: {edges}")

    def edges(self) -> tuple[datetime, ...]:
        return (self.warmup, self.train, self.validation, self.test, self.end)

    def split_of_bucket(self, bucket: int) -> Split | None:
        """The split a 6-hour bucket belongs to, or None outside the corpus range."""
        start = datetime.fromtimestamp(bucket * BUCKET_SECONDS, UTC)
        if start < self.warmup or start >= self.end:
            return None
        if start < self.train:
            return "warmup"
        if start < self.validation:
            return "train"
        if start < self.test:
            return "validation"
        return "test"
