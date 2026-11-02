// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { m } from 'framer-motion';
import type { Variants } from 'framer-motion';

import { announceText, namedCount } from '../../analysis/transcript';
import { PLATFORMS, budget } from '../../analysis/platforms';
import { clusters, glyph, isAsciiAlnum } from '../../document';
import { CountUp } from '../motion/count-up';
import { Reveal } from '../motion/reveal';
import { Sheen } from '../motion/sheen';
import { Typewriter } from '../motion/typewriter';
import { inStyle } from '../specimens';
import { HERO_POST, specimen } from './samples';

const BOLD = specimen('sans_bold');
const LEAD = HERO_POST.lead;
const STYLED_LEAD = inStyle(LEAD, BOLD);
const HEARD = announceText(STYLED_LEAD);

const QUERY = 'hiring';
const POSTS = [
  { label: 'Plain post', text: LEAD + HERO_POST.body },
  { label: 'Styled post', text: STYLED_LEAD + HERO_POST.body },
].map((post) => ({ ...post, found: post.text.includes(QUERY) }));

const costs = (['x', 'linkedin'] as const).map((id) => {
  const spent = budget(STYLED_LEAD, LEAD, PLATFORMS[id]);
  return {
    id,
    label: PLATFORMS[id].label,
    plain: spent.used - spent.styleCost,
    styled: spent.used,
  };
});
const widest = Math.max(...costs.map((cost) => cost.styled));

const MISSING_SAMPLE = 'Hiring 3 roles in 2026';
const ITALIC = specimen('italic');

const grow: Variants = {
  hidden: { scaleX: 0 },
  visible: (fraction: number) => ({
    scaleX: fraction,
    transition: { type: 'spring', stiffness: 120, damping: 20, delay: 0.2 },
  }),
};

/** The costs of Unicode styling, each shown working rather than described. */
export function TradeBento() {
  return (
    <div className="bento">
      <Reveal className="bento-cell bento-heard">
        <Sheen as="article" className="tile">
          <h3>What a screen reader may hear</h3>
          <p className="tile-sub">
            <span className="tile-sample">{STYLED_LEAD}</span> is two words to you.
          </p>
          <p className="heard-out">
            <Typewriter text={HEARD} speed={16} />
          </p>
          <p className="tile-foot">
            <CountUp value={namedCount(STYLED_LEAD)} className="big" /> of {clusters(LEAD).length}{' '}
            characters read out by name. Some readers skip them instead, and the words are gone
            either way.
          </p>
        </Sheen>
      </Reveal>

      <Reveal className="bento-cell bento-search">
        <Sheen as="article" className="tile">
          <h3>Search cannot find it</h3>
          <p className="search-box" aria-hidden="true">
            <span className="search-glass" />
            <Typewriter text={QUERY} speed={90} replay={false} />
          </p>
          <ul className="search-results">
            {POSTS.map((post) => (
              <li key={post.label} className={post.found ? 'hit' : 'miss'}>
                <span>{post.label}</span>
                <span className="result">{post.found ? 'match' : 'no match'}</span>
              </li>
            ))}
          </ul>
        </Sheen>
      </Reveal>

      <Reveal className="bento-cell bento-cost">
        <Sheen as="article" className="tile">
          <h3>Styling costs double on some feeds</h3>
          <ul className="cost-bars">
            {costs.map((cost) => (
              <li key={cost.id}>
                <span className="cost-name">{cost.label}</span>
                <span className="cost-track">
                  <m.span
                    className="cost-fill"
                    variants={grow}
                    custom={cost.styled / widest}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                  />
                </span>
                <span className="cost-num mono">
                  <CountUp value={cost.styled} />
                  {cost.styled > cost.plain ? ` (+${String(cost.styled - cost.plain)})` : ''}
                </span>
              </li>
            ))}
          </ul>
          <p className="tile-foot">
            A styled letter is one codepoint but two UTF-16 units. X counts the first; LinkedIn
            appears to count the second.
          </p>
        </Sheen>
      </Reveal>

      <Reveal className="bento-cell bento-missing">
        <Sheen as="article" className="tile">
          <h3>Some characters have no styled form</h3>
          <p className="missing-sample" aria-hidden="true">
            {clusters(MISSING_SAMPLE).map(({ text: ch }, i) => {
              const reachable = !isAsciiAlnum(ch) || glyph('italic', ch) !== null;
              return reachable ? (
                <span key={i}>{inStyle(ch, ITALIC)}</span>
              ) : (
                <mark key={i} className="unreached">
                  {ch}
                </mark>
              );
            })}
          </p>
          <p className="tile-foot">
            Unicode has no italic digits. ProseEdge marks what it could not style instead of
            swapping in a lookalike.
          </p>
        </Sheen>
      </Reveal>

      <Reveal className="bento-cell bento-local">
        <Sheen as="article" className="tile">
          <h3>Nothing you type leaves your browser</h3>
          <svg className="local-path" viewBox="0 0 320 96" aria-hidden="true">
            <rect x="4" y="30" width="86" height="36" rx="8" className="node" />
            <text x="47" y="53" textAnchor="middle">
              Your text
            </text>
            <rect x="200" y="6" width="116" height="34" rx="8" className="node node-on" />
            <text x="258" y="28" textAnchor="middle">
              This browser
            </text>
            <rect x="200" y="56" width="116" height="34" rx="8" className="node node-off" />
            <text x="258" y="78" textAnchor="middle">
              Any server
            </text>
            <path d="M90 44 C140 44 150 23 200 23" className="wire wire-on" />
            <path d="M90 52 C140 52 150 73 200 73" className="wire wire-off" />
            <path d="M140 56 l12 12 M152 56 l-12 12" className="cross" />
          </svg>
          <p className="tile-foot">
            No account, no upload. Formatting runs on your device; an end-to-end test fails if any
            request carries what you typed.
          </p>
        </Sheen>
      </Reveal>
    </div>
  );
}
