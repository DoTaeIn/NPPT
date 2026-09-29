/**
 * Entry point of the published `marco-mcp` binary (build.mjs bundles it with the MCP server into
 * `bin/marco-mcp.js`). Sets the packaged asset locations, then starts packages/mcp unchanged.
 */
import { usePackagedAssets } from './assets.js';

usePackagedAssets(import.meta.url);
await import('../../mcp/src/main.js');
