/** Lecture IR types and enumerations used by the compiler (re-exported from `@marco/schema`). */
import type { Slide } from '@marco/schema';

export type {
  Asset,
  Block,
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
  LintIssue,
  NoteTime,
  ParagraphBlock,
  PillsBlock,
  QuizItem,
  QuoteBlock,
  Ref,
  Slide,
  SlideNote,
  StepsBlock,
  TableBlock,
  TakeawayBlock,
  TermsBlock,
  ThemeId,
  TilesBlock,
  TimelineBlock,
  Tone,
  ValidationError,
  ValidationResult,
  VerdictBlock,
  Video,
  VideoBlock,
  WidgetBlock,
} from '@marco/schema';

/** The cover / hero / divider fields of format.md §4 and components.md §1 (plus `toc`). */
export type SlideTitleFields = Pick<Slide, 'kicker' | 'tagline' | 'meta' | 'art' | 'toc' | 'dark'>;

/** Slide types that take the title-slide fields (`kicker`, `tagline`, `meta`, `art`, `dark`). */
export const TITLE_SLIDE_TYPES = ['cover', 'hero', 'divider'] as const;

export const TONES = ['neutral', 'primary', 'ok', 'warn', 'danger', 'info'] as const;
export const THEMES = ['v20-violet', 'cau-navy'] as const;
export const EDITIONS = ['student', 'instructor'] as const;
export const SLIDE_TYPES = [
  'cover',
  'divider',
  'quote',
  'hero',
  'content',
  'references',
  'raw',
] as const;
export const VERDICTS = ['allow', 'drop', 'ok', 'hot', 'info'] as const;
export const CALLOUT_KINDS = ['info', 'warn', 'ok', 'danger'] as const;
export const REF_KINDS = [
  'standard',
  'law',
  'paper',
  'vendor',
  'article',
  'video',
  'other',
] as const;
