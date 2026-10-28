// 본문 줄 수 계산: 제목 다음 줄부터, 빈 줄·주석(#)은 제외.
// 마지막 문단이 전부 알려진 git 트레일러(Co-Authored-By: 등)면 제외한다.
// (`NoteEditor: ...` 처럼 콜론으로 시작하는 일반 본문 줄은 센다)
const TRAILER =
  /^(Co-authored-by|Signed-off-by|Reviewed-by|Acked-by|Tested-by|Reported-by|Refs?|Closes|Fixes|Resolves): /i;
const countBodyLines = (raw = '') => {
  const lines = raw
    .split('\n')
    .slice(1)
    .filter((line) => !line.startsWith('#'))
    .map((line) => line.trim());
  const paragraphs = lines
    .join('\n')
    .split(/\n\s*\n/)
    .map((p) => p.split('\n').filter(Boolean))
    .filter((p) => p.length > 0);
  const last = paragraphs.at(-1);
  if (last?.every((line) => TRAILER.test(line))) paragraphs.pop();
  return paragraphs.flat().length;
};

export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'body-min-lines': (parsed, _when, min) => {
          const count = countBodyLines(parsed.raw);
          return [count >= min, `본문은 최소 ${min}줄 이상 작성해야 합니다 (현재 ${count}줄)`];
        },
      },
    },
  ],
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
    // 제목 72자 이내
    'header-max-length': [2, 'always', 72],
    // 제목과 본문 사이 빈 줄 필수, 본문 최소 2줄 (트레일러 제외)
    'body-leading-blank': [2, 'always'],
    'body-min-lines': [2, 'always', 2],
  },
};
