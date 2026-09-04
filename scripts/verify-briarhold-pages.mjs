import path from "node:path";
import {fileURLToPath} from "node:url";
import {comparePackageTrees} from "./briarhold-package-core.mjs";

const siteRoot = process.env.BRIARHOLD_SITE_ROOT
  ? path.resolve(process.env.BRIARHOLD_SITE_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceArg = process.argv[2];
if (!sourceArg) throw new Error("Usage: npm run verify:briarhold-pages -- <verified Briarhold package directory>");
const hosted = path.join(siteRoot, "games", "briarhold", "play");
const result = await comparePackageTrees(path.resolve(sourceArg), hosted);
console.log(`Verified hosted Briarhold ${result.manifest.version}: ${result.files.length} files match the supplied package byte for byte.`);
