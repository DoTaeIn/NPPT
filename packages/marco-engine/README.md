# marco-engine

MARCO Engine for lecture decks. You (or an AI) write a compact Markdown source,
`lecture.marco.md`; `marco build` turns it into **one offline HTML file**: a 1920×1080 deck with
presenter notes, table of contents, search, ink tools, print modes and quiz widgets, the design
system and fonts inlined. Because the engine and the content are separate, a new deck or a
one-slide revision costs a fraction of the tokens that regenerating a whole HTML file does.

This package is the whole engine in one install: the `marco` CLI, the deck runtime, the design
system (Pretendard and Spoqa Han Sans fonts), the legacy-deck importer, the AI prompt kit, the
format specs and the `marco-mcp` MCP server. It needs only Node.js 20 or newer and npm.

## Install

```bash
npx marco-engine --help                  # run without installing
npm install -g marco-engine              # or install the `marco` and `marco-mcp` commands
marco --version
```

`npx marco-engine <command>` and `marco <command>` are the same program.

## Commands

```bash
marco new week06 --title "6주차 · IDS/IPS" --course "보안시스템 운영 및 활용" --week 6
marco build week06/lecture.marco.md      # → week06/lecture.html (single file, works offline)
marco lint  week06/lecture.marco.md      # format errors, character budgets, refs, timing
marco watch week06/lecture.marco.md      # rebuild on every save
marco pdf   week06/lecture.marco.md      # 1920×1080 PDF; --mode handout for A4 handouts
marco import old-deck.html week05        # convert a legacy single-file HTML deck (V20 / v9.7)
marco ai kit -o kit                      # the prompt kit to paste into any chat assistant
```

| Command                               | What it does                                                  |
| ------------------------------------- | ------------------------------------------------------------- |
| `marco new <dir>`                     | new lecture folder with a starter `lecture.marco.md`          |
| `marco build <file>`                  | source → one HTML deck (`--edition`, `--theme`, `--fonts`)    |
| `marco watch <file>`                  | rebuild when the source, its images or sidecar JSON change    |
| `marco lint <file>`                   | check the source (`--json` for machine-readable output)       |
| `marco pdf <file>`                    | PDF via Playwright's Chromium (see below)                     |
| `marco import <legacy.html> <outDir>` | legacy deck → source + images + `IMPORT-REPORT.md`            |
| `marco ai <step>`                     | AI authoring: `kit`, `outline`, `slides`, `notes`, `revise` … |

`marco ai` works without any network by default: each model call is a prompt file you paste into
any chat, and the command continues when you save the answer next to it. Set `MARCO_AI_BASE_URL`
and `MARCO_AI_MODEL` (and `MARCO_AI_API_KEY` if needed) to call an OpenAI-compatible API instead.

Every command has `--help`. Messages are in Korean; exit code 0 means success, 1 an error.

### Optional pieces

