export const IMPORTER_VERSION = '0.0.1';

export { importLegacyDeck, detectFamily, quizFrom } from './import.js';
export { serializeMarco, serializeBlock, serializeSlide, type SerializeOptions } from './serialize.js';
export { runImport, manifestOf, type RunImportOptions, type RunImportResult, type ManifestEntry } from './cli.js';
export { renderReport } from './report.js';
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
} from './types.js';
