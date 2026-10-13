// Current economic fixtures use production APIs. The v0.2 JSON is historical.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
execFileSync(process.execPath,['node_modules/typescript/bin/tsc'],{cwd:root,stdio:'inherit'});
execFileSync(process.execPath,['--test','tests/economic-pacing.test.mjs'],{cwd:root,stdio:'inherit'});
