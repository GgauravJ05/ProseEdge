// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import dynamic from 'next/dynamic';

/**
 * The editor renders only in the browser. Its first render reads the saved
 * draft from `localStorage`, which a static prerender cannot see; rendering it
 * on the server would show one post and hydrate another.
 */
export const ClientEditor = dynamic(() => import('./editor').then((module) => module.Editor), {
  ssr: false,
  // Holds the editor's room, so the footer does not jump when the editor arrives.
  loading: () => (
    <div className="editor-loading">
      <p className="hint">Loading the editor…</p>
      <noscript>
        <p className="hint">The formatter needs JavaScript, which is off in this browser.</p>
      </noscript>
    </div>
  ),
});
