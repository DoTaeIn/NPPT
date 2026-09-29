# Releasing the `marco-engine` npm package

`marco-engine` is the installable form of the whole engine: `npx marco-engine …` or
`npm i -g marco-engine` gives the `marco` CLI, the `marco-mcp` MCP server, the runtime, the design
system, the prompt kit, the specs and the agent skill without the monorepo. It is assembled by
`packages/marco-engine/build.mjs`; nothing in the package is edited by hand.

## What the build does

`pnpm --filter marco-engine build` writes the package to `packages/marco-engine/dist/`:

| Path                             | From                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `bin/marco.js`                   | esbuild bundle of `src/entry.ts` + `apps/cli` + every `@marco/*` package     |
| `bin/marco-mcp.js`               | bundle of `src/mcp-entry.ts` + `packages/mcp` (a stub if mcp is not built)   |
| `assets/runtime/`                | `packages/runtime/dist` (without source maps and the debug bundle)           |
| `assets/css/`                    | `packages/design-system/dist`: `marco.css`, `marco.nofonts.css`, `fonts/`    |
| `assets/kit/`                    | `packages/ai/dist/kit`                                                       |
| `assets/templates/`              | `apps/cli/templates`                                                         |
| `assets/schema/`                 | `packages/schema/lecture.schema.json`                                        |
| `assets/spec/`                   | `docs/spec/*.md`                                                             |
| `assets/skill/marco/`            | `skills/marco` (when present)                                                |
| `package.json`                   | generated (below)                                                            |
| `README.md`, `LICENSE`, `NOTICE` | `packages/marco-engine/README.md`, root `LICENSE`, root `NOTICE` + font note |

- The bundles inline all workspace code and leave every third-party module external. The
  generated `package.json` takes its **version from the root `package.json`** and lists as
  `dependencies` exactly the modules the bundles import (plus `lucide-static`, which the compiler
  resolves at run time), with the version ranges the workspace manifests declare. `sharp` is an
  `optionalDependency`; `@playwright/test` an optional `peerDependency` (only `marco pdf` needs it).
  The workspace manifest `packages/marco-engine/package.json` is only the build harness (private,
  no dependencies), so the lockfile is not affected.
- The bundles find their files next to themselves. The entry wrappers call the compiler's
  `setAssetRoots()` with `assets/runtime` and `assets/css` (and set `MARCO_SPEC_DIR` /
  `MARCO_KIT_DIR` for the MCP server); the two `new URL(…, import.meta.url)` paths of `@marco/ai`
  (prompt folder) and `apps/cli` (templates) are rewritten to `assets/` while bundling. The build
  audits every `import.meta` use and, with `--strict`, fails on one it cannot relocate.
- It prints the size of each part; the unpacked package must stay under 25 MB (about 4 MB today,
  2.5 MB packed).
- It needs the other packages built first. `pnpm build` runs every package's build, possibly this
  one before the rest: without `--strict` (or `MARCO_ENGINE_STRICT=1`) it then only warns and skips.
  `pnpm dist`, the tests and the release workflow build it strictly after everything else.

## Local build and check

```bash
pnpm install
pnpm dist                                  # pnpm build, then the strict package build + npm pack
# → packages/marco-engine/marco-engine-<version>.tgz

pnpm --filter marco-engine test            # packs, installs the tarball into a temporary npm prefix
                                           # and runs new/build/lint/ai kit/import/pdf/marco-mcp,
                                           # then renders the decks in headless Chromium
```

The test needs the npm registry (it skips itself when `npm ping` fails, or with
`MARCO_PACK_TEST=0`) and Playwright's Chromium (`pnpm exec playwright install chromium`).

To try a tarball by hand from a clean folder:

```bash
npm install -g --prefix /tmp/marco-try packages/marco-engine/marco-engine-<version>.tgz
PATH=/tmp/marco-try/bin:$PATH marco new week06 --title "6주차" && marco build week06/lecture.marco.md
```

## Releasing

1. Set `"version"` in the **root** `package.json` (for example `0.1.0`, or `0.1.0-rc.1` for a
   pre-release) and commit it.
2. Tag the commit and push the tag:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

3. The [`release`](../.github/workflows/release.yml) workflow then:
   - checks that the tag is `v` + the root version (and fails otherwise),
   - runs `pnpm install --frozen-lockfile`, `pnpm build` and the strict `marco-engine` build,
   - runs the package test (install from the tarball, build decks, render in Chromium),
   - runs `npm pack` and attaches `marco-engine-<version>.tgz` to a GitHub Release with generated
     notes (versions with `-` are marked as pre-releases),
   - publishes the same tarball to npm with `npm publish --provenance --access public`
     (`--tag next` for pre-releases) **only when the `NPM_TOKEN` secret is set**; otherwise it
     leaves a notice and stops after the GitHub Release.

## npm token

Create a granular access token on npmjs.com with read and write permission for the
`marco-engine` package (or, before the first publish, for all packages of the account), and add
it to the repository as an Actions secret named `NPM_TOKEN` (Settings → Secrets and variables →
Actions → New repository secret). Provenance needs no extra setup: the workflow has
`id-token: write`, and the generated `package.json` points `repository` at
`github.com/DoTaeIn/NPPT`, which must be the repository the workflow runs in.

Without the secret the release still produces the tarball; anyone can install it with
`npm install -g <url of the .tgz asset>`.
