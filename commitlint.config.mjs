export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 기존 기록의 'init' 타입 허용
    'type-enum': [
      2,
      'always',
      [
        'init',
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'test',
        'chore',
        'build',
        'ci',
        'perf',
        'revert',
      ],
    ],
    // 한국어 제목이라 대소문자 규칙은 끔
    'subject-case': [0],
  },
};
