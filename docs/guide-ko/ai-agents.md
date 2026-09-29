# 코딩 에이전트로 강의 슬라이드 만들기

Claude Code, Codex, Cursor, Gemini CLI 같은 **코딩 에이전트**는 채팅 AI와 달리 컴퓨터의 폴더에서
파일을 직접 읽고 고치고, `marco build` 같은 명령도 직접 실행합니다. 그래서 작성 안내를 매번 붙여
넣고 답을 복사해 원고에 붙이는 대신, "6주차 덱을 만들어 줘"라고 부탁하면 에이전트가 원고를 쓰고,
빌드하고, 린트가 알려 준 문제를 스스로 고친 뒤 결과를 알려 줍니다.

|             | 채팅 AI ([ai-workflow.md](ai-workflow.md)) | 코딩 에이전트 (이 안내)         |
| ----------- | ------------------------------------------ | ------------------------------- |
| 규칙 전달   | 채팅마다 작성 안내를 붙여 넣기             | **스킬** 폴더를 한 번 넣어 두기 |
| 원고 저장   | 답을 복사해 `lecture.marco.md`에 붙이기    | 에이전트가 원고를 직접 고침     |
| 빌드와 점검 | 교수님이 `marco build`·`marco lint` 실행   | 에이전트가 실행하고 경고를 고침 |
| 한 장 수정  | 슬라이드와 린트 줄을 `40-수정.md`에 붙이기 | "12번 슬라이드를 …로 고쳐 줘"   |

에이전트에게 MARCO를 알려 주는 방법은 두 가지입니다. **스킬**(작성 규칙과 명령을 담은 파일 묶음)은
꼭 넣고, **MCP**(에이전트가 부를 수 있는 marco 도구)는 필요할 때 더합니다.

## 1. 준비: `marco` 설치

1. Node.js 22 (LTS)를 설치합니다([빠른 시작](quickstart.md) 1장).
2. 터미널에서 MARCO Engine을 설치하고 확인합니다.

   ```
   npm install -g marco-engine
   marco --version
   ```

   `marco-engine` 패키지에는 `marco` 명령, MCP 서버 `marco-mcp`, 이 안내의 스킬이 함께 들어
   있습니다. 설치하지 않고 `npx -y marco-engine build …`처럼 써도 됩니다. 패키지가 아직 npm에
   없거나 설치가 안 되면, [빠른 시작](quickstart.md) 1장대로 NPPT를 받아 빌드하고 `marco`
   명령을 연결합니다. 연결 없이 `node <NPPT 폴더>/apps/cli/dist/main.js`로 써도 됩니다.

3. 강의 폴더(예: `문서/강의/보안시스템`)를 하나 정해 두고, 에이전트를 그 폴더에서 엽니다.

`marco pdf`는 Chromium 브라우저가 필요합니다. 없으면 명령이 설치 방법을 알려 줍니다.

## 2. 에이전트에게 스킬 주기

스킬은 NPPT 저장소의 `skills/marco` 폴더입니다. `marco-engine`을 npm으로 설치했다면 패키지 안
`assets/skill/marco` 폴더도 같은 것입니다(위치는 `npm root -g`가 알려 주는 폴더 아래
`marco-engine/assets/skill/marco`). `SKILL.md`(작업 순서, 명령, 지킬 규칙, 린트
읽는 법)와 `reference/`(슬라이드·블록·글자 예산 표, 해설 문법, 린트 코드 표, 3주차 덱 예시,
한국어 작업 흐름)로 되어 있습니다. 채팅용 작성 안내와 규칙이 같습니다.

### Claude Code

`skills/marco` 폴더를 통째로 복사합니다. 이 강의 폴더에서만 쓰려면 `<강의 폴더>/.claude/skills/`에,
모든 폴더에서 쓰려면 홈 폴더의 `.claude/skills/`에 넣습니다.

macOS:

```
mkdir -p ~/.claude/skills
cp -R <NPPT 폴더>/skills/marco ~/.claude/skills/
```

Windows PowerShell:

```
New-Item -ItemType Directory -Force "$HOME\.claude\skills"
Copy-Item -Recurse "<NPPT 폴더>\skills\marco" "$HOME\.claude\skills\marco"
```

Claude Code를 다시 열면 강의 슬라이드나 `.marco.md` 이야기가 나올 때 스킬을 스스로 불러 씁니다.
확실히 하려면 첫 요청에 "marco 스킬을 써서"라고 덧붙입니다.

### Codex, Cursor, Gemini CLI 등

