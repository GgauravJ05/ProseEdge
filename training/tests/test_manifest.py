# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import json
from datetime import date
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from proseedge_training.manifest import Manifest, ManifestError, create, verify

SHA = "0" * 64


@st.composite
def manifests(draw: st.DrawFn) -> Manifest:
    a, b = sorted(draw(st.lists(st.dates(), min_size=2, max_size=2)))
    segment = st.text(st.characters(exclude_characters="/\x00"), min_size=1).filter(
        lambda s: s not in {".", ".."}
    )
    return Manifest(
        source=draw(st.text()),
        file="/".join(draw(st.lists(segment, min_size=1, max_size=3))),
        sha256=draw(st.text("0123456789abcdef", min_size=64, max_size=64)),
        rows=draw(st.integers(min_value=0)),
        date_from=a,
        date_to=b,
        filters=draw(st.dictionaries(st.text(), st.text())),
    )


@given(manifests())
def test_json_round_trips(m: Manifest) -> None:
    assert Manifest.from_json(m.to_json()) == m


@given(manifests())
def test_json_is_canonical(m: Manifest) -> None:
    reordered = Manifest(
        source=m.source,
        file=m.file,
        sha256=m.sha256,
        rows=m.rows,
        date_from=m.date_from,
        date_to=m.date_to,
        filters=dict(reversed(m.filters.items())),
    )
    assert reordered.to_json() == m.to_json()


def _snapshot(root: Path) -> Path:
    path = root / "hn" / "2026-09.jsonl"
    path.parent.mkdir(parents=True)
    path.write_text('{"title": "a"}\n{"title": "b"}\n\n', encoding="utf-8")
    return path


def _create(root: Path) -> Manifest:
    return create(
        _snapshot(root),
        root,
        source="hacker-news",
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
        filters={"type": "story"},
    )


def test_create_describes_the_snapshot(tmp_path: Path) -> None:
    m = _create(tmp_path)
    assert m.file == "hn/2026-09.jsonl"
    assert m.rows == 2
    assert verify(m, tmp_path) == []


def test_verify_detects_a_changed_byte(tmp_path: Path) -> None:
    m = _create(tmp_path)
    path = tmp_path / m.file
    data = bytearray(path.read_bytes())
    data[3] ^= 1
    path.write_bytes(bytes(data))
    [problem] = verify(m, tmp_path)
    assert "sha256" in problem


def test_verify_detects_a_missing_snapshot(tmp_path: Path) -> None:
    m = _create(tmp_path)
    (tmp_path / m.file).unlink()
    assert verify(m, tmp_path) == ["hn/2026-09.jsonl: missing"]


def test_verify_reports_row_count_drift(tmp_path: Path) -> None:
    m = _create(tmp_path)
    with (tmp_path / m.file).open("a", encoding="utf-8") as f:
        f.write('{"title": "c"}\n')
    problems = verify(m, tmp_path)
    assert len(problems) == 2
    assert "3 rows, manifest has 2" in problems[1]


@pytest.mark.parametrize(
    ("changes", "message"),
    [
        ({"file": "../outside.jsonl"}, "relative path"),
        ({"file": "/abs.jsonl"}, "relative path"),
        ({"sha256": "ABC"}, "sha256"),
        ({"rows": -1}, "rows"),
        ({"date_from": date(2026, 10, 1)}, "after"),
    ],
)
def test_rejects_inconsistent_fields(changes: dict[str, object], message: str) -> None:
    fields: dict[str, object] = {
        "source": "hn",
        "file": "a.jsonl",
        "sha256": SHA,
        "rows": 1,
        "date_from": date(2026, 9, 1),
        "date_to": date(2026, 9, 30),
    }
    with pytest.raises(ManifestError, match=message):
        Manifest(**(fields | changes))  # pyright: ignore[reportArgumentType]


@pytest.mark.parametrize(
    ("changes", "message"),
    [
        ({"format": 2}, "format"),
        ({"rows": True}, "rows must be int"),
        ({"rows": "1"}, "rows must be int"),
        ({"filters": {"k": 1}}, "filters"),
        ({"date_to": "30/09/2026"}, "invalid date"),
    ],
)
def test_from_json_rejects_malformed_input(changes: dict[str, object], message: str) -> None:
    valid = Manifest(
        source="hn",
        file="a.jsonl",
        sha256=SHA,
        rows=1,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
    )
    payload = json.loads(valid.to_json()) | changes
    with pytest.raises(ManifestError, match=message):
        Manifest.from_json(json.dumps(payload))
