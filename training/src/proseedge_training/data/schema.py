# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

"""Source-agnostic post rows (spec §5.1).

Every collector emits `Post` and pairing (§5.2) only reads `Post`, so adding a
source means adding a collector; nothing downstream changes.
"""

import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Self

from proseedge_training._json import as_object, expect


class RowError(ValueError):
    """A post row that is malformed or inconsistent."""


@dataclass(frozen=True, slots=True, kw_only=True)
class Post:
    source: str
    # Unique within the source.
    id: str
    # The stratum a post competes in: the HN post kind, later a subreddit.
    community: str
    author: str
    title: str
    # Timezone-aware, UTC.
    created_at: datetime
    # Engagement when the snapshot was taken, not a final count (ADR 0005).
    score: int
    comments: int

    def __post_init__(self) -> None:
        for name in ("source", "id", "community", "author", "title"):
            if not getattr(self, name):
                raise RowError(f"{name} must not be empty")
        if self.created_at.utcoffset() != timedelta(0):
            raise RowError(f"created_at must be UTC: {self.created_at!r}")
        if self.comments < 0:
            raise RowError(f"comments must not be negative: {self.comments}")

    def to_json(self) -> str:
        """One JSON Lines row with sorted keys."""
        row = {
            "source": self.source,
            "id": self.id,
            "community": self.community,
            "author": self.author,
            "title": self.title,
            "created_at": self.created_at.isoformat().replace("+00:00", "Z"),
            "score": self.score,
            "comments": self.comments,
        }
        return json.dumps(row, ensure_ascii=False, sort_keys=True)

    @classmethod
    def from_json(cls, line: str) -> Self:
        fields = as_object(json.loads(line), "row", RowError)
        try:
            created_at = datetime.fromisoformat(expect(fields, "created_at", str, RowError))
        except ValueError as e:
            if isinstance(e, RowError):
                raise
            raise RowError(f"invalid created_at: {e}") from e
        return cls(
            source=expect(fields, "source", str, RowError),
            id=expect(fields, "id", str, RowError),
            community=expect(fields, "community", str, RowError),
            author=expect(fields, "author", str, RowError),
            title=expect(fields, "title", str, RowError),
            created_at=created_at,
            score=expect(fields, "score", int, RowError),
            comments=expect(fields, "comments", int, RowError),
        )
