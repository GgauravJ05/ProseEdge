// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="prose">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p className="lede">There is nothing at this address.</p>
      <p>
        {/* The formatter lives at /format; / is the landing page. */}
        <Link href="/format">Back to the formatter</Link>
      </p>
    </main>
  );
}
