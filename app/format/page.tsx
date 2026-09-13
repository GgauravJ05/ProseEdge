// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import type { Metadata } from 'next';

import { ClientEditor } from '../../src/ui/client-editor';

/** The same word in each alphabet the formatter can write. */
const SPECIMENS = [
  { label: 'Bold', sample: '𝗕𝗼𝗹𝗱' },
  { label: 'Italic', sample: '𝘐𝘵𝘢𝘭𝘪𝘤' },
  { label: 'Script', sample: '𝒮𝒸𝓇𝒾𝓅𝓉' },
  { label: 'Fraktur', sample: '𝔉𝔯𝔞𝔨𝔱𝔲𝔯' },
  { label: 'Double', sample: '𝔻𝕠𝕦𝕓𝕝𝕖' },
  { label: 'Mono', sample: '𝙼𝚘𝚗𝚘' },
];

export const metadata: Metadata = {
  title: 'Formatter',
  description:
    'Style a post for LinkedIn, X, Instagram or Threads, and see the plain text a screen reader hears beside it.',
  alternates: { canonical: '/format' },
};

export default function Format() {
  return (
    <main>
      <p className="eyebrow">Local-first · v0.1</p>
      <h1>
        Style a post <span className="underline-accent">without losing</span> the plain text
      </h1>
      <p className="lede">
        Bold, italic, script, fraktur, double-struck and monospace letters for LinkedIn, X,
        Instagram and Threads, built from Unicode symbols. ProseEdge shows the plain version beside
        the styled one, counts both against the limit you are writing for, and never sends what you
        type anywhere.
      </p>
      <ul className="specimens" aria-label="The alphabets this formatter writes">
        {SPECIMENS.map(({ label, sample }) => (
          <li key={label}>
            <span className="specimen-sample">{sample}</span>
            <span className="specimen-label">{label}</span>
          </li>
        ))}
      </ul>
      <ClientEditor />
    </main>
  );
}
