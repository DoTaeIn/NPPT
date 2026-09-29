# marco — MARCO Engine 명령줄 도구

`.marco.md` 강의 원고를 한 파일짜리 1920×1080 HTML 덱으로 빌드하고, 검사하고, PDF로 저장하고,
기존 HTML 덱을 원고로 가져오고, AI(채팅창 또는 API)로 원고를 쓰고 고칩니다.

> **English summary.** `marco` is the MARCO Engine CLI (`@marco/cli`, binary `apps/cli/dist/main.js`).
> `new` scaffolds a lecture, `build`/`watch` compile `.marco.md` → single-file HTML (`@marco/compiler`),
> `lint` checks format, budgets, refs and timing, `pdf` prints a deck with Playwright's Chromium
> (lecture: one 1920×1080 page per slide; handout: A4 thumbnails + notes), `import` converts a legacy
> V20 / v9.7 HTML deck into a source folder (`@marco/importer`), and `ai …` runs the `@marco/ai`
> authoring pipeline (outline → slides → notes → revise / repair); `mcp` serves the engine to AI
> apps as MCP tools over stdio (`@marco/mcp`). `marco ai` works without any
> network: by default every model call is a prompt file you paste into any chat window, and the
> command continues when you save the answer next to it. Set `MARCO_AI_BASE_URL` and
> `MARCO_AI_MODEL` to call an OpenAI-compatible endpoint instead. All messages are in Korean;
> exit code 0 = success, 1 = error.

## 설치와 실행

모노레포 안에서:

```bash
pnpm --filter @marco/cli build          # apps/cli/dist/main.js
node apps/cli/dist/main.js --help       # 또는 pnpm exec marco --help (bin: marco)
```

`build`는 `@marco/runtime`과 `@marco/design-system`의 `dist`를 덱에 넣습니다. 먼저
`pnpm -r build`로 모두 빌드해 두세요.

## 명령 한눈에 보기

| 명령                                   | 하는 일                                               |
| -------------------------------------- | ----------------------------------------------------- |
| `marco new <dir>`                      | 새 강의 폴더와 시작용 `lecture.marco.md`              |
| `marco build <file>`                   | 원고 → 한 파일짜리 HTML 덱                            |
| `marco watch <file>`                   | 바뀔 때마다 다시 빌드                                 |
| `marco lint <file>`                    | 형식 오류, 글자 예산, 출처, 시간 배분 검사            |
| `marco pdf <file>`                     | 덱을 PDF로 (강의용 1920×1080 · 유인물 A4)             |
| `marco import <legacy.html> <outDir>`  | 기존 HTML 덱(V20 · v9.7) → 원고 + 이미지 + 보고서     |
| `marco ai kit`                         | 채팅창에 붙여 넣을 작성 안내(키트)                    |
| `marco ai outline "<주제>" --course …` | 강의 개요                                             |
| `marco ai slides`                      | 개요 → 슬라이드 (묶음 단위)                           |
| `marco ai notes`                       | 슬라이드마다 해설(`## note`)                          |
| `marco ai revise <slide> "<요청>"`     | 슬라이드 하나 고치기                                  |
| `marco ai repair`                      | 린트 문제가 있는 슬라이드를 AI에게 고치게 하기        |
| `marco ai merge-notes <reply.md>`      | 채팅창에서 받은 해설을 원고에 합치기 (모델 호출 없음) |
| `marco mcp [--root <dir>]`             | AI 앱(Claude Desktop·Claude Code·Cursor)용 MCP 서버   |

모든 명령은 `-h, --help`로 옵션을 보여 줍니다. `marco -v`는 엔진 버전을 표시합니다.

## new

```bash
marco new week05 --title "5주차 · 방화벽" --course "보안시스템 운영 및 활용" --week 5 --theme cau-navy
```

| 옵션                | 설명                                                  |
| ------------------- | ----------------------------------------------------- |
| `<dir>`             | 만들 폴더 (`<dir>/lecture.marco.md`, `<dir>/assets/`) |
| `--title <title>`   | 강의 제목                                             |
| `--course <course>` | 과목명                                                |
| `--week <week>`     | 주차 (숫자, 기본 1)                                   |
| `--theme <theme>`   | `v20-violet` (기본) · `cau-navy`                      |
| `--force`           | 이미 있는 `lecture.marco.md`를 덮어씀                 |

