import { loadMarketplaceConfig, validateMarketplaceConfig } from "./marketplace/core.mjs";
import { verifyGooglePlaySalesAccess } from "./marketplace/google-play.mjs";

const config = await loadMarketplaceConfig({ cwd: process.cwd() });
const missing = validateMarketplaceConfig(config);
if (missing.length) {
  console.error(`Marketplace configuration is incomplete: ${missing.join(", ")}`);
  console.error(`Copy .env.marketplace.example to ${config.envPath} and configure the required credentials.`);
  process.exitCode = 1;
} else {
  await verifyGooglePlaySalesAccess({
    serviceAccountJson: config.googlePlayServiceAccountJson,
    serviceAccountJsonPath: config.googlePlayServiceAccountJsonPath,
    salesUri: config.googlePlaySalesUri,
  });
  console.log("Marketplace configuration and Google Play report access are complete.");
}
