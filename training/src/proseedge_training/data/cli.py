# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

"""``proseedge-data``: collect dataset snapshots and their manifests."""

import argparse
import logging
from datetime import UTC, datetime
from pathlib import Path

from proseedge_training.data import hn


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="proseedge-data", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    stories = commands.add_parser("hn", help="collect Hacker News stories by month (ADR 0005)")
    stories.add_argument("first", type=hn.month_start, help="first month, YYYY-MM")
    stories.add_argument("last", type=hn.month_start, help="last month, YYYY-MM, inclusive")
    stories.add_argument(
        "--raw", type=Path, default=Path("data/raw"), help="snapshot directory, not committed"
    )
    stories.add_argument(
        "--manifests", type=Path, default=Path("data/manifests"), help="manifest directory"
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    store = hn.Store(raw=args.raw, manifests=args.manifests)
    try:
        hn.collect(hn.Client(), args.first, args.last, store, today=datetime.now(UTC).date())
    except hn.CollectionError as e:
        parser.exit(1, f"error: {e}\n")
    return 0
