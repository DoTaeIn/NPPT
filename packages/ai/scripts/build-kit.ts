/**
 * `pnpm --filter @marco/ai build` runs this after tsc: regenerates the cheat-sheet from BUDGETS,
 * writes dist/kit/MARCO-작성-안내.md and copies every prompt into dist/kit/, then prints sizes.
 *
 * Token estimate heuristic: characters / 2.5 for Korean-heavy text. It is a planning number,
 * not a tokenizer count; real counts differ by model (often higher for Hangul on older vocabularies).
 */
import { buildKit } from '../src/kit.js';

const report = await buildKit();
// Numbers first: Korean file names are double-width, so padding names would misalign columns.
const row = (name: string, chars: number, bytes: number, tokens: number) =>
  `${String(chars).padStart(6)} chars ${String(bytes).padStart(6)} B ~${String(tokens).padStart(5)} tok  ${name}`;

console.log(`MARCO prompt kit → ${report.outDir}`);
if (report.cheatsheetUpdated)
  console.log('  regenerated prompts/01-컴포넌트-치트시트.md from BUDGETS');
for (const f of report.files) console.log('  ' + row(f.file, f.chars, f.bytes, f.tokens));
const k = report.kit;
console.log('  ' + row(k.file, k.chars, k.bytes, k.tokens));
console.log(
  `  kit without examples: ${k.charsWithoutExamples} chars (~${k.tokensWithoutExamples} tok, budget ~12000 chars)`,
);
console.log('  token estimate = chars / 2.5 (Korean-heavy heuristic; varies by tokenizer)');
if (k.charsWithoutExamples > 12_000) {
  console.warn(`  WARNING: kit without examples exceeds 12000 chars (${k.charsWithoutExamples})`);
}
