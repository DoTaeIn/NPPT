/**
 * JSON Schema (draft 2020-12) for the Lecture IR.
 *
 * This TypeScript object is the source of `lecture.schema.json` at the package root
 * (`pnpm --filter @marco/schema schema:emit`; a test fails when the two drift). The helper
 * types below make `tsc` reject a schema that does not list exactly the properties, required
 * keys and union members of `types.ts`.
 */
import { BUDGETS } from './budgets.js';
import { IR_VERSION } from './types.js';
import type {
  Asset,
  BlockType,
  CalloutBlock,
  CardsBlock,
  ChainBlock,
  CodeBlock,
  ColumnsBlock,
  CompareBlock,
  Cue,
  CueKind,
  Edition,
  HtmlBlock,
  ImageBlock,
  Lecture,
  LectureMeta,
  NoteTime,
  ParagraphBlock,
  PillsBlock,
  QuizItem,
  QuoteBlock,
  Ref,
  Slide,
  SlideNote,
  SlideType,
  StepsBlock,
  TableBlock,
  TakeawayBlock,
  TermsBlock,
  ThemeId,
  TilesBlock,
  TimelineBlock,
  Tone,
  VerdictBlock,
  Video,
  VideoBlock,
  WidgetBlock,
  BulletsBlock,
} from './types.js';

/** A JSON Schema object (plain JSON data). */
export type JsonSchema = { [keyword: string]: unknown };

/** `$id` of the Lecture IR schema. */
export const LECTURE_SCHEMA_ID = `urn:marco:lecture-ir:${IR_VERSION}`;

// ---------------------------------------------------------------------------
// Compile-time mirror helpers
// ---------------------------------------------------------------------------

type RequiredKeys<T> = {
  [K in keyof T]-?: Pick<T, K> extends Required<Pick<T, K>> ? K : never;
}[keyof T];
/** Exactly one schema per property of T (missing or extra keys fail to compile). */
type Properties<T> = { [K in keyof T]-?: JsonSchema };
/** Exactly the required keys of T. */
type RequiredSet<T> = { [K in RequiredKeys<T>]: true };
/** Exactly the members of a string union. */
type Members<U extends string> = { [K in U]: true };

function object<T>(
  description: string | undefined,
  properties: Properties<T>,
  required: RequiredSet<T>,
): JsonSchema {
  const keys = Object.keys(required);
  return {
    type: 'object',
    ...(description ? { description } : {}),
    properties,
    ...(keys.length ? { required: keys } : {}),
    additionalProperties: false,
  };
}

const withDescription = (schema: JsonSchema, description?: string): JsonSchema =>
  description ? { ...schema, description } : schema;
const str = (description?: string, extra: JsonSchema = {}): JsonSchema =>
  withDescription({ type: 'string', ...extra }, description);
const num = (description?: string, extra: JsonSchema = {}): JsonSchema =>
  withDescription({ type: 'number', ...extra }, description);
const int = (description?: string, extra: JsonSchema = {}): JsonSchema =>
  withDescription({ type: 'integer', ...extra }, description);
const bool = (description?: string): JsonSchema =>
  withDescription({ type: 'boolean' }, description);
const arr = (items: JsonSchema, description?: string, extra: JsonSchema = {}): JsonSchema =>
  withDescription({ type: 'array', items, ...extra }, description);
const ref = (name: string): JsonSchema => ({ $ref: `#/$defs/${name}` });
const oneOfStrings = <U extends string>(members: Members<U>, description?: string): JsonSchema =>
  withDescription({ type: 'string', enum: Object.keys(members) }, description);
const tag = (value: string): JsonSchema => ({ type: 'string', const: value });
const chars = (max: number, what?: string): string =>
  what ? `${what} Budget: ${max} chars.` : `Budget: ${max} chars.`;

