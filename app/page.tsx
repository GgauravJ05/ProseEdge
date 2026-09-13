// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import Link from 'next/link';

import {
  CheckIcon,
  CopyIcon,
  PlainTextIcon,
  PreviewIcon,
  ReadingIcon,
  StructureIcon,
  WarningIcon,
} from '../src/ui/icons';

/**
 * The landing page.
 *
 * It leads with the thing that is actually true and that no comparable tool
 * says out loud: these letters are Unicode symbols, not rich text, and that has
 * a cost. Making the cost the headline is the honest pitch and, as it happens,
 * the only one nobody else can copy without changing their product.
 */

/*
 * One sentence in several alphabets, with the plain text beneath the rule.
 * Every row says the same thing; only the last one is still words.
 */
const SPECIMEN = [
  { label: 'Bold', sample: '𝗪𝗲’𝗿𝗲 𝗵𝗶𝗿𝗶𝗻𝗴' },
  { label: 'Italic', sample: '𝘞𝘦’𝘳𝘦 𝘩𝘪𝘳𝘪𝘯𝘨' },
  { label: 'Script', sample: '𝒲ℯ’𝓇ℯ 𝒽𝒾𝓇𝒾𝓃ℊ' },
  { label: 'Fraktur', sample: '𝔚𝔢’𝔯𝔢 𝔥𝔦𝔯𝔦𝔫𝔤' },
  { label: 'Double-struck', sample: '𝕎𝕖’𝕣𝕖 𝕙𝕚𝕣𝕚𝕟𝕘' },
  { label: 'Underline', sample: 'W̲e̲’r̲e̲ h̲i̲r̲i̲n̲g̲' },
];

const FEATURES = [
  {
    icon: <PlainTextIcon />,
    title: 'The plain text, always beside it',
    body: 'Every styled post shows the text a screen reader actually announces, in a pane next to the one you are writing. Copy either one.',
  },
  {
    icon: <PreviewIcon />,
    title: 'See it as the feed will',
    body: 'A preview lays your post out at the target platform’s own column width and type size, so you can see where the lines break before you publish.',
  },
  {
    icon: <StructureIcon />,
    title: 'Counts that match the platform',
    body: 'X counts codepoints, so styling is free. LinkedIn and Instagram count code units, so a styled word costs double. The meter knows the difference.',
  },
  {
    icon: <WarningIcon />,
    title: 'Told what styling costs',
    body: 'Letters a font cannot reach are highlighted, not silently dropped. Underline and strikethrough are flagged separately, because they are the riskiest of all.',
  },
  {
    icon: <ReadingIcon />,
    title: 'Structure and readability',
    body: 'Opening lines, lists, a closing link, and a Flesch–Kincaid grade computed on the plain text rather than the styled symbols.',
  },
  {
    icon: <CopyIcon />,
    title: 'Nothing leaves your browser',
    body: 'No account, no upload, no analytics on what you type. The formatting runs on your device and your draft is saved only in this browser.',
  },
];

const PLATFORMS = [
  { name: 'LinkedIn', limit: '3,000', note: 'Styling costs double here' },
  { name: 'X', limit: '280', note: 'Styling is free, the limit is tight' },
  { name: 'Instagram', limit: '2,200', note: 'Captions collapse early' },
  { name: 'Threads', limit: '500', note: 'Short limit, check before styling' },
];

export default function Home() {
  return (
    <main className="landing">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Local-first · Open source · v0.1</p>
          <h1>
            Unicode &ldquo;bold&rdquo; is <span className="underline-accent">not rich text</span>
          </h1>
          <p className="lede hero-lede">
            Every LinkedIn formatter swaps your letters for mathematical symbols. They look bold.
            They are not searchable, and a screen reader may read them out one symbol at a time.
            ProseEdge does the same formatting — and is the only one that shows you the cost.
          </p>
          <div className="cta-row">
            <Link href="/format" className="cta-primary">
              Format now
            </Link>
            <a href="#how" className="cta-secondary">
              How it works
            </a>
          </div>
          <p className="cta-note">No sign-up. Nothing you type is sent anywhere.</p>
        </div>

        <ul className="hero-specimen" aria-label="One sentence in each alphabet ProseEdge writes">
          {SPECIMEN.map(({ label, sample }) => (
            <li key={label}>
              <span className="hero-sample">{sample}</span>
              <span className="hero-tag">{label}</span>
            </li>
          ))}
          <li className="hero-plain">
            <span className="hero-sample">We’re hiring</span>
            <span className="hero-tag">Plain text</span>
          </li>
        </ul>
      </section>

      <section className="band" id="how" aria-labelledby="how-title">
        <h2 id="how-title">The trade nobody mentions</h2>
        <div className="compare">
          <article className="compare-card">
            <h3>What you paste</h3>
            <p className="compare-sample">𝗪𝗲&rsquo;𝗿𝗲 𝗵𝗶𝗿𝗶𝗻𝗴</p>
            <p className="compare-note">
              Six mathematical sans-serif bold characters. LinkedIn search will not match
              &ldquo;hiring&rdquo;, and on some devices they render as empty boxes.
            </p>
          </article>
          <article className="compare-card">
            <h3>What a screen reader may hear</h3>
            <p className="compare-sample compare-plain">
              mathematical sans-serif bold capital W, mathematical sans-serif bold small e&hellip;
            </p>
            <p className="compare-note">
              Or nothing at all, if the reader skips symbols it cannot name. The words are gone
              either way.
            </p>
          </article>
        </div>
        <p className="band-close">
          <CheckIcon />
          <span>
            ProseEdge keeps the plain text beside the styled version, counts what styling costs
            against the platform you are writing for, and tells you which characters it could not
            reach. Style deliberately, not by accident.
          </span>
        </p>
      </section>

      <section className="band" aria-labelledby="features-title">
        <h2 id="features-title">What you get</h2>
        <ul className="feature-grid">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="feature">
              <span className="feature-icon" aria-hidden="true">
                {feature.icon}
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="band" aria-labelledby="platforms-title">
        <h2 id="platforms-title">Written for where it is going</h2>
        <p className="band-lede">
          One editor, four targets. Switching target re-counts the post and re-lays the preview —
          the draft stays where it is.
        </p>
        <ul className="platform-grid">
          {PLATFORMS.map((platform) => (
            <li key={platform.name} className="platform-card">
              <span className="platform-name">{platform.name}</span>
              <span className="platform-limit">{platform.limit}</span>
              <span className="platform-note">{platform.note}</span>
            </li>
          ))}
        </ul>
        <p className="band-footnote">
          Published limits at the time of writing. Where counting behaviour has not been verified
          against the live product, the app says so rather than guessing quietly.
        </p>
      </section>

      <section className="closing" aria-labelledby="closing-title">
        <h2 id="closing-title">Write the post. Keep the words.</h2>
        <p className="lede">
          Free, open source under the AGPL, and it runs entirely on your device.
        </p>
        <Link href="/format" className="cta-primary">
          Format now
        </Link>
      </section>
    </main>
  );
}
