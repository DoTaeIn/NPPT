/** Programmatic entry points of the `marco` CLI (used by tests and other tools). */
export { runCli, createProgram } from './cli.js';
export { runBuild, runWatch, defaultOutFile, type BuildOptions } from './commands/build.js';
export { runLint, type LintOptions } from './commands/lint.js';
export { runNew, fillTemplate, type NewOptions } from './commands/new.js';
export { defaultIo, type CliIo } from './output.js';
