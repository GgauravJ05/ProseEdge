// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * Build-time feature flags (ADR 0007). The app is a static export with no
 * server, so a flag is decided when the site is built: every flag is on in
 * previews and local development, and production turns on only released ones.
 * Delete a flag, and its checks, in the PR after its feature ships.
 */

export const FLAGS = [
  /** "…see more" fold preview (roadmap M2), until the platform's fold rule is measured. */
  'foldPreview',
] as const;
export type Flag = (typeof FLAGS)[number];

/** Flags enabled in production. */
const RELEASED: ReadonlySet<Flag> = new Set<Flag>();

export type DeployEnvironment = 'production' | 'preview' | 'development';

/** Anything unrecognised is treated as production, so a misconfigured build ships less, not more. */
export function deployEnvironment(value: string | undefined): DeployEnvironment {
  return value === 'preview' || value === 'development' ? value : 'production';
}

export function flagsFor(environment: DeployEnvironment): Readonly<Record<Flag, boolean>> {
  const entries = FLAGS.map((flag) => [flag, environment !== 'production' || RELEASED.has(flag)]);
  return Object.fromEntries(entries) as Record<Flag, boolean>;
}

// Inlined at build time from next.config.ts.
export const flags = flagsFor(deployEnvironment(process.env.NEXT_PUBLIC_DEPLOY_ENV));
