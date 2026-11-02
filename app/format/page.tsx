// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import type { Metadata } from 'next';

import { ClientEditor } from '../../src/ui/client-editor';

import '../formatter.css';

export const metadata: Metadata = {
  title: 'Formatter',
  description:
    'Style a post for LinkedIn, X, Instagram or Threads, and hear what a screen reader may say before you copy it out.',
  alternates: { canonical: '/format' },
};

export default function Format() {
  return (
    <main className="format-page">
      <header className="format-head">
        <h1>Style a post, and hear what it costs</h1>
        <p className="lede">
          Bold and italic letters on LinkedIn, X and Threads are Unicode symbols. Style your post
          here and see what a screen reader may say before you copy it out.
        </p>
      </header>
      <ClientEditor />
    </main>
  );
}
