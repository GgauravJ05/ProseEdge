// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import Link from 'next/link';

import { styledCodepoints } from '../src/document';
import { BeforeAfter } from '../src/ui/landing/before-after';
import { LiveWord } from '../src/ui/landing/live-word';
import { PlatformMeters } from '../src/ui/landing/platform-meters';
import { TradeBento } from '../src/ui/landing/trade-bento';
import { TryIt } from '../src/ui/landing/try-it';
import { CountUp } from '../src/ui/motion/count-up';
import { Magnetic } from '../src/ui/motion/magnetic';
import { Reveal, RevealGroup, RevealItem } from '../src/ui/motion/reveal';
import { SPECIMENS } from '../src/ui/specimens';

/**
 * The landing page.
 *
 * It leads with the thing that is actually true and that no comparable tool
 * says out loud: these letters are Unicode symbols, not rich text, and that has
 * a cost. Every demo below runs the formatter's own code on a sample post, so
 * nothing on this page is a picture of a feature — each one is the feature.
 */

/* Every figure here is computed from the code, never typed in. */
const STATS = [
  { value: SPECIMENS.length, label: 'styles, all reversible' },
  { value: 4, label: 'feeds counted their own way' },
  { value: styledCodepoints().size, label: 'characters, each named exactly' },
  { value: 0, label: 'accounts, uploads or trackers on your text' },
];

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className="arrow">
      <path
        d="M3 8h10M9 4l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="landing">
      <section className="hero">
        <Reveal className="hero-copy">
          <h1>
            Unicode <LiveWord word="bold" /> is not rich text.
          </h1>
          <p className="lede hero-lede">
            Every LinkedIn formatter swaps your letters for mathematical symbols. They look bold.
            They are not searchable, and a screen reader may read them out one symbol at a time.
            ProseEdge does the same formatting, and shows you the cost.
          </p>
          <div className="cta-row">
            <Magnetic>
              <Link href="/format" className="cta-primary">
                Format now
                <Arrow />
              </Link>
            </Magnetic>
            <a href="#how" className="cta-link">
              See what a screen reader hears
            </a>
          </div>
          <p className="cta-note">No sign-up. Nothing you type is sent anywhere.</p>
        </Reveal>
        <Reveal className="hero-demo">
          <BeforeAfter />
        </Reveal>
      </section>

      <RevealGroup className="landing-stats">
        {STATS.map((stat) => (
          <RevealItem key={stat.label} className="stat">
            <CountUp value={stat.value} className="stat-value" />
            <span className="stat-label mono">{stat.label}</span>
          </RevealItem>
        ))}
      </RevealGroup>

      <section className="band" id="how" aria-labelledby="how-title">
        <Reveal className="band-head">
          <h2 id="how-title">The trade nobody mentions</h2>
          <p className="band-lede">
            Styled letters look like formatting and behave like symbols. Here is what that costs,
            measured on the post above.
          </p>
        </Reveal>
        <TradeBento />
      </section>

      <section className="band" aria-labelledby="features-title">
        <Reveal className="band-head">
          <h2 id="features-title">Try your own words</h2>
          <p className="band-lede">
            Every row is the same sentence. Only one of them is still words to a screen reader.
          </p>
        </Reveal>
        <TryIt />
      </section>

      <section className="band" aria-labelledby="platforms-title">
        <Reveal className="band-head">
          <h2 id="platforms-title">Written for where it is going</h2>
          <p className="band-lede">
            One post, four limits. X counts codepoints, so styling is free; the others count code
            units, so each styled letter costs two.
          </p>
        </Reveal>
        <PlatformMeters />
        <p className="band-footnote">
          Published limits at the time of writing. Where counting behaviour has not been verified
          against the live product, the meter says so rather than guessing quietly.
        </p>
      </section>

      <Reveal className="closing">
        <section aria-labelledby="closing-title">
          <h2 id="closing-title">
            Write the post. Keep the <LiveWord word="words" interval={2600} />.
          </h2>
          <p className="lede">
            Free, open source under the AGPL, and it runs entirely on your device.
          </p>
          <Magnetic>
            <Link href="/format" className="cta-primary">
              Format now
              <Arrow />
            </Link>
          </Magnetic>
        </section>
      </Reveal>
    </main>
  );
}
