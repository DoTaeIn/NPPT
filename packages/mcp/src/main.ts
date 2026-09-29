#!/usr/bin/env node
/** `marco-mcp` bin: the MARCO MCP server over stdio (see `marco-mcp --help`). */
import { runMain } from './stdio.js';

runMain(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
    process.exitCode = 1;
  },
);
