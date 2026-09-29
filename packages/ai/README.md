# @marco/ai

Vendor-neutral prompt kit and authoring pipeline for MARCO lecture decks (PLAN.md §9). A chat
assistant (ChatGPT, Claude, Gemini, a local model) writes lecture content as compact MARCO source
(`.marco.md`) instead of whole HTML files; `marco build` adds the engine. This package holds the
prompts that teach the format and the TypeScript pipeline that runs them.

## Layout

```
prompts/                     Korean prompt kit, pasted into a chat window as-is
  00-규칙.md                 system rules (MARCO source only, one fence, budgets, no invented URLs, TODO:)
  01-컴포넌트-치트시트.md     GENERATED from BUDGETS + docs/spec/components.md (do not edit)
  02-해설-문법.md             `## note` marker grammar (docs/spec/notes.md)
  03-문체-가이드.md           style rules from the week-3/week-5 decks, 10 before/after pairs
  10-개요.md                 task: outline (30–45 lines `번호 | 태그 | 제목 | 한 줄 의도 | 분`)
  20-슬라이드.md             task: write a range of slides (batch)
  30-해설.md                 task: lecture script (`## note`) for one to four slides
  40-수정.md                 task: revise one slide, given a request and lint lines
  50-검토.md                 self-check mapped to lint codes (also pasteable after a reply)
  examples/*.marco.md        few-shot slides transcribed from the V20 deck + one full note
scripts/build-kit.ts         run by `build` after tsc
src/                         pipeline (see API)
test/                        Vitest, no network (FakeProvider)
```

Every prompt file starts with a short English `<!-- … -->` header for maintainers; builders and
the kit strip it. Task templates use `{{슬롯}}` placeholders that `fillTemplate` fills (unknown
slots are left alone, empty ones become `없음`).

## The kit

`pnpm --filter @marco/ai build` runs `tsc`, then `scripts/build-kit.ts`, which

1. regenerates `prompts/01-컴포넌트-치트시트.md` from `BUDGETS` when it changed,
2. writes `dist/kit/MARCO-작성-안내.md`: rules + cheat-sheet + note grammar + style guide +
   self-check + examples, i.e. exactly `systemPrompt()`,
3. copies every prompt and example into `dist/kit/`,
4. prints sizes and a token estimate.

Current size: about 11,000 characters in total, about 8,200 without the examples (budget
~12,000). Token estimates use **characters / 2.5** for Korean-heavy text: a planning heuristic,
not a tokenizer count; real counts vary by model and are often higher for Hangul.

The kit contains no task templates: the professor pastes it once per chat, then pastes a task
prompt (10/20/30/40) per request. The same text is the API system prompt, so chat and API runs
behave alike.

## API

```ts
import {
  runOutline,
  runSlides,
  runNotes,
  runRevise,
  runRepair, // pipeline
  ManualProvider,
  OpenAICompatibleProvider,
  openAICompatibleFromEnv, // providers
  buildOutlinePrompt,
  buildSlidesPrompt,
  buildNotesPrompt,
  buildRevisePrompt,
  buildRepairPrompt,
  systemPrompt,
  loadPromptKit,
  renderCheatsheet,
  extractMarcoSource,
  extractNote,
  parseOutline,
  splitDeck,
  findSlide,
  replaceSlide,
  mergeNote,
  mergeNotes,
  buildKit,
  estimateTokens,
} from '@marco/ai';
```

- `Provider { name; complete(messages, opts?) → Promise<string> }` is the only vendor seam.
- Builders return `[system, user]`. `system` is byte-identical for every call and step (cached
  per kit object), so provider prompt caching applies; within a deck the user message also keeps
  its variable part (range, slide) last.
- `runOutline(provider, OutlineRequest)` → outline text + parsed `OutlineItem[]` (type from the
  tag: `표지` cover, `N부` divider, `마무리` quote, `참고 자료` references; clock from/to).
- `runSlides(provider, SlideBatchRequest)` → slides in batches of `batchSize` (default 6); 40
  outline lines take 7 calls. Warns when a batch returns the wrong number of slides.
- `runNotes(provider, NotesRequest)` → one call per slide; `[시간]` comes from the outline or the
  slides' `time:` fields; the reply's `## note` replaces the slide's note.
- `runRevise(provider, ReviseRequest)` → one slide replaced in the deck; lint issues of other
  slides are filtered out.
- `runRepair(provider, { deck, issues })` → validate-repair loop: each slide with lint issues
  (matched by `issue.slide` or `/slides/N/…` path) is sent back once with only its issues.
- All `run*` return `{ source, usage: { calls, chars, promptChars, replyChars }, warnings }`.
- `extractMarcoSource(reply)` tolerates prose around the fence, several fences, a ` ```marco `
  fence that contains ` ```bash ` blocks, truncated replies and unfenced replies.
- `mergeNotes(deck, reply, target?)` merges a chat reply holding one bare note or several
  `# slide …` header + `## note` pairs. Merging a note that carries `[시간]` drops the slide's `time:`
  field, because the compiler prefers a differing `time:` (warning `format.note.time`).

### Providers

- `ManualProvider({ dir = '.marco/ai' })` for chat-window use: writes `kit.md` once, then
  `NN-label.prompt.md` per call, and waits until the professor saves the chat answer to
  `NN-label.reply.md` (polling; `waitForReply` is injectable). Re-running reuses replies whose
  prompt is unchanged and moves stale ones to `.old`, so interrupted runs resume.
- `OpenAICompatibleProvider` / `openAICompatibleFromEnv()` posts to any OpenAI-compatible
  `/v1/chat/completions` endpoint with `fetch` (no SDK). Environment: `MARCO_AI_BASE_URL`
  (`https://api.openai.com/v1`, `http://localhost:11434`, …; a bare host gets `/v1`),
  `MARCO_AI_MODEL`, `MARCO_AI_API_KEY` (optional for local servers). Tests only check request
  shaping (`buildChatCompletionRequest`, `readChatCompletion`); `complete()` is never called.

## CLI wiring (apps/cli)

| Command                                                            | Call                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `marco ai kit`                                                     | `buildKit()` or print `dist/kit/MARCO-작성-안내.md`                 |
| `marco ai outline "<topic>" --course --week --duration --audience` | `runOutline(p, req)` → write `outline.txt`                          |
| `marco ai slides --batch 6 [--range 7-12]`                         | `runSlides(p, { outline, batchSize, range, refs, frontMatter })`    |
| `marco ai notes --slides 1-43 [--cpm 900]`                         | `runNotes(p, { deck, slides, outline, charsPerMinute })`            |
| `marco ai revise 12 "<request>"`                                   | `runRevise(p, { deck, slide: 12, request, lint: lintLecture(ir) })` |
| `marco ai repair`                                                  | `runRepair(p, { deck, issues: lintLecture(ir) })`                   |
| `marco ai merge-notes reply.md`                                    | `mergeNotes(deck, reply)`                                           |

`p` is `new ManualProvider()` for `--provider manual` (default) or `openAICompatibleFromEnv()`
for `--provider api`. `refs` for `runSlides` can be the front matter `refs:` block.

## Tests

`pnpm --filter @marco/ai test`: builders include every block and budget; the system message is
identical across calls; the checked-in cheat-sheet equals `renderCheatsheet(BUDGETS)` and covers
every BUDGETS key, every IR block type and every block of components.md; note markers in the
kit are known to `@marco/schema`; the self-check names every relevant `LINT_CODES` entry; the
examples respect the budgets and their note parses with `parseNote`; extraction edge cases;
batching (40 slides → 7 calls) with a `FakeProvider`; `buildKit` output.

## Notes

- `prompts/**/*.marco.md` must not be reformatted by Prettier (it would insert a blank line
  after `# slide`, which ends the field block). `packages/ai/.prettierrc.json` mirrors the root
  options and sets `requirePragma` for `*.marco.md`.
- Tool-use / structured-output (JSON IR) mode is not implemented; the pipeline uses plain text
  replies, which every provider and chat window supports.
