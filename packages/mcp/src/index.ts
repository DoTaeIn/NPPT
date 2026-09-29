/**
 * @marco/mcp — the MARCO Engine as an MCP server: AI applications scaffold, build, lint and
 * import lecture decks through tools instead of writing slide HTML. See README.md.
 */
export const MCP_VERSION = '0.0.1';

export {
  createMarcoServer,
  SERVER_NAME,
  MAX_TEXT_BYTES,
  MAX_INLINE_IMAGE_BYTES,
  type MarcoServerOptions,
} from './server.js';
export {
  runStdioServer,
  runMain,
  parseMainArgs,
  USAGE,
  type StdioOptions,
  type MainArgs,
} from './stdio.js';
export { Sandbox, PathError, WORK_DIR, expandHome } from './paths.js';
export { repairHint, AUTHOR_CODES, type HintInput } from './hints.js';
export {
  SPEC_NAMES,
  KIT_SECTIONS,
  MCP_KIT_PREFACE,
  kitSection,
  kitText,
  readSpec,
  schemaText,
  specDir,
  type SpecName,
  type KitSection,
  type ResourceLocations,
} from './resources.js';
export { screenshotSlide, loadChromium, PREVIEW_UNAVAILABLE } from './preview.js';
export { LECTURE_TEMPLATE, ASSETS_README } from './template.js';
