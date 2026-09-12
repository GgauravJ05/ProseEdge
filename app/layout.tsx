// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { Analytics } from '@vercel/analytics/next';
import type { Metadata, Viewport } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { ThemeToggle } from '../src/ui/theme-toggle';
import { THEME_SCRIPT } from '../src/ui/theme';

import './globals.css';

// Downloaded at build time and served from this domain: no third-party request
// at runtime, which keeps the privacy claim on /privacy exactly true.
const sans = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const serif = Source_Serif_4({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-source-serif',
});

const title = 'ProseEdge — Unicode text formatter';
const description =
  'Bold, italic, script and monospace text for LinkedIn, X, Instagram and Threads posts, with checks for what screen readers will hear. What you type never leaves your browser.';

export const metadata: Metadata = {
  metadataBase: new URL('https://proseedge.vercel.app'),
  title: { default: title, template: '%s · ProseEdge' },
  description,
  applicationName: 'ProseEdge',
  openGraph: { type: 'website', siteName: 'ProseEdge', url: '/', title, description },
  twitter: { card: 'summary_large_image', title, description },
};

export const viewport: Viewport = {
  // The app ships light and only changes on request, so the browser chrome
  // matches the light paper rather than the operating system.
  themeColor: '#fbf7f0',
  colorScheme: 'light dark',
};

// Analytics only exists on Vercel; anywhere else its script would 404 (next.config.ts).
const onVercel = process.env.NEXT_PUBLIC_ON_VERCEL === '1';

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // No `data-theme` attribute here on purpose: the inline script below sets it
    // before paint from the remembered choice, and rendering it here would make
    // hydration restore the default and undo that on every reload.
    // `suppressHydrationWarning` tells React the difference is intended.
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${serif.variable}`}>
      <head>
        {/*
         * Applies the remembered theme before anything paints, so a reader who
         * chose dark never sees a flash of light. It must be inline and
         * render-blocking to do that; the Content-Security-Policy allows inline
         * scripts, and this one touches only localStorage and <html>.
         */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <header className="site-header">
          <Link href="/" className="brand">
            ProseEdge
          </Link>
          <nav aria-label="Site" className="site-nav">
            <Link href="/privacy">Privacy</Link>
            <ThemeToggle />
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
