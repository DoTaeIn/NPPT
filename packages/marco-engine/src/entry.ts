/**
 * Entry point of the published `marco` / `marco-engine` binary (build.mjs bundles it with the
 * whole CLI into `bin/marco.js`). Sets the packaged asset roots, then runs apps/cli unchanged.
 */
import { usePackagedAssets } from './assets.js';
import { explainMissingPlaywright } from './hints.js';

usePackagedAssets(import.meta.url);
explainMissingPlaywright(process.argv.slice(2));
await import('../../../apps/cli/src/main.js');
