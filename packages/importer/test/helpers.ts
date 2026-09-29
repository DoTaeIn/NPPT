import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { V20_DECK, V97_DECK } from './fixtures.js';

export { PNG_1X1 } from './fixtures.js';

export const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(here, '..', '..', '..');

const FIXTURES: Record<string, string> = { 'v20-deck.html': V20_DECK, 'v97-deck.html': V97_DECK };
export const fixture = (name: string): string => {
  const html = FIXTURES[name];
  if (html === undefined) throw new Error(`unknown fixture ${name}`);
  return html;
};
