// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import Link from 'next/link';

export default function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>There is nothing at this address.</p>
      <p>
        <Link href="/">Back to the formatter</Link>
      </p>
    </main>
  );
}