1. `skills/marco` 폴더를 강의 폴더 안에 복사합니다(`<강의 폴더>/skills/marco`).
2. 에이전트가 읽는 지침 파일에 한 줄을 넣습니다. 파일이 없으면 새로 만듭니다.
   - Codex, Cursor: 강의 폴더의 `AGENTS.md`
   - Gemini CLI: 강의 폴더의 `GEMINI.md`

   ```
   강의 슬라이드(.marco.md) 작업은 skills/marco/SKILL.md를 먼저 읽고 그대로 따른다.
   ```

3. 지침 파일을 쓰지 않는 도구라면 대화를 시작할 때 `skills/marco/SKILL.md` 파일을 첨부하거나
   (Cursor는 `@SKILL.md`) "skills/marco/SKILL.md를 읽고 시작해"라고 씁니다.

스킬 폴더를 직접 읽는 에이전트도 늘고 있습니다. 쓰시는 도구의 설명서에 스킬(skills) 항목이
있으면 그 위치에 `skills/marco` 폴더를 넣어도 됩니다.

## 3. MCP 연결 (선택)

MCP를 연결하면 에이전트가 명령줄 대신 `marco_build`, `marco_lint` 같은 **도구**로 빌드하고
점검합니다. 명령 실행이 막혀 있는 환경이나, 슬라이드 한 장을 덱에 넣기 전에 미리 검사하고 싶을 때
쓸모 있습니다. 규칙은 스킬에 있으므로 MCP만 연결하지 말고 스킬도 함께 넣습니다.

서버는 `marco-mcp`입니다. `marco-engine`을 설치했으면 설정의 `npx … marco-mcp` 대신
`marco-mcp`만 써도 됩니다.

- **Claude Code**: 터미널에서 한 번

  ```
  claude mcp add marco -- npx -y -p marco-engine marco-mcp
  ```

- **Codex**: `~/.codex/config.toml`에 추가

  ```toml
  [mcp_servers.marco]
  command = "npx"
  args = ["-y", "-p", "marco-engine", "marco-mcp"]
  ```

- **Cursor**: 강의 폴더의 `.cursor/mcp.json`(또는 홈 폴더의 `~/.cursor/mcp.json`)

  ```json
  {
    "mcpServers": {
      "marco": { "command": "npx", "args": ["-y", "-p", "marco-engine", "marco-mcp"] }
    }
  }
  ```

- **Gemini CLI**: `~/.gemini/settings.json`(또는 강의 폴더의 `.gemini/settings.json`)의
  `mcpServers`에 Cursor와 같은 내용을 넣습니다.

| 도구                  | 하는 일                                                 |
| --------------------- | ------------------------------------------------------- |
| `marco_kit`           | 작성 안내(채팅용과 같은 내용)                           |
| `marco_spec`          | 원고 형식 명세(영문)                                    |
| `marco_new`           | 새 강의 폴더와 원고 만들기 (`marco new`, 덮어쓰지 않음) |
| `marco_read`          | 원고 전체나 슬라이드 한 장 읽기                         |
| `marco_check_slide`   | 슬라이드 한 장을 덱에 넣기 전에 미리 점검               |
| `marco_replace_slide` | 슬라이드 한 장만 바꾸기 (이전 원고는 백업)              |
| `marco_lint`          | HTML 없이 점검만                                        |
| `marco_build`         | 원고를 HTML 덱으로 빌드하고 슬라이드별 고칠 점 돌려주기 |
| `marco_preview`       | 슬라이드 한 장을 그림(PNG)으로 미리 보기                |
| `marco_import`        | 예전 HTML 덱을 원고로 옮기기                            |

MCP 서버는 자기가 시작된 폴더(보통 에이전트를 연 강의 폴더) 안의 파일만 읽고 씁니다. 다른 폴더를
쓰게 하려면 설정의 `args` 끝에 `"--root", "<강의 폴더>"`를 더합니다(Claude Code는
`… marco-mcp --root <강의 폴더>`). 읽기만 허용하려면 `--read-only`를 더합니다.

## 4. 이렇게 부탁하세요

에이전트는 스킬의 순서대로 일합니다. 형식을 익히고 → 원고를 쓰고 → `marco build` → 린트를 읽고
→ 문제가 있는 슬라이드만 고치고 → 결과와 남은 `TODO:`를 알려 줍니다.

**새 덱 만들기**

> week06 폴더에 6주차 'IDS/IPS' 강의 덱을 만들어 줘. 과목은 보안시스템 운영 및 활용, 150분
> 수업이야. 인용할 출처는 sources.txt에 있어. 먼저 개요를 보여 줘.