const nonEmpty = { minLength: 1 };
const SLIDE_ID = '^[A-Za-z][A-Za-z0-9_-]*$';
const CUE_ID = '^[A-Za-z0-9][A-Za-z0-9_-]*$';
const REF_ID = '^[A-Za-z0-9][A-Za-z0-9_.:-]*$';
const CLOCK = '^[0-9]{1,3}:[0-9]{2}$';

// ---------------------------------------------------------------------------
// Unions (exhaustive by construction)
// ---------------------------------------------------------------------------

const THEMES: Members<ThemeId> = { 'v20-violet': true, 'cau-navy': true };
const EDITIONS: Members<Edition> = { student: true, instructor: true };
const TONES: Members<Tone> = {
  neutral: true,
  primary: true,
  ok: true,
  warn: true,
  danger: true,
  info: true,
};
const CUE_KIND_SET: Members<CueKind> = {
  SAY: true,
  DO: true,
  LOOK: true,
  ASK: true,
  HOP: true,
  SQ: true,
  SA: true,
  NEXT: true,
  TIP: true,
  WAIT: true,
  SCREEN: true,
  VERIFY: true,
  MEMO: true,
};
const SLIDE_TYPES: Members<SlideType> = {
  cover: true,
  divider: true,
  quote: true,
  hero: true,
  content: true,
  references: true,
  raw: true,
};
const REF_KINDS: Members<NonNullable<Ref['kind']>> = {
  standard: true,
  law: true,
  paper: true,
  vendor: true,
  article: true,
  video: true,
  other: true,
};

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

const B = BUDGETS;

