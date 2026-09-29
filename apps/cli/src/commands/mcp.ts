/**
 * `marco mcp [--root dir]`: the MARCO MCP server (@marco/mcp) over stdio, in this process.
 * stdout carries the protocol, so this command writes only to stderr.
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
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

/**
 * Load `@marco/mcp`: by package name (bundled and installed builds inline or resolve it), else
 * the monorepo's built package, because the CLI does not declare the dependency yet.
 */
export async function loadMcpModule(): Promise<McpModule> {
  try {
    // @ts-expect-error -- @marco/mcp is not a dependency of @marco/cli yet; drop this line and the fallback below once it is.
    return (await import('@marco/mcp')) as McpModule;
  } catch (e) {
    if ((e as { code?: string }).code !== 'ERR_MODULE_NOT_FOUND') throw e;
  }
  let path: string;
  try {
    path = createRequire(import.meta.url).resolve('../../../../packages/mcp/dist/index.js');
  } catch {
    throw new Error(
      'MCP 서버 모듈(@marco/mcp)을 찾을 수 없습니다. `pnpm --filter @marco/mcp build`로 빌드한 뒤 다시 실행하세요.',
    );
  }
  return (await import(pathToFileURL(path).href)) as McpModule;
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
