// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { ClientEditor } from '../src/ui/client-editor';

export default function Home() {
  return (
    <main>
      <h1>ProseEdge</h1>
      <p className="lede">
        Bold, italic and other styles for LinkedIn, X and Threads posts, made from Unicode letters.
        What you type stays in this browser.
      </p>
      <ClientEditor />
    </main>
  );
}
