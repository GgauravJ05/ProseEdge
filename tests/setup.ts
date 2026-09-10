// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * Property-test budget. Pull requests run the default; the nightly workflow
 * raises FC_NUM_RUNS by two orders of magnitude. A failing run prints its seed;
 * replay it locally with FC_SEED=<seed> (and FC_PATH=<path> to skip shrinking).
 */

import fc from 'fast-check';

const env = process.env;

fc.configureGlobal({
  numRuns: Number(env.FC_NUM_RUNS ?? '200'),
  ...(env.FC_SEED === undefined ? {} : { seed: Number(env.FC_SEED) }),
  ...(env.FC_PATH === undefined ? {} : { path: env.FC_PATH }),
});
