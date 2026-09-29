# 빠른 시작: 설치부터 첫 강의 덱까지

이 안내 하나로 설치, 새 강의 만들기, AI 채팅으로 내용 받기, 빌드와 점검, 발표와 인쇄, 예전 덱 옮기기까지 해 봅니다. 명령은 모두 터미널(Windows는 PowerShell, macOS는 터미널 앱)에 입력합니다.

```
설치(한 번) → marco new → 채팅에 작성 안내 붙여 넣기 → 답을 lecture.marco.md에 저장
          → marco build → marco lint → HTML 열어 발표 → 인쇄·PDF
```

AI 채팅을 쓰는 자세한 요령(개요 → 6장씩 본문 → 해설 → 린트로 고치기)은 [AI 채팅으로 강의 슬라이드 쓰기](ai-workflow.md)에 있습니다.

## 1. 한 번만: 설치

### Node.js와 pnpm

1. [nodejs.org](https://nodejs.org)에서 **Node.js 22 (LTS)** 를 내려받아 설치합니다.
2. 터미널을 새로 열고 확인합니다.

   ```
   node --version
   ```

   `v22.`로 시작하면 됩니다.

3. pnpm을 켭니다. Node.js에 들어 있는 corepack이 저장소가 정한 pnpm 버전을 알아서 받습니다.

   ```
   corepack enable
   pnpm --version
   ```

   `10.`으로 시작하면 됩니다. `corepack enable`이 권한 오류를 내면 Windows는 PowerShell을 "관리자 권한으로 실행"해서, macOS는 `sudo corepack enable`로 한 번 실행합니다. 그래도 안 되면 `npm install -g pnpm`으로 설치해도 됩니다.

### NPPT 받기와 빌드

NPPT 폴더(저장소)를 받아 둔 곳으로 이동해 의존성을 설치하고 전체를 빌드합니다.

```
cd NPPT
pnpm install
pnpm build
```

`pnpm build`가 엔진, 디자인, `marco` 명령, AI 작성 안내(`packages/ai/dist/kit/`)를 모두 만듭니다. NPPT를 새 버전으로 바꾼 뒤에도 이 두 줄을 다시 실행합니다. (macOS 터미널에서는 `pnpm install && pnpm build` 한 줄로 써도 됩니다.)

### `marco` 명령 연결

어느 폴더에서나 `marco`라고 칠 수 있게 연결합니다. 처음 한 번 `pnpm setup`을 실행하고 터미널을 새로 연 뒤:

```
cd apps/cli
pnpm link --global
marco --version
```

버전 번호가 나오면 준비가 끝났습니다.

연결이 잘 안 되면 연결 없이 써도 됩니다. 아래의 모든 `marco …`는 `node <NPPT 폴더>/apps/cli/dist/main.js …`와 같습니다. 예: `node C:\Users\me\NPPT\apps\cli\dist\main.js build lecture.marco.md`.

## 2. 새 강의 만들기: `marco new`

강의 폴더를 둘 곳(예: 문서 폴더)으로 이동해 만듭니다.

```
marco new week06 --title "6주차 · IDS/IPS" --course "보안시스템 운영 및 활용" --week 6 --theme cau-navy
```

- `week06/lecture.marco.md`: 강의 원고. 맨 위 `---` 사이가 머리말(front matter)이고, 그 아래에 연습용 슬라이드 몇 장이 들어 있습니다.
- `week06/assets/`: 이미지를 넣는 폴더. 쓰는 법은 그 안의 `README.md`에 있습니다.
- 옵션은 모두 생략할 수 있습니다. 테마는 `v20-violet`(기본) 또는 `cau-navy`입니다. 이미 있는 원고를 덮어쓰려면 `--force`.

머리말을 먼저 채웁니다: `title`, `course`, `week`, `date`, `presenter`, 강의 시간 `duration`(분), 그리고 인용할 출처 `refs`(id마다 실제 제목과 주소). AI는 이 목록의 id(`S01`)로만 출처를 인용합니다.

## 3. AI 채팅으로 내용 받기

1. 쓰시는 AI 채팅(ChatGPT, Claude, Gemini 등)에서 **새 채팅**을 엽니다.
2. `packages/ai/dist/kit/MARCO-작성-안내.md` 파일 전체를 복사해 붙여 넣습니다. AI가 "준비됨"이라고만 답합니다. 이 안내는 채팅마다 한 번이면 됩니다(약 1만 4천 자).
3. 같은 폴더의 요청문을 채워 붙여 넣습니다: 개요는 `10-개요.md`, 슬라이드 본문은 `20-슬라이드.md`(6장씩), 해설은 `30-해설.md`, 한 장 고치기는 `40-수정.md`.
4. 답은 코드 펜스(` ````marco `로 시작해 ` ```` `로 끝나는 부분) 하나로 옵니다.

### 답을 `lecture.marco.md`로 저장하기

- `lecture.marco.md`를 메모장이나 VS Code 같은 편집기로 엽니다(UTF-8로 저장).
- 맨 위 머리말(`---`부터 `---`까지)은 **그대로 두고**, 그 아래 연습용 슬라이드는 지웁니다.
- 받은 답에서 펜스 **안쪽만** 복사해 머리말 아래에 붙입니다. ` ````marco `와 ` ```` ` 줄은 빼고, 다음 답은 맨 아래에 이어 붙입니다.
- `# slide`로 시작하는 줄이 슬라이드 하나의 시작입니다. 이 줄은 반드시 줄 맨 앞에 있어야 합니다.

## 4. 빌드: `marco build`

```
marco build week06/lecture.marco.md
```

원고 옆에 `week06/lecture.html`이 생깁니다. 글꼴·이미지·엔진이 모두 들어 있는 한 파일이라 이 파일만 옮기거나 올리면 됩니다.

| 옵션                                | 뜻                                                    |
| ----------------------------------- | ----------------------------------------------------- |
| `--edition instructor`              | 강사용: 해설 포함(머리말 `edition`보다 우선)          |
| `--edition student`                 | 학생용: 해설 없음                                     |
| `-o 파일.html`                      | 출력 파일 이름                                        |
| `--theme cau-navy`                  | 테마 바꾸기(머리말 `theme`보다 우선)                  |
| `--fonts subset` / `embed` / `none` | 글꼴: 쓴 글자만(기본) · 전체 · 넣지 않음(시스템 글꼴) |
| `--keep-png`                        | 색이 많은 PNG도 WebP로 바꾸지 않음                    |
| `--strict`                          | 린트 오류가 있으면 실패로 끝냄                        |

원고를 고치면서 계속 보려면 `marco watch week06/lecture.marco.md`를 켜 둡니다. 원고나 이미지를 저장할 때마다 다시 빌드합니다(끝내려면 Ctrl+C).

빌드가 `파일:줄 오류 [format.…]`을 내면 그 줄의 문법 문제입니다(`:::` 짝이 안 맞음, `# slide`가 줄 맨 앞이 아님 등). 이때는 HTML이 만들어지지 않습니다.

## 5. 점검: `marco lint`

```
marco lint week06/lecture.marco.md
```

슬라이드별로 문제를 모아 보여 줍니다: 글자 수 초과(`budget.*`), 화면 높이를 넘칠 듯한 슬라이드(`budget.slide.dense`), 칸 수가 안 맞는 표(`table.ragged`), 없는 출처·이미지(`ref.missing`, `asset.missing`), 해설 표시 오타, `[시간]` 합계(`time.total`).

- **오류**가 있으면 종료 코드 1로 끝납니다. **경고**는 고치는 것이 좋지만 빌드는 됩니다.
- `--verbose`를 붙이면 정보 수준까지 봅니다. AI가 확신하지 못해 남긴 `TODO:`(`content.todo`)도 여기서 모두 보입니다. 사실을 확인해 직접 채우세요.
- 고치는 방법: 그 슬라이드 한 장과 린트 줄만 `40-수정.md`에 붙여 AI에게 보냅니다. 자세한 표는 [AI 채팅으로 강의 슬라이드 쓰기](ai-workflow.md)의 5단계에 있습니다.

## 6. HTML 열어 발표하기

`lecture.html`을 더블클릭하면 브라우저(Chrome, Edge 권장)에서 열립니다. 인터넷이 없어도 되지만 YouTube 영상 버튼은 인터넷이 필요합니다.

| 키                         | 동작                             |
| -------------------------- | -------------------------------- |
| `→` `↓` `Space` `PageDown` | 다음 슬라이드                    |
| `←` `↑` `PageUp`           | 이전 슬라이드                    |
| `Home` / `End`             | 처음 / 끝                        |
| `F`                        | 전체 화면                        |
| `N`                        | 해설 창(강사용 판에서만)         |
| `M`                        | 목차                             |
| `/`                        | 검색                             |
| `P` · `L` · `E` · `C`      | 펜 · 레이저 · 지우개 · 모두 지움 |
| `?` 또는 `H`               | 도움말(모든 단축키)              |

## 7. 인쇄와 PDF

덱 안에 인쇄 모드가 두 가지 있습니다. 인쇄 창에서 대상(프린터)을 **PDF로 저장**으로 고르면 PDF가 됩니다. 색이 빠지면 인쇄 창의 "배경 그래픽"을 켭니다.

| 키                           | 모드   | 결과                                                      |
| ---------------------------- | ------ | --------------------------------------------------------- |
| `Ctrl+P` (macOS `⌘P`)        | 강의용 | 한 쪽에 슬라이드 한 장(1920×1080), 펜 자국·해설 없음      |
| `Ctrl+Shift+P` (macOS `⌘⇧P`) | 유인물 | A4 세로, 슬라이드 축소판과 그 슬라이드의 해설 전문·용어표 |

학생용 판(`--edition student`)의 유인물에는 해설 대신 빈 메모 칸이 들어갑니다.

### `marco pdf`

같은 두 모드를 명령 한 줄로 PDF 파일로 만듭니다. `marco pdf lecture.marco.md`는 강의용(슬라이드 한 장당 1920×1080 한 쪽), `marco pdf lecture.marco.md --mode handout`은 A4 유인물입니다. `-o`로 파일 이름을 정하고, 원고를 주면 먼저 빌드합니다. Chromium이 필요하며 없으면 안내 메시지가 나옵니다. 그때는 위의 브라우저 인쇄로 같은 PDF를 얻습니다.

## 8. 예전 HTML 덱 옮기기: `marco import`

지금까지 쓰신 단일 HTML 덱(V20, v9.7 형식)을 MARCO 원고로 바꿉니다.

```
marco import 예전덱.html week05
```

출력 폴더(`week05`)에 다음이 생깁니다.

- `lecture.marco.md`: 옮긴 원고. 해설(`[대사]` 등)은 쓰시던 표시 그대로 옮겨집니다.
- `assets/`: 덱 안에 들어 있던 이미지 파일
- `assets.manifest.json`: 이미지 목록과 출처·크기
- `IMPORT-REPORT.md`: 몇 %가 컴포넌트로 옮겨졌는지, 옮기지 못해 HTML 조각(`:::html`)으로 남은 곳이 어디인지
- 덱에 시뮬레이터 데이터가 있으면 `sims.json` 같은 보조 파일

덱 형식(V20 / v9.7)은 자동으로 알아냅니다. 옮긴 뒤 `marco lint`로 확인하고, `IMPORT-REPORT.md`가 가리키는 `:::html` 조각은 천천히 컴포넌트로 바꿉니다. 이 명령도 연결 작업 중이라 옵션은 `marco import --help`로 확인하세요. 그 전까지는 NPPT 폴더에서 같은 일을 이렇게 합니다.

```
pnpm --filter @marco/importer exec tsx scripts/import.ts 예전덱.html week05
```

이미 손본 `lecture.marco.md`를 덮어쓰지 않고 이미지와 보고서만 다시 만들려면 끝에 `--keep-source`를 붙입니다.

## 9. 자동화(선택): `marco ai`

API 키가 있거나 채팅 답을 파일로 주고받고 싶으면 같은 요청문을 명령으로 보냅니다.

```
marco ai kit
marco ai outline "6주차 · IDS/IPS" --course "보안시스템 운영 및 활용" --week 6 --duration 150
marco ai slides --batch 6
marco ai notes --slides 1-43
marco ai revise 12 "표를 3열로 줄이고 예시를 하나 추가"
marco ai repair
```

- `--provider manual`(기본): API 없이 `.marco/ai/` 폴더에 요청문 파일을 만들고, 채팅 답을 짝이 되는 `.reply.md` 파일로 저장하면 이어서 진행합니다.
- `--provider api`: 환경 변수 `MARCO_AI_BASE_URL`, `MARCO_AI_MODEL`, `MARCO_AI_API_KEY`로 OpenAI 호환 API를 씁니다.
- 해설 분량은 `marco ai notes --cpm 900`처럼 바꿉니다. 350자와 900자 중 고르는 법은 [ai-workflow.md](ai-workflow.md)의 "해설 분량 고르기"에 있습니다.

## 막힐 때

- **`marco`를 찾을 수 없다고 나올 때**: 1장의 "`marco` 명령 연결"을 다시 하거나, `node <NPPT 폴더>/apps/cli/dist/main.js`로 실행합니다.
- **한글이 깨질 때**: 원고를 UTF-8로 저장했는지 확인합니다.
- **빌드는 되는데 슬라이드가 넘칠 때**: `marco lint`의 `budget.slide.dense`와 `budget.*` 경고부터 고칩니다.
- **명령 도움말**: `marco --help`, `marco build --help`처럼 `--help`를 붙입니다.
