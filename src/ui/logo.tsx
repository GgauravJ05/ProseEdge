// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * The ProseEdge mark.
 *
 * A slab `P` on an ink tile, with an amber rule down its right side: the edge
 * where plain type becomes styled, which is what the product is about.
 *
 * Drawn as paths rather than a `<text>` element on purpose — text would render
 * in whatever serif the machine happens to have, or not at all. It inherits
 * `currentColor` for the tile and uses the accent token for the rule, so it
 * follows the light and dark themes like everything else.
 */

interface LogoProps {
  readonly size?: number;
  /** A decorative mark beside the wordmark needs no accessible name. */
  readonly title?: string;
}

export function Logo({ size = 28, title }: LogoProps) {
  return (
    <svg
      className="logo"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role={title === undefined ? undefined : 'img'}
      aria-hidden={title === undefined ? true : undefined}
      aria-label={title}
      focusable="false"
    >
      <rect x="0" y="0" width="32" height="32" rx="8" fill="currentColor" />
      {/* The P, in paper: stem, bowl, and the counter knocked out by fill-rule. */}
      <path
        d="M9 7.5h6.4a5 5 0 0 1 0 10H12.2v7H9zM12.2 10.6v3.8h3.2a1.9 1.9 0 0 0 0-3.8z"
        fill="var(--paper, #fbf7f0)"
        fillRule="evenodd"
      />
      {/* The edge. */}
      <path
        d="M23 7.5v17"
        stroke="var(--accent, #a14b08)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The mark and the name, used in the header and the footer. */
export function Wordmark({ size = 28 }: { readonly size?: number }) {
  return (
    <>
      <Logo size={size} />
      <span className="brand-name">ProseEdge</span>
    </>
  );
}
