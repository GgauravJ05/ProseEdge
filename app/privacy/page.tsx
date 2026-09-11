// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What ProseEdge stores, what it sends, and what it never sees.',
};

export default function Privacy() {
  return (
    <main>
      <h1>Privacy</h1>
      <p>ProseEdge has no accounts and no server of its own. The short version:</p>

      <h2>What you type never leaves your browser</h2>
      <p>
        Styling, checks and copying all run on your device. The text of your post is not sent
        anywhere; an automated test fails the build if any network request carries it.
      </p>

      <h2>What is stored on your device</h2>
      <p>
        Your current draft is kept in your browser&apos;s local storage so it survives a reload.
        Only this browser can read it. <strong>Clear post</strong> empties it, and clearing site
        data for this address removes it completely.
      </p>

      <h2>What is sent</h2>
      <p>
        The pages and scripts are downloaded from Vercel, which hosts the site. When Vercel Web
        Analytics is enabled, each page view reports the page address, the referring site, and
        coarse browser, operating system, device and country information, so the author can see how
        many people use ProseEdge. It uses no cookies and does not include anything you type.
      </p>

      <p>
        <Link href="/">Back to the formatter</Link>
      </p>
    </main>
  );
}
