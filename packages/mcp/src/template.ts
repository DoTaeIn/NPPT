/**
 * Starter deck for `marco_new`: a copy of apps/cli/templates (the `marco new` template), embedded
 * so the server also works when bundled into one file. test/template.test.ts keeps the copies equal.
 */

/** apps/cli/templates/lecture.marco.md */
export const LECTURE_TEMPLATE = `---
title: {{title}}
course: {{course}}
week: {{week}}
date: {{date}}
presenter: 담당 교수
theme: {{theme}}
edition: instructor
duration: 20
refs:
  S01: { title: "참고 문헌 제목을 적으세요", url: "https://example.com", kind: article }
terms:
  IAM: Identity and Access Management 신원 및 접근 관리
---

# slide cover
group: 도입
subtitle: 한 줄로 이번 강의의 목표를 적습니다
time: 1분 · 0:00 – 1:00
note: |
  [대사] {{auto}} 오늘 강의에서 다룰 내용을 소개합니다.

# slide
tag: 기본 개념
group: 도입
title: 핵심 개념을 한 문장으로 적는다
question: 학생이 스스로 답해 볼 질문은 무엇인가?
refs: [S01]

### 이 슬라이드에서 전달할 한 줄 요약

:::cards cols=2
- kicker: 첫째
  title: 카드 제목
  body: 두 칸 카드의 본문은 90자 안쪽으로 짧게 적습니다.
  icon: lightbulb
- kicker: 둘째
  title: 다른 관점
  body: IAM 같은 약어는 머리말 terms에 적으면 툴팁이 붙습니다.
  icon: shield-check
  tone: ok
:::

:::takeaway 핵심
한 문장으로 정리한 결론을 적습니다.
:::

## note
[시간] 3분 · 1:00 – 4:00
[화면] 위 요약 문장, 가운데 카드 두 장, 아래 결론 띠.
[대사] {{auto}} 먼저 핵심 개념을 짚어 보겠습니다.
[주목] @s-02-b2 두 카드를 왼쪽부터 차례로 가리킨다.
[발문] 두 관점은 무엇이 다를까요? | 10초
[전환] 다음 슬라이드에서 절차를 봅니다.

# slide
tag: 절차
group: 본론
title: 절차는 번호 목록으로, 비교는 표로 정리한다

1. **준비** 필요한 자료와 권한을 확인한다
2. **실행** 정해진 순서대로 진행한다
3. **확인** 결과와 기록을 점검한다

| 항목 | 방법 A | 방법 B |
|---|:-:|:-:|
| 속도 | 빠름 | 보통 |
| 비용 | 높음 | 낮음 |

:::callout warn 주의
예외 상황과 안전 수칙을 짧게 적습니다.
:::

## note
[시간] 3분 · 4:00 – 7:00
[대사] {{auto}} 절차를 세 단계로 나눠 보겠습니다.
[주목] @s-03-b2 표의 두 열을 비교한다.
[팁] 표는 8행·6열, 칸마다 40자 안쪽으로 유지합니다.
[전환] 마지막으로 참고 자료를 안내합니다.

# slide references
title: 참고 자료
`;

/** apps/cli/templates/assets/README.md */
export const ASSETS_README = `# assets

강의에 쓰는 이미지를 이 폴더에 넣습니다. \`marco build\`가 이미지를 최적화해
HTML 한 파일 안에 넣으므로, 이 폴더를 따로 배포할 필요는 없습니다.

## 본문에서 바로 쓰기

\`\`\`markdown
![이미지 설명(대체 텍스트)](assets/campus.png '그림 아래 캡션')
\`\`\`

파일 이름에서 자산 id(\`campus\`)가 자동으로 만들어집니다.

## 출처와 함께 쓰기

머리말(front matter)의 \`assets\`에 제목·출처를 적으면 덱의 "이미지·영상 출처" 창에 표시됩니다.

\`\`\`yaml
assets:
  campus:
    path: assets/campus.png
    title: 캠퍼스 전경
    credit: 촬영 홍길동
    source: https://example.com/original
    alt: 캠퍼스 정문과 본관
\`\`\`

본문에서는 \`:::image asset=campus caption="캡션" zoom\` 으로 불러옵니다.

- 1920×1080보다 큰 이미지는 자동으로 줄어듭니다.
- JPEG는 품질 82로, 색이 많은 PNG는 WebP로 바뀝니다(\`--keep-png\`로 PNG 유지).
- 투명 배경이 있거나 256색 이하인 PNG는 PNG로 남습니다.
`;
