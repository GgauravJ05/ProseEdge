// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { StylePreview } from '../src/ui/style-preview';

export default function Home() {
  return (
    <main>
      <h1>ProseEdge</h1>
      <p>
        Phase 1 preview: the document model running in your browser. No model is loaded and nothing
        you type leaves this page.
      </p>
      <StylePreview />
    </main>
  );
}