## build · watch

```bash
marco build week05/lecture.marco.md                 # → week05/lecture.html
marco build week05/lecture.marco.md --edition student -o dist/week05-student.html
marco watch week05/lecture.marco.md                 # 끝내려면 Ctrl+C
```

| 옵션                  | 설명                                                                      |
| --------------------- | ------------------------------------------------------------------------- |
| `-o, --out <file>`    | 출력 HTML (기본: 원고 옆 `<이름>.html`)                                   |
| `--edition <edition>` | `instructor` (강의자용, 해설 포함) · `student` (학생용, 해설 없음)        |
| `--theme <theme>`     | `v20-violet` · `cau-navy` (머리말 `theme`보다 우선)                       |
| `--fonts <mode>`      | `subset` (기본, 쓰인 글자만) · `embed` (글꼴 전체) · `none` (시스템 글꼴) |
| `--keep-png`          | 색이 많은 PNG도 WebP로 바꾸지 않음                                        |
| `--strict`            | 린트 오류가 있으면 종료 코드 1                                            |
| `--verbose`           | 정보 수준 린트까지 표시                                                   |

오류가 있으면 `파일:줄  오류 [코드] 메시지`로 알려 주고 HTML을 쓰지 않습니다. 이미지는 최적화해
data URI로 넣습니다(`:::html` 블록과 `raw` 슬라이드의 `<img data-asset="id">`, `<img src="assets/…">`
포함). `watch`는 원고, 이미지, 머리말의 사이드카 JSON(`sims: sims.json` 등)을 감시합니다.

## lint

```bash
marco lint week05/lecture.marco.md
marco lint week05/lecture.marco.md --json > lint.json
```

| 옵션        | 설명                                                                |
| ----------- | ------------------------------------------------------------------- |
| `--json`    | 결과를 JSON으로 (`file`, `ok`, `diagnostics`, `lint`, `slideLines`) |
| `--verbose` | 정보 수준 항목까지 표시                                             |

문제는 슬라이드별로 묶어 `원고:줄`과 함께 보여 줍니다. 오류가 하나라도 있으면 종료 코드 1.

## pdf

```bash
marco pdf week05/lecture.marco.md                    # 빌드 → week05/lecture.html → week05/lecture.pdf
marco pdf week05/lecture.html --mode handout         # → week05/lecture.handout.pdf (A4)
marco pdf week05/lecture.marco.md --edition student -o out/week05-student.pdf
```

원고(`.marco.md`)를 주면 `marco build`와 같이 옆에 HTML을 만든 뒤 PDF를 만듭니다. 덱을 Playwright의
Chromium으로 열고(`file://`), 런타임이 준비되면(`html[data-marco="ready"]`) 런타임의 인쇄 모드
(`MARCO.print(mode)`, 인쇄 대화상자 없이)로 바꿔 저장합니다.

| 옵션                                            | 설명                                                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `--mode <mode>`                                 | `lecture` (기본): 슬라이드 한 장당 1920×1080 한 쪽 · `handout`: A4 유인물(슬라이드 축소판 + 해설 전문, 끝에 용어) |
| `-o, --out <file>`                              | PDF 경로 (기본: 입력 옆 `<이름>.pdf`, 유인물은 `<이름>.handout.pdf`)                                              |
| `--edition`, `--theme`, `--fonts`, `--keep-png` | 원고를 빌드할 때만 쓰는 빌드 옵션                                                                                 |
| `--timeout <sec>`                               | 런타임 준비를 기다리는 최대 초 (기본 60)                                                                          |

Chromium이 필요합니다. 없으면 설치 방법을 안내하고 종료 코드 1로 끝납니다:
`pnpm exec playwright install chromium` (이미 설치했다면 `PLAYWRIGHT_BROWSERS_PATH`가 그 폴더를
가리키는지 확인). 예: `examples/week03-iam`은 강의용 40쪽, 유인물 41쪽(용어 1쪽 포함)입니다.

