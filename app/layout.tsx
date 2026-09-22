// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { Analytics } from '@vercel/analytics/next';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Logo, Wordmark } from '../src/ui/logo';
import { ThemeToggle } from '../src/ui/theme-toggle';
import { THEME_SCRIPT } from '../src/ui/theme';

import './globals.css';

// Downloaded at build time and served from this domain: no third-party request
// at runtime, which keeps the privacy claim on /privacy exactly true.
const sans = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-jakarta' });
const display = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

const title = 'ProseEdge — Unicode text formatter for social posts';
const description =
  'Bold, italic, script, fraktur, double-struck, monospace, underline and strikethrough for LinkedIn, X, Instagram and Threads — with the plain text a screen reader hears shown beside it. Nothing you type leaves your browser.';

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
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable}`}>
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
          <Link href="/" className="brand" aria-label="ProseEdge home">
            <Wordmark />
          </Link>
          <nav aria-label="Site" className="site-nav">
            <Link href="/privacy">Privacy</Link>
            <ThemeToggle />
            <Link href="/format" className="nav-cta">
              Format now
            </Link>
          </nav>
        </header>
        <div id="content">{children}</div>
        <footer className="site-footer">
          <div className="footer-top">
            <div className="footer-brand">
              <span className="brand">
                <Logo size={24} />
                <span className="brand-name">ProseEdge</span>
              </span>
              <p>
                Styled letters are Unicode symbols, not rich text. The plain version is always one
                click away.
              </p>
            </div>
            <nav className="footer-links" aria-label="Product">
              <h2>Product</h2>
              <Link href="/format">Formatter</Link>
              <Link href="/#how">How it works</Link>
              <Link href="/#features-title">Features</Link>
            </nav>
            <nav className="footer-links" aria-label="About">
              <h2>About</h2>
              <Link href="/privacy">Privacy</Link>
              <a href="https://www.gnu.org/licenses/agpl-3.0.html" rel="license noreferrer">
                AGPL-3.0
              </a>
            </nav>
          </div>
          <div className="footer-bottom">
            <p>© 2026 Gaurav Jadhav · Free software under the AGPL-3.0-or-later.</p>
            {/*
             * We render an approximation of each feed's layout and borrow no
             * logo or brand colour (ADR 0009); saying so plainly is part of
             * keeping that line clear.
             */}
            <p>
              Not affiliated with, endorsed by, or connected to LinkedIn, X, Instagram or Threads.
              Platform names are the trademarks of their respective owners.
            </p>
          </div>
        </footer>
        {onVercel && <Analytics />}
      </body>
    </html>
  );
}
