// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import type { Config } from 'tailwindcss';

// Colours, fonts and gradients all resolve to the CSS custom properties in
// globals.css, so a Tailwind utility (`bg-surface`, `text-accent`) and a plain
// CSS rule (`background: var(--surface)`) always agree — there is one source
// of truth for the palette, not two that can drift apart.
//
// Theme switching reads `data-theme` on <html> (src/ui/theme.ts), not a class,
// so Tailwind's dark: variant is wired to that attribute instead of `.dark`.
const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        'surface-sunken': 'var(--surface-sunken)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          ink: 'var(--accent-ink)',
          soft: 'var(--accent-soft)',
        },
        mark: 'var(--mark)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
      },
      backgroundImage: {
        'gradient-aurora': 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)',
        'gradient-surface': 'linear-gradient(180deg, var(--surface) 0%, var(--paper) 100%)',
        'gradient-radial-accent':
          'radial-gradient(circle at top left, var(--accent-soft), transparent 60%)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'var(--radius-sm)',
      },
      boxShadow: {
        DEFAULT: 'var(--shadow)',
      },
    },
  },
};

export default config;
