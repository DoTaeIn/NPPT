import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const PKG = fileURLToPath(new URL('..', import.meta.url));
export const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
export const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

export const readText = (path: string): string => readFileSync(path, 'utf8');
export const readJson = <T = Record<string, unknown>>(path: string): T =>
  JSON.parse(readText(path)) as T;

export interface PublishedManifest {
  name: string;
  version: string;
  bin: Record<string, string>;
  files: string[];
  dependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  peerDependenciesMeta: Record<string, { optional?: boolean }>;
}

/** npm package name of an import specifier (`ajv/dist/2020.js` → `ajv`). */
export const packageName = (spec: string): string =>
  spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : (spec.split('/')[0] ?? spec);

export const ATTRIBUTION =
  'Powered by MARCO — Created by DoTaeIn, Original project: https://github.com/DoTaeIn/Marco';
