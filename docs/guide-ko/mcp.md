# AI 앱에서 MARCO 도구 쓰기 (MCP)

Claude Desktop, Claude Code, Cursor 같은 AI 앱이 MARCO 엔진을 **직접 불러 쓰게** 하는 방법입니다.
채팅에 작성 안내를 붙여 넣고 답을 파일로 옮겨 `marco build`를 실행하는 대신, AI가 스스로 원고를 쓰고
빌드하고 린트를 읽고 고친 뒤 완성된 HTML 파일 경로를 알려 줍니다.

## MCP란

MCP(Model Context Protocol)는 AI 앱이 바깥 프로그램의 기능을 "도구"로 불러 쓰게 하는 공개 규격입니다.
AI 앱 설정에 MARCO의 MCP 서버를 한 번 등록해 두면, 대화 중에 AI가 필요할 때 `marco_build`(빌드),
`marco_lint`(점검) 같은 도구를 호출하고 그 결과를 읽습니다. 서버는 교수님 컴퓨터에서 AI 앱이 직접
실행하며 인터넷에 접속하지 않고, 정해 둔 강의 폴더(`--root`) 안의 파일만 읽고 씁니다.

```
"6주차 덱 만들어 줘" → AI가 marco_kit으로 형식 익힘 → 원고 작성 → marco_build
                    → 린트가 알린 슬라이드만 고침 → 다시 marco_build → "여기 있습니다: …/lecture.html"
```

## 1. 준비

