// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { ClientEditor } from '../src/ui/client-editor';

export default function Home() {
  return (
    <main>
      <p className="eyebrow">Local-first · v0.1</p>
      <h1>Style a post without losing the plain text</h1>
      <p className="lede">
        Bold, italic, script and monospace letters for LinkedIn, X and Threads, built from Unicode
        symbols. ProseEdge keeps the plain version underneath, tells you what screen readers will
        hear, and never sends what you type anywhere.
      </p>
      <ClientEditor />
    </main>
  );
}