## import

```bash
marco import reference/decks/week03-iam-v20.html examples/week03-iam
marco import old/week05.html week05 --family v97
marco import old/week05.html week05 --keep-source     # 손본 원고는 그대로 두고 이미지·보고서만 다시
```

| 옵션                | 설명                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `<legacy.html>`     | 가져올 한 파일짜리 HTML 덱                                                                                       |
| `<outDir>`          | 출력 폴더: `lecture.marco.md`, `assets/`, `assets.manifest.json`, `IMPORT-REPORT.md`, 큰 데이터는 `sims.json` 등 |
| `--family <family>` | `auto` (기본, 자동 판별) · `v20` · `v97`                                                                         |
| `--keep-source`     | 이미 있는 `lecture.marco.md`를 덮어쓰지 않음                                                                     |
| `--asset-dir <dir>` | 이미지 폴더 이름 (기본 `assets`)                                                                                 |

끝나면 슬라이드 수, 블록 수와 컴포넌트로 옮긴 비율, `html`로 남은 블록 수, 이미지 수를 보여
줍니다. 자세한 내용은 `IMPORT-REPORT.md`에 있습니다.

## ai

`@marco/ai`의 작성 파이프라인입니다(`packages/ai/README.md`). 모델을 부르는 방법은 두 가지입니다.

- **수동 모드 (기본, 네트워크 없음).** 호출마다 `.marco/ai/NN-이름.prompt.md`를 쓰고 그 위치를
  알려 준 뒤, 같은 번호의 `NN-이름.reply.md`가 저장될 때까지 기다립니다. 새 채팅이면 먼저
  `.marco/ai/kit.md`(작성 안내) 전체를 붙여 넣고, 프롬프트 파일을 붙여 넣은 다음, 답 전체를 reply
  파일로 저장하세요. 같은 명령을 다시 실행하면 이미 저장된 답을 이어서 씁니다(프롬프트가 바뀐 답은
  `.old`로 옮김).
- **API 모드.** `MARCO_AI_BASE_URL`과 `MARCO_AI_MODEL`이 설정되어 있으면 OpenAI 호환
  `/v1/chat/completions`로 보냅니다(`MARCO_AI_API_KEY`는 필요한 서버만). 예:
  `MARCO_AI_BASE_URL=http://localhost:11434 MARCO_AI_MODEL=qwen2.5 marco ai outline …`

모델을 부르는 명령(`outline`, `slides`, `notes`, `revise`, `repair`)의 공통 옵션:

| 옵션                | 설명                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| `--provider <mode>` | `auto` (기본: 두 환경 변수가 있으면 api, 없으면 manual) · `manual` · `api` |
| `--dir <dir>`       | 수동 모드의 프롬프트·답 폴더 (기본 `.marco/ai`)                            |
| `--timeout <sec>`   | 수동 모드에서 답을 기다리는 최대 초 (기본 0 = 계속 기다림)                 |

끝나면 호출 횟수와 글자 수(토큰은 글자 수 ÷ 2.5로 추정)를 보여 주고, 원고를 쓴 경우 린트 요약을
덧붙입니다. 원고를 고치는 명령(`notes`, `revise`, `repair`, `merge-notes`)은 `-o`가 없으면 원고를
직접 고치고 이전 내용을 `<원고>.bak`에 남깁니다. `outline`과 `slides`는 있는 파일을 `--force`
없이 덮어쓰지 않습니다(모델을 부르기 전에 확인).

### ai kit

```bash
marco ai kit                 # → .marco/ai/kit/MARCO-작성-안내.md + 과제 프롬프트(10-개요.md …)
marco ai kit --print | pbcopy
```

| 옵션              | 설명                             |
| ----------------- | -------------------------------- |
| `-o, --out <dir>` | 출력 폴더 (기본 `.marco/ai/kit`) |
| `--print`         | 키트 본문을 표준 출력으로        |

### ai outline

```bash
marco ai outline "물리보안과 출입통제" --course "보안시스템 운영 및 활용" --week 3 --duration 150 \
  --audience "산업보안학과 2학년"
```

