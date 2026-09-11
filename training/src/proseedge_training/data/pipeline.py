# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

"""Verified snapshots in, pair files and their manifests out (spec §5.2, ADR 0006).

Nothing is written unless every leak check passes. Each split's manifest records
the rules that produced it and a digest of the exact snapshots it came from, so
a reported number traces back to the collected data.
"""

import hashlib
import logging
from datetime import datetime, timedelta
from pathlib import Path

from proseedge_training.data import corpus, leaks
from proseedge_training.data.pairs import PAIRED_SPLITS, Criteria, PairError, make_pairs
from proseedge_training.data.splits import Boundaries, Split
from proseedge_training.manifest import Manifest, create

SOURCE = "stratified-pairs"

log = logging.getLogger(__name__)


def inputs_digest(manifests: list[Manifest]) -> str:
    """One SHA-256 over every input snapshot's path and digest, independent of order."""
    digest = hashlib.sha256()
    for manifest in sorted(manifests, key=lambda m: m.file):
        digest.update(f"{manifest.file} {manifest.sha256}\n".encode())
    return digest.hexdigest()


def build(  # noqa: PLR0913 - inputs, outputs and the two rule objects
    sources: list[Path],
    raw: Path,
    out: Path,
    manifests: Path,
    *,
    boundaries: Boundaries,
    criteria: Criteria,
) -> dict[Split, Manifest]:
    """Pair the snapshots `sources` describe; write `out/pairs/<split>.jsonl`
    and `manifests/pairs/<split>.json` for every paired split."""
    if not sources:
        raise PairError("no snapshot manifests to pair")
    inputs = [Manifest.from_json(path.read_text(encoding="utf-8")) for path in sources]
    pair_set = make_pairs(corpus.load(sources, raw), boundaries, criteria)
    if problems := leaks.check(pair_set):
        shown = "; ".join(problems[:10])
        raise PairError(f"{len(problems)} leak check(s) failed, nothing written: {shown}")

    starts: dict[Split, datetime] = {
        "train": boundaries.train,
        "validation": boundaries.validation,
        "test": boundaries.test,
    }
    ends: dict[Split, datetime] = {
        "train": boundaries.validation,
        "validation": boundaries.test,
        "test": boundaries.end,
    }
    shared = {
        "inputs_sha256": inputs_digest(inputs),
        "boundaries": ",".join(edge.isoformat() for edge in boundaries.edges()),
        "decile_edges": ",".join(str(edge) for edge in pair_set.edges),
        "margin": str(criteria.margin),
        "winner_floor": str(criteria.winner_floor),
        "max_pairs_per_post": str(criteria.max_pairs_per_post),
        "seed": str(criteria.seed),
    }

    written: dict[Split, Manifest] = {}
    for split in PAIRED_SPLITS:
        pairs = pair_set.pairs[split]
        path = out / "pairs" / f"{split}.jsonl"
        path.parent.mkdir(parents=True, exist_ok=True)
        partial = path.with_name(f"{path.name}.partial")
        with partial.open("w", encoding="utf-8") as f:
            f.writelines(pair.to_json() + "\n" for pair in pairs)
        partial.replace(path)

        manifest = create(
            path,
            out,
            source=SOURCE,
            date_from=starts[split].date(),
            date_to=(ends[split] - timedelta(seconds=1)).date(),
            filters=shared
            | {
                "split": split,
                "posts": str(pair_set.posts[split]),
                "excluded_reposts": str(pair_set.excluded_reposts[split]),
            },
        )
        target = manifests / "pairs" / f"{split}.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(manifest.to_json(), encoding="utf-8")
        first_wins = sum(pair.label for pair in pairs)
        log.info(
            "%s: %d pairs from %d posts (%d reposts excluded), first post wins %d",
            split,
            len(pairs),
            pair_set.posts[split],
            pair_set.excluded_reposts[split],
            first_wins,
        )
        written[split] = manifest
    return written
