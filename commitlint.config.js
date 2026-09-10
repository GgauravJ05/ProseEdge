export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'document',
        'analysis',
        'runtime',
        'ui',
        'app',
        'training',
        'eval',
        'bench',
        'docs',
        'ci',
        'deps',
      ],
    ],
  },
};