| 옵션                | 설명                           |
| ------------------- | ------------------------------ |
| `<topic>`           | 강의 주제                      |
| `--course <course>` | 과목명 (필수)                  |
| `--week <week>`     | 주차                           |
| `--duration <min>`  | 강의 시간(분, 기본 150)        |
| `--audience <text>` | 수강생 설명                    |
| `--request <text>`  | 추가 요청                      |
| `-o, --out <file>`  | 개요 파일 (기본 `outline.txt`) |
| `--force`           | 있는 파일을 덮어씀             |

결과는 `번호 | 태그 | 제목 | 한 줄 의도 | 분` 줄입니다. 슬라이드 수(30–45)와 분 합계가 맞지 않으면
경고합니다.

### ai slides

```bash
marco ai slides --outline outline.txt --batch 6
marco ai slides --range 7-12 -o part2.marco.md --front-matter lecture.marco.md
```

| 옵션                    | 설명                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `--outline <file>`      | 개요 파일 (기본 `outline.txt`)                                                         |
| `--batch <n>`           | 한 번에 쓸 슬라이드 수 (기본 6; 40장이면 7번 호출)                                     |
| `--range <from-to>`     | 쓸 범위, 예 `7-12` (기본 전체)                                                         |
| `--refs <file>`         | 인용할 출처: 원고를 주면 그 머리말의 `refs:`를, 아니면 파일 내용을 그대로              |
| `--front-matter <file>` | 결과 앞에 붙일 머리말 (원고 또는 YAML). 없으면 개요의 표지 제목으로 최소 머리말을 만듦 |
| `--request <text>`      | 묶음마다 덧붙일 요청                                                                   |
| `-o, --out <file>`      | 출력 원고 (기본 `lecture.marco.md`)                                                    |
| `--force`               | 있는 파일을 덮어씀                                                                     |

### ai notes

```bash
marco ai notes --slides 1-43 --outline outline.txt
marco ai notes --deck week03/lecture.marco.md --slides 5,7,s-12 --cpm 380
```

| 옵션               | 설명                                                             |
| ------------------ | ---------------------------------------------------------------- |
| `--deck <file>`    | 원고 (기본 `lecture.marco.md`)                                   |
| `--slides <list>`  | 대상: `1-43`, `3,5,7-9`, 슬라이드 id도 가능 (기본 전체)          |
| `--outline <file>` | `[시간]` 범위를 가져올 개요 (없으면 슬라이드의 `time:`에서 계산) |
| `--cpm <n>`        | 1분에 말하는 글자 수 (기본 350)                                  |
| `--request <text>` | 슬라이드마다 덧붙일 요청                                         |
| `-o, --out <file>` | 결과 원고 (기본: 원고를 고치고 `.bak`을 남김)                    |

슬라이드마다 한 번씩 호출하고, 답의 `## note`로 그 슬라이드의 해설을 바꿉니다.

### ai revise

```bash
marco ai revise 12 "카드를 세 장으로 줄이고 질문 줄을 넣어 줘"
marco ai revise principle-chain "용어를 쉽게"
```

| 옵션               | 설명                                          |
| ------------------ | --------------------------------------------- |
| `<slide>`          | 슬라이드 번호(1부터) 또는 id                  |
| `<request>`        | 고칠 내용                                     |
| `--deck <file>`    | 원고 (기본 `lecture.marco.md`)                |
| `-o, --out <file>` | 결과 원고 (기본: 원고를 고치고 `.bak`을 남김) |

그 슬라이드의 린트 결과(글자 예산, 출처 …)를 함께 보냅니다. 답의 첫 슬라이드로 바꿉니다.

### ai repair

```bash
marco ai repair
marco ai repair --level error
```

| 옵션               | 설명                                             |
| ------------------ | ------------------------------------------------ |
| `--deck <file>`    | 원고 (기본 `lecture.marco.md`)                   |
| `--level <level>`  | 이 수준 이상만: `warn` (기본) · `error` · `info` |
| `-o, --out <file>` | 결과 원고 (기본: 원고를 고치고 `.bak`을 남김)    |

