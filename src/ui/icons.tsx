// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * The icon set, drawn here rather than pulled from a package: a dozen glyphs on
 * one 24-unit grid, inheriting `currentColor` and the button's text size.
 *
 * Every icon is decorative. Each button keeps its visible text label, so the
 * accessible name never depends on an icon, and `aria-hidden` keeps them out of
 * the accessibility tree.
 */

import type { ReactNode } from 'react';

interface IconProps {
  readonly children: ReactNode;
  /** Filled glyphs (the bold "B", the list dots) need no stroke. */
  readonly filled?: boolean;
}

function Icon({ children, filled = false }: IconProps) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function SunIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </Icon>
  );
}

export function MoonIcon() {
  return (
    <Icon>
      <path d="M20 13.4A8.2 8.2 0 1 1 10.6 4a6.7 6.7 0 0 0 9.4 9.4z" />
    </Icon>
  );
}

export function BoldIcon() {
  return (
    <Icon>
      <path d="M7 4h6a4 4 0 0 1 0 8H7z" />
      <path d="M7 12h7a4 4 0 0 1 0 8H7z" />
    </Icon>
  );
}

export function ItalicIcon() {
  return (
    <Icon>
      <path d="M15 4H9m6 0-4 16m4-16h0M13 20H7" />
    </Icon>
  );
}

export function BulletListIcon() {
  return (
    <Icon>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1.25" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function UppercaseIcon() {
  return (
    <Icon>
      <path d="M3 19 8.5 5l5.5 14M5 14.5h7" />
      <path d="M16.5 19V9.5M16.5 19h4.5" />
    </Icon>
  );
}

export function LowercaseIcon() {
  return (
    <Icon>
      <path d="M4 12.2a3.4 3.4 0 0 1 6.6 1.1V19M10.6 15.8a3.2 3.2 0 1 0-3.2 3.2 3.3 3.3 0 0 0 3.2-2" />
      <path d="M20 5v14M20 15.8a3.2 3.2 0 1 0-3.2 3.2 3.3 3.3 0 0 0 3.2-2" />
    </Icon>
  );
}

export function ChecklistIcon() {
  return (
    <Icon>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <rect x="3" y="4.4" width="4" height="4" rx="1" />
      <rect x="3" y="10.4" width="4" height="4" rx="1" />
      <rect x="3" y="16.4" width="4" height="4" rx="1" />
    </Icon>
  );
}

export function NumberedListIcon() {
  return (
    <Icon>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M3.2 4.6 4.6 4v4M3 16.2c0-.7.6-1.2 1.3-1.2.7 0 1.3.5 1.3 1.2 0 1.2-2.6 1.6-2.6 3.3h2.8" />
    </Icon>
  );
}

export function CopyIcon() {
  return (
    <Icon>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15" />
    </Icon>
  );
}

export function PlainTextIcon() {
  return (
    <Icon>
      <path d="M14 3H6.5A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </Icon>
  );
}

export function RestoreIcon() {
  return (
    <Icon>
      <path d="M3.5 5.5v5h5" />
      <path d="M4.2 13a8 8 0 1 0 1.6-5.3L3.5 10.5" />
    </Icon>
  );
}

export function ClearIcon() {
  return (
    <Icon>
      <path d="M4 7h16M9.5 7V4.8c0-.7.5-1.3 1.2-1.3h2.6c.7 0 1.2.6 1.2 1.3V7" />
      <path d="M6.5 7 7.4 19a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9L17.5 7" />
    </Icon>
  );
}

export function WarningIcon() {
  return (
    <Icon>
      <path d="M12 4.8 3.6 19a1.3 1.3 0 0 0 1.1 2h14.6a1.3 1.3 0 0 0 1.1-2L12 4.8z" />
      <path d="M12 10v4.5M12 17.8h.01" />
    </Icon>
  );
}

export function CheckIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </Icon>
  );
}

export function StructureIcon() {
  return (
    <Icon>
      <rect x="3.5" y="4" width="17" height="5" rx="1.5" />
      <path d="M3.5 13h12M3.5 17.5h17M3.5 21h8" />
    </Icon>
  );
}

export function ReadingIcon() {
  return (
    <Icon>
      <path d="M3.5 5.5h6a3 3 0 0 1 2.5 1.4 3 3 0 0 1 2.5-1.4h6v12h-6a3 3 0 0 0-2.5 1.3A3 3 0 0 0 9.5 17.5h-6z" />
      <path d="M12 6.9v11.9" />
    </Icon>
  );
}

export function FoldIcon() {
  return (
    <Icon>
      <path d="M3.5 6h17M3.5 10.5h12M3.5 15h17M3.5 19.5h9" />
    </Icon>
  );
}

export function UnderlineIcon() {
  return (
    <Icon>
      <path d="M6.5 4v6.5a5.5 5.5 0 0 0 11 0V4" />
      <path d="M5 20.5h14" />
    </Icon>
  );
}

export function StrikethroughIcon() {
  return (
    <Icon>
      <path d="M4 12h16" />
      <path d="M7.5 7.4A3.6 3.6 0 0 1 11.2 4h2.3a3.4 3.4 0 0 1 3.3 2.6M16.5 16a3.7 3.7 0 0 1-3.7 3.9h-1.6A3.9 3.9 0 0 1 7.2 17" />
    </Icon>
  );
}

export function PreviewIcon() {
  return (
    <Icon>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="8" cy="9.5" r="1.8" />
      <path d="M12.5 8.5h5M12.5 11.5h3M6.5 14.5h11M6.5 17h7" />
    </Icon>
  );
}

/*
 * The card's action row. These stand for "react", "comment", "repost" and
 * "send" without borrowing any platform's own glyphs: they are decorative and
 * inert, and the row is hidden from the accessibility tree by its container.
 */
export function HeartIcon() {
  return (
    <Icon>
      <path d="M12 20s-7.3-4.4-7.3-9.3A4.2 4.2 0 0 1 12 8.2a4.2 4.2 0 0 1 7.3 2.5C19.3 15.6 12 20 12 20z" />
    </Icon>
  );
}

export function CommentIcon() {
  return (
    <Icon>
      <path d="M20.5 12.2c0 4-3.8 7.2-8.5 7.2a9.8 9.8 0 0 1-2.6-.3L4.5 21l1.2-3.6a6.8 6.8 0 0 1-2.2-5.2C3.5 8.2 7.3 5 12 5s8.5 3.2 8.5 7.2z" />
    </Icon>
  );
}

export function RepostIcon() {
  return (
    <Icon>
      <path d="M6 9.5V8a2.5 2.5 0 0 1 2.5-2.5H17M17 5.5l-2.5-2.5M17 5.5 14.5 8" />
      <path d="M18 14.5V16a2.5 2.5 0 0 1-2.5 2.5H7M7 18.5 9.5 16M7 18.5 9.5 21" />
    </Icon>
  );
}

export function SendIcon() {
  return (
    <Icon>
      <path d="M20.5 3.5 10.8 13.2M20.5 3.5l-6.2 17-3.5-7.3-7.3-3.5z" />
    </Icon>
  );
}