const blockSchemas: { [K in BlockType]: JsonSchema } = {
  chain: object<ChainBlock>(
    `Numbered decision chain (:::chain, pipe rows "01 | label | sub"). Budget: at most ${B.chain.maxItems} items.`,
    {
      type: tag('chain'),
      items: arr(
        object<ChainBlock['items'][number]>(
          undefined,
          {
            no: str('Step number shown, e.g. "01"; auto-numbered when absent.'),
            label: str(chars(B.chain.label)),
            sub: str(chars(B.chain.sub)),
          },
          { label: true },
        ),
        undefined,
        { minItems: 1 },
      ),
    },
    { type: true, items: true },
  ),
  cards: object<CardsBlock>(
    `Card grid (:::cards cols=N). Budget: at most ${B.cards.maxItems[2]}/${B.cards.maxItems[3]}/${B.cards.maxItems[4]} items and body ${B.cards.body[2]}/${B.cards.body[3]}/${B.cards.body[4]} chars for cols 2/3/4.`,
    {
      type: tag('cards'),
      cols: int(undefined, { enum: [2, 3, 4] }),
      items: arr(
        object<CardsBlock['items'][number]>(
          undefined,
          {
            kicker: str(chars(B.cards.kicker)),
            title: str(chars(B.cards.title)),
            body: str('Inline markdown; budget depends on cols.'),
            icon: str('Lucide icon name, e.g. "shield".'),
            tone: ref('Tone'),
          },
          { title: true },
        ),
        undefined,
        { minItems: 1 },
      ),
    },
    { type: true, cols: true, items: true },
  ),
  takeaway: object<TakeawayBlock>(
    'Key-point bar (:::takeaway label).',
    {
      type: tag('takeaway'),
      label: str(chars(B.takeaway.label)),
      text: str(chars(B.takeaway.text, 'Inline markdown.')),
    },
    { type: true, text: true },
  ),
  table: object<TableBlock>(
    `Table (GFM table). Budget: at most ${B.table.maxCols} columns, ${B.table.maxRows} rows, ${B.table.cell} chars per cell.`,
    {
      type: tag('table'),
      head: arr(str(), 'Header cells.', { minItems: 1 }),
      rows: arr(arr(str()), 'Body rows, one array of cells per row.'),
      caption: str(),
      align: arr(str(undefined, { enum: ['l', 'c', 'r'] }), 'Per-column alignment.'),
    },
    { type: true, head: true, rows: true },
  ),
  compare: object<CompareBlock>(
    `Side-by-side comparison (:::compare left=… right=…). Budget: at most ${B.compare.maxRows} rows.`,
    {
      type: tag('compare'),
      left: str('Left column heading.'),
      right: str('Right column heading.'),
      rows: arr(
        object<CompareBlock['rows'][number]>(
          undefined,
          {
            label: str(chars(B.compare.label)),
            left: str(chars(B.compare.cell)),
            right: str(chars(B.compare.cell)),
          },
          { label: true, left: true, right: true },
        ),
        undefined,
        { minItems: 1 },
      ),
    },
    { type: true, left: true, right: true, rows: true },
  ),
  callout: object<CalloutBlock>(
    'Callout box (:::callout kind title).',
    {
      type: tag('callout'),
      kind: str(undefined, { enum: ['info', 'warn', 'ok', 'danger'] }),
      title: str(chars(B.callout.title)),
      body: str(chars(B.callout.body, 'Inline markdown.')),
    },
    { type: true, kind: true, body: true },
  ),
  steps: object<StepsBlock>(
    `Ordered steps. Budget: at most ${B.steps.maxItems} items.`,
    {
      type: tag('steps'),
      items: arr(
        object<StepsBlock['items'][number]>(
          undefined,
          { title: str(chars(B.steps.title)), body: str(chars(B.steps.body)) },
          { title: true },
        ),
        undefined,
        { minItems: 1 },
      ),
    },
    { type: true, items: true },
  ),
  bullets: object<BulletsBlock>(
    `Bullet list. Budget: at most ${B.bullets.maxItems} items.`,
    {
      type: tag('bullets'),
      items: arr(str(chars(B.bullets.item, 'Inline markdown.')), undefined, { minItems: 1 }),
    },
    { type: true, items: true },
  ),
  columns: object<ColumnsBlock>(
    'Columns (:::columns cols=N with :::col children). Columns may not contain columns.',
    {
      type: tag('columns'),
      cols: int(undefined, { enum: [2, 3] }),
      columns: arr(arr(ref('Block')), 'One block list per column.', { minItems: 1 }),
    },
    { type: true, cols: true, columns: true },
  ),
  image: object<ImageBlock>(
    'Image from Lecture.assets.',
    {
      type: tag('image'),
      asset: str('Key into Lecture.assets.', nonEmpty),
      caption: str(chars(B.image.caption)),
      zoom: bool(),
      fit: str(undefined, { enum: ['contain', 'cover'] }),
      height: num('Height in px on the 1920x1080 canvas.', { exclusiveMinimum: 0 }),
    },
    { type: true, asset: true },
  ),
  video: object<VideoBlock>(
    'YouTube video reference from Lecture.videos.',
    {
      type: tag('video'),
      video: str('Key into Lecture.videos (the YouTube id).', nonEmpty),
      start: num('Start time in seconds.', { minimum: 0 }),
      label: str(chars(B.video.label)),
      caption: str(chars(B.video.caption)),
    },
    { type: true, video: true },
  ),
  quote: object<QuoteBlock>(
    'Block quote.',
    {
      type: tag('quote'),
      text: str(chars(B.quote.text)),
      cite: str(chars(B.quote.cite)),
    },
    { type: true, text: true },
  ),
  code: object<CodeBlock>(
    `Code listing. Budget: at most ${B.code.maxLines} lines of ${B.code.maxCols} columns.`,
    {
      type: tag('code'),
      lang: str('Language, e.g. "bash".'),
      code: str('Code text (verbatim).'),
      title: str(),
    },
    { type: true, code: true },
  ),
  pills: object<PillsBlock>(
    `Pills / badges. Budget: at most ${B.pills.maxItems} items.`,
    {
      type: tag('pills'),
      items: arr(
        object<PillsBlock['items'][number]>(
          undefined,
          { tone: ref('Tone'), text: str(chars(B.pills.text)) },
          { text: true },
        ),
        undefined,
        { minItems: 1 },
      ),
    },
    { type: true, items: true },
  ),
  verdict: object<VerdictBlock>(
    'Verdict chip (:::verdict allow|drop|ok|hot|info label).',
    {
      type: tag('verdict'),
      verdict: str(undefined, { enum: ['allow', 'drop', 'ok', 'hot', 'info'] }),
      label: str(chars(B.verdict.label)),
      text: str(chars(B.verdict.text)),
    },
    { type: true, verdict: true, text: true },
  ),
  timeline: object<TimelineBlock>(
    `Timeline (pipe rows "at | title | body"). Budget: at most ${B.timeline.maxItems} items.`,
    {
      type: tag('timeline'),
      items: arr(
        object<TimelineBlock['items'][number]>(
          undefined,
          {
            at: str(chars(B.timeline.at)),
            title: str(chars(B.timeline.title)),
            body: str(chars(B.timeline.body)),
          },
          { at: true, title: true },
        ),
        undefined,
        { minItems: 1 },
      ),
    },
    { type: true, items: true },
  ),
  tiles: object<TilesBlock>(
    'Tiles (:::tiles cols=N). Budget: at most cols items.',
    {
      type: tag('tiles'),
      cols: int(undefined, { enum: [2, 3, 4, 5] }),
      items: arr(
        object<TilesBlock['items'][number]>(
          undefined,
          {
            icon: str('Lucide icon name.'),
            label: str(chars(B.tiles.label)),
            value: str(chars(B.tiles.value)),
            tone: ref('Tone'),
          },
          { label: true },
        ),
        undefined,
        { minItems: 1 },
      ),
    },
    { type: true, cols: true, items: true },
  ),
  terms: object<TermsBlock>(
    `Abbreviation list (pipe rows "abbr | en | ko"). Budget: at most ${B.terms.maxItems} items.`,
    {
      type: tag('terms'),
      items: arr(
        object<TermsBlock['items'][number]>(
          undefined,
          {
            abbr: str(chars(B.terms.abbr)),
            en: str(chars(B.terms.en)),
            ko: str(chars(B.terms.ko)),
          },
          { abbr: true, ko: true },
        ),
        undefined,
        { minItems: 1 },
      ),
    },
    { type: true, items: true },
  ),
  paragraph: object<ParagraphBlock>(
    `Paragraph. Budget: ${B.paragraph.text} chars, ${B.paragraph.lead} when lead.`,
    {
      type: tag('paragraph'),
      text: str('Inline markdown.'),
      lead: bool('Lead paragraph (larger type).'),
    },
    { type: true, text: true },
  ),
  widget: object<WidgetBlock>(
    'Runtime plugin mount point (Phase 3).',
    {
      type: tag('widget'),
      name: str('Plugin name, e.g. "abac", "quiz", "sim".', nonEmpty),
      params: { type: 'object', description: 'Plugin parameters (free-form).' },
    },
    { type: true, name: true },
  ),
  html: object<HtmlBlock>(
    'Hand-written HTML, inserted verbatim.',
    { type: tag('html'), html: str() },
    { type: true, html: true },
  ),
};

