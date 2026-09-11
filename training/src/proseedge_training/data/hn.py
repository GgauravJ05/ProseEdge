# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

"""Hacker News stories from the Algolia HN Search API (ADR 0005).

Algolia returns at most 1,000 hits per query, so stories are requested one UTC
day at a time and any window reporting more is halved until it fits. Points
keep rising for days after a story is posted: a month is collected only once
`SETTLE_DAYS` have passed since it ended, and the collection date goes in its
manifest.
"""

import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import TypeIs

from proseedge_training._json import as_list, as_object, expect
from proseedge_training.data.schema import Post
from proseedge_training.manifest import Manifest, create, verify

SOURCE = "hacker-news"
API = "https://hn.algolia.com/api/v1/search_by_date"
MAX_HITS = 1000
SETTLE_DAYS = 14
# Seconds between requests. Deliberately conservative; HTTP 429 is retried with backoff.
MIN_INTERVAL = 0.4
RETRIES = 5
KINDS = ("ask_hn", "show_hn")

type Fetch = Callable[[str], bytes]

log = logging.getLogger(__name__)


class CollectionError(ValueError):
    """The API returned something the collector cannot trust."""


def http_fetch(url: str) -> bytes:
    if not url.startswith(f"{API}?"):
        raise ValueError(f"refusing to fetch {url!r}")
    request = urllib.request.Request(url, headers={"User-Agent": "proseedge-training"})  # noqa: S310 - fixed https endpoint, checked above
    with urllib.request.urlopen(request, timeout=30) as response:  # noqa: S310 - same
        body: bytes = response.read()
    return body


def _retryable(error: urllib.error.URLError | TimeoutError) -> bool:
    if isinstance(error, urllib.error.HTTPError):
        return error.code == 429 or error.code >= 500  # noqa: PLR2004 - HTTP status classes
    return True


