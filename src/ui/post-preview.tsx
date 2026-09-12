// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { useMemo } from 'react';

import { wrap } from '../analysis/fold';
import type { Measure } from '../analysis/fold';
import type { Platform } from '../analysis/platforms';
import { flags } from '../flags';
import { CommentIcon, HeartIcon, RepostIcon, SendIcon } from './icons';
import { fontOf, previewStyle } from './preview';
import type { PreviewStyle } from './preview';

interface PostPreviewProps {
  /** The styled post, exactly as it would be pasted into the feed. */
  readonly text: string;
  readonly platform: Platform;
  /** Text metrics in the card's own font; injected so tests are not tied to canvas. */
  readonly measureFor: (font: string) => Measure;
}

/** The byline, which differs by platform but never names or brands one. */
function Byline({ style }: { readonly style: PreviewStyle }) {
  if (style.byline === 'headline') {
    return (
      <div className="preview-who">
        <span className="preview-name">Your Name</span>
        <span className="preview-sub">Your headline · 2h</span>
      </div>
    );
  }
  if (style.byline === 'handle') {
    return (
      <div className="preview-who">
        <span className="preview-name">
          Your Name <span className="preview-sub">@yourhandle · 2h</span>
        </span>
      </div>
    );
  }
  return (
    <div className="preview-who">
      <span className="preview-name">yourhandle</span>
    </div>
  );
}

/**
 * The post as the feed would lay it out: the platform's column width, type
 * scale and byline shape, in this app's palette.
 *
 * The card imitates layout, not brand (ADR 0009). No logo, wordmark or brand
 * colour appears, which keeps it inside the contrast budget the axe scans
 * enforce and lets it follow the light and dark themes.
 *
 * Lines are broken by measuring the real text at the real width, not by
 * counting characters, because a styled letter is wider than a plain one — the
 * whole reason the wrap is worth showing. Where the feed *collapses* the post
 * is not measured, so that cut only appears behind the `foldPreview` flag.
 */
export function PostPreview({ text, platform, measureFor }: PostPreviewProps) {
  const style = previewStyle(platform.id);

  const lines = useMemo(() => {
    if (style === null) return null;
    return wrap(text, style.width, measureFor(fontOf(style)));
  }, [text, style, measureFor]);

  if (style === null || lines === null) {
    return (
      <p className="hint preview-empty">
        Pick a target above to see the post laid out the way that feed would show it.
      </p>
    );
  }

  // Only draw a cut where the platform collapses posts AND the fold work is on.
  const clamp = flags.foldPreview ? style.clamp : null;
  const truncated = clamp !== null && lines.length > clamp;
  const shown = truncated ? lines.slice(0, clamp) : lines;

  return (
    <div className="preview-card" style={{ maxWidth: `${String(style.width)}px` }}>
      <div className="preview-head">
        {/* An empty avatar: a real one would be a face this app does not have. */}
        <span className="preview-avatar" aria-hidden="true" />
        <Byline style={style} />
      </div>

      <div
        className="preview-body"
        style={{
          fontFamily: style.font,
          fontSize: `${String(style.size)}px`,
          lineHeight: style.lineHeight,
        }}
      >
        {/*
         * Rendered line by line, from the same measured wrap, so what is on
         * screen is the wrap being asserted rather than the browser's own.
         */}
        {shown.map((line, index) => (
          <span key={index} className="preview-line">
            {line === '' ? ' ' : line}
          </span>
        ))}
        {truncated && <span className="preview-more">…see more</span>}
      </div>

      {/* Decorative: these stand for the feed's controls and do nothing. */}
      <div className="preview-actions" aria-hidden="true">
        <HeartIcon />
        <CommentIcon />
        <RepostIcon />
        <SendIcon />
      </div>

      <p className="preview-caveat">
        {style.caveat}
        {truncated && ' The “see more” point is an estimate, not a measurement.'}
      </p>
    </div>
  );
}