/** Every block type, in catalog order (docs/spec/components.md). */
export const BLOCK_TYPES: readonly BlockType[] = Object.freeze(
  Object.keys(blockSchemas) as BlockType[],
);

/** `$defs` name of a block type's schema: `cards` → `CardsBlock`. */
export const blockDefName = (type: BlockType): string =>
  `${type.charAt(0).toUpperCase()}${type.slice(1)}Block`;

// ---------------------------------------------------------------------------
// Deck-level definitions
// ---------------------------------------------------------------------------

const cue = object<Cue>(
  `One presenter cue. Budget: ${BUDGETS.note.cueText} chars of text.`,
  {
    k: ref('CueKind'),
    t: str('Cue text.'),
    id: str('Stable cue id, e.g. "p04-c002"; assigned at build when absent.', { pattern: CUE_ID }),
    focus: object<NonNullable<Cue['focus']>>(
      'Elements to highlight while the cue is active.',
      { targets: arr(str(undefined, nonEmpty), 'Element ids on the slide, e.g. "s-06-b1".') },
      { targets: true },
    ),
    wait: str('Wait hint, e.g. "10초".'),
    marker: str('Marker as authored when not canonical (alias or unknown marker).'),
  },
  { k: true, t: true },
);

const noteTime = object<NoteTime>(
  'Slide time budget from [시간].',
  {
    minutes: num(undefined, { minimum: 0 }),
    from: str('Start clock, e.g. "10:00".', { pattern: CLOCK }),
    to: str('End clock, e.g. "12:30".', { pattern: CLOCK }),
    remark: str('Text after the range, e.g. "끝나면 휴식 10분".'),
  },
  { minutes: true },
);

