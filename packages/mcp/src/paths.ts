/**
 * The server's file-system sandbox: every path a tool receives is resolved under `--root` and
 * rejected otherwise (symlinks included), and writes are refused in read-only mode or when the
 * file type does not match what the tool produces.
 */
import { mkdirSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

/** A path argument the server refuses (outside the root, wrong type, read-only). */
export class PathError extends Error {
  override name = 'PathError';
}

/** `~`, `~/x` and `~\x` → the home directory (MCP clients pass args without a shell). */
export function expandHome(path: string): string {
  if (path === '~') return homedir();
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2));
  return path;
}

/** Real path of `path`, or of its nearest existing ancestor with the missing rest appended. */
function realish(path: string): string {
  const rest: string[] = [];
  let current = path;
  for (;;) {
    try {
      const real = realpathSync(current);
      return rest.length ? join(real, ...rest.reverse()) : real;
    } catch {
      const parent = dirname(current);
      if (parent === current) return path;
      rest.push(basename(current));
      current = parent;
    }
  }
}

export type WriteKind = 'source' | 'html' | 'png' | 'dir';

const WRITE_EXT: Record<Exclude<WriteKind, 'dir'>, { re: RegExp; label: string }> = {
  source: { re: /\.md$/i, label: '.marco.md' },
  html: { re: /\.html?$/i, label: '.html' },
  png: { re: /\.png$/i, label: '.png' },
};

/** Where the server keeps staged sources and backups, relative to the root. */
export const WORK_DIR = '.marco/mcp';

export class Sandbox {
  /** Real path of the root directory. */
  readonly root: string;

  constructor(
    root: string,
    readonly allowWrite: boolean,
  ) {
    this.root = realish(resolve(expandHome(root)));
  }

  /** True when `path` (absolute, real) is the root or inside it. */
  contains(path: string): boolean {
    const rel = relative(this.root, path);
    return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
  }

  /** True when `path` (absolute; symlinks followed) lies under the root. */
  inside(path: string): boolean {
    return this.contains(realish(path));
  }

  /** Resolve a tool's path argument (relative to the root, or absolute inside it). */
  resolve(input: string, label: string): string {
    const text = typeof input === 'string' ? input.trim() : '';
    if (!text) throw new PathError(`${label}: empty path.`);
    if (text.includes('\0')) throw new PathError(`${label}: invalid path.`);
    const real = realish(resolve(this.root, expandHome(text)));
    if (!this.contains(real)) {
      throw new PathError(
        `${label} "${input}" is outside the server root (${this.root}). Pass a path relative to the root, e.g. "week06/lecture.marco.md".`,
      );
    }
    return real;
  }

  /** Resolve a path the tool will write; checks read-only mode and the file type. */
  writable(input: string, label: string, kind: WriteKind): string {
    this.assertWritable();
    const path = this.resolve(input, label);
    if (kind !== 'dir') {
      const want = WRITE_EXT[kind];
      if (!want.re.test(path)) {
        throw new PathError(
          `${label} "${input}" must end with ${want.label} (this tool only writes ${want.label} files).`,
        );
      }
      if (path === this.root) throw new PathError(`${label}: cannot write to the root itself.`);
    }
    return path;
  }

  assertWritable(): void {
    if (!this.allowWrite) {
      throw new PathError(
        'The MARCO MCP server runs read-only (--read-only): it cannot write files. Use marco_lint / marco_check_slide, or restart the server without --read-only.',
      );
    }
  }

  /** Path relative to the root with forward slashes (for messages); "." for the root. */
  rel(path: string): string {
    const rel = relative(this.root, path);
    return rel === '' ? '.' : rel.split(sep).join('/');
  }

  /** `<root>/.marco/mcp/<parts…>`. */
  work(...parts: string[]): string {
    return join(this.root, ...WORK_DIR.split('/'), ...parts);
  }

  /** Write a file after creating its folder (the path must come from `writable` or `work`). */
  write(path: string, data: string | Uint8Array): void {
    this.assertWritable();
    if (!this.inside(path)) throw new PathError('refusing to write outside the root.');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data);
  }

  /**
   * Copy `content` (the file's current text) to `.marco/mcp/backups/` before a tool overwrites
   * the file; keeps the newest {@link BACKUPS_PER_FILE} copies per file. Returns the backup path.
   */
  backup(path: string, content: string): string {
    const key = this.rel(path).replace(/[\\/]/g, '__');
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d+Z$/, 'Z');
    const dir = this.work('backups');
    const file = join(dir, `${stamp}__${key}`);
    this.write(file, content);
    try {
      const mine = readdirSync(dir)
        .filter((f) => f.slice(f.indexOf('__') + 2) === key)
        .sort();
      for (const old of mine.slice(0, Math.max(0, mine.length - BACKUPS_PER_FILE))) {
        rmSync(join(dir, old), { force: true });
      }
    } catch {
      /* pruning is best effort */
    }
    return file;
  }
}

export const BACKUPS_PER_FILE = 20;

export function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** `lecture.marco.md` → `lecture.html` next to the source (as `marco build`). */
export function defaultOutFile(source: string): string {
  const name = basename(source)
    .replace(/(\.marco)?\.md$/i, '')
    .replace(/\.[^.]+$/, '');
  return join(dirname(source), `${name || 'lecture'}.html`);
}

export const hasExt = (path: string, ...exts: string[]): boolean =>
  exts.includes(extname(path).toLowerCase());
