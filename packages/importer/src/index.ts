export const IMPORTER_VERSION = '0.0.1';

export { importLegacyDeck, detectFamily, quizFrom } from './import.js';
export {
  serializeMarco,
  serializeBlock,
  serializeSlide,
  type SerializeOptions,
} from './serialize.js';
export {
  runImport,
  loadImportConfig,
  CONFIG_FILE,
  manifestOf,
  type RunImportOptions,
  type RunImportResult,
  type ManifestEntry,
} from './cli.js';
export { renderReport } from './report.js';
export {
  parseImportConfig,
  ImportConfigError,
  type ImportConfig,
  type SlideRule,
  type SlideOverrides,
  type NotesMode,
} from './config.js';
export { runCorrections, iifeSource } from './corrections.js';
export { splitProseNote, blockSegments, blockText } from './notesplit.js';
export { formatJson, alignMarkdownTables, stringWidth } from './format.js';
export type {
  ImportOptions,
  ImportResult,
  ImportReport,
  ImportedAsset,
  LegacyFamily,
  UnmappedEntry,
  HeuristicEntry,
  DroppedEntry,
  NoteStats,
  ImportedSlide,
  ConfigReport,
  CorrectionsReport,
} from './types.js';
