// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { describe, expect, it } from 'vitest';

import { FLAGS, deployEnvironment, flagsFor } from './flags';

describe('flags', () => {
  it('turns every flag on outside production and none that are unreleased in production', () => {
    for (const flag of FLAGS) {
      expect(flagsFor('preview')[flag]).toBe(true);
      expect(flagsFor('development')[flag]).toBe(true);
      expect(flagsFor('production')[flag]).toBe(false);
    }
  });

  it('treats an unknown or missing environment as production', () => {
    expect(deployEnvironment('preview')).toBe('preview');
    expect(deployEnvironment('development')).toBe('development');
    expect(deployEnvironment('production')).toBe('production');
    expect(deployEnvironment('staging')).toBe('production');
    expect(deployEnvironment(undefined)).toBe('production');
  });
});
