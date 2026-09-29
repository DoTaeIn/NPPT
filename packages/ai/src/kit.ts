/**
 * Builds the pasteable kit: `dist/kit/MARCO-작성-안내.md` (the system prompt as one file the
 * professor pastes once per chat) plus copies of every prompt file, and keeps the generated
 * cheat-sheet in `prompts/` in sync with BUDGETS.
 */
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BUDGETS } from '@marco/schema';
import { renderCheatsheet } from './cheatsheet.js';
import {
  defaultPromptDir,
  estimateTokens,
  kitWithoutExamples,
  loadPromptKit,
  PROMPT_FILES,
  systemPrompt,
  type PromptName,
} from './prompts.js';

export const KIT_FILE = 'MARCO-작성-안내.md';

export interface KitFileReport {
  file: string;
  chars: number;
  bytes: number;
  tokens: number;
}

export interface KitReport {
  outDir: string;
  kitPath: string;
  /** Whether prompts/01-컴포넌트-치트시트.md was rewritten from BUDGETS. */
  cheatsheetUpdated: boolean;
  files: KitFileReport[];
  /** The pasteable kit: total, and without the examples section (the ~12,000-char budget). */
  kit: KitFileReport & { charsWithoutExamples: number; tokensWithoutExamples: number };
}

export interface BuildKitOptions {
  /** Output folder; default `<package>/dist/kit`. */
  outDir?: string;
  /** Prompt folder; default `<package>/prompts`. */
  promptDir?: string;
  /** Rewrite the generated cheat-sheet when BUDGETS changed; default true. */
  syncCheatsheet?: boolean;
}

function measure(file: string, text: string): KitFileReport {
  const chars = [...text].length;
  return { file, chars, bytes: Buffer.byteLength(text, 'utf8'), tokens: estimateTokens(chars) };
}

/** Regenerate the cheat-sheet file if it differs from `renderCheatsheet(BUDGETS)`. */
export async function syncCheatsheetFile(promptDir: string = defaultPromptDir()): Promise<boolean> {
  const file = path.join(promptDir, PROMPT_FILES.cheatsheet);
  const next = renderCheatsheet(BUDGETS);
  const current = await readFile(file, 'utf8').catch(() => '');
  if (current === next) return false;
  await writeFile(file, next, 'utf8');
  return true;
}

export async function buildKit(options: BuildKitOptions = {}): Promise<KitReport> {
  const promptDir = options.promptDir ?? defaultPromptDir();
  const outDir = options.outDir ?? path.join(promptDir, '..', 'dist', 'kit');
  const cheatsheetUpdated =
    options.syncCheatsheet === false ? false : await syncCheatsheetFile(promptDir);
  const kit = loadPromptKit(promptDir, true);

  // Start the examples folder empty so a renamed or removed example does not linger.
  await rm(path.join(outDir, 'examples'), { recursive: true, force: true });
  await mkdir(path.join(outDir, 'examples'), { recursive: true });
  const files: KitFileReport[] = [];
  for (const [name, file] of Object.entries(PROMPT_FILES) as [PromptName, string][]) {
    await copyFile(path.join(promptDir, file), path.join(outDir, file));
    files.push(measure(file, kit.files[name]));
  }
  for (const ex of kit.examples) {
    const rel = path.join('examples', ex.file);
    await copyFile(path.join(promptDir, rel), path.join(outDir, rel));
    files.push(measure(rel, ex.source));
  }

  const text = systemPrompt(kit);
  const kitPath = path.join(outDir, KIT_FILE);
  await writeFile(kitPath, text, 'utf8');
  const lean = [...kitWithoutExamples(kit)].length;
  return {
    outDir,
    kitPath,
    cheatsheetUpdated,
    files,
    kit: {
      ...measure(KIT_FILE, text),
      charsWithoutExamples: lean,
      tokensWithoutExamples: estimateTokens(lean),
    },
  };
}
