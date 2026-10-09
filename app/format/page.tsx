// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import type { Metadata } from 'next';

import { ClientEditor } from '../../src/ui/client-editor';

import '../formatter.css';

export const metadata: Metadata = {
  title: 'Formatter',
  description:
    'Style a post for LinkedIn, X, Instagram or Threads, and see the plain text a screen reader hears beside it.',
  alternates: { canonical: '/format' },
};

export default function Format() {
  return (
    <main className="format-page">
      <header className="format-head">
        <h1>Style a post without losing the plain text</h1>
        <p className="lede">
          Select words, pick a style, copy. What a screen reader hears stays beside it.
        </p>
      </header>
      <ClientEditor />
    </main>
  );
}
