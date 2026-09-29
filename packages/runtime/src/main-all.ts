// Entry of dist/marco-runtime.all.js: the core runtime plus every bundled plugin, registered
// before the runtime starts. The compiler embeds this bundle when a deck has any widget.
import { boot } from './boot';
import { BUNDLED } from './plugins/bundled';

boot(BUNDLED);
