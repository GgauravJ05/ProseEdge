# ProseEdge

[![CI](https://github.com/GgauravJ05/ProseEdge/actions/workflows/ci.yml/badge.svg)](https://github.com/GgauravJ05/ProseEdge/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

A local-first editor for social posts that use Unicode "bold" and "italic"
letters, which measures what that styling costs screen-reader users. It scores
openings with a compressed ranking model that runs entirely in the browser.

**Try it: <https://proseedge.vercel.app>**

> **Status: v0.1 formatter.** The editor styles text in serif, sans, script and
> monospace with bold and italic, copies styled or plain text, counts styled
> letters, flags characters a font cannot style, and keeps the draft in the
> browser. The accessibility study and the ranking model are in progress, and
> no performance or quality numbers are claimed. See the
> [build order](docs/architecture-spec.md#11-build-order).

## Why

LinkedIn, X and Threads have no rich text, so authors substitute Mathematical
Alphanumeric Symbols (`𝗕𝗼𝗹𝗱`) for letters. Screen readers read those as
"mathematical sans-serif bold capital B" or skip them. ProseEdge keeps the plain
text as the source of truth, so styling is always reversible, and it reports
exactly which characters could not be styled rather than silently substituting
lookalikes.

## Documentation

- [Technical specification and research plan](docs/architecture-spec.md)
- [Architecture decision records](docs/adr/)
- [Contributing](CONTRIBUTING.md)

## Development

```sh
corepack enable && pnpm install && pnpm check
```

## License

[AGPL-3.0-or-later](LICENSE)