- **Node.js 22** 이상([nodejs.org](https://nodejs.org)의 LTS). 터미널에서 `node --version`이 `v22.`로
  시작하면 됩니다. 아래 설정의 `npx`가 MARCO 엔진(`marco-engine` 패키지)을 알아서 받아 실행합니다.
- 강의 폴더 하나. 예: 내 문서 아래 `lectures`. 없으면 서버가 처음 실행될 때 만듭니다.

NPPT 저장소를 직접 받아 빌드해 쓰는 경우(개발용)는 `pnpm install && pnpm build` 뒤에
`npx -y marco-engine mcp` 대신 `node <NPPT 폴더>/packages/mcp/dist/main.js`를 씁니다(아래 예시 참고).

## 2. AI 앱에 등록하기

### Claude Desktop

1. Claude Desktop에서 **설정 → 개발자(Developer) → 설정 편집(Edit Config)** 을 누릅니다.
   `claude_desktop_config.json` 파일이 열립니다(macOS: `~/Library/Application Support/Claude/`,
   Windows: `%APPDATA%\Claude\`).
2. 다음 내용을 넣습니다. 이미 `mcpServers`가 있으면 그 안에 `"marco": { … }`만 추가합니다.

   ```json
   {
     "mcpServers": {
       "marco": {
         "command": "npx",
         "args": ["-y", "marco-engine", "mcp", "--root", "~/lectures"]
       }
     }
   }
   ```

   `~/lectures`는 강의 폴더입니다. Windows에서는 `"C:\\Users\\me\\lectures"`처럼 역슬래시를 두 번씩
   씁니다.

3. Claude Desktop을 완전히 종료했다가 다시 엽니다. 입력창 아래 도구(망치) 메뉴에 `marco`가 보이면
   연결된 것입니다.

저장소를 직접 빌드해 쓰는 경우:

```json
{
  "mcpServers": {
    "marco": {
      "command": "node",
      "args": ["/path/NPPT/packages/mcp/dist/main.js", "--root", "/Users/me/lectures"]
    }
  }
}
```

### Claude Code

터미널에서 한 번 실행합니다.

```
claude mcp add marco -- npx -y marco-engine mcp --root ~/lectures
```

`claude mcp list`로 등록을 확인하고, Claude Code 안에서는 `/mcp`로 연결 상태를 봅니다. 강의 폴더에서
Claude Code를 열어 쓰는 경우에는 `--root .`로 등록해도 됩니다.

### Cursor와 그 밖의 앱

Cursor는 홈 폴더의 `~/.cursor/mcp.json`(또는 강의 폴더의 `.cursor/mcp.json`)에 Claude Desktop과 같은
내용을 넣습니다. MCP를 지원하는 다른 앱도 "stdio 서버"로 명령 `npx`, 인자
`-y marco-engine mcp --root <강의 폴더>`를 등록하면 됩니다. `marco` 명령을 설치해 두었다면
`marco mcp --root <강의 폴더>`도 같은 서버입니다.

## 3. 폴더와 안전

- 도구는 `--root`로 정한 강의 폴더 **안의 파일만** 읽고 씁니다. 그 밖의 경로(`../`, 다른 드라이브,
  폴더 밖을 가리키는 바로가기)는 거부합니다. 원고가 폴더 밖의 이미지나 JSON을 가리켜도 읽지 않습니다.
- AI가 기존 원고를 덮어쓰면 이전 내용이 `강의 폴더/.marco/mcp/backups/`에 남습니다(파일마다 최근 20개).
  잘못 고쳤으면 여기서 되살리면 됩니다.
- 파일 경로 없이 원고 글만 넘겨 빌드하면 `.marco/mcp/` 안에 임시로 저장됩니다. 이미지가 있는 덱은
  AI에게 "week06 폴더에 저장해서 빌드해" 처럼 폴더를 정해 주세요. 이미지 경로(`assets/…`)는 원고 파일이
  있는 폴더를 기준으로 찾습니다.
- 읽기만 허용하려면 설정의 `args` 끝에 `"--read-only"`를 더합니다. 그러면 새 강의 만들기, 저장,
  가져오기가 모두 거부되고 점검만 합니다.
- 덱 HTML은 미리 보기(`marco_preview`)에서만 헤드리스 크롬으로 열며, 이때도 인터넷 요청은 모두
  막습니다. 서버 자체는 인터넷에 접속하지 않습니다.

## 4. 도구

AI가 알아서 고르므로 이름을 외울 필요는 없습니다. 무엇을 할 수 있는지만 참고하세요.

| 도구                  | 하는 일                                                                      |
| --------------------- | ---------------------------------------------------------------------------- |
| `marco_kit`           | 작성 안내(채팅용과 같은 규칙·치트시트·해설 문법·문체). AI가 맨 먼저 읽습니다 |
| `marco_spec`          | 원고 형식 명세(영문): 형식, 컴포넌트, 해설 문법, IR·린트, 런타임             |
| `marco_new`           | 새 강의 폴더와 시작용 `lecture.marco.md` 만들기 (이미 있으면 덮어쓰지 않음)  |
| `marco_build`         | 원고를 저장하고 HTML 덱으로 빌드, 슬라이드별 고칠 점과 고치는 방법 돌려주기  |
| `marco_lint`          | HTML 없이 점검만 (빠름)                                                      |
| `marco_check_slide`   | 슬라이드 한 장을 덱에 넣기 전에 미리 점검 (본문 높이 추정 포함)              |
| `marco_read`          | 원고 전체나 슬라이드 한 장 읽기                                              |
| `marco_replace_slide` | 슬라이드 한 장만 바꾸기 (이전 원고는 백업)                                   |
| `marco_import`        | 예전 한 파일짜리 HTML 덱(V20 · v9.7)을 원고로 옮기기                         |
| `marco_preview`       | 슬라이드 한 장을 1920×1080 그림(PNG)으로 미리 보기 (Playwright 필요)         |

빌드 결과의 문제마다 한 줄짜리 **고치는 방법**(`repair_hint`)이 붙습니다. 예:
`:::cards의 body를 90자 이하로 줄인다(지금 101자). 핵심어만 남기고 부연 설명은 해설(## note)로 옮긴다.`
AI는 이것을 보고 해당 슬라이드만 고칩니다. `TODO:` 표시, 인용하지 않은 출처, 강의 시간 합계처럼
**교수님이 확인할 항목**은 AI가 지어내 채우지 않고 목록으로 알려 드립니다.

Claude Desktop에서는 입력창의 `+`(첨부) 메뉴에 MARCO 프롬프트 `outline`(개요), `slides`(슬라이드),
`notes`(해설), `revise`(수정)도 보입니다. 채팅용 작업 안내(`packages/ai/prompts`)와 같은 내용입니다.

## 5. 대화 예시: "6주차 IDS/IPS 덱을 만들어 줘"

실제 흐름을 줄여 옮긴 것입니다. `→`는 AI가 부른 도구, `←`는 도구가 돌려준 결과입니다.

> **교수님**: 보안시스템 운영 및 활용 6주차 IDS/IPS 강의 덱을 만들어 줘. 150분 강의고, 탐지 방식과
> 배치 위치를 꼭 다뤄 줘.

```
→ marco_kit {}
← # MCP로 작업할 때 … # MARCO 작성 규칙 … # 컴포넌트 치트시트 … (약 2만 5천 자)

→ marco_new { dir: "week06", title: "6주차 · 침입 탐지와 차단 (IDS/IPS)",
              course: "보안시스템 운영 및 활용", week: 6, duration: 150 }
← Created week06/lecture.marco.md (starter deck, 4 slides) and week06/assets/.

→ marco_build { source_path: "week06/lecture.marco.md",
                source_text: "---\ntitle: \"6주차 · 침입 탐지와 차단 (IDS/IPS)\"\n… # slide cover …" }
← ✓ Built week06/lecture.html (378.0 KB, 32 slides, instructor edition, theme v20-violet, fonts subset)
  Issues: 0 errors · 2 warnings · 2 info
  Lint by slide:
    s-02 #2 "IDS는 알리고 IPS는 막는다" (line 22)
      warn budget.cards.body · cards[0].body: 101자 (허용 90자)
        hint: :::cards의 `body`를 90자 이하로 줄인다(지금 101자). 핵심어만 남기고 부연 설명은
              해설(## note)로 옮긴다. …
    s-09 #9 "배치 위치: 인라인과 미러 포트" (line 131)
      warn budget.slide.dense · slide.dense: 본문 높이 추정 912px (허용 760px, 20% 초과 · 가장 큰 블록 #2 table 356px)
        hint: 본문이 슬라이드 높이를 넘친다. 메시지의 "가장 큰 블록"부터 줄이거나 … 슬라이드를 둘로 나눈다.
    s-12 #12 "탐지율과 오탐률" (line 187)
      info content.todo · 확인할 TODO가 남아 있습니다: "TODO: 탐지율 통계 출처 확인" [for the author]
    deck (front matter / totals)
      info time.total · 노트 [시간] 합계 148분 / 강의 시간 150분 … [for the author]
  Next: Fix the error/warn issues on slides s-02, s-09 …, then call marco_build again.

→ marco_replace_slide { source_path: "week06/lecture.marco.md", slide: 2,
                        slide_source: "# slide\ntag: 기본 개념\n… body: 트래픽 사본을 받아 분석하고 경보를 보낸다. …" }
← ✓ Replaced slide 2 (s-02) in week06/lecture.marco.md; backup .marco/mcp/backups/…
  Deck: 32 slides · 0 errors · 1 warning · 2 info

→ marco_replace_slide { source_path: "week06/lecture.marco.md", slide: 9,
                        slide_source: "# slide\n… (표를 6행으로 줄이고 비교는 다음 장으로) …\n\n# slide\n…" }
← ✓ Replaced slide 9 (s-09) in week06/lecture.marco.md with 2 slides; …
  Deck: 33 slides · 0 errors · 0 warnings · 2 info

→ marco_build { source_path: "week06/lecture.marco.md" }
← ✓ Built week06/lecture.html (391.4 KB, 33 slides, …)  Issues: 0 errors · 0 warnings · 2 info
```

> **AI**: 6주차 덱을 만들었습니다: `~/lectures/week06/lecture.html` (33장, 강의자용).
> 2번 슬라이드 카드 문장을 줄였고, 9번 슬라이드는 표가 넘쳐 두 장으로 나눴습니다.
> 확인해 주실 것: 12번 슬라이드의 `TODO: 탐지율 통계 출처 확인`(출처를 알려 주시면 넣겠습니다),
> 해설 시간 합계 148분 / 150분.

HTML 파일을 브라우저로 열면 바로 발표할 수 있습니다(`N` 해설, `?` 도움말). 이어서 이렇게 부탁하면 됩니다.

- "5번 슬라이드를 표 대신 단계 목록으로 바꿔 줘" → `marco_read` → `marco_replace_slide` → `marco_build`
- "학생용으로도 빌드해 줘" → `marco_build { source_path, edition: "student", out_path: "week06/lecture-student.html" }`
- "3주차 예전 덱을 원고로 옮겨 줘" → `marco_import { html_path: "old/week03.html", out_dir: "week03" }`
- "7번 슬라이드가 어떻게 보이는지 보여 줘" → `marco_preview { source_path: "week06/lecture.marco.md", slide: 7 }`

## 6. 잘 되지 않을 때

| 증상                                  | 확인할 것                                                                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 도구 메뉴에 `marco`가 없음            | 설정 파일의 JSON 문법(쉼표·따옴표), 앱을 완전히 종료 후 재시작, `node --version`이 22 이상인지                                           |
| "is outside the server root"          | AI가 강의 폴더 밖 경로를 썼습니다. 파일을 `--root` 폴더 안으로 옮기거나 `--root`를 상위 폴더로 바꿉니다                                  |
| "The MARCO MCP server runs read-only" | 설정에 `--read-only`가 있습니다. 쓰기를 허용하려면 지웁니다                                                                              |
| 이미지가 빠짐 (`asset.*` 경고)        | 이미지를 원고 옆 `assets/`에 두고, 원고를 그 폴더에 저장해 빌드하게 합니다                                                               |
| `marco_preview`가 "needs Playwright"  | 미리 보기만 안 되는 것입니다. 필요하면 강의 폴더에서 `npm i -D playwright && npx playwright install chromium`, 아니면 HTML을 직접 엽니다 |
| AI가 HTML·CSS를 직접 쓰려 함          | "MARCO 원고로 쓰고 marco_build로 빌드해" 라고 말하거나, 새 대화에서 `marco_kit`부터 읽게 합니다                                          |

터미널에서 서버만 따로 확인하려면 `npx -y marco-engine mcp --help`(저장소 빌드는
`node packages/mcp/dist/main.js --help`)를 실행합니다. 도움말이 나오면 서버는 정상입니다.

관련 안내: [빠른 시작](quickstart.md) · [AI 채팅으로 강의 슬라이드 쓰기](ai-workflow.md) ·
[코딩 에이전트로 강의 슬라이드 만들기](ai-agents.md)