class Client:
    """Throttled, retrying access to the search endpoint."""

    def __init__(
        self,
        fetch: Fetch = http_fetch,
        *,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._fetch = fetch
        self._sleep = sleep
        self._clock = clock
        self._last: float | None = None
        self.requests = 0

    def search(self, start: int, end: int) -> dict[str, object]:
        """Stories created in [start, end), in Unix seconds."""
        query = urllib.parse.urlencode(
            {
                "tags": "story",
                "hitsPerPage": MAX_HITS,
                "numericFilters": f"created_at_i>={start},created_at_i<{end}",
            }
        )
        url = f"{API}?{query}"
        for attempt in range(RETRIES + 1):
            self._throttle()
            try:
                body = self._fetch(url)
            except (urllib.error.URLError, TimeoutError) as e:
                if attempt == RETRIES or not _retryable(e):
                    raise
                delay = 2.0**attempt
                log.warning("search failed (%s); retrying in %.0f s", e, delay)
                self._sleep(delay)
            else:
                return as_object(json.loads(body), "search response", CollectionError)
        raise AssertionError("unreachable")

    def _throttle(self) -> None:
        now = self._clock()
        if self._last is not None and (wait := self._last + MIN_INTERVAL - now) > 0:
            self._sleep(wait)
            now += wait
        self._last = now
        self.requests += 1


def stories(client: Client, start: int, end: int) -> Iterator[dict[str, object]]:
    """Every story hit created in [start, end), halving windows over the hit cap."""
    pending = [(start, end)]
    while pending:
        lo, hi = pending.pop()
        response = client.search(lo, hi)
        total = expect(response, "nbHits", int, CollectionError)
        if total > MAX_HITS:
            if hi - lo < 2:  # noqa: PLR2004 - a one-second window cannot be split
                raise CollectionError(f"{total} stories in the second starting at {lo}")
            mid = (lo + hi) // 2
            pending.extend([(mid, hi), (lo, mid)])
            continue
        hits = as_list(response.get("hits"), "hits", CollectionError)
        if len(hits) != total:
            raise CollectionError(f"window {lo}-{hi}: nbHits is {total} but {len(hits)} hits")
        for hit in hits:
            yield as_object(hit, "hit", CollectionError)


def _is_int(value: object) -> TypeIs[int]:
    return isinstance(value, int) and not isinstance(value, bool)


def parse(hit: dict[str, object]) -> Post | None:
    """The hit as a `Post`, or None when it lacks a title, author or counts."""
    title, author, object_id = hit.get("title"), hit.get("author"), hit.get("objectID")
    points, comments, created = hit.get("points"), hit.get("num_comments"), hit.get("created_at_i")
    if (
        not isinstance(title, str)
        or not title.strip()
        or not isinstance(author, str)
        or not author
        or not isinstance(object_id, str)
        or not _is_int(points)
        or not _is_int(comments)
        or comments < 0
        or not _is_int(created)
    ):
        return None
    kinds = [tag for tag in as_list(hit.get("_tags"), "_tags", CollectionError) if tag in KINDS]
    return Post(
        source=SOURCE,
        id=object_id,
        community=str(kinds[0]) if kinds else "story",
        author=author,
        title=title,
        created_at=datetime.fromtimestamp(created, UTC),
        score=points,
        comments=comments,
    )


def month_start(text: str) -> date:
    """Parse ``YYYY-MM`` as the first day of that month."""
    try:
        return date.fromisoformat(f"{text}-01")
    except ValueError as e:
        raise ValueError(f"expected YYYY-MM, got {text!r}") from e


def _next_month(month: date) -> date:
    return date(month.year + (month.month == 12), month.month % 12 + 1, 1)  # noqa: PLR2004 - December


def _epoch(day: date) -> int:
    return int(datetime(day.year, day.month, day.day, tzinfo=UTC).timestamp())


@dataclass(frozen=True, slots=True)
class Store:
    """Snapshots (never committed) and their manifests (committed)."""

    raw: Path
    manifests: Path

    def snapshot(self, month: date) -> Path:
        return self.raw / "hn" / f"{month:%Y-%m}.jsonl"

    def manifest(self, month: date) -> Path:
        return self.manifests / "hn" / f"{month:%Y-%m}.json"


def collect_month(client: Client, month: date, store: Store, *, today: date) -> Manifest:
    """Fetch every story posted in `month`; write its snapshot and manifest."""
    if month.day != 1:
        raise ValueError(f"month must be the first day of a month: {month}")
    end = _next_month(month)
    settled = end + timedelta(days=SETTLE_DAYS)
    if today < settled:
        raise CollectionError(f"{month:%Y-%m} is not settled until {settled}")

    posts: dict[str, Post] = {}
    skipped = 0
    day = month
    while day < end:
        following = day + timedelta(days=1)
        for hit in stories(client, _epoch(day), _epoch(following)):
            post = parse(hit)
            if post is None:
                skipped += 1
            else:
                posts[post.id] = post
        day = following

    snapshot = store.snapshot(month)
    snapshot.parent.mkdir(parents=True, exist_ok=True)
    partial = snapshot.with_name(f"{snapshot.name}.partial")
    with partial.open("w", encoding="utf-8") as f:
        for post in sorted(posts.values(), key=lambda p: (p.created_at, p.id)):
            f.write(post.to_json() + "\n")
    partial.replace(snapshot)

    manifest = create(
        snapshot,
        store.raw,
        source=SOURCE,
        date_from=month,
        date_to=end - timedelta(days=1),
        filters={
            "api": API,
            "tags": "story",
            "collected_on": today.isoformat(),
            "settle_days": str(SETTLE_DAYS),
            "skipped_hits": str(skipped),
        },
    )
    path = store.manifest(month)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(manifest.to_json(), encoding="utf-8")
    log.info("%s: %d stories, %d hits skipped", f"{month:%Y-%m}", manifest.rows, skipped)
    return manifest


def collect(
    client: Client, first: date, last: date, store: Store, *, today: date
) -> list[Manifest]:
    """Collect `first` to `last` inclusive, keeping months already on disk and intact."""
    manifests: list[Manifest] = []
    month = first
    while month <= last:
        path = store.manifest(month)
        if path.is_file():
            existing = Manifest.from_json(path.read_text(encoding="utf-8"))
            problems = verify(existing, store.raw)
            if not problems:
                log.info("%s: already collected (%d stories)", f"{month:%Y-%m}", existing.rows)
                manifests.append(existing)
                month = _next_month(month)
                continue
            log.warning("%s: collecting again: %s", f"{month:%Y-%m}", "; ".join(problems))
        manifests.append(collect_month(client, month, store, today=today))
        month = _next_month(month)
    return manifests
