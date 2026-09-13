# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

"""``proseedge-data``: collect dataset snapshots, then label pairs from them."""

import argparse
import logging
from datetime import UTC, date, datetime, time
from pathlib import Path

from proseedge_training.data import hn, pipeline
from proseedge_training.data.corpus import CorpusError
from proseedge_training.data.pairs import Criteria, PairError
from proseedge_training.data.splits import Boundaries, SplitError
from proseedge_training.manifest import Manifest


def _day(text: str) -> datetime:
    """Parse ``YYYY-MM-DD`` as midnight UTC, which is always a 6-hour bucket edge."""
    return datetime.combine(date.fromisoformat(text), time(), UTC)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="proseedge-data", description=__doc__)
    parser.add_argument(
        "--raw", type=Path, default=Path("data/raw"), help="snapshot directory, not committed"
    )
    parser.add_argument(
        "--manifests", type=Path, default=Path("data/manifests"), help="manifest directory"
    )
    commands = parser.add_subparsers(dest="command", required=True)

    stories = commands.add_parser("hn", help="collect Hacker News stories by month (ADR 0005)")
    stories.add_argument("first", type=hn.month_start, help="first month, YYYY-MM")
    stories.add_argument("last", type=hn.month_start, help="last month, YYYY-MM, inclusive")

    pairing = commands.add_parser(
        "pairs", help="label stratified pairs with time-based splits (ADR 0006)"
    )
    pairing.add_argument(
        "--out", type=Path, default=Path("data/interim"), help="pair directory, not committed"
    )
    pairing.add_argument(
        "--warmup", type=_day, help="corpus start, YYYY-MM-DD; defaults to the earliest snapshot"
    )
    for name in ("train", "validation", "test"):
        pairing.add_argument(
            f"--{name}", type=_day, required=True, help=f"{name} start, YYYY-MM-DD"
        )
    pairing.add_argument("--end", type=_day, required=True, help="exclusive end, YYYY-MM-DD")
    pairing.add_argument("--seed", type=int, default=0)

    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        if args.command == "hn":
            store = hn.Store(raw=args.raw, manifests=args.manifests)
            hn.collect(hn.Client(), args.first, args.last, store, today=datetime.now(UTC).date())
        else:
            sources = sorted((args.manifests / "hn").glob("*.json"))
            warmup: datetime | None = args.warmup
            if warmup is None and sources:
                warmup = min(
                    _day(Manifest.from_json(p.read_text(encoding="utf-8")).date_from.isoformat())
                    for p in sources
                )
            boundaries = Boundaries(
                warmup=warmup or args.train,
                train=args.train,
                validation=args.validation,
                test=args.test,
                end=args.end,
            )
            pipeline.build(
                sources,
                args.raw,
                args.out,
                args.manifests,
                boundaries=boundaries,
                criteria=Criteria(seed=args.seed),
            )
    except (hn.CollectionError, CorpusError, PairError, SplitError) as e:
        parser.exit(1, f"error: {e}\n")
    return 0