const slideNote = object<SlideNote>(
  `Presenter note. Budget: at most ${BUDGETS.note.cuesPerSlide} cues.`,
  {
    time: ref('NoteTime'),
    cues: arr(ref('Cue')),
    raw: str('Note text as authored.'),
  },
  { cues: true },
);

const slide = object<Slide>(
  'One slide.',
  {
    id: str('Stable id; default "s-01", "s-02", … by position.', { pattern: SLIDE_ID }),
    type: oneOfStrings(SLIDE_TYPES),
    tag: str(chars(BUDGETS.slide.tag, 'Eyebrow text.')),
    group: str('TOC grouping label.'),
    title: str(chars(BUDGETS.slide.title)),
    toc: str('TOC / search label when it differs from the visible title; default title.'),
    subtitle: str(chars(BUDGETS.slide.subtitle)),
    question: str(chars(BUDGETS.slide.question, 'Guiding question strip.')),
    alert: bool('Red variant of a hero (or divider) slide.'),
    kicker: str(
      'cover/hero/divider: small line above the title; a cover without one shows "${course} · ${week}주차".',
    ),
    tagline: str(
      'cover/hero/divider: letter-spaced secondary line, e.g. "PHYSICAL ACCESS × IDENTITY".',
    ),
    meta: arr(
      str(),
      'cover/hero/divider: short lines under the title block; a cover without it shows [date, presenter].',
    ),
    art: str(
      'cover/hero/divider: asset id (key into Lecture.assets) shown as artwork on the right.',
      nonEmpty,
    ),
    dark: bool('cover/hero/divider: dark variant (light by default).'),
    refs: arr(str(undefined, { pattern: REF_ID }), 'Ref ids cited on this slide.'),
    layout: str(undefined, { enum: ['default', 'wide'] }),
    blocks: arr(ref('Block')),
    note: ref('SlideNote'),
    html: str('type "raw" only: slide HTML.'),
    no: str('type "divider" only: section number, e.g. "01".'),
    cite: str('type "quote" only: attribution.'),
    only: arr(str(undefined, { pattern: REF_ID }), 'type "references" only: ref ids to list.'),
  },
  { id: true, type: true, title: true, blocks: true },
);

const meta = object<LectureMeta>(
  'Deck metadata (front matter).',
  {
    title: str(undefined, nonEmpty),
    course: str(),
    week: int(undefined, { minimum: 0 }),
    date: str(),
    presenter: str(),
    lang: str(undefined, { enum: ['ko', 'en'] }),
    theme: oneOfStrings(THEMES),
    edition: oneOfStrings(EDITIONS),
    version: str(),
    footer: str('Footer tag; default "${course} · ${week}주차".'),
    duration: num('Planned lecture length in minutes.', { exclusiveMinimum: 0 }),
  },
  { title: true, lang: true, theme: true, edition: true },
);

const refDef = object<Ref>(
  'A cited source.',
  {
    id: str('e.g. "S13".', { pattern: REF_ID }),
    title: str(undefined, nonEmpty),
    url: str(undefined, { format: 'uri' }),
    kind: oneOfStrings(REF_KINDS),
    note: str(),
  },
  { id: true, title: true },
);

