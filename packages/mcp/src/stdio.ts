/**
 * Running the server over stdio (what `marco-mcp` and `marco mcp` do), and the argument parser
 * shared by both. stdout carries the protocol, so every log line goes to stderr.
 */
import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ENGINE_VERSION } from '@marco/compiler';
import { createMarcoServer, type MarcoServerOptions } from './server.js';

export interface StdioOptions extends MarcoServerOptions {
  /** Where status lines go (default stderr). Never stdout: it carries the protocol. */
  log?: (line: string) => void;
}

/** Serve on this process's stdin/stdout until the client disconnects (stdin ends) or a signal. */
export async function runStdioServer(options: StdioOptions = {}): Promise<void> {
  const log = options.log ?? ((line: string) => process.stderr.write(`${line}\n`));
  const { server, sandbox } = createMarcoServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(
    `marco-mcp ${ENGINE_VERSION}: serving ${sandbox.root} (${sandbox.allowWrite ? 'read/write' : 'read-only'}) over stdio`,
  );
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      process.stdout.off('error', stop);
      process.stdin.off('end', stop);
      process.stdin.off('close', stop);
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
      resolve();
    };
    const stop = (): void => {
      void server.close().finally(finish);
    };
    server.server.onclose = finish;
    // The client went away mid-write (EPIPE): shut down instead of crashing.
    process.stdout.on('error', stop);
    process.stdin.once('end', stop);
    process.stdin.once('close', stop);
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}

export const USAGE = `Usage: marco-mcp [--root <dir>] [--read-only]

MARCO Engine MCP server over stdio, for Claude Desktop, Claude Code, Cursor and other MCP clients.

Options:
  --root <dir>    Folder the tools may read and write (default: the current folder; ~ is expanded,
                  a missing folder is created). Every path argument must lie inside it.
  --allow-write   Let tools write under the root: scaffold, save and build decks, import, previews
                  (the default; accepted for explicit configs).
  --read-only     Never write: marco_new, marco_import, marco_replace_slide and saving source_text
                  are refused; marco_build compiles and reports without writing the HTML.
  -h, --help      Show this help.
  -v, --version   Show the engine version.

Environment: MARCO_SPEC_DIR (folder with the spec .md files), MARCO_KIT_DIR (built prompt kit).`;

export interface MainArgs {
  root?: string;
  allowWrite: boolean;
  help: boolean;
  version: boolean;
}

/** Parse `marco-mcp` arguments (throws on unknown options). */
export function parseMainArgs(argv: string[]): MainArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      root: { type: 'string' },
      'allow-write': { type: 'boolean' },
      'read-only': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values['read-only'] && values['allow-write']) {
    throw new Error('--read-only and --allow-write contradict each other.');
  }
  const out: MainArgs = {
    allowWrite: values['read-only'] !== true,
    help: values.help === true,
    version: values.version === true,
  };
  if (values.root !== undefined) out.root = values.root;
  return out;
}

/** `marco-mcp` entry: returns the exit code. */
export async function runMain(argv: string[]): Promise<number> {
  let args: MainArgs;
  try {
    args = parseMainArgs(argv);
  } catch (e) {
    process.stderr.write(`marco-mcp: ${(e as Error).message}\n\n${USAGE}\n`);
    return 2;
  }
  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (args.version) {
    process.stdout.write(`${ENGINE_VERSION}\n`);
    return 0;
  }
  try {
    await runStdioServer({
      ...(args.root !== undefined ? { root: args.root } : {}),
      allowWrite: args.allowWrite,
    });
    return 0;
  } catch (e) {
    process.stderr.write(`marco-mcp: ${(e as Error).message}\n`);
    return 1;
  }
}
