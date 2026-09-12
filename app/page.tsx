// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { ClientEditor } from '../src/ui/client-editor';

/** The same word in each alphabet the formatter can write. */
const SPECIMENS = [
  { label: 'Bold', sample: '𝗕𝗼𝗹𝗱' },
  { label: 'Italic', sample: '𝘐𝘵𝘢𝘭𝘪𝘤' },
  { label: 'Script', sample: '𝒮𝒸𝓇𝒾𝓅𝓉' },
  { label: 'Mono', sample: '𝙼𝚘𝚗𝚘' },
];

export default function Home() {
  return (
    <main>
      <p className="eyebrow">Local-first · v0.1</p>
      <h1>
        Style a post <span className="underline-accent">without losing</span> the plain text
      </h1>
      <p className="lede">
        Bold, italic, script and monospace letters for LinkedIn, X, Instagram and Threads, built
        from Unicode symbols. ProseEdge shows the plain version beside the styled one, counts both
        against the limit you are writing for, and never sends what you type anywhere.
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
