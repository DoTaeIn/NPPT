/**
 * Programmatic entry for `marco import` (the CLI command itself is wired by another package):
 * import a legacy deck file and write the MARCO source, assets, manifest and report.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { parseImportConfig, type ImportConfig } from './config.js';
import { formatJson } from './format.js';
import { importLegacyDeck } from './import.js';
import { sha256 } from './payloads.js';
import { renderReport } from './report.js';
import type { ImportOptions, ImportResult } from './types.js';

/** Per-deck config file looked up in the output folder. */
export const CONFIG_FILE = 'import.config.json';

export interface RunImportOptions extends Omit<ImportOptions, 'sourceName' | 'config'> {
  /** Write `lecture.marco.md` (default true). Set false to refresh assets/report without clobbering a hand-edited source. */
  writeSource?: boolean;
  /** File name of the source inside outDir (default `lecture.marco.md`). */
  sourceFile?: string;
  /**
   * Per-deck config: an object, a path to a JSON file, or `false` for none. Default: the
   * `import.config.json` in outDir when it exists.
   */
  config?: ImportConfig | string | false;
}

/** Read and validate an `import.config.json` (throws `ImportConfigError` on a bad file). */
export async function loadImportConfig(path: string): Promise<ImportConfig> {
  let json: unknown;
  try {
    json = JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch (e) {
    throw new Error(`${path}: ${(e as Error).message}`, { cause: e });
  }
  return parseImportConfig(json);
}

export interface ManifestEntry {
  id: string;
  fileName: string;
  mime: string;
  bytes: number;
  sha256: string;
  title?: string;
  credit?: string;
  source?: string;
}

export interface RunImportResult {
  result: ImportResult;
  /** Paths written, relative to outDir. */
  files: string[];
}

export function manifestOf(result: ImportResult): ManifestEntry[] {
  return result.assets.map((a) => {
    const entry: ManifestEntry = {
      id: a.id,
      fileName: a.fileName,
      mime: a.mime,
      bytes: a.bytes.length,
      sha256: sha256(a.bytes),
    };
    if (a.title) entry.title = a.title;
    if (a.credit) entry.credit = a.credit;
    if (a.source) entry.source = a.source;
    return entry;
  });
}

export async function runImport(
  inputHtml: string,
  outDir: string,
  opts: RunImportOptions = {},
): Promise<RunImportResult> {
  const html = await readFile(inputHtml, 'utf8');
  const importOpts: ImportOptions = { sourceName: basename(inputHtml) };
  if (opts.family) importOpts.family = opts.family;
  if (opts.assetDir) importOpts.assetDir = opts.assetDir;
  if (opts.config !== false) {
    const path =
      typeof opts.config === 'string'
        ? opts.config
        : opts.config === undefined && existsSync(join(outDir, CONFIG_FILE))
          ? join(outDir, CONFIG_FILE)
          : undefined;
    if (path) {
      importOpts.config = await loadImportConfig(path);
      const rel = relative(outDir, path);
      importOpts.configSource = rel && !rel.startsWith('..') ? rel : basename(path);
    } else if (typeof opts.config === 'object') importOpts.config = opts.config;
  }
  const result = importLegacyDeck(html, importOpts);
  const assetDir = (opts.assetDir ?? 'assets').replace(/\/+$/, '');
  const files: string[] = [];
  const write = async (rel: string, data: string | Uint8Array): Promise<void> => {
    await writeFile(join(outDir, rel), data);
    files.push(rel);
  };

  await mkdir(join(outDir, assetDir), { recursive: true });
  for (const asset of result.assets) {
    if (asset.stripped || !asset.bytes.length) continue;
    await write(`${assetDir}/${asset.fileName}`, asset.bytes);
  }
  if (opts.writeSource !== false) await write(opts.sourceFile ?? 'lecture.marco.md', result.source);
  for (const [rel, value] of Object.entries(result.sidecars)) await write(rel, formatJson(value));
  await write('assets.manifest.json', formatJson(manifestOf(result)));
  await write('IMPORT-REPORT.md', renderReport(result.report));
  return { result, files };
}
