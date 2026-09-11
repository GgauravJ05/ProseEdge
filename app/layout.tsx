// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { Analytics } from '@vercel/analytics/next';
import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import './globals.css';

const title = 'ProseEdge — Unicode text formatter';
const description =
  'Bold, italic, script and monospace text for LinkedIn, X and Threads posts, with checks for what screen readers will hear. What you type never leaves your browser.';

export const metadata: Metadata = {
  metadataBase: new URL('https://proseedge.vercel.app'),
  title: { default: title, template: '%s · ProseEdge' },
  description,
  applicationName: 'ProseEdge',
  openGraph: { type: 'website', siteName: 'ProseEdge', url: '/', title, description },
  twitter: { card: 'summary_large_image', title, description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f7f5' },
    { media: '(prefers-color-scheme: dark)', color: '#15181c' },
  ],
};

// Analytics only exists on Vercel; anywhere else its script would 404 (next.config.ts).
const onVercel = process.env.NEXT_PUBLIC_ON_VERCEL === '1';

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <header className="site-header">
          <Link href="/" className="brand">
            ProseEdge
          </Link>
          <nav aria-label="Site">
            <Link href="/privacy">Privacy</Link>
          </nav>
        </header>
        <div id="content">{children}</div>
        <footer className="site-footer">
          <p>
            Styled letters are Unicode symbols, not rich text. The plain version is always one click
            away.
          </p>
        </footer>
        {onVercel && <Analytics />}
      </body>
    </html>
  );
}
