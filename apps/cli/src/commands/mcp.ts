/**
 * `marco mcp [--root dir]`: the MARCO MCP server (@marco/mcp) over stdio, in this process.
 * stdout carries the protocol, so this command writes only to stderr.
 */
import { type CliIo, paint } from '../output.js';

export interface McpCommandOptions {
  /** Folder the tools may read and write (default: the working directory). */
  root?: string;
  /** Never write files. */
  readOnly?: boolean;
}

/** The part of `@marco/mcp` this command uses. */
interface McpModule {
  runStdioServer(options: {
    root?: string;
    cwd?: string;
    allowWrite?: boolean;
    log?: (line: string) => void;
  }): Promise<void>;
}

/** Load `@marco/mcp` (a workspace dependency; bundled builds inline it). */
export async function loadMcpModule(): Promise<McpModule> {
  return (await import('@marco/mcp')) as McpModule;
}

/** Serve until the MCP client disconnects. Returns the exit code. */
export async function runMcpCommand(opts: McpCommandOptions, io: CliIo): Promise<number> {
  let mcp: McpModule;
  try {
    mcp = await loadMcpModule();
  } catch (e) {
    io.err(`${paint(io, 'red', '오류')} ${(e as Error).message}`);
    return 1;
  }
  try {
    await mcp.runStdioServer({
      cwd: io.cwd,
      ...(opts.root !== undefined ? { root: opts.root } : {}),
      allowWrite: opts.readOnly !== true,
      log: (line) => io.err(line),
    });
    return 0;
  } catch (e) {
    io.err(`${paint(io, 'red', '오류')} MCP 서버: ${(e as Error).message}`);
    return 1;
  }
}
