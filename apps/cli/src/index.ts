/** Programmatic entry points of the `marco` CLI (used by tests and other tools). */
export { runCli, createProgram } from './cli.js';
export { runBuild, runWatch, defaultOutFile, type BuildOptions } from './commands/build.js';
export { runLint, type LintOptions } from './commands/lint.js';
export { runNew, fillTemplate, type NewOptions } from './commands/new.js';
export {
  runImportCommand,
  IMPORT_FAMILIES,
  type ImportCommandOptions,
  type ImportFamily,
} from './commands/import.js';
export {
  runPdf,
  countPdfPages,
  defaultPdfFile,
  loadChromium,
  PDF_MODES,
  type PdfMode,
  type PdfOptions,
} from './commands/pdf.js';
export {
  addAiCommands,
  makeProvider,
  deckIssues,
  parseRange,
  parseSlideList,
  AiCommandError,
  PROVIDER_MODES,
  type ProviderMode,
  type ProviderOptions,
} from './commands/ai.js';
export { defaultIo, type CliIo } from './output.js';
