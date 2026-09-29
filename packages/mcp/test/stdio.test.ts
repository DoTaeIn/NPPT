import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterAll, describe, expect, it } from 'vitest';
import { Sandbox, parseMainArgs } from '../src/index.js';

const MAIN = fileURLToPath(new URL('../dist/main.js', import.meta.url));
const CLI = fileURLToPath(new URL('../../../apps/cli/dist/main.js', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'marco-mcp-stdio-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

async function listOverStdio(args: string[]): Promise<{ tools: string[]; lint: CallToolResult }> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args,
    cwd: root,
    stderr: 'pipe',
  });
  const client = new Client({ name: 'marco-stdio-test', version: '0.0.0' });
  await client.connect(transport);
  try {
    const tools = (await client.listTools()).tools.map((t) => t.name);
    const lint = (await client.callTool({
      name: 'marco_lint',
      arguments: { source_text: '---\ntitle: 덱\n---\n\n# slide\ntitle: 한 장\n\n본문.\n' },
    })) as CallToolResult;
    return { tools, lint };
  } finally {
    await client.close();
  }
}

describe('argument parsing', () => {
  it('defaults to read/write and accepts --read-only / --allow-write', () => {
    expect(parseMainArgs([])).toEqual({ allowWrite: true, help: false, version: false });
    expect(parseMainArgs(['--root', '~/lectures', '--allow-write'])).toMatchObject({
      root: '~/lectures',
      allowWrite: true,
    });
    expect(parseMainArgs(['--read-only']).allowWrite).toBe(false);
    expect(() => parseMainArgs(['--read-only', '--allow-write'])).toThrow(/contradict/);
    expect(() => parseMainArgs(['--nope'])).toThrow();
  });

  it('expands ~ in the root (clients pass arguments without a shell)', () => {
    const sandbox = new Sandbox('~/marco-mcp-not-created', true);
    expect(sandbox.root.startsWith(homedir())).toBe(true);
  });
});

describe.runIf(existsSync(MAIN))('marco-mcp (dist/main.js) over stdio', () => {
  it('starts, lists the tools and answers a call', async () => {
    const { tools, lint } = await listOverStdio([MAIN, '--root', root]);
    expect(tools).toEqual(expect.arrayContaining(['marco_kit', 'marco_build', 'marco_lint']));
    expect(lint.isError).toBeFalsy();
    expect((lint.structuredContent as { ok: boolean }).ok).toBe(true);
  }, 30_000);
});

describe.runIf(existsSync(MAIN) && existsSync(CLI))(
  'marco mcp (the CLI command) over stdio',
  () => {
    it('serves the same tools in-process', async () => {
      const { tools } = await listOverStdio([CLI, 'mcp', '--root', '.']);
      expect(tools).toContain('marco_import');
    }, 30_000);
  },
);
