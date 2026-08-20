import { loadMarketplaceConfig, validateMarketplaceConfig } from "./marketplace/core.mjs";

const config = await loadMarketplaceConfig({ cwd: process.cwd() });
const missing = validateMarketplaceConfig(config);
if (missing.length) {
  console.error(`Marketplace configuration is incomplete: ${missing.join(", ")}`);
  console.error(`Copy .env.marketplace.example to ${config.envPath} and configure the required credentials.`);
  process.exitCode = 1;
} else {
  console.log("Marketplace configuration is complete.");
}