const videoDef = object<Video>(
  'A YouTube video.',
  {
    id: str('YouTube id.', { pattern: '^[A-Za-z0-9_-]+$' }),
    title: str(undefined, nonEmpty),
    start: num('Start time in seconds.', { minimum: 0 }),
    credit: str(),
  },
  { id: true, title: true },
);

const assetDef = object<Asset>(
  'An image file.',
  {
    path: str('Relative to the source file, e.g. "assets/campus.png".', nonEmpty),
    title: str(),
    credit: str(),
    source: str('URL of the original.', { format: 'uri' }),
    alt: str(),
    width: int(undefined, { minimum: 1 }),
    height: int(undefined, { minimum: 1 }),
  },
  { path: true },
);

const quizItem = object<QuizItem>(
  'One quiz question.',
  {
    id: str('e.g. "Q01".', nonEmpty),
    area: num(),
    areaName: str(),
    key: str(),
    q: str('Question text.'),
    opts: arr(str(), 'Options.', { minItems: 2 }),
    ans: int('0-based index into opts.', { minimum: 0 }),
    exp: str('Explanation.'),
    refs: arr(str(undefined, { pattern: REF_ID })),
  },
  { id: true, q: true, opts: true, ans: true },
);

const blockDefs: Record<string, JsonSchema> = {};
for (const type of BLOCK_TYPES) blockDefs[blockDefName(type)] = blockSchemas[type];

const root = object<Lecture>(
  'MARCO Lecture IR: the canonical JSON form of a lecture deck.',
  {
    ir: { type: 'string', const: IR_VERSION, description: 'IR version.' },
    meta: ref('LectureMeta'),
    refs: arr(ref('Ref')),
    videos: arr(ref('Video')),
    assets: {
      type: 'object',
      description: 'Asset id → image.',
      additionalProperties: ref('Asset'),
    },
    terms: {
      type: 'object',
      description:
        'Abbreviation → expansion, e.g. LPR → "License Plate Recognition 차량번호 인식".',
      additionalProperties: { type: 'string' },
    },
    slides: arr(ref('Slide'), undefined, { minItems: 1 }),
    quiz: arr(ref('QuizItem')),
    sims: { type: 'object', description: 'Network simulator data (Phase 3, free-form).' },
    terminals: { type: 'object', description: 'Virtual terminal data (Phase 3, free-form).' },
  },
  { ir: true, meta: true, refs: true, videos: true, assets: true, terms: true, slides: true },
);

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * The Lecture IR JSON Schema (draft 2020-12), identical to `lecture.schema.json`.
 * Blocks are a `oneOf` discriminated by the `type` const. Budgets appear in descriptions
 * only: they are lint findings, not validation errors. Deep-frozen.
 */
export const lectureSchema: JsonSchema = deepFreeze({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: LECTURE_SCHEMA_ID,
  title: `MARCO Lecture IR ${IR_VERSION}`,
  ...root,
  $defs: {
    LectureMeta: meta,
    Ref: refDef,
    Video: videoDef,
    Asset: assetDef,
    Tone: oneOfStrings(TONES),
    CueKind: oneOfStrings(
      CUE_KIND_SET,
      'SAY [대사], DO [조작], LOOK [주목], ASK [발문], HOP [이동], SQ [예상질문], SA [예상답변], NEXT [전환], TIP [팁], WAIT [대기], SCREEN [화면], VERIFY [검증], MEMO [메모].',
    ),
    Cue: cue,
    NoteTime: noteTime,
    SlideNote: slideNote,
    Slide: slide,
    Block: {
      type: 'object',
      description: 'A content block, discriminated by "type".',
      oneOf: BLOCK_TYPES.map((type) => ref(blockDefName(type))),
    },
    ...blockDefs,
    QuizItem: quizItem,
  },
});
