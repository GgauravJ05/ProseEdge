# ProseEdge

[![CI](https://github.com/GgauravJ05/ProseEdge/actions/workflows/ci.yml/badge.svg)](https://github.com/GgauravJ05/ProseEdge/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

A local-first editor for social posts that use Unicode "bold" and "italic"
letters, which measures what that styling costs screen-reader users. It scores
openings with a compressed ranking model that runs entirely in the browser.

**Try it: <https://proseedge.vercel.app>**

> **Status: v0.1 formatter.** The editor styles text in serif, sans, script,
> fraktur, double-struck and monospace — with bold and italic where Unicode has
> them — plus underline and strikethrough as combining marks, and uppercase and
> lowercase as transforms. It copies styled or plain text, offers the whole post
> in every style at once, counts against the limit of the platform you are
> writing for, flags characters a font cannot style, and keeps the draft in the
> browser. The accessibility study and the ranking model are in progress, and no
> performance or quality numbers are claimed. See the
> [build order](docs/architecture-spec.md#11-build-order).

## Why

LinkedIn, X and Threads have no rich text, so authors substitute Mathematical
Alphanumeric Symbols (`𝗕𝗼𝗹𝗱`) for letters. Screen readers read those as
"mathematical sans-serif bold capital B" or skip them. ProseEdge keeps the plain
text as the source of truth, so styling is always reversible, and it reports
exactly which characters could not be styled rather than silently substituting
lookalikes.

## Screenshots

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/app-landing-dark.png">
  <img alt="The ProseEdge landing page: a headline reading 'Unicode bold is not rich text', a specimen card showing the same words in every style, and a Format now call to action." src="docs/screenshots/app-landing-light.png">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/app-format-dark.png">
  <img alt="The formatter: a toolbar of style, emphasis, list and case controls above two side-by-side panes, the styled post on the left with a bold phrase selected and the plain text a screen reader hears on the right, identical but for the styling." src="docs/screenshots/app-format-light.png">
</picture>

Light and dark follow an explicit in-app toggle, not the operating system's
setting, and the choice is remembered in the browser.

## Architecture

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/architecture-dark.png">
  <img alt="Typing and pasting both build one document tree whose spans hold canonical ASCII with styling as metadata. Rendering it gives the styled post; its source text gives the plain text; normalizing the styled output returns exactly that plain text." src="docs/screenshots/architecture-light.png">
</picture>

Source text stays canonical ASCII and styling is metadata applied at render, so
`normalize(render(doc)) === sourceText(doc)` holds for every document and every
style combination — property-tested over generated documents, not asserted. That
round trip is what makes the plain-text pane truthful and every transform
reversible.

[`docs/architecture.html`](docs/architecture.html) is the standalone version: one
file, no build step, and it follows your light or dark setting.

## Documentation

- [Roadmap: the formatter ships first, research features follow](docs/roadmap.md)
- [Technical specification and research plan](docs/architecture-spec.md)
- [The document model, as a diagram](docs/architecture.html)
- [Architecture decision records](docs/adr/)
- [Contributing](CONTRIBUTING.md)

## Development

```sh
corepack enable && pnpm install && pnpm check
```

## License

[AGPL-3.0-or-later](LICENSE)