`marco new week06 …`으로 폴더를 만들고, 머리말(제목·과목·주차·강의 시간·출처)을 채웁니다. 출처는
sources.txt에 있는 것만 씁니다. `번호 | 태그 | 제목 | 의도 | 분` 개요를 보여 주고, 확인을 받으면
6장씩 슬라이드를 쓴 뒤 빌드하고 경고를 고칩니다. 끝나면 `week06/lecture.html` 경로와 확인할
`TODO:` 목록을 알려 줍니다.

**한 장 고치기**

> 12번 슬라이드의 표를 3열로 줄이고 예시를 하나 추가해 줘.

원고의 12번째 슬라이드만 고칩니다. 슬라이드 id, 태그, 출처, 해설은 그대로 두고, 블록 순서가 바뀌면
해설의 `@대상` 번호를 맞춥니다. 다시 빌드해 그 슬라이드에 경고가 없는지 확인합니다.

**경고 정리하기**

> 빌드하면 경고가 나오는데 다 고쳐 줘.

린트가 가리킨 슬라이드만 고칩니다(글자 수 초과는 뜻을 살려 줄이고, 넘치는 슬라이드는 블록을
줄이거나 두 장으로 나눕니다). `TODO:`(정보 `content.todo`)는 교수님이 확인할 몫이라 남겨 두고
목록으로 알려 줍니다.

**해설 붙이기**

> 7–12번 슬라이드에 해설을 붙여 줘. 1분에 350자 정도로.

슬라이드마다 `## note`를 씁니다: `[시간]` → `[화면]` → `[대사]`·`[주목]` → `[발문] … | 10초`
→ `[전환]`. 5주차처럼 풍부한 대본을 원하시면 "1분에 900자"라고 합니다(차이는
[ai-workflow.md](ai-workflow.md)의 "해설 분량 고르기").

**예전 덱 옮기기**

> old/week05.html을 MARCO 원고로 옮기고 빌드해 줘.

`marco import old/week05.html week05`로 옮기고, `IMPORT-REPORT.md`에서 컴포넌트로 옮기지 못한
부분을 요약한 뒤 빌드와 린트 결과를 알려 줍니다.

**배포 파일 만들기**

> 학생용 판과 유인물 PDF를 만들어 줘.

`marco build week06/lecture.marco.md --edition student -o week06/lecture-student.html`과
`marco pdf week06/lecture.marco.md --mode handout`을 실행하고 파일 위치를 알려 줍니다.

## 5. 결과 확인하기

- `lecture.html`을 브라우저로 열어 봅니다(단축키는 [빠른 시작](quickstart.md) 6장).
- `marco lint --verbose`로 `TODO:`를 모아 봅니다. 에이전트는 확실하지 않은 수치·출처·날짜를
  지어내지 않고 `TODO:`로 남깁니다. 사실을 확인해 직접 채우시거나 에이전트에게 알려 주세요.
- 에이전트가 머리말 `refs`에 넣은 출처는 주소를 한 번 열어 확인합니다.
- 원고는 교수님의 것입니다. 큰 작업 전에는 원고를 복사해 두거나 git으로 관리하세요. 부탁하지
  않은 슬라이드가 바뀌었으면 되돌려 달라고 하면 됩니다.
- 덱의 도움말 창(`?`)에 있는 "Powered by MARCO …" 표시는 엔진 라이선스의 조건입니다. 지우지
  않으며, 에이전트에게 지우라고 하지 않습니다.

## 막힐 때

- **에이전트가 HTML이나 CSS를 쓰려 할 때**: "marco 스킬대로 MARCO 원고만 고쳐"라고 합니다.
- **`marco`를 찾지 못한다고 할 때**: 1장의 설치를 확인하거나, 전체 경로
  (`node <NPPT 폴더>/apps/cli/dist/main.js`)로 쓰라고 알려 줍니다.
- **`✗ 빌드 중단`**: 원고의 문법 오류(`format.*`)입니다. 오류 줄 번호가 함께 나오므로 에이전트에게
  그대로 고치게 합니다.
- **`marco ai …` 명령이 멈춘 것처럼 보일 때**: 이 명령들은 채팅 답 파일을 기다립니다. 에이전트는
  원고를 직접 쓰므로 `marco ai` 명령을 쓰지 말라고 합니다.
- **에이전트가 규칙을 모르는 것 같을 때**: 스킬이 제자리에 있는지 확인하고, 첫 요청에
  "skills/marco/SKILL.md를 읽고 시작해"라고 씁니다.
