// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * The sample text the landing page animates, and the small amount of logic
 * that turns it into what each demo shows. Everything here goes through the
 * same `inStyle` the formatter uses, so a demo can never show a style the
 * editor would not produce.
 */

import { budget, PLATFORMS } from '../../analysis/platforms';
import type { PlatformId } from '../../analysis/platforms';
import { namedCount } from '../../analysis/transcript';
import { clusters } from '../../document';
import { inStyle, SPECIMENS } from '../specimens';
import type { Specimen } from '../specimens';

/** The styles the hero cycles through and offers as chips, in that order. */
export const SHOWCASE_IDS = [
  'sans_bold',
  'italic',
  'script',
  'fraktur',
  'doublestruck',
  'monospace',
] as const;
export type ShowcaseId = (typeof SHOWCASE_IDS)[number];

export function specimen(id: string): Specimen {
  const found = SPECIMENS.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no specimen ${id}`);
  return found;
}

export const SHOWCASE: readonly Specimen[] = SHOWCASE_IDS.map(specimen);

/** A short label for a chip: the specimen's own label, with "Sans bold" read simply as "Bold". */
export function chipLabel(spec: Specimen): string {
  return spec.id === 'sans_bold' ? 'Bold' : spec.label;
}

/** A post whose opening is styled and whose body is plain, as authors usually write them. */
export interface SamplePost {
  readonly lead: string;
  readonly body: string;
}

export const HERO_POST: SamplePost = {
  lead: 'We’re hiring',
  body: ' a product designer. Remote-friendly, apply by Friday.',
};

/** The post with its lead styled. */
export function styledPost(post: SamplePost, spec: Specimen): string {
  return inStyle(post.lead, spec) + post.body;
}

export function plainPost(post: SamplePost): string {
  return post.lead + post.body;
}

/** The facts each demo prints under the sample, computed rather than written down. */
export interface SampleFacts {
  readonly named: number;
  readonly letters: number;
  readonly linkedin: number;
  readonly linkedinCost: number;
  readonly x: number;
  readonly xCost: number;
}

export function sampleFacts(post: SamplePost, spec: Specimen): SampleFacts {
  const styled = styledPost(post, spec);
  const plain = plainPost(post);
  const on = (id: PlatformId) => budget(styled, plain, PLATFORMS[id]);
  return {
    named: namedCount(styled),
    letters: clusters(post.lead).length,
    linkedin: on('linkedin').used,
    linkedinCost: on('linkedin').styleCost,
    x: on('x').used,
    xCost: on('x').styleCost,
  };
}

/** The four feeds the meters compare, in the order the target selector lists them. */
export const METER_PLATFORMS = ['linkedin', 'x', 'instagram', 'threads'] as const;

/** A longer post, so the meters move by a visible amount. */
export const METER_POST: SamplePost = {
  lead: 'Three things I learned shipping an accessible editor',
  body: ': keep the plain text, count what styling costs, and say what you could not style. Most formatters do none of these. The fix is small and it changes who can read your post.',
};
