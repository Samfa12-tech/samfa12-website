import path from "node:path";
import {fileURLToPath} from "node:url";
import {comparePackageTrees} from "./briarhold-package-core.mjs";

const siteRoot = process.env.BRIARHOLD_SITE_ROOT
  ? path.resolve(process.env.BRIARHOLD_SITE_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceArg = process.argv[2];
if (!sourceArg) throw new Error("Usage: npm run verify:briarhold-pages -- <verified Briarhold package directory>");
const hosted = path.join(siteRoot, "games", "briarhold", "play");
const source = path.resolve(sourceArg);
const designatedWebsitePlayRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "games", "briarhold", "play");
const result = await comparePackageTrees(source, hosted, {
  sourceHasAuthenticatedRetention: source === designatedWebsitePlayRoot,
});
const retained = result.retainedFiles?.length ?? 0;
console.log(`Verified Briarhold ${result.manifest.version}: ${result.files.length} current-package files match byte for byte${retained ? `; ${retained} authenticated Alpha.102 runtime files remain available for open tabs` : "; no prior compatibility files are present"}.`);