- **Images** are resized and converted with [sharp](https://sharp.pixelplumbing.com/), an
  optional dependency npm installs when a prebuilt binary exists for your platform. Without it
  the build still succeeds, embeds the original image bytes and prints the warning
  `asset.sharp`.
- **PDF** needs Playwright and its Chromium, which are not installed with this package
  (optional peer dependency). `marco pdf` prints these instructions when they are missing:

  ```bash
  npm install -g marco-engine playwright && npx playwright install chromium
  # or, without a global install:
  npx playwright install chromium && npx -p marco-engine -p playwright marco pdf week06/lecture.marco.md
  ```

  `PLAYWRIGHT_BROWSERS_PATH` selects an existing Chromium installation.

## Using it from an AI

- **MCP server.** `marco-mcp` (or `marco mcp`, the same server) serves the engine over stdio to
  Claude Desktop, Claude Code, Cursor and other MCP clients: tools to scaffold, build, lint, check
  and revise slides, import legacy decks and preview, plus the spec, schema and prompt kit as
  resources. Every path must lie under `--root` (default: the current folder); `--read-only`
  refuses all writes.

  ```json
  {
    "mcpServers": {
      "marco": {
        "command": "npx",
        "args": ["-y", "marco-engine", "mcp", "--root", "/path/to/lectures"]
      }
    }
  }
  ```

  Claude Code: `claude mcp add marco -- npx -y marco-engine mcp --root ~/lectures`. With a global
  install, use `"command": "marco-mcp", "args": ["--root", "/path/to/lectures"]`. Run
  `marco-mcp --help` for all options.

- **Agent skill.** The `marco` skill (how to write and fix MARCO sources, with the format
  reference and examples) ships in `assets/skill/marco/`. For Claude Code:

  ```bash
  cp -r "$(npm root -g)/marco-engine/assets/skill/marco" ~/.claude/skills/
  ```

- **Any chat assistant.** `marco ai kit -o kit` writes `kit/MARCO-작성-안내.md`: paste it once
  per chat, then the task prompt (`10-개요.md`, `20-슬라이드.md` …). The format specs are in
  `assets/spec/` and the JSON Schema of the lecture IR in `assets/schema/lecture.schema.json`.

## Package layout

```
bin/marco.js          the CLI (bins: marco, marco-engine)
bin/marco-mcp.js      the MCP server
assets/runtime/       deck runtime bundles (core, all = core + widget plugins)
assets/css/           design system CSS, fonts and their licence (OFL.txt)
assets/kit/           AI prompt kit
assets/templates/     `marco new` template
assets/schema/        lecture.schema.json
assets/spec/          format, components, notes, IR and runtime specs
assets/skill/marco/   agent skill
```

## 한국어 안내

강의 원고(`lecture.marco.md`)를 한 파일짜리 1920×1080 HTML 강의 덱으로 만드는 도구입니다. 엔진
소스 없이 Node.js 20 이상과 npm만 있으면 됩니다.

```bash
npm install -g marco-engine              # 또는 설치 없이 npx marco-engine …
marco new week06 --title "6주차 · IDS/IPS" --course "보안시스템 운영 및 활용" --week 6
marco build week06/lecture.marco.md      # → week06/lecture.html (인터넷 없이 열림)
marco lint week06/lecture.marco.md
marco ai kit -o kit                      # 채팅창에 붙여 넣을 작성 안내
marco import 예전-덱.html week05          # 예전 HTML 덱을 원고로 가져오기
```

- 이미지 최적화(sharp)는 가능한 환경에서 자동으로 설치됩니다. 없으면 원본 이미지를 그대로 넣고
  경고(`asset.sharp`)만 표시합니다.
- PDF(`marco pdf`)에는 Playwright와 Chromium이 필요합니다:
  `npm install -g marco-engine playwright && npx playwright install chromium`
- AI 도구에서 쓰려면 MCP 서버(`npx -y marco-engine mcp --root <폴더>`, 위 설정 예)나
  `assets/skill/marco/` 스킬을 쓰세요.

## License and attribution

The engine is licensed under the **MARCO Engine License 1.0** (`LICENSE`): the Apache License
2.0 plus one Additional Condition. A product that puts the engine in front of end users,
including a lecture deck built with it, must show, somewhere an end user can find it:

> Powered by MARCO — Created by DoTaeIn,
> Original project: https://github.com/DoTaeIn/Marco

Every deck `marco build` writes carries this line in its HTML comment and in the runtime's help
overlay, so decks built with this package comply as they are. Personal use, research,
evaluation, internal tools and plain redistribution do not trigger the condition; keep `LICENSE`
and `NOTICE` when you redistribute the package. Lecture content (slides, notes and media you
write) belongs to its author and is not covered by the licence. The bundled fonts are under the
SIL Open Font License 1.1 (`assets/css/fonts/OFL.txt`).

Source, issues and the full documentation: https://github.com/DoTaeIn/NPPT

## Releasing (maintainers)

The package is assembled from the monorepo by `packages/marco-engine/build.mjs`; nothing here is
edited by hand. Locally, `pnpm dist` builds everything and writes
`packages/marco-engine/marco-engine-<version>.tgz`. To release, set the version in the root
`package.json`, push a tag `v<version>`, and the `release` workflow tests the tarball, attaches it
to a GitHub Release and, when the repository has an `NPM_TOKEN` secret, publishes it to npm with
provenance. Details: [`docs/release.md`](https://github.com/DoTaeIn/NPPT/blob/main/docs/release.md).