린트 문제가 있는 슬라이드마다 그 문제만 담아 한 번씩 보냅니다. 고칠 것이 없으면 모델을 부르지
않습니다.

### ai merge-notes

```bash
marco ai merge-notes reply.md                  # 답에 '# slide …' + '## note'가 여러 개 있을 때
marco ai merge-notes reply.md --slide 7        # 답이 '## note' 하나뿐일 때
```

| 옵션               | 설명                                                   |
| ------------------ | ------------------------------------------------------ |
| `<reply>`          | 채팅창에서 받은 답을 저장한 파일                       |
| `--deck <file>`    | 원고 (기본 `lecture.marco.md`)                         |
| `--slide <slide>`  | 답에 `# slide` 줄이 없을 때 대상 슬라이드 번호 또는 id |
| `-o, --out <file>` | 결과 원고 (기본: 원고를 고치고 `.bak`을 남김)          |

슬라이드는 명시한 id(`# slide id=…`), 그다음 똑같은 머리줄로 찾습니다. `[시간]`이 있는 해설을
합치면 그 슬라이드의 `time:` 필드는 지웁니다.

## mcp

```bash
marco mcp --root ~/lectures              # stdin/stdout으로 MCP 서버 실행 (AI 앱이 띄움)
marco mcp --root ~/lectures --read-only  # 파일을 쓰지 않고 점검만
```

AI 앱이 `marco_build`, `marco_lint`, `marco_check_slide`, `marco_new`, `marco_import` 같은 도구로
엔진을 직접 부르게 하는 MCP 서버(`@marco/mcp`)를 이 프로세스 안에서 실행합니다. `marco-mcp` 명령과
같은 서버입니다. stdout은 프로토콜 전용이라 상태 메시지는 stderr로만 나옵니다.

| 옵션            | 설명                                                                         |
| --------------- | ---------------------------------------------------------------------------- |
| `--root <dir>`  | 도구가 읽고 쓸 수 있는 폴더 (기본: 현재 폴더, `~` 확장, 없으면 만듦)         |
| `--allow-write` | 루트 안에 쓰기 허용 (기본값)                                                 |
| `--read-only`   | 새 강의·저장·가져오기를 거부하고, 빌드는 HTML을 쓰지 않고 검사 결과만 돌려줌 |

AI 앱 설정 방법과 대화 예시는 [docs/guide-ko/mcp.md](../../docs/guide-ko/mcp.md), 도구 목록과 결과
형식은 [packages/mcp/README.md](../../packages/mcp/README.md)에 있습니다. `@marco/mcp`를
먼저 빌드해야 합니다(`pnpm --filter @marco/mcp build`).

## 환경 변수

| 변수                       | 쓰임                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------ |
| `MARCO_AI_BASE_URL`        | `marco ai` API 모드의 주소 (`https://api.openai.com/v1`, `http://localhost:11434` …) |
| `MARCO_AI_MODEL`           | API 모드의 모델 이름                                                                 |
| `MARCO_AI_API_KEY`         | API 키 (로컬 서버는 보통 필요 없음)                                                  |
| `PLAYWRIGHT_BROWSERS_PATH` | `marco pdf`가 쓸 Chromium 설치 폴더                                                  |
| `NO_COLOR` / `FORCE_COLOR` | 색 끄기 / 켜기                                                                       |

## 프로그램에서 쓰기

`@marco/cli`는 `runCli(argv, io)`(종료 코드를 돌려줌)와 각 명령 함수(`runBuild`, `runWatch`,
`runLint`, `runNew`, `runPdf`, `runImportCommand`, `makeProvider` …)를 내보냅니다. `io`
(`CliIo`)로 출력, 작업 폴더, 환경 변수를 바꿀 수 있어 테스트에서 씁니다.

## 테스트

```bash
pnpm --filter @marco/cli test
```

`import` 테스트는 `reference/decks/week03-iam-v20.stripped.html`이 있을 때만, `pdf` 테스트는
Chromium이 있을 때만 실행합니다. `ai` 테스트는 수동 모드의 답 파일을 미리 저장해 두므로 네트워크를
쓰지 않습니다.
