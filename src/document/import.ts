// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { builder, randomIds } from './grammar';
import type { Document, IdFactory, Paragraph } from './grammar';
import { parseStyled } from './normalize';

/** Normalize every line terminator to a line feed. */
export function toLf(text: string): string {
  return text.replace(/\r\n|[\r\v\f\u0085\u2028\u2029]/gu, '\n');
}

/**
 * Build a document from plain or already-styled text, one paragraph per line.
 *
 * The first line becomes the hook and the rest the body; blank lines are empty
 * paragraphs. This makes import lossless:
 * `sourceText(fromText(t)) === normalize(toLf(t))` for every string `t`.
 */
export function fromText(text: string, ids: IdFactory = randomIds): Document {
  const b = builder(ids);
  const toParagraph = (line: string): Paragraph =>
    b.paragraph(...parseStyled(line).map((run) => b.span(run.text, run.style)));
  const [first = '', ...rest] = toLf(text).split('\n');
  const hook = b.hook(toParagraph(first));
  return rest.length === 0 ? b.document(hook) : b.document(hook, b.body(...rest.map(toParagraph)));
}
