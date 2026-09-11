# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

"""Dataset snapshot manifests (spec §5.1, §8.3).

Raw data is never committed. The manifest is: where a snapshot came from, the
date range and filters that produced it, its row count and its SHA-256. That is
enough to prove a local copy is the exact input every reported number came from.

Snapshots are JSON Lines: one row per non-empty line.
"""

import hashlib
import json
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path, PurePosixPath
from typing import Self

from proseedge_training._json import as_object, expect

FORMAT = 1
_SHA256_LENGTH = 64
_HEX = frozenset("0123456789abcdef")


class ManifestError(ValueError):
    """A manifest that is malformed or internally inconsistent."""


@dataclass(frozen=True, slots=True, kw_only=True)
class Manifest:
    source: str
    # Snapshot path relative to the data root, with POSIX separators.
    file: str
    sha256: str
    rows: int
    date_from: date
    date_to: date
    filters: dict[str, str] = field(default_factory=dict[str, str])

    def __post_init__(self) -> None:
        path = PurePosixPath(self.file)
        if not self.file or path.is_absolute() or ".." in path.parts:
            raise ManifestError(f"file must be a relative path inside the data root: {self.file!r}")
        if len(self.sha256) != _SHA256_LENGTH or not _HEX.issuperset(self.sha256):
            raise ManifestError(f"sha256 must be 64 lowercase hex digits: {self.sha256!r}")
        if self.rows < 0:
            raise ManifestError(f"rows must not be negative: {self.rows}")
        if self.date_from > self.date_to:
            raise ManifestError(f"date_from {self.date_from} is after date_to {self.date_to}")

    def to_json(self) -> str:
        """Serialize with sorted keys, so equal manifests produce identical files."""
        payload = {
            "format": FORMAT,
            "source": self.source,
            "file": self.file,
            "sha256": self.sha256,
            "rows": self.rows,
            "date_from": self.date_from.isoformat(),
            "date_to": self.date_to.isoformat(),
            "filters": self.filters,
        }
        return json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + "\n"

    @classmethod
    def from_json(cls, text: str) -> Self:
        fields = as_object(json.loads(text), "manifest", ManifestError)
        if expect(fields, "format", int, ManifestError) != FORMAT:
            raise ManifestError(f"unsupported manifest format: {fields.get('format')!r}")
        filters = as_object(fields.get("filters"), "filters", ManifestError)
        if not all(isinstance(v, str) for v in filters.values()):
            raise ManifestError("filters must map strings to strings")
        try:
            date_from = date.fromisoformat(expect(fields, "date_from", str, ManifestError))
            date_to = date.fromisoformat(expect(fields, "date_to", str, ManifestError))
        except ValueError as e:
            if isinstance(e, ManifestError):
                raise
            raise ManifestError(f"invalid date: {e}") from e
        return cls(
            source=expect(fields, "source", str, ManifestError),
            file=expect(fields, "file", str, ManifestError),
            sha256=expect(fields, "sha256", str, ManifestError),
            rows=expect(fields, "rows", int, ManifestError),
            date_from=date_from,
            date_to=date_to,
            filters={k: str(v) for k, v in filters.items()},
        )


def sha256_of(path: Path) -> str:
    with path.open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()


def count_rows(path: Path) -> int:
    with path.open("rb") as f:
        return sum(1 for line in f if line.strip())


def create(  # noqa: PLR0913 - one argument per manifest field
    snapshot: Path,
    root: Path,
    *,
    source: str,
    date_from: date,
    date_to: date,
    filters: dict[str, str] | None = None,
) -> Manifest:
    """Describe `snapshot`, which must lie under `root`, by reading it."""
    return Manifest(
        source=source,
        file=snapshot.resolve().relative_to(root.resolve()).as_posix(),
        sha256=sha256_of(snapshot),
        rows=count_rows(snapshot),
        date_from=date_from,
        date_to=date_to,
        filters=dict(filters or {}),
    )


def verify(manifest: Manifest, root: Path) -> list[str]:
    """Every way the snapshot under `root` differs from `manifest`; empty if it matches."""
    path = root / manifest.file
    if not path.is_file():
        return [f"{manifest.file}: missing"]
    problems: list[str] = []
    if (digest := sha256_of(path)) != manifest.sha256:
        problems.append(f"{manifest.file}: sha256 is {digest}, manifest has {manifest.sha256}")
    if (rows := count_rows(path)) != manifest.rows:
        problems.append(f"{manifest.file}: {rows} rows, manifest has {manifest.rows}")
    return problems
