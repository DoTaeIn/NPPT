// Writes lecture.schema.json from the built `lectureSchema` (run `build` first).
// The JSON file ships with the package for the AI prompt kit and editors; a test fails
// when it drifts from src/schema.ts.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { lectureSchema } from '../dist/schema.js';

const target = fileURLToPath(new URL('../lecture.schema.json', import.meta.url));
const options = (await prettier.resolveConfig(target)) ?? {};
const json = await prettier.format(JSON.stringify(lectureSchema, null, 2), {
  ...options,
  parser: 'json',
});
writeFileSync(target, json);
console.log(`wrote ${target}`);
