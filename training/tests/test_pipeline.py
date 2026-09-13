# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest

from proseedge_training.data import cli, leaks, pipeline
from proseedge_training.data.pairs import PAIRED_SPLITS, Criteria, Pair, PairError, PairSet
from proseedge_training.data.schema import Post
from proseedge_training.data.splits import Boundaries
from proseedge_training.manifest import Manifest, create, verify

START = datetime(2026, 7, 1, tzinfo=UTC)
DAY = timedelta(days=1)
BOUNDS = Boundaries(
    warmup=START,
    train=START + DAY,
    validation=START + 2 * DAY,
    test=START + 3 * DAY,
    end=START + 4 * DAY,
)


def _post(post_id: str, score: int, day: int) -> Post:
    return Post(
        source="hacker-news",
        id=post_id,
        community="story",
        author=f"author-{post_id}",
        title=f"Story {post_id}",
        created_at=START + day * DAY + timedelta(hours=12),
        score=score,
        comments=0,
    )


def _corpus(tmp_path: Path) -> Path:
    posts = [
        _post(f"{kind}{day}", score, day)
        for day in range(4)
        for kind, score in (("w", 40), ("l", 1))
    ]
    snapshot = tmp_path / "raw" / "hn" / "2026-07.jsonl"
    snapshot.parent.mkdir(parents=True)
    snapshot.write_text("".join(p.to_json() + "\n" for p in posts), encoding="utf-8")
    manifest = create(
        snapshot,
        tmp_path / "raw",
        source="hacker-news",
        date_from=date(2026, 7, 1),
        date_to=date(2026, 7, 31),
    )
    path = tmp_path / "manifests" / "hn" / "2026-07.json"
    path.parent.mkdir(parents=True)
    path.write_text(manifest.to_json(), encoding="utf-8")
    return path


def test_build_writes_pair_files_their_manifests_verify(tmp_path: Path) -> None:
    source = _corpus(tmp_path)
    out, manifests = tmp_path / "interim", tmp_path / "manifests"
    written = pipeline.build(
        [source], tmp_path / "raw", out, manifests, boundaries=BOUNDS, criteria=Criteria()
    )
    assert list(written) == list(PAIRED_SPLITS)
    for split, manifest in written.items():
        assert verify(manifest, out) == []
        assert manifest.rows == 1
        assert Manifest.from_json((manifests / "pairs" / f"{split}.json").read_text()) == manifest
        [line] = (out / manifest.file).read_text(encoding="utf-8").splitlines()
        assert Pair.from_json(line).split == split
    assert written["test"].date_from == date(2026, 7, 4)
    assert written["test"].date_to == date(2026, 7, 4)
    assert len(written["train"].filters["inputs_sha256"]) == 64


def test_build_writes_nothing_when_a_leak_check_fails(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def planted(_: PairSet) -> list[str]:
        return ["planted leak"]

    source = _corpus(tmp_path)
    monkeypatch.setattr(leaks, "check", planted)
    with pytest.raises(PairError, match="planted leak"):
        pipeline.build(
            [source],
            tmp_path / "raw",
            tmp_path / "interim",
            tmp_path / "manifests",
            boundaries=BOUNDS,
            criteria=Criteria(),
        )
    assert not (tmp_path / "interim").exists()


def test_inputs_digest_ignores_order(tmp_path: Path) -> None:
    source = Manifest.from_json(_corpus(tmp_path).read_text(encoding="utf-8"))
    other = Manifest.from_json(source.to_json().replace("2026-07.jsonl", "2026-08.jsonl"))
    assert pipeline.inputs_digest([source, other]) == pipeline.inputs_digest([other, source])


def test_cli_pairs_defaults_warmup_to_the_earliest_snapshot(tmp_path: Path) -> None:
    _corpus(tmp_path)
    code = cli.main(
        [
            "--raw", str(tmp_path / "raw"),
            "--manifests", str(tmp_path / "manifests"),
            "pairs",
            "--out", str(tmp_path / "interim"),
            "--train", "2026-07-02",
            "--validation", "2026-07-03",
            "--test", "2026-07-04",
            "--end", "2026-07-05",
        ]
    )  # fmt: skip
    assert code == 0
    train = Manifest.from_json((tmp_path / "manifests" / "pairs" / "train.json").read_text())
    assert train.filters["boundaries"].startswith("2026-07-01T00:00:00+00:00,")


def test_cli_pairs_reports_bad_boundaries(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    _corpus(tmp_path)
    with pytest.raises(SystemExit) as exit_info:
        cli.main(
            [
                "--raw", str(tmp_path / "raw"),
                "--manifests", str(tmp_path / "manifests"),
                "pairs",
                "--train", "2026-07-03",
                "--validation", "2026-07-02",
                "--test", "2026-07-04",
                "--end", "2026-07-05",
            ]
        )  # fmt: skip
    assert exit_info.value.code == 1
    assert "boundaries must be ordered" in capsys.readouterr().err
