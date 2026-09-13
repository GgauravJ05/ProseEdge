// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * Upper and lower case, as text transforms rather than styles.
 *
 * Everything else in the toolbar is styling: the source text never changes and
 * the plain pane keeps the words. These two are different in kind — they
 * rewrite the post itself, so the plain text changes with them and there is
 * nothing to "remove" afterwards beyond typing it back.
 *
 * They travel the same path as the list commands (`TextEdit` through
 * `applyEdit`), not the styling path, for exactly that reason.
 */

import { clusters, isStyledCodepoint } from '../document';
import type { TextEdit } from './lists';

export type CaseTransform = 'upper' | 'lower';

/** Whether a cluster is a letter the transform may touch. */
function isPlain(cluster: string): boolean {
  return ![...cluster].some((ch) => isStyledCodepoint(ch.codePointAt(0) ?? 0));
}

/**
 * `text` with the selected range recased.
 *
 * Styled letters are left exactly as they are. `toUpperCase` on a mathematical
 * alphanumeric either does nothing or, worse, maps it somewhere unintended —
 * and a reader who styled a word did not ask for its case to change. The plain
 * pane would also disagree with the post, because the source keeps the original
 * letter while the output shows a different one.
 *
 * A collapsed selection transforms the whole post, which is what makes the
 * buttons useful without selecting first.
 */
export function recase(
  text: string,
  start: number,
  end: number,
  transform: CaseTransform,
): TextEdit {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const [from, to] = lo === hi ? [0, text.length] : [lo, hi];

  let out = '';
  for (const cluster of clusters(text.slice(from, to))) {
    if (!isPlain(cluster.text)) {
      out += cluster.text;
      continue;
    }
    out += transform === 'upper' ? cluster.text.toUpperCase() : cluster.text.toLowerCase();
  }

  return {
    text: text.slice(0, from) + out + text.slice(to),
    start: from,
    end: from + out.length,
  };
}
